#!/usr/bin/env python3
import io,json,pathlib,tomllib,zipfile
R=pathlib.Path(__file__).resolve().parents[1]
lock=json.loads((R/'assembly/lock.json').read_text());registry={};allmods=[]
def inspect(data,source,side):
 with zipfile.ZipFile(io.BytesIO(data)) as z:
  names=z.namelist()
  if 'META-INF/mods.toml' in names:
   m=tomllib.loads(z.read('META-INF/mods.toml').decode())
   for mod in m.get('mods',[]):
    obj={'id':mod['modId'],'version':mod.get('version'),'source':source,'client_only':side,'deps':m.get('dependencies',{}).get(mod['modId'],[])}
    registry.setdefault(mod['modId'],[]).append(obj);allmods.append(obj)
  if 'META-INF/jarjar/metadata.json' in names:
   for j in json.loads(z.read('META-INF/jarjar/metadata.json'))['jars']:
    if j['path'] in names:inspect(z.read(j['path']),source+'!'+j['path'],side)
for mod in lock['mods']:
 f=mod['selected_file']['filename'];inspect((R/'assembly/mods'/f).read_bytes(),f,mod['client_only'])
local_jars=sorted((R/'overrides/mods').glob('*.jar'))
for jar in local_jars:
 inspect(jar.read_bytes(),'overrides/mods/'+jar.name,False)
missing=[]
for mod in allmods:
 for d in mod['deps']:
  if d.get('mandatory') and d['modId'] not in registry and d['modId'] not in ['minecraft','forge']:
   missing.append({'parent':mod['id'],'dependency':d})
out={'status':'JAR_IDS_CHECK_ONLY','registry':registry,'missing_required_ids':missing,'note':'Duplicate embedded libs are left to Forge jar-in-jar selection. Version ranges and runtime need additional validation.'}
(R/'assembly/jar-registry.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print('Top-level JARs:',len(lock['mods']),'mod IDs including embedded:',len(registry))
print('Missing:',json.dumps(missing,indent=2))
print('Kelvin:',registry.get('kelvin'))
