#!/usr/bin/env python3
"""Bounded headless test; no acceptance of stability implied by one startup.
Requires installed Forge and Java 17. Offline server binds loopback only.
"""
import argparse, json, os, pathlib, shutil, signal, subprocess, sys, threading, time

R = pathlib.Path(__file__).resolve().parents[1]
S = R / 'server-test'

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

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--heap', type=int, default=4096)
    ap.add_argument('--timeout', type=int, default=300)
    ap.add_argument('--world-label', default='flat smoke world')
    args = ap.parse_args()

    java = find_java()
    cmd = [
        java,
        f'-Xms512m',
        f'-Xmx{args.heap}m',
        '-XX:MaxMetaspaceSize=1024m',
        '-XX:ReservedCodeCacheSize=192m',
        '@libraries/net/minecraftforge/forge/1.20.1-47.4.10/unix_args.txt',
        'nogui',
    ]
    log = S / 'smoke-console.log'
    ready = False
    timed_out = False
    integration_done = threading.Event()
    events = []
    p = subprocess.Popen(cmd, cwd=S, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)

    def watchdog():
        nonlocal timed_out
        time.sleep(args.timeout)
        if p.poll() is None:
            timed_out = True
            print('WATCHDOG: stop requested', flush=True)
            try:
                p.stdin.write('stop\n')
                p.stdin.flush()
            except Exception:
                pass
            time.sleep(25)
            if p.poll() is None:
                p.send_signal(signal.SIGQUIT)
                time.sleep(2)
                p.kill()

    threading.Thread(target=watchdog, daemon=True).start()
    with log.open('w') as f:
        for line in p.stdout:
            f.write(line)
            f.flush()
            print(line, end='', flush=True)
            if 'LH_INTEGRATION_PASS:' in line or 'LH_INTEGRATION_FAIL:' in line:
                integration_done.set()
            if ('Failed to start the minecraft server' in line
                    or 'Failed to complete lifecycle event' in line
                    or 'Encountered an unexpected exception' in line
                    or 'Preparing crash report' in line):
                def abort_fast():
                    time.sleep(5)
                    if p.poll() is None:
                        p.kill()
                threading.Thread(target=abort_fast, daemon=True).start()
            if 'Done (' in line and 'For help' in line and not ready:
                ready = True
                events.append('server_ready')
                def finish():
                    integration_done.wait(timeout=180)
                    time.sleep(2)
                    if p.poll() is None:
                        p.stdin.write('list\nworldborder get\nkubejs errors server\nsave-all\nstop\n')
                        p.stdin.flush()
                threading.Thread(target=finish, daemon=True).start()

    code = p.wait()
    logtext = log.read_text(errors='replace')
    result = {
        'ready': ready,
        'exit_code': code,
        'timed_out': timed_out,
        'events': events,
        'heap_mb': args.heap,
        'world': args.world_label,
        'client_tested': False,
        'world_border_724': 'The world border is currently 724 block(s) wide' in logtext,
        'integration_pass': 'LH_INTEGRATION_PASS:' in logtext,
        'integration_fail': 'LH_INTEGRATION_FAIL:' in logtext,
        'clean_exit': code == 0,
    }
    (S / 'smoke-result.json').write_text(json.dumps(result, indent=2) + '\n')
    print('SMOKE_TEST_DONE ' + json.dumps(result), flush=True)
    sys.exit(0 if result['ready'] and result['clean_exit'] and result['world_border_724'] and result['integration_pass'] and not result['integration_fail'] else 1)

if __name__ == '__main__':
    main()
