#!/usr/bin/env python3
"""Generate design data, NOT installed quests or Minecraft runtime integrations."""
import csv,json,pathlib
R=pathlib.Path(__file__).resolve().parents[1]
D=R/'design'
cities=[
 ('mine','Горный рудник','ore_concentrate','smelter'),
 ('forest','Лесная артель','treated_timber','mine'),
 ('farm','Речной агрогород','field_rations','forest'),
 ('port','Морской порт','marine_reagent','farm'),
 ('badlands','Карьер пустошей','refractory_mix','port'),
 ('wetland','Химический посёлок','technical_oil','badlands'),
 ('smelter','Стекольная долина','technical_glass','wetland'),
 ('machine','Машиностроительный центр','machine_parts','smelter'),
]
base={'iron_ingot','coal','wood','stone','sand','wheat','water','copper_ingot'}
raw=['iron_ingot','wood','wheat','water','stone','coal','sand','copper_ingot']
recipes=[]
for i,(city,name,product,_) in enumerate(cities):
 recipes.append({'id':city+'_bootstrap','tier':1,'site_type':city,'mode':'manual_low_output','inputs':{raw[i]:4,'coal':1},'output':product,'amount':1,'note':'Невысокий выпуск; доступен без импортного оборудования. Требует физического доступа к локальному узлу.'})
 recipes.append({'id':city+'_industrial','tier':2,'site_type':city,'mode':'automated','inputs':{raw[i]:8,cities[(i-1)%8][2]:1,cities[(i-2)%8][2]:1},'output':product,'amount':8})
recipes.append({'id':'continental_hub','tier':4,'site_type':'machine','mode':'automated','inputs':{c[2]:8 for c in cities},'output':'continental_module','amount':1})
reachable=set(base);remaining=list(recipes)
while True:
 new=[p for p in remaining if set(p['inputs'])<=reachable]
 if not new:break
 for p in new:reachable.add(p['output']);remaining.remove(p)
assert not remaining,remaining
(D/'economy-recipes.spec.json').write_text(json.dumps({'status':'design_only','initial_resources':sorted(base),'recipes':recipes,'reachability_test':'passed_for_material_graph_only','not_tested':['Minecraft recipes','site placement','game balance','currency arbitrage','runtime']},ensure_ascii=False,indent=2)+'\n')

qs=[]
def add(qid,chapter,title,typ,conditions,stage=1,optional=True):
 qs.append({'id':qid,'chapter':chapter,'title':title,'verification_type':typ,'conditions':conditions,'stage':stage,'optional':optional,'status':'specified_not_implemented','claim_policy':'server_transaction_once','evidence_source':'trusted_server_adapter_required'})

main=[
 [('Первый работающий станок','controlled_production',{'item_family':'processed_wood','minimum_output':64}),('Первые снабженцы','delivery',{'distinct_inputs':2,'batch_items':128}),('Мастерская у реки','site_commission',{'site':'starter_workshop','test_seconds':120}),('Дорога к лесопилке','route_trial',{'minimum_distance_blocks':750,'vehicle_passes':1}),('Первые рационы','controlled_production',{'food_groups':3,'output_portions':32}),('Первый удалённый лагерь','camp_visit',{'distance_from_home_blocks':1000}),('Запуск лесной артели','site_commission',{'site':'forest','accepted_batches':2}),('Локальная грузовая связь','delivery',{'distinct_sites':2,'batch_items':512,'vehicle_required':True})],
 [('Путь к карьеру','route_trial',{'site':'badlands','checkpoints':3}),('Порт для тяжёлого груза','vehicle_delivery',{'vehicle_family':'ship','batch_items':1024}),('Региональный состав','vehicle_delivery',{'vehicle_family':'train','batch_items':2048}),('Два местных производства','site_commission',{'distinct_site_types':2}),('Регулярное питание','scheduled_supply',{'food_portions_per_window':16,'windows':5,'window_seconds':120}),('Самостоятельное топливо','controlled_production',{'product_family':'transport_fuel','minimum_output':4000,'unit':'mB'}),('Стекло и флюс','multi_input_supply',{'distinct_inputs':2,'windows':5}),('Сеть трёх регионов','network_supply',{'distinct_regions':3,'minimum_deliveries_each':3})],
 [('Сортировочная станция','scheduled_train',{'distinct_cargo_families':3,'successful_round_trips':4}),('Автоматическое снабжение','multi_input_supply',{'distinct_inputs':3,'test_seconds':600,'max_starvation_seconds':60}),('Стабильная производительность','controlled_production',{'minimum_per_minute':64,'minute_windows':10}),('Контрольная диспетчерская','computer_challenge',{'verified_sensor_types':3,'verified_actuations':2}),('Промышленный мост','route_trial',{'feature':'bridge','vehicle_family':'train','successful_round_trips':3}),('Запуск разрушенного завода','site_commission',{'site':'industrial_ruin','continuous_seconds':600}),('Груз через горы','vehicle_delivery',{'vehicle_family':'airship','batch_items':2048,'mountain_route':True}),('Межрегиональный консорциум','network_supply',{'distinct_regions':5,'scheduled_windows':5})],
 [('Архив старой магистрали','unique_site_visit',{'unique_site_id':'continental_archive','required_copies':1}),('Резервный маршрут','route_trial',{'independent_routes_to_same_destination':2}),('Доставка на дальний узел','vehicle_delivery',{'minimum_distance_blocks':40000,'batch_items':8192}),('Все отрасли в работе','network_supply',{'distinct_site_types':8,'accepted_batches_each':3}),('Реконструкция машинного зала','site_commission',{'site':'continental_hub','distinct_inputs':8}),('Рабочая смена комплекса','controlled_production',{'product':'continental_module','per_minute':4,'minute_windows':10}),('Континентальное снабжение','network_supply',{'distinct_regions':8,'minimum_uptime_fraction':0.9,'test_seconds':1200}),('Открытие новой магистрали','scheduled_train',{'successful_round_trips':6,'distinct_stations':4,'batch_items_total':16384})],
]
for stage,entries in enumerate(main,1):
 for i,(title,typ,cond) in enumerate(entries,1):add(f'main_{stage}_{i:02}','Основная прогрессия',title,typ,cond,stage,False)

for city,name,product,destination in cities:
 tasks=[
 ('Первое знакомство','site_visit',{'site':city}),
 ('Местное сырьё','controlled_production',{'site':city,'product':product,'minimum_output':32}),
 ('Доставка продовольствия','delivery',{'destination':city,'food_portions':64,'distinct_food_groups':3}),
 ('Поставка оборудования','delivery',{'destination':city,'goods_family':'maintenance','batch_items':128}),
 ('Вывоз первой партии','vehicle_delivery',{'origin':city,'destination':destination,'product':product,'batch_items':512}),
 ('Дорога к предприятию','route_trial',{'destination':city,'checkpoints':3,'loaded_vehicle_passes':2}),
 ('Две смены снабжения','multi_input_supply',{'destination':city,'distinct_inputs':2,'windows':6,'window_seconds':120}),
 ('Расширение цеха','controlled_production',{'site':city,'product':product,'minimum_per_minute':32,'minute_windows':10}),
 ('Промежуточный склад','depot_commission',{'route_destination':city,'different_cargo_families':3,'throughput_items':2048}),
 ('Регулярный экспорт','scheduled_supply',{'origin':city,'product':product,'windows':5,'items_each':512,'window_seconds':180}),
 ('Восстановленный подъезд','route_trial',{'destination':city,'damaged_route_repaired':True,'loaded_vehicle_passes':3}),
 ('Заказ консорциума','network_supply',{'origin':city,'distinct_destinations':3,'minimum_deliveries_each':3}),
 ]
 for i,(title,typ,cond) in enumerate(tasks,1):add(f'region_{city}_{i:02}','Региональные контракты',name+': '+title,typ,cond,1 if i<5 else 2 if i<9 else 3)

families=[
 ('throughput','Производительность','controlled_production'),('train','Грузовой поезд','scheduled_train'),('water','Речная логистика','vehicle_delivery'),('air','Воздушная доставка','vehicle_delivery'),('road','Дорожные испытания','route_trial'),('supply','Снабжение цеха','multi_input_supply'),('cc','Диспетчеризация CC','computer_challenge'),('repair','Восстановление','site_commission')]
for family,label,typ in families:
 for tier in range(1,9):
  conditions={
   'throughput':{'minimum_per_minute':16*tier,'minute_windows':10,'controlled_inputs':True},
   'train':{'vehicle_family':'train','batch_items_total':512*tier,'successful_round_trips':3+tier//2,'max_interval_seconds':300},
   'water':{'vehicle_family':'ship','batch_items':256*tier,'minimum_distance_blocks':1000*tier,'single_trip':True},
   'air':{'vehicle_family':'aircraft_or_airship','batch_items':128*tier,'minimum_distance_blocks':2000*tier,'refuel_stops_max':max(0,tier//3)},
   'road':{'loaded_vehicle_passes':3,'minimum_distance_blocks':500*tier,'ordered_checkpoints':tier+2,'route_feature':['river','slope','marsh','gorge','tunnel','bridge','pass','mixed'][tier-1]},
   'supply':{'distinct_inputs':2+tier//3,'minimum_items_each_per_window':16*tier,'windows':5,'window_seconds':120,'max_starvation_seconds':30},
   'cc':{'server_challenge':True,'verified_sensor_types':1+tier//3,'verified_actuations':1+tier//4,'repeated_challenges':tier},
   'repair':{'site_template_tier':tier,'test_seconds':300+tier*60,'distinct_inputs':2+tier//3,'requires_output_acceptance':True},
  }[family]
  add(f'engineering_{family}_{tier:02}','Инженерные испытания',f'{label}: класс {tier}',typ,conditions,min(4,1+(tier-1)//2))

for city,name,_,_ in cities:
 for kind,title in [('arrival','Первый вид города'),('before','Предприятие до восстановления'),('after','Предприятие после восстановления'),('route','Работающий грузовой маршрут')]:
  add(f'photo_{city}_{kind}','Экспедиционная документация',name+': '+title,'photo_evidence',{'site':city,'phase':kind,'distinct_server_photo_id':True,'capture_after_assignment':True,'image_semantics':'requires_Exposure_adapter_or_manual_review','honest_fallback':'visit_plus_new_developed_film_report'},2 if kind!='arrival' else 1)

expeditions=[
 ('Базовый экспедиционный набор','kit_check',{'families':['food','bedroll','map','camera','light','tools']}),
 ('Лагерь за первой рекой','camp_visit',{'minimum_distance_from_home':1000,'safe_sleep_setup':True}),
 ('Первый походный снимок','photo_evidence',{'site_type':'camp','new_photo':True}),
 ('Запас на три перехода','ration_delivery',{'food_portions':48,'different_food_groups':3}),
 ('Маршрут до лагеря','route_trial',{'ordered_checkpoints':3,'loaded_vehicle_passes':1}),
 ('Мост к лагерю','route_trial',{'route_feature':'bridge','camp_destination':True}),
 ('Склад на полпути','depot_commission',{'route_fraction_min':0.3,'route_fraction_max':0.7,'supply_batches':3}),
 ('Две ночёвки в пути','camp_visit',{'distinct_camps':2,'minimum_pair_distance':1000}),
 ('Экспедиционный вагон','vehicle_trial',{'vehicle_family':'train','roles':['sleep','food','repair','photo'],'storage_cap_test':True}),
 ('Фургон полевой мастерской','vehicle_trial',{'vehicle_family':'road','roles':['sleep','food','repair'],'storage_cap_test':True}),
 ('Фоторазведка опасного перевала','photo_evidence',{'site_type':'mountain_pass','new_photo':True}),
 ('Возвращение с образцами','sample_return',{'distinct_source_sites':3,'photos':3}),
 ('Три региона — три лагеря','camp_visit',{'distinct_regions':3,'distinct_camps':3}),
 ('Регулярное снабжение экспедиции','scheduled_supply',{'food_portions_each':32,'windows':5}),
 ('Альбом дальнего маршрута','photo_evidence',{'ordered_route_sites':8,'distinct_photos':8}),
 ('Защищённый торговый тракт','route_trial',{'loaded_vehicle_passes':5,'cargo_loss_allowed':0,'minimum_distance_blocks':5000}),
]
for i,(title,typ,cond) in enumerate(expeditions,1):add(f'expedition_{i:02}','Лагеря и экспедиции',title,typ,cond,min(4,1+(i-1)//4))
assert len(qs)==240,len(qs)
assert len({q['id'] for q in qs})==240
assert all(q['verification_type']!='inventory' for q in qs if 'Инженер' in q['chapter'])
(D/'quest-catalog.json').write_text(json.dumps({'status':'design_only_not_installed','quests':qs},ensure_ascii=False,indent=2)+'\n')
with (D/'quest-catalog.csv').open('w') as f:
 w=csv.writer(f);w.writerow(['ID','Глава','Название','Этап','Проверка','Статус','Условия'])
 for q in qs:w.writerow([q['id'],q['chapter'],q['title'],q['stage'],q['verification_type'],q['status'],json.dumps(q['conditions'],ensure_ascii=False)])
print('240 quest specifications, material-graph bootstrap reachability passed. Minecraft runtime NOT implemented/tested.')
