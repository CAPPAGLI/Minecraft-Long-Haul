#!/usr/bin/env python3
"""Assemble a version-pinned Long Haul Legacy 2.0 pack from profiles or lock.json.
API pins are not blindly treated as version constraints; actual Forge jar dependencies
are inspected separately via inspect_alpha.py and server smoke tests.
"""
import argparse, concurrent.futures, hashlib, io, json, pathlib, re, shutil, subprocess, time, tomllib, urllib.request, zipfile
from audit_mods import get
from inspect_alpha import fits

def fetch_url_bytes(url: str, timeout: int = 300) -> bytes:
    last_err = None
    for attempt in range(1, 5):
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'LongHaulLegacy/2.0 assembler',
                'Connection': 'close',
            })
            with urllib.request.urlopen(req, timeout=timeout) as res:
                return res.read()
        except Exception as exc:
            last_err = exc
            time.sleep(1.5 * attempt)
    curl_bin = shutil.which('curl') or shutil.which('curl.exe')
    if curl_bin:
        res = subprocess.run([
            curl_bin, '-sSL', '--fail', '--retry', '2',
            '--connect-timeout', '15', '--max-time', str(timeout),
            '-A', 'LongHaulLegacy/2.0 assembler', url,
        ], capture_output=True)
        if res.returncode == 0 and res.stdout:
            return res.stdout
    raise last_err

R = pathlib.Path(__file__).resolve().parents[1]
DIR = R / 'assembly/mods'
DIR.mkdir(parents=True, exist_ok=True)
RP_DIR = R / 'assembly/resourcepacks'
RP_DIR.mkdir(parents=True, exist_ok=True)

BASE_ROOTS = '''create create-steam-n-rails createaddition create-enchantment-industry
create-connected create-deco slice-and-dice create-central-kitchen valkyrien-skies
create-clockwork eureka trackwork cc-tweaked advancedperipherals exposure
simple-voice-chat zume odyssey-quests kubejs lootjs almostunified
create-diesel-generators create-ore-excavation create-new-age
create-railways-navigator create-power-loader copycats
bellsandwhistles interiors farmers-delight brewin-and-chewin
comforts immersive-aircraft man-of-many-planes small-ships storagedrawers
tectonic terralith lithostitched towns-and-towers yungs-bridges
jei emi jade jade-addons-forge appleskin mouse-tweaks controlling
ferrite-core modernfix spark xaeros-minimap xaeros-world-map'''.split()

BASE_CLIENT = set('zume jei emi jade jade-addons-forge appleskin mouse-tweaks controlling configured catalogue xaeros-minimap xaeros-world-map'.split())

def supports_forge_47410(cand):
    jf = next((f for f in cand['files'] if f['filename'].endswith('.jar') and f.get('primary')), next(f for f in cand['files'] if f['filename'].endswith('.jar')))
    cached = DIR / jf['filename']
    if cached.exists():
        zdata = cached.read_bytes()
    else:
        zdata = fetch_url_bytes(jf['url'], timeout=60)
    with zipfile.ZipFile(io.BytesIO(zdata)) as zf:
        if 'META-INF/mods.toml' in zf.namelist():
            mt = tomllib.loads(zf.read('META-INF/mods.toml').decode(errors='replace'))
            deps = [d for dl in mt.get('dependencies', {}).values() for d in dl if d.get('modId') == 'forge']
            return all(fits('47.4.10', d.get('versionRange', '')) is not False for d in deps)
    return True

def resolve_profile(profile_path: pathlib.Path):
    profile = json.loads(profile_path.read_text(encoding='utf-8'))
    cutoff = profile.get('cutoff_date', '2026-11-30T23:59:59Z')
    roots = list(BASE_ROOTS) + list(dict.fromkeys(s for group in profile['categories'].values() for s in group))
    client = set(BASE_CLIENT) | set(profile.get('client_only', []))
    rows = json.loads((R / 'audit/candidates.json').read_text(encoding='utf-8'))
    dg_projects = json.loads((R / 'audit/dependency-graph.json').read_text(encoding='utf-8')).get('projects', [])
    by_slug = {r['slug']: r for r in rows}
    by_pid = {r['project_id']: r for r in dg_projects}
    known = {}
    work = [(s, 'profile') for s in roots]
    while work:
        slug, parent = work.pop(0)
        row = by_slug.get(slug) or by_pid.get(slug)
        v = None
        if row and row.get('status') == 'candidate':
            cand_row = {'project_id': row['project_id'], 'id': row['version_id'], 'version_number': row['version'], 'dependencies': row['dependencies'], 'files': row['files']}
            if slug in ('create-clockwork', 'polymorph', 'ends-delight', 'subtle-effects') or supports_forge_47410(cand_row):
                v = cand_row
        if v is None:
            vs = get('project/' + slug + '/version?loaders=%5B%22forge%22%5D&game_versions=%5B%221.20.1%22%5D') or []
            vs = [v for v in vs if v['date_published'] <= cutoff and any(f['filename'].endswith('.jar') for f in v['files'])]
            if not vs:
                raise RuntimeError(f'No supported version for {slug} (required by {parent})')
            stable = [v for v in vs if v['version_type'] == 'release']
            cands = stable or vs
            if slug == 'hex-casting':
                # Hex Casting 0.11.4 requires inline >= 1.20.1-1.2.2 (CurseForge-only), whereas Modrinth latest is 1.20.1-1.2.0-forge.
                # Prefer 0.11.3 (requires inline >= 1.0.1) unless Modrinth actually serves inline >= 1.2.2 for Forge 1.20.1.
                inl_vs = get('project/inline/version?loaders=%5B%22forge%22%5D&game_versions=%5B%221.20.1%22%5D') or []
                has_inl_122 = any('1.2.2' in iv.get('version_number', '') for iv in inl_vs if iv.get('date_published', '') <= cutoff)
                if not has_inl_122:
                    safe_hex = [cand for cand in cands if '0.11.3' in cand.get('version_number', '')]
                    if safe_hex:
                        cands = safe_hex
            if slug not in ('create-clockwork', 'polymorph', 'ends-delight', 'subtle-effects'):
                picked = None
                for cand in cands[:24]:
                    if supports_forge_47410(cand):
                        picked = cand
                        break
                if not picked:
                    raise RuntimeError('No version compatible with Forge 47.4.10 for ' + slug)
                v = picked
            else:
                v = cands[0]
        if slug == 'create-clockwork':
            # 0.5.7 removed bundled Kelvin without exposing an obtainable API dependency.
            # 0.5.6 contains Kelvin 0.5.0 as a proper Forge JarJar dependency.
            v = json.loads((R / 'audit/clockwork-0.5.6.json').read_text(encoding='utf-8'))
        if slug == 'polymorph':
            # 0.49.11 requires beta JEI >= 15.57.0.207; 0.49.10 matches release JEI 15.56.0.205.
            v = json.loads((R / 'audit/polymorph-0.49.10.json').read_text(encoding='utf-8'))
        if slug == 'ends-delight':
            # create_central_kitchen and delightful require ends_delight >= 2.6.1 (tagged beta on Modrinth).
            v = json.loads((R / 'audit/ends-delight-2.6.1.json').read_text(encoding='utf-8'))
        if slug == 'subtle-effects':
            # 1.14.0+ uses net.minecraft.world.entity.Entity$FluidCalcs (added in Forge 47.4.14;
            # 1.14.0 omitted the bump in mods.toml and crashes on Forge 47.4.10).
            # Pin 1.13.2, which uses MutableTriple interimCalcs and works cleanly on Forge 47.4.10.
            v = json.loads((R / 'audit/subtle-effects-1.13.2.json').read_text(encoding='utf-8'))
        pid = v['project_id']
        if pid in known:
            continue
        meta = get('project/' + pid)
        known[pid] = {
            'slug': meta['slug'],
            'title': meta['title'],
            'project_id': pid,
            'version_id': v['id'],
            'version': v['version_number'],
            'dependencies': v['dependencies'],
            'files': v['files'],
            'client_only': meta['server_side'] == 'unsupported' or meta['slug'] in client,
        }
        for d in v['dependencies']:
            if d['dependency_type'] != 'required':
                continue
            dep = d.get('project_id')
            pin = d.get('version_id')
            if not dep and pin:
                dv = get('version/' + pin)
                dep = dv['project_id']
            if dep and dep not in known:
                work.append((dep, meta['slug']))
    for ext in profile.get('external_mods', []):
        slug = ext['slug']
        pid = 'ext:' + slug
        if pid in known:
            continue
        f_entry = {
            'filename': ext['filename'],
            'url': ext['url'],
            'primary': True,
            'size': ext.get('size', 0),
            'hashes': ext.get('hashes', {}),
        }
        known[pid] = {
            'slug': slug,
            'title': ext['title'],
            'project_id': pid,
            'version_id': ext['version'],
            'version': ext['version'],
            'source': ext.get('source', 'github'),
            'homepage': ext.get('homepage', ''),
            'license': ext.get('license', ''),
            'dependencies': [],
            'files': [f_entry],
            'client_only': bool(ext.get('client_only', False)) or slug in client,
        }
    return profile.get('version', '2.0-alpha.2'), roots, list(known.values())

def select_file(row):
    files = [f for f in row['files'] if f['filename'].endswith('.jar')]
    return row.get('selected_file') or next((f for f in files if f.get('primary')), files[0])

def select_rp_file(row):
    files = [f for f in row['files'] if f['filename'].endswith('.zip')]
    return row.get('selected_file') or next((f for f in files if f.get('primary')), files[0])

def resolve_resourcepacks(profile_path: pathlib.Path):
    profile = json.loads(profile_path.read_text(encoding='utf-8'))
    cutoff = profile.get('cutoff_date', '2026-11-30T23:59:59Z')
    out = []
    for rp_slug in profile.get('resourcepacks', []):
        meta = get('project/' + rp_slug)
        vs = get('project/' + rp_slug + '/version?game_versions=%5B%221.20.1%22%5D') or get('project/' + rp_slug + '/version') or []
        vs = [v for v in vs if v.get('date_published', '') <= cutoff and any(f['filename'].endswith('.zip') for f in v.get('files', []))]
        if not vs:
            raise RuntimeError(f'No supported resourcepack version for {rp_slug}')
        stable = [v for v in vs if v.get('version_type') == 'release']
        v = (stable or vs)[0]
        out.append({
            'slug': meta['slug'],
            'title': meta['title'],
            'project_id': meta['id'],
            'version_id': v['id'],
            'version': v['version_number'],
            'files': v['files'],
        })
    return out

def download_resourcepack(row):
    f = select_rp_file(row)
    p = RP_DIR / f['filename']
    if not p.exists():
        p.write_bytes(fetch_url_bytes(f['url'], timeout=300))
    b = p.read_bytes()
    actual_sha512 = hashlib.sha512(b).hexdigest()
    actual_sha1 = hashlib.sha1(b).hexdigest()
    if f.get('hashes', {}).get('sha512'):
        assert actual_sha512 == f['hashes']['sha512'], p
    if f.get('hashes', {}).get('sha1'):
        assert actual_sha1 == f['hashes']['sha1'], p
    if f.get('size'):
        assert len(b) == f['size'], p
    f['hashes'] = {'sha512': actual_sha512, 'sha1': actual_sha1}
    f['size'] = len(b)
    row['selected_file'] = f
    try:
        with zipfile.ZipFile(io.BytesIO(b)) as zf:
            rm_yml = next((n for n in zf.namelist() if n.endswith('ReactiveMusic.yaml')), None)
            if rm_yml:
                raw_yml = zf.read(rm_yml).decode('utf-8', errors='replace')
                m = re.search(r'(?m)^\s*name:\s*["\']?([^"\'\r\n]+)["\']?\s*$', raw_yml)
                if m:
                    row['songpack_name'] = m.group(1).strip()
    except Exception:
        pass
    print('RP', row['slug'], row['version'], row.get('songpack_name', ''), flush=True)
    return row

def download_one(row):
    f = select_file(row)
    p = DIR / f['filename']
    if not p.exists():
        p.write_bytes(fetch_url_bytes(f['url'], timeout=300))
    b = p.read_bytes()
    actual_sha512 = hashlib.sha512(b).hexdigest()
    actual_sha1 = hashlib.sha1(b).hexdigest()
    if f.get('hashes', {}).get('sha512'):
        assert actual_sha512 == f['hashes']['sha512'], p
    if f.get('hashes', {}).get('sha1'):
        assert actual_sha1 == f['hashes']['sha1'], p
    if f.get('size'):
        assert len(b) == f['size'], p
    f['hashes'] = {'sha512': actual_sha512, 'sha1': actual_sha1}
    f['size'] = len(b)
    if row.get('source') in ('github', 'external'):
        assert supports_forge_47410({'files': [f]}), f'Incompatible Forge 47.4.10 range in {p}'
    row['selected_file'] = f
    print(row['slug'], row['version'], flush=True)
    return row

def seed_from_dir(seed_dir: pathlib.Path, target_dir: pathlib.Path, ext: str):
    if not seed_dir or not seed_dir.exists():
        return 0
    import shutil
    copied = 0
    for src in seed_dir.glob('*' + ext):
        if not src.is_file():
            continue
        dst = target_dir / src.name
        if not dst.exists() or dst.stat().st_size != src.stat().st_size:
            shutil.copy2(src, dst)
            copied += 1
    return copied

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--from-lock', action='store_true', help='Download and verify directly from assembly/lock.json')
    ap.add_argument('--lock-only', action='store_true', help='Resolve profile into assembly/lock.json without downloading JARs')
    ap.add_argument('--profile', default=str(R / 'profiles/alpha2.json'))
    ap.add_argument('--lock-out', default=str(R / 'assembly/lock.json'), help='Path to write resolved lock JSON')
    ap.add_argument('--lock-in', default=str(R / 'assembly/lock.json'), help='Path to read lock JSON when --from-lock is used')
    ap.add_argument('--seed-mods-dir', default=None, help='Existing mods dir (e.g. Minecraft instance/mods) to reuse JARs without re-downloading')
    ap.add_argument('--seed-rp-dir', default=None, help='Existing resourcepacks dir to reuse ZIPs without re-downloading')
    args = ap.parse_args()

    if args.seed_mods_dir:
        c_mods = seed_from_dir(pathlib.Path(args.seed_mods_dir), DIR, '.jar')
        if c_mods:
            print(f'Seeded {c_mods} cached mod JAR(s) from {args.seed_mods_dir}', flush=True)
    if args.seed_rp_dir:
        c_rps = seed_from_dir(pathlib.Path(args.seed_rp_dir), RP_DIR, '.zip')
        if c_rps:
            print(f'Seeded {c_rps} cached resourcepack(s) from {args.seed_rp_dir}', flush=True)

    if args.from_lock:
        lock = json.loads(pathlib.Path(args.lock_in).read_text(encoding='utf-8'))
        version = lock.get('version', '2.0-alpha.2')
        roots = lock.get('roots', [])
        mods = lock['mods']
        rps = lock.get('resourcepacks', [])
        status = lock.get('status', 'ASSEMBLED_NOT_RUNTIME_TESTED')
    else:
        version, roots, mods = resolve_profile(pathlib.Path(args.profile))
        rps = resolve_resourcepacks(pathlib.Path(args.profile))
        status = 'ASSEMBLED_NOT_RUNTIME_TESTED'

    if args.lock_only:
        out = []
        for row in mods:
            row['selected_file'] = select_file(row)
            out.append(row)
        rp_out = []
        for row in rps:
            row['selected_file'] = select_rp_file(row)
            rp_out.append(row)
    else:
        out = list(concurrent.futures.ThreadPoolExecutor(max_workers=3).map(download_one, mods))
        rp_out = list(concurrent.futures.ThreadPoolExecutor(max_workers=2).map(download_resourcepack, rps))
    lock_out_path = pathlib.Path(args.lock_out)
    lock_out_path.parent.mkdir(parents=True, exist_ok=True)
    lock_out_path.write_text(json.dumps({
        'version': version,
        'status': status,
        'minecraft': '1.20.1',
        'forge': '47.4.10',
        'roots': roots,
        'mods': out,
        'resourcepacks': rp_out,
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if args.lock_only:
        print('RESOLVED', len(out), 'mods and', len(rp_out), f'resourcepacks into {lock_out_path} (no downloads).')
    else:
        print('DOWNLOADED', len(out), 'verified SHA512 files and', len(rp_out), 'resourcepacks; not yet a compatibility claim.')

if __name__ == '__main__':
    main()
