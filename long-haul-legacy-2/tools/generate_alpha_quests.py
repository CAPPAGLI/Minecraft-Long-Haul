#!/usr/bin/env python3
"""Generate real Heracles 1.20.1 quests + server-only receipt/progression advancements.
Clean non-overlapping tree/lane layouts across all 15 chapters (00..14):
- 14 mandatory/main chapters (00..12 + 14 DOOMED) + 1 optional Photo chapter (13)
- Chapter 00 holds 5 story nodes (Глава III moved to Chapter 01 alongside /lh terminal)
- Chapter 02 showcases every gameplay mod family including Hex Casting, Primal Magick, Thaumon,
  Immersive Engineering/Petroleum/Geology, PneumaticCraft, Valkyrien Skies/Eureka/Clockwork,
  Alex's Caves/Mobs, Cataclysm/Aquamirae, TaCZ, Tetra, Farmer's Delight/Vinery/Bees, etc.
"""
import json, pathlib

R = pathlib.Path(__file__).resolve().parents[1]
O = R / 'overrides'
Q = O / 'config/heracles/quests'
ADV_ROOT = O / 'kubejs/data/longhaul/advancements'
Q.mkdir(parents=True, exist_ok=True)


def put(p, obj):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n')


def adv(rel_path, xp=15):
    put(ADV_ROOT / (rel_path + '.json'), {
        'criteria': {'server_verified': {'trigger': 'minecraft:impossible'}},
        'rewards': {'experience': xp},
    })


def quest(qid, title, group, pos, icon, tasks, desc, deps=None, subtitle='Long Haul Legacy 2.0'):
    put(Q / (qid + '.json'), {
        'dependencies': deps or [],
        'tasks': tasks,
        'rewards': {},
        'display': {
            'title': {'text': title},
            'subtitle': {'text': subtitle},
            'description': desc,
            'groups': {group: {'position': pos}},
            'icon': {'type': 'heracles:item', 'item': {'id': icon, 'count': 1}},
            'icon_background': 'heracles:textures/gui/quest_backgrounds/default.png',
        },
        'settings': {
            'hidden': 'LOCKED',
            'showDependencyArrow': True,
            'individualProgress': True,
            'repeatable': False,
            'unlockNotification': True,
        },
    })


# Clean old quests/advancements first so deleted items don't linger
for old in Q.glob('*.json'):
    old.unlink()
if ADV_ROOT.exists():
    for old in ADV_ROOT.rglob('*.json'):
        old.unlink()

# ---------------------------------------------------------------------------
# 00 · Сюжет: Ушёл за хлебом (clean horizontal 5-step opening line; Глава III -> Ch.01)
# ---------------------------------------------------------------------------
story_ch00 = [
    ('story_01_left_for_bread', 'Глава I: Ушёл в магазин за хлебом', 'minecraft:bread', [-220, 0], [
        'Поздравляем — у вас родился сын! Жена попросила сходить в ближайшую лавку за свежей буханкой хлеба и бутылкой молока.',
        'Задача главы: выйти в мир (выдаётся автоматически при входе в мир; если не засчиталось — выполните /lh stage).',
    ], []),
    ('story_02_bakery_burned', 'Глава II: Пекарня сгорела — нужен свой хлеб', 'minecraft:wheat', [-110, 0], [
        'Ближайшая пекарня оказалась закрыта на переучёт, так что придётся раздобыть или испечь первую буханку хлеба самостоятельно.',
        'Задача: держите в инвентаре буханку хлеба (minecraft:bread) — сервер автоматически засчитает этап.',
    ], ['story_01_left_for_bread']),
    ('story_04_snail_at_door', 'Глава IV: Заодно и молоко', 'minecraft:milk_bucket', [0, 0], [
        'Пока вы решали вопрос с хлебом, вспомнили про вторую половину просьбы — ведро свежего молока.',
        'Задача: наберите ведро молока (minecraft:milk_bucket) в инвентарь (сервер зачтёт этап автоматически).',
    ], ['story_02_bakery_burned']),
    ('story_05_continental_bakery', 'Глава V: Первая штамповка для пекарни', 'create:mechanical_press', [110, 0], [
        'Чтобы открыть путь дальше в окрестности, пора перейти от ручной работы к первому механизму Create или стартовой поставке.',
        'Задача: скрафтите Механический пресс (create:mechanical_press) ИЛИ закройте контракт /lh accept plates (64 железные пластины).',
    ], ['story_04_snail_at_door']),
    ('story_06_forgot_the_milk', 'Эпилог пролога: Долгая дорога начинается', 'minecraft:compass', [220, 0], [
        'Хлеб и молоко собраны, базовый инструмент готов, а граница мира готова к первому крупному расширению!',
        'Задача: скрафтите Компас (minecraft:compass) и выполните /lh stage. Завершение Главы 00 расширяет территорию и запускает Колесо Угроз!',
    ], ['story_05_continental_bakery']),
]
for i, (qid, title, icon, pos, desc, deps) in enumerate(story_ch00):
    adv_name = 'story/' + qid[len('story_'):]
    adv(adv_name, 30 + i * 20)
    quest(qid, title, '00 · Сюжет: Ушёл за хлебом', pos, icon,
          {'story': {'type': 'heracles:advancement', 'title': 'Хроника «Ушёл за хлебом»', 'advancements': ['longhaul:' + adv_name]}},
          desc, deps=deps, subtitle='Long Haul Legacy 2.0 · Пролог')

# ---------------------------------------------------------------------------
# 01 · Начало и правила (3 clean horizontal lanes + Глава III terminal quest)
# ---------------------------------------------------------------------------
adv('story/03_dinner_telegram', 45)
adv('rules/confirmed', 25)

ch01_nodes = [
    # Root (left center)
    ('alpha_welcome', 'Прототип промышленной сети', 'minecraft:book', [-280, 0],
     {'read': {'type': 'heracles:check', 'title': 'Прочитано (ручное подтверждение)'}}, [
         'Это расширяемая сборка Long Haul Legacy 2.0: 8 экономических центров (реальные .nbt площадки), 6 объектов восстановления, лагеря, маршрутные испытания, ядерная энергетика, Draconic Evolution, магия (Primal Magick, Thaumon, Hex Casting) и 240 заказов каталога.',
         'Подтверждение чтения — ручное; в конце верхней/средней ветки подтвердите устав через /lh rules confirm.',
     ], ['story_01_left_for_bread']),

    # Top lane (y = -110): Terminal & Contracts Rules (includes moved Глава III!)
    ('alpha_terminal', 'Как зарегистрировать терминал', 'minecraft:barrel', [-168, -110],
     {'read': {'type': 'heracles:check', 'title': 'Правила терминала изучены'}}, [
         'Поставьте пустую обычную бочку. Встаньте на неё и выполните /lh terminal.',
         'Посмотрите /lh help (или ПКМ Планшетом управления), затем /lh accept plates. Заказ начнётся только при пустой бочке.',
         'Подводите товары воронкой или средствами Create. Принятые товары РАСХОДУЮТСЯ без возврата.',
     ], ['alpha_welcome']),
    ('story_03_dinner_telegram', 'Глава III: Обещал вернуться к ужину…', 'minecraft:barrel', [-56, -110],
     {'story': {'type': 'heracles:advancement', 'title': 'Регистрация терминала (/lh terminal)', 'advancements': ['longhaul:story/03_dinner_telegram']}}, [
         'Из дома пришла телеграмма: «Ты где? Хлеб можно уже не тёплый». Без собственного приёмного терминала заказы консорциума не оформить.',
         'Задача: поставьте пустую обычную бочку (minecraft:barrel), встаньте на неё и выполните /lh terminal (перенесено из Пролога в Главу 01).',
     ], ['alpha_terminal']),
    ('alpha_windows', 'Что измеряют испытания', 'minecraft:clock', [56, -110],
     {'read': {'type': 'heracles:check', 'title': 'Механика окон понята'}}, [
         'Контракты с суффиксом _shift считают норму в КАЖДОМ окне по 60 игровых секунд. Один полный сундук не завершает испытание мгновенно.',
         'Выгрузка чанка приостанавливает часы. Серверный прогресс сохраняется; /lh status показывает детали.',
         'При пропуске нормы испытание проваливается. /lh abort останавливает заказ; уже потреблённые товары не возвращаются.',
     ], ['story_03_dinner_telegram']),
    ('alpha_limits', 'Честные границы прототипа', 'minecraft:comparator', [168, -110],
     {'read': {'type': 'heracles:check', 'title': 'Ограничения приняты'}}, [
         'Шалкеры, эндер-сундуки, мешки, сейфы Supplementaries, джетпаки и дислокаторы/заклинания дальней телепортации отключены в крафте, луте и при взаимодействии.',
         'Выездные лагеря проверяют пустоту контейнеров перед сворачиванием.',
         'Для кооператива доступен общий консорциум: /lh team join <имя> или компании OpenTTD (/lh company create).',
     ], ['alpha_windows']),

    # Middle lane (y = 0): World, 14-Stage Territory, Difficulty k, Casino & Hazards
    ('alpha_world', 'Мир и региональные узлы', 'minecraft:compass', [-168, 0],
     {'read': {'type': 'heracles:check', 'title': 'Устройство мира изучено'}}, [
         'Natural Temperature и Cold Sweat отсутствуют — фермерство не заперто в климатических поясах. Мир построен на связке Tectonic (высота до Y=448), Terralith, Biomes O\' Plenty, Regions Unexplored и Alex\'s Caves.',
         'Полная граница обычного мира: 175000 блоков (центр 0,0), открывается постепенно по всем 14 основным главам! Все 8 центров, Архив и Узел консорциума размещены внутри ±84000.',
         'Посмотреть направления: /lh sites, /lh site info <id> и вкладку GUI «Узлы».',
     ], ['alpha_welcome']),
    ('alpha_territory_casino', 'Территория (14 этапов), k и Колесо Угроз', 'minecraft:nether_star', [-56, 0],
     {'read': {'type': 'heracles:check', 'title': 'Законы территории и угроз изучены'}}, [
         'Граница мира расширяется по вогнутой кривой через 14 основных глав (13 шагов расширения до 175000): Area(u) = 724² + (175000² - 724²) * (1 - (1 - u/13)²) — больше территории даётся в начале (+4530 км² на 1-м шаге) и всё меньше в конце (+181 км² на 13-м шаге) (/lh territory).',
         'Коэффициент сложности k = 1 + 95 * (D/n) / 63.15 зависит от суммарных смертей онлайн D и обратно пропорционален онлайну n без жёсткого капа (/lh difficulty).',
         'Завершение каждой главы крутит визуальное Колесо Угроз с 20 усложнениями (/lh casino status, /lh events).',
     ], ['alpha_world']),
    ('alpha_voidout', 'Выброс при смерти (Voidout), трупы и тотемы', 'minecraft:totem_of_undying', [56, 0],
     {'read': {'type': 'heracles:check', 'title': 'Протокол Voidout изучен'}}, [
         'Когда Колесо Угроз активирует Voidout, каждая настоящая смерть вызывает взрыв силой 1.0 × k (где k — общий коэффициент сложности без верхнего предела, см. /lh difficulty и /lh voidout status)!',
         'Ваш инвентарь сохраняется в трупе (Corpse; если не активно усложнение «Распад инвентаря»), а Тотем бессмертия спасает от детонации.',
     ], ['alpha_territory_casino']),
    ('alpha_toxic_gas_sky', 'Сезонный токсичный газ и летающие острова', 'minecraft:campfire', [168, 0],
     {'read': {'type': 'heracles:check', 'title': 'Правила укрытия в горах изучены'}}, [
         'Когда в Колесе выпадает токсичный газ, он поднимается и спадает циклами по 4 игровых дня (на пике достигая Y=114, затем снова отступая в Чистый сезон, /lh gas status).',
         'Ищите и обустраивайте временные базы в высоких горах Tectonic и на небесных островах (sky_refuges Y=210..260).',
     ], ['alpha_voidout']),

    # Bottom lane (y = +110): Tools, Eccentric Tome, Pollution & Magic Intro
    ('alpha_eccentric_tome', 'Единая книга гайдов (Eccentric Tome)', 'eccentrictome:tome', [-168, 110],
     {'read': {'type': 'heracles:check', 'title': 'Руководство Eccentric Tome прочитано'}}, [
         'Все книги и справочники из модов (Immersive Engineering, Alex\'s Caves, Primal Magick, Draconic, Patchouli, Hex Casting и др.) можно объединить в один том — Eccentric Tome.',
         'Положите Eccentric Tome и любые книги-гайды в крафт. ПКМ открывает выбор книги, Shift+ЛКМ возвращает обратно.',
     ], ['alpha_welcome']),
    ('alpha_control_tablet', 'Планшет управления (/lh GUI)', 'longhaul:control_tablet', [-56, 110],
     {'item': {'type': 'heracles:item', 'item': 'longhaul:control_tablet', 'amount': 1, 'collection': 'AUTOMATIC'}}, [
         'Планшет управления Long Haul (longhaul:control_tablet) открывает серверный графический интерфейс с 11 вкладками: Хаб, Контракты, Узлы, Восстановление, Грузы, Лагеря, OpenTTD, Карта 5×5, Биржа, События и Мир.',
         'Нажмите ПКМ с Планшетом в руке или введите /lh (или /lh gui) в чате.',
     ], ['alpha_eccentric_tome']),
    ('alpha_pollution_arcane', 'Экология среды и Три Школы Магии', 'minecraft:cauldron', [56, 110],
     {'read': {'type': 'heracles:check', 'title': 'Введение в экологию и аркану пройдено'}}, [
         'Pollution of the Realms создаёт выбросы дыма и пыли от печей, дизелей и взрывов — отводите их через трубы и фильтры Advanced Chimneys.',
         'В сборке действуют 3 совместимые магические ветки (ветка 4 в Главе 02): Primal Magick (первородные эссенции), Thaumon (аура и тигли) и Hex Casting (стековая программируемая магия на аметисте).',
     ], ['alpha_control_tablet']),

    # Right hub convergence
    ('alpha_rules_confirm', 'Подтвердить устав консорциума', 'minecraft:writable_book', [280, -55],
     {'confirmed': {'type': 'heracles:advancement', 'title': 'Подтверждение (/lh rules confirm)', 'advancements': ['longhaul:rules/confirmed']}}, [
         'Прочитайте основные правила, зарегистрируйте бочку (/lh terminal) и выполните команду /lh rules confirm.',
         'Эта веха завершает Главу 01, расширяет границу мира и запускает Колесо Угроз.',
     ], ['alpha_limits', 'alpha_territory_casino']),
]
for qid, title, icon, pos, tasks, desc, deps in ch01_nodes:
    quest(qid, title, '01 · Начало и правила', pos, icon, tasks, desc, deps=deps)

# ---------------------------------------------------------------------------
# 02 · Мастерская и экспедиция (4 clean horizontal lanes x 6 nodes = full modpack coverage)
# ---------------------------------------------------------------------------
ch02_nodes = [
    # Lane 1 (y = -180): Create & Heavy Industry
    ('tutorial_waterwheel', '1.1 · Кинетика Create', 'create:water_wheel', [-300, -180],
     {'item': {'type': 'heracles:item', 'item': 'create:water_wheel', 'amount': 1, 'collection': 'AUTOMATIC'}}, [
         'Водяное колесо и ветряк (Create) — основа механической мастерской. Подключите Create Addition для преобразования вращения в энергию (FE) и обратно.',
         'В этой ветке изучите Create 6.0.8 и тяжёлую индустрию сборки.',
     ], ['story_02_bakery_burned']),
    ('tutorial_press', '1.2 · Штамповка и металлургия', 'create:mechanical_press', [-180, -180],
     {'item': {'type': 'heracles:item', 'item': 'create:mechanical_press', 'amount': 1, 'collection': 'AUTOMATIC'}}, [
         'Механический пресс штампует пластины; вместе с Create Metallurgy, Create Sifting и Mechanical Extruder он открывает литьё сплавов и переработку пород.',
     ], ['tutorial_waterwheel']),
    ('tutorial_mixer', '1.3 · Сплавы, бурение и топливо', 'create:mechanical_mixer', [-60, -180],
     {'item': {'type': 'heracles:item', 'item': 'create:mechanical_mixer', 'amount': 1, 'collection': 'AUTOMATIC'}}, [
         'Миксер и горелки (включая Create Low-Heated) варят сплавы и реагенты. Create Ore Excavation добывает глубокие жилы, а Diesel Generators, Liquid Fuel и New Age питают тяжёлые цеха.',
     ], ['tutorial_press']),
    ('tutorial_brass', '1.4 · Латунная логистика и хранилища', 'create:brass_ingot', [60, -180],
     {'item': {'type': 'heracles:item', 'item': 'create:brass_ingot', 'amount': 1, 'collection': 'AUTOMATIC'}}, [
         'Латунь открывает умные фильтры, Create Factory Logistics, Vibrant Vaults, Create Encased и мобильные посылки (Mobile Packages), а Functional Storage, Iron Chests/Barrels держат стационарные склады.',
     ], ['tutorial_mixer']),
    ('tutorial_precision', '1.5 · Точные механизмы и оптика', 'create:precision_mechanism', [180, -180],
     {'item': {'type': 'heracles:item', 'item': 'create:precision_mechanism', 'amount': 1, 'collection': 'AUTOMATIC'}}, [
         'Точный механизм — ключ к Create Optical, Enchantment Industry, Create Big Cannons, Create Radars, Pattern Schematics и Stuff & Additions (джетпаки отключены).',
     ], ['tutorial_brass']),
    ('mod_heavy_industry', '1.6 · Тяжёлая индустрия и логистические сети', 'immersiveengineering:dynamo', [300, -180],
     {'check': {'type': 'heracles:check', 'title': 'Изучены многоблочные заводы и роутинг'}}, [
         'Поздняя индустрия объединяет Immersive Engineering, Petroleum и Immersive Geology (многоблочные прессы, буровые вышки, переработка нефти и руд), PneumaticCraft: Repressurized (давление, трубы, дроны) и Advanced Chimneys для отвода смога.',
         'Для сложной автоматизации цехов доступны Integrated Dynamics, Super Factory Manager (SFM) и Modular Routers.',
     ], ['tutorial_precision']),

    # Lane 2 (y = -60): Rail, Road, Sea, Air Transport & CC Automation
    ('tutorial_track', '2.1 · Магистральные рельсы и Railcraft', 'create:track', [-300, -60],
     {'item': {'type': 'heracles:item', 'item': 'create:track', 'amount': 1, 'collection': 'AUTOMATIC'}}, [
         'Железнодорожные пути Create дополнены Railcraft Reborn (сигнализация, котлы, составы), More Minecarts, Hypertube и декоративными мостами/конструкциями Copycats+, Deco и Bells & Whistles.',
         'Инвентарное задание не доказывает наличие дороги — реальные испытания маршрутов начинаются в Главе 05.',
     ], ['tutorial_waterwheel']),
    ('tutorial_station', '2.2 · Станции, навигатор и малая логистика', 'create:track_station', [-180, -60],
     {'item': {'type': 'heracles:item', 'item': 'create:track_station', 'amount': 1, 'collection': 'AUTOMATIC'}}, [
         'Станции Create, Create Railways Navigator (табло и маршруты), Escalated (эскалаторы) и Little Logistics (буксиры и тележки) образуют опорную сеть грузоперевозок.',
     ], ['tutorial_track']),
    ('mod_road_vehicles', '2.3 · Дорожный транспорт и повозки', 'minecraft:minecart', [-60, -60],
     {'check': {'type': 'heracles:check', 'title': 'Освоен наземный транспорт'}}, [
         'Для безрельсовых дорог и грунтовых экспедиций используйте AstikorCarts Redux (грузовые повозки на тяге), Automobility (модульные багги) и Ultimate Car Mod (автомобили, заправки и дороги).',
     ], ['tutorial_station']),
    ('mod_ships_vs', '2.4 · Флот и физика Valkyrien Skies', 'minecraft:oak_boat', [60, -60],
     {'check': {'type': 'heracles:check', 'title': 'Освоены корабли и физические конструкции'}}, [
         'Морские и речные линии: Small Ships (когги, галеры, драккары с трюмами) и физический движок Valkyrien Skies с аддонами Eureka! Ships, Create: Clockwork и Trackwork (подвижные суда, дирижабли и гусеничная техника).',
     ], ['mod_road_vehicles']),
    ('mod_airships', '2.5 · Авиация и паркур (без джетпаков)', 'minecraft:elytra', [180, -60],
     {'check': {'type': 'heracles:check', 'title': 'Освоены самолёты и мобильность'}}, [
         'Покоряйте небо на бипланах, гирокоптерах и дирижаблях из Immersive Aircraft и Man of Many Planes. На земле помогут ParCool! (паркур), Grappling Hook и Combat Roll.',
         'Напоминание: джетпаки и телепортеры заблокированы — воздух принадлежит честной авиации и физическим кораблям.',
     ], ['mod_ships_vs']),
    ('tutorial_computer', '2.6 · Вычислительная автоматизация (CC)', 'computercraft:computer_normal', [300, -60],
     {'item': {'type': 'heracles:item', 'item': 'computercraft:computer_normal', 'amount': 1, 'collection': 'AUTOMATIC'}}, [
         'CC: Tweaked, CC:C Bridge и Tom\'s Peripherals связывают поезда Create, станции и склады в единую телеметрию.',
         'На экономических узлах программа longhaul_depot проверяет реальные запасы бочек (Глава 06).',
     ], ['tutorial_precision']),

    # Lane 3 (y = +60): Food, Biomes, Caves/Bosses, Gear & Architecture
    ('tutorial_cookpot', '3.1 · Полевая кухня и рыболовство', 'farmersdelight:cooking_pot', [-300, 60],
     {'item': {'type': 'heracles:item', 'item': 'farmersdelight:cooking_pot', 'amount': 1, 'collection': 'AUTOMATIC'}}, [
         'Farmer\'s Delight и 12 тематических аддонов (Cultural, Miner\'s, Rustic, Corn, Crabber\'s, Fruit\'s, Nether\'s, Ocean\'s, End\'s, Chef\'s, Butcher\'s, Delightful, Collector\'s Reap, Ube\'s, Casualness, Pineapple) открывают сотни блюд без температурных запретов.',
         'Система Diet вознаграждает сбалансированное питание, Culinary Construct собирает сэндвичи, а Aquaculture 2 расширяет рыбалку.',
     ], ['story_02_bakery_burned']),
    ('mod_brewing_bees', '3.2 · Виноделие, чаи, сады и пчеловодство', 'minecraft:honeycomb', [-180, 60],
     {'check': {'type': 'heracles:check', 'title': 'Изучены ферментация и пасеки'}}, [
         'Освойте бочонки Brewin\' And Chewin\', виноградники [Let\'s Do] Vinery, чайные настои HerbalBrews, плодовые деревья Fruit Trees и промышленное пчеловодство Productive Bees (плюс Create Confectionery для сладостей).',
     ], ['tutorial_cookpot']),
    ('mod_world_biomes', '3.3 · Биомы, компасы и картография', 'minecraft:filled_map', [-60, 60],
     {'check': {'type': 'heracles:check', 'title': 'Подготовлена разведка биомов'}}, [
         'Континент сформирован модами Tectonic, Terralith, Biomes O\' Plenty, Regions Unexplored, Atmospheric, Autumnity, Environmental, Ecologics и Upgrade Aquatic (а также Snowy Spirit и Immersive Weathering).',
         'Для навигации без телепортов скрафтите Nature\'s Compass, Explorer\'s Compass и Map Atlases; дальние виды рисует Distant Horizons.',
     ], ['mod_brewing_bees']),
    ('mod_caves_bosses', '3.4 · Пещеры, данжи, фауна и боссы', 'minecraft:spyglass', [60, 60],
     {'check': {'type': 'heracles:check', 'title': 'Изучены пещеры и боссы мира'}}, [
         'Под землёй вас ждут Alex\'s Caves и YUNG\'s Cave Biomes; на поверхности и в данжах — Alex\'s Mobs, Naturalist, YUNG\'s Better Structures, When Dungeons Arise, IDAS, Structory, Towns & Towers, Moog\'s Structures, Better Archeology и Bountiful.',
         'Боссы и элитные враги: L_Ender\'s Cataclysm, Aquamirae, Mowzie\'s Mobs, Mutant Monsters, Illager Invasion, Nyf\'s Spiders и Smart Mobs. Лут в сундуках персональный благодаря Lootr!',
     ], ['mod_world_biomes']),
    ('mod_gear_combat', '3.5 · Вооружение: Tetra, TaCZ и зачарования', 'minecraft:anvil', [180, 60],
     {'check': {'type': 'heracles:check', 'title': 'Изучены модульное оружие и огнестрел'}}, [
         'Собирайте модульные инструменты в верстаке Tetra (+ Tetra Extras), уникальные клинки Simply Swords, комплекты Immersive Armors и современное огнестрельное оружие Timeless and Classics Zero (TaCZ).',
         'Магическая и кузнечная обработка упрощена через Easy Anvils, Easy Magic, Enchanting Infuser, а наёмники Villager Recruits и Guard Villagers помогут в обороне.',
     ], ['mod_caves_bosses']),
    ('mod_architecture', '3.6 · Архитектура, декор и быт баз', 'minecraft:bricks', [300, 60],
     {'check': {'type': 'heracles:check', 'title': 'Изучены строительные и QoL-моды'}}, [
         'Стройте монументальные станции и базы с FramedBlocks, Chipped, Rechiseled (+ Create), Quark, Supplementaries, Amendments, Macaw\'s Suite (мосты, крыши, двери, окна, пути), Another Furniture, Handcrafted, Sully\'s Mod и Effortless Building.',
         'Для отдыха на базе доступны Ultimate Chess (шахматы и шашки), Trading Post, Extreme Sound Muffler и Walkie-Talkie / Simple Voice Chat.',
     ], ['mod_gear_combat']),

    # Lane 4 (y = +180): Arcane Sciences (Primal Magick, Thaumon, Hex Casting)
    ('arcane_01_intro', '4.1 · Истоки арканы: аметист и кристаллы', 'minecraft:amethyst_shard', [-300, 180],
     {'item': {'type': 'heracles:item', 'item': 'minecraft:amethyst_shard', 'amount': 1, 'collection': 'AUTOMATIC'}}, [
         'Тайные науки сборки представлены тремя модами: Primal Magick, Thaumon и Hex Casting. Все справочники легко сшить в Eccentric Tome.',
         'Задача: добудьте первый осколок аметиста (minecraft:amethyst_shard) — он служит базовым медиа для Hex Casting и источником кристаллов.',
     ], ['alpha_pollution_arcane']),
    ('arcane_02_primal_magick', '4.2 · Primal Magick: алтари и теория', 'minecraft:enchanting_table', [-180, 180],
     {'check': {'type': 'heracles:check', 'title': 'Освоены основы Primal Magick'}}, [
         'Primal Magick продолжает идеи Thaumcraft: сканируйте мир через Анализатор (Analysis Table), изучайте теории за Research Table и заряжайте жезлы эссенциями Земли, Моря, Неба, Солнца и Луны.',
         'Ветка открывает ритуальные алтари, рунную ковку, эссенциальную алхимию и продвинутое снаряжение.',
     ], ['arcane_01_intro']),
    ('arcane_03_thaumon', '4.3 · Thaumon: аура, порча и алхимия', 'minecraft:cauldron', [-60, 180],
     {'check': {'type': 'heracles:check', 'title': 'Изучены механики Thaumon'}}, [
         'Thaumon добавляет тауматургические блоки, кристальные кластеры, порчу ауры и классическую алхимическую эстетику, отлично сочетающуюся с Primal Magick и промышленными цехами.',
     ], ['arcane_02_primal_magick']),
    ('arcane_04_hex_casting', '4.4 · Hex Casting: посох и стековая магия', 'minecraft:amethyst_cluster', [60, 180],
     {'check': {'type': 'heracles:check', 'title': 'Скрафчен посох и изучен фолиант Hex Casting'}}, [
         'Hex Casting — программируемая стековая магия (наследница Psi): скрафтите Посох (Staff) и справочник The Hexonomicon (Patchouli), рисуйте 2D-гексагональные паттерны в воздухе и расходуйте аметистовую пыль/кристаллы (Media).',
         'Вы можете программировать векторные толчки, проходку туннелей, точный крафт, сортировку и защитные заклинания, записывая готовые программы на Свитки (Scrolls), Фокусы (Focus) и Книги заклинаний.',
     ], ['arcane_01_intro']),
    ('arcane_05_hex_automation', '4.5 · Hex Casting: круги заклинаний и шифры', 'minecraft:observer', [180, 180],
     {'check': {'type': 'heracles:check', 'title': 'Освоены круги заклинаний Hex Casting'}}, [
         'Постройте стационарный Круг заклинаний (Spell Circle из Impetus и Slate) или заряжаемый Тринкат/Артефакт для автоматической обработки ресурсов, освещения шахт и обороны цехов.',
         'Правило логистики Long Haul: дальняя телепортация (включая Greater Teleport) запрещена уставом консорциума — магистральные грузы всегда возятся транспортом.',
     ], ['arcane_04_hex_casting']),
    ('arcane_06_synthesis', '4.6 · Магико-индустриальный синтез', 'minecraft:nether_star', [300, 180],
     {'check': {'type': 'heracles:check', 'title': 'Магические ветки объединены с индустрией'}}, [
         'Объедините заклинательные круги Hex Casting, алтари Primal Magick и кристаллы Thaumon с автоматикой Create и CC: Tweaked для поддержки далёких экспедиций и ядерной программы.',
     ], ['arcane_03_thaumon', 'arcane_05_hex_automation']),
]
for qid, title, icon, pos, tasks, desc, deps in ch02_nodes:
    quest(qid, title, '02 · Мастерская и экспедиция', pos, icon, tasks, desc, deps=deps)

# ---------------------------------------------------------------------------
# 03 · Контрольные поставки (clean 4-branch left-to-right contract layout)
# ---------------------------------------------------------------------------
contracts = [
    ('plates', 'Первая партия пластин', 'create:iron_sheet', [-180, -40], '64 железные пластины.', ['alpha_terminal', 'tutorial_press']),
    ('plate_shift', 'Ритм поставки пластин', 'create:iron_sheet', [-60, -130], '16 пластин за каждое из трёх окон по 60 секунд.', ['contract_plates']),
    ('brass', 'Латунный заказ', 'create:brass_ingot', [-60, -40], '32 латунных слитка.', ['contract_plates', 'tutorial_brass']),
    ('mechanisms', 'Приборы для депо', 'create:precision_mechanism', [60, -40], '8 точных механизмов.', ['contract_brass', 'tutorial_precision']),
    ('rails', 'Снабжение путейцев', 'create:track', [-60, 40], '128 рельсов Create.', ['contract_plates', 'tutorial_track']),
    ('rail_shift', 'Снабжение магистрали', 'create:track', [60, 40], '32 рельса И 8 пластин за каждое из пяти окон по 60 секунд.', ['contract_rails']),
    ('provisions', 'Продовольственный склад', 'minecraft:bread', [-180, 130], '32 хлеба И 32 печёные картофелины.', ['alpha_terminal', 'tutorial_cookpot']),
    ('food_shift', 'Регулярное снабжение', 'minecraft:baked_potato', [-60, 130], '8 хлеба И 8 печёных картофелин за каждое из трёх окон по 60 секунд.', ['contract_provisions']),
]
for qid, title, icon, pos, detail, deps in contracts:
    adv('contracts/' + qid, 15)
    quest('contract_' + qid, title, '03 · Контрольные поставки', pos, icon,
          {'receipt': {'type': 'heracles:advancement', 'title': 'Подтверждение серверной приёмки', 'advancements': ['longhaul:contracts/' + qid]}},
          ['Начало: /lh accept ' + qid, detail, 'Нужно реально передать товары в зарегистрированную бочку после принятия заказа. Наличие предметов в инвентаре не завершает этот квест.', 'Товары расходуются. Статус: /lh status.'],
          deps=deps)

# ---------------------------------------------------------------------------
# 04 · Экономические центры (clean 8-column Production Tier DAG left-to-right)
# ---------------------------------------------------------------------------
sites = [
    # Tier 1
    ('forest', 'Лесная артель', 'longhaul:treated_timber', 'Пропитанная древесина', -120, ['contract_rails', 'logistics_three_camps']),
    ('farm', 'Речной агрогород', 'longhaul:field_rations', 'Экспедиционные рационы', 0, ['contract_provisions', 'logistics_three_camps']),
    ('mine', 'Горный рудник', 'longhaul:ore_concentrate', 'Рудный концентрат', 120, ['contract_rails', 'logistics_first_route']),
    # Tier 2
    ('port', 'Морской порт', 'longhaul:marine_reagent', 'Морской реагент', -60, ['prod_forest', 'prod_farm']),
    ('badlands', 'Карьер пустошей', 'longhaul:refractory_mix', 'Огнеупорная смесь', 120, ['prod_mine']),
    # Tier 3
    ('wetland', 'Химический посёлок', 'longhaul:technical_oil', 'Техническое масло', -60, ['prod_port', 'prod_badlands']),
    ('smelter', 'Стекольная долина', 'longhaul:technical_glass', 'Техническое стекло', 60, ['prod_mine', 'prod_badlands']),
    # Tier 4
    ('machine', 'Машиностроительный центр', 'longhaul:machine_parts', 'Прецизионные узлы', 0, ['prod_smelter', 'prod_wetland']),
]
tier_x = {
    'forest': (-380, -270),
    'farm': (-380, -270),
    'mine': (-380, -270),
    'port': (-140, -30),
    'badlands': (-140, -30),
    'wetland': (100, 210),
    'smelter': (100, 210),
    'machine': (340, 450),
}
for sid, title, prod, prod_name, y_pos, sdeps in sites:
    sx, px = tier_x[sid]
    adv('sites/' + sid, 20)
    adv('production/' + sid, 30)
    quest('site_' + sid, title + ': ввод в строй', '04 · Экономические центры', [sx, y_pos],
          'minecraft:barrel',
          {'commission': {'type': 'heracles:advancement', 'title': 'Регистрация площадки на месте', 'advancements': ['longhaul:sites/' + sid]}},
          ['Найдите площадку через /lh sites и /lh site info ' + sid + '.', 'Встаньте НА бочку в радиусе 128 м от координат узла и выполните /lh site commission ' + sid + '.'],
          deps=sdeps)
    quest('prod_' + sid, title + ': ' + prod_name, '04 · Экономические центры', [px, y_pos],
          prod,
          {'produce': {'type': 'heracles:advancement', 'title': 'Местный выпуск продукции', 'advancements': ['longhaul:production/' + sid]}},
          ['Выпустите партию ' + prod_name + ' непосредственно на площадке: /lh site produce ' + sid + ' bootstrap (или industrial).', 'Удалённое производство на домашней базе заблокировано сервером.'],
          deps=['site_' + sid])

adv('sites/continental_archive', 50)
quest('site_continental_archive', 'Центральный архив магистралей', '04 · Экономические центры', [570, -60], 'minecraft:writable_book',
      {'archive': {'type': 'heracles:advancement', 'title': 'Однократная фиксация уникального объекта', 'advancements': ['longhaul:sites/continental_archive']}},
      ['Экспедиция к уникальному архиву (/lh site info continental_archive).', 'Подойдите ближе 96 м и выполните /lh site archive. Для ремонта конструкции: /lh site repair_archive (повторные награды не выдаются).'],
      deps=['prod_machine'])

adv('sites/continental_hub', 40)
adv('production/continental_hub', 100)
quest('site_continental_hub', 'Континентальный узел консорциума', '04 · Экономические центры', [570, 60], 'longhaul:continental_module',
      {'hub': {'type': 'heracles:advancement', 'title': 'Запуск финального узла', 'advancements': ['longhaul:production/continental_hub']}},
      ['Зарегистрируйте Континентальный узел (/lh site commission continental_hub) и соберите Континентальный модуль из продукции всех 8 центров (/lh site produce continental_hub industrial).'],
      deps=['prod_machine', 'site_continental_archive'])

# ---------------------------------------------------------------------------
# 05 · Маршруты и лагеря (clean 2-lane left-to-right layout)
# ---------------------------------------------------------------------------
logistics = [
    ('expedition/first_camp', 'Первый полевой лагерь', 'minecraft:campfire', [-110, -55],
     ['Отойдите минимум на 750 м от (0,0) (откроется уже после первого расширения границы), поставьте костёр и спальник Comforts (<= 6 м) и выполните /lh camp deploy.'],
     ['tutorial_cookpot', 'contract_provisions']),
    ('expedition/three_camps', 'Сеть из трёх лагерей', 'comforts:sleeping_bag_red', [110, -55],
     ['Разверните 3 активных полевых лагеря на расстоянии >= 500 м друг от друга.'],
     ['logistics_first_camp']),
    ('routes/first_route', 'Испытание маршрута', 'minecraft:rail', [-110, 55],
     ['Разметьте маршрут длиной >= 750 м: /lh route begin <имя>, добавьте контрольные точки (/lh route gate), завершите (/lh route finish) и пройдите на транспорте (/lh route start <имя>).', 'Аномальная скорость (> 85 м/с, телепорт) отменяет испытание.'],
     ['tutorial_station', 'contract_rails']),
    ('routes/cargo_delivery', 'Серверная грузовая накладная', 'longhaul:cargo_manifest', [110, 55],
     ['Получите накладную на одном узле (/lh cargo issue <откуда> <куда>), физически доставьте её в целевой узел и сдайте (/lh cargo deliver).'],
     ['site_forest', 'logistics_first_route']),
]
for adv_id, title, icon, pos, desc, deps in logistics:
    adv(adv_id, 25)
    qid = 'logistics_' + adv_id.split('/')[-1]
    quest(qid, title, '05 · Маршруты и лагеря', pos, icon,
          {'verified': {'type': 'heracles:advancement', 'title': 'Серверное подтверждение', 'advancements': ['longhaul:' + adv_id]}},
          desc, deps=deps)

# ---------------------------------------------------------------------------
# 06 · Восстановление и телеметрия (2x3 Recovery top + 2x4 CC Telemetry bottom)
# ---------------------------------------------------------------------------
recoveries = [
    ('sawmill', 'Восстановление лесопилки', 'create:mechanical_saw', [-140, -140], 'Подайте 16 железа, 16 андезитового сплава, 32 бревна и установите пилу/водяное колесо.', ['site_forest']),
    ('quarry', 'Карьер с повреждённым подъездом', 'create:mechanical_drill', [0, -140], 'Подайте 24 пластины, 32 рельса, 64 булыжника и смонтируйте бур/дробилку/станцию.', ['site_mine']),
    ('river_port', 'Восстановление речного порта', 'create:portable_storage_interface', [140, -140], 'Подайте 64 доски, 16 железа, 2 интерфейса и смонтируйте перегрузочный узел.', ['site_port']),
    ('sorting_yard', 'Сортировочная станция', 'create:brass_funnel', [-140, -55], 'Подайте 64 рельса, 16 латуни, 8 лент и смонтируйте станцию/сортировку.', ['site_badlands']),
    ('power_plant', 'Восстановление энергоузла', 'create:steam_engine', [0, -55], 'Подайте 32 меди, 16 латуни, 48 угля и установите паровую/генераторную установку.', ['site_smelter']),
    ('collapsed_bridge', 'Магистральный мост', 'create:metal_girder', [140, -55], 'Подайте 24 балки, 48 рельсов, 64 каменного кирпича и восстановите рельсовый переход.', ['site_machine']),
]
for rid, title, icon, pos, detail, rdeps in recoveries:
    adv('recovery/' + rid, 40)
    quest('recovery_' + rid, title, '06 · Восстановление и телеметрия', pos, icon,
          {'restored': {'type': 'heracles:advancement', 'title': 'Серверное восстановление объекта', 'advancements': ['longhaul:recovery/' + rid]}},
          ['Обследуйте объект (/lh recovery list, /lh recovery survey ' + rid + ').', detail, 'Встаньте на ремонтную бочку и выполните /lh recovery restore ' + rid + '.'],
          deps=rdeps)

cc_sites = [
    ('forest', 'Телеметрия склада: Лесная артель', [-210, 55]),
    ('farm', 'Телеметрия склада: Агрогород', [-70, 55]),
    ('mine', 'Телеметрия склада: Рудник', [70, 55]),
    ('port', 'Телеметрия склада: Порт', [210, 55]),
    ('badlands', 'Телеметрия склада: Карьер', [-210, 140]),
    ('smelter', 'Телеметрия склада: Стекольная долина', [-70, 140]),
    ('wetland', 'Телеметрия склада: Химпосёлок', [70, 140]),
    ('machine', 'Телеметрия склада: Машцентр', [210, 140]),
]
for sid, title, pos in cc_sites:
    adv('cc/' + sid, 25)
    quest('cc_' + sid, title, '06 · Восстановление и телеметрия', pos, 'computercraft:computer_normal',
          {'telemetry': {'type': 'heracles:advancement', 'title': 'Подтверждение телеметрии и запаса', 'advancements': ['longhaul:cc/' + sid]}},
          ['Запустите /lh cc challenge ' + sid + ', установите компьютер CC: Tweaked в 12 м от бочки узла и обеспечьте реальный запас продукции в бочке, затем /lh cc verify ' + sid + '.'],
          deps=['site_' + sid, 'tutorial_computer'])

# ---------------------------------------------------------------------------
# 07..10 · Full 240-spec catalog with clean non-crossing serpentine / row layouts
# ---------------------------------------------------------------------------
CHAPTER_GROUPS = {
    'Основная прогрессия': '07 · Кампания: Основная прогрессия',
    'Региональные контракты': '08 · Кампания: Региональные контракты',
    'Инженерные испытания': '09 · Кампания: Инженерные испытания',
    'Экспедиционная документация': '13 · Фотодокументация (Опционально)',
    'Лагеря и экспедиции': '10 · Кампания: Лагеря и экспедиции',
}

TYPE_ICONS = {
    'photo_evidence': 'exposure:photograph',
    'route_trial': 'minecraft:rail',
    'controlled_production': 'create:mechanical_press',
    'vehicle_delivery': 'create:track',
    'delivery': 'minecraft:barrel',
    'multi_input_supply': 'create:brass_funnel',
    'site_commission': 'minecraft:compass',
    'network_supply': 'longhaul:cargo_manifest',
    'scheduled_supply': 'minecraft:clock',
    'scheduled_train': 'create:schedule',
    'computer_challenge': 'computercraft:computer_normal',
    'depot_commission': 'create:item_vault',
    'site_visit': 'minecraft:lantern',
    'camp_visit': 'minecraft:campfire',
    'vehicle_trial': 'create:track_station',
    'unique_site_visit': 'minecraft:writable_book',
    'kit_check': 'minecraft:compass',
    'ration_delivery': 'longhaul:field_rations',
    'sample_return': 'longhaul:ore_concentrate',
}

UNTRACKED_VEHICLE_TYPES = {'vehicle_delivery', 'scheduled_train', 'vehicle_trial'}

catalog = json.loads((R / 'design/quest-catalog.json').read_text())['quests']
catalog_ids = {q['id'] for q in catalog}

REGION_ROW_ORDER = ['forest', 'farm', 'mine', 'port', 'badlands', 'smelter', 'wetland', 'machine']
ENG_ROW_ORDER = ['throughput', 'train', 'road', 'water', 'air', 'supply', 'cc', 'repair']
EXPEDITION_NON_PHOTO = [
    q['id'] for q in catalog
    if q['id'].startswith('expedition_') and q['verification_type'] != 'photo_evidence'
]
EXPEDITION_PHOTO = [
    q['id'] for q in catalog
    if q['id'].startswith('expedition_') and q['verification_type'] == 'photo_evidence'
]
PHOTO_SITE_ROWS = ['forest', 'farm', 'mine', 'port', 'badlands', 'smelter', 'wetland', 'machine', 'continental_archive']


def catalog_deps(q):
    qid = q['id']
    if qid.startswith('main_'):
        parts = qid.split('_')
        stg, num = int(parts[1]), int(parts[2])
        if num > 1:
            return [f'cat_main_{stg}_{num-1:02d}']
        if stg > 1:
            return [f'cat_main_{stg-1}_08']
        return ['contract_plates']
    if qid.startswith('region_'):
        parts = qid.split('_')
        site, num = '_'.join(parts[1:-1]), int(parts[-1])
        if num > 1:
            return [f'cat_region_{site}_{num-1:02d}']
        return ['site_' + site]
    if qid.startswith('engineering_'):
        parts = qid.split('_')
        sub, num = '_'.join(parts[1:-1]), int(parts[-1])
        if num > 1:
            return [f'cat_engineering_{sub}_{num-1:02d}']
        return ['tutorial_precision']
    if qid.startswith('photo_'):
        parts = qid.split('_')
        site, phase = '_'.join(parts[1:-1]), parts[-1]
        order = ['arrival', 'before', 'after', 'route']
        if phase in order:
            idx = order.index(phase)
            if idx > 0:
                prev_id = f'photo_{site}_{order[idx-1]}'
                if prev_id in catalog_ids:
                    return ['cat_' + prev_id]
        return ['photo_' + site]
    if qid.startswith('expedition_'):
        num = int(qid.split('_')[1])
        if q['verification_type'] == 'photo_evidence':
            prev = num - 1
            return ['tutorial_camera', f'cat_expedition_{prev:02d}'] if prev >= 1 else ['tutorial_camera']
        prev = num - 1
        while prev >= 1:
            prev_q = next((x for x in catalog if x['id'] == f'expedition_{prev:02d}'), None)
            if not prev_q or prev_q['verification_type'] != 'photo_evidence':
                return [f'cat_expedition_{prev:02d}']
            prev -= 1
        return ['logistics_first_camp']
    return []


def catalog_pos(q):
    qid = q['id']
    # 07 · Main progression: 4 serpentine rows of 8 (no crossing arrows)
    if qid.startswith('main_'):
        parts = qid.split('_')
        row = int(parts[1]) - 1
        col = int(parts[2]) - 1
        if row % 2 == 1:
            col = 7 - col
        return [round((col - 3.5) * 92), round((row - 1.5) * 92)]

    # 08 · Regional contracts: 8 clean horizontal rows (1 per site, 12 steps L->R)
    if qid.startswith('region_'):
        parts = qid.split('_')
        site, num = '_'.join(parts[1:-1]), int(parts[-1])
        row = REGION_ROW_ORDER.index(site)
        col = num - 1
        return [round((col - 5.5) * 86), round((row - 3.5) * 86)]

    # 09 · Engineering trials: 8 clean horizontal rows (1 per discipline, 8 steps L->R)
    if qid.startswith('engineering_'):
        parts = qid.split('_')
        sub, num = '_'.join(parts[1:-1]), int(parts[-1])
        row = ENG_ROW_ORDER.index(sub)
        col = num - 1
        return [round((col - 3.5) * 92), round((row - 3.5) * 86)]

    # 10 · Camps & expeditions: 2 clean serpentine rows (7 + 6)
    if qid.startswith('expedition_') and q['verification_type'] != 'photo_evidence':
        idx = EXPEDITION_NON_PHOTO.index(qid)
        if idx < 7:
            return [(idx - 3) * 94, -50]
        rev = 6 - (idx - 7)
        return [(rev - 3) * 94, 50]

    # 13 · Optional photo documentation: expedition photo row + 9 aligned site rows
    if qid.startswith('expedition_') and q['verification_type'] == 'photo_evidence':
        idx = EXPEDITION_PHOTO.index(qid)
        return [(idx - 1) * 100, -150]

    if qid.startswith('photo_'):
        parts = qid.split('_')
        site, phase = '_'.join(parts[1:-1]), parts[-1]
        row = PHOTO_SITE_ROWS.index(site)
        phase_col = {'arrival': 1, 'before': 2, 'after': 3, 'route': 4}[phase]
        return [(phase_col - 2) * 100, -50 + row * 78]

    return [0, 0]


compact_catalog = []
for q in catalog:
    qid = q['id']
    vt = q['verification_type']
    grp = '13 · Фотодокументация (Опционально)' if vt == 'photo_evidence' else CHAPTER_GROUPS[q['chapter']]
    icon = TYPE_ICONS.get(vt, 'minecraft:paper')
    adv('catalog/' + qid, 20 + q['stage'] * 5)

    desc = [
        f"Этап {q['stage']} · Тип: {vt}" + (' (опционально)' if q.get('optional') else ' (основной заказ)'),
        f"Условия каталога: {json.dumps(q['conditions'], ensure_ascii=False)}",
        f"Проверка сервером: /lh catalog verify {qid} (сведения: /lh catalog info {qid}).",
    ]
    if vt in UNTRACKED_VEHICLE_TYPES:
        desc.append('Честное ограничение: физический трекер train/VS ID ещё не подключён; сервер проверяет маршрут/доставку контрольной партии в бочке на месте без фиктивного трекинга транспорта.')

    quest(
        'cat_' + qid,
        q['title'],
        grp,
        catalog_pos(q),
        icon,
        {'catalog_verified': {'type': 'heracles:advancement', 'title': 'Серверная проверка заказа', 'advancements': ['longhaul:catalog/' + qid]}},
        desc,
        deps=catalog_deps(q),
        subtitle=f"Этап {q['stage']} · {q['chapter']}",
    )
    compact_catalog.append({
        'id': qid,
        'title': q['title'],
        'chapter': q['chapter'],
        'verification_type': vt,
        'stage': q['stage'],
        'optional': bool(q.get('optional')),
        'conditions': q['conditions'],
    })

# ---------------------------------------------------------------------------
# 11 · Ядерная энергетика и Драконик (clean L->R branching tree)
# ---------------------------------------------------------------------------
adv('nuclear/verified', 60)
nuclear_quests = [
    ('nuclear_01_geiger', 'Радиационная разведка и дозиметрия (Nuclear / Ballistix)', 'minecraft:compass', [-220, 0], [
        'Собраны ядерные индустриальные моды: NuclearCraft Neoteric, Electrodynamics, Nuclear Science, Extreme Reactors и Ballistix (атомная энергетика, ускорители частиц, радиация и МБР).',
        'Начните с изучения урановых/ториевых жил (/lh prospect), защиты и счётчика Гейгера в JEI.',
    ], ['tutorial_precision']),
    ('nuclear_02_electrodynamics', 'Электродинамика и обогащение топлива', 'minecraft:blast_furnace', [-110, 0], [
        'Постройте линии переработки из Electrodynamics и NuclearCraft Neoteric для получения урана/тория и конструкционных сплавов.',
        'Не забудьте отводить промышленный дым через Advanced Chimneys и защищаться от радиационного фона.',
    ], ['nuclear_01_geiger']),
    ('nuclear_03_reactors', 'Ядерные реакторы и турбины', 'create:steam_engine', [0, 0], [
        'Спроектируйте многоблочный реактор деления (NuclearCraft Neoteric, Nuclear Science или Extreme Reactors) с контролем охлаждения и паровой турбиной.',
        'Для автоматического мониторинга используйте порт CC: Tweaked.',
    ], ['nuclear_02_electrodynamics']),
    ('nuclear_04_ballistix_hbm', 'Баллистика и тяжёлые заряды (Ballistix / Nuclear Science)', 'minecraft:tnt', [120, -65], [
        'Освойте пусковые шахты Ballistix, ракеты и тяжёлые заряды Nuclear Science (используйте строго на удалённых полигонах!).',
        'Помните: взрывы в жилых узлах вызывают загрязнение среды и разрушение инфраструктуры.',
    ], ['nuclear_03_reactors']),
    ('nuclear_05_draconium', 'Дракониум и Ядро Виверны (Draconic Evolution)', 'minecraft:glowstone_dust', [120, 65], [
        'Добудьте пыль/слитки дракониума из Draconic Evolution и скрафтите Ядро Виверны.',
        'Примечание: дислокаторы телепортации отключены правилами логистики — перемещение остаётся за поездами, судами и дирижаблями.',
    ], ['nuclear_03_reactors']),
    ('nuclear_06_fusion_core', 'Слияние (Fusion Crafting) и Энергоядро', 'minecraft:beacon', [240, 0], [
        'Соберите Ядро слияния (Fusion Crafting Core) и Энергетическое ядро Draconic Evolution для питания континентального комплекса.',
        'Для фиксации завершения технологической ветки выполните /lh nuclear verify с изделиями ядерного или драконического этапа в инвентаре.',
    ], ['nuclear_04_ballistix_hbm', 'nuclear_05_draconium']),
]
for qid, title, icon, pos, desc, deps in nuclear_quests:
    if qid == 'nuclear_06_fusion_core':
        tasks = {'nuclear_done': {'type': 'heracles:advancement', 'title': 'Подтверждение (/lh nuclear verify)', 'advancements': ['longhaul:nuclear/verified']}}
    else:
        tasks = {'read': {'type': 'heracles:check', 'title': 'Этап освоен (отметка инженера)'}}
    quest(qid, title, '11 · Ядерная энергетика и Драконик', pos, icon,
          tasks, desc, deps=deps, subtitle='Long Haul Legacy 2.0 · Поздняя энергетика')

# ---------------------------------------------------------------------------
# 12 · OpenTTD: Компании и Империя (clean horizontal 6-step line)
# ---------------------------------------------------------------------------
openttd_advs = ['company', 'specs', 'claim', 'trade', 'empire']
for oa in openttd_advs:
    adv('openttd/' + oa, 30)

openttd_quests = [
    ('openttd_01_found_company', 'I. Основание транспортной корпорации', 'minecraft:writable_book', [-275, 0], [
        'В мультиплеере игроки делятся на конкурирующие компании в духе OpenTTD с общим счётом (Credits), капитализацией и рейтингом (/lh company list).',
        'Создайте свою компанию командой /lh company create <id> <Название> (например, /lh company create translog Сибирь-Транс) или вступите к союзнику: /lh company join <id>.',
        'Ваш стартовый сектор 256×256 закрепляется за пределами заповедника 3×3 вокруг спауна, а на карте действуют ИИ-конкуренты: Стальная Магистраль, Зелёный Обоз и Небесный Альянс.',
    ], [], 'longhaul:openttd/company', 'Создайте или вступите в компанию'),
    ('openttd_02_specializations', 'II. Специализация логистики и добычи', 'create:track', [-165, 0], [
        'Выберите транспортную специализацию (/lh company spec transport <rail|road|sea|air>): +45–50% прибыли с профильных маршрутов и скидка 20–35% на захват секторов + пассивные перки.',
        'Выберите ресурсную специализацию (/lh company spec resource <mining|forestry|agro|energy>): +35–40% выхода и смягчение дефицита руд, леса, брожения еды или радиации.',
    ], ['openttd_01_found_company'], 'longhaul:openttd/specs', 'Выберите обе специализации компании'),
    ('openttd_03_sector_map', 'III. Карта секторов 256×256, выкуп и рейды', 'minecraft:filled_map', [-55, 0], [
        'Сектора 256×256 распределены между компаниями (кольцо 3×3 вокруг 0,0 защищено от захвата). Вся логистика — в интерактивной карте: /lh gui territory или /lh map (бумажная карта /lh map item).',
        'Свободные сектора — захватывайте (/lh territory buy <sx> <sz> или кликом в карте). Вражеские — перебивайте ценой в бочке (/lh territory outbid), осаждайте 60 сек (/lh territory raid) или изымайте антимонопольной службой (/lh territory seize).',
        'Можно также передать сектор союзнику (/lh territory transfer <id>) или урегулировать грузом в бочке (/lh territory settle).',
    ], ['openttd_02_specializations'], 'longhaul:openttd/claim', 'Захватите дополнительный сектор 256×256'),
    ('openttd_04_market_and_trade', 'IV. Биржа Консорциума и торговые пакты', 'minecraft:emerald', [55, 0], [
        'На бирже (/lh market list или вкладка GUI «Биржа») компании игроков и ИИ-боты выставляют ордера на покупку и продажу, а Консорциум периодически объявляет субсидии ×1.75.',
        'Выполните биржевую сделку (/lh market sell <id> или /lh market buy <id>) или прямую сделку между компаниями (/lh trade offer <id_компании|any> <кол-во> <цена>).',
        'Для беспошлинной торговли и свободной добычи заключите пакт: /lh company pact <id>.',
    ], ['openttd_03_sector_map'], 'longhaul:openttd/trade', 'Проведите межкорпоративную сделку'),
    ('openttd_05_ai_competitors', 'V. Конкуренция с ИИ-корпорациями', 'minecraft:redstone_block', [165, 0], [
        'Автономные ИИ-компании (/lh bot status) расширяют свои сектора внутри текущей границы мира, зарабатывают выручку и обновляют биржевые котировки.',
        'Сравните капитализацию компаний через /lh company list и превзойдите ИИ по выручке и секторам.',
    ], ['openttd_04_market_and_trade'], None, 'Ознакомьтесь с рейтингом ИИ-конкурентов'),
    ('openttd_06_empire_verify', 'VI. Империя Консорциума (/lh openttd verify)', 'minecraft:nether_star', [275, 0], [
        'Развивайте сеть секторов, закрывайте маршруты и экономические узлы, чтобы удерживать первое место в таблице компаний.',
        'Выполните /lh openttd verify после создания компании, выбора специализаций, захвата сектора и первой сделки.',
    ], ['openttd_05_ai_competitors'], 'longhaul:openttd/empire', 'Подтвердите статус OpenTTD-империи'),
]
for qid, title, icon, pos, desc, deps, adv_id, t_title in openttd_quests:
    if adv_id:
        tasks = {'ottd_task': {'type': 'heracles:advancement', 'title': t_title, 'advancements': [adv_id]}}
    else:
        tasks = {'check': {'type': 'heracles:check', 'title': t_title}}
    quest(qid, title, '12 · OpenTTD: Компании и Империя', pos, icon,
          tasks, desc, deps=deps, subtitle='Мультиплеерная экономика OpenTTD')

# ---------------------------------------------------------------------------
# 13 · Фотодокументация (Опционально — clean organized rows)
# ---------------------------------------------------------------------------
quest('alpha_photo', 'Фотодокументация экспедиции (Опционально)', '13 · Фотодокументация (Опционально)', [-200, -240], 'exposure:camera',
      {'read': {'type': 'heracles:check', 'title': 'Прочитано (опционально)'}},
      ['Exposure и Expansion-аддоны добавлены: камера, плёнка, проявка, Polaroid и альбомы.',
       'Эта глава полностью опциональна: основная кампания и расширение территории НЕ требуют камеры или фотографий.',
       'Снимайте фабрики, лагеря и маршруты (/lh photo report <узел> и /lh catalog verify <id>). Уникальный токен снимка нельзя использовать дважды.'],
      deps=['alpha_world'], subtitle='Опциональная ветка Exposure')

photo_gear = [
    ('camera', 'Камера экспедиции', 'exposure:camera', [-100, -240], 'Фотографируйте открытия; берите запас плёнки.', ['alpha_photo']),
    ('film', 'Запас плёнки', 'exposure:black_and_white_film', [0, -240], 'Чёрно-белая плёнка нужна для первых полевых снимков.', ['tutorial_camera']),
    ('album', 'Альбом маршрута', 'exposure:album', [100, -240], 'Соберите фотографии городов, мостов и этапов фабрики.', ['tutorial_film']),
]
for qid, title, item, pos, desc, deps in photo_gear:
    quest('tutorial_' + qid, title, '13 · Фотодокументация (Опционально)', pos, item,
          {'item': {'type': 'heracles:item', 'item': item, 'amount': 1, 'collection': 'AUTOMATIC'}},
          ['Опциональная веха фотодокументации.', desc], deps=deps, subtitle='Опциональное снаряжение Exposure')

photo_sites = [
    ('forest', 'Фотоотчёт: Лесная артель'),
    ('farm', 'Фотоотчёт: Речной агрогород'),
    ('mine', 'Фотоотчёт: Горный рудник'),
    ('port', 'Фотоотчёт: Морской порт'),
    ('badlands', 'Фотоотчёт: Карьер пустошей'),
    ('smelter', 'Фотоотчёт: Стекольная долина'),
    ('wetland', 'Фотоотчёт: Химический посёлок'),
    ('machine', 'Фотоотчёт: Машиностроительный центр'),
    ('continental_archive', 'Фотоотчёт: Архив магистралей'),
]
for i, (sid, title) in enumerate(photo_sites):
    adv('photo/' + sid, 20)
    quest('photo_' + sid, title, '13 · Фотодокументация (Опционально)', [-200, -50 + i * 78], 'exposure:photograph',
          {'photo': {'type': 'heracles:advancement', 'title': 'Уникальный полевой снимок', 'advancements': ['longhaul:photo/' + sid]}},
          ['Сделайте снимок Exposure на месте (<= 160 м от узла) и выполните /lh photo report ' + sid + '.', 'Один снимок нельзя использовать для двух разных узлов.'],
          deps=['site_' + sid, 'tutorial_camera'], subtitle='Опциональный фотоотчёт')

# ---------------------------------------------------------------------------
# 14 · DOOMED: Хардкор-выживание (ОСНОВНАЯ ГЛАВА — убрана из опциональных)
# ---------------------------------------------------------------------------
adv('doomed/checked', 40)
doomed_quests = [
    ('doomed_01_intro', 'I. Вводный инструктаж DOOMED и боеготовность', 'minecraft:paper', [-275, 0], [
        'Глава 14 входит в 14 основных этапов расширения территории (/lh territory).',
        'Если в optional-mods/ добавлен мод DOOMED | UNKNOWN CASUALTY (CurseForge ID 1589967 + Doomed: Guns), проверьте его через /lh doomed status и сделайте бэкап мира; в базовой сборке сервер ведёт протокол боевой медицины через /lh doomed verify.',
    ], ['alpha_voidout']),
    ('doomed_02_first_aid', 'II. Полевая медицина и рационы', 'minecraft:golden_apple', [-165, 0], [
        'Подготовьте аптечный запас: золотые яблоки, лечебные зелья, бинты/антисептики DOOMED и плотные блюда Farmer\'s Delight.',
        'На этом этапе проверяется автономность экипажа перед дальними рейдами.',
    ], ['doomed_01_intro']),
    ('doomed_03_blood_and_shock', 'III. Контроль травм, кровотечений и шока', 'minecraft:potion', [-55, 0], [
        'При установленном DOOMED активируйте режим через /doom и проведите первый бой, контролируя кровотечения и переломы.',
        'На судах Valkyrien Skies сначала протестируйте падения и урон на безопасной высоте.',
    ], ['doomed_02_first_aid']),
    ('doomed_04_guns_and_ballistics', 'IV. Огнестрельная оборона (TaCZ / Doomed: Guns)', 'minecraft:crossbow', [55, 0], [
        'Соберите дистанционное вооружение из Timeless and Classics Zero (TaCZ) или Doomed: Guns, чтобы избегать критических ближних переломов при штурмах данжей Cataclysm и Alex\'s Caves.',
    ], ['doomed_03_blood_and_shock']),
    ('doomed_05_field_expedition', 'V. Экспедиционный рейд и эвакуация', 'minecraft:compass', [165, 0], [
        'Совершите вылазку до удалённого лагеря или узла с полным медицинским комплектом и вернитесь живым без срабатывания Voidout.',
    ], ['doomed_04_guns_and_ballistics']),
    ('doomed_06_safe_toggle', 'VI. Завершение протокола DOOMED (/lh doomed verify)', 'minecraft:shield', [275, 0], [
        'Выполните /lh doomed verify, чтобы закрыть Главу 14 на сервере и получить финальный вклад в расширение территории (при желании /doom off отключает травмы).',
    ], ['doomed_05_field_expedition']),
]
for qid, title, icon, pos, desc, deps in doomed_quests:
    if qid == 'doomed_06_safe_toggle':
        tasks = {'doomed_ok': {'type': 'heracles:advancement', 'title': 'Подтверждение (/lh doomed verify)', 'advancements': ['longhaul:doomed/checked']}}
    else:
        tasks = {'check': {'type': 'heracles:check', 'title': 'Этап выживания DOOMED освоен'}}
    quest(qid, title, '14 · DOOMED: Хардкор-выживание', pos, icon,
          tasks, desc, deps=deps, subtitle='Long Haul Legacy 2.0 · Боевое выживание')

(O / 'kubejs/startup_scripts/02_quest_catalog.js').write_text(
    '// Auto-generated from design/quest-catalog.json by tools/generate_alpha_quests.py\n'
    'global.LHQuestCatalog = ' + json.dumps(compact_catalog, ensure_ascii=False) + ';\n'
)

(O / 'config/heracles/groups.txt').write_text(
    '00 · Сюжет: Ушёл за хлебом\n'
    '01 · Начало и правила\n'
    '02 · Мастерская и экспедиция\n'
    '03 · Контрольные поставки\n'
    '04 · Экономические центры\n'
    '05 · Маршруты и лагеря\n'
    '06 · Восстановление и телеметрия\n'
    '07 · Кампания: Основная прогрессия\n'
    '08 · Кампания: Региональные контракты\n'
    '09 · Кампания: Инженерные испытания\n'
    '10 · Кампания: Лагеря и экспедиции\n'
    '11 · Ядерная энергетика и Драконик\n'
    '12 · OpenTTD: Компании и Империя\n'
    '13 · Фотодокументация (Опционально)\n'
    '14 · DOOMED: Хардкор-выживание\n'
)
total_q = len(list(Q.glob('*.json')))
total_adv = len(list(ADV_ROOT.rglob('*.json')))
print(f'Generated {total_q} real Heracles quests ({len(compact_catalog)} catalog + {total_q - len(compact_catalog)} core) + {total_adv} server-only advancements.')
