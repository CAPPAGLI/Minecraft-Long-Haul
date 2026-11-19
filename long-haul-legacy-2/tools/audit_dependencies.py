#!/usr/bin/env python3
"""Expand API-required dependencies for assessment, not a runnable lockfile.
Reports excluded dependencies and conflicting version pins; jar constraints separate.
"""
import json,pathlib,concurrent.futures
from audit_mods import get
R=pathlib.Path(__file__).resolve().parents[1]
rows=json.loads((R/'audit/candidates.json').read_text())
known={r['project_id']:r for r in rows if r.get('project_id') and r['status']=='candidate'}
excluded={r['project_id']:r for r in rows if r.get('project_id') and r['status']=='excluded'}
issues=[];edges=[];done=set()
def lookup(arg):
 pid,vid=arg
 if vid:return get('version/'+vid)
 vs=get('project/'+pid+'/version?loaders=%5B%22forge%22%5D&game_versions=%5B%221.20.1%22%5D')
 if not vs:return None
 vs=[v for v in vs if v['date_published'] <= '2026-11-15T15:59:59Z' and any(f['filename'].endswith('.jar') for f in v['files'])]
 if not vs:return None
 releases=[v for v in vs if v['version_type']=='release']
 return (releases or vs)[0]
while True:
 work={}
 for pid,r in list(known.items()):
  if pid in done:continue
  done.add(pid)
  for d in r.get('dependencies',[]):
   if d['dependency_type']!='required':continue
   target=d.get('project_id');vid=d.get('version_id')
   edges.append({'from':pid,'to':target,'pin':vid})
   if target in excluded:
    issues.append({'parent':r['slug'],'dependency':excluded[target]['slug'],'issue':'excluded-required-dependency'});continue
   if target in known:
    if vid and known[target]['version_id']!=vid:issues.append({'parent':r['slug'],'dependency':known[target]['slug'],'issue':'different-required-version','pin':vid})
   else:work[(target,vid)]=True
 if not work:break
 args=list(work)
 for (pid,vid),v in zip(args,concurrent.futures.ThreadPoolExecutor(max_workers=6).map(lookup,args)):
  if not v:issues.append({'project_id':pid,'version_id':vid,'issue':'required-version-unavailable'});continue
  if 'forge' not in v['loaders'] or '1.20.1' not in v['game_versions']:
   issues.append({'project_id':v['project_id'],'version_id':v['id'],'issue':'required-version-wrong-platform'});continue
  actual=v['project_id']
  if actual not in known:known[actual]={'slug':actual,'project_id':actual,'version_id':v['id'],'version':v['version_number'],'category':'api-dependency','status':'candidate','dependencies':v['dependencies'],'files':v['files']}
output={'status':'NOT_INSTALLABLE_DEPENDENCY_AUDIT','minecraft':'1.20.1','loader':'forge','projects':list(known.values()),'edges':edges,'issues':issues,'warning':'API metadata may omit jar dependencies. No runtime compatibility established.'}
(R/'audit/dependency-graph.json').write_text(json.dumps(output,ensure_ascii=False,indent=2))
print('Unique candidates incl dependencies:',len(known),'issues:',len(issues))
