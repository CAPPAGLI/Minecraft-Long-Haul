#!/usr/bin/env python3
"""Bounded headless test; no acceptance of stability implied by one startup.
Requires installed Forge and a local Java 17. Offline server binds loopback only.
"""
import json,pathlib,subprocess,threading,time,sys,os,signal
R=pathlib.Path(__file__).resolve().parents[1];S=R/'server-test'
java=next((R/'runtime').glob('*/bin/java'))
cmd=[str(java),'-Xms256m','-Xmx768m','-XX:MaxMetaspaceSize=256m','-XX:ReservedCodeCacheSize=64m','-XX:MaxDirectMemorySize=96m','-XX:ActiveProcessorCount=2','@libraries/net/minecraftforge/forge/1.20.1-47.4.10/unix_args.txt','nogui']
log=S/'smoke-console.log';ready=False;timed_out=False;events=[]
p=subprocess.Popen(cmd,cwd=S,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
def watchdog():
 global timed_out
 time.sleep(180)
 if p.poll() is None:
  timed_out=True;print('WATCHDOG: stop requested',flush=True)
  try:p.stdin.write('stop\n');p.stdin.flush()
  except Exception:pass
  time.sleep(20)
  if p.poll() is None:
   p.send_signal(signal.SIGQUIT);time.sleep(2);p.kill()
threading.Thread(target=watchdog,daemon=True).start()
with log.open('w') as f:
 for line in p.stdout:
  f.write(line);f.flush();print(line,end='',flush=True)
  if 'Done (' in line and 'For help' in line and not ready:
   ready=True;events.append('server_ready')
   def finish():
    time.sleep(15)
    if p.poll() is None:
     p.stdin.write('list\nworldborder get\nkubejs errors server\nsave-all\nstop\n');p.stdin.flush()
   threading.Thread(target=finish,daemon=True).start()
code=p.wait()
logtext=log.read_text()
result={'ready':ready,'exit_code':code,'timed_out':timed_out,'events':events,'heap_mb':768,'world':'flat smoke world','client_tested':False,'integration_pass':'LH_INTEGRATION_PASS:' in logtext,'integration_fail':'LH_INTEGRATION_FAIL:' in logtext,'clean_exit':code==0}
(S/'smoke-result.json').write_text(json.dumps(result,indent=2)+'\n')
print('SMOKE_TEST_DONE '+json.dumps(result),flush=True)

# Readiness alone is not success; make CI fail on integration failure or an unclean JVM exit.
sys.exit(0 if result['ready'] and result['clean_exit'] and result['integration_pass'] and not result['integration_fail'] else 1)
