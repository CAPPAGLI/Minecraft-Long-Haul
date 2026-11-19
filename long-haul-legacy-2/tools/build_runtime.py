#!/usr/bin/env python3
"""Build the pinned Forge runtime mod.
Uses system javac (Java 17+) when available, otherwise falls back to ECJ 3.33.0.
Requires installed Forge 47.4.10 server-test/libraries for compile-time APIs.
"""
import hashlib, os, pathlib, shutil, subprocess, tomllib, urllib.request, zipfile

R = pathlib.Path(__file__).resolve().parents[1]

def find_java_tools():
    javac = shutil.which('javac')
    java = shutil.which('java')
    if not java:
        java_home = os.environ.get('JAVA_HOME')
        if java_home:
            cand = pathlib.Path(java_home) / 'bin/java'
            if cand.exists():
                java = str(cand)
            cand_c = pathlib.Path(java_home) / 'bin/javac'
            if cand_c.exists():
                javac = str(cand_c)
    if not java:
        local = list((R / 'runtime').glob('*/bin/java'))
        if local:
            java = str(local[0])
    return java, javac

def main():
    java, javac = find_java_tools()
    if not java and not javac:
        raise RuntimeError('No Java 17 runtime or compiler found in PATH, JAVA_HOME, or runtime/')

    cp = []
    for pattern in ['javafmllanguage-1.20.1-47.4.10.jar', 'mixin-0.8.5.jar']:
        found = list((R / 'server-test/libraries').rglob(pattern))
        if len(found) != 1:
            raise RuntimeError('Install Forge 47.4.10 server first: ' + pattern)
        cp.append(str(found[0]))

    src = R / 'runtime-mod/src'
    classes = R / 'runtime-mod/classes'
    if classes.exists():
        shutil.rmtree(classes)
    classes.mkdir(parents=True, exist_ok=True)
    java_sources = [str(p) for p in sorted((src / 'main/java').rglob('*.java'))]

    if javac:
        subprocess.run([javac, '--release', '17', '-proc:none', '-cp', os.pathsep.join(cp), '-d', str(classes), *java_sources], check=True)
    else:
        compiler = R / '.cache/ecj.jar'
        compiler.parent.mkdir(exist_ok=True)
        if not compiler.exists():
            with urllib.request.urlopen('https://repo.maven.apache.org/maven2/org/eclipse/jdt/ecj/3.33.0/ecj-3.33.0.jar', timeout=60) as r:
                compiler.write_bytes(r.read())
        subprocess.run([java, '-Xmx256m', '-jar', str(compiler), '-17', '-proc:none', '-cp', os.pathsep.join(cp), '-d', str(classes), *java_sources], check=True)

    mods_toml = tomllib.loads((src / 'main/resources/META-INF/mods.toml').read_text())
    version = mods_toml['mods'][0]['version']
    mods_dir = R / 'overrides/mods'
    mods_dir.mkdir(parents=True, exist_ok=True)
    for old in mods_dir.glob('longhaul-runtime-*.jar'):
        old.unlink()
    output = mods_dir / f'longhaul-runtime-1.20.1-{version}.jar'
    license_text = (R / 'runtime-mod/LICENSE').read_text()
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
