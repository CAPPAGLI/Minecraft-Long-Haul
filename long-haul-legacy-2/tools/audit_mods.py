#!/usr/bin/env python3
"""Candidate audit, NOT a compatibility resolver or installable pack generator.
Queries real Modrinth version metadata. Never counts resourcepacks/datapacks as jars.
Caches reproducible API responses. Selection must pass jar constraints + runtime tests.
"""
import concurrent.futures, csv, http.client, json, pathlib, shutil, ssl, subprocess, threading, time, urllib.error, urllib.request, urllib.parse
ROOT=pathlib.Path(__file__).resolve().parents[1]
CACHE=ROOT/'audit/api-cache';CACHE.mkdir(parents=True,exist_ok=True)
LOCK=threading.Lock();NEXT=0
REJECT={
 'waystones':'Телепортация запрещена', 'tempad':'Телепортация запрещена',
 'create-utilities':'Риск дистанционной передачи ресурсов/энергии без маршрута; не включать без разбора',
 'integrated-tunnels':'Дальняя передача может обесценить грузовые маршруты',
 'xnet':'Пока отложено: избежать второй универсальной сети до настройки расстояний',
 'rftools-control':'Пока отложено: роль программирования отдаётся CC: Tweaked',
 'rftools-power':'Пока отложено: лишняя энергетическая экосистема',
 'mekanism':'Отложено: универсальная переработка/телепортация/переносные хранилища',
 'mekanism-generators':'Отложено вместе с Mekanism',
 'sophisticated-backpacks':'Огромные переносные хранилища',
 'sophisticated-storage':'Улучшения вместимости и перенос требуют отдельного баланса',
 'travelers-backpack':'До проверки запретов контейнеров: не включать',
 'travelersbackpack':'До проверки запретов контейнеров: не включать',
 'carry-on':'Перенос заполненных контейнеров обходит логистику',
 'packed-up':'Переносные хранилища не нужны',
 'nomadic-tents':'Карманная база требует надёжных ограничений: не включать по умолчанию',
 'portable-tents':'Карманное измерение не требуется',
 'create-jetpack':'Неограниченный личный полёт слишком рано заменяет транспорт',
 'paraglider':'Личный полёт отложен до баланса транспорта',
 'hang-glider':'Личный полёт отложен', 'gliders':'Личный полёт отложен',
 'artifacts':'Эффекты мобильности и перенос предметов требуют отдельного аудита',
 'relics':'Эффекты мобильности и перенос предметов требуют отдельного аудита',
 'relics-artifacts-compat':'Базовые моды не выбраны',
 'ex-deorum':'Генерация любых ресурсов на базе против региональной экономики',
 'create-mechanical-spawner':'Не включать до аудита лута: потенциальный обход ресурсных регионов',
 'born-in-chaos':'Отложено: тяжёлые вторжения не должны превращать дороги в постоянный бой',
 'serene-seasons':'Не вводить второе обязательное ограничение роста/климата',
 'journeymap':'Дублирует выбранные карты Xaero',
 'antique-atlas':'Дублирует Map Atlases',
 'inventory-profiles-next':'Выбрать один сортировщик, не несколько',
 'canary':'Не сочетать автоматически с Radium',
 'starlight':'Не включать автоматически: отдельный аудит освещения и физики',
 'starlight-forge':'Не включать автоматически: отдельный аудит освещения и физики',
 'better-combat':'Оставить бой ближе к ванили до теста Doomed',
 'thermal-foundation':'Резерв: не добавлять параллельную переработку без промышленной роли',
 'thermal-expansion':'Резерв: основа — Create и Immersive Engineering',
 'thermal-cultivation':'Резерв вместе с Thermal', 'thermal-locomotion':'Резерв вместе с Thermal',
 'thermal-integration':'Резерв вместе с Thermal', 'thermal-innovation':'Резерв вместе с Thermal',
 'thermal-dynamics':'Резерв вместе с Thermal',
 'the-lost-cities':'Не включать по умолчанию: меняет характер генерации, не решает экономику городов',
 'worldedit':'Инструмент разработки, не игрока',
 'building-gadgets':'Не включать до ограничения дистанции/источника блоков',
 'building-gadgets-2':'Не включать до ограничения дистанции/источника блоков',
 'fastload':'Не включать оптимизации вслепую', 'chunk-pregenerator':'Дублирует Chunky',
 'despawn-tweaker':'Дублирует Let Me Despawn', 'inventory-sorter':'Резерв сортировщика',
 'global-packs':'Достаточно одного загрузчика ресурсов', 'open-loader':'Достаточно одного загрузчика ресурсов',
 'ftb-chunks':'Телепортация/чанклоадинг требуют ограничений',
 'ftb-quests':'Резерв: Heracles остаётся основным до решения о миграции',
 'sleep-tight':'Резерв: не добавлять вторую систему сна',
 'spawn-animations':'Опциональный визуальный слой, не промышленная механика',
 'doomed':'Только отдельный опциональный профиль с официальной загрузкой',
}
def _curl_get_json(url):
 curl_bin=shutil.which('curl') or shutil.which('curl.exe')
 if not curl_bin:return None
 res=subprocess.run([curl_bin,'-sSL','--fail','--retry','2','--connect-timeout','15','--max-time','45','-A','LongHaulLegacy/2.0 (local compatibility audit)',url],capture_output=True)
 if res.returncode==0 and res.stdout:
  return json.loads(res.stdout.decode('utf-8'))
 return None

def get(path):
 global NEXT
 fn=CACHE/(urllib.parse.quote(path,safe='')+'.json')
 if fn.exists():return json.loads(fn.read_text(encoding='utf-8'))
 url='https://api.modrinth.com/v2/'+path
 last_err=None
 for retry in range(6):
  with LOCK:
   delay=max(0,NEXT-time.monotonic());NEXT=max(NEXT,time.monotonic())+.27
  time.sleep(delay)
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'LongHaulLegacy/2.0 (local compatibility audit)','Connection':'close'})
   with urllib.request.urlopen(req,timeout=40) as r:data=json.load(r)
   fn.write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8');return data
  except urllib.error.HTTPError as e:
   if e.code==404:return None
   if e.code==429:time.sleep(15*(retry+1));continue
   last_err=e
   if e.code>=500:time.sleep(2*(retry+1));continue
   raise
  except (urllib.error.URLError,ssl.SSLError,TimeoutError,ConnectionError,http.client.HTTPException,OSError) as e:
   last_err=e
   time.sleep(1.5*(retry+1))
 try:
  data=_curl_get_json(url)
  if data is not None:
   fn.write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8');return data
 except Exception:
  pass
 if last_err is not None:raise last_err
 return None

def audit(arg):
 slug,cat=arg
 try:
  vs=get('project/'+slug+'/version?'+urllib.parse.urlencode({'loaders':'["forge"]','game_versions':'["1.20.1"]'}))
  row={'slug':slug,'category':cat,'status':'unavailable','reason':'Нет найденного релиза Forge 1.20.1; проверить slug/другой источник'}
  if vs:
   vs=[v for v in vs if v['date_published'] <= '2026-11-15T15:59:59Z' and any(f['filename'].endswith('.jar') for f in v['files'])]
   if vs:
    stable=[v for v in vs if v['version_type']=='release'];v=(stable or vs)[0]
    row.update(status='candidate',reason='Доступен релиз; совместимость не проверена',project_id=v['project_id'],version_id=v['id'],version=v['version_number'],release_type=v['version_type'],dependencies=v['dependencies'],files=v['files'])
  if slug in REJECT:row.update(status='excluded',reason=REJECT[slug])
  return row
 except Exception as e:return {'slug':slug,'category':cat,'status':'error','reason':str(e)}

def main():
 cats=json.loads((ROOT/'tools/candidates.json').read_text(encoding='utf-8'));unique={}
 for cat,slugs in cats.items():
  for s in slugs:unique.setdefault(s,cat)
 rows=list(concurrent.futures.ThreadPoolExecutor(max_workers=8).map(audit,unique.items()))
 # Deduplicate aliases based on API project ID; don't inflate counts.
 seen={}
 for r in rows:
  if r['status']=='candidate':
   pid=r['project_id']
   if pid in seen:r.update(status='alias',reason='Тот же проект: '+seen[pid])
   else:seen[pid]=r['slug']
 (ROOT/'audit/candidates.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
 with (ROOT/'audit/candidates.csv').open('w',encoding='utf-8',newline='') as f:
  fields=['category','slug','status','version','reason'];w=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');w.writeheader();w.writerows(rows)
 from collections import Counter
 print('Candidate audit:',dict(Counter(r['status'] for r in rows)),flush=True)
 print('This is a candidate list, NOT a working modpack.',flush=True)
if __name__=='__main__':main()
