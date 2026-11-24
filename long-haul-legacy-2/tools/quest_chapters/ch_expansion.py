"""Expansion chapters 15..61 modeled on ATM-9 / Enigmatica / GTNH progression trees."""
import json
import pathlib
from .common import (
    BANNED_ITEM_SUBSTRINGS,
    GENERATED_QUESTS,
    adv,
    quest,
    r_choice,
    r_item,
    r_xp,
    t_adv,
    t_check,
    t_item,
    tier_rewards,
)

VERIFIED_PATH = pathlib.Path(__file__).resolve().parent / 'verified_items.json'
VERIFIED_DB = json.loads(VERIFIED_PATH.read_text())

# Exact lookup set for sanity checks
ALL_VERIFIED_SET = {it for ents in VERIFIED_DB.values() for it, _ in ents}

# Extra Long Haul custom items registered in 01_longhaul_items.js
LONGHAUL_ITEMS = [
    ('longhaul:treated_timber', 'Пропитанная древесина'),
    ('longhaul:field_rations', 'Экспедиционные рационы'),
    ('longhaul:ore_concentrate', 'Рудный концентрат'),
    ('longhaul:marine_reagent', 'Морской реагент'),
    ('longhaul:refractory_mix', 'Огнеупорная смесь'),
    ('longhaul:technical_oil', 'Техническое масло'),
    ('longhaul:technical_glass', 'Техническое стекло'),
    ('longhaul:machine_parts', 'Прецизионные узлы'),
    ('longhaul:continental_module', 'Континентальный модуль'),
    ('longhaul:cargo_manifest', 'Грузовая накладная'),
    ('longhaul:control_tablet', 'Планшет управления'),
]
for _it, _ in LONGHAUL_ITEMS:
    ALL_VERIFIED_SET.add(_it)


def is_safe_item(item_id: str) -> bool:
    low = item_id.lower()
    if any(b in low for b in BANNED_ITEM_SUBSTRINGS):
        return False
    # Exclude unobtainable creative/debug/trophy spam or fluids
    if any(x in low for x in ('creative', 'debug', 'command_block', 'barrier', 'jigsaw', 'structure_void')):
        return False
    return True


def pool(ns: str, match_any=None, exclude_any=None, limit: int = 200, used=None):
    """Select verified safe items from a namespace matching optional keyword filters."""
    used = used if used is not None else set()
    res = []
    for item_id, en_name in VERIFIED_DB.get(ns, []):
        if item_id in used or not is_safe_item(item_id):
            continue
        low = item_id.lower() + ' ' + en_name.lower()
        if match_any and not any(k in low for k in match_any):
            continue
        if exclude_any and any(k in low for k in exclude_any):
            continue
        res.append((item_id, en_name))
        used.add(item_id)
        if len(res) >= limit:
            break
    return res


def take_from(ns: str, lanes_spec: list, target_total: int, used=None):
    """Partition namespace items into balanced thematic lanes + fallback fill to hit target_total."""
    used = used if used is not None else set()
    lanes_out = []
    per_lane_cap = max(8, (target_total // len(lanes_spec)) + 4)
    for lane_name, keywords in lanes_spec:
        items = pool(ns, match_any=keywords, limit=per_lane_cap, used=used)
        lanes_out.append([lane_name, items])

    # Top up from remaining safe items of the namespace if needed
    cur = sum(len(x[1]) for x in lanes_out)
    if cur < target_total:
        rem = pool(ns, limit=target_total - cur, used=used)
        idx = 0
        for item in rem:
            lanes_out[idx % len(lanes_out)][1].append(item)
            idx += 1

    # Trim excess evenly if over target_total
    cur = sum(len(x[1]) for x in lanes_out)
    while cur > target_total:
        biggest = max(lanes_out, key=lambda x: len(x[1]))
        if len(biggest[1]) <= 1:
            break
        biggest[1].pop()
        cur -= 1
    return lanes_out


def emit_chapter(
    ch_code: str,
    group_name: str,
    subtitle: str,
    root_title: str,
    root_icon: str,
    root_desc: str,
    root_dep: str,
    lanes: list,
    tier: int = 2,
    amount_fn=None,
    desc_fn=None,
    dx: int = 96,
    dy: int = 88,
):
    """Emit a clean chapter with a root intro quest, multi-lane progression tracks, and a capstone quest."""
    non_empty_lanes = [(name, items) for name, items in lanes if items]
    if not non_empty_lanes:
        return 0
    mid_y = round(((len(non_empty_lanes) - 1) / 2.0) * dy)
    root_id = f'ch{ch_code}_00_root'
    adv(f'chapters/ch{ch_code}_unlocked', 10)
    tier_ru = {1: 'Ранний тир', 2: 'Средний тир', 3: 'Продвинутый/Поздний тир', 4: 'Финальный тир'}.get(tier, 'Тир')
    root_tasks = {
        'unlock': t_adv(f'longhaul:chapters/ch{ch_code}_unlocked', 'Открыто через вилку глав (/lh chapters)'),
        'study': t_check('Раздел изучен'),
    }
    quest(
        root_id,
        root_title,
        group_name,
        [-dx, mid_y],
        root_icon,
        root_tasks,
        [root_desc, f'Сложность главы: {tier_ru}. Выбирайте главу из 3 случайных вариантов во вкладке «Вилка глав» (/lh gui chapters), затем выполняйте задания слева направо.'],
        deps=[root_dep] if root_dep else [],
        subtitle=subtitle,
        rewards=tier_rewards(tier, int(ch_code)),
    )
    total = 1
    max_cols = 0
    lane_tails = []
    for row_idx, (lane_name, items) in enumerate(non_empty_lanes):
        prev_id = root_id
        y = row_idx * dy
        # Wrap very long lanes cleanly onto two sub-rows (serpentine) so chapters stay readable in GUI
        for col_idx, item_entry in enumerate(items):
            if len(item_entry) == 2:
                item_id, label = item_entry
                amt = amount_fn(item_id, col_idx) if amount_fn else 1
            else:
                item_id, label, amt = item_entry
            qid = f'ch{ch_code}_{row_idx:02d}_{col_idx:02d}'
            x = col_idx * dx
            max_cols = max(max_cols, col_idx + 1)
            q_tier = min(4, tier + (1 if col_idx >= max(6, len(items) * 2 // 3) else 0))
            title = f'{lane_name}: {label}' if len(label) < 38 else label
            dtext = desc_fn(item_id, label, lane_name, amt) if desc_fn else (
                f'Этап направления «{lane_name}». Получите или изготовьте: {label} ({amt} шт.).'
            )
            quest(
                qid,
                title,
                group_name,
                [x, y],
                item_id,
                t_item(item_id, amt),
                [dtext, f'Модуль главы: {subtitle}.'],
                deps=[prev_id],
                subtitle=f'{subtitle} · {lane_name}',
                rewards=tier_rewards(q_tier, total + col_idx),
            )
            prev_id = qid
            total += 1
        lane_tails.append(prev_id)

    # Capstone quest tying all lanes together
    cap_id = f'ch{ch_code}_99_master'
    quest(
        cap_id,
        f'Мастерство раздела: {root_title}',
        group_name,
        [max_cols * dx, mid_y],
        root_icon,
        t_check('Все ветки раздела завершены'),
        [f'Вы прошли все технологические линии главы «{group_name}»!'],
        deps=lane_tails,
        subtitle=f'{subtitle} · Итог',
        rewards=tier_rewards(min(4, tier + 1), int(ch_code) + 99),
    )
    total += 1
    return total


def build_expansion_chapters():
    total = 0

    # =======================================================================
    # 15 · Выживание: Стартовые ремёсла (~82 quests)
    # =======================================================================
    used_mc = set()
    ch15_lanes = [
        ('Дерево и заготовки', [
            ('minecraft:oak_log', 'Дубовое бревно', 16),
            ('minecraft:spruce_log', 'Еловое бревно', 16),
            ('minecraft:birch_log', 'Берёзовое бревно', 16),
            ('minecraft:jungle_log', 'Тропическое бревно', 8),
            ('minecraft:acacia_log', 'Бревно акации', 8),
            ('minecraft:dark_oak_log', 'Бревно тёмного дуба', 8),
            ('minecraft:mangrove_log', 'Мангровое бревно', 8),
            ('minecraft:cherry_log', 'Вишнёвое бревно', 8),
            ('minecraft:bamboo_block', 'Бамбуковый блок', 8),
            ('minecraft:crafting_table', 'Верстак', 1),
            ('minecraft:chest', 'Сундук для базы', 8),
            ('minecraft:barrel', 'Приёмная бочка', 4),
            ('minecraft:scaffolding', 'Строительные леса', 16),
        ]),
        ('Камень и первичная плавка', [
            ('minecraft:cobblestone', 'Булыжник', 64),
            ('minecraft:stone', 'Обожжённый камень', 32),
            ('minecraft:cobbled_deepslate', 'Дроблёный глубинный сланец', 32),
            ('minecraft:granite', 'Гранит', 16),
            ('minecraft:diorite', 'Диорит', 16),
            ('minecraft:andesite', 'Андезит для Create', 32),
            ('minecraft:tuff', 'Туф', 16),
            ('minecraft:calcite', 'Кальцит', 16),
            ('minecraft:furnace', 'Печь', 4),
            ('minecraft:smoker', 'Коптильня', 1),
            ('minecraft:blast_furnace', 'Плавильная печь', 1),
            ('minecraft:charcoal', 'Древесный уголь', 16),
            ('minecraft:coal', 'Каменный уголь', 32),
        ]),
        ('Первые руды и инструменты', [
            ('minecraft:wooden_pickaxe', 'Деревянная кирка', 1),
            ('minecraft:stone_pickaxe', 'Каменная кирка', 1),
            ('minecraft:raw_copper', 'Сырая медь', 16),
            ('minecraft:copper_ingot', 'Медный слиток', 16),
            ('minecraft:raw_iron', 'Сырое железо', 16),
            ('minecraft:iron_ingot', 'Железный слиток', 16),
            ('minecraft:iron_pickaxe', 'Железная кирка', 1),
            ('minecraft:iron_axe', 'Железный топор', 1),
            ('minecraft:iron_shovel', 'Железная лопата', 1),
            ('minecraft:shears', 'Ножницы', 1),
            ('minecraft:flint_and_steel', 'Огниво', 1),
            ('minecraft:bucket', 'Ведро', 2),
            ('minecraft:water_bucket', 'Ведро воды', 1),
        ]),
        ('Освещение и материалы', [
            ('minecraft:torch', 'Факелы для шахты', 32),
            ('minecraft:lantern', 'Фонарь', 8),
            ('minecraft:campfire', 'Полевой костёр', 2),
            ('minecraft:sand', 'Песок', 32),
            ('minecraft:gravel', 'Гравий', 32),
            ('minecraft:clay_ball', 'Глина', 32),
            ('minecraft:brick', 'Кирпич', 32),
            ('minecraft:bricks', 'Кирпичный блок', 16),
            ('minecraft:glass', 'Стекло', 32),
            ('minecraft:leather', 'Кожа', 12),
            ('minecraft:paper', 'Бумага', 24),
            ('minecraft:book', 'Книга', 8),
            ('minecraft:writable_book', 'Полевой журнал', 1),
        ]),
        ('Уют и полевой ночлег', [
            ('minecraft:white_wool', 'Шерсть', 12),
            ('minecraft:lead', 'Поводок', 2),
            ('minecraft:name_tag', 'Бирка', 2),
            ('minecraft:saddle', 'Седло', 1),
            ('minecraft:map', 'Чистая карта', 2),
            ('minecraft:compass', 'Компас', 1),
            ('minecraft:clock', 'Часы', 1),
        ] + [(it, en, 1) for it, en in pool('comforts', limit=6)] + [
            (it, en, 1) for it, en in pool('supplementaries', limit=3)
        ] + [(it, en, 1) for it, en in pool('torchmaster', limit=4)]),
        ('Neon Glowsticks, Hands-On Vanilla и Origins', [
            ('neon_glowsticks:white_glowstick', 'Neon Glowsticks: Белая палочка', 4),
            ('neon_glowsticks:green_glowstick', 'Neon Glowsticks: Зелёная палочка', 4),
            ('neon_glowsticks:cyan_glowstick', 'Neon Glowsticks: Бирюзовая палочка', 4),
            ('neon_glowsticks:yellow_glowstick', 'Neon Glowsticks: Жёлтая палочка', 4),
            ('neon_glowsticks:red_glowstick', 'Neon Glowsticks: Красная палочка', 4),
            ('neon_glowsticks:black_glowstick', 'Neon Glowsticks: Чёрная (УФ) палочка', 4),
            ('origins:orb_of_origin', 'Origins: Сфера кастомного происхождения', 1),
            ('minecraft:white_wool', 'The Furry Project (CurseForge optional-mods)', 8),
        ]),
        ('Фермерство и приручение', [
            ('minecraft:wheat_seeds', 'Семена пшеницы', 16),
            ('minecraft:wheat', 'Урожай пшеницы', 32),
            ('minecraft:sugar_cane', 'Сахарный тростник', 16),
            ('minecraft:carrot', 'Морковь', 16),
            ('minecraft:potato', 'Картофель', 16),
            ('minecraft:beetroot', 'Свёкла', 16),
            ('minecraft:pumpkin', 'Тыква', 8),
            ('minecraft:melon_slice', 'Арбуз', 16),
            ('minecraft:cocoa_beans', 'Какао-бобы', 8),
            ('minecraft:sweet_berries', 'Сладкие ягоды', 16),
            ('minecraft:glow_berries', 'Светящиеся ягоды', 8),
            ('minecraft:bone', 'Кости для удобрения', 16),
            ('minecraft:string', 'Нить', 16),
            ('minecraft:feather', 'Перья', 8),
        ]),
    ]
    for _, items in ch15_lanes:
        for it, _, _ in items:
            used_mc.add(it)
    total += emit_chapter(
        '15', '15 · Выживание: Стартовые ремёсла', 'Основы выживания Long Haul',
        'Лагерь первопроходца', 'minecraft:campfire',
        'Первые ресурсы, тактильные верстаки Hands-On Vanilla, Neon Glowsticks, TorchMaster, Comforts и кастомные Origins (опциональный The Furry Project см. optional-mods/).',
        'story_02_bakery_burned', ch15_lanes, tier=1,
    )

    # =======================================================================
    # 16 · Выживание: Инструменты, Незер и Энд (~82 quests)
    # =======================================================================
    ch16_lanes = [
        ('Глубины и редстоун', [
            ('minecraft:raw_gold', 'Сырое золото', 12),
            ('minecraft:gold_ingot', 'Золотой слиток', 12),
            ('minecraft:redstone', 'Красная пыль', 32),
            ('minecraft:lapis_lazuli', 'Лазурит', 24),
            ('minecraft:diamond', 'Алмаз', 8),
            ('minecraft:emerald', 'Изумруд', 8),
            ('minecraft:amethyst_shard', 'Аметистовый осколок', 16),
            ('minecraft:obsidian', 'Обсидиан', 16),
            ('minecraft:crying_obsidian', 'Плачущий обсидиан', 4),
            ('minecraft:diamond_pickaxe', 'Алмазная кирка', 1),
            ('minecraft:diamond_axe', 'Алмазный топор', 1),
            ('minecraft:diamond_shovel', 'Алмазная лопата', 1),
            ('minecraft:spyglass', 'Подзорная труба', 1),
        ]),
        ('Станции и логистика редстоуна', [
            ('minecraft:lever', 'Рычаг', 4),
            ('minecraft:redstone_torch', 'Красный факел', 8),
            ('minecraft:repeater', 'Повторитель', 4),
            ('minecraft:comparator', 'Компаратор', 4),
            ('minecraft:piston', 'Поршень', 4),
            ('minecraft:sticky_piston', 'Липкий поршень', 4),
            ('minecraft:observer', 'Наблюдатель', 4),
            ('minecraft:hopper', 'Загрузочная воронка', 6),
            ('minecraft:dropper', 'Выбрасыватель', 2),
            ('minecraft:dispenser', 'Раздатчик', 2),
            ('minecraft:daylight_detector', 'Датчик дневного света', 2),
            ('minecraft:redstone_lamp', 'Редстоуновый фонарь', 4),
            ('minecraft:lightning_rod', 'Громоотвод', 2),
        ]),
        ('Кузница, чары и зелья', [
            ('minecraft:anvil', 'Наковальня', 1),
            ('minecraft:grindstone', 'Точило', 1),
            ('minecraft:smithing_table', 'Стол кузнеца', 1),
            ('minecraft:stonecutter', 'Камнерез', 1),
            ('minecraft:cartography_table', 'Стол картографа', 1),
            ('minecraft:loom', 'Ткацкий станок', 1),
            ('minecraft:bookshelf', 'Книжные полки', 15),
            ('minecraft:enchanting_table', 'Стол зачарования', 1),
            ('minecraft:lectern', 'Кафедра', 1),
            ('minecraft:brewing_stand', 'Зельеварка', 1),
            ('minecraft:cauldron', 'Котёл', 1),
            ('minecraft:golden_apple', 'Золотое яблоко', 2),
            ('minecraft:glistering_melon_slice', 'Сверкающий арбуз', 4),
        ]),
        ('Экспедиция в Незер', [
            ('minecraft:lava_bucket', 'Ведро лавы', 2),
            ('minecraft:netherrack', 'Незерак', 64),
            ('minecraft:soul_sand', 'Песок душ', 16),
            ('minecraft:soul_soil', 'Почва душ', 16),
            ('minecraft:basalt', 'Базальт', 32),
            ('minecraft:blackstone', 'Чернит', 32),
            ('minecraft:glowstone_dust', 'Светокаменная пыль', 16),
            ('minecraft:quartz', 'Незер-кварц', 32),
            ('minecraft:nether_wart', 'Незерский нарост', 16),
            ('minecraft:blaze_rod', 'Огненный стержень', 8),
            ('minecraft:blaze_powder', 'Огненный порошок', 16),
            ('minecraft:magma_cream', 'Сгусток магмы', 8),
            ('minecraft:ghast_tear', 'Слеза гаста', 2),
        ]),
        ('Незерит и океанские реликвии', [
            ('minecraft:ancient_debris', 'Древние обломки', 4),
            ('minecraft:netherite_scrap', 'Незеритовый лом', 4),
            ('minecraft:netherite_ingot', 'Незеритовый слиток', 2),
            ('minecraft:netherite_pickaxe', 'Незеритовая кирка', 1),
            ('minecraft:respawn_anchor', 'Якорь возрождения', 1),
            ('minecraft:prismarine_shard', 'Осколок призмарина', 16),
            ('minecraft:prismarine_crystals', 'Кристаллы призмарина', 8),
            ('minecraft:nautilus_shell', 'Раковина наутилуса', 4),
            ('minecraft:heart_of_the_sea', 'Сердце моря', 1),
            ('minecraft:conduit', 'Морской источник', 1),
            ('minecraft:trident', 'Трезубец', 1),
            ('minecraft:scute', 'Щиток черепахи', 5),
            ('minecraft:sponge', 'Губка', 4),
        ]),
        ('Штурм Энда и Маяки', [
            ('minecraft:ender_pearl', 'Жемчуг Энда', 12),
            ('minecraft:ender_eye', 'Око Энда', 12),
            ('minecraft:end_stone', 'Эндерняк', 32),
            ('minecraft:end_rod', 'Стержень Энда', 8),
            ('minecraft:chorus_fruit', 'Плод хоруса', 16),
            ('minecraft:popped_chorus_fruit', 'Прожаренный плод хоруса', 16),
            ('minecraft:dragon_breath', 'Драконье дыхание', 4),
            ('minecraft:elytra', 'Элитры', 1),
            ('minecraft:phantom_membrane', 'Мембрана фантома', 6),
            ('minecraft:nether_star', 'Звезда Незера', 1),
            ('minecraft:beacon', 'Маяк', 1),
            ('minecraft:totem_of_undying', 'Тотем бессмертия', 1),
            ('minecraft:recovery_compass', 'Компас возврата', 1),
        ]),
    ]
    total += emit_chapter(
        '16', '16 · Выживание: Инструменты, Незер и Энд', 'Покорение измерений',
        'Алмазы, Незер и Энд', 'minecraft:ender_eye',
        'От глубоких шахт и редстоуна до Незера, незерита, Энда и маяков.',
        'ch15_99_master', ch16_lanes, tier=2,
    )

    # =======================================================================
    # 17 · Вооружение: Tetra и Защита (~60 quests)
    # =======================================================================
    used_tetra = set()
    tetra_lanes = take_from('tetra', [
        ('Молоты и верстаки Tetra', ['hammer', 'workbench', 'forged', 'rack']),
        ('Модули и улучшения', ['geode', 'scroll', 'stone', 'metal', 'claw']),
        ('Древние реликвии Tetra', ['chamber', 'core', 'capacitor', 'vent', 'scanner']),
    ], 34, used_tetra)
    tetra_lanes.append(['Броня и щиты выживания', [
        ('minecraft:iron_helmet', 'Железный шлем'),
        ('minecraft:iron_chestplate', 'Железный нагрудник'),
        ('minecraft:iron_leggings', 'Железные поножи'),
        ('minecraft:iron_boots', 'Железные ботинки'),
        ('minecraft:shield', 'Полевой щит'),
        ('minecraft:bow', 'Лук'),
        ('minecraft:crossbow', 'Арбалет'),
        ('minecraft:arrow', 'Боевые стрелы'),
        ('minecraft:spectral_arrow', 'Спектральные стрелы'),
        ('minecraft:diamond_helmet', 'Алмазный шлем'),
        ('minecraft:diamond_chestplate', 'Алмазный нагрудник'),
        ('minecraft:diamond_leggings', 'Алмазные поножи'),
        ('minecraft:diamond_boots', 'Алмазные ботинки'),
        ('minecraft:netherite_sword', 'Незеритовый меч'),
    ]])
    total += emit_chapter(
        '17', '17 · Вооружение: Tetra и Кузница', 'Модульные инструменты и броня',
        'Кузница Tetra', 'minecraft:anvil',
        'Сборка и модернизация модульных инструментов Tetra, руинные молоты и броня.',
        'mod_gear_combat', tetra_lanes, tier=2,
    )

    # =======================================================================
    # 18 · Арсенал: Simply Swords и Артефакты (~110 quests)
    # =======================================================================
    used_ss = set()
    ss_lanes = take_from('simplyswords', [
        ('Железное и золотое оружие', ['iron_', 'gold_']),
        ('Алмазный арсенал', ['diamond_']),
        ('Незеритовые клинки', ['netherite_']),
        ('Уникальные рунические мечи', ['runic', 'brimstone', 'storm', 'sun', 'watcher', 'whisper', 'flame', 'frost', 'ember', 'soul', 'waxweaver']),
    ], 108, used_ss)
    total += emit_chapter(
        '18', '18 · Арсенал: Simply Swords и Артефакты', 'Боевое искусство Simply Swords',
        'Клинки Simply Swords', 'minecraft:diamond_sword',
        'От простых железных рапир и алебард до уникальных рунических и легендарных артефактов.',
        'mod_gear_combat', ss_lanes, tier=3,
    )

    # =======================================================================
    # 19..21 · Create (300 quests across 3 focused sub-chapters)
    # =======================================================================
    used_cr = set()
    cr19_lanes = take_from('create', [
        ('Кинетика и приводы', ['shaft', 'cogwheel', 'water_wheel', 'windmill', 'hand_crank', 'gearbox', 'clutch', 'gearshift', 'speed_controller', 'steam_engine']),
        ('Обработка и станки', ['press', 'mixer', 'millstone', 'crushing', 'mechanical_saw', 'mechanical_drill', 'deployer', 'mechanical_harvester', 'plough', 'encased_fan']),
        ('Логистика и конвейеры', ['belt', 'funnel', 'tunnel', 'chute', 'depot', 'vault', 'mechanical_arm', 'portable_storage', 'stockpile', 'weighted_ejector']),
        ('Сплавы, листы и механизмы', ['andesite', 'brass', 'zinc', 'sheet', 'nugget', 'precision_mechanism', 'electron_tube', 'sturdy_sheet', 'wrench', 'goggles']),
    ], 102, used_cr)
    total += emit_chapter(
        '19', '19 · Create: Кинетика и Механизмы', 'Инженерия Create · Часть I',
        'Цех Create: Вращение и Станки', 'create:cogwheel',
        'Вся базовая кинетика, станки обработки, конвейеры и сплавы Create.',
        'tutorial_waterwheel', cr19_lanes, tier=2,
    )

    cr20_lanes = take_from('create', [
        ('Ж/Д пути и поезда', ['track', 'train', 'schedule', 'station', 'bogey', 'signal', 'controls', 'coupler']),
        ('Жидкости, трубы и котлы', ['fluid', 'pipe', 'hose', 'spout', 'drain', 'pump', 'boiler', 'blaze_burner', 'tank']),
        ('Редстоун и точная логика', ['link', 'pulse', 'sequenced', 'speedometer', 'stressometer', 'display', 'nixie', 'sticker', 'controller']),
        ('Инструменты и устройства', ['wand', 'extendo', 'potato', 'jetpack_skip', 'schematic', 'clipboard', 'filter', 'package', 'cardboard']),
    ], 98, used_cr)
    total += emit_chapter(
        '20', '20 · Create: Поезда и Автоматика', 'Инженерия Create · Часть II',
        'Магистрали и Жидкости Create', 'create:track',
        'Железнодорожные составы, паровые котлы, жидкостные линии и программируемая логика.',
        'ch19_99_master', cr20_lanes, tier=2,
    )

    cr21_lanes = take_from('create', [
        ('Корпуса, балки и опоры', ['casing', 'girder', 'bracket', 'scaffolding', 'ladder', 'bars']),
        ('Окна, двери и декор', ['window', 'door', 'trapdoor', 'seat', 'table', 'placard', 'blaze_cake', 'builders_tea']),
        ('Медный и латунный декор', ['copper', 'brass', 'shingle', 'tile', 'valve_handle', 'flywheel']),
        ('Камень и отделка Create', ['limestone', 'scoria', 'scorchia', 'crimsite', 'veridium', 'ochrum', 'asurine', 'cut_', 'polished_']),
    ], 98, used_cr)
    total += emit_chapter(
        '21', '21 · Create: Конструкции и Декор', 'Инженерия Create · Часть III',
        'Архитектура и блоки Create', 'create:brass_casing',
        'Промышленная архитектура, декоративные породы камня и элементы отделки цехов.',
        'ch20_99_master', cr21_lanes, tier=2,
    )

    # =======================================================================
    # 22 · Create Addons: Энергия, Кухня и Чары (~88 quests)
    # =======================================================================
    used_ca, used_cck, used_cei = set(), set(), set()
    ch22_lanes = []
    ch22_lanes.extend(take_from('createaddition', [
        ('Энергетика Create Additions', ['alternator', 'electric_motor', 'modular_accumulator', 'tesla_coil', 'rolling_mill']),
        ('Кабели, катушки и топливо', ['spool', 'wire', 'connector', 'capacitor', 'biomass', 'seed_oil', 'bioethanol', 'cake']),
    ], 44, used_ca))
    ch22_lanes.extend(take_from('create_central_kitchen', [
        ('Кулинарные руководства и базы', ['cooking_guide', 'blaze_stove', 'dough', 'pie', 'cake', 'honey', 'chocolate']),
    ], 36, used_cck))
    ch22_lanes.extend(take_from('create_enchantment_industry', [
        ('Магия и опыт Create', ['disenchanter', 'printer', 'ink', 'experience', 'hyper']),
    ], 6, used_cei))
    total += emit_chapter(
        '22', '22 · Create Addons: Энергия и Чар-магия', 'Расширения Create',
        'Аддоны Create: Ток, Кухня и Опыт', 'createaddition:electric_motor',
        'Преобразование вращения в FE, автоматическая кулинария и промышленная печать книг зачарований.',
        'tutorial_precision', ch22_lanes, tier=3,
    )

    # =======================================================================
    # 23..24 · Immersive Engineering (~210 quests)
    # =======================================================================
    used_ie = set()
    ie23_lanes = take_from('immersiveengineering', [
        ('Металлургия и кокс IE', ['ingot_', 'plate_', 'rod_', 'wire_', 'dust_', 'raw_', 'coke', 'slag']),
        ('Провода и генераторы', ['coil_', 'wirecoil', 'connector', 'relay', 'transformer', 'dynamo', 'thermoelectric', 'windmill', 'waterwheel']),
        ('Конвейеры, трубы и станки', ['conveyor', 'pipe', 'chute', 'turntable', 'crusher', 'sawmill', 'press', 'squeezer', 'fermenter', 'refinery']),
        ('Инструменты и схемы IE', ['hammer', 'wirecutter', 'screwdriver', 'voltmeter', 'blueprint', 'manual', 'mold_', 'component_']),
    ], 110, used_ie)
    total += emit_chapter(
        '23', '23 · Immersive Engineering: Сталь и Многоблоки', 'Тяжёлая индустрия · Часть I',
        'Заводы Immersive Engineering', 'immersiveengineering:hammer',
        'Доменные печи, сталь, высоковольтные ЛЭП и многоблочные станки IE.',
        'mod_heavy_industry', ie23_lanes, tier=2,
    )

    ie24_lanes = take_from('immersiveengineering', [
        ('Архитектура и конструкции IE', ['treated_', 'scaffolding', 'sheetmetal', 'concrete', 'slab_', 'stairs_', 'fence']),
        ('Вооружение и боеприпасы', ['railgun', 'revolver', 'chemthrower', 'turret', 'casull', 'buckshot', 'armor_piercing', 'dragon', 'potion']),
        ('Химия, газы и жидкости', ['creosote', 'biodiesel', 'ethanol', 'plantoil', 'herbicide', 'fluid', 'jerrycan', 'barrel']),
        ('Сенсоры, лампы и отделка', ['lantern', 'floodlight', 'tesla', 'capacitor', 'breaker', 'banner', 'balloon', 'crate']),
    ], 96, used_ie)
    total += emit_chapter(
        '24', '24 · Immersive Engineering: Конструкции и Арсенал', 'Тяжёлая индустрия · Часть II',
        'Инфраструктура и Оборона IE', 'immersiveengineering:dynamo',
        'Обработанная древесина, прожектора, рельсотроны, хим-топливо и защитные турели.',
        'ch23_99_master', ie24_lanes, tier=3,
    )

    # =======================================================================
    # 25 · PneumaticCraft: Repressurized (~110 quests)
    # =======================================================================
    used_pnc = set()
    pnc_lanes = take_from('pneumaticcraft', [
        ('Давление и компрессоры', ['ingot_iron_compressed', 'pressure', 'compressor', 'tube', 'gauge', 'valve', 'regulator']),
        ('Пластик, платы и PCB', ['plastic', 'pcb', 'transistor', 'capacitor', 'etching', 'uv_light', 'assembly', 'microchip']),
        ('Производство и трубы', ['refinery', 'thermopneumatic', 'omnidirectional_hopper', 'heat_', 'vortex', 'liquid_compressor']),
        ('Дроны, пневмо-броня и пушки', ['drone', 'pneumatic_', 'minigun', 'ammo', 'amadron', 'wrench', 'upgrade']),
    ], 108, used_pnc)
    total += emit_chapter(
        '25', '25 · PneumaticCraft: Давление и Компрессоры', 'Пневматика и Дроны',
        'Цех высокого давления PNC', 'pneumaticcraft:pneumatic_wrench',
        'Сжатый воздух, термопневматическая переработка, травление плат PCB и программируемые дроны.',
        'mod_heavy_industry', pnc_lanes, tier=3,
    )

    # =======================================================================
    # 26 · Modular Routers и SFM (~66 quests)
    # =======================================================================
    used_mr, used_sfm = set(), set()
    ch26_lanes = take_from('modularrouters', [
        ('Маршрутизаторы и ядра', ['modular_router', 'blank_', 'augment_core', 'override_card', 'filter']),
        ('Модули отправки и приёма', ['sender_module', 'puller_module', 'placer_module', 'breaker_module', 'extruder', 'vacuum', 'fluid_module']),
        ('Апгрейды скорости и стека', ['upgrade', 'speed', 'stack', 'blast', 'camouflage', 'security']),
    ], 48, used_mr) + take_from('sfm', [
        ('Super Factory Manager', ['manager', 'cable', 'disk', 'label', 'water_tank', 'printing_press']),
    ], 16, used_sfm)
    total += emit_chapter(
        '26', '26 · Логистика: Modular Routers и SFM', 'Умная маршрутизация предметов',
        'Сети Modular Routers и SFM', 'modularrouters:modular_router',
        'Беструбная сортировка, пуллеры/сендеры Modular Routers и программируемая фабрика SFM.',
        'mod_heavy_industry', ch26_lanes, tier=3,
    )

    # =======================================================================
    # 27 · Integrated Dynamics и Tunnels (~74 quests)
    # =======================================================================
    used_id, used_it = set(), set()
    ch27_lanes = take_from('integrateddynamics', [
        ('Менрил и базовые блоки', ['menril', 'squeezer', 'drying_basin', 'cable', 'energy_battery', 'generator']),
        ('Логика, переменные и карты', ['variable', 'logic', 'reader', 'writer', 'display', 'labeller', 'wrench']),
        ('Аспекты и фильтрация', ['part_', 'facade', 'proto', 'omni', 'delay']),
    ], 54, used_id) + take_from('integratedtunnels', [
        ('Integrated Tunnels', ['importer', 'exporter', 'interface', 'part_']),
    ], 18, used_it)
    total += emit_chapter(
        '27', '27 · Логика: Integrated Dynamics', 'Функциональная автоматизация',
        'Сеть Integrated Dynamics', 'integrateddynamics:cable',
        'Дерево менрил, карты переменных, предикаты и высокоскоростные туннели ресурсов.',
        'mod_heavy_industry', ch27_lanes, tier=3,
    )

    # =======================================================================
    # 28 · Railcraft Reborn: Ж/Д Магистрали (~110 quests)
    # =======================================================================
    used_rc = set()
    rc_lanes = take_from('railcraft', [
        ('Рельсы и стрелочные пути', ['track', 'rail', 'switch', 'wye', 'junction', 'coupler']),
        ('Локомотивы и подвижной состав', ['locomotive', 'cart', 'tank_cart', 'cargo', 'work_cart', 'bore']),
        ('Котлы, турбины и топки', ['boiler', 'firebox', 'steam', 'turbine', 'tank_', 'water_']),
        ('Сигнализация, семафоры и станции', ['signal', 'controller', 'receiver', 'box', 'semaphore', 'loader', 'unloader', 'detector']),
    ], 108, used_rc)
    total += emit_chapter(
        '28', '28 · Railcraft Reborn: Ж/Д Магистрали', 'Классическая железная дорога',
        'Депо Railcraft Reborn', 'create:track_station',
        'Паровозы, специализированные вагоны, сигнальные блоки, погрузчики и паровые котлы.',
        'tutorial_track', rc_lanes, tier=2,
    )

    # =======================================================================
    # 29 · Little Logistics и Автотранспорт (~58 quests)
    # =======================================================================
    used_ll, used_am = set(), set()
    ch29_lanes = take_from('littlelogistics', [
        ('Речные буксиры и баржи', ['tug', 'barge', 'dock', 'buoy', 'conductors']),
        ('Малые поезда и стрелки', ['locomotive', 'car', 'rail', 'switch', 'seater', 'fluid_hopper']),
    ], 36, used_ll) + take_from('automobility', [
        ('Automobility: авто и трассы', ['automobile', 'frame', 'wheel', 'engine', 'slope', 'dash', 'crowbar', 'off_road']),
    ], 20, used_am)
    total += emit_chapter(
        '29', '29 · Little Logistics и Автотранспорт', 'Малые поезда, баржи и авто',
        'Лёгкий транспорт и дороги', 'minecraft:minecart',
        'Компактные водные баржи и маневровые тепловозы Little Logistics + автомобили Automobility.',
        'mod_road_vehicles', ch29_lanes, tier=2,
    )

    # =======================================================================
    # 30 · Флот: Small Ships и Valkyrien Skies (~100 quests)
    # =======================================================================
    used_ss2, used_vs, used_eu = set(), set(), set()
    ch30_lanes = take_from('smallships', [
        ('Когги и галеры Small Ships', ['cog', 'galley']),
        ('Драккары и бригантины', ['drakkar', 'brigg']),
        ('Паруса, пушки и оснастка', ['sail', 'cannon', 'cannonball', 'oak_', 'spruce_', 'birch_']),
    ], 64, used_ss2) + take_from('vs_eureka', [
        ('Eureka! и Valkyrien Skies', ['helm', 'engine', 'floater', 'ballast', 'balloon', 'anchor']),
    ], 26, used_vs) + take_from('valkyrienskies', [
        ('Физические ядра VS2', ['test', 'ship', 'wand', 'physics']),
    ], 8, used_eu)
    total += emit_chapter(
        '30', '30 · Флот: Small Ships и Valkyrien Skies', 'Мореплавание и физика судов',
        'Верфь Консорциума', 'minecraft:oak_boat',
        'От деревянных коггов и драккаров Small Ships до летучих и морских кораблей на движке Valkyrien Skies.',
        'mod_ships_vs', ch30_lanes, tier=2,
    )

    # =======================================================================
    # 31 · Авиация: Immersive Aircraft (~30 quests)
    # =======================================================================
    used_ia = set()
    ch31_lanes = take_from('immersive_aircraft', [
        ('Воздушные суда', ['biplane', 'airship', 'gyrodyne', 'quadrocopter', 'warship', 'bamboo_hopper']),
        ('Двигатели и крылья', ['engine', 'propeller', 'sail', 'hull', 'boiler']),
        ('Вооружение и приборы', ['rotary', 'heavy_crossbow', 'telescope', 'bomb', 'enhanced', 'eco', 'nether']),
    ], 27, used_ia)
    total += emit_chapter(
        '31', '31 · Авиация: Immersive Aircraft', 'Воздушные трассы (без джетпаков)',
        'Аэродром Immersive Aircraft', 'minecraft:elytra',
        'Бипланы, гиродины, грузовые дирижабли и бортовые улучшения без читерных джетпаков.',
        'mod_airships', ch31_lanes, tier=3,
    )

    # =======================================================================
    # 32 · Вычислительная сеть: CC: Tweaked (~26 quests)
    # =======================================================================
    used_cc = set()
    ch32_lanes = take_from('computercraft', [
        ('Компьютеры и черепахи', ['computer', 'turtle', 'pocket']),
        ('Мониторы, модемы и кабели', ['monitor', 'modem', 'cable', 'speaker', 'printer']),
        ('Носители и периферия', ['disk', 'drive', 'redstone_relay']),
    ], 23, used_cc)
    total += emit_chapter(
        '32', '32 · Вычислительная сеть: CC: Tweaked', 'Автоматизация на Lua',
        'Вычислительный центр CC', 'computercraft:computer_normal',
        'Терминалы телеметрии, беспроводные модемы, мониторы и программируемые черепахи.',
        'tutorial_computer', ch32_lanes, tier=2,
    )

    # =======================================================================
    # 33 · Хранение, Печи и AE2: Functional, Iron Furnaces & AE2 (~80 quests)
    # =======================================================================
    used_fs, used_if = set(), set()
    ch33_lanes = take_from('ironfurnaces', [
        ('Линейка быстрых печей', ['copper', 'iron', 'silver', 'gold', 'diamond', 'emerald', 'obsidian', 'crystal', 'netherite']),
        ('Аугменты и ядра печей', ['augment', 'upgrade', 'heater', 'rainbow']),
    ], 34, used_if) + take_from('functionalstorage', [
        ('Ящики Functional Storage', ['oak_', 'spruce_', 'birch_', 'fluid_', 'compacting', 'controller']),
        ('Улучшения ящиков (без эндера)', ['upgrade', 'collector', 'puller', 'pusher', 'void', 'linking']),
    ], 27, used_fs) + [
        ('AE2: Кристаллы, зарядник и прессы', [
            ('ae2:meteorite_compass', 'Метеоритный компас', 1),
            ('ae2:certus_quartz_crystal', 'Кристалл истинного кварца', 16),
            ('ae2:charger', 'Зарядник AE2', 1),
            ('ae2:inscriber', 'Высекатель схем', 1),
            ('ae2:fluix_crystal', 'Кристалл флюикса', 16),
            ('ae2:item_storage_cell_1k', 'Ячейка памяти 1k', 1),
            ('ae2:item_storage_cell_4k', 'Ячейка памяти 4k', 1),
        ]),
        ('AE2: ME-сеть, диски и автокрафт', [
            ('ae2:controller', 'ME Контроллер', 1),
            ('ae2:drive', 'ME Накопитель', 1),
            ('ae2:crafting_terminal', 'ME Терминал создания', 1),
            ('ae2:item_storage_cell_16k', 'Ячейка памяти 16k', 1),
            ('ae2:item_storage_cell_64k', 'Ячейка памяти 64k', 1),
            ('ae2:pattern_provider', 'Поставщик шаблонов', 1),
            ('ae2:molecular_assembler', 'Молекулярный сборщик', 1),
            ('ae2:wireless_terminal', 'Беспроводной терминал AE2', 1),
        ]),
    ]
    total += emit_chapter(
        '33', '33 · Склады и Печи: Functional & Iron Furnaces', 'Хранение, плавка и ME-сети AE2',
        'Складской комплекс и AE2', 'ae2:controller',
        'Высокоскоростные печи Iron Furnaces, модульные ящики Functional Storage (без эндер-ящиков) и цифровые сети Applied Energistics 2.',
        'mod_ae2_overview', ch33_lanes, tier=2,
    )

    # =======================================================================
    # 34 · Extreme Reactors: Энергоблоки (~108 quests)
    # =======================================================================
    used_er = set()
    er_lanes = take_from('bigreactors', [
        ('Уран, йеллориум и графит', ['yellorium', 'cyanite', 'blutonium', 'graphite', 'ludicrite', 'ridiculite', 'inanite', 'anglesite', 'benitoite']),
        ('Реакторы Basic и Reinforced', ['basic_reactor', 'reinforced_reactor', 'fuelrod', 'controlrod']),
        ('Турбины и теплообмен', ['turbine', 'fluidizer', 'reprocessor', 'rotor', 'coil']),
        ('Интерфейсы и мониторинг', ['tap', 'port', 'glass', 'controller', 'wrench']),
    ], 106, used_er)
    total += emit_chapter(
        '34', '34 · Extreme Reactors: Энергоблоки', 'Ядерные реакторы Extreme Reactors',
        'Энергоблок Extreme Reactors', 'bigreactors:basic_reactorcontroller',
        'От малых урановых реакторов до многоблочных паровых турбин и переработки цианита.',
        'nuclear_01_geiger', er_lanes, tier=3,
    )

    # =======================================================================
    # 35..36 · NuclearCraft Neoteric (~220 quests)
    # =======================================================================
    used_nc = set()
    nc35_lanes = take_from('nuclearcraft', [
        ('Руды, металлы и сплавы NC', ['ingot', 'plate', 'dust', 'raw_', 'thorium', 'uranium', 'lithium', 'boron', 'magnesium', 'lead', 'steel']),
        ('Изотопы и ядерное топливо', ['fuel_', 'plutonium', 'neptunium', 'americium', 'curium', 'berkelium', 'californium', 'pellet']),
        ('Дозиметрия и базовая радиация', ['geiger', 'rad', 'hazmat', 'shielding', 'dosimeter', 'cask']),
        ('Базовые машины NuclearCraft', ['furnace', 'manufactory', 'isotope', 'decay', 'fuel_reprocessor', 'alloy', 'infuser', 'melter', 'rock_crusher']),
    ], 112, used_nc)
    total += emit_chapter(
        '35', '35 · NuclearCraft: Топливо и Изотопы', 'Ядерная физика · Часть I',
        'Лаборатория NuclearCraft', 'nuclearcraft:geiger_counter',
        'Радиационная безопасность, разделение изотопов и ядерные топливные циклы.',
        'nuclear_02_electrodynamics', nc35_lanes, tier=3,
    )

    nc36_lanes = take_from('nuclearcraft', [
        ('Корпуса и детали реактора', ['fission', 'casing', 'port', 'vent', 'controller', 'cell', 'moderator']),
        ('Охладители и теплоотводы', ['heat_sink', 'cooler', 'water', 'redstone', 'quartz', 'gold', 'glowstone', 'lapis', 'diamond', 'emerald', 'helium', 'cryotheum']),
        ('Турбины, термояд и ускорители', ['turbine', 'fusion', 'electromagnet', 'coil', 'rotor', 'dynamo']),
        ('Компоненты, батареи и Voltaic', ['servo', 'motor', 'actuator', 'battery', 'solar', 'upgrade', 'chassis']),
    ], 94, used_nc) + take_from('electrodynamics', [
        ('Electrodynamics и Voltaic', ['wire', 'ingot', 'plate', 'motor', 'circuit', 'guidebook', 'battery', 'cable']),
    ], 14)
    total += emit_chapter(
        '36', '36 · NuclearCraft: Реакторы и Электродинамика', 'Ядерная физика · Часть II',
        'Реакторы деления и Electrodynamics', 'nuclearcraft:steel_ingot',
        'Проектирование реакторов деления, турбины, синтез и высоковольтная электродинамика.',
        'ch35_99_master', nc36_lanes, tier=4,
    )

    # =======================================================================
    # 37 · Draconic Evolution: Поздняя энергетика (~122 quests)
    # =======================================================================
    used_de = set()
    de_lanes = take_from('draconicevolution', [
        ('Дракониум и базовые ядра', ['draconium', 'core', 'wyvern', 'awakened', 'chaos']),
        ('Крафт слияния (Fusion)', ['crafting', 'injector', 'reactor', 'stabilizer', 'generator']),
        ('Энергосети и модули', ['energy', 'crystal', 'relay', 'pylon', 'module']),
        ('Снаряжение Виверны и Дракона', ['sword', 'pickaxe', 'axe', 'shovel', 'bow', 'staff', 'chestpiece', 'capacitor']),
    ], 120, used_de)
    total += emit_chapter(
        '37', '37 · Draconic Evolution: Поздняя энергетика', 'Абсолютная энергия Дракона',
        'Центр слияния Draconic Evolution', 'draconicevolution:draconium_ingot',
        'Дракониевые ядра, крафт слияния, энергосети I/O и броня Виверны (дислокаторы отключены).',
        'nuclear_05_draconium', de_lanes, tier=4,
    )

    # =======================================================================
    # 38..39 · Farmer's Delight & Cooking for Blockheads (~190 quests)
    # =======================================================================
    used_fd = set()
    fd38_lanes = take_from('farmersdelight', [
        ('Инструменты и утварь', ['knife', 'cutting_board', 'cooking_pot', 'skillet', 'stove', 'basket', 'canvas']),
        ('Культуры, семена и заготовки', ['cabbage', 'tomato', 'onion', 'rice', 'dough', 'pasta', 'minced', 'bacon', 'cod_slice', 'salmon_slice']),
        ('Супы, похлёбки и жаркое', ['stew', 'soup', 'broth', 'curry', 'noodle', 'pasta_with', 'ratatouille', 'roast']),
        ('Полевые блюда и разделка', ['ham', 'chicken', 'mutton', 'steak', 'rice_roll', 'kelp_roll', 'dumplings', 'stuffed']),
    ], 102, used_fd) + [
        ('Hands-On Delight: Тактильная кухня', [
            ('farmersdelight:cutting_board', 'Hands-On: Разделка ножом на доске', 1),
            ('farmersdelight:stove', 'Hands-On: Жарка на кухонной плите', 1),
            ('farmersdelight:skillet', 'Hands-On: Полевая сковорода', 1),
            ('farmersdelight:cooking_pot', 'Hands-On: Варка без меню (вручную)', 1),
        ]),
    ]
    total += emit_chapter(
        '38', '38 · Farmer\'s Delight: Полевая кухня', 'Кулинария и агрономия · Часть I',
        'Полевая кухня Farmer\'s Delight', 'farmersdelight:cooking_pot',
        'Овощеводство, разделочная доска, кастрюли, сковороды и тактильная готовка Hands-On Delight прямо в мире.',
        'tutorial_cookpot', fd38_lanes, tier=1,
    )

    fd39_lanes = take_from('farmersdelight', [
        ('Сэндвичи, роллы и салаты', ['sandwich', 'burger', 'wrap', 'salad', 'toast']),
        ('Десерты, напитки и пиры', ['pie', 'cake', 'cookie', 'cider', 'cocoa', 'honey', 'feast', 'glazed', 'shepherds']),
        ('Корзины, снопы и декор', ['crate', 'bag', 'bale', 'tatami', 'cabinet', 'rug', 'sign']),
    ], 76, used_fd) + take_from('cookingforblockheads', [
        ('Кухня Cooking for Blockheads', ['sink', 'oven', 'fridge', 'counter', 'cabinet', 'toast', 'book', 'table']),
    ], 11)
    total += emit_chapter(
        '39', '39 · Farmer\'s Delight: Праздничные столы и Кухня', 'Кулинария и агрономия · Часть II',
        'Праздничная кухня и пиршества', 'farmersdelight:beef_stew',
        'Застольные блюда, выпечка и многоблочные кухни Cooking for Blockheads.',
        'ch38_99_master', fd39_lanes, tier=2,
    )

    # =======================================================================
    # 40 · Vinery и Brewin' & Chewin' (~120 quests)
    # =======================================================================
    used_vn, used_bc = set(), set()
    ch40_lanes = take_from('vinery', [
        ('Виноградники и саженцы', ['grape', 'seeds', 'cherry', 'apple', 'crate', 'basket', 'soil']),
        ('Винодельни, прессы и бочки', ['press', 'fermentation', 'barrel', 'rack', 'bottle', 'hat', 'apron']),
        ('Коллекционные вина Vinery', ['wine', 'cider', 'noir', 'chenet', 'mellohi', 'solaris', 'aegis', 'kelp', 'clark']),
    ], 88, used_vn) + take_from('brewinandchewin', [
        ('Сыры, бочки и пенное Brewin', ['keg', 'cheese', 'flaxen', 'scarlet', 'ale', 'mead', 'vodka', 'beer', 'pizza', 'fondue']),
    ], 32, used_bc)
    total += emit_chapter(
        '40', '40 · Виноделие и Сыроварня: Vinery & Brewin', 'Напитки, сыры и ферментация',
        'Погреба Vinery и Brewin\' & Chewin\'', 'minecraft:honey_bottle',
        'Выращивание лоз, прессование сока, выдержка элитных вин и варка сыров.',
        'mod_brewing_bees', ch40_lanes, tier=2,
    )

    # =======================================================================
    # 41 · Aquaculture 2: Рыболовство и Нептуний (~102 quests)
    # =======================================================================
    used_aq = set()
    aq_lanes = take_from('aquaculture', [
        ('Удочки, крючки и лески', ['rod', 'hook', 'line', 'bobber', 'tackle', 'worm']),
        ('Пресный и морской улов', ['bass', 'carp', 'catfish', 'perch', 'pike', 'trout', 'tuna', 'grouper', 'cod', 'salmon', 'halibut']),
        ('Экзотическая рыба и трофеи', ['piranha', 'arapaima', 'shark', 'jellyfish', 'squid', 'turtle', 'leech', 'frog', 'lockbox', 'treasure']),
        ('Нептуниевый комплект', ['neptunium', 'fillet', 'sushi', 'soup', 'algae', 'driftwood']),
    ], 100, used_aq)
    total += emit_chapter(
        '41', '41 · Aquaculture 2: Рыболовство и Снасти', 'Морской промысел Long Haul',
        'Артель рыболова Aquaculture 2', 'minecraft:cod',
        'Настраиваемые удочки и крючки, десятки видов рыб в разных биомах и слитки нептуния.',
        'tutorial_cookpot', aq_lanes, tier=2,
    )

    # =======================================================================
    # 42 · Productive Bees: Промышленная пасека (~126 quests)
    # =======================================================================
    used_pb = set()
    pb_lanes = take_from('productivebees', [
        ('Ульи, рамки и приманки', ['hive', 'expansion', 'feeder', 'catcher', 'treat', 'smoker', 'honey_']),
        ('Гнёзда биомов', ['nest', 'wood', 'stone', 'sand', 'snow', 'nether', 'end', 'obsidian', 'bumble']),
        ('Центрифуги, гены и апгрейды', ['centrifuge', 'incubator', 'gene', 'upgrade', 'bottler', 'jar', 'comb_']),
        ('Продуктовые соты и ресурсы', ['wax', 'propolis', 'comb', 'pollen', 'obsidian', 'diamond', 'gold', 'iron']),
    ], 124, used_pb)
    total += emit_chapter(
        '42', '42 · Productive Bees: Промышленная пасека', 'Генетика пчёл и ресурсы',
        'Пасека Productive Bees', 'minecraft:honeycomb',
        'Приручение одиночных пчёл в гнёздах, центрифуги, апгрейды ульев и ресурсные соты.',
        'mod_brewing_bees', pb_lanes, tier=3,
    )

    # =======================================================================
    # 43..45 · Primal Magick & Thaumon (~315 quests)
    # =======================================================================
    used_pm = set()
    pm43_lanes = take_from('primalmagick', [
        ('Стихии, кристаллические соли и пыль', ['essence', 'salt', 'earth', 'sea', 'sky', 'sun', 'moon', 'blood', 'infernal', 'void', 'hallowed']),
        ('Столы анализа и теория магии', ['table', 'lectern', 'theory', 'grimoire', 'scribe', 'paper', 'ink']),
        ('Источники маны и алтари', ['font', 'shrine', 'conduit', 'capacitor', 'siphon', 'charger']),
        ('Кристаллы, цветы и базовые реликвии', ['crystal', 'hydrangea', 'tree', 'log', 'planks', 'gem']),
    ], 106, used_pm)
    total += emit_chapter(
        '43', '43 · Primal Magick: Стихии и Теория', 'Школа арканы · Часть I',
        'Академия стихий Primal Magick', 'minecraft:enchanting_table',
        'Изучение стихий, эссенций, алтарей анализа и написание магических теорий.',
        'arcane_02_primal_magick', pm43_lanes, tier=2,
    )

    pm44_lanes = take_from('primalmagick', [
        ('Жезлы, навершия и стержни', ['wand', 'staff', 'core', 'cap', 'focus']),
        ('Алхимия, тигли и эликсиры', ['alchemical', 'calcinator', 'concocter', 'dissolution', 'potion', 'bomb']),
        ('Магическая металлургия', ['primalite', 'hexium', 'hallowsteel', 'ingot', 'nugget', 'plate']),
        ('Руны, свитки и зачарования', ['rune', 'scroll', 'spell', 'tome', 'charm']),
    ], 106, used_pm)
    total += emit_chapter(
        '44', '44 · Primal Magick: Жезлы и Алхимия', 'Школа арканы · Часть II',
        'Жезлы и Сплавы Primal Magick', 'minecraft:blaze_powder',
        'Сборка жезлов, плавка праймалита и гексиума, руны и алхимические котлы.',
        'ch43_99_master', pm44_lanes, tier=3,
    )

    pm45_lanes = take_from('primalmagick', [
        ('Высшие ритуалы и обелиски', ['ritual', 'altar', 'candle', 'bell', 'incense', 'offering', 'pillar']),
        ('Броня и боевая магия', ['robe', 'armor', 'sword', 'bow', 'trident', 'shield']),
        ('Редкие артефакты и декор Thaumon', ['stone', 'brick', 'lamp', 'glass', 'banner', 'ward']),
    ], 94, used_pm)
    total += emit_chapter(
        '45', '45 · Primal Magick: Ритуалы и Тауматургия', 'Школа арканы · Часть III',
        'Высшие ритуалы и Thaumon', 'minecraft:cauldron',
        'Многоблочные ритуальные круги, артефакты хэллоустила и смежные практики Thaumon.',
        'ch44_99_master', pm45_lanes, tier=4,
    )

    # =======================================================================
    # 46 · Hex Casting: Стековая магия (~94 quests, ZERO debug/banned items!)
    # =======================================================================
    used_hex = set()
    hex_lanes = take_from('hexcasting', [
        ('Посохи и аметистовая пыль', ['staff', 'amethyst', 'dust', 'charged', 'quenched']),
        ('Фокусы, свитки и тринкеты', ['focus', 'scroll', 'trinket', 'artifact', 'cypher', 'battery', 'phial']),
        ('Круги заклинаний и шифер', ['slate', 'impetus', 'directrix', 'edified', 'akashic', 'quenched_allay']),
        ('Трактаты и инструменты писца', ['lens', 'abacus', 'book', 'lore', 'thought_knot', 'sub_budding']),
    ], 92, used_hex)
    total += emit_chapter(
        '46', '46 · Hex Casting: Стековая магия', 'Программируемая аркана Hex Casting',
        'Фолиант Hexonomicon', 'hexcasting:staff/oak',
        'Паттерны Hex Casting, программируемые фокусы и круги заклинаний (Greater Teleport отключён правилами).',
        'arcane_04_hex_casting', hex_lanes, tier=3,
    )

    # =======================================================================
    # 47..48 · Biomes O' Plenty (~220 quests)
    # =======================================================================
    used_bop = set()
    bop47_lanes = take_from('biomesoplenty', [
        ('Древесина и брёвна BoP', ['log', 'wood', 'planks']),
        ('Столярка, двери и лодки BoP', ['door', 'trapdoor', 'boat', 'sign', 'fence', 'stairs']),
        ('Породы камня, песок и грязь', ['stone', 'sand', 'mud', 'clay', 'brimstone', 'rose_quartz', 'thermal']),
        ('Саженцы и листва биомов', ['sapling', 'leaves']),
    ], 90, used_bop)
    total += emit_chapter(
        '47', '47 · Биомы мира: Biomes O\' Plenty (Породы)', 'География мира · Часть I',
        'Леса и породы Biomes O\' Plenty', 'minecraft:filled_map',
        'Редкие породы древесины, саженцы, белый и чёрный песок, розовый кварц.',
        'mod_world_biomes', bop47_lanes, tier=2,
    )

    bop48_lanes = take_from('biomesoplenty', [
        ('Цветы и полевая флора', ['flower', 'rose', 'lily', 'violet', 'lavender', 'clover', 'hydrangea', 'marigold']),
        ('Травы, камыш и водные растения', ['grass', 'reed', 'cattail', 'moss', 'vine', 'kelp', 'sprout']),
        ('Незер, грибы и аномалии BoP', ['flesh', 'blood', 'eyebulb', 'toadstool', 'mushroom', 'glowshroom', 'bramble', 'web']),
    ], 85, used_bop)
    total += emit_chapter(
        '48', '48 · Биомы мира: Biomes O\' Plenty (Флора)', 'География мира · Часть II',
        'Ботаника Biomes O\' Plenty', 'minecraft:compass',
        'Коллекция флоры 50+ биомов, экзотические грибы и незерские аномалии.',
        'ch47_99_master', bop48_lanes, tier=2,
    )

    # =======================================================================
    # 49..50 · Alex's Caves (~224 quests)
    # =======================================================================
    used_ac = set()
    ac49_lanes = take_from('alexscaves', [
        ('Магнитные пещеры', ['galena', 'neodymium', 'magnet', 'tesla', 'holocoder', 'azure', 'scarlet']),
        ('Первобытные пещеры', ['amber', 'fern', 'cycad', 'pewen', 'thornwood', 'trilocaris', 'dino', 'primordial']),
        ('Токсичные пещеры', ['radrock', 'uranium', 'acid', 'nuclear', 'hazmat', 'geothermal', 'fissile', 'tremor']),
        ('Инструменты и трофеи пещер', ['cave_book', 'tablet', 'spelunk', 'totem', 'dagger', 'spear']),
    ], 112, used_ac)
    total += emit_chapter(
        '49', '49 · Alex\'s Caves: Магнитные, Дино и Токсик', 'Подземные биомы · Часть I',
        'Экспедиция Alex\'s Caves I', 'minecraft:spyglass',
        'Магнитные поля неодима, джунгли динозавров и урановые озёра Токсичных пещер.',
        'mod_caves_bosses', ac49_lanes, tier=3,
    )

    ac50_lanes = take_from('alexscaves', [
        ('Бездонная пропасть (Abyssal)', ['abyssal', 'muck', 'submarine', 'marine', 'pearl', 'bioluminescent', 'diving', 'ortholance']),
        ('Пещеры забвения (Forlorn)', ['forlorn', 'guano', 'coprolite', 'guanostone', 'forsaken', 'desolate', 'gloom', 'occult']),
        ('Карамельные пещеры (Candy)', ['candy', 'chocolate', 'licorice', 'gingerbread', 'wafer', 'mint', 'sugar', 'gumball', 'sundae']),
        ('Реликвии и артефакты глубин', ['cloak', 'hood', 'wand', 'sack_skip', 'cannon', 'bomb', 'dreadbow', 'extinction']),
    ], 110, used_ac)
    total += emit_chapter(
        '50', '50 · Alex\'s Caves: Бездна, Забвение и Сладости', 'Подземные биомы · Часть II',
        'Экспедиция Alex\'s Caves II', 'minecraft:nautilus_shell',
        'Батискафы Бездны, мрак Забвения, карамельные шахты и древние реликвии.',
        'ch49_99_master', ac50_lanes, tier=3,
    )

    # =======================================================================
    # 51 · Фауна мира: Alex's Mobs и Rats (~126 quests)
    # =======================================================================
    used_amobs = set()
    amobs_lanes = take_from('alexsmobs', [
        ('Бестиарий и приручение', ['animal_dictionary', 'falconry', 'lasso', 'pouch', 'banner']),
        ('Трофеи суши и саванн', ['grizzly', 'kangaroo', 'gazelle', 'roadrunner', 'moose', 'bison', 'komodo', 'emu', 'elephant']),
        ('Морские и подземные существа', ['whale', 'orca', 'lobster', 'shark', 'squid', 'mantis', 'centipede', 'cockroach']),
        ('Энд, Незер и артефакты фауны', ['void_worm', 'straddler', 'bone_serpent', 'soul_vulture', 'crimson_mosquito', 'dimensional', 'tendon']),
    ], 110, used_amobs) + [
        ('Rats: Сыр, ловушки и приручение', [
            ('rats:cheese', 'Rats: Сыр для приручения', 8),
            ('rats:block_of_cheese', 'Rats: Сырный блок', 2),
            ('rats:rat_trap', 'Rats: Крысоловка', 2),
            ('rats:rat_cage', 'Rats: Клетка для крысы', 1),
            ('rats:rat_flute', 'Rats: Флейта крысолова', 1),
            ('rats:auto_curdler', 'Rats: Сыроварня (Curdling Station)', 1),
            ('rats:rat_crafting_table', 'Rats: Крысиный верстак', 1),
        ]),
        ('Rats: Улучшения крыс и Ratlantis', [
            ('rats:rat_upgrade_basic', 'Rats: Базовое улучшение крысы', 2),
            ('rats:rat_upgrade_chef', 'Rats: Улучшение «Шеф-повар»', 1),
            ('rats:rat_upgrade_speed', 'Rats: Улучшение скорости', 1),
            ('rats:piper_hat', 'Rats: Шляпа Гамельнского крысолова', 1),
            ('rats:plague_essence', 'Rats: Чумная эссенция', 4),
            ('rats:marbled_cheese', 'Rats: Мраморный сыр', 16),
            ('rats:chunky_cheese_token', 'Rats: Жетон в Ратлантиду', 1),
        ]),
    ]
    total += emit_chapter(
        '51', '51 · Фауна мира: Alex\'s Mobs', 'Исследование фауны и фермы Rats',
        'Справочник биолога Alex\'s Mobs и Rats', 'rats:cheese',
        'Уникальная фауна Alex\'s Mobs, приручение и автоматизация через крыс Rats вплоть до Ратлантиды.',
        'mod_caves_bosses', amobs_lanes, tier=2,
    )

    # =======================================================================
    # 52 · Боссы: Cataclysm и Aquamirae (~99 quests)
    # =======================================================================
    used_cat, used_aqm = set(), set()
    ch52_lanes = take_from('cataclysm', [
        ('Алтари и реликвии Cataclysm', ['ignitium', 'witherite', 'cursium', 'ancient_metal', 'monstrous', 'enderite']),
        ('Оружие и броня боссов Cataclysm', ['bulwark', 'incinerator', 'gauntlet', 'void_', 'tidal', 'laser', 'infernal', 'mecha']),
    ], 41, used_cat) + take_from('aquamirae', [
        ('Ледяные моря Aquamirae', ['abyssal', 'shell', 'fin', 'anglers', 'oxygelium', 'esca', 'spine']),
        ('Снаряжение и трофеи Капитана', ['terrible', 'three_bolt', 'dagger', 'whisper', 'remnants', 'pirate', 'rune']),
    ], 56, used_aqm)
    total += emit_chapter(
        '52', '52 · Боссы: Cataclysm и Aquamirae', 'Сверхсложные рейды и боссы',
        'Кодекс Охотника на Боссов', 'minecraft:nether_star',
        'Штурм ледяного флота Aquamirae и древних титанов L_Ender\'s Cataclysm.',
        'mod_caves_bosses', ch52_lanes, tier=4,
    )

    # =======================================================================
    # 53..54 · FramedBlocks (~148 quests)
    # =======================================================================
    used_fb = set()
    fb53_lanes = take_from('framedblocks', [
        ('Каркасы, кубы и плиты', ['cube', 'slab', 'panel', 'corner', 'pillar', 'post', 'wrench', 'hammer']),
        ('Крыши и склоны', ['slope', 'roof', 'pyramid', 'prism', 'wedge', 'gable']),
        ('Лестницы, двери и люки', ['stairs', 'door', 'trapdoor', 'gate', 'ladder', 'wall']),
    ], 76, used_fb)
    total += emit_chapter(
        '53', '53 · Архитектура: FramedBlocks (Каркасы)', 'Строительство · Часть I',
        'Мастерская FramedBlocks I', 'framedblocks:framed_cube',
        'Универсальные каркасные блоки, принимающие текстуру любого материала.',
        'mod_architecture', fb53_lanes, tier=2,
    )

    fb54_lanes = take_from('framedblocks', [
        ('Ограды, перила и балки', ['fence', 'lattice', 'bars', 'beam', 'rail']),
        ('Мелкие и технические детали', ['button', 'lever', 'pressure', 'flower', 'torch', 'chest', 'sign', 'item_frame']),
        ('Сложные сопряжения', ['double', 'half', 'vertical', 'divided', 'fancy', 'chiseled']),
    ], 68, used_fb)
    total += emit_chapter(
        '54', '54 · Архитектура: FramedBlocks (Детали)', 'Строительство · Часть II',
        'Мастерская FramedBlocks II', 'framedblocks:framed_cube',
        'Тонкие архитектурные элементы, комбинированные каркасы и декор фасадов.',
        'ch53_99_master', fb54_lanes, tier=2,
    )

    # =======================================================================
    # 55 · Архитектура: Chipped (Отделка) (~86 quests)
    # =======================================================================
    used_chp = set()
    chp_lanes = take_from('chipped', [
        ('Верстаки Chipped', ['botanist', 'carpenter', 'glassblower', 'loom', 'mason', 'tinker', 'alchemy']),
        ('Каменная и кирпичная кладка', ['stone', 'brick', 'granite', 'andesite', 'diorite', 'deepslate', 'blackstone', 'basalt']),
        ('Столярка, ящики и бочки', ['planks', 'log', 'barrel', 'crate', 'oak', 'spruce', 'birch', 'dark_oak']),
        ('Витражи, фонари и отделка', ['glass', 'pane', 'lantern', 'torch', 'wool', 'terracotta', 'concrete', 'clay']),
    ], 84, used_chp)
    total += emit_chapter(
        '55', '55 · Архитектура: Chipped (Отделка)', 'Дизайн баз и городов',
        'Каталог декора Chipped', 'minecraft:stonecutter',
        'Семь столов обработки для тысяч вариантов кирпича, витражей, фонарей и ящиков.',
        'mod_architecture', chp_lanes, tier=2,
    )

    # =======================================================================
    # 56..57 · Quark (~162 quests)
    # =======================================================================
    used_qk = set()
    qk56_lanes = take_from('quark', [
        ('Природный камень Quark', ['limestone', 'jasper', 'shale', 'myalite', 'permafrost', 'calcite', 'tuff', 'dripstone']),
        ('Кирпичи, черепица и мозаика', ['bricks', 'shingles', 'vertical', 'chiseled', 'polished', 'cobblestone', 'thatch']),
        ('Коллекционные породы дерева', ['ancient_', 'azalea_', 'blossom_', 'bamboo_']),
        ('Редстоун и механизмы Quark', ['redstone', 'piston', 'grate', 'chute', 'pipe', 'ender_watcher', 'trowel', 'abacus']),
    ], 82, used_qk) + [
        ('Lumen Rigs: Прожекторы и световой пульт', [
            ('lumen_rigs:spotlight', 'Lumen Rigs: Прожектор', 2),
            ('lumen_rigs:floodlight', 'Lumen Rigs: Заливной прожектор', 2),
            ('lumen_rigs:searchlight', 'Lumen Rigs: Поисковый прожектор', 1),
            ('lumen_rigs:soft_panel', 'Lumen Rigs: Световая панель', 2),
            ('lumen_rigs:lighting_remote', 'Lumen Rigs: Световой пульт', 1),
        ]),
    ]
    total += emit_chapter(
        '56', '56 · Механика и Декор: Quark (Блоки)', 'Ваниль+, Quark и Lumen Rigs · I',
        'Инженерные блоки Quark и Lumen Rigs', 'lumen_rigs:spotlight',
        'Новые горные породы, компактный редстоун Quark и настраиваемые прожекторы Lumen Rigs.',
        'mod_architecture', qk56_lanes, tier=2,
    )

    qk57_lanes = take_from('quark', [
        ('Освещение, свечи и бумага', ['candle', 'paper', 'blaze_lantern', 'duskbound', 'midori']),
        ('Сундуки, рамки и полки', ['chest', 'bookshelf', 'ladder', 'post', 'stool', 'hedge']),
        ('Кристаллы, руны и трофеи', ['corundum', 'rune', 'soul_bead', 'crab', 'diamond_heart', 'seed_pouch', 'bottled']),
    ], 76, used_qk) + [
        ('Hands-On Furniture: Мебель и техника', [
            ('refurbished_furniture:workbench', 'Мебельный верстак Refurbished', 1),
            ('refurbished_furniture:oak_kitchen_cabinetry', 'Hands-On: Кухонная тумба', 2),
            ('refurbished_furniture:light_fridge', 'Hands-On: Холодильник', 1),
            ('refurbished_furniture:light_stove', 'Hands-On: Плита Refurbished', 1),
            ('refurbished_furniture:light_microwave', 'Hands-On: Микроволновка', 1),
            ('refurbished_furniture:light_electricity_generator', 'Генератор мебели Refurbished', 1),
            ('refurbished_furniture:post_box', 'Почтовый ящик Refurbished', 1),
        ]),
    ]
    total += emit_chapter(
        '57', '57 · Механика и Декор: Quark (Детали и Трофеи)', 'Декор, Quark и Hands-On Furniture · II',
        'Артефакты Quark и Hands-On Furniture', 'refurbished_furniture:workbench',
        'Кристаллы, руны Quark и тактильное взаимодействие с мебелью MrCrayfish Refurbished через Hands-On Furniture.',
        'ch56_99_master', qk57_lanes, tier=2,
    )

    # =======================================================================
    # 58 · Промышленные Тиры I–IV: Масштабирование (~110 quests, GTNH/ATM style)
    # =======================================================================
    scale_lanes = [
        ('Тир I · Массовое сырьё', [
            ('minecraft:cobblestone', 'Булыжник — валовая добыча', 64),
            ('minecraft:oak_log', 'Лесозаготовка для цехов', 64),
            ('minecraft:coal', 'Топливный резерв угля', 64),
            ('minecraft:copper_ingot', 'Медь — первая партия', 64),
            ('minecraft:iron_ingot', 'Железо — первая партия', 64),
            ('minecraft:glass', 'Промышленное остекление', 64),
            ('minecraft:brick', 'Огнеупорный кирпич', 64),
            ('create:andesite_alloy', 'Андезитовый сплав — 1-й стек', 64),
            ('create:iron_sheet', 'Железная лента и лист', 64),
            ('create:copper_sheet', 'Медный лист', 64),
            ('minecraft:redstone', 'Синхронизация редстоуном', 64),
            ('minecraft:quartz', 'Кварцевые кристаллы', 64),
            ('minecraft:gold_ingot', 'Золотые шины', 32),
            ('minecraft:lapis_lazuli', 'Лазуритовый буфер', 64),
            ('create:zinc_ingot', 'Цинковый прокат', 64),
            ('create:brass_ingot', 'Латунный прокат', 64),
            ('create:brass_sheet', 'Латунный лист', 64),
            ('create:track', 'Магистральный запас рельсов', 64),
            ('create:belt_connector', 'Ленточные транспортеры', 32),
            ('minecraft:hopper', 'Партия воронок', 16),
            ('minecraft:chest', 'Складская тара', 32),
            ('minecraft:barrel', 'Бочковый парк', 32),
            ('create:shaft', 'Трансмиссионные валы', 64),
            ('create:cogwheel', 'Редукторные шестерни', 64),
            ('create:large_cogwheel', 'Силовые колёса', 32),
            ('create:fluid_pipe', 'Трубопроводная сеть', 64),
        ]),
        ('Тир II · Заводская стандартизация', [
            ('create:electron_tube', 'Электронные лампы', 32),
            ('create:precision_mechanism', 'Точные механизмы', 16),
            ('create:sturdy_sheet', 'Усиленный обсидиановый лист', 16),
            ('immersiveengineering:ingot_steel', 'Сталь IE — партия', 64),
            ('immersiveengineering:plate_steel', 'Стальные бронелисты', 32),
            ('immersiveengineering:wirecoil_copper', 'Катушки НН', 16),
            ('immersiveengineering:wirecoil_electrum', 'Катушки СН', 16),
            ('immersiveengineering:wirecoil_steel', 'Высоковольтные катушки', 16),
            ('immersiveengineering:treated_wood_horizontal', 'Пропитанная древесина IE', 64),
            ('pneumaticcraft:ingot_iron_compressed', 'Сжатое железо', 64),
            ('pneumaticcraft:plastic', 'Полимерный пластик', 64),
            ('pneumaticcraft:printed_circuit_board', 'Печатные платы PCB', 16),
            ('pneumaticcraft:pressure_tube', 'Пневмотрубы', 64),
            ('modularrouters:modular_router', 'Стойка маршрутизаторов', 8),
            ('modularrouters:augment_core', 'Ядра улучшений', 16),
            ('integrateddynamics:cable', 'Оптические шины ID', 64),
            ('integrateddynamics:crystalized_menril_chunk', 'Кристаллы менрила', 64),
            ('computercraft:computer_normal', 'Кластер компьютеров', 8),
            ('computercraft:wireless_modem_normal', 'Сеть модемов', 8),
            ('railcraft:steel_rail', 'Стальные пути Railcraft', 64),
            ('createaddition:copper_wire', 'Силовая медная проводка', 64),
            ('createaddition:gold_wire', 'Золотая проводка', 32),
            ('createaddition:capacitor', 'Конденсаторные сборки', 16),
            ('ae2:fluix_crystal', 'Флюикс-кристаллы AE2', 32),
            ('ae2:controller', 'ME Контроллеры AE2', 2),
            ('minecraft:obsidian', 'Тяжёлая защита обсидианом', 32),
            ('minecraft:diamond', 'Промышленные алмазы', 16),
            ('minecraft:emerald', 'Торговый резерв изумрудов', 32),
        ]),
        ('Тир III · Атом и Высокие Технологии', [
            ('bigreactors:yellorium_ingot', 'Йеллориумное топливо', 32),
            ('bigreactors:graphite_ingot', 'Реакторный графит', 64),
            ('bigreactors:basic_reactorcasing', 'Стенки энергоблока', 64),
            ('nuclearcraft:steel_ingot', 'Реакторная сталь NC', 32),
            ('nuclearcraft:thorium_ingot', 'Ториевый резерв', 16),
            ('nuclearcraft:lithium_ingot', 'Литиевые сборки', 16),
            ('nuclearcraft:boron_ingot', 'Боровые поглотители', 16),
            ('nuclearcraft:basic_plating', 'Радиационная обшивка', 32),
            ('draconicevolution:draconium_dust', 'Дракониевая пыль', 64),
            ('draconicevolution:draconium_ingot', 'Дракониевый слиток', 32),
            ('draconicevolution:draconium_core', 'Дракониевые ядра', 8),
            ('draconicevolution:wyvern_core', 'Ядра Виверны', 4),
            ('draconicevolution:awakened_draconium_ingot', 'Пробуждённый дракониум', 8),
            ('draconicevolution:awakened_core', 'Пробуждённые ядра', 2),
            ('minecraft:netherite_scrap', 'Незеритовый лом', 16),
            ('minecraft:netherite_ingot', 'Незеритовый слиток', 8),
            ('minecraft:nether_star', 'Звёзды Незера', 4),
            ('minecraft:beacon', 'Маяки цехов', 2),
            ('minecraft:ender_pearl', 'Жемчуг Энда', 32),
            ('minecraft:blaze_rod', 'Огненные стержни', 32),
            ('minecraft:ghast_tear', 'Реагенты гаста', 8),
            ('minecraft:amethyst_shard', 'Аметист для арканы', 64),
            ('hexcasting:amethyst_dust', 'Пыль Hex Casting', 64),
            ('hexcasting:charged_amethyst', 'Заряженный аметист', 16),
            ('minecraft:honeycomb', 'Пасечный воск и соты', 64),
            ('minecraft:totem_of_undying', 'Страховочный тотем', 2),
        ]),
        ('Тир IV · Консорциум Long Haul', [
            ('longhaul:treated_timber', 'Экспорт: Пропитанная древесина', 16),
            ('longhaul:field_rations', 'Экспорт: Экспедиционные рационы', 16),
            ('longhaul:ore_concentrate', 'Экспорт: Рудный концентрат', 16),
            ('longhaul:marine_reagent', 'Экспорт: Морской реагент', 16),
            ('longhaul:refractory_mix', 'Экспорт: Огнеупорная смесь', 16),
            ('longhaul:technical_oil', 'Экспорт: Техническое масло', 16),
            ('longhaul:technical_glass', 'Экспорт: Техническое стекло', 16),
            ('longhaul:machine_parts', 'Экспорт: Прецизионные узлы', 16),
            ('longhaul:cargo_manifest', 'Документооборот накладных', 4),
            ('longhaul:control_tablet', 'Планшеты диспетчера', 2),
            ('longhaul:continental_module', 'Континентальные модули', 2),
            ('minecraft:diamond_block', 'Капитал в алмазных блоках', 8),
            ('minecraft:emerald_block', 'Капитал в изумрудных блоках', 16),
            ('minecraft:gold_block', 'Золотой запас казны', 16),
            ('minecraft:iron_block', 'Стальной фонд консорциума', 32),
            ('minecraft:copper_block', 'Медный фонд консорциума', 32),
            ('minecraft:redstone_block', 'Энергетический запас', 32),
            ('minecraft:lapis_block', 'Запас лазурита', 16),
            ('minecraft:netherite_block', 'Сверхтяжёлый резерв', 1),
            ('minecraft:enchanted_golden_apple', 'Имперский запас выживания', 2),
            ('draconicevolution:chaotic_core', 'Хаотическое ядро синтеза', 1),
            ('draconicevolution:chaos_shard', 'Осколок Хаоса', 2),
            ('minecraft:dragon_breath', 'Реактив Энда', 16),
            ('minecraft:heart_of_the_sea', 'Морской эталон', 2),
            ('minecraft:conduit', 'Подводный узел', 2),
            ('minecraft:sponge', 'Осушитель портов', 16),
        ]),
    ]
    # Verify every item in scale_lanes exists in ALL_VERIFIED_SET
    for lname, items in scale_lanes:
        items[:] = [(it, lb, amt) for (it, lb, amt) in items if it in ALL_VERIFIED_SET]
    total += emit_chapter(
        '58', '58 · Промышленные Тиры I–IV: Масштабирование', 'Массовое производство',
        'Индустриальные объёмы Тир I–IV', 'create:precision_mechanism',
        'По образцу крупных сборок: от стековых буферов руды до реакторных сплавов и продукции 8 центров.',
        'contract_mechanisms', scale_lanes, tier=3,
    )

    # =======================================================================
    # 59 · Логистика Консорциума: Массовые поставки (~104 quests)
    # =======================================================================
    site_supply_lanes = [
        ('Снабжение Лесной артели и Порта', [
            ('minecraft:oak_log', 'Лесовоз для Лесной артели', 64),
            ('minecraft:spruce_log', 'Еловые шпалы', 64),
            ('create:mechanical_saw', 'Партия лесопилок', 4),
            ('immersiveengineering:treated_wood_horizontal', 'Пропитанная обвязка причала', 32),
            ('smallships:oak_cog', 'Торговый когг порта', 1),
            ('minecraft:oak_boat', 'Лодки-разведчики', 4),
            ('minecraft:kelp', 'Сырьё морского реагента', 64),
            ('minecraft:dried_kelp_block', 'Топливо для сушилок', 16),
            ('minecraft:prismarine_shard', 'Призмариновый заказ', 16),
            ('minecraft:cod', 'Свежий улов для порта', 32),
            ('minecraft:salmon', 'Красная рыба порта', 32),
            ('longhaul:treated_timber', 'Партия пропитанной древесины', 8),
            ('longhaul:marine_reagent', 'Партия морского реагента', 8),
        ]),
        ('Снабжение Агрогорода и Пасек', [
            ('minecraft:wheat', 'Зерновой элеватор', 64),
            ('minecraft:bread', 'Хлебная отгрузка', 64),
            ('minecraft:potato', 'Клубневый резерв', 64),
            ('minecraft:baked_potato', 'Горячие пайки смен', 64),
            ('minecraft:carrot', 'Корнеплоды для кухни', 64),
            ('farmersdelight:tomato', 'Томаты для соусов', 32),
            ('farmersdelight:cabbage', 'Капуста агрогорода', 32),
            ('farmersdelight:onion', 'Лук для рагу', 32),
            ('farmersdelight:beef_stew', 'Обеды строителей', 8),
            ('minecraft:honey_bottle', 'Медовые поставки', 16),
            ('minecraft:honeycomb', 'Восковые партии', 32),
            ('minecraft:milk_bucket', 'Молочная ферма', 4),
            ('longhaul:field_rations', 'Партия полевых рационов', 8),
        ]),
        ('Снабжение Рудника и Карьера', [
            ('minecraft:raw_iron', 'Рудная шихта железа', 64),
            ('minecraft:raw_copper', 'Рудная шихта меди', 64),
            ('minecraft:raw_gold', 'Золотоносный концентрат', 32),
            ('create:crushing_wheel', 'Дробильный узел карьера', 2),
            ('create:mechanical_drill', 'Проходческие буры', 8),
            ('minecraft:tnt', 'Взрывные работы карьера', 16),
            ('minecraft:clay_ball', 'Огнеупорная глина', 64),
            ('minecraft:sand', 'Кварцевый песок', 64),
            ('minecraft:gravel', 'Отсев гравия', 64),
            ('minecraft:basalt', 'Базальтовый щебень', 64),
            ('minecraft:blackstone', 'Чернитная подсыпка', 64),
            ('longhaul:ore_concentrate', 'Партия рудного концентрата', 8),
            ('longhaul:refractory_mix', 'Партия огнеупорной смеси', 8),
        ]),
        ('Снабжение Химпосёлка, Долины и Машцентра', [
            ('minecraft:coal', 'Сырьё углехимии', 64),
            ('minecraft:slime_ball', 'Связующие полимеры', 16),
            ('minecraft:blaze_powder', 'Катализатор синтеза', 16),
            ('minecraft:glowstone_dust', 'Оптические добавки', 32),
            ('minecraft:glass', 'Листовое стекло долины', 64),
            ('minecraft:tinted_glass', 'Затемнённое техстекло', 16),
            ('create:brass_casing', 'Корпуса приборов машцентра', 16),
            ('create:precision_mechanism', 'Узлы точной механики', 8),
            ('immersiveengineering:component_steel', 'Стальные компоненты', 16),
            ('pneumaticcraft:lubricant_bucket', 'Пневмосмазка цехов', 1),
            ('longhaul:technical_oil', 'Партия технического масла', 8),
            ('longhaul:technical_glass', 'Партия технического стекла', 8),
            ('longhaul:machine_parts', 'Партия прецизионных узлов', 8),
        ]),
        ('Транспортная инфраструктура сети', [
            ('create:track', 'Полотно магистрали', 64),
            ('create:track_station', 'Станции погрузки', 4),
            ('create:track_signal', 'Семафоры перегонов', 8),
            ('create:schedule', 'Маршрутные листы', 4),
            ('create:portable_storage_interface', 'Интерфейсы перегрузки', 4),
            ('create:chute', 'Гравитационные жёлобы', 16),
            ('create:brass_funnel', 'Умные латунные воронки', 8),
            ('create:item_vault', 'Депо-хранилища', 12),
            ('computercraft:computer_normal', 'Терминалы учёта', 4),
            ('computercraft:monitor_normal', 'Табло диспетчера', 8),
            ('minecraft:compass', 'Навигация конвоев', 4),
            ('minecraft:lantern', 'Сигнальные фонари путей', 32),
            ('longhaul:cargo_manifest', 'Комплект накладных', 4),
        ]),
        ('Архив и Континентальный резерв', [
            ('minecraft:book', 'Тома архива магистралей', 16),
            ('minecraft:writable_book', 'Полевые отчёты узлов', 4),
            ('minecraft:map', 'Топографические карты', 8),
            ('minecraft:spyglass', 'Оптика геодезиста', 2),
            ('minecraft:name_tag', 'Маркировка составов', 8),
            ('minecraft:emerald', 'Бюджет консорциума', 32),
            ('minecraft:diamond', 'Алмазные подшипники', 16),
            ('minecraft:netherite_ingot', 'Незеритовые втулки', 2),
            ('minecraft:ender_pearl', 'Телеметрические маяки', 16),
            ('minecraft:beacon', 'Континентальный маяк', 1),
            ('longhaul:control_tablet', 'Планшеты руководства', 2),
            ('longhaul:continental_module', 'Финальный континентальный модуль', 1),
            ('minecraft:nether_star', 'Знак почёта Консорциума', 1),
        ]),
    ]
    for lname, items in site_supply_lanes:
        items[:] = [(it, lb, amt) for (it, lb, amt) in items if it in ALL_VERIFIED_SET]
    total += emit_chapter(
        '59', '59 · Логистика Консорциума: Массовые поставки', 'Региональное снабжение',
        'Центральный план снабжения', 'longhaul:cargo_manifest',
        'Укомплектуйте складские резервы всех 8 экономических центров и межрегиональных железных дорог.',
        'prod_machine', site_supply_lanes, tier=3,
    )

    # =======================================================================
    # 60 · Опасности и Среда: Выживание в кризисах (~95 quests)
    # =======================================================================
    hazard_lanes = [
        ('Защита от Токсичного Газа и Высот', [
            ('minecraft:scaffolding', 'Быстрый подъём на высоту Y>120', 32),
            ('minecraft:ladder', 'Аварийные лестницы башен', 32),
            ('minecraft:campfire', 'Тепло и ориентир на горной базе', 4),
            ('minecraft:lantern', 'Освещение высокогорных лагерей', 16),
            ('minecraft:milk_bucket', 'Очищение от негативных эффектов', 2),
            ('minecraft:honey_bottle', 'Снятие отравления', 8),
            ('minecraft:golden_apple', 'Экстренная регенерация', 4),
            ('minecraft:golden_carrot', 'Высококалорийный паёк', 16),
            ('minecraft:spyglass', 'Разведка небесных островов', 1),
            ('minecraft:elytra', 'Перелёт между sky_refuges', 1),
            ('minecraft:phantom_membrane', 'Ремонт элитр в полёте', 8),
            ('comforts:sleeping_bag_red', 'Мобильный ночлег на хребте', 1),
            ('minecraft:feather', 'Смягчение падений и стрелы', 16),
        ]),
        ('Протокол Voidout и Колесо Угроз', [
            ('minecraft:totem_of_undying', 'Защита от детонации Voidout', 2),
            ('minecraft:enchanted_golden_apple', 'Абсолютный щит выживания', 1),
            ('minecraft:shield', 'Блок тяжёлых атак мобов', 2),
            ('minecraft:diamond_helmet', 'Усиленный шлем', 1),
            ('minecraft:diamond_chestplate', 'Усиленный нагрудник', 1),
            ('minecraft:diamond_leggings', 'Усиленные поножи', 1),
            ('minecraft:diamond_boots', 'Усиленные ботинки', 1),
            ('minecraft:netherite_ingot', 'Укрепление брони до незерита', 4),
            ('minecraft:obsidian', 'Взрывоустойчивый бункер', 32),
            ('minecraft:crying_obsidian', 'Якорный камень укрытия', 8),
            ('minecraft:respawn_anchor', 'Точка возрождения в Незере', 1),
            ('minecraft:recovery_compass', 'Поиск трупа Corpse после гибели', 1),
            ('minecraft:ender_pearl', 'Аварийное уклонение в бою', 16),
        ]),
        ('Экология: Дым и Радиация', [
            ('minecraft:cauldron', 'Отстойник загрязнений', 2),
            ('minecraft:bucket', 'Забор технических жидкостей', 4),
            ('minecraft:water_bucket', 'Водяной барьер и тушение', 4),
            ('minecraft:sponge', 'Очистка акваторий', 4),
            ('minecraft:bricks', 'Дымоходные трубы заводов', 64),
            ('minecraft:stone_bricks', 'Вентиляционные шахты', 64),
            ('minecraft:iron_bars', 'Защитные решётки', 32),
            ('minecraft:tinted_glass', 'Смотровые экраны реактора', 16),
            ('nuclearcraft:geiger_counter', 'Контроль дозы радиации', 1),
            ('nuclearcraft:rad_shielding_light', 'Лёгкий свинцовый экран', 4),
            ('nuclearcraft:rad_shielding_medium', 'Средний экран защиты', 4),
            ('nuclearcraft:rad_shielding_heavy', 'Тяжёлая радиационная защита', 2),
            ('minecraft:lightning_rod', 'Грозозащита складов', 4),
        ]),
        ('Полевой медпункт DOOMED', [
            ('minecraft:glistering_melon_slice', 'Ингредиент зелий исцеления', 8),
            ('minecraft:blaze_powder', 'Топливо полевой зельеварки', 16),
            ('minecraft:nether_wart', 'Основа всех эликсиров', 16),
            ('minecraft:ghast_tear', 'Реагент регенерации', 4),
            ('minecraft:magma_cream', 'Огнестойкость в Незере', 8),
            ('minecraft:sugar', 'Стимулятор скорости отхода', 16),
            ('minecraft:brewing_stand', 'Станция полевых зелий', 2),
            ('farmersdelight:beef_stew', 'Горячее питание в рейде', 8),
            ('farmersdelight:chicken_soup', 'Восстанавливающий бульон', 8),
            ('longhaul:field_rations', 'Армейский паёк DOOMED', 8),
            ('minecraft:crossbow', 'Оборона периметра', 2),
            ('minecraft:spectral_arrow', 'Подсветка угроз в темноте', 16),
            ('minecraft:bell', 'Сигнал тревоги на базе', 1),
        ]),
    ]
    for lname, items in hazard_lanes:
        items[:] = [(it, lb, amt) for (it, lb, amt) in items if it in ALL_VERIFIED_SET]
    total += emit_chapter(
        '60', '60 · Опасности и Среда: Выживание в кризисах', 'Токсичный газ, Voidout и DOOMED',
        'Штаб гражданской обороны', 'minecraft:totem_of_undying',
        'Комплексная подготовка к сезонному токсичному газу, радиации, Voidout и Колесу Угроз.',
        'alpha_territory_casino', hazard_lanes, tier=3,
    )

    # =======================================================================
    # 61 · Великий Синтез Long Haul: Абсолютное мастерство (~115 quests)
    # =======================================================================
    grand_lanes = [
        ('Синтез Индустрии', [
            ('create:precision_mechanism', 'Вершина механики Create', 16),
            ('create:track_station', 'Диспетчерская сеть поездов', 4),
            ('createaddition:electric_motor', 'Гибридный привод Create+FE', 4),
            ('immersiveengineering:dynamo', 'Промышленная генерация IE', 4),
            ('immersiveengineering:ingot_steel', 'Стальной каркас империи', 64),
            ('pneumaticcraft:printed_circuit_board', 'Электроника высокого давления', 16),
            ('pneumaticcraft:drone', 'Рой логистических дронов', 2),
            ('modularrouters:modular_router', 'Узлы мгновенного роутинга', 8),
            ('integrateddynamics:variable', 'Программная шина данных', 32),
            ('computercraft:computer_advanced', 'Суперкомпьютер диспетчера', 2),
            ('railcraft:steel_rail', 'Тяжёлые рельсы Railcraft', 64),
            ('littlelogistics:tug', 'Речная флотилия', 2),
            ('immersive_aircraft:airship', 'Транспортный дирижабль', 1),
            ('ironfurnaces:netherite_furnace', 'Незеритовая плавка', 1),
            ('functionalstorage:storage_controller', 'Единый контроллер склада', 1),
            ('ae2:item_storage_cell_64k', 'Цифровой массив AE2 64k', 2),
            ('ae2:pattern_provider', 'Автокрафт ME AE2', 4),
            ('lumen_rigs:searchlight', 'Поисковые прожекторы баз', 2),
        ]),
        ('Синтез Атома и Звёзд', [
            ('bigreactors:basic_reactorcontroller', 'Реактор Extreme Reactors', 1),
            ('bigreactors:blutonium_ingot', 'Плутониевый цикл', 8),
            ('nuclearcraft:fission_reactor_controller', 'Контроллер NuclearCraft', 1),
            ('nuclearcraft:fusion_core', 'Термоядерное ядро NC', 1),
            ('electrodynamics:wireceramic', 'Высоковольтные шины', 16),
            ('draconicevolution:draconium_core', 'Энергия дракониума', 8),
            ('draconicevolution:wyvern_core', 'Синтез Виверны', 4),
            ('draconicevolution:crafting_core', 'Ядро крафта слияния', 1),
            ('draconicevolution:awakened_core', 'Пробуждённое ядро', 2),
            ('draconicevolution:chaotic_core', 'Ядро Хаоса', 1),
            ('draconicevolution:chaos_shard', 'Трофей Дракона Хаоса', 1),
            ('minecraft:nether_star', 'Звёзды Незера', 8),
            ('minecraft:beacon', 'Сеть маяков', 4),
            ('minecraft:netherite_block', 'Монумент из незерита', 1),
            ('minecraft:enchanted_golden_apple', 'Имперская реликвия', 2),
        ]),
        ('Синтез Арканы, Природы и Боссов', [
            ('hexcasting:staff/oak', 'Посох мастера Hex Casting', 1),
            ('hexcasting:charged_amethyst', 'Резервуар аметиста', 16),
            ('hexcasting:focus', 'Стек заклинаний', 4),
            ('primalmagick:grimoire', 'Гримуар стихий', 1),
            ('primalmagick:hallowsteel_ingot', 'Слитки священной стали', 8),
            ('minecraft:honeycomb', 'Продукция всех ульев', 64),
            ('rats:chunky_cheese_token', 'Сырный триумф Rats (Ratlantis)', 1),
            ('farmersdelight:beef_stew', 'Пиршество консорциума', 16),
            ('aquaculture:neptunium_ingot', 'Нептуниевый слиток морей', 4),
            ('cataclysm:ignitium_ingot', 'Игнизиум титана Игниса', 4),
            ('cataclysm:witherite_ingot', 'Витерит Предвестника', 4),
            ('cataclysm:cursium_ingot', 'Курсиум Маледиктуса', 4),
            ('aquamirae:abyssal_amethyst', 'Аметист Бездны', 4),
            ('minecraft:heart_of_the_sea', 'Сердце океана', 2),
            ('minecraft:dragon_breath', 'Алхимия Дракона Энда', 8),
            ('minecraft:totem_of_undying', 'Бессмертие пионера', 4),
        ]),
        ('Финал Консорциума Long Haul', [
            ('longhaul:treated_timber', 'Сертификат: Лесная артель', 16),
            ('longhaul:field_rations', 'Сертификат: Агрогород', 16),
            ('longhaul:ore_concentrate', 'Сертификат: Горный рудник', 16),
            ('longhaul:marine_reagent', 'Сертификат: Морской порт', 16),
            ('longhaul:refractory_mix', 'Сертификат: Карьер пустошей', 16),
            ('longhaul:technical_oil', 'Сертификат: Химпосёлок', 16),
            ('longhaul:technical_glass', 'Сертификат: Стекольная долина', 16),
            ('longhaul:machine_parts', 'Сертификат: Машцентр', 16),
            ('longhaul:cargo_manifest', 'Реестр поставок Консорциума', 8),
            ('longhaul:control_tablet', 'Планшет Администратора', 1),
            ('longhaul:continental_module', 'Континентальный модуль — Триумф', 4),
            ('minecraft:diamond_block', 'Алмазная стела триумфа', 16),
            ('minecraft:emerald_block', 'Изумрудная стела триумфа', 16),
            ('minecraft:gold_block', 'Золотая стела триумфа', 16),
            ('minecraft:bread', 'Та самая буханка хлеба из пролога', 1),
        ]),
    ]
    for lname, items in grand_lanes:
        items[:] = [(it, lb, amt) for (it, lb, amt) in items if it in ALL_VERIFIED_SET]
    total += emit_chapter(
        '61', '61 · Великий Синтез: Абсолютное мастерство', 'Финал Long Haul Legacy 2.0',
        'Великий Синтез Консорциума', 'longhaul:continental_module',
        'Финальная вершина сборки: от первой буханки хлеба до слияния индустрии, атома, магии, боссов и 8 центров.',
        'site_continental_hub', grand_lanes, tier=4,
    )

    return total
