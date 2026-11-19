#!/usr/bin/env python3
"""Inspect actual Forge mods.toml for Create compatibility. Does not launch Minecraft."""
import concurrent.futures, io, json, pathlib, re, tomllib, urllib.request, zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]

def num(v):
 return tuple(int(x) for x in re.findall(r'\d+',v)[:4])
def compare(a,b):
 a=num(a);b=num(b);n=max(len(a),len(b));a+= (0,)*(n-len(a));b+=(0,)*(n-len(b))
 return (a>b)-(a<b)
def fits(v,r):
 if not r or r in ['*','[0,)']:return True
 if r[0] not in '[(':return None  # not a Maven range; don't pretend
 if ',' not in r:return compare(v,r.strip('[]'))==0
 # Single interval only; unknown union ranges are left unverified.
 if r.count(',')!=1:return None
 low,hi=r[1:-1].split(',')
 return (not low or compare(v,low)>0 or r[0]=='[' and compare(v,low)==0) and (not hi or compare(v,hi)<0 or r[-1]==']' and compare(v,hi)==0)

def one(row):
 files=row.get('files',[]);files=[f for f in files if f['filename'].endswith('.jar')]
 if not files:return None
 file=next((f for f in files if f.get('primary')),files[0])
 result={'slug':row['slug'],'version':row['version'],'version_id':row['version_id'],'file':file['filename']}
 try:
  req=urllib.request.Request(file['url'],headers={'User-Agent':'LongHaulLegacy/2.0 dependency inspection'})
  data=urllib.request.urlopen(req,timeout=90).read()
  with zipfile.ZipFile(io.BytesIO(data)) as z:
   if 'META-INF/mods.toml' not in z.namelist():return dict(result,status='no_forge_toml')
   meta=tomllib.loads(z.read('META-INF/mods.toml').decode())
   deps=[dict(d,owner=k) for k,dd in meta.get('dependencies',{}).items() for d in dd]
   mods=meta.get('mods',[])
   result.update(mods=[{'id':m['modId'],'version':m.get('version')} for m in mods],dependencies=deps,status='inspected')
   create=[d for d in deps if d['modId']=='create' and d.get('mandatory',True)]
   result['create_6_0_8']=[{'range':d.get('versionRange',''),'satisfied':fits('6.0.8',d.get('versionRange',''))} for d in create]
 except Exception as e:result.update(status='error',error=str(e))
 return result

def main():
 rows=json.loads((ROOT/'audit/candidates.json').read_text())
 rows=[r for r in rows if r['status']=='candidate' and r['category'] in ['core','create_industry']]
 out=[v for v in concurrent.futures.ThreadPoolExecutor(max_workers=5).map(one,rows) if v]
 (ROOT/'audit/core-jar-constraints.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
 for v in out:
  bad=[x for x in v.get('create_6_0_8',[]) if x['satisfied'] is False]
  print(v['slug'],v['version'],v['status'],'CREATE VERSION CONFLICT '+str(bad) if bad else '')
if __name__=='__main__':main()
