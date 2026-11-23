#!/usr/bin/env python3
"""Generate real Heracles 1.20.1 quests + server-only receipt/progression advancements.
Includes connected dependency chains across all chapters (00..13), completable Chapter 00
opening story, Nuclear/Draconic chapter, optional DOOMED chapter, and all 240 catalog specs.
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
# 00 · Сюжет: Ушёл за хлебом (100% completable opening story chain)
# ---------------------------------------------------------------------------
story_chapters = [
    ('story_01_left_for_bread', 'Глава I: Ушёл в магазин за хлебом', 'minecraft:bread', [
        'Поздравляем — у вас родился сын! Жена попросила сходить в ближайшую лавку за свежей буханкой хлеба и бутылкой молока.',
        'Задача главы: выйти в мир (выдаётся автоматически при входе в мир; если не засчиталось — выполните /lh stage).',
    ], []),
    ('story_02_bakery_burned', 'Глава II: Пекарня сгорела — нужен свой хлеб', 'minecraft:wheat', [
        'Ближайшая пекарня оказалась закрыта на переучёт, так что придётся раздобыть или испечь первую буханку хлеба самостоятельно.',
        'Задача: держите в инвентаре буханку хлеба (minecraft:bread) — сервер автоматически засчитает этап.',
    ], ['story_01_left_for_bread']),
    ('story_03_dinner_telegram', 'Глава III: Обещал вернуться к ужину…', 'minecraft:barrel', [
        'Из дома пришла телеграмма: «Ты где? Хлеб можно уже не тёплый». Без собственного приёмного терминала заказы не оформить.',
        'Задача: поставьте пустую обычную бочку (minecraft:barrel), встаньте на неё и выполните /lh terminal.',
    ], ['story_02_bakery_burned']),
    ('story_04_snail_at_door', 'Глава IV: Заодно и молоко', 'minecraft:milk_bucket', [
        'Пока вы возились с бумагами, вспомнили про вторую половину просьбы — ведро свежего молока.',
        'Задача: наберите ведро молока (minecraft:milk_bucket) в инвентарь (сервер зачтёт этап автоматически).',
    ], ['story_03_dinner_telegram']),
    ('story_05_continental_bakery', 'Глава V: Первая штамповка для пекарни', 'create:mechanical_press', [
        'Чтобы открыть путь дальше в окрестности, пора перейти от ручной работы к первому механизму Create или стартовой поставке.',
        'Задача: скрафтите Механический пресс (create:mechanical_press) ИЛИ закройте контракт /lh accept plates (64 железные пластины).',
    ], ['story_04_snail_at_door']),
    ('story_06_forgot_the_milk', 'Эпилог пролога: Долгая дорога начинается', 'minecraft:compass', [
        'Хлеб и молоко собраны, терминал работает, а граница мира готова к первому расширению!',
        'Задача: скрафтите Компас (minecraft:compass) и выполните /lh stage. Завершение Главы 00 расширяет территорию и запускает Колесо Угроз!',
    ], ['story_05_continental_bakery']),
]
for i, (qid, title, icon, desc, deps) in enumerate(story_chapters):
    adv_name = 'story/' + qid[len('story_'):]
    adv(adv_name, 30 + i * 20)
    quest(qid, title, '00 · Сюжет: Ушёл за хлебом', [(i % 3 - 1) * 96, (i // 3) * 84 - 42], icon,
          {'story': {'type': 'heracles:advancement', 'title': 'Хроника «Ушёл за хлебом»', 'advancements': ['longhaul:' + adv_name]}},
          desc, deps=deps, subtitle='Long Haul Legacy 2.0 · Пролог')

# ---------------------------------------------------------------------------
# 01 · Начало и правила (connected rule chain + territory/casino guide)
# ---------------------------------------------------------------------------
intro = [
    ('alpha_welcome', 'Прототип промышленной сети', 'minecraft:book', [
        'Это расширяемая сборка Long Haul Legacy 2.0: 8 экономических центров (реальные .nbt площадки), 6 объектов восстановления, лагеря, маршрутные испытания, ядерная энергетика, Draconic Evolution и 240 заказов каталога.',
        'Подтверждение чтения — ручное; в конце цепочки подтвердите устав через /lh rules confirm.',
    ], ['story_01_left_for_bread']),
    ('alpha_terminal', 'Как зарегистрировать терминал', 'minecraft:barrel', [
        'Поставьте пустую обычную бочку. Встаньте на неё и выполните /lh terminal.',
        'Посмотрите /lh help, затем /lh accept plates. Заказ начнётся только при пустой бочке.',
        'Подводите товары воронкой или средствами Create. Принятые товары РАСХОДУЮТСЯ без возврата.',
    ], ['alpha_welcome']),
    ('alpha_windows', 'Что измеряют испытания', 'minecraft:clock', [
        'Контракты с суффиксом _shift считают норму в КАЖДОМ окне по 60 игровых секунд. Один полный сундук не завершает испытание мгновенно.',
        'Выгрузка чанка приостанавливает часы. Серверный прогресс сохраняется; /lh status показывает детали.',
        'При пропуске нормы испытание проваливается. /lh abort останавливает заказ; уже потреблённые товары не возвращаются.',
    ], ['alpha_terminal']),
    ('alpha_limits', 'Честные границы прототипа', 'minecraft:comparator', [
        'Шалкеры, эндер-сундуки, мешки, сейфы Supplementaries, джетпаки и дислокаторы телепортации отключены в крафте, луте и при взаимодействии.',
        'Выездные лагеря проверяют пустоту контейнеров перед сворачиванием.',
        'Для кооператива доступен общий консорциум: /lh team join <имя>.',
    ], ['alpha_windows']),
    ('alpha_world', 'Мир и региональные узлы', 'minecraft:compass', [
        'Natural Temperature и Cold Sweat отсутствуют. Фермерство не заперто в старых климатических поясах.',
        'Полная граница обычного мира: 175000 блоков (центр 0,0), но открывается она по мере завершения глав! Планировщик размещает 8 центров, Архив и Узел консорциума внутри ±84000.',
        'Посмотреть направления: /lh sites и /lh site info <id>.',
    ], ['alpha_limits']),
    ('alpha_territory_casino', 'Территория, коэффициент k и Колесо Угроз', 'minecraft:nether_star', [
        'Граница мира расширяется через 6 ключевых глав с убывающей отдачей: S = sqrt(724² + (175000² - 724²) * (1 - (1 - u/5)²)) — больше новой территории в начале (+36%, +28%, +20%) и меньше в конце (+12%, +4% до 175000) (/lh territory). Коэффициент сложности k = 1 + 95 * (D/n) / 63.15 зависит от суммарных смертей игроков онлайн D и обратно пропорционален онлайну n без жёсткого капа (/lh difficulty).',
        'Завершение каждой главы крутит визуальное Колесо Угроз с 20 усложнениями: случайный респаун (радиус 20203 * k / 96), распад инвентаря при гибели, выброс Voidout, токсичный газ, Бессмертная Улитка, перегруз, магнитные грозы и др. (/lh casino status, /lh events).',
    ], ['alpha_world']),
    ('alpha_voidout', 'Выброс при смерти (Voidout), трупы и тотемы', 'minecraft:totem_of_undying', [
        'Когда Колесо Угроз активирует Voidout, каждая настоящая смерть вызывает взрыв силой 1.0 × k (где k — общий коэффициент сложности без верхнего предела, см. /lh difficulty и /lh voidout status)!',
        'Ваш инвентарь сохраняется в трупе (Corpse; если не активно усложнение «Распад инвентаря»), а Тотем бессмертия спасает от детонации.',
    ], ['alpha_territory_casino']),
    ('alpha_toxic_gas_sky', 'Сезонный токсичный газ и летающие острова', 'minecraft:campfire', [
        'Когда в Колесе выпадает токсичный газ, он поднимается и спадает циклами по 4 игровых дня (на пике достигая Y=114, затем снова отступая в Чистый сезон, /lh gas status).',
        'Ищите и обустраивайте временные базы в высоких горах (Y>114) и на летающих островах в небе.',
    ], ['alpha_voidout']),
    ('alpha_eccentric_tome', 'Единая книга гайдов (Eccentric Tome)', 'eccentrictome:tome', [
        'Все книги и справочники из модов (Immersive Engineering, Alex’s Caves, Primal Magick, Draconic, Patchouli и др.) можно объединить в один том — Eccentric Tome.',
        'Положите Eccentric Tome и любые книги-гайды в крафт. ПКМ открывает выбор книги, Shift+ЛКМ возвращает обратно.',
    ], ['alpha_welcome']),
    ('alpha_pollution_arcane', 'Загрязнение среды и Первородная магия', 'minecraft:cauldron', [
        'Pollution of the Realms создаёт выбросы дыма и пыли, которые поднимаются вверх и со временем рассеиваются или портят почву — отводите дым через Advanced Chimneys.',
        'Для тайных исследований добавлены Primal Magick и Thaumon.',
    ], ['alpha_eccentric_tome']),
]
for i, (qid, title, icon, desc, deps) in enumerate(intro):
    quest(qid, title, '01 · Начало и правила', [(i % 3 - 1) * 84, (i // 3) * 72 - 72], icon,
          {'read': {'type': 'heracles:check', 'title': 'Прочитано (ручное подтверждение)'}}, desc, deps=deps)

adv('rules/confirmed', 25)
quest('alpha_rules_confirm', 'Подтвердить устав консорциума', '01 · Начало и правила', [0, 216], 'minecraft:writable_book',
      {'confirmed': {'type': 'heracles:advancement', 'title': 'Подтверждение (/lh rules confirm)', 'advancements': ['longhaul:rules/confirmed']}},
      ['Прочитайте основные правила, зарегистрируйте бочку (/lh terminal) и выполните команду /lh rules confirm.',
       'Эта веха завершает Главу 01, расширяет границу мира и запускает Колесо Угроз.'],
      deps=['alpha_territory_casino'])

# ---------------------------------------------------------------------------
# 02 · Мастерская и экспедиция (connected engineering + expedition gear; photo moved to Ch.13)
# ---------------------------------------------------------------------------
items = [
    ('waterwheel', 'Источник кинетики', 'create:water_wheel', 'Водяное колесо — начало механической мастерской.', ['story_02_bakery_burned']),
    ('press', 'Обработка металла', 'create:mechanical_press', 'Пресс штампует пластины. Далее используйте их для заказов терминала.', ['tutorial_waterwheel']),
    ('mixer', 'Сплавы', 'create:mechanical_mixer', 'Миксер смешивает сплавы; продумайте подачу ингредиентов и подогрев.', ['tutorial_press']),
    ('brass', 'Латунная мастерская', 'create:brass_ingot', 'Латунь открывает точные механизмы и новую автоматизацию.', ['tutorial_mixer']),
    ('precision', 'Точная сборка', 'create:precision_mechanism', 'Механизм нужен для промышленного оборудования. Изучите последовательную сборку в JEI.', ['tutorial_brass']),
    ('track', 'Железнодорожный путь', 'create:track', 'Рельсы — только начало линии. Инвентарное задание НЕ доказывает наличие дороги.', ['tutorial_brass']),
    ('station', 'Грузовая станция', 'create:track_station', 'Спроектируйте погрузку и разгрузку. Проверка рейсов конкретного поезда появится отдельно.', ['tutorial_track']),
    ('computer', 'Промышленный компьютер', 'computercraft:computer_normal', 'CC: Tweaked — локальная автоматизация. Программа longhaul_depot следит за запасом склада.', ['tutorial_precision']),
    ('cookpot', 'Походное снабжение', 'farmersdelight:cooking_pot', 'Farmer’s Delight связывает урожай и готовку. Держите запас для длительных рейсов.', ['tutorial_waterwheel']),
]
for i, (qid, title, item, desc, deps) in enumerate(items):
    quest('tutorial_' + qid, title, '02 · Мастерская и экспедиция', [(i % 3 - 1) * 84, (i // 3) * 72 - 72], item,
          {'item': {'type': 'heracles:item', 'item': item, 'amount': 1, 'collection': 'AUTOMATIC'}},
          ['Учебная веха: обнаружение предмета, НЕ испытание работающего предприятия.', desc], deps=deps)

# ---------------------------------------------------------------------------
# 03 · Контрольные поставки (connected home barrel contracts)
# ---------------------------------------------------------------------------
contracts = [
    ('plates', 'Первая партия пластин', 'create:iron_sheet', '64 железные пластины.', ['alpha_terminal', 'tutorial_press']),
    ('brass', 'Латунный заказ', 'create:brass_ingot', '32 латунных слитка.', ['contract_plates', 'tutorial_brass']),
    ('rails', 'Снабжение путейцев', 'create:track', '128 рельсов Create.', ['contract_plates', 'tutorial_track']),
    ('provisions', 'Продовольственный склад', 'minecraft:bread', '32 хлеба И 32 печёные картофелины.', ['alpha_terminal', 'tutorial_cookpot']),
    ('mechanisms', 'Приборы для депо', 'create:precision_mechanism', '8 точных механизмов.', ['contract_brass', 'tutorial_precision']),
    ('plate_shift', 'Ритм поставки пластин', 'create:iron_sheet', '16 пластин за каждое из трёх окон по 60 секунд.', ['contract_plates']),
    ('food_shift', 'Регулярное снабжение', 'minecraft:baked_potato', '8 хлеба И 8 печёных картофелин за каждое из трёх окон по 60 секунд.', ['contract_provisions']),
    ('rail_shift', 'Снабжение магистрали', 'create:track', '32 рельса И 8 пластин за каждое из пяти окон по 60 секунд.', ['contract_rails']),
]
for i, (qid, title, icon, detail, deps) in enumerate(contracts):
    adv('contracts/' + qid, 15)
    quest('contract_' + qid, title, '03 · Контрольные поставки', [(i % 4) * 84 - 126, (i // 4) * 72 - 36], icon,
          {'receipt': {'type': 'heracles:advancement', 'title': 'Подтверждение серверной приёмки', 'advancements': ['longhaul:contracts/' + qid]}},
          ['Начало: /lh accept ' + qid, detail, 'Нужно реально передать товары в зарегистрированную бочку после принятия заказа. Наличие предметов в инвентаре не завершает этот квест.', 'Товары расходуются. Статус: /lh status.'],
          deps=deps)

# ---------------------------------------------------------------------------
# 04 · Экономические центры (tiered dependency chain T1 -> T2 -> T3 -> T4)
# ---------------------------------------------------------------------------
sites = [
    ('forest', 'Лесная артель', 'longhaul:treated_timber', 'Пропитанная древесина', ['contract_rails', 'logistics_three_camps']),
    ('farm', 'Речной агрогород', 'longhaul:field_rations', 'Экспедиционные рационы', ['contract_provisions', 'logistics_three_camps']),
    ('mine', 'Горный рудник', 'longhaul:ore_concentrate', 'Рудный концентрат', ['contract_rails', 'logistics_first_route']),
    ('port', 'Морской порт', 'longhaul:marine_reagent', 'Морской реагент', ['prod_forest', 'prod_farm']),
    ('badlands', 'Карьер пустошей', 'longhaul:refractory_mix', 'Огнеупорная смесь', ['prod_mine']),
    ('smelter', 'Стекольная долина', 'longhaul:technical_glass', 'Техническое стекло', ['prod_mine', 'prod_badlands']),
    ('wetland', 'Химический посёлок', 'longhaul:technical_oil', 'Техническое масло', ['prod_port', 'prod_badlands']),
    ('machine', 'Машиностроительный центр', 'longhaul:machine_parts', 'Прецизионные узлы', ['prod_smelter', 'prod_wetland']),
]
for i, (sid, title, prod, prod_name, sdeps) in enumerate(sites):
    adv('sites/' + sid, 20)
    adv('production/' + sid, 30)
    quest('site_' + sid, title + ': ввод в строй', '04 · Экономические центры', [(i % 4) * 84 - 126, (i // 4) * 144 - 72],
          'minecraft:barrel',
          {'commission': {'type': 'heracles:advancement', 'title': 'Регистрация площадки на месте', 'advancements': ['longhaul:sites/' + sid]}},
          ['Найдите площадку через /lh sites и /lh site info ' + sid + '.', 'Встаньте НА бочку в радиусе 128 м от координат узла и выполните /lh site commission ' + sid + '.'],
          deps=sdeps)
    quest('prod_' + sid, title + ': ' + prod_name, '04 · Экономические центры', [(i % 4) * 84 - 126, (i // 4) * 144],
          prod,
          {'produce': {'type': 'heracles:advancement', 'title': 'Местный выпуск продукции', 'advancements': ['longhaul:production/' + sid]}},
          ['Выпустите партию ' + prod_name + ' непосредственно на площадке: /lh site produce ' + sid + ' bootstrap (или industrial).', 'Удалённое производство на домашней базе заблокировано сервером.'],
          deps=['site_' + sid])

adv('sites/continental_archive', 50)
quest('site_continental_archive', 'Центральный архив магистралей', '04 · Экономические центры', [-42, 216], 'minecraft:writable_book',
      {'archive': {'type': 'heracles:advancement', 'title': 'Однократная фиксация уникального объекта', 'advancements': ['longhaul:sites/continental_archive']}},
      ['Экспедиция к уникальному архиву (/lh site info continental_archive).', 'Подойдите ближе 96 м и выполните /lh site archive. Для ремонта конструкции: /lh site repair_archive (повторные награды не выдаются).'],
      deps=['prod_machine'])

adv('sites/continental_hub', 40)
adv('production/continental_hub', 100)
quest('site_continental_hub', 'Континентальный узел консорциума', '04 · Экономические центры', [42, 216], 'longhaul:continental_module',
      {'hub': {'type': 'heracles:advancement', 'title': 'Запуск финального узла', 'advancements': ['longhaul:production/continental_hub']}},
      ['Зарегистрируйте Континентальный узел (/lh site commission continental_hub) и соберите Континентальный модуль из продукции всех 8 центров (/lh site produce continental_hub industrial).'],
      deps=['prod_machine', 'site_continental_archive'])

# ---------------------------------------------------------------------------
# 05 · Маршруты и лагеря (fits inside ±1564 border before 175k continent opens)
# ---------------------------------------------------------------------------
logistics = [
    ('expedition/first_camp', 'Первый полевой лагерь', 'minecraft:campfire',
     ['Отойдите минимум на 750 м от (0,0) (откроется уже после первого расширения границы), поставьте костёр и спальник Comforts (<= 6 м) и выполните /lh camp deploy.'],
     ['tutorial_cookpot', 'contract_provisions']),
    ('expedition/three_camps', 'Сеть из трёх лагерей', 'comforts:sleeping_bag_red',
     ['Разверните 3 активных полевых лагеря на расстоянии >= 500 м друг от друга.'],
     ['logistics_first_camp']),
    ('routes/first_route', 'Испытание маршрута', 'minecraft:rail',
     ['Разметьте маршрут длиной >= 750 м: /lh route begin <имя>, добавьте контрольные точки (/lh route gate), завершите (/lh route finish) и пройдите на транспорте (/lh route start <имя>).', 'Аномальная скорость (> 85 м/с, телепорт) отменяет испытание.'],
     ['tutorial_station', 'contract_rails']),
    ('routes/cargo_delivery', 'Серверная грузовая накладная', 'longhaul:cargo_manifest',
     ['Получите накладную на одном узле (/lh cargo issue <откуда> <куда>), физически доставьте её в целевой узел и сдайте (/lh cargo deliver).'],
     ['site_forest', 'logistics_first_route']),
]
for i, (adv_id, title, icon, desc, deps) in enumerate(logistics):
    adv(adv_id, 25)
    qid = 'logistics_' + adv_id.split('/')[-1]
    quest(qid, title, '05 · Маршруты и лагеря', [(i % 4) * 84 - 126, 0], icon,
          {'verified': {'type': 'heracles:advancement', 'title': 'Серверное подтверждение', 'advancements': ['longhaul:' + adv_id]}},
          desc, deps=deps)

# ---------------------------------------------------------------------------
# 06 · Восстановление и телеметрия (photo reports moved to Ch.13)
# ---------------------------------------------------------------------------
recoveries = [
    ('sawmill', 'Восстановление лесопилки', 'create:mechanical_saw', 'Подайте 16 железа, 16 андезитового сплава, 32 бревна и установите пилу/водяное колесо.', ['site_forest']),
    ('quarry', 'Карьер с повреждённым подъездом', 'create:mechanical_drill', 'Подайте 24 пластины, 32 рельса, 64 булыжника и смонтируйте бур/дробилку/станцию.', ['site_mine']),
    ('river_port', 'Восстановление речного порта', 'create:portable_storage_interface', 'Подайте 64 доски, 16 железа, 2 интерфейса и смонтируйте перегрузочный узел.', ['site_port']),
    ('sorting_yard', 'Сортировочная станция', 'create:brass_funnel', 'Подайте 64 рельса, 16 латуни, 8 лент и смонтируйте станцию/сортировку.', ['site_badlands']),
    ('power_plant', 'Восстановление энергоузла', 'create:steam_engine', 'Подайте 32 меди, 16 латуни, 48 угля и установите паровую/генераторную установку.', ['site_smelter']),
    ('collapsed_bridge', 'Магистральный мост', 'create:metal_girder', 'Подайте 24 балки, 48 рельсов, 64 каменного кирпича и восстановите рельсовый переход.', ['site_machine']),
]
for i, (rid, title, icon, detail, rdeps) in enumerate(recoveries):
    adv('recovery/' + rid, 40)
    quest('recovery_' + rid, title, '06 · Восстановление и телеметрия', [(i % 3) * 84 - 84, (i // 3) * 72 - 108], icon,
          {'restored': {'type': 'heracles:advancement', 'title': 'Серверное восстановление объекта', 'advancements': ['longhaul:recovery/' + rid]}},
          ['Обследуйте объект (/lh recovery list, /lh recovery survey ' + rid + ').', detail, 'Встаньте на ремонтную бочку и выполните /lh recovery restore ' + rid + '.'],
          deps=rdeps)

cc_sites = [
    ('forest', 'Телеметрия склада: Лесная артель'),
    ('farm', 'Телеметрия склада: Агрогород'),
    ('mine', 'Телеметрия склада: Рудник'),
    ('port', 'Телеметрия склада: Порт'),
    ('badlands', 'Телеметрия склада: Карьер'),
    ('smelter', 'Телеметрия склада: Стекольная долина'),
    ('wetland', 'Телеметрия склада: Химпосёлок'),
    ('machine', 'Телеметрия склада: Машцентр'),
]
for i, (sid, title) in enumerate(cc_sites):
    adv('cc/' + sid, 25)
    quest('cc_' + sid, title, '06 · Восстановление и телеметрия', [(i % 4) * 84 - 126, (i // 4) * 72 + 54], 'computercraft:computer_normal',
          {'telemetry': {'type': 'heracles:advancement', 'title': 'Подтверждение телеметрии и запаса', 'advancements': ['longhaul:cc/' + sid]}},
          ['Запустите /lh cc challenge ' + sid + ', установите компьютер CC: Tweaked в 12 м от бочки узла и обеспечьте реальный запас продукции в бочке, затем /lh cc verify ' + sid + '.'],
          deps=['site_' + sid, 'tutorial_computer'])

# ---------------------------------------------------------------------------
# 07..10 · Full 240-spec catalog with connected dependency chains (photo -> Ch.13)
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

def catalog_deps(q):
    qid = q['id']
    # Main progression: chain main_1_01..08 -> main_2_01..08 -> main_3_01..08 -> main_4_01..08
    if qid.startswith('main_'):
        parts = qid.split('_')
        stg, num = int(parts[1]), int(parts[2])
        if num > 1:
            return [f'cat_main_{stg}_{num-1:02d}']
        if stg > 1:
            return [f'cat_main_{stg-1}_08']
        return ['contract_plates']
    # Regional contracts: region_<site>_01..12
    if qid.startswith('region_'):
        parts = qid.split('_')
        site, num = '_'.join(parts[1:-1]), int(parts[-1])
        if num > 1:
            return [f'cat_region_{site}_{num-1:02d}']
        return ['site_' + site] if ('site_' + site) else ['contract_rails']
    # Engineering trials: engineering_<subcat>_01..08
    if qid.startswith('engineering_'):
        parts = qid.split('_')
        sub, num = '_'.join(parts[1:-1]), int(parts[-1])
        if num > 1:
            return [f'cat_engineering_{sub}_{num-1:02d}']
        return ['tutorial_precision']
    # Photo docs: photo_<site>_{arrival,before,after,route}
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
        return ['photo_' + site] if site != 'continental_archive' else ['photo_continental_archive']
    # Expedition: expedition_01..16 (skip optional photo quests in main chain)
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

group_indices = {g: 0 for g in CHAPTER_GROUPS.values()}
compact_catalog = []

for q in catalog:
    qid = q['id']
    vt = q['verification_type']
    grp = '13 · Фотодокументация (Опционально)' if vt == 'photo_evidence' else CHAPTER_GROUPS[q['chapter']]
    idx = group_indices[grp]
    group_indices[grp] += 1
    icon = TYPE_ICONS.get(vt, 'minecraft:paper')
    adv('catalog/' + qid, 20 + q['stage'] * 5)

    desc = [
        f"Этап {q['stage']} · Тип: {vt}" + (' (опционально)' if q.get('optional') else ' (основной заказ)'),
        f"Условия каталога: {json.dumps(q['conditions'], ensure_ascii=False)}",
        f"Проверка сервером: /lh catalog verify {qid} (сведения: /lh catalog info {qid}).",
    ]
    if vt in UNTRACKED_VEHICLE_TYPES:
        desc.append('Честное ограничение: физический трекер train/VS ID ещё не подключён; сервер проверяет маршрут/доставку контрольной партии в бочке на месте без фиктивного трекинга транспорта.')

    cols = 8 if len(catalog) > 40 and grp == '08 · Кампания: Региональные контракты' else 6
    y_offset = 216 if grp == '13 · Фотодокументация (Опционально)' else 0
    pos = [(idx % cols) * 84 - (cols * 42) + 42, (idx // cols) * 72 - 144 + y_offset]
    quest(
        'cat_' + qid,
        q['title'],
        grp,
        pos,
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
# 11 · Ядерная энергетика и Драконик (Electrodynamics, NuclearCraft, HBM, Ballistix, Draconic Evolution)
# ---------------------------------------------------------------------------
adv('nuclear/verified', 60)
nuclear_quests = [
    ('nuclear_01_geiger', 'Радиационная разведка и дозиметрия (Nuclear / Ballistix)', 'minecraft:compass', [
        'Собраны ядерные индустриальные моды: NuclearCraft Neoteric, Electrodynamics, Nuclear Science, Extreme Reactors и Ballistix (атомная энергетика, ускорители частиц, радиация и МБР в духе HBM).',
        'Начните с изучения урановых/ториевых жил (/lh prospect), защиты и счётчика Гейгера в JEI.',
    ], ['tutorial_precision']),
    ('nuclear_02_electrodynamics', 'Электродинамика и обогащение топлива', 'minecraft:blast_furnace', [
        'Постройте линии переработки из Electrodynamics и NuclearCraft Neoteric для получения урана/тория и конструкционных сплавов.',
        'Не забудьте отводить промышленный дым и защищаться от радиационного фона.',
    ], ['nuclear_01_geiger']),
    ('nuclear_03_reactors', 'Ядерные реакторы и турбины', 'create:steam_engine', [
        'Спроектируйте многоблочный реактор деления (NuclearCraft Neoteric, Nuclear Science или Extreme Reactors) с контролем охлаждения и паровой турбиной.',
        'Для автоматического мониторинга используйте порт CC: Tweaked.',
    ], ['nuclear_02_electrodynamics']),
    ('nuclear_04_ballistix_hbm', 'Баллистика и тяжёлые заряды (Ballistix / Nuclear Science)', 'minecraft:tnt', [
        'Освойте пусковые шахты Ballistix, ракеты и тяжёлые заряды Nuclear Science (используйте строго на удалённых полигонах!).',
        'Помните: взрывы в жилых узлах вызывают загрязнение среды и разрушение инфраструктуры.',
    ], ['nuclear_03_reactors']),
    ('nuclear_05_draconium', 'Дракониум и Ядро Виверны (Draconic Evolution)', 'minecraft:glowstone_dust', [
        'Добудьте пыль/слитки дракониума из Draconic Evolution и скрафтите Ядро Виверны.',
        'Примечание: дислокаторы телепортации отключены правилами логистики — перемещение остаётся за поездами, судами и дирижаблями.',
    ], ['nuclear_03_reactors']),
    ('nuclear_06_fusion_core', 'Слияние (Fusion Crafting) и Энергоядро', 'minecraft:beacon', [
        'Соберите Ядро слияния (Fusion Crafting Core) и Энергетическое ядро Draconic Evolution для питания континентального комплекса.',
        'Для фиксации завершения технологической ветки выполните /lh nuclear verify с изделиями ядерного или драконического этапа в инвентаре.',
    ], ['nuclear_05_draconium']),
]
for i, (qid, title, icon, desc, deps) in enumerate(nuclear_quests):
    if qid == 'nuclear_06_fusion_core':
        tasks = {'nuclear_done': {'type': 'heracles:advancement', 'title': 'Подтверждение (/lh nuclear verify)', 'advancements': ['longhaul:nuclear/verified']}}
    else:
        tasks = {'read': {'type': 'heracles:check', 'title': 'Этап освоен (отметка инженера)'}}
    quest(qid, title, '11 · Ядерная энергетика и Драконик', [(i % 3 - 1) * 96, (i // 3) * 84 - 42], icon,
          tasks, desc, deps=deps, subtitle='Long Haul Legacy 2.0 · Поздняя энергетика')

# ---------------------------------------------------------------------------
# 12 · OpenTTD: Компании и Империя (multiplayer companies, specs, sectors, trading, AI bots)
# ---------------------------------------------------------------------------
openttd_advs = ['company', 'specs', 'claim', 'trade', 'empire']
for oa in openttd_advs:
    adv('openttd/' + oa, 30)

openttd_quests = [
    ('openttd_01_found_company', 'I. Основание транспортной корпорации', 'minecraft:writable_book', [
        'В мультиплеере игроки делятся на конкурирующие компании в духе OpenTTD с общим счётом (Credits), капитализацией и рейтингом (/lh company list).',
        'Создайте свою компанию командой /lh company create <id> <Название> (например, /lh company create translog Сибирь-Транс) или вступите к союзнику: /lh company join <id>.',
        'Автоматически ваш стартовый сектор 256×256 закрепляется как штаб-квартира, а на карте действуют ИИ-конкуренты: Стальная Магистраль, Зелёный Обоз и Небесный Альянс.',
    ], [], 'longhaul:openttd/company', 'Создайте или вступите в компанию'),
    ('openttd_02_specializations', 'II. Специализация логистики и добычи', 'create:track', [
        'Выберите транспортную специализацию (/lh company spec transport <rail|road|sea|air>): +45–50% прибыли с профильных маршрутов и скидка 20–35% на захват секторов + пассивные перки.',
        'Выберите ресурсную специализацию (/lh company spec resource <mining|forestry|agro|energy>): +35–40% выхода и смягчение дефицита руд, леса, брожения еды или радиации.',
    ], ['openttd_01_found_company'], 'longhaul:openttd/specs', 'Выберите обе специализации компании'),
    ('openttd_03_sector_map', 'III. Карта секторов 256×256, выкуп и рейды', 'minecraft:filled_map', [
        'Сектора 256×256 распределены между компаниями (кольцо вокруг 0,0 защищено от захвата). Вся логистика — в одной интерактивной карте: /lh map (или бумажная карта /lh map item).',
        'Свободные сектора — захватывайте (/lh territory buy <sx> <sz> или кликом в карте). Вражеские — перебивайте ценой в бочке (/lh territory outbid), осаждайте 60 сек (/lh territory raid) или изымайте антимонопольной службой (/lh territory seize).',
        'Можно также передать сектор союзнику (/lh territory transfer <id>) или урегулировать грузом в бочке (/lh territory settle).',
    ], ['openttd_02_specializations'], 'longhaul:openttd/claim', 'Захватите дополнительный сектор 256×256'),
    ('openttd_04_market_and_trade', 'IV. Биржа Консорциума и торговые пакты', 'minecraft:emerald', [
        'На бирже (/lh market list) компании игроков и ИИ-боты выставляют ордера на покупку и продажу, а Консорциум периодически объявляет субсидии ×1.75.',
        'Выполните биржевую сделку (/lh market sell <id> или /lh market buy <id>) или прямую сделку между компаниями (/lh trade offer <id_компании|any> <кол-во> <цена>).',
        'Для беспошлинной торговли и свободной добычи без пошлин заключите пакт: /lh company pact <id>.',
    ], ['openttd_03_sector_map'], 'longhaul:openttd/trade', 'Проведите межкорпоративную сделку'),
    ('openttd_05_ai_competitors', 'V. Конкуренция с ИИ-корпорациями', 'minecraft:redstone_block', [
        'Автономные ИИ-компании (/lh bot status) расширяют свои сектора внутри текущей границы мира, зарабатывают выручку и обновляют биржевые котировки.',
        'Сравните капитализацию компаний через /lh company list и превзойдите ИИ по выручке и секторам.',
    ], ['openttd_04_market_and_trade'], None, 'Ознакомьтесь с рейтингом ИИ-конкурентов'),
    ('openttd_06_empire_verify', 'VI. Империя Консорциума (/lh openttd verify)', 'minecraft:nether_star', [
        'Развивайте сеть секторов, закрывайте маршруты и экономические узлы, чтобы удерживать первое место в таблице компаний.',
        'Выполните /lh openttd verify после создания компании, выбора специализаций, захвата сектора и первой сделки.',
    ], ['openttd_05_ai_competitors'], 'longhaul:openttd/empire', 'Подтвердите статус OpenTTD-империи'),
]
for i, (qid, title, icon, desc, deps, adv_id, t_title) in enumerate(openttd_quests):
    if adv_id:
        tasks = {'ottd_task': {'type': 'heracles:advancement', 'title': t_title, 'advancements': [adv_id]}}
    else:
        tasks = {'check': {'type': 'heracles:check', 'title': t_title}}
    quest(qid, title, '12 · OpenTTD: Компании и Империя', [(i % 3 - 1) * 96, (i // 3) * 84 - 42], icon,
          tasks, desc, deps=deps, subtitle='Мультиплеерная экономика OpenTTD')

# ---------------------------------------------------------------------------
# 13 · Фотодокументация (Опционально — all Exposure photography quests separated here)
# ---------------------------------------------------------------------------
quest('alpha_photo', 'Фотодокументация экспедиции (Опционально)', '13 · Фотодокументация (Опционально)', [-168, -216], 'exposure:camera',
      {'read': {'type': 'heracles:check', 'title': 'Прочитано (опционально)'}},
      ['Exposure добавлен: камера, плёнка, проявка и альбомы.',
       'Эта глава полностью опциональна: основная кампания и расширение территории больше НЕ требуют камеры или фотографий.',
       'Снимайте фабрики, лагеря и маршруты (/lh photo report <узел> и /lh catalog verify <id>). Уникальный токен снимка нельзя использовать дважды.'],
      deps=['alpha_world'], subtitle='Опциональная ветка Exposure')

photo_gear = [
    ('camera', 'Камера экспедиции', 'exposure:camera', 'Фотографируйте открытия; берите запас плёнки.', ['alpha_photo']),
    ('film', 'Запас плёнки', 'exposure:black_and_white_film', 'Чёрно-белая плёнка нужна для первых полевых снимков.', ['tutorial_camera']),
    ('album', 'Альбом маршрута', 'exposure:album', 'Соберите фотографии городов, мостов и этапов фабрики.', ['tutorial_film']),
]
for i, (qid, title, item, desc, deps) in enumerate(photo_gear):
    quest('tutorial_' + qid, title, '13 · Фотодокументация (Опционально)', [(i - 1) * 84, -216], item,
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
    quest('photo_' + sid, title, '13 · Фотодокументация (Опционально)', [(i % 5) * 84 - 168, (i // 5) * 72 - 120], 'exposure:photograph',
          {'photo': {'type': 'heracles:advancement', 'title': 'Уникальный полевой снимок', 'advancements': ['longhaul:photo/' + sid]}},
          ['Сделайте снимок Exposure на месте (<= 160 м от узла) и выполните /lh photo report ' + sid + '.', 'Один снимок нельзя использовать для двух разных узлов.'],
          deps=['site_' + sid, 'tutorial_camera'], subtitle='Опциональный фотоотчёт')

# ---------------------------------------------------------------------------
# 14 · DOOMED: Хардкор-выживание (Опционально — не блокирует прогрессию)
# ---------------------------------------------------------------------------
adv('doomed/checked', 30)
doomed_quests = [
    ('doomed_01_intro', 'Опционально: Установка DOOMED и бэкап мира', 'minecraft:paper', [
        'DOOMED | UNKNOWN CASUALTY — опциональный мод с CurseForge (ID 1589967), не входящий в .mrpack по лицензии.',
        'Если хотите сыграть с ним: поместите JAR Forge 1.20.1 (и Doomed: Guns) в optional-mods/ (см. DOOMED.md), обязательно сделайте резервную копию мира и проверьте статус через /lh doomed status.',
    ], []),
    ('doomed_02_first_aid', 'Полевая медицина перед активацией /doom', 'minecraft:golden_apple', [
        'Перед включением режима (/doom) подготовьте запас бинтов, антисептиков, еды Farmer’s Delight и золотых яблок.',
        'Глава полностью опциональна и не влияет на открытие территории.',
    ], ['doomed_01_intro']),
    ('doomed_03_blood_and_shock', 'Контроль травм, кровотечений и шока', 'minecraft:potion', [
        'Активируйте режим через /doom и проведите первый бой/разведку, отслеживая состояние конечностей и крови.',
        'На движущихся кораблях Valkyrien Skies сначала протестируйте получение урона на безопасной высоте.',
    ], ['doomed_02_first_aid']),
    ('doomed_04_guns_and_ballistics', 'Огнестрельная защита (Doomed: Guns / TaCZ)', 'minecraft:crossbow', [
        'Соберите лёгкое огнестрельное вооружение из Doomed: Guns или TaCZ для дистанционного боя без ближнего контакта и лишних переломов.',
    ], ['doomed_03_blood_and_shock']),
    ('doomed_05_field_expedition', 'Экспедиционный рейд в условиях DOOMED', 'minecraft:compass', [
        'Преодолейте полевой маршрут до лагеря или узла с включённым режимом травм и вернитесь живым без срабатывания Voidout.',
    ], ['doomed_04_guns_and_ballistics']),
    ('doomed_06_safe_toggle', 'Протокол отката и серверная отметка (/lh doomed verify)', 'minecraft:shield', [
        'При необходимости выключить режим используйте /doom off.',
        'Выполните /lh doomed verify, чтобы зафиксировать опциональную главу DOOMED (работает безопасно даже без установленного JAR).',
    ], ['doomed_05_field_expedition']),
]
for i, (qid, title, icon, desc, deps) in enumerate(doomed_quests):
    if qid == 'doomed_06_safe_toggle':
        tasks = {'doomed_ok': {'type': 'heracles:advancement', 'title': 'Проверка (/lh doomed verify)', 'advancements': ['longhaul:doomed/checked']}}
    else:
        tasks = {'check': {'type': 'heracles:check', 'title': 'Опциональная отметка DOOMED'}}
    quest(qid, title, '14 · DOOMED: Хардкор-выживание (Опционально)', [(i % 3 - 1) * 96, (i // 3) * 84 - 42], icon,
          tasks, desc, deps=deps, subtitle='Опциональный профиль CurseForge')

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
    '14 · DOOMED: Хардкор-выживание (Опционально)\n'
)
total_q = len(list(Q.glob('*.json')))
total_adv = len(list(ADV_ROOT.rglob('*.json')))
print(f'Generated {total_q} real Heracles quests ({len(compact_catalog)} catalog + {total_q - len(compact_catalog)} core) + {total_adv} server-only advancements.')
