#!/usr/bin/env python3
"""Incremental delta-updater for Long Haul Legacy 2.0 (mobile-internet friendly).

Updates an existing Minecraft client or dedicated server folder in place:
- Runs `git pull --ff-only` (optional via --pull)
- Regenerates Heracles quests, NBT structures, and worldgen JSONs locally (~1-2s, 0 network)
- Reuses all existing JARs already inside <instance>/mods/ and assembly/mods/
- Downloads ONLY new or changed Modrinth JARs when profiles/alpha20.json changes
- Copies ONLY modified/new files from overrides/ (by SHA-256)
- Removes ONLY obsolete Long-Haul-managed files (never touches saves, options.txt, xaero, or CurseForge addons)
- Rebuilds longhaul-runtime-*.jar only if runtime-mod/src/ changed
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
SYNC_META = R / '.cache/sync-meta.json'
LAST_INSTANCE_FILE = R / '.cache/last_instance.txt'
RUNTIME_OUT_DIR = R / '.cache/runtime-out'

# Mods explicitly replaced in newer alpha updates (matched by exact filename prefix, never substring)
REPLACED_MOD_PREFIXES = (
    'noisium-',
    'walkietalkie-',  # old Modrinth mod; NOT walkietalkies- (CurseForge Realistic Walkie-Talkie)
    'polymorph-forge-0.49.11',  # requires beta JEI >= 15.57.0.207; replaced by 0.49.10 for JEI 15.56.0.205
)


def sha256_file(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def sha512_file(path: pathlib.Path) -> str:
    h = hashlib.sha512()
    with path.open('rb') as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def hash_tree(root: pathlib.Path) -> str:
    h = hashlib.sha256()
    if not root.exists():
        return ''
    for p in sorted(root.rglob('*')):
        if p.is_file() and '__pycache__' not in p.parts:
            h.update(p.relative_to(root).as_posix().encode('utf-8'))
            h.update(sha256_file(p).encode('ascii'))
    return h.hexdigest()


def run_step(cmd, cwd=REPO_ROOT):
    print('>', ' '.join(str(c) for c in cmd), flush=True)
    subprocess.run([str(c) for c in cmd], cwd=str(cwd), check=True)


def try_git_pull():
    st = subprocess.run(['git', 'status', '--porcelain'], cwd=str(REPO_ROOT), capture_output=True, text=True)
    if st.returncode != 0:
        print('! git status failed; skipping git pull.', flush=True)
        return
    if st.stdout.strip():
        print('! Working tree has local edits; skipping automatic `git pull` to protect your changes.', flush=True)
        print('  Run `git pull` manually or pass `--no-pull` when testing local quest/script edits.', flush=True)
        return
    br = subprocess.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], cwd=str(REPO_ROOT), capture_output=True, text=True)
    branch = br.stdout.strip() or 'HEAD'
    print(f'> git pull --ff-only origin {branch}', flush=True)
    subprocess.run(['git', 'pull', '--ff-only', 'origin', branch], cwd=str(REPO_ROOT), check=True)


def detect_libs_dir(instance_dir: pathlib.Path, explicit_libs: str | None) -> pathlib.Path | None:
    candidates = []
    if explicit_libs:
        candidates.append(pathlib.Path(explicit_libs))
    candidates.extend([
        R / 'server-test/libraries',
        instance_dir.parent.parent / 'libraries',  # Standard TLauncher / Vanilla / Prism layout
        instance_dir.parent / 'libraries',
        instance_dir / 'libraries',
    ])
    for cand in candidates:
        if cand.exists() and any(cand.rglob('*-srg.jar')) and any(cand.rglob('mixin-*.jar')):
            return cand
    return None


def resolve_instance_dir(arg_instance: str | None) -> pathlib.Path:
    if arg_instance:
        p = pathlib.Path(arg_instance).expanduser().resolve()
        LAST_INSTANCE_FILE.parent.mkdir(parents=True, exist_ok=True)
        LAST_INSTANCE_FILE.write_text(str(p), encoding='utf-8')
        return p
    if LAST_INSTANCE_FILE.exists():
        saved = LAST_INSTANCE_FILE.read_text(encoding='utf-8').strip()
        if saved:
            return pathlib.Path(saved)
    raise SystemExit(
        'Specify --instance "<path-to-minecraft-instance>" on first run (saved automatically for future runs).\n'
        'Example (Windows): python long-haul-legacy-2/tools/sync_instance.py --instance "D:\\Minecraft\\game\\home\\Long-Haul 1.20.1-forge-47.4.10"'
    )


def main():
    ap = argparse.ArgumentParser(description='Delta-sync Long Haul Legacy 2.0 into an existing Minecraft instance.')
    ap.add_argument('--instance', default=None, help='Path to Minecraft instance folder (e.g. .../Long-Haul 1.20.1-forge-47.4.10)')
    ap.add_argument('--profile', default=str(DEFAULT_PROFILE), help='Profile JSON (default: profiles/alpha20.json)')
    ap.add_argument('--pull', action='store_true', help='Run `git pull --ff-only` before syncing')
    ap.add_argument('--no-regen', action='store_true', help='Skip regenerating quests/structures/worldgen')
    ap.add_argument('--check-mods', action='store_true', help='Force Modrinth lock check even if profile JSON is unchanged')
    ap.add_argument('--skip-mods', action='store_true', help='Skip Modrinth/mod/resourcepack sync and update only runtime + overrides')
    ap.add_argument('--server', action='store_true', help='Server mode: skip client_only mods and resourcepacks')
    ap.add_argument('--libs-dir', default=None, help='Explicit Forge 47.4.10 libraries directory for rebuilding longhaul-runtime')
    ap.add_argument('--force-runtime', action='store_true', help='Force rebuilding longhaul-runtime-*.jar')
    ap.add_argument('--reset-keys', action='store_true', help='Remove old key_* lines from options.txt (with options.txt.bak backup) so DefaultOptions applies keybindings.txt on next launch')
    ap.add_argument('--dry-run', action='store_true', help='Show what would change without modifying instance files')
    args = ap.parse_args()

    instance_dir = resolve_instance_dir(args.instance)
    if not instance_dir.exists():
        raise SystemExit(f'Instance directory does not exist: {instance_dir}')
    profile_path = pathlib.Path(args.profile).resolve()

    if args.pull:
        try_git_pull()

    if not args.no_regen:
        run_step([sys.executable, str(R / 'tools/generate_structures.py')])
        run_step([sys.executable, str(R / 'tools/generate_worldgen.py')])
        run_step([sys.executable, str(R / 'tools/generate_alpha_quests.py')])

    sync_meta = {}
    if SYNC_META.exists():
        try:
            sync_meta = json.loads(SYNC_META.read_text(encoding='utf-8'))
        except Exception:
            sync_meta = {}

    profile_sha = sha256_file(profile_path)
    repo_lock = R / 'assembly/lock.json'
    repo_lock_sha = sha256_file(repo_lock) if repo_lock.exists() else ''

    # Prefer the pre-resolved repository assembly/lock.json whenever it exists and
    # matches the active default profile (or just updated via git pull), so syncing
    # does NOT hammer api.modrinth.com unless --check-mods is passed or profile was locally edited.
    using_default_profile = (profile_path == DEFAULT_PROFILE.resolve())
    repo_lock_changed = bool(repo_lock_sha and sync_meta.get('repo_lock_sha256') != repo_lock_sha)
    if not args.skip_mods and not args.check_mods and repo_lock.exists() and using_default_profile:
        if not LOCAL_LOCK.exists() or repo_lock_changed:
            if not args.dry_run:
                LOCAL_LOCK.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(repo_lock, LOCAL_LOCK)
                sync_meta['profile_sha256'] = profile_sha
                sync_meta['profile_path'] = str(profile_path)
                sync_meta['repo_lock_sha256'] = repo_lock_sha
                SYNC_META.parent.mkdir(parents=True, exist_ok=True)
                SYNC_META.write_text(json.dumps(sync_meta, indent=2) + '\n', encoding='utf-8')
            print('== Using repository assembly/lock.json (0 Modrinth API queries) ==', flush=True)

    need_assemble = (
        not args.skip_mods
        and (
            args.check_mods
            or not (LOCAL_LOCK.exists() or repo_lock.exists())
            or (
                not repo_lock_changed
                and not (using_default_profile and repo_lock.exists())
                and (
                    sync_meta.get('profile_sha256') != profile_sha
                    or sync_meta.get('profile_path') != str(profile_path)
                )
            )
        )
    )

    if args.skip_mods:
        print('== Skipping mod/resourcepack sync (--skip-mods): updating runtime + overrides only ==', flush=True)
    elif need_assemble:
        print('== Resolving & downloading ONLY missing/updated mods ==', flush=True)
        cmd = [
            sys.executable,
            str(R / 'tools/assemble_alpha.py'),
            '--profile', str(profile_path),
            '--lock-out', str(LOCAL_LOCK),
            '--seed-mods-dir', str(instance_dir / 'mods'),
            '--seed-rp-dir', str(instance_dir / 'resourcepacks'),
        ]
        run_step(cmd)
        sync_meta['profile_sha256'] = profile_sha
        sync_meta['profile_path'] = str(profile_path)
        if repo_lock_sha:
            sync_meta['repo_lock_sha256'] = repo_lock_sha
        SYNC_META.parent.mkdir(parents=True, exist_ok=True)
        SYNC_META.write_text(json.dumps(sync_meta, indent=2) + '\n', encoding='utf-8')
    else:
        print('== Mod lock up to date: skipping Modrinth API queries ==', flush=True)

    lock_path = LOCAL_LOCK if LOCAL_LOCK.exists() else repo_lock
    lock = json.loads(lock_path.read_text(encoding='utf-8')) if lock_path.exists() else {}

    state_file = instance_dir / '.longhaul-sync-state.json'
    state = {'managed_mods': [], 'managed_resourcepacks': [], 'managed_overrides': []}
    if state_file.exists():
        try:
            state = json.loads(state_file.read_text(encoding='utf-8'))
        except Exception:
            pass

    mods_dir = instance_dir / 'mods'
    rp_dir = instance_dir / 'resourcepacks'
    if not args.dry_run:
        mods_dir.mkdir(parents=True, exist_ok=True)
        if not args.server:
            rp_dir.mkdir(parents=True, exist_ok=True)

    # 1. Sync mods from lock
    desired_mods = {}
    copied_mods = 0
    copied_mod_bytes = 0
    removed_mods = 0
    if not args.skip_mods:
        for mod in lock.get('mods', []):
            if args.server and mod.get('client_only'):
                continue
            f = mod['selected_file']
            desired_mods[f['filename']] = f

        missing_local_cache = []
        for fname, fmeta in desired_mods.items():
            dst = mods_dir / fname
            expected_sha512 = (fmeta.get('hashes') or {}).get('sha512')
            expected_size = fmeta.get('size')
            up_to_date = False
            if dst.exists():
                if expected_size and dst.stat().st_size == expected_size:
                    if not expected_sha512 or sha512_file(dst) == expected_sha512:
                        up_to_date = True
            if up_to_date:
                continue
            src = R / 'assembly/mods' / fname
            if not src.exists():
                missing_local_cache.append(fname)
                continue
            if not args.dry_run:
                shutil.copy2(src, dst)
            copied_mods += 1
            copied_mod_bytes += src.stat().st_size

        if missing_local_cache:
            print(f'! {len(missing_local_cache)} mod(s) missing from assembly/mods/ cache. Downloading missing via --from-lock...', flush=True)
            if not args.dry_run:
                run_step([
                    sys.executable, str(R / 'tools/assemble_alpha.py'),
                    '--from-lock', '--lock-in', str(lock_path), '--lock-out', str(LOCAL_LOCK),
                    '--seed-mods-dir', str(mods_dir), '--seed-rp-dir', str(rp_dir),
                ])
                for fname in missing_local_cache:
                    src = R / 'assembly/mods' / fname
                    if src.exists():
                        shutil.copy2(src, mods_dir / fname)
                        copied_mods += 1
                        copied_mod_bytes += src.stat().st_size

        prev_managed_mods = set(state.get('managed_mods', []))
        for existing in sorted(mods_dir.glob('*.jar')):
            name = existing.name
            if name in desired_mods or name.startswith('longhaul-runtime-'):
                continue
            is_obsolete_managed = name in prev_managed_mods
            is_replaced = any(name.startswith(pref) for pref in REPLACED_MOD_PREFIXES)
            if is_obsolete_managed or is_replaced:
                print(f'  - Removing obsolete mod: {name}', flush=True)
                if not args.dry_run:
                    existing.unlink()
                removed_mods += 1
    else:
        for old_m in state.get('managed_mods', []):
            desired_mods[old_m] = {}

    # 2. Sync resourcepacks (client only)
    copied_rps = 0
    desired_rps = set()
    if not args.server and not args.skip_mods:
        for rp in lock.get('resourcepacks', []):
            fname = rp['selected_file']['filename']
            desired_rps.add(fname)
            dst = rp_dir / fname
            expected_sha512 = (rp['selected_file'].get('hashes') or {}).get('sha512')
            expected_size = rp['selected_file'].get('size')
            if dst.exists() and (not expected_size or dst.stat().st_size == expected_size):
                if not expected_sha512 or sha512_file(dst) == expected_sha512:
                    continue
            src = R / 'assembly/resourcepacks' / fname
            if src.exists():
                if not args.dry_run:
                    shutil.copy2(src, dst)
                copied_rps += 1
    elif args.skip_mods:
        desired_rps = set(state.get('managed_resourcepacks', []))

    # 3. Build/sync longhaul-runtime-*.jar incrementally
    rt_src_hash = hash_tree(R / 'runtime-mod/src')
    existing_rt = sorted(mods_dir.glob('longhaul-runtime-*.jar'))
    cached_rt = sorted(RUNTIME_OUT_DIR.glob('longhaul-runtime-*.jar')) if RUNTIME_OUT_DIR.exists() else []
    need_rt_build = (
        args.force_runtime
        or sync_meta.get('runtime_src_hash') != rt_src_hash
        or not cached_rt
    )
    rt_jar_to_install = cached_rt[-1] if cached_rt else None
    if need_rt_build and not args.dry_run:
        libs_dir = detect_libs_dir(instance_dir, args.libs_dir)
        if libs_dir:
            print(f'== Building longhaul-runtime using Forge libraries: {libs_dir} ==', flush=True)
            RUNTIME_OUT_DIR.mkdir(parents=True, exist_ok=True)
            run_step([
                sys.executable, str(R / 'tools/build_runtime.py'),
                '--libs-dir', str(libs_dir),
                '--mods-dir', str(mods_dir),
                '--out-dir', str(RUNTIME_OUT_DIR),
            ])
            cached_rt = sorted(RUNTIME_OUT_DIR.glob('longhaul-runtime-*.jar'))
            if cached_rt:
                rt_jar_to_install = cached_rt[-1]
                sync_meta['runtime_src_hash'] = rt_src_hash
                SYNC_META.parent.mkdir(parents=True, exist_ok=True)
                SYNC_META.write_text(json.dumps(sync_meta, indent=2) + '\n', encoding='utf-8')
        else:
            print('! Forge libraries not found locally; falling back to repository overrides/mods/longhaul-runtime-*.jar', flush=True)

    if rt_jar_to_install is None:
        fallback_rt = sorted((R / 'overrides/mods').glob('longhaul-runtime-*.jar'))
        if fallback_rt:
            rt_jar_to_install = fallback_rt[-1]

    copied_rt = False
    if rt_jar_to_install and rt_jar_to_install.exists():
        dst_rt = mods_dir / rt_jar_to_install.name
        if not dst_rt.exists() or sha256_file(dst_rt) != sha256_file(rt_jar_to_install):
            if not args.dry_run:
                for old_rt in existing_rt:
                    if old_rt.name != rt_jar_to_install.name:
                        old_rt.unlink()
                shutil.copy2(rt_jar_to_install, dst_rt)
            copied_rt = True

    # 4. Delta-sync overrides/ (configs, kubejs, heracles quests, defaultconfigs, etc.)
    SEED_IF_MISSING_OVERRIDES = {
        'config/xaerominimap.txt',
        'config/xaeroworldmap.txt',
    }
    overrides_root = R / 'overrides'
    desired_overrides = set()
    copied_overrides = 0
    copied_override_bytes = 0
    for src in sorted(overrides_root.rglob('*')):
        if not src.is_file():
            continue
        rel = src.relative_to(overrides_root).as_posix()
        if rel.startswith('mods/longhaul-runtime-') or '99_integration' in src.name or src.suffix in {'.log', '.dat'}:
            continue
        desired_overrides.add(rel)
        dst = instance_dir / rel
        if rel in SEED_IF_MISSING_OVERRIDES and dst.exists():
            continue
        if dst.exists() and dst.stat().st_size == src.stat().st_size and sha256_file(dst) == sha256_file(src):
            continue
        if not args.dry_run:
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
        copied_overrides += 1
        copied_override_bytes += src.stat().st_size

    removed_overrides = 0
    for old_rel in sorted(set(state.get('managed_overrides', [])) - desired_overrides):
        old_dst = instance_dir / old_rel
        if old_dst.exists() and old_dst.is_file():
            if not args.dry_run:
                old_dst.unlink()
            removed_overrides += 1

    # Sync ReactiveMusic default songpack config if missing (never overwrite user choice)
    rm_cfg = instance_dir / 'config/ReactiveMusic.json5'
    if not args.server and not rm_cfg.exists():
        songpack = next((rp.get('songpack_name') for rp in lock.get('resourcepacks', []) if rp.get('songpack_name')), None)
        if songpack and not args.dry_run:
            rm_cfg.parent.mkdir(parents=True, exist_ok=True)
            rm_cfg.write_text(json.dumps({'loadedUserSongpack': songpack}, indent=2) + '\n', encoding='utf-8')

    # Optional: reset key_* entries in options.txt so DefaultOptions reapplies keybindings.txt
    reset_keys_count = 0
    options_txt = instance_dir / 'options.txt'
    if args.reset_keys and not args.server and options_txt.exists():
        orig_lines = options_txt.read_text(encoding='utf-8', errors='replace').splitlines(keepends=True)
        kept_lines = [ln for ln in orig_lines if not ln.startswith('key_')]
        reset_keys_count = len(orig_lines) - len(kept_lines)
        if reset_keys_count > 0 and not args.dry_run:
            shutil.copy2(options_txt, instance_dir / 'options.txt.bak')
            options_txt.write_text(''.join(kept_lines), encoding='utf-8')

    if not args.dry_run:
        state_file.write_text(json.dumps({
            'version': lock.get('version'),
            'managed_mods': sorted(desired_mods.keys()),
            'managed_resourcepacks': sorted(desired_rps),
            'managed_overrides': sorted(desired_overrides),
        }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    # Check CurseForge optional addons
    cf_path = R / 'optional-mods/curseforge-addons.json'
    if cf_path.exists() and not args.server:
        try:
            cf = json.loads(cf_path.read_text(encoding='utf-8'))
            present_names = [p.name.lower() for p in mods_dir.glob('*.jar')]
            for addon in cf.get('addons', []):
                mod_id = (addon.get('mod_id') or '').lower()
                name = addon.get('name') or addon.get('title') or mod_id or 'Addon'
                if mod_id and not any(mod_id in n for n in present_names):
                    print(f"! CurseForge addon not found in mods/: {name} -> {addon['url']}", flush=True)
        except Exception:
            pass

    mb_mods = copied_mod_bytes / (1024 * 1024)
    kb_ovr = copied_override_bytes / 1024
    print('\n=== Delta Sync Complete ===')
    print(f'Instance:          {instance_dir}')
    print(f'Mods updated:      {copied_mods} ({mb_mods:.2f} MB), removed obsolete: {removed_mods}')
    print(f'Resourcepacks:     {copied_rps} updated')
    print(f'Runtime JAR:       {"updated" if copied_rt else "up to date"}')
    print(f'Overrides updated: {copied_overrides} ({kb_ovr:.1f} KB), removed obsolete: {removed_overrides}')
    if args.reset_keys:
        print(f'Keys reset:        {reset_keys_count} key_* entries cleared from options.txt (backup: options.txt.bak)')
    if args.dry_run:
        print('(DRY RUN: no files were modified)')


if __name__ == '__main__':
    main()
