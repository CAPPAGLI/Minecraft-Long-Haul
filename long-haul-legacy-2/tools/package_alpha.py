#!/usr/bin/env python3
"""Package only lock-selected downloads and intentional overrides; never glob assembly/mods.
No third-party mod JARs, runtimes, worlds, or server credentials are redistributed.
"""
import argparse, hashlib, json, pathlib, zipfile

R = pathlib.Path(__file__).resolve().parents[1]
FORBIDDEN = {
    'extendedgears', 'create-track-map', 'servercore', 'fastload',
    'ad-astra', 'natural-temperature', 'cold-sweat', 'waystones', 'tempad',
}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--version', default=None, help='Override pack version (defaults to lock.json version or 2.0-alpha.2)')
    ap.add_argument('--skip-jar-bytes-check', action='store_true', help='Trust hashes in lock.json when assembly/mods is absent locally')
    ap.add_argument('--include-optional-mods', action='store_true', help='Bundle local JARs from optional-mods/ into overrides/mods/ inside .mrpack')
    args = ap.parse_args()

    lock = json.loads((R / 'assembly/lock.json').read_text(encoding='utf-8'))
    version = args.version or lock.get('version', '2.0-alpha.2')
    mods = lock['mods']
    bad = FORBIDDEN.intersection(m['slug'] for m in mods)
    assert not bad, f'Forbidden mods in lock: {sorted(bad)}'

    files = []
    paths = set()
    bundled_external_jars = []
    for mod in mods:
        f = mod['selected_file']
        p = R / 'assembly/mods' / f['filename']
        if not args.skip_jar_bytes_check:
            b = p.read_bytes()
            assert hashlib.sha512(b).hexdigest() == f['hashes']['sha512'], p
            assert hashlib.sha1(b).hexdigest() == f['hashes']['sha1'], p
            assert len(b) == f['size'], p
        path = 'mods/' + f['filename']
        assert path not in paths
        paths.add(path)
        if f['url'].startswith('https://cdn.modrinth.com/'):
            files.append({
                'path': path,
                'hashes': {k: f['hashes'][k] for k in ['sha1', 'sha512']},
                'env': {'client': 'required', 'server': 'unsupported' if mod['client_only'] else 'required'},
                'downloads': [f['url']],
                'fileSize': f['size'],
            })
        else:
            assert mod.get('source') in ('github', 'external'), f['url']
            bundled_external_jars.append((p, f'overrides/mods/{f["filename"]}'))

    quest_files = sorted((R / 'overrides/config/heracles/quests').glob('*.json'))
    local_jars = sorted((R / 'overrides/mods').glob('*.jar'))
    assert any(j.name.startswith('longhaul-runtime-') for j in local_jars), f'Missing longhaul-runtime-*.jar in {local_jars}'
    optional_jars = []
    if args.include_optional_mods and (R / 'optional-mods').exists():
        existing_names = {j.name for j in local_jars}
        optional_jars = [j for j in sorted((R / 'optional-mods').glob('*.jar')) if j.name not in existing_names]
    total_local_jars = len(local_jars) + len(optional_jars) + len(bundled_external_jars)

    manifest = {
        'formatVersion': 1,
        'game': 'minecraft',
        'versionId': version,
        'name': f'Long Haul Legacy {version}',
        'summary': f'Industrial logistics prototype ({len(files)} external JARs + {total_local_jars} local JAR(s), {len(quest_files)} quests). New test world only.',
        'files': files,
        'dependencies': {'minecraft': '1.20.1', 'forge': '47.4.10'},
    }
    (R / 'assembly/modrinth.index.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    mrpack = R.parent / f'Long-Haul-Legacy-{version}.mrpack'
    with zipfile.ZipFile(mrpack, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('modrinth.index.json', json.dumps(manifest, ensure_ascii=False, indent=2))
        for p in sorted((R / 'overrides').rglob('*')):
            if p.is_file():
                assert '99_integration' not in p.name and p.suffix not in {'.log', '.dat'}, p
                z.write(p, p.relative_to(R))
        for ext_p, arcname in bundled_external_jars:
            if not args.skip_jar_bytes_check or ext_p.exists():
                z.write(ext_p, arcname)
        for opt_jar in optional_jars:
            z.write(opt_jar, f'overrides/mods/{opt_jar.name}')
        for name in ['README.md', 'TEST-REPORT.md', 'DOOMED.md', 'MODLIST.md', 'STATUS.json']:
            z.write(R / name, 'overrides/longhaul-docs/' + name)

    with zipfile.ZipFile(mrpack) as z:
        assert z.testzip() is None
        names = z.namelist()
        assert len([n for n in names if n.startswith('overrides/config/heracles/quests/') and n.endswith('.json')]) == len(quest_files)
        assert len([n for n in names if n.endswith('.jar')]) == total_local_jars
        assert not any(n.endswith('/server.properties') or n == 'server.properties' or 'server-test' in n or 'runtime/zulu' in n for n in names)

    source = R.parent / f'Long-Haul-Legacy-{version}-Sources-and-Report.zip'
    with zipfile.ZipFile(source, 'w', zipfile.ZIP_DEFLATED) as z:
        for name in ['README.md', 'TEST-REPORT.md', 'DOOMED.md', 'MODLIST.md', 'STATUS.json']:
            z.write(R / name, name)
        for directory in ['tools', 'design', 'overrides', 'runtime-mod', 'audit', 'profiles']:
            for p in sorted((R / directory).rglob('*')):
                if p.is_file() and not any(t in p.parts for t in ['__pycache__', 'classes', 'api-cache']) and p.suffix not in {'.pyc', '.jar'}:
                    z.write(p, p.relative_to(R))
        for name in ['lock.json', 'jar-registry.json', 'modrinth.index.json']:
            if (R / 'assembly' / name).exists():
                z.write(R / 'assembly' / name, 'assembly/' + name)
        for name in ['smoke-result.json', 'smoke-console.log']:
            if (R / 'server-test' / name).exists():
                z.write(R / 'server-test' / name, 'test-evidence/' + name)

    summary = {
        'version': version,
        'external_downloads': len(files),
        'external_download_bytes': sum(f['fileSize'] for f in files),
        'local_mods': total_local_jars,
        'installed_quests': len(quest_files),
        'archives': {},
    }
    for p in [mrpack, source]:
        summary['archives'][p.name] = {'bytes': p.stat().st_size, 'sha512': hashlib.sha512(p.read_bytes()).hexdigest()}
    (R / 'assembly/package-validation.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(summary, indent=2))

if __name__ == '__main__':
    main()
