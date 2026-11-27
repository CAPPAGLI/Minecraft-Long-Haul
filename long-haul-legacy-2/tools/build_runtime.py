#!/usr/bin/env python3
"""Build the pinned Forge runtime mod.
Uses system javac (Java 17+) when available, otherwise falls back to ECJ 3.33.0.
Requires Forge 47.4.10 libraries (server-test/libraries or --libs-dir) for compile-time APIs.
"""
import argparse, hashlib, os, pathlib, shutil, subprocess, tomllib, urllib.request, zipfile

R = pathlib.Path(__file__).resolve().parents[1]

def find_java_tools(libs_dir: pathlib.Path | None = None):
    javac = shutil.which('javac')
    java = shutil.which('java')
    if not java or not javac:
        java_home = os.environ.get('JAVA_HOME')
        if java_home:
            for ext in ('', '.exe'):
                cand = pathlib.Path(java_home) / f'bin/java{ext}'
                if not java and cand.exists():
                    java = str(cand)
                cand_c = pathlib.Path(java_home) / f'bin/javac{ext}'
                if not javac and cand_c.exists():
                    javac = str(cand_c)

    search_roots = [R / 'runtime']
    if libs_dir is not None:
        search_roots.extend([
            libs_dir.parent / 'runtime',
            libs_dir.parent.parent / 'jre',
            libs_dir.parent.parent / 'runtime',
        ])
    if os.name == 'nt':
        for pf in (os.environ.get('ProgramFiles', 'C:\\Program Files'), os.environ.get('ProgramFiles(x86)', 'C:\\Program Files (x86)')):
            pf_path = pathlib.Path(pf)
            for vendor in ('Eclipse Adoptium', 'Java', 'Microsoft', 'Zulu', 'Amazon Corretto', 'BellSoft'):
                search_roots.append(pf_path / vendor)

    # Prefer JDK 17 (required by Forge 1.20.1 / Mixin) when scanning installations
    def _sort_key(p: pathlib.Path):
        s = str(p).lower()
        is_17 = '17' in s or 'gamma' in s
        return (0 if is_17 else 1, s)

    for root in search_roots:
        if not root.exists():
            continue
        for pat in ('*/bin/javac.exe', '*/bin/javac', '**/bin/javac.exe', '**/bin/javac'):
            cands = sorted(root.glob(pat), key=_sort_key)
            if cands and not javac:
                javac = str(cands[0])
                break
        for pat in ('*/bin/java.exe', '*/bin/java', '**/bin/java.exe', '**/bin/java'):
            cands = sorted(root.glob(pat), key=_sort_key)
            if cands and not java:
                java = str(cands[0])
                break
        if javac and java:
            break

    return java, javac

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--libs-dir', default=None, help='Path to Forge libraries folder (default: server-test/libraries)')
    ap.add_argument('--mods-dir', default=None, help='Path to mods folder containing Xaero JARs (default: assembly/mods)')
    ap.add_argument('--out-dir', default=None, help='Output directory for longhaul-runtime-*.jar (default: overrides/mods)')
    args = ap.parse_args()

    lib_root = pathlib.Path(args.libs_dir) if args.libs_dir else (R / 'server-test/libraries')
    if not lib_root.exists():
        raise RuntimeError(f'Missing Forge 47.4.10 libraries at {lib_root}; run prepare_server.py or pass --libs-dir')

    java, javac = find_java_tools(lib_root)
    if not java and not javac:
        raise RuntimeError('No Java 17 runtime or compiler found in PATH, JAVA_HOME, or runtime/')

    cp = []
    for jar in sorted(lib_root.rglob('*.jar')):
        n = jar.name
        if n.endswith('-slim.jar') or n.endswith('-extra.jar') or n.endswith('-mappings.jar') or n.endswith('-installer.jar'):
            continue
        cp.append(str(jar))
    if not any('mixin-' in p for p in cp) or not any('javafmllanguage-' in p for p in cp):
        raise RuntimeError(f'Missing mixin/javafmllanguage in libraries at {lib_root}')

    mods_lookup = pathlib.Path(args.mods_dir) if args.mods_dir else (R / 'assembly/mods')
    xaero_wm = sorted(mods_lookup.glob('xaeroworldmap-*.jar')) if mods_lookup.exists() else []
    xaero_mm = sorted(mods_lookup.glob('xaerominimap-*.jar')) if mods_lookup.exists() else []
    has_xaero_wm = bool(xaero_wm)
    has_xaero_mm = bool(xaero_mm)
    has_mc_srg = any('-srg.jar' in p for p in cp)
    if has_xaero_wm:
        cp.append(str(xaero_wm[-1]))
    if has_xaero_mm:
        cp.append(str(xaero_mm[-1]))

    src = R / 'runtime-mod/src'
    classes = R / 'runtime-mod/classes'
    if classes.exists():
        shutil.rmtree(classes)
    classes.mkdir(parents=True, exist_ok=True)
    all_sources = sorted((src / 'main/java').rglob('*.java'))
    java_sources = []
    for p in all_sources:
        name = p.name
        if name == 'TerritoryMapHelper.java' and not has_mc_srg:
            continue
        if name in ('LongHaulXaeroData.java', 'XaeroRefreshBridge.java') and not (has_mc_srg and (has_xaero_wm or has_xaero_mm)):
            continue
        if name in ('WorldMapSectorHighlighter.java', 'WorldMapRegistryMixin.java') and not (has_mc_srg and has_xaero_wm):
            continue
        if name in ('MinimapSectorHighlighter.java', 'MinimapRegistryMixin.java') and not (has_mc_srg and has_xaero_mm):
            continue
        java_sources.append(str(p))

    if javac:
        subprocess.run([javac, '--release', '17', '-proc:none', '-cp', os.pathsep.join(cp), '-d', str(classes), *java_sources], check=True)
    else:
        compiler = R / '.cache/ecj.jar'
        compiler.parent.mkdir(exist_ok=True)
        if not compiler.exists():
            with urllib.request.urlopen('https://repo.maven.apache.org/maven2/org/eclipse/jdt/ecj/3.33.0/ecj-3.33.0.jar', timeout=60) as r:
                compiler.write_bytes(r.read())
        subprocess.run([java, '-Xmx256m', '-jar', str(compiler), '-17', '-proc:none', '-cp', os.pathsep.join(cp), '-d', str(classes), *java_sources], check=True)

    mods_toml = tomllib.loads((src / 'main/resources/META-INF/mods.toml').read_text(encoding='utf-8'))
    version = mods_toml['mods'][0]['version']
    mods_dir = pathlib.Path(args.out_dir) if args.out_dir else (R / 'overrides/mods')
    mods_dir.mkdir(parents=True, exist_ok=True)
    for old in mods_dir.glob('longhaul-runtime-*.jar'):
        old.unlink()
    output = mods_dir / f'longhaul-runtime-1.20.1-{version}.jar'
    license_text = (R / 'runtime-mod/LICENSE').read_text(encoding='utf-8')
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('META-INF/MANIFEST.MF', 'Manifest-Version: 1.0\nMixinConfigs: longhaul-runtime.mixins.json\n\n')
        z.writestr('LICENSE', license_text)
        for base in [classes, src / 'main/resources']:
            for p in sorted(base.rglob('*')):
                if p.is_file():
                    z.write(p, p.relative_to(base))
    print(output, hashlib.sha512(output.read_bytes()).hexdigest())


if __name__ == '__main__':
    main()
