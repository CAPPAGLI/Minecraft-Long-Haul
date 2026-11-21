#!/usr/bin/env python3
"""Inspect actual Forge mods.toml + nested jarjar metadata across all lock-selected JARs.
Checks missing required mod IDs, Maven version ranges (when specified), and forbidden mods.
"""
import argparse, io, json, pathlib, re, sys, tomllib, zipfile

R = pathlib.Path(__file__).resolve().parents[1]
FORBIDDEN = {
    'extendedgears', 'create-track-map', 'servercore', 'fastload',
    'ad-astra', 'natural-temperature', 'cold-sweat', 'waystones', 'tempad',
}

def num(v):
    return tuple(int(x) for x in re.findall(r'\d+', str(v))[:4])

def compare(a, b):
    a = num(a)
    b = num(b)
    n = max(len(a), len(b))
    a += (0,) * (n - len(a))
    b += (0,) * (n - len(b))
    return (a > b) - (a < b)

def fits(v, r):
    if not r or r in ('*', '[0,)'):
        return True
    if not v or v == '${file.jarVersion}':
        return None
    if r[0] not in '[(':
        return None
    if ',' not in r:
        return compare(v, r.strip('[]')) == 0
    if r.count(',') != 1:
        return None
    low, hi = [x.strip() for x in r[1:-1].split(',')]
    ok_low = not low or compare(v, low) > 0 or (r[0] == '[' and compare(v, low) == 0)
    ok_hi = not hi or compare(v, hi) < 0 or (r[-1] == ']' and compare(v, hi) == 0)
    return ok_low and ok_hi

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--include-optional-mods', action='store_true', help='Also inspect JARs in optional-mods/')
    args = ap.parse_args()

    lock = json.loads((R / 'assembly/lock.json').read_text())
    bad_slugs = FORBIDDEN.intersection(m['slug'] for m in lock['mods'])
    if bad_slugs:
        raise RuntimeError('Forbidden mod slugs in lock.json: ' + str(sorted(bad_slugs)))

    registry = {}
    allmods = []

    def inspect(data, source, side):
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            names = z.namelist()
            if 'META-INF/mods.toml' in names:
                m = tomllib.loads(z.read('META-INF/mods.toml').decode(errors='replace'))
                for mod in m.get('mods', []):
                    obj = {
                        'id': mod['modId'],
                        'version': mod.get('version'),
                        'source': source,
                        'client_only': side,
                        'deps': m.get('dependencies', {}).get(mod['modId'], []),
                    }
                    registry.setdefault(mod['modId'], []).append(obj)
                    allmods.append(obj)
            if 'META-INF/jarjar/metadata.json' in names:
                for j in json.loads(z.read('META-INF/jarjar/metadata.json'))['jars']:
                    if j['path'] in names:
                        inspect(z.read(j['path']), source + '!' + j['path'], side)

    for mod in lock['mods']:
        f = mod['selected_file']['filename']
        inspect((R / 'assembly/mods' / f).read_bytes(), f, mod['client_only'])
    local_jars = sorted((R / 'overrides/mods').glob('*.jar'))
    runtime_jars = [j for j in local_jars if j.name.startswith('longhaul-runtime-')]
    if not runtime_jars:
        raise RuntimeError('Missing longhaul-runtime-*.jar in overrides/mods/')
    for jar in local_jars:
        if jar.name.startswith('longhaul-runtime-'):
            with zipfile.ZipFile(jar) as z:
                if 'pack.mcmeta' not in z.namelist():
                    raise RuntimeError(f'Missing pack.mcmeta in local mod JAR: {jar.name}')
                pack_meta = json.loads(z.read('pack.mcmeta').decode('utf-8'))
                if pack_meta.get('pack', {}).get('pack_format') != 15:
                    raise RuntimeError(f'Expected pack_format 15 in {jar.name}, got {pack_meta}')
        inspect(jar.read_bytes(), 'overrides/mods/' + jar.name, False)

    optional_jars = sorted((R / 'optional-mods').glob('*.jar')) if args.include_optional_mods and (R / 'optional-mods').exists() else []
    for jar in optional_jars:
        inspect(jar.read_bytes(), 'optional-mods/' + jar.name, False)

    # Built-in baseline versions for range checking
    baseline = {'minecraft': '1.20.1', 'forge': '47.4.10'}
    missing = []
    range_mismatches = []
    for mod in allmods:
        for d in mod['deps']:
            dep_id = d['modId']
            vr = d.get('versionRange', '')
            is_mand = bool(d.get('mandatory'))
            if dep_id in baseline:
                if fits(baseline[dep_id], vr) is False:
                    range_mismatches.append({'parent': mod['id'], 'dependency': dep_id, 'mandatory': is_mand, 'range': vr, 'actual': baseline[dep_id]})
                continue
            if dep_id not in registry:
                if is_mand:
                    missing.append({'parent': mod['id'], 'dependency': d})
                continue
            versions = [x.get('version') for x in registry[dep_id]]
            if vr and all(fits(v, vr) is False for v in versions):
                range_mismatches.append({'parent': mod['id'], 'dependency': dep_id, 'mandatory': is_mand, 'range': vr, 'actual': versions})

    out = {
        'status': 'JAR_IDS_AND_RANGES_CHECKED',
        'top_level_jars': len(lock['mods']),
        'local_jars': len(local_jars),
        'optional_jars': len(optional_jars),
        'mod_ids_including_embedded': len(registry),
        'registry': registry,
        'missing_required_ids': missing,
        'version_range_mismatches': range_mismatches,
        'note': 'Duplicate embedded libs are left to Forge jar-in-jar selection. Runtime ABI compatibility requires Forge server boot.',
    }
    (R / 'assembly/jar-registry.json').write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n')
    print('Top-level JARs:', len(lock['mods']), 'mod IDs including embedded:', len(registry))
    print('Missing:', len(missing), 'Range mismatches:', len(range_mismatches))
    if missing:
        print('MISSING DETAILS:', json.dumps(missing, indent=2))
    if range_mismatches:
        print('RANGE MISMATCHES:', json.dumps(range_mismatches, indent=2))
    print('Kelvin:', registry.get('kelvin'))
    if missing or range_mismatches:
        sys.exit(1)

if __name__ == '__main__':
    main()
