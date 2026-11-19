#!/usr/bin/env python3
"""Real Heracles 1.20.1 quests. Contract quests require server-issued advancement,
never item-in-inventory. Tutorial item quests are explicitly labelled tutorials.
"""
import json,pathlib
R=pathlib.Path(__file__).resolve().parents[1];O=R/'overrides';Q=O/'config/heracles/quests';D=O/'kubejs/data/longhaul/advancements/contracts'
Q.mkdir(parents=True,exist_ok=True);D.mkdir(parents=True,exist_ok=True)
def put(p,obj):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
def quest(qid,title,group,pos,icon,tasks,desc,deps=None):
 put(Q/(qid+'.json'),{'dependencies':deps or [],'tasks':tasks,'rewards':{},'display':{'title':json.dumps({'text':title},ensure_ascii=False),'subtitle':json.dumps({'text':'Long Haul Legacy 2.0 · Alpha'},ensure_ascii=False),'description':desc,'groups':{group:{'position':pos}},'icon':{'type':'heracles:item','item':{'id':icon,'count':1}},'icon_background':'heracles:textures/gui/quest_backgrounds/default.png'},'settings':{'hidden':'LOCKED','showDependencyArrow':True,'individual_progress':True,'repeatable':False,'unlockNotification':True}})
intro=[
 ('alpha_welcome','Прототип промышленной сети','minecraft:book',['Это тестовое ядро, НЕ завершённая сборка на 500 модов. Здесь нет готовой экономики городов и гарантированных редких локаций.','Цель текущего этапа — испытать транспорт, Create, камеру, компьютеры и работающую серверную приёмку.','Подтверждение чтения — ручное; это не инженерное испытание.']),
 ('alpha_terminal','Как зарегистрировать терминал','minecraft:barrel',['Поставьте пустую обычную бочку. Встаньте на неё и выполните /lh terminal.','Посмотрите /lh help, затем /lh accept plates. Заказ начнётся только при пустой бочке.','Подводите товары воронкой или средствами Create. Принятые товары РАСХОДУЮТСЯ без возврата.']),
 ('alpha_windows','Что измеряют испытания','minecraft:clock',['Контракты с суффиксом _shift считают норму в КАЖДОМ окне по 60 игровых секунд. Один полный сундук не завершает испытание мгновенно.','Выгрузка чанка приостанавливает часы. Серверный прогресс сохраняется; /lh status показывает детали.','При пропуске нормы испытание проваливается. /lh abort останавливает заказ; уже потреблённые товары не возвращаются.','Пока это доказательство ритма ПРИЁМКИ, а не изготовления на месте. Можно снабжать из запаса.']),
 ('alpha_limits','Честные границы прототипа','minecraft:comparator',['Проверка реального train ID, топлива, дорожной связности и содержимого фотографии ещё не подключена.','Есть защита от обычного открытия/ломания активной бочки, но нет полной защиты от взрывов, поршней, сборки контрапции и всех модовых интерфейсов. Не используйте на публичном соревновательном сервере.','Не переносите активный терминал на движущуюся конструкцию. Один участник — одна бочка; команда пока не делит прогресс.']),
 ('alpha_world','Мир без климатической тюрьмы','minecraft:compass',['Natural Temperature и Cold Sweat отсутствуют. Фермерство не заперто в старых климатических поясах.','Граница обычного мира: 175000 блоков, центр 0,0. В этом alpha ещё НЕТ гарантии всех сюжетных ресурсов внутри неё.','Создайте отдельный тестовый мир. Не переносите сюда сохранение 1.21.1.']),
 ('alpha_photo','Фотодокументация','exposure:camera',['Exposure добавлен: камера, плёнка, проявка и альбомы.','Снимайте фабрики, лагеря и маршруты. Автоматическая проверка объекта в кадре ещё не реализована; фотографии пока не открывают критические технологии.']),
]
for i,(qid,title,icon,desc) in enumerate(intro):quest(qid,title,'01 · Начало и правила',[(i%3-1)*84,(i//3)*72-36],icon,{'read':{'type':'heracles:check','title':'Прочитано (ручное подтверждение)'}},desc)
items=[
 ('waterwheel','Источник кинетики','create:water_wheel','Водяное колесо — начало механической мастерской.'),
 ('press','Обработка металла','create:mechanical_press','Пресс штампует пластины. Далее используйте их для заказов терминала.'),
 ('mixer','Сплавы','create:mechanical_mixer','Миксер смешивает сплавы; продумайте подачу ингредиентов и подогрев.'),
 ('brass','Латунная мастерская','create:brass_ingot','Латунь открывает точные механизмы и новую автоматизацию.'),
 ('precision','Точная сборка','create:precision_mechanism','Механизм нужен для промышленного оборудования. Изучите последовательную сборку в JEI.'),
 ('track','Железнодорожный путь','create:track','Рельсы — только начало линии. Инвентарное задание НЕ доказывает наличие дороги.'),
 ('station','Грузовая станция','create:track_station','Спроектируйте погрузку и разгрузку. Проверка рейсов конкретного поезда появится отдельно.'),
 ('computer','Промышленный компьютер','computercraft:computer_normal','CC: Tweaked — локальная автоматизация. В прототипе показания пользовательского Lua ещё не засчитываются как доверенное доказательство.'),
 ('camera','Камера экспедиции','exposure:camera','Фотографируйте открытия; берите запас плёнки.'),
 ('film','Запас плёнки','exposure:black_and_white_film','Чёрно-белая плёнка нужна для первых полевых снимков.'),
 ('album','Альбом маршрута','exposure:album','Соберите фотографии городов, мостов и этапов фабрики.'),
 ('cookpot','Походное снабжение','farmersdelight:cooking_pot','Farmer’s Delight связывает урожай и готовку. Держите запас для длительных рейсов.'),
]
for i,(qid,title,item,desc) in enumerate(items):quest('tutorial_'+qid,title,'02 · Мастерская и экспедиция',[(i%4)*84-126,(i//4)*72-72],item,{'item':{'type':'heracles:item','item':item,'amount':1,'collection':'AUTOMATIC'}},['Учебная веха: обнаружение предмета, НЕ испытание работающего предприятия.',desc])
contracts=[
 ('plates','Первая партия пластин','create:iron_sheet','64 железные пластины.'),
 ('brass','Латунный заказ','create:brass_ingot','32 латунных слитка.'),
 ('rails','Снабжение путейцев','create:track','128 рельсов Create.'),
 ('provisions','Продовольственный склад','minecraft:bread','32 хлеба И 32 печёные картофелины.'),
 ('mechanisms','Приборы для депо','create:precision_mechanism','8 точных механизмов.'),
 ('plate_shift','Ритм поставки пластин','create:iron_sheet','16 пластин за каждое из трёх окон по 60 секунд.'),
 ('food_shift','Регулярное снабжение','minecraft:baked_potato','8 хлеба И 8 печёных картофелин за каждое из трёх окон по 60 секунд.'),
 ('rail_shift','Снабжение магистрали','create:track','32 рельса И 8 пластин за каждое из пяти окон по 60 секунд.'),
]
for i,(qid,title,icon,detail) in enumerate(contracts):
 put(D/(qid+'.json'),{'criteria':{'server_receipt':{'trigger':'minecraft:impossible'}},'rewards':{'experience':15}})
 quest('contract_'+qid,title,'03 · Контрольные поставки',[(i%4)*84-126,(i//4)*72-36],icon,{'receipt':{'type':'heracles:advancement','title':'Подтверждение серверной приёмки','advancements':['longhaul:contracts/'+qid]}},['Начало: /lh accept '+qid,detail,'Нужно реально передать товары в зарегистрированную бочку после принятия заказа. Наличие предметов в инвентаре не завершает этот квест.','Товары расходуются. Статус: /lh status. Награда: 15 опыта один раз; повторный вход не выдаёт её заново.','Условия и ограничения прототипа описаны в первой главе.'])
(O/'config/heracles/groups.txt').write_text('01 · Начало и правила\n02 · Мастерская и экспедиция\n03 · Контрольные поставки\n')
print('Generated 26 real Heracles quests + 8 server-only receipt advancements.')
