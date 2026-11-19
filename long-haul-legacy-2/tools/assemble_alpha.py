#!/usr/bin/env python3
"""Assemble a version-pinned Long Haul Legacy 2.0 pack from profiles or lock.json.
API pins are not blindly treated as version constraints; actual Forge jar dependencies
are inspected separately via inspect_alpha.py and server smoke tests.
"""
import argparse, concurrent.futures, hashlib, json, pathlib, urllib.request
from audit_mods import get

R = pathlib.Path(__file__).resolve().parents[1]
DIR = R / 'assembly/mods'
DIR.mkdir(parents=True, exist_ok=True)

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
ferrite-core modernfix spark chunky xaeros-minimap xaeros-world-map'''.split()

BASE_CLIENT = set('zume jei emi jade jade-addons-forge appleskin mouse-tweaks controlling configured catalogue xaeros-minimap xaeros-world-map'.split())

def resolve_profile(profile_path: pathlib.Path):
    profile = json.loads(profile_path.read_text())
    roots = list(BASE_ROOTS) + list(dict.fromkeys(s for group in profile['categories'].values() for s in group))
    client = set(BASE_CLIENT) | set(profile.get('client_only', []))
    rows = json.loads((R / 'audit/candidates.json').read_text())
    dg_projects = json.loads((R / 'audit/dependency-graph.json').read_text()).get('projects', [])
    by_slug = {r['slug']: r for r in rows}
    by_pid = {r['project_id']: r for r in dg_projects}
    known = {}
    work = list(roots)
    while work:
        slug = work.pop(0)
        row = by_slug.get(slug) or by_pid.get(slug)
        if row and row.get('status') == 'candidate':
            v = {'project_id': row['project_id'], 'id': row['version_id'], 'version_number': row['version'], 'dependencies': row['dependencies'], 'files': row['files']}
        else:
            vs = get('project/' + slug + '/version?loaders=%5B%22forge%22%5D&game_versions=%5B%221.20.1%22%5D') or []
            vs = [v for v in vs if v['date_published'] <= '2026-11-15T15:59:59Z' and any(f['filename'].endswith('.jar') for f in v['files'])]
            if not vs:
                raise RuntimeError('No supported version for ' + slug)
            stable = [v for v in vs if v['version_type'] == 'release']
            v = (stable or vs)[0]
        if slug == 'create-clockwork':
            # 0.5.7 removed bundled Kelvin without exposing an obtainable API dependency.
            # 0.5.6 contains Kelvin 0.5.0 as a proper Forge JarJar dependency.
            v = json.loads((R / 'audit/clockwork-0.5.6.json').read_text())
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
                work.append(dep)
    return profile.get('version', '2.0-alpha.2'), roots, list(known.values())

def download_one(row):
    files = [f for f in row['files'] if f['filename'].endswith('.jar')]
    f = row.get('selected_file') or next((f for f in files if f.get('primary')), files[0])
    p = DIR / f['filename']
    if not p.exists():
        req = urllib.request.Request(f['url'], headers={'User-Agent': 'LongHaulLegacy/2.0 assembler'})
        with urllib.request.urlopen(req, timeout=120) as res:
            p.write_bytes(res.read())
    b = p.read_bytes()
    assert hashlib.sha512(b).hexdigest() == f['hashes']['sha512'], p
    assert hashlib.sha1(b).hexdigest() == f['hashes']['sha1'], p
    assert len(b) == f['size'], p
    row['selected_file'] = f
    print(row['slug'], row['version'], flush=True)
    return row

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--from-lock', action='store_true', help='Download and verify directly from assembly/lock.json')
    ap.add_argument('--profile', default=str(R / 'profiles/alpha2.json'))
    args = ap.parse_args()

    if args.from_lock:
        lock = json.loads((R / 'assembly/lock.json').read_text())
        version = lock.get('version', '2.0-alpha.2')
        roots = lock.get('roots', [])
        mods = lock['mods']
        status = lock.get('status', 'ASSEMBLED_NOT_RUNTIME_TESTED')
    else:
        version, roots, mods = resolve_profile(pathlib.Path(args.profile))
        status = 'ASSEMBLED_NOT_RUNTIME_TESTED'

    out = list(concurrent.futures.ThreadPoolExecutor(max_workers=6).map(download_one, mods))
    (R / 'assembly/lock.json').write_text(json.dumps({
        'version': version,
        'status': status,
        'minecraft': '1.20.1',
        'forge': '47.4.10',
        'roots': roots,
        'mods': out,
    }, ensure_ascii=False, indent=2) + '\n')
    print('DOWNLOADED', len(out), 'verified SHA512 files; not yet a compatibility claim.')

if __name__ == '__main__':
    main()
