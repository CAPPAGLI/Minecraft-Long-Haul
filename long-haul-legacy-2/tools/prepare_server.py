#!/usr/bin/env python3
"""Prepare a clean headless Forge 47.4.10 server directory in server-test/
from assembly/lock.json, assembly/mods/, overrides/, and tools/fixtures/.
"""
import argparse, json, os, pathlib, shutil, subprocess, urllib.request

R = pathlib.Path(__file__).resolve().parents[1]
S = R / 'server-test'
FORGE_URL = 'https://maven.minecraftforge.net/net/minecraftforge/forge/1.20.1-47.4.10/forge-1.20.1-47.4.10-installer.jar'

def find_java():
    j = shutil.which('java')
    if j:
        return j
    jh = os.environ.get('JAVA_HOME')
    if jh and (pathlib.Path(jh) / 'bin/java').exists():
        return str(pathlib.Path(jh) / 'bin/java')
    local = list((R / 'runtime').glob('*/bin/java'))
    if local:
        return str(local[0])
    raise RuntimeError('Java 17 not found')

def ensure_forge():
    unix_args = S / 'libraries/net/minecraftforge/forge/1.20.1-47.4.10/unix_args.txt'
    if unix_args.exists():
        return
    S.mkdir(parents=True, exist_ok=True)
    inst = S / 'forge-installer.jar'
    if not inst.exists():
        print('Downloading Forge 47.4.10 installer...', flush=True)
        req = urllib.request.Request(FORGE_URL, headers={'User-Agent': 'LongHaulLegacy/2.0 CI'})
        with urllib.request.urlopen(req, timeout=180) as res:
            inst.write_bytes(res.read())
    java = find_java()
    print('Installing Forge 47.4.10 server...', flush=True)
    subprocess.run([java, '-jar', str(inst), '--installServer'], cwd=S, check=True)
    assert unix_args.exists(), 'Forge installation did not produce unix_args.txt'

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--mode', choices=['void', 'normal'], default='void')
    ap.add_argument('--skip-forge-install', action='store_true')
    ap.add_argument('--include-optional-mods', action='store_true', help='Also copy JARs from optional-mods/ into server-test/mods/')
    args = ap.parse_args()

    if not args.skip_forge_install:
        ensure_forge()

    lock = json.loads((R / 'assembly/lock.json').read_text())
    mods_dir = S / 'mods'
    if mods_dir.exists():
        shutil.rmtree(mods_dir)
    mods_dir.mkdir(parents=True, exist_ok=True)

    server_count = 0
    for mod in lock['mods']:
        if mod.get('client_only'):
            continue
        fname = mod['selected_file']['filename']
        src = R / 'assembly/mods' / fname
        if not src.exists():
            raise FileNotFoundError('Missing assembled mod jar: ' + str(src))
        shutil.copy2(src, mods_dir / fname)
        server_count += 1

    for local_jar in sorted((R / 'overrides/mods').glob('*.jar')):
        shutil.copy2(local_jar, mods_dir / local_jar.name)
        server_count += 1

    if args.include_optional_mods and (R / 'optional-mods').exists():
        for opt_jar in sorted((R / 'optional-mods').glob('*.jar')):
            shutil.copy2(opt_jar, mods_dir / opt_jar.name)
            server_count += 1

    for sub in ['config', 'kubejs', 'defaultconfigs']:
        dst = S / sub
        if dst.exists():
            shutil.rmtree(dst)
        src = R / 'overrides' / sub
        if src.exists():
            shutil.copytree(src, dst)

    (S / 'kubejs/server_scripts').mkdir(parents=True, exist_ok=True)
    # Emit transient Forge quest-item audit list (excluded from overrides/ and .mrpack)
    audit_items = set()
    q_dir = R / 'overrides/config/heracles/quests'
    if q_dir.exists():
        for qf in q_dir.glob('*.json'):
            qd = json.loads(qf.read_text())
            ico = qd.get('display', {}).get('icon', {}).get('item', {}).get('id')
            if ico:
                audit_items.add(ico)
            for t in qd.get('tasks', {}).values():
                if t.get('type') == 'heracles:item' and t.get('item'):
                    audit_items.add(t['item'])
            for rw in qd.get('rewards', {}).values():
                if rw.get('type') == 'heracles:item' and rw.get('item', {}).get('id'):
                    audit_items.add(rw['item']['id'])
                elif rw.get('type') == 'heracles:selectable':
                    for srw in rw.get('rewards', {}).values():
                        if srw.get('type') == 'heracles:item' and srw.get('item', {}).get('id'):
                            audit_items.add(srw['item']['id'])
    (S / 'kubejs/server_scripts/98_quest_item_audit.js').write_text(
        'global.LHQuestItemAuditList = ' + json.dumps(sorted(audit_items), separators=(',', ':')) + ';\n'
    )
    shutil.copy2(R / 'tools/fixtures/99_integration_test.js', S / 'kubejs/server_scripts/99_integration_test.js')
    (S / 'eula.txt').write_text('eula=true\n')

    props = (R / 'tools/fixtures/server.properties').read_text()
    world_name = 'smoke-void' if args.mode == 'void' else 'smoke-normal'
    if args.mode == 'normal':
        props = props.replace('level-name=smoke-void', 'level-name=smoke-normal')
        props = props.replace('level-type=minecraft\\:flat', 'level-type=minecraft\\:normal')
        props = props.replace('generate-structures=false', 'generate-structures=true')
        # Keep empty generator-settings for normal Overworld
        lines = [l for l in props.splitlines() if not l.startswith('generator-settings=')]
        lines.append('generator-settings={}')
        props = '\n'.join(lines) + '\n'
    (S / 'server.properties').write_text(props)

    world_dir = S / world_name
    if world_dir.exists():
        shutil.rmtree(world_dir)
    vs_dir = world_dir / 'serverconfig/valkyrienskies'
    vs_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(R / 'tools/fixtures/vs-core-server.toml', vs_dir / 'vs-core-server.toml')

    print(f'Prepared server-test ({args.mode}) with {server_count} server JARs.')

if __name__ == '__main__':
    main()
