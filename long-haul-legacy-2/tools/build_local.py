#!/usr/bin/env python3
"""Fast local build script for Long Haul Legacy 2.0 on the user's PC.

Replaces the ~30-minute GitHub Actions build:
1. Runs JS unit tests (if node is installed) and regenerates structures, worldgen, and 4,700+ Heracles quests (~2s)
2. Incrementally resolves/downloads ONLY missing or changed mods (reusing --instance/mods and assembly/mods)
3. Builds longhaul-runtime-*.jar (using Forge libraries from server-test/libraries or --instance/../../libraries)
4. Inspects all JAR mod IDs & version ranges
5. Packages .mrpack + Sources zip (optional via --no-package)
6. Optionally delta-syncs straight into --instance
7. Runs Forge headless smoke tests ONLY if explicitly requested via --smoke void / --smoke normal
"""
import argparse
import hashlib
import json
import pathlib
import shutil
import subprocess
import sys

R = pathlib.Path(__file__).resolve().parents[1]
REPO_ROOT = R.parent
DEFAULT_PROFILE = R / 'profiles/alpha20.json'
LOCAL_LOCK = R / 'assembly/local-lock.json'
RUNTIME_OUT_DIR = R / '.cache/runtime-out'
LAST_INSTANCE_FILE = R / '.cache/last_instance.txt'


def run_step(cmd, cwd=REPO_ROOT):
    print('>', ' '.join(str(c) for c in cmd), flush=True)
    subprocess.run([str(c) for c in cmd], cwd=str(cwd), check=True)


def detect_libs_dir(instance_dir: pathlib.Path | None, explicit_libs: str | None) -> pathlib.Path | None:
    candidates = []
    if explicit_libs:
        candidates.append(pathlib.Path(explicit_libs))
    candidates.append(R / 'server-test/libraries')
    if instance_dir:
        candidates.extend([
            instance_dir.parent.parent / 'libraries',
            instance_dir.parent / 'libraries',
            instance_dir / 'libraries',
        ])
    for cand in candidates:
        if cand.exists() and any(cand.rglob('*-srg.jar')) and any(cand.rglob('mixin-*.jar')):
            return cand
    return None


def main():
    ap = argparse.ArgumentParser(description='Local build pipeline for Long Haul Legacy 2.0')
    ap.add_argument('--profile', default=str(DEFAULT_PROFILE), help='Profile JSON (default: profiles/alpha20.json)')
    ap.add_argument('--instance', default=None, help='Optional Minecraft instance path (used to seed cached JARs and/or auto-sync)')
    ap.add_argument('--sync', action='store_true', help='Also delta-sync the built pack into --instance')
    ap.add_argument('--libs-dir', default=None, help='Explicit Forge 47.4.10 libraries folder for building longhaul-runtime')
    ap.add_argument('--install-forge', action='store_true', help='Install Forge 47.4.10 server libraries into server-test/ if missing')
    ap.add_argument('--skip-mods', action='store_true', help='Skip Modrinth resolution/download and reuse existing local-lock.json')
    ap.add_argument('--skip-tests', action='store_true', help='Skip JS model tests')
    ap.add_argument('--no-package', action='store_true', help='Skip building .mrpack and Sources zip')
    ap.add_argument('--include-optional-mods', action='store_true', help='Bundle local JARs from optional-mods/ into .mrpack')
    ap.add_argument('--smoke', choices=['none', 'void', 'normal', 'both'], default='none', help='Optional local Forge headless smoke test')
    args = ap.parse_args()

    instance_dir = None
    if args.instance:
        instance_dir = pathlib.Path(args.instance).expanduser().resolve()
        LAST_INSTANCE_FILE.parent.mkdir(parents=True, exist_ok=True)
        LAST_INSTANCE_FILE.write_text(str(instance_dir), encoding='utf-8')
    elif LAST_INSTANCE_FILE.exists():
        saved = LAST_INSTANCE_FILE.read_text(encoding='utf-8').strip()
        if saved and pathlib.Path(saved).exists():
            instance_dir = pathlib.Path(saved)

    if not args.skip_tests:
        node = shutil.which('node')
        if node:
            run_step([node, str(R / 'tools/test_contracts.js')])
        else:
            print('! Node.js not found in PATH; skipping pure-JS test_contracts.js', flush=True)

    run_step([sys.executable, str(R / 'tools/generate_structures.py')])
    run_step([sys.executable, str(R / 'tools/generate_worldgen.py')])
    run_step([sys.executable, str(R / 'tools/generate_alpha_quests.py')])

    profile_path = pathlib.Path(args.profile).resolve()
    if not args.skip_mods or not LOCAL_LOCK.exists():
        cmd = [
            sys.executable, str(R / 'tools/assemble_alpha.py'),
            '--profile', str(profile_path),
            '--lock-out', str(LOCAL_LOCK),
        ]
        if instance_dir and (instance_dir / 'mods').exists():
            cmd.extend(['--seed-mods-dir', str(instance_dir / 'mods')])
        if instance_dir and (instance_dir / 'resourcepacks').exists():
            cmd.extend(['--seed-rp-dir', str(instance_dir / 'resourcepacks')])
        run_step(cmd)

        sync_meta_path = R / '.cache/sync-meta.json'
        sync_meta = json.loads(sync_meta_path.read_text(encoding='utf-8')) if sync_meta_path.exists() else {}
        sync_meta['profile_sha256'] = hashlib.sha256(profile_path.read_bytes()).hexdigest()
        sync_meta['profile_path'] = str(profile_path)
        sync_meta_path.parent.mkdir(parents=True, exist_ok=True)
        sync_meta_path.write_text(json.dumps(sync_meta, indent=2) + '\n', encoding='utf-8')

    libs_dir = detect_libs_dir(instance_dir, args.libs_dir)
    if not libs_dir and args.install_forge:
        run_step([sys.executable, str(R / 'tools/prepare_server.py'), '--mode', 'void'])
        libs_dir = detect_libs_dir(instance_dir, args.libs_dir)

    rt_jar = None
    if libs_dir:
        RUNTIME_OUT_DIR.mkdir(parents=True, exist_ok=True)
        mods_lookup = (instance_dir / 'mods') if (instance_dir and (instance_dir / 'mods').exists()) else (R / 'assembly/mods')
        run_step([
            sys.executable, str(R / 'tools/build_runtime.py'),
            '--libs-dir', str(libs_dir),
            '--mods-dir', str(mods_lookup),
            '--out-dir', str(RUNTIME_OUT_DIR),
        ])
        built = sorted(RUNTIME_OUT_DIR.glob('longhaul-runtime-*.jar'))
        if built:
            rt_jar = built[-1]
    else:
        fallback = sorted((R / 'overrides/mods').glob('longhaul-runtime-*.jar'))
        rt_jar = fallback[-1] if fallback else None
        print('! Forge libraries not found locally; using fallback runtime JAR. Pass --install-forge or --instance to compile full Xaero runtime.', flush=True)

    inspect_cmd = [sys.executable, str(R / 'tools/inspect_alpha.py'), '--lock-file', str(LOCAL_LOCK)]
    if rt_jar:
        inspect_cmd.extend(['--runtime-jar', str(rt_jar)])
    if args.include_optional_mods:
        inspect_cmd.append('--include-optional-mods')
    run_step(inspect_cmd)

    lock_data = json.loads(LOCAL_LOCK.read_text(encoding='utf-8'))
    version = lock_data.get('version', '2.0-alpha.20')

    if not args.no_package:
        pkg_cmd = [
            sys.executable, str(R / 'tools/package_alpha.py'),
            '--version', str(version),
            '--lock-file', str(LOCAL_LOCK),
        ]
        if rt_jar:
            pkg_cmd.extend(['--runtime-jar', str(rt_jar)])
        if args.include_optional_mods:
            pkg_cmd.append('--include-optional-mods')
        run_step(pkg_cmd)

    if args.sync:
        if not instance_dir:
            raise SystemExit('--sync requires --instance "<path-to-minecraft-instance>" (or a saved instance from a prior run)')
        run_step([
            sys.executable, str(R / 'tools/sync_instance.py'),
            '--instance', str(instance_dir),
            '--no-regen',
        ])

    if args.smoke != 'none':
        if not (R / 'server-test/libraries').exists():
            run_step([sys.executable, str(R / 'tools/prepare_server.py'), '--mode', 'void'])
        if args.smoke in ('void', 'both'):
            run_step([sys.executable, str(R / 'tools/prepare_server.py'), '--mode', 'void', '--skip-forge-install'])
            run_step([sys.executable, str(R / 'tools/smoke_server.py'), '--heap', '6144', '--timeout', '600'])
        if args.smoke in ('normal', 'both'):
            run_step([sys.executable, str(R / 'tools/prepare_server.py'), '--mode', 'normal', '--skip-forge-install'])
            run_step([sys.executable, str(R / 'tools/smoke_server.py'), '--heap', '7168', '--timeout', '1500'])

    print('\n=== Local Build Complete ===')
    print('Lock:', LOCAL_LOCK)
    if not args.no_package:
        print('MRPack:', REPO_ROOT / f'Long-Haul-Legacy-{version}.mrpack')


if __name__ == '__main__':
    main()
