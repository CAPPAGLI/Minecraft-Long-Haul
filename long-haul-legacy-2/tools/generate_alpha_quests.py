#!/usr/bin/env python3
"""Generate real Heracles 1.20.1 quests + server-only receipt/progression advancements.
Includes the 71 core Alpha mechanics quests (groups 01..06) PLUS all 240 campaign/regional
specifications from design/quest-catalog.json (groups 07..11), each bound to a server-only
advancement and verified via /lh catalog verify <id> (never fake check buttons).
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

def quest(qid, title, group, pos, icon, tasks, desc, deps=None, subtitle='Long Haul Legacy 2.0 · Alpha 4'):
    put(Q / (qid + '.json'), {
        'dependencies': deps or [],
        'tasks': tasks,
        'rewards': {},
        'display': {
            'title': json.dumps({'text': title}, ensure_ascii=False),
            'subtitle': json.dumps({'text': subtitle}, ensure_ascii=False),
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

intro = [
    ('alpha_welcome', 'Прототип промышленной сети', 'minecraft:book', [
        'Это расширяемая alpha-сборка Long Haul Legacy 2.0 (на пути к полной кампании).',
        'Включены: 8 специализированных экономических центров (реальные .nbt площадки), 6 объектов восстановления, лагеря, маршрутные испытания, серверные накладные и 240 заказов каталога.',
        'Подтверждение чтения — ручное; это не инженерное испытание.',
    ]),
    ('alpha_terminal', 'Как зарегистрировать терминал', 'minecraft:barrel', [
        'Поставьте пустую обычную бочку. Встаньте на неё и выполните /lh terminal.',
        'Посмотрите /lh help, затем /lh accept plates. Заказ начнётся только при пустой бочке.',
        'Подводите товары воронкой или средствами Create. Принятые товары РАСХОДУЮТСЯ без возврата.',
    ]),
    ('alpha_windows', 'Что измеряют испытания', 'minecraft:clock', [
        'Контракты с суффиксом _shift считают норму в КАЖДОМ окне по 60 игровых секунд. Один полный сундук не завершает испытание мгновенно.',
        'Выгрузка чанка приостанавливает часы. Серверный прогресс сохраняется; /lh status показывает детали.',
        'При пропуске нормы испытание проваливается. /lh abort останавливает заказ; уже потреблённые товары не возвращаются.',
        'Пока это доказательство ритма ПРИЁМКИ, а не изготовления на месте. Можно снабжать из запаса.',
    ]),
    ('alpha_limits', 'Честные границы прототипа', 'minecraft:comparator', [
        'Проверка реального train ID, расхода топлива и семантики содержимого фотографии на уровне Java-адаптера ещё не подключена.',
        'Шалкеры, эндер-сундуки, мешки и сейфы Supplementaries отключены в крафте, луте и при взаимодействии. Выездные лагеря проверяют пустоту контейнеров перед сворачиванием.',
        'Для кооператива доступен общий консорциум: /lh team join <имя>.',
    ]),
    ('alpha_world', 'Мир и региональные узлы', 'minecraft:compass', [
        'Natural Temperature и Cold Sweat отсутствуют. Фермерство не заперто в старых климатических поясах.',
        'Граница обычного мира: 175000 блоков, центр 0,0. Планировщик размещает 8 экономических центров, Архив и Узел консорциума внутри ±84000.',
        'Посмотреть направления: /lh sites и /lh site info <id>.',
    ]),
    ('alpha_photo', 'Фотодокументация', 'exposure:camera', [
        'Exposure добавлен: камера, плёнка, проявка и альбомы.',
        'Снимайте фабрики, лагеря и маршруты (/lh photo report <узел> и /lh catalog verify <id>). Уникальный токен снимка нельзя использовать дважды.',
    ]),
]
for i, (qid, title, icon, desc) in enumerate(intro):
    quest(qid, title, '01 · Начало и правила', [(i % 3 - 1) * 84, (i // 3) * 72 - 36], icon,
          {'read': {'type': 'heracles:check', 'title': 'Прочитано (ручное подтверждение)'}}, desc)

items = [
    ('waterwheel', 'Источник кинетики', 'create:water_wheel', 'Водяное колесо — начало механической мастерской.'),
    ('press', 'Обработка металла', 'create:mechanical_press', 'Пресс штампует пластины. Далее используйте их для заказов терминала.'),
    ('mixer', 'Сплавы', 'create:mechanical_mixer', 'Миксер смешивает сплавы; продумайте подачу ингредиентов и подогрев.'),
    ('brass', 'Латунная мастерская', 'create:brass_ingot', 'Латунь открывает точные механизмы и новую автоматизацию.'),
    ('precision', 'Точная сборка', 'create:precision_mechanism', 'Механизм нужен для промышленного оборудования. Изучите последовательную сборку в JEI.'),
    ('track', 'Железнодорожный путь', 'create:track', 'Рельсы — только начало линии. Инвентарное задание НЕ доказывает наличие дороги.'),
    ('station', 'Грузовая станция', 'create:track_station', 'Спроектируйте погрузку и разгрузку. Проверка рейсов конкретного поезда появится отдельно.'),
    ('computer', 'Промышленный компьютер', 'computercraft:computer_normal', 'CC: Tweaked — локальная автоматизация. Программа longhaul_depot следит за запасом склада.'),
    ('camera', 'Камера экспедиции', 'exposure:camera', 'Фотографируйте открытия; берите запас плёнки.'),
    ('film', 'Запас плёнки', 'exposure:black_and_white_film', 'Чёрно-белая плёнка нужна для первых полевых снимков.'),
    ('album', 'Альбом маршрута', 'exposure:album', 'Соберите фотографии городов, мостов и этапов фабрики.'),
    ('cookpot', 'Походное снабжение', 'farmersdelight:cooking_pot', 'Farmer’s Delight связывает урожай и готовку. Держите запас для длительных рейсов.'),
]
for i, (qid, title, item, desc) in enumerate(items):
    quest('tutorial_' + qid, title, '02 · Мастерская и экспедиция', [(i % 4) * 84 - 126, (i // 4) * 72 - 72], item,
          {'item': {'type': 'heracles:item', 'item': item, 'amount': 1, 'collection': 'AUTOMATIC'}},
          ['Учебная веха: обнаружение предмета, НЕ испытание работающего предприятия.', desc])

contracts = [
    ('plates', 'Первая партия пластин', 'create:iron_sheet', '64 железные пластины.'),
    ('brass', 'Латунный заказ', 'create:brass_ingot', '32 латунных слитка.'),
    ('rails', 'Снабжение путейцев', 'create:track', '128 рельсов Create.'),
    ('provisions', 'Продовольственный склад', 'minecraft:bread', '32 хлеба И 32 печёные картофелины.'),
    ('mechanisms', 'Приборы для депо', 'create:precision_mechanism', '8 точных механизмов.'),
    ('plate_shift', 'Ритм поставки пластин', 'create:iron_sheet', '16 пластин за каждое из трёх окон по 60 секунд.'),
    ('food_shift', 'Регулярное снабжение', 'minecraft:baked_potato', '8 хлеба И 8 печёных картофелин за каждое из трёх окон по 60 секунд.'),
    ('rail_shift', 'Снабжение магистрали', 'create:track', '32 рельса И 8 пластин за каждое из пяти окон по 60 секунд.'),
]
for i, (qid, title, icon, detail) in enumerate(contracts):
    adv('contracts/' + qid, 15)
    quest('contract_' + qid, title, '03 · Контрольные поставки', [(i % 4) * 84 - 126, (i // 4) * 72 - 36], icon,
          {'receipt': {'type': 'heracles:advancement', 'title': 'Подтверждение серверной приёмки', 'advancements': ['longhaul:contracts/' + qid]}},
          ['Начало: /lh accept ' + qid, detail, 'Нужно реально передать товары в зарегистрированную бочку после принятия заказа. Наличие предметов в инвентаре не завершает этот квест.', 'Товары расходуются. Статус: /lh status.'])

sites = [
    ('forest', 'Лесная артель', 'longhaul:treated_timber', 'Пропитанная древесина'),
    ('farm', 'Речной агрогород', 'longhaul:field_rations', 'Экспедиционные рационы'),
    ('mine', 'Горный рудник', 'longhaul:ore_concentrate', 'Рудный концентрат'),
    ('port', 'Морской порт', 'longhaul:marine_reagent', 'Морской реагент'),
    ('badlands', 'Карьер пустошей', 'longhaul:refractory_mix', 'Огнеупорная смесь'),
    ('smelter', 'Стекольная долина', 'longhaul:technical_glass', 'Техническое стекло'),
    ('wetland', 'Химический посёлок', 'longhaul:technical_oil', 'Техническое масло'),
    ('machine', 'Машиностроительный центр', 'longhaul:machine_parts', 'Прецизионные узлы'),
]
for i, (sid, title, prod, prod_name) in enumerate(sites):
    adv('sites/' + sid, 20)
    adv('production/' + sid, 30)
    quest('site_' + sid, title + ': ввод в строй', '04 · Экономические центры', [(i % 4) * 84 - 126, (i // 4) * 144 - 72],
          'minecraft:barrel',
          {'commission': {'type': 'heracles:advancement', 'title': 'Регистрация площадки на месте', 'advancements': ['longhaul:sites/' + sid]}},
          ['Найдите площадку через /lh sites и /lh site info ' + sid + '.', 'Встаньте НА бочку в радиусе 128 м от координат узла и выполните /lh site commission ' + sid + '.'])
    quest('prod_' + sid, title + ': ' + prod_name, '04 · Экономические центры', [(i % 4) * 84 - 126, (i // 4) * 144],
          prod,
          {'produce': {'type': 'heracles:advancement', 'title': 'Местный выпуск продукции', 'advancements': ['longhaul:production/' + sid]}},
          ['Выпустите партию ' + prod_name + ' непосредственно на площадке: /lh site produce ' + sid + ' bootstrap (или industrial).', 'Удалённое производство на домашней базе заблокировано сервером.'],
          deps=['site_' + sid])

adv('sites/continental_archive', 50)
quest('site_continental_archive', 'Центральный архив магистралей', '04 · Экономические центры', [-42, 216], 'minecraft:writable_book',
      {'archive': {'type': 'heracles:advancement', 'title': 'Однократная фиксация уникального объекта', 'advancements': ['longhaul:sites/continental_archive']}},
      ['Экспедиция к уникальному архиву (/lh site info continental_archive).', 'Подойдите ближе 96 м и выполните /lh site archive. Для ремонта конструкции: /lh site repair_archive (повторные награды не выдаются).'])

adv('sites/continental_hub', 40)
adv('production/continental_hub', 100)
quest('site_continental_hub', 'Континентальный узел консорциума', '04 · Экономические центры', [42, 216], 'longhaul:continental_module',
      {'hub': {'type': 'heracles:advancement', 'title': 'Запуск финального узла', 'advancements': ['longhaul:production/continental_hub']}},
      ['Зарегистрируйте Континентальный узел (/lh site commission continental_hub) и соберите Континентальный модуль из продукции всех 8 центров (/lh site produce continental_hub industrial).'])

logistics = [
    ('expedition/first_camp', 'Первый полевой лагерь', 'minecraft:campfire',
     ['Отойдите минимум на 750 м от (0,0), поставьте костёр и спальник Comforts (<= 6 м) и выполните /lh camp deploy.'], []),
    ('expedition/three_camps', 'Сеть из трёх лагерей', 'comforts:sleeping_bag_red',
     ['Разверните 3 активных полевых лагеря на расстоянии >= 500 м друг от друга.'], ['logistics_first_camp']),
    ('routes/first_route', 'Испытание маршрута', 'minecraft:rail',
     ['Разметьте маршрут длиной >= 750 м: /lh route begin <имя>, добавьте контрольные точки (/lh route gate), завершите (/lh route finish) и пройдите на транспорте (/lh route start <имя>).', 'Аномальная скорость (> 85 м/с, телепорт) отменяет испытание.'], []),
    ('routes/cargo_delivery', 'Серверная грузовая накладная', 'longhaul:cargo_manifest',
     ['Получите накладную на одном узле (/lh cargo issue <откуда> <куда>), физически доставьте её в целевой узел и сдайте (/lh cargo deliver).'], []),
]
for i, (adv_id, title, icon, desc, deps) in enumerate(logistics):
    adv(adv_id, 25)
    qid = 'logistics_' + adv_id.split('/')[-1]
    quest(qid, title, '05 · Маршруты и лагеря', [(i % 4) * 84 - 126, 0], icon,
          {'verified': {'type': 'heracles:advancement', 'title': 'Серверное подтверждение', 'advancements': ['longhaul:' + adv_id]}},
          desc, deps=deps)

recoveries = [
    ('sawmill', 'Восстановление лесопилки', 'create:mechanical_saw', 'Подайте 16 железа, 16 андезитового сплава, 32 бревна и установите пилу/водяное колесо.'),
    ('quarry', 'Карьер с повреждённым подъездом', 'create:mechanical_drill', 'Подайте 24 пластины, 32 рельса, 64 булыжника и смонтируйте бур/дробилку/станцию.'),
    ('river_port', 'Восстановление речного порта', 'create:portable_storage_interface', 'Подайте 64 доски, 16 железа, 2 интерфейса и смонтируйте перегрузочный узел.'),
    ('sorting_yard', 'Сортировочная станция', 'create:brass_funnel', 'Подайте 64 рельса, 16 латуни, 8 лент и смонтируйте станцию/сортировку.'),
    ('power_plant', 'Восстановление энергоузла', 'create:steam_engine', 'Подайте 32 меди, 16 латуни, 48 угля и установите паровую/генераторную установку.'),
    ('collapsed_bridge', 'Магистральный мост', 'create:metal_girder', 'Подайте 24 балки, 48 рельсов, 64 каменного кирпича и восстановите рельсовый переход.'),
]
for i, (rid, title, icon, detail) in enumerate(recoveries):
    adv('recovery/' + rid, 40)
    quest('recovery_' + rid, title, '06 · Восстановление и полевые отчёты', [(i % 3) * 84 - 84, (i // 3) * 72 - 108], icon,
          {'restored': {'type': 'heracles:advancement', 'title': 'Серверное восстановление объекта', 'advancements': ['longhaul:recovery/' + rid]}},
          ['Обследуйте объект (/lh recovery list, /lh recovery survey ' + rid + ').', detail, 'Встаньте на ремонтную бочку и выполните /lh recovery restore ' + rid + '.'])

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
    quest('photo_' + sid, title, '06 · Восстановление и полевые отчёты', [(i % 5) * 84 - 168, (i // 5) * 72 + 54], 'exposure:photograph',
          {'photo': {'type': 'heracles:advancement', 'title': 'Уникальный полевой снимок', 'advancements': ['longhaul:photo/' + sid]}},
          ['Сделайте снимок Exposure на месте (<= 160 м от узла) и выполните /lh photo report ' + sid + '.', 'Один снимок нельзя использовать для двух разных узлов.'])

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
    quest('cc_' + sid, title, '06 · Восстановление и полевые отчёты', [(i % 4) * 84 - 126, (i // 4) * 72 + 210], 'computercraft:computer_normal',
          {'telemetry': {'type': 'heracles:advancement', 'title': 'Подтверждение телеметрии и запаса', 'advancements': ['longhaul:cc/' + sid]}},
          ['Запустите /lh cc challenge ' + sid + ', установите компьютер CC: Tweaked в 12 м от бочки узла и обеспечьте реальный запас продукции в бочке, затем /lh cc verify ' + sid + '.'],
          deps=['site_' + sid])

# Full 240-spec catalog from design/quest-catalog.json -> groups 07..11
CHAPTER_GROUPS = {
    'Основная прогрессия': '07 · Кампания: Основная прогрессия',
    'Региональные контракты': '08 · Кампания: Региональные контракты',
    'Инженерные испытания': '09 · Кампания: Инженерные испытания',
    'Экспедиционная документация': '10 · Кампания: Фотодокументация',
    'Лагеря и экспедиции': '11 · Кампания: Лагеря и экспедиции',
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
    'kit_check': 'exposure:camera',
    'ration_delivery': 'longhaul:field_rations',
    'sample_return': 'longhaul:ore_concentrate',
}

UNTRACKED_VEHICLE_TYPES = {'vehicle_delivery', 'scheduled_train', 'vehicle_trial'}

catalog = json.loads((R / 'design/quest-catalog.json').read_text())['quests']
group_indices = {g: 0 for g in CHAPTER_GROUPS.values()}
compact_catalog = []

for q in catalog:
    qid = q['id']
    grp = CHAPTER_GROUPS[q['chapter']]
    idx = group_indices[grp]
    group_indices[grp] += 1
    vt = q['verification_type']
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
    pos = [(idx % cols) * 84 - (cols * 42) + 42, (idx // cols) * 72 - 144]
    quest(
        'cat_' + qid,
        q['title'],
        grp,
        pos,
        icon,
        {'catalog_verified': {'type': 'heracles:advancement', 'title': 'Серверная проверка заказа', 'advancements': ['longhaul:catalog/' + qid]}},
        desc,
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

(O / 'kubejs/startup_scripts/02_quest_catalog.js').write_text(
    '// Auto-generated from design/quest-catalog.json by tools/generate_alpha_quests.py\n'
    'global.LHQuestCatalog = ' + json.dumps(compact_catalog, ensure_ascii=False) + ';\n'
)

(O / 'config/heracles/groups.txt').write_text(
    '01 · Начало и правила\n'
    '02 · Мастерская и экспедиция\n'
    '03 · Контрольные поставки\n'
    '04 · Экономические центры\n'
    '05 · Маршруты и лагеря\n'
    '06 · Восстановление и полевые отчёты\n'
    '07 · Кампания: Основная прогрессия\n'
    '08 · Кампания: Региональные контракты\n'
    '09 · Кампания: Инженерные испытания\n'
    '10 · Кампания: Фотодокументация\n'
    '11 · Кампания: Лагеря и экспедиции\n'
)
total_q = len(list(Q.glob('*.json')))
total_adv = len(list(ADV_ROOT.rglob('*.json')))
print(f'Generated {total_q} real Heracles quests ({len(compact_catalog)} catalog + {total_q - len(compact_catalog)} core) + {total_adv} server-only advancements.')
