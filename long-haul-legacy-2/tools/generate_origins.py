"""Generate all 34 custom themed Long Haul Origins (27 standard + 7 weaker tier)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_NS = ROOT / 'overrides' / 'kubejs' / 'data' / 'longhaul_origins'
ORIGINS_DIR = DATA_NS / 'origins'
POWERS_DIR = DATA_NS / 'powers'
LAYER_PATH = ROOT / 'overrides' / 'kubejs' / 'data' / 'origins' / 'origin_layers' / 'origin.json'
LANG_RU = ROOT / 'overrides' / 'kubejs' / 'assets' / 'longhaul_origins' / 'lang' / 'ru_ru.json'
LANG_EN = ROOT / 'overrides' / 'kubejs' / 'assets' / 'longhaul_origins' / 'lang' / 'en_us.json'


def attr_mod(name: str, attribute: str, value: float, operation: str = 'addition') -> dict:
    return {'name': name, 'attribute': attribute, 'value': value, 'operation': operation}


def p_attr(name_ru: str, desc_ru: str, modifiers: list) -> dict:
    return {'name': name_ru, 'description': desc_ru, 'type': 'origins:attribute', 'modifiers': modifiers}


def p_mult(name_ru: str, desc_ru: str, subpowers: dict) -> dict:
    out = {'name': name_ru, 'description': desc_ru, 'type': 'origins:multiple'}
    out.update(subpowers)
    return out


# 34 unique origins: (id, ru_name, en_name, ru_desc, en_desc, icon, impact, powers_list)
# First 27 = Standard tier; Last 7 = Intentionally weaker tier
ORIGINS_SPEC = [
    # --- STANDARD TIER (27) ---
    ('office_clerk', 'Офисный клерк', 'Office Clerk',
     'Сбежавший из душного опенспейса: +опыт, +удача и +15% к выплатам контрактов и OpenTTD, но хрупкое тело.',
     'Burned-out office escapee: +XP, +luck, and +15% contract/OpenTTD payouts, at the cost of fragile health.',
     'minecraft:writable_book', 1, [
         ('clerk_paperwork', 'Бумажная хватка', 'Paperwork Mastery',
          '+15% опыта, +1.0 удачи и +15% бонуса к выплатам контрактов консорциума и OpenTTD (KubeJS).',
          '+15% XP gain, +1.0 luck, and +15% contract/OpenTTD payout bonus (KubeJS).',
          p_mult('Бумажная хватка', '+15% опыта, +1.0 удачи и +15% бонуса к выплатам контрактов консорциума и OpenTTD (KubeJS).', {
              'xp': {'type': 'origins:modify_xp_gain', 'modifier': {'name': 'Clerk XP', 'operation': 'multiply_base', 'value': 0.15}},
              'luck': {'type': 'origins:attribute', 'modifier': attr_mod('Clerk Luck', 'minecraft:generic.luck', 1.0)},
          })),
         ('clerk_sedentary', 'Офисная атрофия', 'Sedentary Frame',
          '-1.5 сердца максимального здоровья и -1.0 урона в ближнем бою.',
          '-1.5 hearts max health and -1.0 melee attack damage.',
          p_attr('Офисная атрофия', '-1.5 сердца максимального здоровья и -1.0 урона в ближнем бою.', [
              attr_mod('Clerk HP', 'minecraft:generic.max_health', -3.0),
              attr_mod('Clerk Melee', 'minecraft:generic.attack_damage', -1.0),
          ])),
     ]),

    ('biker', 'Байкер', 'Biker',
     'Свобода шоссе: выше скорость, стойкость к отбрасыванию и +25% дохода с дорожных маршрутов OpenTTD.',
     'Highway outlaw: faster stride, knockback resistance, and +25% road route payouts in OpenTTD.',
     'minecraft:leather_helmet', 2, [
         ('biker_highway', 'Король шоссе', 'Highway King',
          '+12% скорости передвижения, +25% сопротивления отбрасыванию и +25% к выплатам дорожных маршрутов OpenTTD (KubeJS).',
          '+12% movement speed, +25% knockback resistance, and +25% OpenTTD road route bonus (KubeJS).',
          p_attr('Король шоссе', '+12% скорости передвижения, +25% сопротивления отбрасыванию и +25% к выплатам дорожных маршрутов OpenTTD (KubeJS).', [
              attr_mod('Biker Speed', 'minecraft:generic.movement_speed', 0.12, 'multiply_base'),
              attr_mod('Biker Knockback', 'minecraft:generic.knockback_resistance', 0.25),
          ])),
         ('biker_reckless', 'Безбашенная езда', 'Reckless Ride',
          'Расход голода выше на 15%, а входящий урон от снарядов выше на 15%.',
          '+15% hunger exhaustion and +15% incoming projectile damage.',
          p_mult('Безбашенная езда', 'Расход голода выше на 15%, а входящий урон от снарядов выше на 15%.', {
              'exh': {'type': 'origins:modify_exhaustion', 'modifier': {'name': 'Biker Exhaustion', 'operation': 'multiply_base', 'value': 0.15}},
              'proj': {'type': 'origins:modify_damage_taken', 'damage_condition': {'type': 'origins:in_tag', 'tag': 'minecraft:is_projectile'},
                       'modifier': {'name': 'Biker Proj', 'operation': 'multiply_base', 'value': 0.15}},
          })),
     ]),

    ('factory_worker', 'Заводчанин', 'Factory Worker',
     'Ударник цеха: быстрее копает киркой, не знает усталости, меньше теряет руды и получает Спешку у станков Create.',
     'Veteran machinist: faster pickaxe mining, fatigue immunity, reduced ore scarcity loss, and Create haste aura.',
     'create:wrench', 2, [
         ('worker_shift', 'Цеховая закалка', 'Shop-Floor Grit',
          '+25% скорости копания киркой, иммунитет к Усталости; потеря от «Рудного голода» ниже на 35% + Спешка у блоков Create (KubeJS).',
          '+25% pickaxe speed, Mining Fatigue immunity, -35% ore scarcity loss, and Haste near Create blocks (KubeJS).',
          p_mult('Цеховая закалка', '+25% скорости копания киркой, иммунитет к Усталости; потеря от «Рудного голода» ниже на 35% + Спешка у блоков Create (KubeJS).', {
              'mine': {'type': 'origins:modify_break_speed',
                       'block_condition': {'type': 'origins:in_tag', 'tag': 'minecraft:mineable/pickaxe'},
                       'modifier': {'name': 'Worker Pickaxe', 'operation': 'multiply_base', 'value': 0.25}},
              'imm': {'type': 'origins:effect_immunity', 'effects': ['minecraft:mining_fatigue']},
          })),
         ('worker_wear', 'Усталые ноги', 'Heavy Shift Legs',
          '-8% скорости передвижения и -1.0 единицы удачи.',
          '-8% movement speed and -1.0 luck.',
          p_attr('Усталые ноги', '-8% скорости передвижения и -1.0 единицы удачи.', [
              attr_mod('Worker Speed', 'minecraft:generic.movement_speed', -0.08, 'multiply_base'),
              attr_mod('Worker Luck', 'minecraft:generic.luck', -1.0),
          ])),
     ]),

    ('airline_pilot', 'Пилот самолёта', 'Airline Pilot',
     'Крылья вместо потолка: встроенное планирование, защита от падения и +30% на авиамаршрутах OpenTTD.',
     'Sky veteran: built-in gliding, reduced fall damage, and +30% OpenTTD air route payouts.',
     'minecraft:elytra', 3, [
         ('pilot_wings', 'Полёт без границ', 'Skybound Glide',
          'Встроенное планирование без элитр, -35% урона от падения и +30% к авиамаршрутам OpenTTD / полётам Immersive Aircraft (KubeJS).',
          'Built-in gliding without elytra, -35% fall damage, and +30% OpenTTD air route bonus (KubeJS).',
          p_mult('Полёт без границ', 'Встроенное планирование без элитр, -35% урона от падения и +30% к авиамаршрутам OpenTTD / полётам Immersive Aircraft (KubeJS).', {
              'glide': {'type': 'origins:elytra_flight', 'render_elytra': False},
              'fall': {'type': 'origins:modify_damage_taken', 'damage_condition': {'type': 'origins:in_tag', 'tag': 'minecraft:is_fall'},
                       'modifier': {'name': 'Pilot Fall', 'operation': 'multiply_base', 'value': -0.35}},
          })),
         ('pilot_fragile', 'Тонкая обшивка', 'Lightweight Frame',
          '-2 сердца максимального здоровья и +20% урона от огня.',
          '-2 hearts max health and +20% fire damage taken.',
          p_mult('Тонкая обшивка', '-2 сердца максимального здоровья и +20% урона от огня.', {
              'hp': {'type': 'origins:attribute', 'modifier': attr_mod('Pilot HP', 'minecraft:generic.max_health', -4.0)},
              'fire': {'type': 'origins:modify_damage_taken', 'damage_condition': {'type': 'origins:in_tag', 'tag': 'minecraft:is_fire'},
                       'modifier': {'name': 'Pilot Fire', 'operation': 'multiply_base', 'value': 0.2}},
          })),
     ]),

    ('family_father', 'Отец многодетной семьи', 'Father of Many',
     'Умеет тащить всё на себе: больше здоровья, брони и +6 слотов порога перегруза ценой аппетита.',
     'Built to carry everyone: extra HP, armor, and +6 encumbrance capacity at the cost of higher hunger drain.',
     'minecraft:chest', 2, [
         ('father_backbone', 'Тягловая выносливость', 'Family Backbone',
          '+1 сердце здоровья, +2 природной брони и +6 слотов к лимиту перегруза инвентаря (KubeJS).',
          '+1 heart health, +2 armor, and +6 inventory encumbrance threshold slots (KubeJS).',
          p_attr('Тягловая выносливость', '+1 сердце здоровья, +2 природной брони и +6 слотов к лимиту перегруза инвентаря (KubeJS).', [
              attr_mod('Father HP', 'minecraft:generic.max_health', 2.0),
              attr_mod('Father Armor', 'minecraft:generic.armor', 2.0),
          ])),
         ('father_exhaust', 'Вечная нехватка сил', 'Endless Expenses',
          'Расход сытости выше на 25%, а скорость атаки ниже на 8%.',
          '+25% hunger exhaustion and -8% attack speed.',
          p_mult('Вечная нехватка сил', 'Расход сытости выше на 25%, а скорость атаки ниже на 8%.', {
              'exh': {'type': 'origins:modify_exhaustion', 'modifier': {'name': 'Father Exhaustion', 'operation': 'multiply_base', 'value': 0.25}},
              'atk': {'type': 'origins:attribute', 'modifier': attr_mod('Father AtkSpd', 'minecraft:generic.attack_speed', -0.08, 'multiply_base')},
          })),
     ]),

    ('widower', 'Вдовец', 'Widower',
     'Человек, переживший пустоту: видит в темноте, не боится Иссушения/Тьмы и ходит бесшумно, но раны заживают медленно.',
     'Hardened by loss: night vision, Darkness/Wither immunity, silent footsteps, but slower healing and lower max HP.',
     'minecraft:wither_rose', 2, [
         ('widower_numb', 'Холодная тишина', 'Cold Silence',
          'Ночное зрение, иммунитет к Тьме и Иссушению, а также бесшумные шаги.',
          'Night vision, immunity to Darkness and Wither, and silent footsteps.',
          p_mult('Холодная тишина', 'Ночное зрение, иммунитет к Тьме и Иссушению, а также бесшумные шаги.', {
              'nv': {'type': 'origins:night_vision', 'strength': 0.8},
              'imm': {'type': 'origins:effect_immunity', 'effects': ['minecraft:darkness', 'minecraft:wither']},
              'step': {'type': 'origins:prevent_game_event', 'events': ['minecraft:step']},
          })),
         ('widower_grief', 'Надлом', 'Hollow Grief',
          '-2 сердца максимального здоровья и -15% эффективности лечения.',
          '-2 hearts max health and -15% healing received.',
          p_mult('Надлом', '-2 сердца максимального здоровья и -15% эффективности лечения.', {
              'hp': {'type': 'origins:attribute', 'modifier': attr_mod('Widower HP', 'minecraft:generic.max_health', -4.0)},
              'heal': {'type': 'origins:modify_healing', 'modifier': {'name': 'Widower Heal', 'operation': 'multiply_base', 'value': -0.15}},
          })),
     ]),

    ('alcoholic', 'Алкоголик', 'Alcoholic',
     'Иммунитет к тошноте и бонусы от вин/напитков Vinery & Brewin\', но дрожащие руки и высокий расход голода.',
     'Immune to Nausea and empowered by Vinery/Brewin\' drinks, but shaky hands and higher hunger drain.',
     'minecraft:glass_bottle', 2, [
         ('alcoholic_tolerance', 'Лужёная глотка', 'Iron Liver',
          'Полный иммунитет к Тошноте, +20% сопротивления отбрасыванию; напитки Vinery/Brewin\' дают Силу и Сопротивление (KubeJS).',
          'Nausea immunity, +20% knockback resistance; Vinery/Brewin\' drinks grant Strength & Resistance (KubeJS).',
          p_mult('Лужёная глотка', 'Полный иммунитет к Тошноте, +20% сопротивления отбрасыванию; напитки Vinery/Brewin\' дают Силу и Сопротивление (KubeJS).', {
              'imm': {'type': 'origins:effect_immunity', 'effects': ['minecraft:nausea']},
              'kb': {'type': 'origins:attribute', 'modifier': attr_mod('Alcoholic KB', 'minecraft:generic.knockback_resistance', 0.2)},
          })),
         ('alcoholic_tremor', 'Похмельный тремор', 'Hangover Tremor',
          'Скорость атаки ниже на 12%, а расход голода выше на 20%.',
          '-12% attack speed and +20% hunger exhaustion.',
          p_mult('Похмельный тремор', 'Скорость атаки ниже на 12%, а расход голода выше на 20%.', {
              'atk': {'type': 'origins:attribute', 'modifier': attr_mod('Alcoholic AtkSpd', 'minecraft:generic.attack_speed', -0.12, 'multiply_base')},
              'exh': {'type': 'origins:modify_exhaustion', 'modifier': {'name': 'Alcoholic Exhaustion', 'operation': 'multiply_base', 'value': 0.2}},
          })),
     ]),

    ('addict', 'Наркоман', 'Addict',
     'Взрывная скорость и реакция (особенно от стимуляторов и сигарет DOOMED), но сильно подорванное здоровье.',
     'Explosive reflexes boosted by stimulants and DOOMED cigarettes, at the cost of fragile health and rapid exhaustion.',
     'minecraft:sugar', 3, [
         ('addict_rush', 'Адреналиновый всплеск', 'Adrenaline Rush',
          '+15% скорости передвижения и +15% скорости атаки; сигареты DOOMED, сахар, кофе и зелья дают кратковременный рывок Speed II + Absorption (KubeJS).',
          '+15% movement and attack speed; DOOMED cigarettes, sugar, coffee, and potions trigger Speed II + Absorption bursts (KubeJS).',
          p_attr('Адреналиновый всплеск', '+15% скорости передвижения и +15% скорости атаки; сигареты DOOMED, сахар, кофе и зелья дают кратковременный рывок Speed II + Absorption (KubeJS).', [
              attr_mod('Addict Speed', 'minecraft:generic.movement_speed', 0.15, 'multiply_base'),
              attr_mod('Addict AtkSpd', 'minecraft:generic.attack_speed', 0.15, 'multiply_base'),
          ])),
         ('addict_crash', 'Износ организма', 'Physical Crash',
          '-3 сердца максимального здоровья и +25% расхода голода.',
          '-3 hearts max health and +25% hunger exhaustion.',
          p_mult('Износ организма', '-3 сердца максимального здоровья и +25% расхода голода.', {
              'hp': {'type': 'origins:attribute', 'modifier': attr_mod('Addict HP', 'minecraft:generic.max_health', -6.0)},
              'exh': {'type': 'origins:modify_exhaustion', 'modifier': {'name': 'Addict Exhaustion', 'operation': 'multiply_base', 'value': 0.25}},
          })),
     ]),

    ('skinhead', 'Скинхед', 'Skinhead',
     'Агрессивный уличный боец: тяжёлый кулак и стойкость в драке, но плохая удача и дорогие сделки.',
     'Street brawler: hard melee hits and knockback resilience, offset by poor luck and 20% trade markup.',
     'minecraft:iron_boots', 2, [
         ('skinhead_brawl', 'Уличный кулак', 'Street Brawler',
          '+2.0 урона в ближнем бою, +10% скорости атаки и +25% сопротивления отбрасыванию.',
          '+2.0 melee attack damage, +10% attack speed, and +25% knockback resistance.',
          p_attr('Уличный кулак', '+2.0 урона в ближнем бою, +10% скорости атаки и +25% сопротивления отбрасыванию.', [
              attr_mod('Skinhead Dmg', 'minecraft:generic.attack_damage', 2.0),
              attr_mod('Skinhead AtkSpd', 'minecraft:generic.attack_speed', 0.1, 'multiply_base'),
              attr_mod('Skinhead KB', 'minecraft:generic.knockback_resistance', 0.25),
          ])),
         ('skinhead_trouble', 'Дурная слава', 'Bad Reputation',
          '-1.5 удачи, +20% урона от снарядов и наценка +20% при торговле/регистрации OpenTTD (KubeJS).',
          '-1.5 luck, +20% incoming projectile damage, and +20% OpenTTD/trader fee markup (KubeJS).',
          p_mult('Дурная слава', '-1.5 удачи, +20% урона от снарядов и наценка +20% при торговле/регистрации OpenTTD (KubeJS).', {
              'luck': {'type': 'origins:attribute', 'modifier': attr_mod('Skinhead Luck', 'minecraft:generic.luck', -1.5)},
              'proj': {'type': 'origins:modify_damage_taken', 'damage_condition': {'type': 'origins:in_tag', 'tag': 'minecraft:is_projectile'},
                       'modifier': {'name': 'Skinhead Proj', 'operation': 'multiply_base', 'value': 0.2}},
          })),
     ]),

    ('hermit', 'Отшельник', 'Hermit',
     'Живёт вдали от людей: ночное зрение, экономия сытости и регенерация в одиночестве, но теряется в толпе.',
     'Thrives far from civilization: night vision, reduced hunger, and solitude regeneration, weakened near crowds.',
     'minecraft:lantern', 2, [
         ('hermit_solitude', 'Сила уединения', 'Solitude Vigor',
          'Ночное зрение, -20% расхода голода; вдали от других игроков (>48 м) получает регенерацию и защиту от холода (KubeJS).',
          'Night vision, -20% hunger drain; regenerates and resists frost when >48m from other players (KubeJS).',
          p_mult('Сила уединения', 'Ночное зрение, -20% расхода голода; вдали от других игроков (>48 м) получает регенерацию и защиту от холода (KubeJS).', {
              'nv': {'type': 'origins:night_vision', 'strength': 0.85},
              'exh': {'type': 'origins:modify_exhaustion', 'modifier': {'name': 'Hermit Exhaustion', 'operation': 'multiply_base', 'value': -0.2}},
          })),
         ('hermit_crowd', 'Боязнь толпы', 'Crowd Anxiety',
          '-1 сердце максимального здоровья и Слабость при нахождении вплотную к другим игрокам (<16 м, KubeJS).',
          '-1 heart max health and Weakness when crowded within 16m of other players (KubeJS).',
          p_attr('Боязнь толпы', '-1 сердце максимального здоровья и Слабость при нахождении вплотную к другим игрокам (<16 м, KubeJS).', [
              attr_mod('Hermit HP', 'minecraft:generic.max_health', -2.0),
          ])),
     ]),

    ('vagabond', 'Бродяга', 'Vagabond',
     'Вечный странник с рюкзаком: быстрый шаг, минимум голода и быстрая разведка новых секторов.',
     'Perpetual drifter: faster travel, minimal hunger drain, and accelerated sector pathfinding.',
     'minecraft:campfire', 1, [
         ('vagabond_road', 'Дорожная закалка', 'Road Endurance',
          '+12% скорости передвижения, -25% расхода голода, +25% к прогрессу аспекта «Первооткрыватель» и защита от холода у костра (KubeJS).',
          '+12% speed, -25% hunger drain, +25% pathfinder aspect gain, and campfire frost immunity (KubeJS).',
          p_mult('Дорожная закалка', '+12% скорости передвижения, -25% расхода голода, +25% к прогрессу аспекта «Первооткрыватель» и защита от холода у костра (KubeJS).', {
              'spd': {'type': 'origins:attribute', 'modifier': attr_mod('Vagabond Speed', 'minecraft:generic.movement_speed', 0.12, 'multiply_base')},
              'exh': {'type': 'origins:modify_exhaustion', 'modifier': {'name': 'Vagabond Exhaustion', 'operation': 'multiply_base', 'value': -0.25}},
          })),
         ('vagabond_unarmored', 'Без крыши и брони', 'Exposed Sleeper',
          '-1.5 сердца максимального здоровья и -1 природной брони.',
          '-1.5 hearts max health and -1 natural armor.',
          p_attr('Без крыши и брони', '-1.5 сердца максимального здоровья и -1 природной брони.', [
              attr_mod('Vagabond HP', 'minecraft:generic.max_health', -3.0),
              attr_mod('Vagabond Armor', 'minecraft:generic.armor', -1.0),
          ])),
     ]),

    ('henpecked', 'Каблук', 'Henpecked',
     'Привык терпеть всё молча: крепкая броня и быстрое лечение, но мягкий удар и нерешительность.',
     'Built to endure nagging: extra armor and boosted healing, at the expense of melee damage and speed.',
     'minecraft:lead', 2, [
         ('henpecked_patience', 'Железное терпение', 'Stoic Endurance',
          '+2.5 природной брони, +15% эффективности лечения и бонус поддержки при передаче ресурсов союзникам (KubeJS).',
          '+2.5 natural armor, +15% healing received, and support buffs when assisting nearby allies (KubeJS).',
          p_mult('Железное терпение', '+2.5 природной брони, +15% эффективности лечения и бонус поддержки при передаче ресурсов союзникам (KubeJS).', {
              'arm': {'type': 'origins:attribute', 'modifier': attr_mod('Henpecked Armor', 'minecraft:generic.armor', 2.5)},
              'heal': {'type': 'origins:modify_healing', 'modifier': {'name': 'Henpecked Heal', 'operation': 'multiply_base', 'value': 0.15}},
          })),
         ('henpecked_timid', 'Подавленная воля', 'Subdued Strike',
          '-1.5 урона в ближнем бою и -10% скорости передвижения.',
          '-1.5 melee attack damage and -10% movement speed.',
          p_attr('Подавленная воля', '-1.5 урона в ближнем бою и -10% скорости передвижения.', [
              attr_mod('Henpecked Dmg', 'minecraft:generic.attack_damage', -1.5),
              attr_mod('Henpecked Spd', 'minecraft:generic.movement_speed', -0.1, 'multiply_base'),
          ])),
     ]),

    ('illegal_immigrant', 'Нелегальный иммигрант', 'Illegal Immigrant',
     'Работает быстро и незаметно: тихие шаги, проворство, низкая заметность (Pehkui), но мало здоровья и удачи.',
     'Fast, silent, and off the grid: silent steps, faster mining/movement, reduced visibility (Pehkui), fragile HP.',
     'minecraft:leather_boots', 2, [
         ('illegal_stealth', 'Вне радаров', 'Off the Grid',
          'Бесшумные шаги, +15% скорости передвижения, +20% скорости копания и сниженная дистанция обнаружения мобами (Pehkui, KubeJS).',
          'Silent steps, +15% speed, +20% mining speed, and reduced mob detection range (Pehkui, KubeJS).',
          p_mult('Вне радаров', 'Бесшумные шаги, +15% скорости передвижения, +20% скорости копания и сниженная дистанция обнаружения мобами (Pehkui, KubeJS).', {
              'step': {'type': 'origins:prevent_game_event', 'events': ['minecraft:step']},
              'spd': {'type': 'origins:attribute', 'modifier': attr_mod('Illegal Speed', 'minecraft:generic.movement_speed', 0.15, 'multiply_base')},
              'mine': {'type': 'origins:modify_break_speed', 'modifier': {'name': 'Illegal Mine', 'operation': 'multiply_base', 'value': 0.2}},
          })),
         ('illegal_precarious', 'Без документов', 'Undocumented Risk',
          '-2 сердца максимального здоровья и -1.0 удачи.',
          '-2 hearts max health and -1.0 luck.',
          p_attr('Без документов', '-2 сердца максимального здоровья и -1.0 удачи.', [
              attr_mod('Illegal HP', 'minecraft:generic.max_health', -4.0),
              attr_mod('Illegal Luck', 'minecraft:generic.luck', -1.0),
          ])),
     ]),

    ('political_emigre', 'Политический эмигрант', 'Political Emigre',
     'Уехал с головой, но без тыла: +25% опыта, +1.5 удачи и +15% к наградам контрактов, но слаб в ближнем бою.',
     'Left with wits and connections: +25% XP, +1.5 luck, and +15% contract bonuses, weaker in melee.',
     'minecraft:compass', 2, [
         ('emigre_connections', 'Диссидентские связи', 'Exile Network',
          '+25% опыта, +1.5 удачи и +15% к денежным наградам контрактов/грантов OpenTTD (KubeJS).',
          '+25% XP gain, +1.5 luck, and +15% contract & OpenTTD grant payouts (KubeJS).',
          p_mult('Диссидентские связи', '+25% опыта, +1.5 удачи и +15% к денежным наградам контрактов/грантов OpenTTD (KubeJS).', {
              'xp': {'type': 'origins:modify_xp_gain', 'modifier': {'name': 'Emigre XP', 'operation': 'multiply_base', 'value': 0.25}},
              'luck': {'type': 'origins:attribute', 'modifier': attr_mod('Emigre Luck', 'minecraft:generic.luck', 1.5)},
          })),
         ('emigre_vulnerable', 'Без тыла', 'No Safety Net',
          '-2 сердца максимального здоровья и -1.0 урона в ближнем бою.',
          '-2 hearts max health and -1.0 melee damage.',
          p_attr('Без тыла', '-2 сердца максимального здоровья и -1.0 урона в ближнем бою.', [
              attr_mod('Emigre HP', 'minecraft:generic.max_health', -4.0),
              attr_mod('Emigre Dmg', 'minecraft:generic.attack_damage', -1.0),
          ])),
     ]),

    ('ex_convict', 'Бывший зэк', 'Ex-Convict',
     'Вышел по УДО в большой мир: крепкое здоровье, броня, иммунитет к яду и тяжёлый удар, но дорогие компании.',
     'Prison-hardened survivor: extra HP, armor, poison immunity, and melee punch, but higher OpenTTD fees.',
     'minecraft:iron_bars', 2, [
         ('convict_grit', 'Лагерная закалка', 'Cellblock Toughness',
          '+2 сердца здоровья, +2 природной брони, +1.5 урона в ближнем бою и иммунитет к Яду.',
          '+2 hearts health, +2 natural armor, +1.5 melee damage, and Poison immunity.',
          p_mult('Лагерная закалка', '+2 сердца здоровья, +2 природной брони, +1.5 урона в ближнем бою и иммунитет к Яду.', {
              'attr': {'type': 'origins:attribute', 'modifiers': [
                  attr_mod('Convict HP', 'minecraft:generic.max_health', 4.0),
                  attr_mod('Convict Armor', 'minecraft:generic.armor', 2.0),
                  attr_mod('Convict Dmg', 'minecraft:generic.attack_damage', 1.5),
              ]},
              'imm': {'type': 'origins:effect_immunity', 'effects': ['minecraft:poison']},
          })),
         ('convict_record', 'Судимость в базе', 'Criminal Record',
          '-1.0 удачи и +25% к стоимости регистрации компании / операций OpenTTD (KubeJS).',
          '-1.0 luck and +25% OpenTTD company registration & trade fees (KubeJS).',
          p_attr('Судимость в базе', '-1.0 удачи и +25% к стоимости регистрации компании / операций OpenTTD (KubeJS).', [
              attr_mod('Convict Luck', 'minecraft:generic.luck', -1.0),
          ])),
     ]),

    ('heavyweight', 'Жирдяй', 'Heavyweight',
     'Солидная масса (ширина 1.28x через Pehkui): +4 сердца, +3 брони и не сдвинуть с места, но медленный и прожорливый.',
     'Massive frame (1.28x Pehkui width): +4 hearts, +3 armor, and 50% knockback resistance, slow and hungry.',
     'minecraft:cooked_porkchop', 2, [
         ('heavy_bulk', 'Массивная туша', 'Massive Bulk',
          '+4 сердца здоровья, +3 природной брони, +50% сопротивления отбрасыванию и увеличенная ширина тела 1.28x (Pehkui, KubeJS).',
          '+4 hearts health, +3 armor, +50% knockback resistance, and 1.28x body width (Pehkui, KubeJS).',
          p_attr('Массивная туша', '+4 сердца здоровья, +3 природной брони, +50% сопротивления отбрасыванию и увеличенная ширина тела 1.28x (Pehkui, KubeJS).', [
              attr_mod('Heavy HP', 'minecraft:generic.max_health', 8.0),
              attr_mod('Heavy Armor', 'minecraft:generic.armor', 3.0),
              attr_mod('Heavy KB', 'minecraft:generic.knockback_resistance', 0.5),
          ])),
         ('heavy_breath', 'Тяжёлая одышка', 'Short of Breath',
          '-16% скорости передвижения и +30% расхода голода.',
          '-16% movement speed and +30% hunger exhaustion.',
          p_mult('Тяжёлая одышка', '-16% скорости передвижения и +30% расхода голода.', {
              'spd': {'type': 'origins:attribute', 'modifier': attr_mod('Heavy Speed', 'minecraft:generic.movement_speed', -0.16, 'multiply_base')},
              'exh': {'type': 'origins:modify_exhaustion', 'modifier': {'name': 'Heavy Exhaustion', 'operation': 'multiply_base', 'value': 0.3}},
          })),
     ]),

    ('programmer', 'Программист', 'Programmer',
     'Привык к монитору по ночам: видит в темноте, +25% опыта и +30% к наградам CC:Tweaked, но слаб днём на солнце.',
     'Night-owl coder: night vision, +25% XP, and +30% CC:Tweaked challenge payouts, weakened in direct sunlight.',
     'computercraft:computer_advanced', 2, [
         ('programmer_code', 'Ночной деплой', 'Night Shift Coding',
          '+25% опыта, ночное зрение и +30% к наградам за проверки CC:Tweaked (/lh cc verify) и логистику AE2 (KubeJS).',
          '+25% XP, night vision, and +30% CC:Tweaked verification & AE2 logistics bonuses (KubeJS).',
          p_mult('Ночной деплой', '+25% опыта, ночное зрение и +30% к наградам за проверки CC:Tweaked (/lh cc verify) и логистику AE2 (KubeJS).', {
              'xp': {'type': 'origins:modify_xp_gain', 'modifier': {'name': 'Dev XP', 'operation': 'multiply_base', 'value': 0.25}},
              'nv': {'type': 'origins:night_vision', 'strength': 0.85},
          })),
         ('programmer_sun', 'Аллергия на солнце', 'Sunlight Glare',
          '-1.5 сердца максимального здоровья; под открытым солнцем скорость атаки падает на 15%.',
          '-1.5 hearts max health and -15% attack speed in direct daytime sunlight.',
          p_mult('Аллергия на солнце', '-1.5 сердца максимального здоровья; под открытым солнцем скорость атаки падает на 15%.', {
              'hp': {'type': 'origins:attribute', 'modifier': attr_mod('Dev HP', 'minecraft:generic.max_health', -3.0)},
              'sun_atk': {'type': 'origins:conditioned_attribute', 'tick_rate': 20,
                          'modifier': attr_mod('Dev Sun Atk', 'minecraft:generic.attack_speed', -0.15, 'multiply_base'),
                          'condition': {'type': 'origins:and', 'conditions': [
                              {'type': 'origins:exposed_to_sky'}, {'type': 'origins:daytime'}
                          ]}},
          })),
     ]),

    ('sailor', 'Моряк', 'Sailor',
     'Солёный волк: молниеносно плавает, +30% дохода на водных маршрутах OpenTTD и судах Small Ships.',
     'Saltwater veteran: rapid swim speed and +30% OpenTTD water route & Small Ships bonuses.',
     'minecraft:oak_boat', 2, [
         ('sailor_sea', 'Властелин волн', 'Sea Legs',
          '+50% скорости плавания и +30% бонуса к водным маршрутам OpenTTD / навигации на судах (KubeJS).',
          '+50% swim speed and +30% OpenTTD water route & vessel navigation bonus (KubeJS).',
          p_attr('Властелин волн', '+50% скорости плавания и +30% бонуса к водным маршрутам OpenTTD / навигации на судах (KubeJS).', [
              attr_mod('Sailor Swim', 'forge:swim_speed', 0.5, 'multiply_base'),
          ])),
         ('sailor_land', 'Земля качается', 'Landlubber Sway',
          'На суше скорость передвижения ниже на 8%, а входящий урон от огня выше на 15%.',
          '-8% land movement speed and +15% incoming fire damage.',
          p_mult('Земля качается', 'На суше скорость передвижения ниже на 8%, а входящий урон от огня выше на 15%.', {
              'spd': {'type': 'origins:attribute', 'modifier': attr_mod('Sailor Land', 'minecraft:generic.movement_speed', -0.08, 'multiply_base')},
              'fire': {'type': 'origins:modify_damage_taken', 'damage_condition': {'type': 'origins:in_tag', 'tag': 'minecraft:is_fire'},
                       'modifier': {'name': 'Sailor Fire', 'operation': 'multiply_base', 'value': 0.15}},
          })),
     ]),

    ('lighthouse_keeper', 'Смотритель маяка', 'Lighthouse Keeper',
     'Сторож скал и штормов: ночное зрение, дальность блока 1.15x (Pehkui), иммунитет к кислотным дождям и молниям.',
     'Beacon watcher: night vision, 1.15x block reach (Pehkui), and immunity to toxic rain corrosion & storm lightning.',
     'minecraft:sea_lantern', 2, [
         ('keeper_beacon', 'Страж шторма', 'Storm Sentinel',
          'Ночное зрение, дальность блока 1.15x (Pehkui) и иммунитет к кислотной коррозии дождя и разрядам грозы (KubeJS).',
          'Night vision, 1.15x block reach (Pehkui), and immunity to toxic rain corrosion & storm lightning (KubeJS).',
          p_mult('Страж шторма', 'Ночное зрение, дальность блока 1.15x (Pehkui) и иммунитет к кислотной коррозии дождя и разрядам грозы (KubeJS).', {
              'nv': {'type': 'origins:night_vision', 'strength': 0.9},
          })),
         ('keeper_stairs', 'Скрип винтовой лестницы', 'Tower Knees',
          '-10% скорости передвижения и -1 сердце максимального здоровья.',
          '-10% movement speed and -1 heart max health.',
          p_attr('Скрип винтовой лестницы', '-10% скорости передвижения и -1 сердце максимального здоровья.', [
              attr_mod('Keeper Speed', 'minecraft:generic.movement_speed', -0.1, 'multiply_base'),
              attr_mod('Keeper HP', 'minecraft:generic.max_health', -2.0),
          ])),
     ]),

    ('gamekeeper', 'Егерь', 'Gamekeeper',
     'Лесной охотник: +20% урона снарядами, быстрее движется в лесу/тайге и не боится лесных чащ.',
     'Forest warden: +20% projectile damage, forest/taiga stride boost, and wilderness agility.',
     'minecraft:bow', 2, [
         ('gamekeeper_hunt', 'Верный выстрел', 'Forest Marksman',
          '+20% урона от луков и снарядов и ускорение в лесных/таёжных биомах (KubeJS).',
          '+20% projectile damage and movement boost in forest/taiga biomes (KubeJS).',
          p_mult('Верный выстрел', '+20% урона от луков и снарядов и ускорение в лесных/таёжных биомах (KubeJS).', {
              'proj': {'type': 'origins:modify_projectile_damage', 'modifier': {'name': 'Gamekeeper Bow', 'operation': 'multiply_base', 'value': 0.2}},
          })),
         ('gamekeeper_woods', 'Не привык к шахтам', 'Surface Dweller',
          '-1 сердце здоровья и скорость копания ниже на 15%.',
          '-1 heart max health and -15% block break speed.',
          p_mult('Не привык к шахтам', '-1 сердце здоровья и скорость копания ниже на 15%.', {
              'hp': {'type': 'origins:attribute', 'modifier': attr_mod('Gamekeeper HP', 'minecraft:generic.max_health', -2.0)},
              'mine': {'type': 'origins:modify_break_speed', 'modifier': {'name': 'Gamekeeper Mine', 'operation': 'multiply_base', 'value': -0.15}},
          })),
     ]),

    ('disabled_veteran', 'Инвалид', 'Disabled Person',
     'Тело подводит, но голова и руки цепки: -25% скорости, -2 сердца и слабый прыжок, зато +20% опыта, +2 брони и дальний хват (Pehkui).',
     'Limited mobility (-25% speed, -2 hearts, lower jump), compensated by +20% XP, +2 armor, and 1.25x reach (Pehkui).',
     'minecraft:shield', 3, [
         ('disabled_adapt', 'Адаптация и опыт', 'Adaptive Reach',
          '+20% опыта, +2 природной брони и увеличенная дальность взаимодействия с блоками 1.25x (Pehkui, KubeJS).',
          '+20% XP gain, +2 natural armor, and 1.25x block reach via Pehkui (KubeJS).',
          p_mult('Адаптация и опыт', '+20% опыта, +2 природной брони и увеличенная дальность взаимодействия с блоками 1.25x (Pehkui, KubeJS).', {
              'xp': {'type': 'origins:modify_xp_gain', 'modifier': {'name': 'Disabled XP', 'operation': 'multiply_base', 'value': 0.2}},
              'arm': {'type': 'origins:attribute', 'modifier': attr_mod('Disabled Armor', 'minecraft:generic.armor', 2.0)},
          })),
         ('disabled_mobility', 'Ограниченная подвижность', 'Impaired Mobility',
          '-25% скорости передвижения, -2 сердца максимального здоровья и -15% высоты прыжка.',
          '-25% movement speed, -2 hearts max health, and -15% jump height.',
          p_mult('Ограниченная подвижность', '-25% скорости передвижения, -2 сердца максимального здоровья и -15% высоты прыжка.', {
              'attr': {'type': 'origins:attribute', 'modifiers': [
                  attr_mod('Disabled Speed', 'minecraft:generic.movement_speed', -0.25, 'multiply_base'),
                  attr_mod('Disabled HP', 'minecraft:generic.max_health', -4.0),
              ]},
              'jump': {'type': 'origins:modify_jump', 'modifier': {'name': 'Disabled Jump', 'operation': 'multiply_base', 'value': -0.15}},
          })),
     ]),

    ('war_veteran', 'Ветеран', 'War Veteran',
     'Прошёл огонь и воду: +3 сердца, +2 брони, -25% урона от взрывов и пуль, но медленно лечится и боится гроз.',
     'Battle-scarred survivor: +3 hearts, +2 armor, explosion/projectile resistance, but slower healing & storm flashbacks.',
     'minecraft:iron_sword', 3, [
         ('veteran_combat', 'Фронтовая броня', 'Combat Hardened',
          '+3 сердца здоровья, +2 брони, +1.5 урона в ближнем бою и -25% урона от взрывов и снарядов.',
          '+3 hearts health, +2 armor, +1.5 melee damage, and -25% explosion & projectile damage taken.',
          p_mult('Фронтовая броня', '+3 сердца здоровья, +2 брони, +1.5 урона в ближнем бою и -25% урона от взрывов и снарядов.', {
              'attr': {'type': 'origins:attribute', 'modifiers': [
                  attr_mod('Veteran HP', 'minecraft:generic.max_health', 6.0),
                  attr_mod('Veteran Armor', 'minecraft:generic.armor', 2.0),
                  attr_mod('Veteran Dmg', 'minecraft:generic.attack_damage', 1.5),
              ]},
              'res': {'type': 'origins:modify_damage_taken',
                      'damage_condition': {'type': 'origins:or', 'conditions': [
                          {'type': 'origins:in_tag', 'tag': 'minecraft:is_explosion'},
                          {'type': 'origins:in_tag', 'tag': 'minecraft:is_projectile'},
                      ]},
                      'modifier': {'name': 'Veteran Res', 'operation': 'multiply_base', 'value': -0.25}},
          })),
         ('veteran_ptsd', 'Флешбэки и шрамы', 'Lingering Scars',
          'Эффективность лечения ниже на 25%; во время грозы возможны короткие приступы Тьмы (KubeJS).',
          '-25% healing received and brief Darkness flashbacks during thunderstorms (KubeJS).',
          p_mult('Флешбэки и шрамы', 'Эффективность лечения ниже на 25%; во время грозы возможны короткие приступы Тьмы (KubeJS).', {
              'heal': {'type': 'origins:modify_healing', 'modifier': {'name': 'Veteran Heal', 'operation': 'multiply_base', 'value': -0.25}},
          })),
     ]),

    ('bandit', 'Бандит', 'Bandit',
     'Специалист по налётам и оружию (TaCZ/арбалеты): быстрее бегает, +15% стрелкового урона и +25% добычи с рейдов OpenTTD.',
     'Raider & gunfighter: faster sprint, +15% ranged/TaCZ damage, and +25% OpenTTD raid loot.',
     'minecraft:crossbow', 2, [
         ('bandit_raid', 'Вооружённый налёт', 'Armed Raid',
          '+10% скорости передвижения, +15% урона из луков/арбалетов/TaCZ и +25% добычи при рейдах OpenTTD (KubeJS).',
          '+10% movement speed, +15% projectile/TaCZ damage, and +25% OpenTTD raid payouts (KubeJS).',
          p_mult('Вооружённый налёт', '+10% скорости передвижения, +15% урона из луков/арбалетов/TaCZ и +25% добычи при рейдах OpenTTD (KubeJS).', {
              'spd': {'type': 'origins:attribute', 'modifier': attr_mod('Bandit Speed', 'minecraft:generic.movement_speed', 0.1, 'multiply_base')},
              'proj': {'type': 'origins:modify_projectile_damage', 'modifier': {'name': 'Bandit Ranged', 'operation': 'multiply_base', 'value': 0.15}},
          })),
         ('bandit_risk', 'Вне закона', 'Outlaw Risk',
          '-1.5 сердца здоровья и +20% урона от падения и огня.',
          '-1.5 hearts health and +20% fall & fire damage taken.',
          p_mult('Вне закона', '-1.5 сердца здоровья и +20% урона от падения и огня.', {
              'hp': {'type': 'origins:attribute', 'modifier': attr_mod('Bandit HP', 'minecraft:generic.max_health', -3.0)},
              'vuln': {'type': 'origins:modify_damage_taken',
                       'damage_condition': {'type': 'origins:or', 'conditions': [
                           {'type': 'origins:in_tag', 'tag': 'minecraft:is_fall'},
                           {'type': 'origins:in_tag', 'tag': 'minecraft:is_fire'},
                       ]},
                       'modifier': {'name': 'Bandit Vuln', 'operation': 'multiply_base', 'value': 0.2}},
          })),
     ]),

    ('turbo_patriot', 'Турбо-Патриот', 'Turbo-Patriot',
     'В бою становится только злее при низком HP (+урон и +броня), но ссорится с торговцами и быстро тратит силы.',
     'Fierce under half health (+damage & +armor), but faces +25% exhaustion and +25% trader/bot fee penalties.',
     'minecraft:red_banner', 2, [
         ('patriot_zeal', 'Несгибаемый напор', 'Unyielding Zeal',
          '+25% сопротивления отбрасыванию; при здоровье ниже 50% получает +2.5 урона в ближнем бою и +3 брони.',
          '+25% knockback resistance; below 50% health gains +2.5 melee damage and +3 armor.',
          p_mult('Несгибаемый напор', '+25% сопротивления отбрасыванию; при здоровье ниже 50% получает +2.5 урона в ближнем бою и +3 брони.', {
              'kb': {'type': 'origins:attribute', 'modifier': attr_mod('Patriot KB', 'minecraft:generic.knockback_resistance', 0.25)},
              'rage_dmg': {'type': 'origins:conditioned_attribute', 'tick_rate': 20,
                           'modifier': attr_mod('Patriot Rage Dmg', 'minecraft:generic.attack_damage', 2.5),
                           'condition': {'type': 'origins:relative_health', 'comparison': '<=', 'compare_to': 0.5}},
              'rage_arm': {'type': 'origins:conditioned_attribute', 'tick_rate': 20,
                           'modifier': attr_mod('Patriot Rage Arm', 'minecraft:generic.armor', 3.0),
                           'condition': {'type': 'origins:relative_health', 'comparison': '<=', 'compare_to': 0.5}},
          })),
         ('patriot_isol', 'Осаждённая крепость', 'Siege Mentality',
          '+25% расхода голода и +25% наценка при торговле с ботами / странствующим торговцем (KubeJS).',
          '+25% hunger exhaustion and +25% bot/trader price markup (KubeJS).',
          p_mult('Осаждённая крепость', '+25% расхода голода и +25% наценка при торговле с ботами / странствующим торговцем (KubeJS).', {
              'exh': {'type': 'origins:modify_exhaustion', 'modifier': {'name': 'Patriot Exhaustion', 'operation': 'multiply_base', 'value': 0.25}},
          })),
     ]),

    ('musician', 'Музыкант', 'Musician',
     'Душа дороги: +15% опыта, +1.0 удачи и лечащая/ускоряющая аура для союзников при игре на инструментах MIMI.',
     'Traveling bard: +15% XP, +1.0 luck, and ally Regen/Speed aura when holding or playing MIMI instruments.',
     'minecraft:note_block', 2, [
         ('musician_melody', 'Живая мелодия', 'Inspirational Chord',
          '+15% опыта, +1.0 удачи; удержание инструментов MIMI или нотных блоков даёт союзникам рядом Регенерацию и Скорость (KubeJS).',
          '+15% XP, +1.0 luck; MIMI instruments or note blocks buff nearby allies with Regeneration & Speed (KubeJS).',
          p_mult('Живая мелодия', '+15% опыта, +1.0 удачи; удержание инструментов MIMI или нотных блоков даёт союзникам рядом Регенерацию и Скорость (KubeJS).', {
              'xp': {'type': 'origins:modify_xp_gain', 'modifier': {'name': 'Musician XP', 'operation': 'multiply_base', 'value': 0.15}},
              'luck': {'type': 'origins:attribute', 'modifier': attr_mod('Musician Luck', 'minecraft:generic.luck', 1.0)},
          })),
         ('musician_hands', 'Тонкие пальцы', 'Delicate Hands',
          '-1.5 урона в ближнем бою и -1.5 сердца максимального здоровья.',
          '-1.5 melee attack damage and -1.5 hearts max health.',
          p_attr('Тонкие пальцы', '-1.5 урона в ближнем бою и -1.5 сердца максимального здоровья.', [
              attr_mod('Musician Dmg', 'minecraft:generic.attack_damage', -1.5),
              attr_mod('Musician HP', 'minecraft:generic.max_health', -3.0),
          ])),
     ]),

    ('cook', 'Повар', 'Cook',
     'Полевая кухня на колёсах: пища сытнее, иммунитет к Яду, еда не портится от спор, а блюда Farmer\'s Delight лечат.',
     'Field chef: boosted food saturation, Poison immunity, spore spoilage protection, and healing Farmer\'s Delight meals.',
     'farmersdelight:cooking_pot', 1, [
         ('cook_kitchen', 'Золотой половник', 'Master Chef',
          'Еда даёт +2 сытости и +30% насыщения, иммунитет к Яду; сырая пища не гниёт, а блюда Farmer\'s Delight лечат +2 HP (KubeJS).',
          '+2 food and +30% saturation from meals, Poison immunity, no spore spoilage, and +2 HP healing on Farmer\'s Delight food (KubeJS).',
          p_mult('Золотой половник', 'Еда даёт +2 сытости и +30% насыщения, иммунитет к Яду; сырая пища не гниёт, а блюда Farmer\'s Delight лечат +2 HP (KubeJS).', {
              'food': {'type': 'origins:modify_food',
                       'food_modifier': {'name': 'Cook Food', 'operation': 'addition', 'value': 2.0},
                       'saturation_modifier': {'name': 'Cook Sat', 'operation': 'multiply_base', 'value': 0.3}},
              'imm': {'type': 'origins:effect_immunity', 'effects': ['minecraft:poison']},
          })),
         ('cook_peaceful', 'Мирный нрав', 'Kitchen Temperament',
          '-1.0 урона в ближнем бою и -10% скорости атаки.',
          '-1.0 melee attack damage and -10% attack speed.',
          p_attr('Мирный нрав', '-1.0 урона в ближнем бою и -10% скорости атаки.', [
              attr_mod('Cook Dmg', 'minecraft:generic.attack_damage', -1.0),
              attr_mod('Cook AtkSpd', 'minecraft:generic.attack_speed', -0.1, 'multiply_base'),
          ])),
     ]),

    ('artist', 'Художник', 'Artist',
     'Видит форму на расстоянии: +1.5 удачи, дальность строительства 1.25x (Pehkui) и двойной прогресс урбаниста.',
     'Visionary builder: +1.5 luck, 1.25x building reach (Pehkui), and 2x urbanist aspect progression.',
     'minecraft:painting', 1, [
         ('artist_vision', 'Широкий мазок', 'Architect\'s Brush',
          '+1.5 удачи, дальность установки блоков 1.25x (Pehkui) и ускоренный прогресс аспекта «Урбанист» при постройках (KubeJS).',
          '+1.5 luck, 1.25x block reach (Pehkui), and 2x Urbanist aspect credit on decorative blocks (KubeJS).',
          p_attr('Широкий мазок', '+1.5 удачи, дальность установки блоков 1.25x (Pehkui) и ускоренный прогресс аспекта «Урбанист» при постройках (KubeJS).', [
              attr_mod('Artist Luck', 'minecraft:generic.luck', 1.5),
          ])),
         ('artist_fragile', 'Тонкая натура', 'Delicate Constitution',
          '-2 сердца максимального здоровья и -1.0 урона в ближнем бою.',
          '-2 hearts max health and -1.0 melee attack damage.',
          p_attr('Тонкая натура', '-2 сердца максимального здоровья и -1.0 урона в ближнем бою.', [
              attr_mod('Artist HP', 'minecraft:generic.max_health', -4.0),
              attr_mod('Artist Dmg', 'minecraft:generic.attack_damage', -1.0),
          ])),
     ]),

    # --- WEAKER CHALLENGE TIER (7) ---
    ('hikikomori_nerd', 'Хиккан-задрот', 'Hikikomori Nerd',
     '[Ослабленное] Хрупкий домосед (-3 сердца, -1.5 урона, -20% скорости атаки, слабость на солнце), но +15% опыта и ночное зрение.',
     '[Weak Tier] Fragile shut-in (-3 hearts, -1.5 melee, -20% attack speed, sunlight debuffs) with night vision and +15% XP.',
     'minecraft:tinted_glass', 3, [
         ('nerd_atrophy', 'Ослабленное тело', 'Shut-in Atrophy',
          '-3 сердца здоровья, -1.5 урона в ближнем бою, -20% скорости атаки; под дневным солнцем получает Слабость и Медлительность (KubeJS).',
          '-3 hearts health, -1.5 melee damage, -20% attack speed; gains Weakness & Slowness under open daytime sky (KubeJS).',
          p_mult('Ослабленное тело', '-3 сердца здоровья, -1.5 урона в ближнем бою, -20% скорости атаки; под дневным солнцем получает Слабость и Медлительность (KubeJS).', {
              'attr': {'type': 'origins:attribute', 'modifiers': [
                  attr_mod('Nerd HP', 'minecraft:generic.max_health', -6.0),
                  attr_mod('Nerd Dmg', 'minecraft:generic.attack_damage', -1.5),
                  attr_mod('Nerd AtkSpd', 'minecraft:generic.attack_speed', -0.2, 'multiply_base'),
              ]},
              'sun_spd': {'type': 'origins:conditioned_attribute', 'tick_rate': 20,
                          'modifier': attr_mod('Nerd Sun Slow', 'minecraft:generic.movement_speed', -0.15, 'multiply_base'),
                          'condition': {'type': 'origins:and', 'conditions': [
                              {'type': 'origins:exposed_to_sky'}, {'type': 'origins:daytime'}
                          ]}},
          })),
         ('nerd_screen', 'Свет монитора', 'Monitor Glow',
          'Ночное зрение и +15% получаемого опыта.',
          'Night vision and +15% XP gain.',
          p_mult('Свет монитора', 'Ночное зрение и +15% получаемого опыта.', {
              'nv': {'type': 'origins:night_vision', 'strength': 0.75},
              'xp': {'type': 'origins:modify_xp_gain', 'modifier': {'name': 'Nerd XP', 'operation': 'multiply_base', 'value': 0.15}},
          })),
     ]),

    ('furry', 'Фурри', 'Furry',
     '[Ослабленное] Хрупкий и заметный (-3 сердца, +35% урона от огня и снарядов, +30% расхода голода), слегка выше скорость и прыжок.',
     '[Weak Tier] Fragile plush frame (-3 hearts, +35% fire & projectile damage, +30% hunger drain), slight speed & jump boost.',
     'minecraft:rabbit_foot', 3, [
         ('furry_fragile', 'Плюшевая уязвимость', 'Flammable Fursuit',
          '-3 сердца здоровья, +35% входящего урона от огня и снарядов и +30% расхода голода.',
          '-3 hearts health, +35% fire and projectile damage taken, and +30% hunger exhaustion.',
          p_mult('Плюшевая уязвимость', '-3 сердца здоровья, +35% входящего урона от огня и снарядов и +30% расхода голода.', {
              'hp': {'type': 'origins:attribute', 'modifier': attr_mod('Furry HP', 'minecraft:generic.max_health', -6.0)},
              'exh': {'type': 'origins:modify_exhaustion', 'modifier': {'name': 'Furry Exhaustion', 'operation': 'multiply_base', 'value': 0.3}},
              'vuln': {'type': 'origins:modify_damage_taken',
                       'damage_condition': {'type': 'origins:or', 'conditions': [
                           {'type': 'origins:in_tag', 'tag': 'minecraft:is_fire'},
                           {'type': 'origins:in_tag', 'tag': 'minecraft:is_projectile'},
                       ]},
                       'modifier': {'name': 'Furry Vuln', 'operation': 'multiply_base', 'value': 0.35}},
          })),
         ('furry_paws', 'Прыткие лапки', 'Nimble Paws',
          '+10% скорости передвижения и +15% высоты прыжка.',
          '+10% movement speed and +15% jump height.',
          p_mult('Прыткие лапки', '+10% скорости передвижения и +15% высоты прыжка.', {
              'spd': {'type': 'origins:attribute', 'modifier': attr_mod('Furry Speed', 'minecraft:generic.movement_speed', 0.1, 'multiply_base')},
              'jmp': {'type': 'origins:modify_jump', 'modifier': {'name': 'Furry Jump', 'operation': 'multiply_base', 'value': 0.15}},
          })),
     ]),

    ('reddit_admin', 'Админ реддита', 'Reddit Admin',
     '[Ослабленное] Неповоротливый диванный модератор (-3 сердца, -18% скорости, -20% скорости атаки, +35% голода), зато трудно отбросить.',
     '[Weak Tier] Sluggish moderator (-3 hearts, -18% movement, -20% attack speed, +35% hunger drain), +25% knockback resistance.',
     'minecraft:cake', 3, [
         ('reddit_sluggish', 'Тяжесть кресла', 'Armchair Burden',
          '-3 сердца здоровья, -18% скорости передвижения, -20% скорости атаки и +35% расхода голода.',
          '-3 hearts health, -18% movement speed, -20% attack speed, and +35% hunger exhaustion.',
          p_mult('Тяжесть кресла', '-3 сердца здоровья, -18% скорости передвижения, -20% скорости атаки и +35% расхода голода.', {
              'attr': {'type': 'origins:attribute', 'modifiers': [
                  attr_mod('Reddit HP', 'minecraft:generic.max_health', -6.0),
                  attr_mod('Reddit Speed', 'minecraft:generic.movement_speed', -0.18, 'multiply_base'),
                  attr_mod('Reddit AtkSpd', 'minecraft:generic.attack_speed', -0.2, 'multiply_base'),
              ]},
              'exh': {'type': 'origins:modify_exhaustion', 'modifier': {'name': 'Reddit Exhaustion', 'operation': 'multiply_base', 'value': 0.35}},
          })),
         ('reddit_mass', 'Весовая категория', 'Heavy Banhammer',
          '+25% устойчивости к отбрасыванию.',
          '+25% knockback resistance.',
          p_attr('Весовая категория', '+25% устойчивости к отбрасыванию.', [
              attr_mod('Reddit KB', 'minecraft:generic.knockback_resistance', 0.25),
          ])),
     ]),

    ('domovenok', 'Домовёнок', 'Domovenok',
     '[Ослабленное] Крошечный дух (рост 0.65x через Pehkui): всего 6 сердец (-4), -2.0 урона и боится открытого неба, зато тихий.',
     '[Weak Tier] Tiny house spirit (0.65x Pehkui scale): -4 hearts, -2.0 melee, +30% sky damage, quiet steps & night vision.',
     'minecraft:candle', 3, [
         ('domovenok_tiny', 'Хрупкий дух избы', 'Tiny Hearth Spirit',
          'Размер 0.65x (Pehkui, KubeJS), -4 сердца здоровья, -2.0 урона в ближнем бою и +30% получаемого урона под открытым небом.',
          '0.65x scale (Pehkui, KubeJS), -4 hearts health, -2.0 melee damage, and +30% damage taken under open sky.',
          p_mult('Хрупкий дух избы', 'Размер 0.65x (Pehkui, KubeJS), -4 сердца здоровья, -2.0 урона в ближнем бою и +30% получаемого урона под открытым небом.', {
              'attr': {'type': 'origins:attribute', 'modifiers': [
                  attr_mod('Domovenok HP', 'minecraft:generic.max_health', -8.0),
                  attr_mod('Domovenok Dmg', 'minecraft:generic.attack_damage', -2.0),
              ]},
              'sky': {'type': 'origins:modify_damage_taken',
                      'condition': {'type': 'origins:exposed_to_sky'},
                      'modifier': {'name': 'Domovenok Sky', 'operation': 'multiply_base', 'value': 0.3}},
          })),
         ('domovenok_quiet', 'Шорох за печкой', 'Quiet Footsteps',
          'Бесшумные шаги и ночное зрение.',
          'Silent footsteps and night vision.',
          p_mult('Шорох за печкой', 'Бесшумные шаги и ночное зрение.', {
              'step': {'type': 'origins:prevent_game_event', 'events': ['minecraft:step']},
              'nv': {'type': 'origins:night_vision', 'strength': 0.75},
          })),
     ]),

    ('dwarf', 'Дворф', 'Dwarf',
     '[Ослабленное] Низкий рост (0.74x через Pehkui), -2 сердца, -15% скорости и быстро тонет, зато быстрее копает киркой.',
     '[Weak Tier] Short stout miner (0.74x Pehkui scale): -2 hearts, -15% speed, +35% drowning damage, +25% pickaxe speed.',
     'minecraft:iron_pickaxe', 3, [
         ('dwarf_stout', 'Низкий и тяжёлый', 'Short & Heavy',
          'Рост 0.74x (Pehkui, KubeJS), -2 сердца здоровья, -15% скорости передвижения и +35% урона от утопления.',
          '0.74x height (Pehkui, KubeJS), -2 hearts health, -15% movement speed, and +35% drowning damage.',
          p_mult('Низкий и тяжёлый', 'Рост 0.74x (Pehkui, KubeJS), -2 сердца здоровья, -15% скорости передвижения и +35% урона от утопления.', {
              'attr': {'type': 'origins:attribute', 'modifiers': [
                  attr_mod('Dwarf HP', 'minecraft:generic.max_health', -4.0),
                  attr_mod('Dwarf Speed', 'minecraft:generic.movement_speed', -0.15, 'multiply_base'),
              ]},
              'drown': {'type': 'origins:modify_damage_taken',
                        'damage_condition': {'type': 'origins:in_tag', 'tag': 'minecraft:is_drowning'},
                        'modifier': {'name': 'Dwarf Drown', 'operation': 'multiply_base', 'value': 0.35}},
          })),
         ('dwarf_pick', 'Старая кирка', 'Stout Pickaxe',
          '+25% скорости копания киркой.',
          '+25% pickaxe mining speed.',
          {'name': 'Старая кирка', 'description': '+25% скорости копания киркой.',
           'type': 'origins:modify_break_speed',
           'block_condition': {'type': 'origins:in_tag', 'tag': 'minecraft:mineable/pickaxe'},
           'modifier': {'name': 'Dwarf Mine', 'operation': 'multiply_base', 'value': 0.25}}),
     ]),

    ('nonbinary', 'Небинарная личность', 'Non-Binary Person',
     '[Ослабленное] Хрупкая конституция (-2.5 сердца, -1.5 урона, -15% лечения, +25% расхода голода), слегка выше скорость.',
     '[Weak Tier] Fragile build (-2.5 hearts, -1.5 melee, -15% healing, +25% hunger drain) with +10% movement speed.',
     'minecraft:amethyst_shard', 3, [
         ('nonbinary_fragile', 'Хрупкий баланс', 'Fragile Balance',
          '-2.5 сердца здоровья, -1.5 урона в ближнем бою, -15% эффективности лечения и +25% расхода голода.',
          '-2.5 hearts health, -1.5 melee damage, -15% healing received, and +25% hunger exhaustion.',
          p_mult('Хрупкий баланс', '-2.5 сердца здоровья, -1.5 урона в ближнем бою, -15% эффективности лечения и +25% расхода голода.', {
              'attr': {'type': 'origins:attribute', 'modifiers': [
                  attr_mod('NB HP', 'minecraft:generic.max_health', -5.0),
                  attr_mod('NB Dmg', 'minecraft:generic.attack_damage', -1.5),
              ]},
              'heal': {'type': 'origins:modify_healing', 'modifier': {'name': 'NB Heal', 'operation': 'multiply_base', 'value': -0.15}},
              'exh': {'type': 'origins:modify_exhaustion', 'modifier': {'name': 'NB Exhaustion', 'operation': 'multiply_base', 'value': 0.25}},
          })),
         ('nonbinary_agile', 'Лёгкий шаг', 'Light Step',
          '+10% скорости передвижения.',
          '+10% movement speed.',
          p_attr('Лёгкий шаг', '+10% скорости передвижения.', [
              attr_mod('NB Speed', 'minecraft:generic.movement_speed', 0.1, 'multiply_base'),
          ])),
     ]),

    ('robo_woman', 'Робо-Женщина', 'Robo-Woman',
     '[Ослабленное] Замыкает в воде и под дождём, -2 сердца и -30% лечения, зато +2 брони и иммунитет к яду.',
     '[Weak Tier] Short-circuits in water/rain, -2 hearts and -30% healing, compensated by +2 armor and Poison immunity.',
     'minecraft:iron_ingot', 3, [
         ('robowoman_short', 'Короткое замыкание', 'Water Short-Circuit',
          'Получает урон в воде и под дождём, -2 сердца здоровья и -30% естественного лечения.',
          'Takes periodic damage in water and rain, -2 hearts health, and -30% healing received.',
          p_mult('Короткое замыкание', 'Получает урон в воде и под дождём, -2 сердца здоровья и -30% естественного лечения.', {
              'hp': {'type': 'origins:attribute', 'modifier': attr_mod('Robo HP', 'minecraft:generic.max_health', -4.0)},
              'heal': {'type': 'origins:modify_healing', 'modifier': {'name': 'Robo Heal', 'operation': 'multiply_base', 'value': -0.3}},
              'water_dot': {
                  'type': 'origins:damage_over_time',
                  'interval': 25,
                  'onset_delay': 10,
                  'damage': 1.5,
                  'damage_source': {'name': 'hurt_by_water', 'unblockable': True},
                  'condition': {'type': 'origins:or', 'conditions': [
                      {'type': 'origins:submerged_in', 'fluid': 'minecraft:water'},
                      {'type': 'origins:in_rain'},
                  ]},
              },
          })),
         ('robowoman_chassis', 'Стальная оболочка', 'Metallic Shell',
          '+2 природной брони и иммунитет к Яду.',
          '+2 natural armor and Poison immunity.',
          p_mult('Стальная оболочка', '+2 природной брони и иммунитет к Яду.', {
              'arm': {'type': 'origins:attribute', 'modifier': attr_mod('Robo Armor', 'minecraft:generic.armor', 2.0)},
              'imm': {'type': 'origins:effect_immunity', 'effects': ['minecraft:poison']},
          })),
     ]),
]


def main():
    assert len(ORIGINS_SPEC) == 34, f'Expected 34 origins, got {len(ORIGINS_SPEC)}'

    # Remove old origin & power JSON files first so zero stale entries linger
    ORIGINS_DIR.mkdir(parents=True, exist_ok=True)
    POWERS_DIR.mkdir(parents=True, exist_ok=True)
    for old in list(ORIGINS_DIR.glob('*.json')) + list(POWERS_DIR.glob('*.json')):
        old.unlink()

    layer_list = []
    ru_lang = {}
    en_lang = {}

    for order_idx, (oid, ru_name, en_name, ru_desc, en_desc, icon, impact, powers) in enumerate(ORIGINS_SPEC, start=1):
        full_oid = f'longhaul_origins:{oid}'
        layer_list.append(full_oid)
        ru_lang[f'origin.longhaul_origins.{oid}.name'] = ru_name
        ru_lang[f'origin.longhaul_origins.{oid}.description'] = ru_desc
        en_lang[f'origin.longhaul_origins.{oid}.name'] = en_name
        en_lang[f'origin.longhaul_origins.{oid}.description'] = en_desc

        power_ids = []
        for pid, p_ru_name, p_en_name, p_ru_desc, p_en_desc, p_json in powers:
            full_pid = f'longhaul_origins:{pid}'
            power_ids.append(full_pid)
            ru_lang[f'power.longhaul_origins.{pid}.name'] = p_ru_name
            ru_lang[f'power.longhaul_origins.{pid}.description'] = p_ru_desc
            en_lang[f'power.longhaul_origins.{pid}.name'] = p_en_name
            en_lang[f'power.longhaul_origins.{pid}.description'] = p_en_desc
            (POWERS_DIR / f'{pid}.json').write_text(json.dumps(p_json, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

        origin_obj = {
            'name': ru_name,
            'description': ru_desc,
            'powers': power_ids,
            'icon': {'item': icon},
            'order': order_idx,
            'impact': impact,
        }
        (ORIGINS_DIR / f'{oid}.json').write_text(json.dumps(origin_obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    layer_obj = {
        'replace': True,
        'order': 0,
        'enabled': True,
        'origins': layer_list,
        'allow_random': True,
        'exclude_random': [],
        'allow_random_unchoosable': False,
        'hidden': False,
    }
    LAYER_PATH.parent.mkdir(parents=True, exist_ok=True)
    LAYER_PATH.write_text(json.dumps(layer_obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    LANG_RU.parent.mkdir(parents=True, exist_ok=True)
    LANG_RU.write_text(json.dumps(ru_lang, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    LANG_EN.write_text(json.dumps(en_lang, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    print(f'Generated {len(layer_list)} origins and {len(list(POWERS_DIR.glob("*.json")))} powers.')


if __name__ == '__main__':
    main()
