"""Core chapters 00..14 of Long Haul Legacy 2.0 (~443 quests) with full rewards & clean layouts."""
import json
from .common import (
    GENERATED_QUESTS, R, O, adv, quest, r_xp, r_item, r_choice, tier_rewards,
    t_item, t_check, t_adv,
)


def build_core_chapters():
    # -----------------------------------------------------------------------
    # 00 · Сюжет: Ушёл за хлебом (5 quests)
    # -----------------------------------------------------------------------
    story_ch00 = [
        ('story_01_left_for_bread', 'Глава I: Ушёл в магазин за хлебом', 'minecraft:bread', [-220, 0], [
            'Поздравляем — у вас родился сын! Жена попросила сходить в ближайшую лавку за свежей буханкой хлеба и бутылкой молока.',
            'Задача главы: выйти в мир (выдаётся автоматически при входе в мир; если не засчиталось — выполните /lh stage).',
        ], [], {'xp': r_xp(50, 'POINTS'), 'item': r_item('minecraft:bread', 4)}),
        ('story_02_bakery_burned', 'Глава II: Пекарня сгорела — нужен свой хлеб', 'minecraft:wheat', [-110, 0], [
            'Ближайшая пекарня оказалась закрыта на переучёт, так что придётся раздобыть или испечь первую буханку хлеба самостоятельно.',
            'Задача: держите в инвентаре буханку хлеба (minecraft:bread) — сервер автоматически засчитает этап.',
        ], ['story_01_left_for_bread'], {'xp': r_xp(60, 'POINTS'), 'choice': r_choice([('minecraft:wheat', 16), ('minecraft:oak_log', 16), ('minecraft:coal', 8)])}),
        ('story_04_snail_at_door', 'Глава IV: Заодно и молоко', 'minecraft:milk_bucket', [0, 0], [
            'Пока вы решали вопрос с хлебом, вспомнили про вторую половину просьбы — ведро свежего молока.',
            'Задача: наберите ведро молока (minecraft:milk_bucket) в инвентарь (сервер зачтёт этап автоматически).',
        ], ['story_02_bakery_burned'], {'xp': r_xp(80, 'POINTS'), 'item': r_item('minecraft:iron_ingot', 4)}),
        ('story_05_continental_bakery', 'Глава V: Первая штамповка для пекарни', 'create:mechanical_press', [110, 0], [
            'Чтобы открыть путь дальше в окрестности, пора перейти от ручной работы к первому механизму Create или стартовой поставке.',
            'Задача: скрафтите Механический пресс (create:mechanical_press) ИЛИ закройте контракт /lh accept plates (64 железные пластины).',
        ], ['story_04_snail_at_door'], {'xp': r_xp(1, 'LEVEL'), 'item': r_item('create:andesite_alloy', 12)}),
        ('story_06_forgot_the_milk', 'Эпилог пролога: Долгая дорога начинается', 'minecraft:compass', [220, 0], [
            'Хлеб и молоко собраны, базовый инструмент готов, а граница мира готова к первому крупному расширению!',
            'Задача: скрафтите Компас (minecraft:compass) и выполните /lh stage. Завершение Главы 00 расширяет территорию и запускает Колесо Угроз!',
        ], ['story_05_continental_bakery'], {'xp': r_xp(2, 'LEVEL'), 'item': r_item('longhaul:field_rations', 4)}),
    ]
    for i, (qid, title, icon, pos, desc, deps, rew) in enumerate(story_ch00):
        adv_name = 'story/' + qid[len('story_'):]
        adv(adv_name, 30 + i * 20)
        quest(qid, title, '00 · Сюжет: Ушёл за хлебом', pos, icon,
              {'story': {'type': 'heracles:advancement', 'title': 'Хроника «Ушёл за хлебом»', 'advancements': ['longhaul:' + adv_name]}},
              desc, deps=deps, subtitle='Long Haul Legacy 2.0 · Пролог', rewards=rew)

    # -----------------------------------------------------------------------
    # 01 · Начало и правила (16 quests, 3 clean lanes + Глава III)
    # -----------------------------------------------------------------------
    adv('story/03_dinner_telegram', 45)
    adv('rules/confirmed', 25)
    ch01_nodes = [
        ('alpha_welcome', 'Прототип промышленной сети', 'minecraft:book', [-320, 0],
         t_check('Прочитано (ручное подтверждение)'), [
             'Это расширяемая сборка Long Haul Legacy 2.0: 8 экономических центров (реальные .nbt площадки), 6 объектов восстановления, лагеря, маршрутные испытания, ядерная энергетика, Draconic Evolution, магия (Primal Magick, Thaumon, Hex Casting) и 240 заказов каталога.',
             'Подтверждение чтения — ручное; в конце ветки подтвердите устав через /lh rules confirm.',
         ], ['story_01_left_for_bread'], {'xp': r_xp(50, 'POINTS'), 'item': r_item('minecraft:torch', 16)}),
        # Top lane (y = -110)
        ('alpha_terminal', 'Как зарегистрировать терминал', 'minecraft:barrel', [-200, -110],
         t_check('Правила терминала изучены'), [
             'Поставьте пустую обычную бочку. Встаньте на неё и выполните /lh terminal.',
             'Посмотрите /lh help (или ПКМ Планшетом управления), затем /lh accept plates. Заказ начнётся только при пустой бочке.',
         ], ['alpha_welcome'], {'xp': r_xp(60, 'POINTS'), 'item': r_item('minecraft:barrel', 2)}),
        ('story_03_dinner_telegram', 'Глава III: Обещал вернуться к ужину…', 'minecraft:barrel', [-80, -110],
         t_adv('longhaul:story/03_dinner_telegram', 'Регистрация терминала (/lh terminal)'), [
             'Из дома пришла телеграмма: «Ты где? Хлеб можно уже не тёплый». Без собственного приёмного терминала заказы консорциума не оформить.',
             'Задача: поставьте пустую обычную бочку (minecraft:barrel), встаньте на неё и выполните /lh terminal (перенесено из Пролога в Главу 01).',
         ], ['alpha_terminal'], {'xp': r_xp(1, 'LEVEL'), 'item': r_item('minecraft:hopper', 2)}),
        ('alpha_windows', 'Что измеряют испытания', 'minecraft:clock', [40, -110],
         t_check('Механика окон понята'), [
             'Контракты с суффиксом _shift считают норму в КАЖДОМ окне по 60 игровых секунд. Один полный сундук не завершает испытание мгновенно.',
             'При пропуске нормы испытание проваливается. /lh abort останавливает заказ.',
         ], ['story_03_dinner_telegram'], {'xp': r_xp(60, 'POINTS'), 'item': r_item('minecraft:redstone', 8)}),
        ('alpha_limits', 'Честные границы прототипа', 'minecraft:comparator', [160, -110],
         t_check('Ограничения приняты'), [
             'Шалкеры, эндер-сундуки, мешки, сейфы Supplementaries, джетпаки и дислокаторы/заклинания дальней телепортации отключены.',
             'Для кооператива доступен общий консорциум: /lh team join <имя> или компании OpenTTD (/lh company create).',
         ], ['alpha_windows'], {'xp': r_xp(75, 'POINTS'), 'item': r_item('minecraft:iron_ingot', 4)}),
        ('alpha_coop_guide', 'Кооператив и команды консорциума', 'minecraft:emerald', [280, -110],
         t_check('Правила кооперации изучены'), [
             'Создайте команду (/lh team join <название>) для общего зачёта контрактов и узлов, либо конкурируйте в OpenTTD-экономике (/lh company create).',
         ], ['alpha_limits'], {'xp': r_xp(75, 'POINTS'), 'item': r_item('minecraft:emerald', 3)}),

        # Middle lane (y = 0)
        ('alpha_world', 'Мир и региональные узлы', 'minecraft:compass', [-200, 0],
         t_check('Устройство мира изучено'), [
             'Мир построен на связке Tectonic (высота до Y=448), Terralith, Biomes O\' Plenty, Regions Unexplored и Alex\'s Caves.',
             'Полная граница обычного мира: 175000 блоков (центр 0,0), открывается постепенно по всем 14 основным главам!',
         ], ['alpha_welcome'], {'xp': r_xp(60, 'POINTS'), 'item': r_item('minecraft:map', 2)}),
        ('alpha_territory_casino', 'Территория (14 этапов), k и Колесо Угроз', 'minecraft:nether_star', [-80, 0],
         t_check('Законы территории и угроз изучены'), [
             'Граница мира расширяется через 14 основных глав (13 шагов расширения до 175000): Area(u) = 724² + (175000² - 724²) * (1 - (1 - u/13)²).',
             'Коэффициент сложности k = 1 + 95 * (D/n) / 63.15 (/lh difficulty). Каждая глава крутит Колесо Угроз из 20 усложнений (/lh casino status).',
         ], ['alpha_world'], {'xp': r_xp(1, 'LEVEL'), 'item': r_item('minecraft:golden_apple', 1)}),
        ('alpha_voidout', 'Выброс при смерти (Voidout), трупы и тотемы', 'minecraft:totem_of_undying', [40, 0],
         t_check('Протокол Voidout изучен'), [
             'Когда Колесо Угроз активирует Voidout, настоящая смерть вызывает взрыв силой 1.0 × k (/lh voidout status).',
             'Инвентарь сохраняется в трупе (Corpse), а Тотем бессмертия спасает от детонации.',
         ], ['alpha_territory_casino'], {'xp': r_xp(80, 'POINTS'), 'item': r_item('minecraft:gold_ingot', 4)}),
        ('alpha_toxic_gas_sky', 'Сезонный токсичный газ и летающие острова', 'minecraft:campfire', [160, 0],
         t_check('Правила укрытия в горах изучены'), [
             'Токсичный газ поднимается циклами по 4 игровых дня (до Y=114), затем отступает в Чистый сезон (/lh gas status).',
             'Обустраивайте горные базы в Tectonic и на небесных островах (sky_refuges Y=210..260).',
         ], ['alpha_voidout'], {'xp': r_xp(80, 'POINTS'), 'item': r_item('minecraft:campfire', 2)}),
        ('alpha_rules_confirm', 'Подтвердить устав консорциума', 'minecraft:writable_book', [280, 0],
         t_adv('longhaul:rules/confirmed', 'Подтверждение (/lh rules confirm)'), [
             'Прочитайте правила, зарегистрируйте бочку (/lh terminal) и выполните команду /lh rules confirm.',
             'Эта веха завершает Главу 01, расширяет границу мира и запускает Колесо Угроз.',
         ], ['alpha_limits', 'alpha_toxic_gas_sky'], {'xp': r_xp(2, 'LEVEL'), 'item': r_item('longhaul:field_rations', 4)}),

        # Bottom lane (y = +110)
        ('alpha_eccentric_tome', 'Единая книга гайдов (Eccentric Tome)', 'eccentrictome:tome', [-200, 110],
         t_check('Руководство Eccentric Tome прочитано'), [
             'Все книги-гайды модов можно объединить с Eccentric Tome в верстаке. ПКМ выбирает книгу, Shift+ЛКМ извлекает.',
         ], ['alpha_welcome'], {'xp': r_xp(50, 'POINTS'), 'item': r_item('eccentrictome:tome', 1)}),
        ('alpha_control_tablet', 'Планшет управления (/lh GUI)', 'longhaul:control_tablet', [-80, 110],
         t_item('longhaul:control_tablet', 1), [
             'Планшет управления (longhaul:control_tablet) открывает серверный GUI с 11 вкладками (/lh gui).',
         ], ['alpha_eccentric_tome'], {'xp': r_xp(1, 'LEVEL'), 'item': r_item('minecraft:iron_ingot', 4)}),
        ('alpha_pollution_arcane', 'Экология среды и Три Школы Магии', 'minecraft:cauldron', [40, 110],
         t_check('Введение в экологию и аркану пройдено'), [
             'Pollution of the Realms создаёт выбросы дыма — ставьте дымоходы Advanced Chimneys. В сборке 3 ветки магии: Primal Magick, Thaumon и Hex Casting.',
         ], ['alpha_control_tablet'], {'xp': r_xp(60, 'POINTS'), 'item': r_item('minecraft:amethyst_shard', 6)}),
        ('alpha_storage_basics', 'Стартовая организация хранения', 'minecraft:chest', [160, 110],
         t_item('minecraft:chest', 4), [
             'Сделайте 4 сундука или ящики Functional Storage для сортировки ресурсов. Помните: шалкеры и эндер-сундуки отключены!',
         ], ['alpha_pollution_arcane'], {'xp': r_xp(60, 'POINTS'), 'item': r_item('minecraft:oak_planks', 32)}),
        ('alpha_first_camp_prep', 'Подготовка полевого набора', 'comforts:sleeping_bag_red', [280, 110],
         t_item('minecraft:campfire', 1), [
             'Перед первым выходом в дальнюю разведку подготовьте костёр, спальник Comforts и запас еды Farmer\'s Delight.',
         ], ['alpha_storage_basics'], {'xp': r_xp(70, 'POINTS'), 'item': r_item('minecraft:cooked_beef', 6)}),
    ]
    for qid, title, icon, pos, tasks, desc, deps, rew in ch01_nodes:
        quest(qid, title, '01 · Начало и правила', pos, icon, tasks, desc, deps=deps, rewards=rew)

    # -----------------------------------------------------------------------
    # 02 · Мастерская и обзор модов (24 quests, 4 clean horizontal lanes)
    # -----------------------------------------------------------------------
    ch02_nodes = [
        # Lane 1 (y = -180): Create & Heavy Industry
        ('tutorial_waterwheel', '1.1 · Кинетика Create', 'create:water_wheel', [-300, -180],
         t_item('create:water_wheel', 1), [
             'Водяное колесо и ветряк (Create) — основа мастерской. Подробные ветки Create находятся в Главах 19–22.',
         ], ['story_02_bakery_burned'], {'xp': r_xp(60, 'POINTS'), 'item': r_item('create:wrench', 1)}),
        ('tutorial_press', '1.2 · Штамповка и металлургия', 'create:mechanical_press', [-180, -180],
         t_item('create:mechanical_press', 1), [
             'Механический пресс штампует пластины; Create Metallurgy, Create Sifting и Mechanical Extruder расширяют переработку.',
         ], ['tutorial_waterwheel'], {'xp': r_xp(1, 'LEVEL'), 'item': r_item('create:iron_sheet', 8)}),
        ('tutorial_mixer', '1.3 · Сплавы, бурение и топливо', 'create:mechanical_mixer', [-60, -180],
         t_item('create:mechanical_mixer', 1), [
             'Миксер варит сплавы. Create Ore Excavation бурит жилы, а Diesel Generators, Liquid Fuel и New Age питают цеха.',
         ], ['tutorial_press'], {'xp': r_xp(1, 'LEVEL'), 'item': r_item('create:andesite_alloy', 12)}),
        ('tutorial_brass', '1.4 · Латунная логистика и хранилища', 'create:brass_ingot', [60, -180],
         t_item('create:brass_ingot', 1), [
             'Латунь открывает умные фильтры, Factory Logistics, Vibrant Vaults, Functional Storage, Iron Chests/Barrels.',
         ], ['tutorial_mixer'], {'xp': r_xp(1, 'LEVEL'), 'item': r_item('create:brass_ingot', 4)}),
        ('tutorial_precision', '1.5 · Точные механизмы и оптика', 'create:precision_mechanism', [180, -180],
         t_item('create:precision_mechanism', 1), [
             'Точный механизм — ключ к Create Optical, Enchantment Industry, Create Big Cannons, Radars и Pattern Schematics.',
         ], ['tutorial_brass'], {'xp': r_xp(2, 'LEVEL'), 'item': r_item('create:brass_casing', 4)}),
        ('mod_heavy_industry', '1.6 · Тяжёлая индустрия и логистические сети', 'immersiveengineering:dynamo', [300, -180],
         t_check('Изучены многоблочные заводы и роутинг'), [
             'Immersive Engineering/Petroleum/Geology, PneumaticCraft, Integrated Dynamics, SFM и Modular Routers (подробно в Главах 23–27).',
         ], ['tutorial_precision'], {'xp': r_xp(2, 'LEVEL'), 'item': r_item('immersiveengineering:hammer', 1)}),

        # Lane 2 (y = -60): Transport & CC
        ('tutorial_track', '2.1 · Магистральные рельсы и Railcraft', 'create:track', [-300, -60],
         t_item('create:track', 1), [
             'Пути Create дополнены Railcraft Reborn, More Minecarts, Hypertube, Copycats+, Deco и Bells & Whistles (Глава 28).',
         ], ['tutorial_waterwheel'], {'xp': r_xp(60, 'POINTS'), 'item': r_item('create:track', 16)}),
        ('tutorial_station', '2.2 · Станции, навигатор и малая логистика', 'create:track_station', [-180, -60],
         t_item('create:track_station', 1), [
             'Станции Create, Create Railways Navigator, Escalated и Little Logistics образуют сеть грузоперевозок.',
         ], ['tutorial_track'], {'xp': r_xp(1, 'LEVEL'), 'item': r_item('create:schedule', 2)}),
        ('mod_road_vehicles', '2.3 · Дорожный транспорт и повозки', 'minecraft:minecart', [-60, -60],
         t_check('Освоен наземный транспорт'), [
             'AstikorCarts Redux, Automobility и Ultimate Car Mod для дорог, фур и грунтовых экспедиций (Глава 29).',
         ], ['tutorial_station'], {'xp': r_xp(1, 'LEVEL'), 'item': r_item('minecraft:coal', 16)}),
        ('mod_ships_vs', '2.4 · Флот и физика Valkyrien Skies', 'minecraft:oak_boat', [60, -60],
         t_check('Освоены корабли и физические конструкции'), [
             'Small Ships и физика Valkyrien Skies + Eureka! Ships + Create: Clockwork + Trackwork (Глава 30).',
         ], ['mod_road_vehicles'], {'xp': r_xp(2, 'LEVEL'), 'item': r_item('minecraft:oak_log', 16)}),
        ('mod_airships', '2.5 · Авиация и паркур (без джетпаков)', 'minecraft:elytra', [180, -60],
         t_check('Освоены самолёты и мобильность'), [
             'Immersive Aircraft и Man of Many Planes, а также ParCool!, Grappling Hook и Combat Roll (Глава 31).',
         ], ['mod_ships_vs'], {'xp': r_xp(2, 'LEVEL'), 'item': r_item('minecraft:leather', 8)}),
        ('tutorial_computer', '2.6 · Вычислительная автоматизация (CC)', 'computercraft:computer_normal', [300, -60],
         t_item('computercraft:computer_normal', 1), [
             'CC: Tweaked, CC:C Bridge и Tom\'s Peripherals связывают поезда Create и склады (подробнее в Главе 32).',
         ], ['tutorial_precision'], {'xp': r_xp(2, 'LEVEL'), 'item': r_item('computercraft:cable', 8)}),

        # Lane 3 (y = +60): Food, Biomes, Caves/Bosses, Gear & Architecture
        ('tutorial_cookpot', '3.1 · Полевая кухня и рыболовство', 'farmersdelight:cooking_pot', [-300, 60],
         t_item('farmersdelight:cooking_pot', 1), [
             'Farmer\'s Delight и 12 тематических аддонов + Diet + Culinary Construct + Aquaculture 2 (Главы 38–41).',
         ], ['story_02_bakery_burned'], {'xp': r_xp(60, 'POINTS'), 'item': r_item('farmersdelight:tomato', 6)}),
        ('mod_brewing_bees', '3.2 · Виноделие, чаи, сады и пчеловодство', 'minecraft:honeycomb', [-180, 60],
         t_check('Изучены ферментация и пасеки'), [
             'Brewin\' And Chewin\', [Let\'s Do] Vinery, HerbalBrews, Fruit Trees и Productive Bees (Главы 40 и 42).',
         ], ['tutorial_cookpot'], {'xp': r_xp(1, 'LEVEL'), 'item': r_item('minecraft:honeycomb', 6)}),
        ('mod_world_biomes', '3.3 · Биомы, компасы и картография', 'minecraft:filled_map', [-60, 60],
         t_check('Подготовлена разведка биомов'), [
             'Tectonic, Terralith, Biomes O\' Plenty, Regions Unexplored, Atmospheric/Autumnity/Environmental/Ecologics (Главы 47–48).',
         ], ['mod_brewing_bees'], {'xp': r_xp(1, 'LEVEL'), 'item': r_item('minecraft:compass', 1)}),
        ('mod_caves_bosses', '3.4 · Пещеры, данжи, фауна и боссы', 'minecraft:spyglass', [60, 60],
         t_check('Изучены пещеры и боссы мира'), [
             'Alex\'s Caves, Alex\'s Mobs, Naturalist, YUNG\'s, Dungeons Arise, IDAS, Cataclysm, Aquamirae, Mowzie\'s Mobs, Lootr (Главы 49–52).',
         ], ['mod_world_biomes'], {'xp': r_xp(2, 'LEVEL'), 'item': r_item('minecraft:spyglass', 1)}),
        ('mod_gear_combat', '3.5 · Вооружение: Tetra, TaCZ и зачарования', 'minecraft:anvil', [180, 60],
         t_check('Изучены модульное оружие и огнестрел'), [
             'Tetra + Extras, Simply Swords, Immersive Armors, Timeless and Classics Zero (TaCZ), Easy Anvils/Magic (Главы 17–18).',
         ], ['mod_caves_bosses'], {'xp': r_xp(2, 'LEVEL'), 'item': r_item('minecraft:iron_ingot', 6)}),
        ('mod_architecture', '3.6 · Архитектура, декор и быт баз', 'minecraft:bricks', [300, 60],
         t_check('Изучены строительные и QoL-моды'), [
             'FramedBlocks, Chipped, Rechiseled, Quark, Supplementaries, Macaw\'s Suite, Effortless Building, Ultimate Chess (Главы 53–57).',
         ], ['mod_gear_combat'], {'xp': r_xp(2, 'LEVEL'), 'item': r_item('framedblocks:framed_cube', 16)}),

        # Lane 4 (y = +180): Arcane Sciences
        ('arcane_01_intro', '4.1 · Истоки арканы: аметист и кристаллы', 'minecraft:amethyst_shard', [-300, 180],
         t_item('minecraft:amethyst_shard', 1), [
             'Три магические ветки сборки: Primal Magick, Thaumon и Hex Casting (подробно в Главах 43–46).',
         ], ['alpha_pollution_arcane'], {'xp': r_xp(60, 'POINTS'), 'item': r_item('minecraft:amethyst_shard', 6)}),
        ('arcane_02_primal_magick', '4.2 · Primal Magick: алтари и теория', 'minecraft:enchanting_table', [-180, 180],
         t_check('Освоены основы Primal Magick'), [
             'Primal Magick: анализ стихий, исследования и жезлы (Главы 43–44).',
         ], ['arcane_01_intro'], {'xp': r_xp(1, 'LEVEL'), 'item': r_item('minecraft:lapis_lazuli', 8)}),
        ('arcane_03_thaumon', '4.3 · Thaumon: аура, порча и алхимия', 'minecraft:cauldron', [-60, 180],
         t_check('Изучены механики Thaumon'), [
             'Thaumon: тауматургические кристаллы, аура и алхимия (Глава 45).',
         ], ['arcane_02_primal_magick'], {'xp': r_xp(1, 'LEVEL'), 'item': r_item('minecraft:glowstone_dust', 8)}),
        ('arcane_04_hex_casting', '4.4 · Hex Casting: посох и стековая магия', 'hexcasting:staff/oak', [60, 180],
         t_check('Скрафчен посох и изучен фолиант Hex Casting'), [
             'Hex Casting: программируемая стековая магия на аметисте и The Hexonomicon (Глава 46).',
         ], ['arcane_01_intro'], {'xp': r_xp(2, 'LEVEL'), 'item': r_item('hexcasting:amethyst_dust', 8)}),
        ('arcane_05_hex_automation', '4.5 · Hex Casting: круги заклинаний и шифры', 'minecraft:observer', [180, 180],
         t_check('Освоены круги заклинаний Hex Casting'), [
             'Круги заклинаний, фокусы и свитки Hex Casting (Greater Teleport отключён правилами консорциума).',
         ], ['arcane_04_hex_casting'], {'xp': r_xp(2, 'LEVEL'), 'item': r_item('hexcasting:charged_amethyst', 2)}),
        ('arcane_06_synthesis', '4.6 · Магико-индустриальный синтез', 'minecraft:nether_star', [300, 180],
         t_check('Магические ветки объединены с индустрией'), [
             'Объедините заклинательные круги Hex Casting, алтари Primal Magick и кристаллы Thaumon с автоматикой Create и CC.',
         ], ['arcane_03_thaumon', 'arcane_05_hex_automation'], {'xp': r_xp(3, 'LEVEL'), 'item': r_item('minecraft:golden_apple', 2)}),
    ]
    for qid, title, icon, pos, tasks, desc, deps, rew in ch02_nodes:
        quest(qid, title, '02 · Мастерская и экспедиция', pos, icon, tasks, desc, deps=deps, rewards=rew)

    # -----------------------------------------------------------------------
    # 03 · Контрольные поставки (16 quests: 8 server contracts + 8 prep stages)
    # -----------------------------------------------------------------------
    contracts = [
        ('plates', 'Первая партия пластин', 'create:iron_sheet', [-180, -40], '64 железные пластины.', ['alpha_terminal', 'tutorial_press']),
        ('plate_shift', 'Ритм поставки пластин', 'create:iron_sheet', [-40, -130], '16 пластин за каждое из трёх окон по 60 секунд.', ['contract_plates']),
        ('brass', 'Латунный заказ', 'create:brass_ingot', [-40, -40], '32 латунных слитка.', ['contract_plates', 'tutorial_brass']),
        ('mechanisms', 'Приборы для депо', 'create:precision_mechanism', [100, -40], '8 точных механизмов.', ['contract_brass', 'tutorial_precision']),
        ('rails', 'Снабжение путейцев', 'create:track', [-40, 40], '128 рельсов Create.', ['contract_plates', 'tutorial_track']),
        ('rail_shift', 'Снабжение магистрали', 'create:track', [100, 40], '32 рельса И 8 пластин за каждое из пяти окон по 60 секунд.', ['contract_rails']),
        ('provisions', 'Продовольственный склад', 'minecraft:bread', [-180, 130], '32 хлеба И 32 печёные картофелины.', ['alpha_terminal', 'tutorial_cookpot']),
        ('food_shift', 'Регулярное снабжение', 'minecraft:baked_potato', [-40, 130], '8 хлеба И 8 печёных картофелин за каждое из трёх окон по 60 секунд.', ['contract_provisions']),
    ]
    for idx, (qid, title, icon, pos, detail, deps) in enumerate(contracts):
        adv('contracts/' + qid, 15)
        quest('contract_' + qid, title, '03 · Контрольные поставки', pos, icon,
              {'receipt': {'type': 'heracles:advancement', 'title': 'Подтверждение серверной приёмки', 'advancements': ['longhaul:contracts/' + qid]}},
              ['Начало: /lh accept ' + qid, detail, 'Нужно реально передать товары в зарегистрированную бочку после принятия заказа.', 'Товары расходуются. Статус: /lh status.'],
              deps=deps, rewards=tier_rewards(2 if idx < 3 else 3, idx))

    contract_preps = [
        ('cprep_01_iron_buffer', 'Буфер железной руды и слитков', 'minecraft:iron_ingot', [-310, -40], t_item('minecraft:iron_ingot', 32), 'contract_plates', 'Подготовьте стабильную выплавку железа для штамповки пластин.'),
        ('cprep_02_hopper_feed', 'Воронки и автоподача в бочку', 'minecraft:hopper', [-310, 40], t_item('minecraft:hopper', 4), 'contract_provisions', 'Подведите воронки или конвейеры Create к приёмной бочке.'),
        ('cprep_03_belt_line', 'Линия конвейеров от пресса', 'create:belt_connector', [-310, -130], t_item('create:belt_connector', 8), 'contract_plate_shift', 'Настройте автоматическую подачу пластин без ручной перекладки.'),
        ('cprep_04_potato_farm', 'Поле картофеля и пшеницы', 'minecraft:baked_potato', [-310, 130], t_item('minecraft:potato', 32), 'contract_food_shift', 'Обеспечьте бесперебойный урожай для продовольственных смен.'),
        ('cprep_05_brass_buffer', 'Бронзово-латунный буфер', 'create:brass_sheet', [230, -40], t_item('create:brass_sheet', 16), 'contract_mechanisms', 'Выпустите партию латунных листов для приборостроения.'),
        ('cprep_06_track_stock', 'Депо путевого запаса', 'create:andesite_alloy', [230, 40], t_item('create:andesite_alloy', 32), 'contract_rail_shift', 'Соберите резерв андезитового сплава для непрерывной укладки рельсов.'),
        ('cprep_07_chrono_audit', 'Контроль 60-секундных смен', 'minecraft:repeater', [230, -130], t_item('minecraft:repeater', 4), 'contract_plate_shift', 'Используйте повторители и счётчики для ровного ритма отгрузки.'),
        ('cprep_08_ration_pack', 'Экспедиционные пайки для выездов', 'longhaul:field_rations', [230, 130], t_item('longhaul:field_rations', 2), 'contract_food_shift', 'Соберите полевые рационы для дальних рейсов.'),
    ]
    for idx, (qid, title, icon, pos, tasks, dep, desc) in enumerate(contract_preps):
        quest(qid, title, '03 · Контрольные поставки', pos, icon, tasks, [desc], deps=[dep], rewards=tier_rewards(2, idx))

    # -----------------------------------------------------------------------
    # 04 · Экономические центры (22 quests)
    # -----------------------------------------------------------------------
    sites = [
        ('forest', 'Лесная артель', 'longhaul:treated_timber', 'Пропитанная древесина', -120, ['contract_rails', 'logistics_three_camps']),
        ('farm', 'Речной агрогород', 'longhaul:field_rations', 'Экспедиционные рационы', 0, ['contract_provisions', 'logistics_three_camps']),
        ('mine', 'Горный рудник', 'longhaul:ore_concentrate', 'Рудный концентрат', 120, ['contract_rails', 'logistics_first_route']),
        ('port', 'Морской порт', 'longhaul:marine_reagent', 'Морской реагент', -60, ['prod_forest', 'prod_farm']),
        ('badlands', 'Карьер пустошей', 'longhaul:refractory_mix', 'Огнеупорная смесь', 120, ['prod_mine']),
        ('wetland', 'Химический посёлок', 'longhaul:technical_oil', 'Техническое масло', -60, ['prod_port', 'prod_badlands']),
        ('smelter', 'Стекольная долина', 'longhaul:technical_glass', 'Техническое стекло', 60, ['prod_mine', 'prod_badlands']),
        ('machine', 'Машиностроительный центр', 'longhaul:machine_parts', 'Прецизионные узлы', 0, ['prod_smelter', 'prod_wetland']),
    ]
    tier_x = {
        'forest': (-380, -260), 'farm': (-380, -260), 'mine': (-380, -260),
        'port': (-130, -10), 'badlands': (-130, -10),
        'wetland': (120, 240), 'smelter': (120, 240), 'machine': (370, 490),
    }
    for idx, (sid, title, prod, prod_name, y_pos, sdeps) in enumerate(sites):
        sx, px = tier_x[sid]
        adv('sites/' + sid, 20)
        adv('production/' + sid, 30)
        quest('site_' + sid, title + ': ввод в строй', '04 · Экономические центры', [sx, y_pos],
              'minecraft:barrel',
              t_adv('longhaul:sites/' + sid, 'Регистрация площадки на месте'),
              ['Найдите площадку через /lh sites и /lh site info ' + sid + '.', 'Встаньте НА бочку в радиусе 128 м от координат узла и выполните /lh site commission ' + sid + '.'],
              deps=sdeps, rewards=tier_rewards(2, idx))
        quest('prod_' + sid, title + ': ' + prod_name, '04 · Экономические центры', [px, y_pos],
              prod,
              t_adv('longhaul:production/' + sid, 'Местный выпуск продукции'),
              ['Выпустите партию ' + prod_name + ' непосредственно на площадке: /lh site produce ' + sid + ' bootstrap (или industrial).'],
              deps=['site_' + sid], rewards=tier_rewards(3, idx, (prod, 2)))

    adv('sites/continental_archive', 50)
    quest('site_continental_archive', 'Центральный архив магистралей', '04 · Экономические центры', [610, -60], 'minecraft:writable_book',
          t_adv('longhaul:sites/continental_archive', 'Однократная фиксация уникального объекта'),
          ['Экспедиция к уникальному архиву (/lh site info continental_archive). Подойдите ближе 96 м и выполните /lh site archive.'],
          deps=['prod_machine'], rewards=tier_rewards(4, 0))

    adv('sites/continental_hub', 40)
    adv('production/continental_hub', 100)
    quest('site_continental_hub', 'Континентальный узел консорциума', '04 · Экономические центры', [610, 60], 'longhaul:continental_module',
          t_adv('longhaul:production/continental_hub', 'Запуск финального узла'),
          ['Зарегистрируйте Континентальный узел (/lh site commission continental_hub) и соберите Континентальный модуль из продукции всех 8 центров.'],
          deps=['prod_machine', 'site_continental_archive'], rewards=tier_rewards(4, 1, ('longhaul:continental_module', 1)))

    # 4 extra corridor/logistics milestones in Ch.04
    extra_ch04 = [
        ('site_corridor_tier1', 'Логистика Тир-1: Лес, Ферма, Рудник', 'create:track', [-260, -210], ['prod_forest', 'prod_farm', 'prod_mine']),
        ('site_corridor_tier2', 'Логистика Тир-2: Порт и Пустоши', 'smallships:oak_cog', [-10, -210], ['prod_port', 'prod_badlands']),
        ('site_corridor_tier3', 'Логистика Тир-3: Химпосёлок и Долина', 'immersiveengineering:pipe_item', [240, -210], ['prod_wetland', 'prod_smelter']),
        ('site_corridor_master', 'Единая сеть 8 экономических центров', 'minecraft:nether_star', [490, -210], ['prod_machine']),
    ]
    for i, (qid, title, icon, pos, deps) in enumerate(extra_ch04):
        quest(qid, title, '04 · Экономические центры', pos, icon, t_check('Коридор подтверждён'),
              ['Соедините все узлы этого эшелона транспортными линиями без ручной переноски и поддерживайте буфер продукции.'],
              deps=deps, rewards=tier_rewards(3 if i < 3 else 4, i))

    # -----------------------------------------------------------------------
    # 05 · Маршруты и лагеря (12 quests)
    # -----------------------------------------------------------------------
    logistics = [
        ('expedition/first_camp', 'Первый полевой лагерь', 'minecraft:campfire', [-120, -60],
         ['Отойдите минимум на 750 м от (0,0), поставьте костёр и спальник Comforts (<= 6 м) и выполните /lh camp deploy.'],
         ['tutorial_cookpot', 'contract_provisions'], tier_rewards(2, 0)),
        ('expedition/three_camps', 'Сеть из трёх лагерей', 'comforts:sleeping_bag_red', [0, -60],
         ['Разверните 3 активных полевых лагеря на расстоянии >= 500 м друг от друга.'],
         ['logistics_first_camp'], tier_rewards(3, 1)),
        ('routes/first_route', 'Испытание маршрута', 'minecraft:rail', [-120, 60],
         ['Разметьте маршрут длиной >= 750 м (/lh route begin/gate/finish/start). Аномальная скорость (> 85 м/с) отменяет испытание.'],
         ['tutorial_station', 'contract_rails'], tier_rewards(2, 2)),
        ('routes/cargo_delivery', 'Серверная грузовая накладная', 'longhaul:cargo_manifest', [0, 60],
         ['Получите накладную на узле (/lh cargo issue) и физически доставьте её в целевой узел (/lh cargo deliver).'],
         ['site_forest', 'logistics_first_route'], tier_rewards(3, 3)),
    ]
    for adv_id, title, icon, pos, desc, deps, rew in logistics:
        adv(adv_id, 25)
        qid = 'logistics_' + adv_id.split('/')[-1]
        quest(qid, title, '05 · Маршруты и лагеря', pos, icon,
              t_adv('longhaul:' + adv_id, 'Серверное подтверждение'), desc, deps=deps, rewards=rew)

    extra_ch05 = [
        ('logistics_camp_supply', 'Экспедиционный паёк для лагерей', 'longhaul:field_rations', [120, -60], t_item('longhaul:field_rations', 4), ['logistics_three_camps']),
        ('logistics_camp_compass', 'Компас разведчика', 'minecraft:compass', [240, -60], t_item('minecraft:compass', 2), ['logistics_camp_supply']),
        ('logistics_camp_hammock', 'Летний отдых: гамак Comforts', 'comforts:hammock_white', [360, -60], t_item('comforts:hammock_white', 1), ['logistics_camp_compass']),
        ('logistics_camp_anchor', 'Горный приют от токсичного газа', 'minecraft:lantern', [480, -60], t_item('minecraft:lantern', 8), ['logistics_camp_hammock']),
        ('logistics_route_signal', 'Сигнализация и расписание поездов', 'create:schedule', [120, 60], t_item('create:schedule', 2), ['logistics_cargo_delivery']),
        ('logistics_route_fuel', 'Топливный резерв автопарка', 'minecraft:coal_block', [240, 60], t_item('minecraft:coal_block', 8), ['logistics_route_signal']),
        ('logistics_route_radar', 'Навигация и маяки маршрута', 'minecraft:bell', [360, 60], t_item('minecraft:bell', 2), ['logistics_route_fuel']),
        ('logistics_route_master', 'Трансконтинентальная линия', 'create:track_station', [480, 60], t_check('Магистраль отлажена'), ['logistics_route_radar']),
    ]
    for i, (qid, title, icon, pos, tasks, deps) in enumerate(extra_ch05):
        quest(qid, title, '05 · Маршруты и лагеря', pos, icon, tasks,
              ['Укрепите автономность выездных лагерей и регулярных маршрутных рейсов между узлами.'],
              deps=deps, rewards=tier_rewards(2 if i % 2 == 0 else 3, i))

    # -----------------------------------------------------------------------
    # 06 · Восстановление и телеметрия (20 quests)
    # -----------------------------------------------------------------------
    recoveries = [
        ('sawmill', 'Восстановление лесопилки', 'create:mechanical_saw', [-210, -140], 'Подайте 16 железа, 16 андезитового сплава, 32 бревна и установите пилу/водяное колесо.', ['site_forest']),
        ('quarry', 'Карьер с повреждённым подъездом', 'create:mechanical_drill', [-70, -140], 'Подайте 24 пластины, 32 рельса, 64 булыжника и смонтируйте бур/дробилку/станцию.', ['site_mine']),
        ('river_port', 'Восстановление речного порта', 'create:portable_storage_interface', [70, -140], 'Подайте 64 доски, 16 железа, 2 интерфейса и смонтируйте перегрузочный узел.', ['site_port']),
        ('sorting_yard', 'Сортировочная станция', 'create:brass_funnel', [-210, -55], 'Подайте 64 рельса, 16 латуни, 8 лент и смонтируйте станцию/сортировку.', ['site_badlands']),
        ('power_plant', 'Восстановление энергоузла', 'create:steam_engine', [-70, -55], 'Подайте 32 меди, 16 латуни, 48 угля и установите паровую/генераторную установку.', ['site_smelter']),
        ('collapsed_bridge', 'Магистральный мост', 'create:metal_girder', [70, -55], 'Подайте 24 балки, 48 рельсов, 64 каменного кирпича и восстановите рельсовый переход.', ['site_machine']),
    ]
    for i, (rid, title, icon, pos, detail, rdeps) in enumerate(recoveries):
        adv('recovery/' + rid, 40)
        quest('recovery_' + rid, title, '06 · Восстановление и телеметрия', pos, icon,
              t_adv('longhaul:recovery/' + rid, 'Серверное восстановление объекта'),
              ['Обследуйте объект (/lh recovery list, /lh recovery survey ' + rid + ').', detail, 'Встаньте на ремонтную бочку и выполните /lh recovery restore ' + rid + '.'],
              deps=rdeps, rewards=tier_rewards(3, i))

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
    for i, (sid, title, pos) in enumerate(cc_sites):
        adv('cc/' + sid, 25)
        quest('cc_' + sid, title, '06 · Восстановление и телеметрия', pos, 'computercraft:computer_normal',
              t_adv('longhaul:cc/' + sid, 'Подтверждение телеметрии и запаса'),
              ['Запустите /lh cc challenge ' + sid + ', установите компьютер CC: Tweaked в 12 м от бочки узла и обеспечьте запас продукции, затем /lh cc verify ' + sid + '.'],
              deps=['site_' + sid, 'tutorial_computer'], rewards=tier_rewards(3, i))

    extra_ch06 = [
        ('recovery_audit_all', 'Инспекция всех 6 объектов восстановления', 'minecraft:writable_book', [210, -140], t_check('Все 6 объектов восстановлены'), ['recovery_sawmill', 'recovery_quarry', 'recovery_river_port']),
        ('recovery_bridge_master', 'Инженерный стандарт инфраструктуры', 'create:metal_girder', [210, -55], t_check('Мосты и ТЭС в строю'), ['recovery_sorting_yard', 'recovery_power_plant', 'recovery_collapsed_bridge']),
        ('cc_modem_link', 'Беспроводные модемы депо', 'computercraft:wireless_modem_normal', [330, 55], t_item('computercraft:wireless_modem_normal', 2), ['cc_port']),
        ('cc_advanced_display', 'Мониторы диспетчерского центра', 'computercraft:monitor_normal', [330, 140], t_item('computercraft:monitor_normal', 4), ['cc_machine']),
        ('cc_disk_backup', 'Резервная дискета longhaul_depot', 'computercraft:disk', [450, 55], t_item('computercraft:disk', 2), ['cc_modem_link']),
        ('cc_network_master', 'Единая телеметрия консорциума', 'computercraft:computer_advanced', [450, 140], t_item('computercraft:computer_advanced', 1), ['cc_advanced_display', 'cc_disk_backup']),
    ]
    for i, (qid, title, icon, pos, tasks, deps) in enumerate(extra_ch06):
        quest(qid, title, '06 · Восстановление и телеметрия', pos, icon, tasks,
              ['Объедините восстановленные промышленные объекты с компьютерным мониторингом CC: Tweaked.'],
              deps=deps, rewards=tier_rewards(3, i))

    # -----------------------------------------------------------------------
    # 07..10 + 13(catalog) · Full 240-spec catalog + milestones
    # -----------------------------------------------------------------------
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
    EXPEDITION_NON_PHOTO = [q['id'] for q in catalog if q['id'].startswith('expedition_') and q['verification_type'] != 'photo_evidence']
    EXPEDITION_PHOTO = [q['id'] for q in catalog if q['id'].startswith('expedition_') and q['verification_type'] == 'photo_evidence']
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
        if qid.startswith('main_'):
            parts = qid.split('_')
            row, col = int(parts[1]) - 1, int(parts[2]) - 1
            if row % 2 == 1:
                col = 7 - col
            return [round((col - 3.5) * 92), round((row - 1.5) * 92)]
        if qid.startswith('region_'):
            parts = qid.split('_')
            site, num = '_'.join(parts[1:-1]), int(parts[-1])
            return [round((num - 6.5) * 86), round((REGION_ROW_ORDER.index(site) - 3.5) * 86)]
        if qid.startswith('engineering_'):
            parts = qid.split('_')
            sub, num = '_'.join(parts[1:-1]), int(parts[-1])
            return [round((num - 4.5) * 92), round((ENG_ROW_ORDER.index(sub) - 3.5) * 86)]
        if qid.startswith('expedition_') and q['verification_type'] != 'photo_evidence':
            idx = EXPEDITION_NON_PHOTO.index(qid)
            if idx < 7:
                return [(idx - 3) * 94, -50]
            return [(6 - (idx - 7) - 3) * 94, 50]
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
    for idx, q in enumerate(catalog):
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
            desc.append('Честное ограничение: сервер проверяет маршрут/доставку контрольной партии в бочке без фиктивного трекинга ID транспорта.')
        t_level = 1 if q['stage'] <= 2 else (2 if q['stage'] <= 4 else (3 if q['stage'] <= 6 else 4))
        quest(
            'cat_' + qid, q['title'], grp, catalog_pos(q), icon,
            t_adv('longhaul:catalog/' + qid, 'Серверная проверка заказа'),
            desc, deps=catalog_deps(q), subtitle=f"Этап {q['stage']} · {q['chapter']}",
            rewards=tier_rewards(t_level, idx),
        )
        compact_catalog.append({
            'id': qid, 'title': q['title'], 'chapter': q['chapter'],
            'verification_type': vt, 'stage': q['stage'],
            'optional': bool(q.get('optional')), 'conditions': q['conditions'],
        })

    # Add 8 epoch milestones to Ch.07 (placed below main serpentine rows at y = 240)
    for stg in range(1, 9):
        row = (stg - 1) // 2
        quest(
            f'main_epoch_milestone_{stg:02d}', f'Веха эпохи #{stg}: Заказы прогрессии',
            '07 · Кампания: Основная прогрессия', [round((stg - 4.5) * 92), 235],
            'minecraft:emerald' if stg < 8 else 'minecraft:nether_star',
            t_check(f'Эпоха {stg} зафиксирована'),
            [f'Подтвердите закрытие промышленного блока {stg} основной кампании.'],
            deps=[f'cat_main_{(stg+1)//2}_08' if stg <= 4 else 'cat_main_4_08'],
            rewards=tier_rewards(2 if stg <= 4 else 3, stg),
        )

    # Add 7 expedition field ops to Ch.10 (y = 155)
    exp_ops = [
        ('exp_field_01', 'Полевой инвентарь разведчика', 'minecraft:spyglass', t_item('minecraft:spyglass', 1)),
        ('exp_field_02', 'Навигация: Nature\'s Compass', 'naturescompass:naturescompass', t_item('naturescompass:naturescompass', 1)),
        ('exp_field_03', 'Запас факелов и костров', 'minecraft:campfire', t_item('minecraft:campfire', 4)),
        ('exp_field_04', 'Походная кухня на марше', 'farmersdelight:beef_stew', t_item('farmersdelight:beef_stew', 2)),
        ('exp_field_05', 'Передвижные спальники', 'comforts:sleeping_bag_blue', t_item('comforts:sleeping_bag_blue', 1)),
        ('exp_field_06', 'Маркировка маршрутных вех', 'minecraft:lantern', t_item('minecraft:lantern', 8)),
        ('exp_field_07', 'Мастер-экспедиционер Long Haul', 'minecraft:compass', t_check('Все полевые этапы пройдены')),
    ]
    prev_exp = 'cat_expedition_16' if 'cat_expedition_16' in GENERATED_QUESTS else 'logistics_three_camps'
    for i, (qid, title, icon, tasks) in enumerate(exp_ops):
        quest(qid, title, '10 · Кампания: Лагеря и экспедиции', [(i - 3) * 94, 155], icon, tasks,
              ['Полевое обеспечение дальних выездов между регионами.'], deps=[prev_exp], rewards=tier_rewards(2, i))
        prev_exp = qid

    # -----------------------------------------------------------------------
    # 11 · Ядерная энергетика и Драконик (20 quests)
    # -----------------------------------------------------------------------
    adv('nuclear/verified', 60)
    nuclear_core = [
        ('nuclear_01_geiger', 'Радиационная разведка и дозиметрия', 'minecraft:compass', [-330, 0],
         t_check('Этап освоен'), [
             'В сборке работают NuclearCraft Neoteric, Electrodynamics, Nuclear Science, Extreme Reactors и Ballistix.',
         ], ['tutorial_precision'], tier_rewards(3, 0)),
        ('nuclear_02_electrodynamics', 'Электродинамика и обогащение топлива', 'minecraft:blast_furnace', [-210, 0],
         t_check('Этап освоен'), [
             'Постройте линии переработки из Electrodynamics и NuclearCraft Neoteric (см. также Главы 34–36).',
         ], ['nuclear_01_geiger'], tier_rewards(3, 1)),
        ('nuclear_03_reactors', 'Ядерные реакторы и турбины', 'create:steam_engine', [-90, 0],
         t_check('Этап освоен'), [
             'Спроектируйте многоблочный реактор деления с охлаждением и паровой турбиной.',
         ], ['nuclear_02_electrodynamics'], tier_rewards(3, 2)),
        ('nuclear_04_ballistix_hbm', 'Баллистика и тяжёлые заряды (Ballistix)', 'minecraft:tnt', [30, -80],
         t_check('Этап освоен'), [
             'Освойте пусковые шахты Ballistix и тяжёлые заряды Nuclear Science на удалённых полигонах.',
         ], ['nuclear_03_reactors'], tier_rewards(4, 3)),
        ('nuclear_05_draconium', 'Дракониум и Ядро Виверны (Draconic Evolution)', 'draconicevolution:draconium_ingot', [30, 80],
         t_item('draconicevolution:draconium_ingot', 4), [
             'Добудьте дракониум и соберите первые ядра (подробно в Главе 37; дислокаторы отключены).',
         ], ['nuclear_03_reactors'], tier_rewards(4, 4)),
        ('nuclear_06_fusion_core', 'Слияние (Fusion Crafting) и Энергоядро', 'minecraft:beacon', [150, 0],
         t_adv('longhaul:nuclear/verified', 'Подтверждение (/lh nuclear verify)'), [
             'Соберите Ядро слияния и Энергетическое ядро Draconic Evolution, затем выполните /lh nuclear verify.',
         ], ['nuclear_04_ballistix_hbm', 'nuclear_05_draconium'], tier_rewards(4, 5)),
    ]
    for qid, title, icon, pos, tasks, desc, deps, rew in nuclear_core:
        quest(qid, title, '11 · Ядерная энергетика и Драконик', pos, icon, tasks, desc,
              deps=deps, subtitle='Long Haul Legacy 2.0 · Поздняя энергетика', rewards=rew)

    # 14 supplementary milestones in Ch.11 (top & bottom rows y = -180, +180)
    nuc_extra = [
        ('nuclear_07_graphite', 'Реакторный графит Extreme Reactors', 'bigreactors:graphite_ingot', [-330, -180], t_item('bigreactors:graphite_ingot', 8), 'nuclear_01_geiger'),
        ('nuclear_08_casing', 'Корпус реактора деления', 'bigreactors:basic_reactorcasing', [-210, -180], t_item('bigreactors:basic_reactorcasing', 16), 'nuclear_07_graphite'),
        ('nuclear_09_controller', 'Контроллер реактора деления', 'bigreactors:basic_reactorcontroller', [-90, -180], t_item('bigreactors:basic_reactorcontroller', 1), 'nuclear_08_casing'),
        ('nuclear_10_fuel_rod', 'Топливный стержень реактора', 'bigreactors:basic_reactorfuelrod', [30, -180], t_item('bigreactors:basic_reactorfuelrod', 4), 'nuclear_09_controller'),
        ('nuclear_11_nc_alloy', 'Конструкционный сплав NuclearCraft', 'nuclearcraft:steel_ingot', [150, -180], t_item('nuclearcraft:steel_ingot', 8), 'nuclear_10_fuel_rod'),
        ('nuclear_12_nc_radiation', 'Радиационный щит и дозиметрия', 'nuclearcraft:geiger_counter', [270, -180], t_item('nuclearcraft:geiger_counter', 1), 'nuclear_11_nc_alloy'),
        ('nuclear_13_voltaic', 'Энергосети Voltaic / Electrodynamics', 'voltaic:guidebook', [390, -180], t_item('voltaic:guidebook', 1), 'nuclear_12_nc_radiation'),
        ('nuclear_14_draconic_core', 'Дракониевое ядро', 'draconicevolution:draconium_core', [-330, 180], t_item('draconicevolution:draconium_core', 2), 'nuclear_05_draconium'),
        ('nuclear_15_wyvern_core', 'Ядро Виверны', 'draconicevolution:wyvern_core', [-210, 180], t_item('draconicevolution:wyvern_core', 1), 'nuclear_14_draconic_core'),
        ('nuclear_16_fusion_core_item', 'Ядро крафта слияния', 'draconicevolution:crafting_core', [-90, 180], t_item('draconicevolution:crafting_core', 1), 'nuclear_15_wyvern_core'),
        ('nuclear_17_injector', 'Инжектор слияния', 'draconicevolution:basic_crafting_injector', [30, 180], t_item('draconicevolution:basic_crafting_injector', 4), 'nuclear_16_fusion_core_item'),
        ('nuclear_18_awakened', 'Пробуждённый дракониум', 'draconicevolution:awakened_draconium_ingot', [150, 180], t_item('draconicevolution:awakened_draconium_ingot', 4), 'nuclear_17_injector'),
        ('nuclear_19_awakened_core', 'Пробуждённое ядро', 'draconicevolution:awakened_core', [270, 180], t_item('draconicevolution:awakened_core', 1), 'nuclear_18_awakened'),
        ('nuclear_20_chaos', 'Осколок Хаоса: вершина атома', 'draconicevolution:chaos_shard', [390, 180], t_item('draconicevolution:chaos_shard', 1), 'nuclear_19_awakened_core'),
    ]
    for i, (qid, title, icon, pos, tasks, dep) in enumerate(nuc_extra):
        quest(qid, title, '11 · Ядерная энергетика и Драконик', pos, icon, tasks,
              ['Ключевая технологическая ступень ядерного и драконического синтеза.'],
              deps=[dep], rewards=tier_rewards(3 if i < 10 else 4, i))

    # -----------------------------------------------------------------------
    # 12 · OpenTTD: Компании и Империя (18 quests: 6 core + 12 deep ops)
    # -----------------------------------------------------------------------
    for oa in ['company', 'specs', 'claim', 'trade', 'empire']:
        adv('openttd/' + oa, 30)
    openttd_quests = [
        ('openttd_01_found_company', 'I. Основание транспортной корпорации', 'minecraft:writable_book', [-275, 0], [
            'Создайте свою компанию (/lh company create <id> <Название>) или вступите к союзнику (/lh company join <id>).',
        ], [], 'longhaul:openttd/company', 'Создайте или вступите в компанию'),
        ('openttd_02_specializations', 'II. Специализация логистики и добычи', 'create:track', [-165, 0], [
            'Выберите транспортную (/lh company spec transport <rail|road|sea|air>) и ресурсную (/lh company spec resource <mining|forestry|agro|energy>) специализации.',
        ], ['openttd_01_found_company'], 'longhaul:openttd/specs', 'Выберите обе специализации компании'),
        ('openttd_03_sector_map', 'III. Карта секторов 256×256, выкуп и рейды', 'minecraft:filled_map', [-55, 0], [
            'Захватывайте сектора через /lh territory buy или карту /lh gui territory. Доступны outbid, raid, seize, transfer и settle.',
        ], ['openttd_02_specializations'], 'longhaul:openttd/claim', 'Захватите дополнительный сектор 256×256'),
        ('openttd_04_market_and_trade', 'IV. Биржа Консорциума и торговые пакты', 'minecraft:emerald', [55, 0], [
            'Торгуйте на бирже (/lh market list) или напрямую с компаниями (/lh trade offer) и заключайте пакты (/lh company pact).',
        ], ['openttd_03_sector_map'], 'longhaul:openttd/trade', 'Проведите межкорпоративную сделку'),
        ('openttd_05_ai_competitors', 'V. Конкуренция с ИИ-корпорациями', 'minecraft:redstone_block', [165, 0], [
            'ИИ-боты (/lh bot status) расширяют свои сектора и обновляют котировки на бирже.',
        ], ['openttd_04_market_and_trade'], None, 'Ознакомьтесь с рейтингом ИИ-конкурентов'),
        ('openttd_06_empire_verify', 'VI. Империя Консорциума (/lh openttd verify)', 'minecraft:nether_star', [275, 0], [
            'Выполните /lh openttd verify после основания компании, выбора специализаций, захвата сектора и первой сделки.',
        ], ['openttd_05_ai_competitors'], 'longhaul:openttd/empire', 'Подтвердите статус OpenTTD-империи'),
    ]
    for i, (qid, title, icon, pos, desc, deps, adv_id, t_title) in enumerate(openttd_quests):
        tasks = t_adv(adv_id, t_title) if adv_id else t_check(t_title)
        quest(qid, title, '12 · OpenTTD: Компании и Империя', pos, icon, tasks, desc,
              deps=deps, subtitle='Мультиплеерная экономика OpenTTD', rewards=tier_rewards(2 if i < 2 else (3 if i < 5 else 4), i))

    ottd_extra = [
        ('openttd_07_sanctuary', 'Заповедник 3×3 вокруг спауна', 'minecraft:oak_sign', [-275, -100], 'openttd_01_found_company'),
        ('openttd_08_rail_spec', 'Профиль Ж/Д: Стальной гигант', 'create:track', [-165, -100], 'openttd_02_specializations'),
        ('openttd_09_sea_spec', 'Профиль Море: Торговый флот', 'smallships:oak_cog', [-55, -100], 'openttd_02_specializations'),
        ('openttd_10_air_spec', 'Профиль Небо: Дирижабли', 'immersive_aircraft:airship', [55, -100], 'openttd_02_specializations'),
        ('openttd_11_road_spec', 'Профиль Дорога: Автоколонны', 'automobility:automobile', [165, -100], 'openttd_02_specializations'),
        ('openttd_12_voronoi', 'Зоны Вороного и эксклавы', 'minecraft:compass', [275, -100], 'openttd_03_sector_map'),
        ('openttd_13_fortify', 'Укрепление стратегических секторов', 'minecraft:stone_bricks', [-275, 100], 'openttd_03_sector_map'),
        ('openttd_14_subsidy', 'Государственные субсидии ×1.75', 'minecraft:gold_ingot', [-165, 100], 'openttd_04_market_and_trade'),
        ('openttd_15_pact', 'Беспошлинный пакт союзников', 'minecraft:paper', [-55, 100], 'openttd_04_market_and_trade'),
        ('openttd_16_antitrust', 'Антимонопольная служба (seize)', 'minecraft:iron_axe', [55, 100], 'openttd_05_ai_competitors'),
        ('openttd_17_raid_ops', 'Операции рейда и выкупа (outbid)', 'minecraft:shield', [165, 100], 'openttd_05_ai_competitors'),
        ('openttd_18_monopoly', 'Лидер рейтинга капитализации', 'minecraft:diamond_block', [275, 100], 'openttd_06_empire_verify'),
    ]
    for i, (qid, title, icon, pos, dep) in enumerate(ottd_extra):
        quest(qid, title, '12 · OpenTTD: Компании и Империя', pos, icon, t_check('Механика изучена и применена'),
              ['Практический приём корпоративной стратегии OpenTTD в мультиплеере Long Haul Legacy 2.0.'],
              deps=[dep], rewards=tier_rewards(3, i))

    # -----------------------------------------------------------------------
    # 13 · Фотодокументация (Опционально — strictly photo_* / tutorial_camera/film/album / exposure:photograph)
    # -----------------------------------------------------------------------
    quest('alpha_photo', 'Фотодокументация экспедиции (Опционально)', '13 · Фотодокументация (Опционально)', [-200, -240], 'exposure:camera',
          t_check('Прочитано (опционально)'), [
              'Exposure и аддоны добавлены: камера, плёнка, проявка, Polaroid и альбомы.',
              'Глава полностью опциональна: /lh photo report <узел> и /lh catalog verify <id>.',
          ], deps=['alpha_world'], subtitle='Опциональная ветка Exposure', rewards=tier_rewards(1, 0, ('exposure:black_and_white_film', 1)))

    photo_gear = [
        ('camera', 'Камера экспедиции', 'exposure:camera', [-100, -240], 'Фотографируйте открытия; берите запас плёнки.', ['alpha_photo']),
        ('film', 'Запас плёнки', 'exposure:black_and_white_film', [0, -240], 'Чёрно-белая плёнка нужна для первых полевых снимков.', ['tutorial_camera']),
        ('album', 'Альбом маршрута', 'exposure:album', [100, -240], 'Соберите фотографии городов, мостов и этапов фабрики.', ['tutorial_film']),
    ]
    for i, (qid, title, item, pos, desc, deps) in enumerate(photo_gear):
        quest('tutorial_' + qid, title, '13 · Фотодокументация (Опционально)', pos, item,
              t_item(item, 1), ['Опциональная веха фотодокументации.', desc],
              deps=deps, subtitle='Опциональное снаряжение Exposure', rewards=tier_rewards(2, i))

    photo_extra = [
        ('photo_color_film', 'Цветная фотоплёнка', 'exposure:color_film', [200, -240], t_item('exposure:color_film', 1), 'tutorial_album'),
        ('photo_lightroom', 'Фотолаборатория проявки', 'exposure:lightroom', [300, -240], t_item('exposure:lightroom', 1), 'photo_color_film'),
        ('photo_dev_bw', 'Проявитель чёрно-белой плёнки', 'exposure:developed_black_and_white_film', [400, -240], t_item('exposure:developed_black_and_white_film', 1), 'photo_lightroom'),
        ('photo_dev_color', 'Проявитель цветной плёнки', 'exposure:developed_color_film', [500, -240], t_item('exposure:developed_color_film', 1), 'photo_dev_bw'),
        ('photo_aged_print', 'Архивный состаренный снимок', 'exposure:aged_photograph', [200, -150], t_item('exposure:aged_photograph', 1), 'photo_dev_color'),
        ('photo_interplanar', 'Межпланарный проектор снимков', 'exposure:interplanar_projector', [300, -150], t_item('exposure:interplanar_projector', 1), 'photo_aged_print'),
    ]
    for i, (qid, title, icon, pos, tasks, dep) in enumerate(photo_extra):
        quest(qid, title, '13 · Фотодокументация (Опционально)', pos, icon, tasks,
              ['Расширенная фотодокументация и лабораторная проявка Exposure.'],
              deps=[dep], subtitle='Опциональное снаряжение Exposure', rewards=tier_rewards(2, i))

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
              t_adv('longhaul:photo/' + sid, 'Уникальный полевой снимок'),
              ['Сделайте снимок Exposure на месте (<= 160 м от узла) и выполните /lh photo report ' + sid + '.'],
              deps=['site_' + sid, 'tutorial_camera'], subtitle='Опциональный фотоотчёт', rewards=tier_rewards(2, i))

    # -----------------------------------------------------------------------
    # 14 · DOOMED: Хардкор-выживание (16 quests, MANDATORY)
    # -----------------------------------------------------------------------
    adv('doomed/checked', 40)
    doomed_core = [
        ('doomed_01_intro', 'I. Вводный инструктаж DOOMED и боеготовность', 'minecraft:paper', [-300, 0],
         t_check('Этап освоен'), [
             'Глава 14 входит в 14 основных этапов расширения территории (/lh territory).',
             'Проверьте статус DOOMED через /lh doomed status и подготовьте медицинский комплект.',
         ], ['alpha_voidout']),
        ('doomed_02_first_aid', 'II. Полевая медицина и рационы', 'minecraft:golden_apple', [-180, 0],
         t_item('minecraft:golden_apple', 2), [
             'Подготовьте аптечный запас: золотые яблоки, лечебные зелья, бинты DOOMED и плотные блюда Farmer\'s Delight.',
         ], ['doomed_01_intro']),
        ('doomed_03_blood_and_shock', 'III. Контроль травм, кровотечений и шока', 'minecraft:potion', [-60, 0],
         t_check('Этап освоен'), [
             'В бою контролируйте кровотечения и переломы; на судах Valkyrien Skies берегитесь падений с высоты.',
         ], ['doomed_02_first_aid']),
        ('doomed_04_guns_and_ballistics', 'IV. Огнестрельная оборона (TaCZ / Doomed: Guns)', 'minecraft:crossbow', [60, 0],
         t_item('minecraft:crossbow', 1), [
             'Соберите дистанционное вооружение, чтобы снизить риск критических переломов при штурме данжей.',
         ], ['doomed_03_blood_and_shock']),
        ('doomed_05_field_expedition', 'V. Экспедиционный рейд и эвакуация', 'minecraft:compass', [180, 0],
         t_check('Рейд завершён без детонации'), [
             'Совершите вылазку до удалённого лагеря или узла с полным медицинским комплектом и вернитесь живым.',
         ], ['doomed_04_guns_and_ballistics']),
        ('doomed_06_safe_toggle', 'VI. Завершение протокола DOOMED (/lh doomed verify)', 'minecraft:shield', [300, 0],
         t_adv('longhaul:doomed/checked', 'Подтверждение (/lh doomed verify)'), [
             'Выполните /lh doomed verify, чтобы закрыть Главу 14 на сервере и получить финальный вклад в расширение территории.',
         ], ['doomed_05_field_expedition']),
    ]
    for i, (qid, title, icon, pos, tasks, desc, deps) in enumerate(doomed_core):
        quest(qid, title, '14 · DOOMED: Хардкор-выживание', pos, icon, tasks, desc,
              deps=deps, subtitle='Long Haul Legacy 2.0 · Боевое выживание', rewards=tier_rewards(3 if i < 4 else 4, i))

    doomed_extra = [
        ('doomed_07_totem_shield', 'Страховка Тотемом от Voidout', 'minecraft:totem_of_undying', [-300, -100], t_item('minecraft:totem_of_undying', 1), 'doomed_01_intro'),
        ('doomed_08_milk_cleanse', 'Детоксикация и снятие эффектов', 'minecraft:milk_bucket', [-180, -100], t_item('minecraft:milk_bucket', 1), 'doomed_02_first_aid'),
        ('doomed_09_honey_cure', 'Медовые бутылочки против отравлений', 'minecraft:honey_bottle', [-60, -100], t_item('minecraft:honey_bottle', 4), 'doomed_02_first_aid'),
        ('doomed_10_armor_iron', 'Базовый бронекомплект', 'minecraft:iron_chestplate', [60, -100], t_item('minecraft:iron_chestplate', 1), 'doomed_03_blood_and_shock'),
        ('doomed_11_armor_diamond', 'Алмазный штурмовой жилет', 'minecraft:diamond_chestplate', [180, -100], t_item('minecraft:diamond_chestplate', 1), 'doomed_10_armor_iron'),
        ('doomed_12_shield_wall', 'Полевой щит и блок-позиция', 'minecraft:shield', [300, -100], t_item('minecraft:shield', 1), 'doomed_04_guns_and_ballistics'),
        ('doomed_13_rations_reserve', 'Неприкосновенный запас рационов', 'longhaul:field_rations', [-180, 100], t_item('longhaul:field_rations', 4), 'doomed_02_first_aid'),
        ('doomed_14_glistering_melon', 'Сверкающий арбуз для зелий лечения', 'minecraft:glistering_melon_slice', [-60, 100], t_item('minecraft:glistering_melon_slice', 4), 'doomed_03_blood_and_shock'),
        ('doomed_15_netherite_brace', 'Незеритовая пластина защиты', 'minecraft:netherite_ingot', [60, 100], t_item('minecraft:netherite_ingot', 1), 'doomed_05_field_expedition'),
        ('doomed_16_survivor_honor', 'Орден выжившего DOOMED', 'minecraft:enchanted_golden_apple', [180, 100], t_check('Выживание подтверждено'), 'doomed_06_safe_toggle'),
    ]
    for i, (qid, title, icon, pos, tasks, dep) in enumerate(doomed_extra):
        quest(qid, title, '14 · DOOMED: Хардкор-выживание', pos, icon, tasks,
              ['Дополнительная подготовка к жёстким боевым условиям DOOMED и Колеса Угроз.'],
              deps=[dep], subtitle='Long Haul Legacy 2.0 · Боевое выживание', rewards=tier_rewards(3, i))

    (O / 'kubejs/startup_scripts/02_quest_catalog.js').write_text(
        '// Auto-generated from design/quest-catalog.json by tools/generate_alpha_quests.py\n'
        'global.LHQuestCatalog = ' + json.dumps(compact_catalog, ensure_ascii=False) + ';\n'
    )
    return len(compact_catalog)
