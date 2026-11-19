#!/usr/bin/env python3
"""Package only lock-selected downloads and intentional overrides; never glob assembly/mods.
No third-party mod JARs, runtimes, worlds, or server credentials are redistributed.
"""
import hashlib,json,pathlib,zipfile
R=pathlib.Path(__file__).resolve().parents[1]
lock=json.loads((R/'assembly/lock.json').read_text())
mods=lock['mods'];files=[];paths=set()
for mod in mods:
 f=mod['selected_file'];p=R/'assembly/mods'/f['filename'];b=p.read_bytes()
 assert hashlib.sha512(b).hexdigest()==f['hashes']['sha512'],p
 assert hashlib.sha1(b).hexdigest()==f['hashes']['sha1'],p
 assert len(b)==f['size'],p
 path='mods/'+p.name;assert path not in paths;paths.add(path)
 assert f['url'].startswith('https://cdn.modrinth.com/'),f['url']
 files.append({'path':path,'hashes':{k:f['hashes'][k] for k in ['sha1','sha512']},'env':{'client':'required','server':'unsupported' if mod['client_only'] else 'required'},'downloads':[f['url']],'fileSize':f['size']})
forbidden={'extendedgears','create-track-map','servercore','fastload','ad-astra','natural-temperature','cold-sweat'}
assert not forbidden.intersection(m['slug'] for m in mods)
manifest={'formatVersion':1,'game':'minecraft','versionId':'2.0-alpha.1','name':'Long Haul Legacy 2.0 — Transport Lab ALPHA','summary':'Experimental transport/industrial core: 62 external JARs + runtime, 26 quests. Not the full 500-mod campaign. New test world only.','files':files,'dependencies':{'minecraft':'1.20.1','forge':'47.4.10'}}
(R/'assembly/modrinth.index.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
mrpack=R.parent/'Long-Haul-Legacy-2.0-alpha.1.mrpack'
with zipfile.ZipFile(mrpack,'w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('modrinth.index.json',json.dumps(manifest,ensure_ascii=False,indent=2))
 for p in sorted((R/'overrides').rglob('*')):
  if p.is_file():
   assert '99_integration' not in p.name and p.suffix not in {'.log','.dat'},p
   z.write(p,p.relative_to(R))
 for name in ['README.md','TEST-REPORT.md','DOOMED.md','MODLIST.md','STATUS.json']:
  z.write(R/name,'overrides/longhaul-docs/'+name)
with zipfile.ZipFile(mrpack) as z:
 assert z.testzip() is None
 names=z.namelist()
 assert len([n for n in names if n.startswith('overrides/config/heracles/quests/') and n.endswith('.json')])==26
 assert len([n for n in names if n.endswith('.jar')])==1
 assert not any('server.properties' in n or 'server-test' in n or 'runtime/zulu' in n for n in names)
source=R.parent/'Long-Haul-Legacy-2.0-alpha.1-Sources-and-Report.zip'
with zipfile.ZipFile(source,'w',zipfile.ZIP_DEFLATED) as z:
 for name in ['README.md','TEST-REPORT.md','DOOMED.md','MODLIST.md','STATUS.json']:
  z.write(R/name,name)
 for directory in ['tools','design','overrides','runtime-mod','audit']:
  for p in sorted((R/directory).rglob('*')):
   if p.is_file() and not any(t in p.parts for t in ['__pycache__','classes']) and p.suffix not in {'.pyc','.jar'}:
    z.write(p,p.relative_to(R))
 for name in ['lock.json','jar-registry.json','modrinth.index.json']:
  z.write(R/'assembly'/name,'assembly/'+name)
 for name in ['smoke-result.json','smoke-console.log','kubejs/server_scripts/99_integration_test.js','server.properties','smoke-void/serverconfig/valkyrienskies/vs-core-server.toml']:
  z.write(R/'server-test'/name,'test-evidence/'+name)
summary={'external_downloads':len(files),'external_download_bytes':sum(f['fileSize'] for f in files),'local_mods':1,'installed_quests':26,'archives':{}}
for p in [mrpack,source]:
 summary['archives'][p.name]={'bytes':p.stat().st_size,'sha512':hashlib.sha512(p.read_bytes()).hexdigest()}
(R/'assembly/package-validation.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
