#!/usr/bin/env python3
"""Build the tiny pinned Forge mod without requiring a full JDK.
Uses ECJ 3.33.0 (Eclipse compiler); downloaded compiler is never distributed.
Requires Java 17, installed server-test/libraries, and internet on first run.
"""
import hashlib,os,pathlib,subprocess,urllib.request,zipfile
R=pathlib.Path(__file__).resolve().parents[1]
compiler=R/'.cache/ecj.jar';compiler.parent.mkdir(exist_ok=True)
if not compiler.exists():
 with urllib.request.urlopen('https://repo.maven.apache.org/maven2/org/eclipse/jdt/ecj/3.33.0/ecj-3.33.0.jar',timeout=60) as r:compiler.write_bytes(r.read())
java=os.environ.get('JAVA') or str(next((R/'runtime').glob('*/bin/java'),pathlib.Path('java')))
cp=[]
for pattern in ['javafmllanguage-1.20.1-47.4.10.jar','mixin-0.8.5.jar']:
 found=list((R/'server-test/libraries').rglob(pattern))
 if len(found)!=1:raise RuntimeError('Install Forge 47.4.10 server first: '+pattern)
 cp.append(str(found[0]))
src=R/'runtime-mod/src';classes=R/'runtime-mod/classes';classes.mkdir(exist_ok=True)
subprocess.run([java,'-Xmx256m','-jar',str(compiler),'-17','-proc:none','-cp',os.pathsep.join(cp),'-d',str(classes),*[str(p) for p in (src/'main/java').rglob('*.java')]],check=True)
output=R/'overrides/mods/longhaul-runtime-1.20.1-0.1.0.jar';output.parent.mkdir(exist_ok=True)
license_text=(R/'runtime-mod/LICENSE').read_text()
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('META-INF/MANIFEST.MF','Manifest-Version: 1.0\nMixinConfigs: longhaul-runtime.mixins.json\n\n')
 z.writestr('LICENSE',license_text)
 for base in [classes,src/'main/resources']:
  for p in sorted(base.rglob('*')):
   if p.is_file():z.write(p,p.relative_to(base))
print(output,hashlib.sha512(output.read_bytes()).hexdigest())
