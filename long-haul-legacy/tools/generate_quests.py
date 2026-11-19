#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Long Haul Legacy — генератор квестов Heracles (Odyssey Quests).
Генерирует JSON-файлы квестов в overrides/config/heracles/quests/<группа>/<id>.json,
groups.txt, group_settings.json и lang-файлы с заголовками в kubejs/assets/longhaul/lang/.

Формат проверен по JSON-схеме Heracles (FooterManDev/heracles-jetbrains) и байткоду
Heracles 2.0.3: ID квеста = имя файла без .json, зависимости — по ID файлов.
"""
import json
import os
from quest_layout import CHAPTERS, positions

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUESTS_DIR = os.path.join(BASE, "overrides", "config", "heracles", "quests")
CONFIG_DIR = os.path.join(BASE, "overrides", "config", "heracles")
LANG_DIR = os.path.join(BASE, "overrides", "kubejs", "assets", "longhaul", "lang")

# ---------- helpers ----------
def item_task(item, amount=1):
    return {"type": "heracles:item", "item": item, "amount": amount, "collection": "AUTOMATIC"}

def kill_task(entity, amount=1):
    return {"type": "heracles:kill_entity", "entity": entity, "amount": amount}

def biome_task(biome):
    return {"type": "heracles:biome", "biomes": biome}

def dummy_task():
    return {"type": "heracles:dummy"}

def xp_reward(amount):
    return {"type": "heracles:xp", "xptype": "POINTS", "amount": amount}

# (group, id, icon, deps, tasks, xp, pos, title_ru, subtitle_ru, description_ru)
QUESTS = [
    # ================= START =================
    ("start", "welcome", "minecraft:compass", [], [dummy_task()], 50, [0, 0],
     "Добро пожаловать!", "Long Haul Legacy",
     ["Вы спавнились в умеренном поясе. До экватора — 50 000 блоков на юг, до полярного пояса — на север.",
      "Квесты открываются через вкладку в инвентаре. Выполняйте задания по порядку — каждая глава ведёт дальше.",
      "Нажмите, чтобы начать путь."]),
    ("start", "first_tools", "minecraft:stone_pickaxe", ["welcome"], [item_task("minecraft:stone_pickaxe")], 25, [1, 0],
     "Первые инструменты", "Камень и дерево рядом с домом",
     ["Срубите дерево, добудьте булыжник и сделайте каменную кирку.",
      "Всё базовое для старта есть в умеренном поясе — уходить далеко не нужно."]),
    ("start", "first_farm", "minecraft:wheat", ["welcome"], [item_task("minecraft:wheat", 8)], 25, [1, 1],
     "Первая ферма", "Пшеница растёт только в умеренном поясе",
     ["Посадите и соберите 8 пшеницы. Культуры в этом мире растут только в своём климатическом поясе (Biome Limited Growth).",
      "Пшеница, морковь, картофель и свёкла — только здесь, у спавна."]),
    ("start", "first_iron", "minecraft:iron_ingot", ["first_tools"], [item_task("minecraft:iron_ingot", 8)], 25, [2, 0],
     "Железо", "Основа мастерской",
     ["Добудьте 8 железных слитков в пещерах рядом с базой.",
      "Железо нужно для инструментов, рельсов и сплавной пластины Мегапроекта."]),
    ("start", "first_coal", "minecraft:coal", ["first_tools"], [item_task("minecraft:coal", 16)], 25, [2, 1],
     "Уголь", "Топливо и факелы",
     ["Добудьте 16 угля. Угольные жилы Create: Ore Excavation находятся в умеренном поясе — позже автоматизируете добычу буром."]),
    ("start", "first_zinc", "create:zinc_ingot", ["first_iron"], [item_task("create:zinc_ingot", 4)], 50, [3, 0],
     "Цинк", "Ключ к Create",
     ["Добудьте 4 цинка. Цинковые жилы — тоже в умеренном поясе, рядом со спавном.",
      "Цинк нужен для латунных компонентов Create и сплавной пластины Мегапроекта."]),
    ("start", "first_diamond", "minecraft:diamond", ["first_iron"], [item_task("minecraft:diamond")], 100, [3, 1],
     "Первый алмаз", "Глубоко под ногами",
     ["Спуститесь в глубокие пещеры и добудьте алмаз.",
      "Для промышленного масштаба алмазы придётся везти из тропиков или полярного пояса (глава «Экспедиции»)."]),

    # ================= WORKSHOP =================
    ("workshop", "water_power", "create:water_wheel", ["first_zinc"], [item_task("create:water_wheel")], 50, [0, 0],
     "Водяное колесо", "Первая кинетическая энергия",
     ["Соберите водяное колесо — источник энергии для всей мастерской Create.",
      "Поставьте его в текущую воду или постройте водяную мельницу."]),
    ("workshop", "mechanical_mixer", "create:mechanical_mixer", ["water_power"], [item_task("create:mechanical_mixer")], 50, [1, 0],
     "Механический миксер", "Смешивание и сплавы",
     ["Соберите механический миксер и подключите к водяному колесу.",
      "Миксер нужен для латуни и многих продвинутых рецептов."]),
    ("workshop", "mechanical_press", "create:mechanical_press", ["mechanical_mixer"], [item_task("create:mechanical_press")], 50, [2, 0],
     "Механический пресс", "Штамповка деталей",
     ["Соберите механический пресс. Пресс и миксер — сердце ранней мастерской."]),
    ("workshop", "brass_age", "create:brass_hand", ["mechanical_press"], [item_task("create:brass_hand")], 100, [3, 0],
     "Латунный век", "Латунь открывает продвинутый Create",
     ["Сделайте латунную руку. Латунь крафтится в миксере из меди и цинка.",
      "Латунные компоненты нужны для прецизионных механизмов и поездов."]),
    ("workshop", "precision", "create:precision_mechanism", ["brass_age"], [item_task("create:precision_mechanism")], 150, [4, 0],
     "Прецизионный механизм", "Продвинутая механика",
     ["Соберите прецизионный механизм — ключевой компонент для поездов, самолётов и Мегапроекта.",
      "Также прецизионные механизмы в большом количестве дают редкие структуры (глава «Боссы»)."]),
    ("workshop", "ore_drill", "createoreexcavation:drill", ["precision"], [item_task("createoreexcavation:drill")], 100, [5, 0],
     "Буровая насадка", "Начало промышленной добычи",
     ["Соберите буровую насадку Create: Ore Excavation.",
      "Буры работают на жилах своего климатического пояса: уголь, железо, медь и цинк — здесь, в умеренном поясе."]),
    ("workshop", "drilling_machine", "createoreexcavation:drilling_machine", ["ore_drill"], [item_task("createoreexcavation:drilling_machine")], 150, [6, 0],
     "Буровая машина", "Бесконечные руды",
     ["Соберите буровую машину и поставьте на жилу. Она будет добывать руду бесконечно, пока хватает кинетической энергии.",
      "Жилы видны в атласе жил (vein atlas) и на миникарте JEI."]),
    ("workshop", "vein_atlas", "createoreexcavation:vein_atlas", ["drilling_machine"], [item_task("createoreexcavation:vein_atlas")], 100, [7, 0],
     "Атлас жил", "Карта ресурсов мира",
     ["Сделайте атлас жил — он показывает расположение буровых жил вокруг вас.",
      "Золото, редстоун и лазурит — в аридном поясе на юге. Алмазы и изумруды — в тропиках и на севере."]),
    ("workshop", "diamond_drill", "createoreexcavation:diamond_drill", ["drilling_machine"], [item_task("createoreexcavation:diamond_drill")], 200, [7, 1],
     "Алмазный бур", "Для алмазных жил",
     ["Соберите алмазный бур для алмазных жил тропиков и полярного пояса.",
      "Без экспедиции на 30 000+ блоков алмазные жилы не найти — это и есть смысл дальних путешествий."]),
    ("workshop", "extractor", "createoreexcavation:extractor", ["drilling_machine"], [item_task("createoreexcavation:extractor")], 100, [7, -1],
     "Экстрактор", "Жидкости из недр",
     ["Соберите экстрактор — он добывает жидкости (например, воду) из подземных резервуаров."]),
    ("workshop", "electric_motor", "createaddition:electric_motor", ["precision"], [item_task("createaddition:electric_motor")], 150, [5, 1],
     "Электромотор", "Электричество + кинетика",
     ["Соберите электромотор Create Crafts & Additions — мост между электричеством и кинетической энергией.",
      "Электричество понадобится для дизельных генераторов и космической программы."]),
    ("workshop", "rolling_mill", "createaddition:rolling_mill", ["electric_motor"], [item_task("createaddition:rolling_mill")], 100, [6, 1],
     "Прокатный стан", "Провода и стержни",
     ["Соберите прокатный стан для производства проводов и стержней."]),
    ("workshop", "tesla_coil", "createaddition:tesla_coil", ["rolling_mill"], [item_task("createaddition:tesla_coil")], 150, [7, 2],
     "Катушка Теслы", "Зарядка и оборона",
     ["Соберите катушку Теслы — она заряжает инструменты и бьёт врагов током."]),

    # ================= TRANSPORT =================
    ("transport", "first_cart", "astikorcartsredux:acacia_hand_cart", ["first_tools"], [item_task("astikorcartsredux:acacia_hand_cart")], 50, [0, 0],
     "Первая тележка", "AstikorCarts",
     ["Соберите ручную тележку — первый транспорт для коротких поездок до 2 000 блоков.",
      "Тележки быстры на дорогах и не требуют топлива."]),
    ("transport", "first_boat", "smallships:acacia_rowboat", ["first_cart"], [item_task("smallships:acacia_rowboat")], 50, [1, 0],
     "Первый корабль", "Small Ships",
     ["Соберите лодку Small Ships для плавания по рекам и морям.",
      "Водные пути — быстрый способ добраться до аридного пояса, если река течёт на юг."]),
    ("transport", "first_track", "create:track", ["first_cart"], [item_task("create:track", 16)], 50, [1, 1],
     "Первые рельсы", "Железная дорога",
     ["Соберите 16 рельсов Create. Железная дорога — главный инструмент трансконтинентальной логистики.",
      "Поезда Create едут до 50 м/с: 50 000 блоков — около 17 минут пути."]),
    ("transport", "track_station", "create:track_station", ["first_track"], [item_task("create:track_station")], 100, [2, 1],
     "Станция", "Начало и конец маршрута",
     ["Поставьте станцию — поезда Create останавливаются только на станциях.",
      "Соедините две станции рельсами и создайте поезд."]),
    ("transport", "schedule", "create:schedule", ["track_station"], [item_task("create:schedule")], 100, [3, 1],
     "Расписание", "Автоматические маршруты",
     ["Сделайте расписание для автоматических поездок между станциями.",
      "Create Railways Navigator поможет с маршрутами и табло."]),
    ("transport", "steam_engine", "create:steam_engine", ["schedule"], [item_task("create:steam_engine")], 150, [4, 1],
     "Паровой двигатель", "Мощный локомотив",
     ["Соберите паровой двигатель для мощных составов.",
      "Паровозы тянут длинные грузовые составы через весь мир."]),
    ("transport", "chunk_loader", "create_power_loader:andesite_chunk_loader", ["track_station"], [item_task("create_power_loader:andesite_chunk_loader")], 100, [3, 0],
     "Чанк-лоадер", "Поезда ходят без вас",
     ["Соберите андезитовый чанк-лоадер Create: Power Loader и прикрепите к поезду или станции.",
      "С ним поезда и буровые машины работают, даже когда вы далеко."]),
    ("transport", "brass_loader", "create_power_loader:brass_chunk_loader", ["chunk_loader"], [item_task("create_power_loader:brass_chunk_loader")], 150, [4, 0],
     "Латунный чанк-лоадер", "Больший радиус загрузки",
     ["Улучшите чанк-лоадер до латунного — больший радиус и надёжность для магистралей."]),
    ("transport", "scout_plane", "immersive_aircraft:gyroscope", ["steam_engine"], [item_task("immersive_aircraft:gyroscope")], 150, [5, 1],
     "Разведывательный самолёт", "Immersive Aircraft",
     ["Соберите гироскоп и постройте первый самолёт из корпуса, пропеллера, двигателя и паруса.",
      "Самолёты — для быстрой разведки новых территорий. Скорость выше поездов, но грузоподъёмность ниже."]),
    ("transport", "airship", "immersive_aircraft:airship", ["scout_plane"], [item_task("immersive_aircraft:airship")], 200, [6, 1],
     "Дирижабль", "Грузовой полёт",
     ["Соберите дирижабль для перевозки грузов по воздуху.",
      "Дирижабли медленнее самолётов, но везут больше и не зависят от рельефа."]),
    ("transport", "economy_plane", "man_of_many_planes:economy_plane", ["airship"], [item_task("man_of_many_planes:economy_plane")], 200, [7, 1],
     "Тяжёлый самолёт", "Man of Many Planes",
     ["Соберите грузовой самолёт Man of Many Planes для дальних перевозок.",
      "Тяжёлые самолёты — самый быстрый способ доставить грузы через 50 000 блоков."]),
    ("transport", "diesel_engine", "createdieselgenerators:diesel_engine", ["steam_engine"], [item_task("createdieselgenerators:diesel_engine")], 200, [5, 0],
     "Дизельный двигатель", "Create: Diesel Generators",
     ["Соберите дизельный двигатель — мощнее парового и не требует воды.",
      "Дизельное топливо добывается в аридном поясе (глава «Региональная экспансия»)."]),
    ("transport", "charting_map", "via_romana:charting_map", ["first_cart"], [item_task("via_romana:charting_map")], 50, [0, 1],
     "Карта дорог", "Via Romana",
     ["Сделайте карту дорог Via Romana — она показывает существующие дороги и помогает планировать маршруты.",
      "Дороги ускоряют тележки и повозки."]),

    # ================= REGIONS =================
    ("regions", "arid_journey", "minecraft:desert", ["track_station"], [biome_task("minecraft:desert")], 100, [0, 0],
     "Путь на юг", "Аридный пояс",
     ["Отправьтесь на юг и доберитесь до пустыни — это примерно 10 000–20 000 блоков от спавна.",
      "Постройте железную дорогу или летите на самолёте. В аридном поясе: золото, редстоун, лазурит."]),
    ("regions", "gold_vein", "minecraft:gold_ingot", ["arid_journey"], [item_task("minecraft:gold_ingot", 16)], 100, [1, 0],
     "Золотая жила", "Буры аридного пояса",
     ["Добудьте 16 золота с буровых жил аридного пояса (или в пещерах пустыни).",
      "Золото нужно для прецизионной рамы Мегапроекта."]),
    ("regions", "redstone_vein", "minecraft:redstone", ["gold_vein"], [item_task("minecraft:redstone", 32)], 100, [2, 0],
     "Редстоуновая жила", "Электроника и механизмы",
     ["Добудьте 32 редстоуна в аридном поясе.",
      "Редстоун нужен для прецизионной рамы и электрических схем."]),
    ("regions", "lapis_vein", "minecraft:lapis_lazuli", ["gold_vein"], [item_task("minecraft:lapis_lazuli", 16)], 50, [2, 1],
     "Лазуритовая жила", "Зачарования",
     ["Добудьте 16 лазурита в аридном поясе для зачарований."]),
    ("regions", "diesel_fuel", "createdieselgenerators:diesel", ["diesel_engine"], [item_task("createdieselgenerators:diesel", 4)], 100, [1, 1],
     "Дизельное топливо", "Заправка двигателей",
     ["Добудьте дизельное топливо для дизельных двигателей.",
      "Топливо добывается бурением в аридном поясе."]),

    # ================= EXPEDITIONS =================
    ("expeditions", "tropical_journey", "minecraft:jungle", ["arid_journey"], [biome_task("minecraft:jungle")], 150, [0, 0],
     "Путь к экватору", "Тропический пояс",
     ["Доберитесь до джунглей — это 30 000–50 000 блоков на юг от спавна.",
      "Здесь: алмазные и изумрудные жилы, рис, лук и томаты. Путь на поезде займёт около 20 минут — это нормально, так задумано."]),
    ("expeditions", "polar_journey", "minecraft:snowy_plains", ["arid_journey"], [biome_task("minecraft:snowy_plains")], 150, [0, 1],
     "Путь на север", "Полярный пояс",
     ["Отправьтесь на север в снежные равнины — 30 000+ блоков от спавна.",
      "Здесь тоже есть алмазы и изумруды, а также капуста. Утепляйтесь: Cold Sweat на севере суров."]),
    ("expeditions", "diamond_vein", "createoreexcavation:raw_diamond", ["tropical_journey"], [item_task("createoreexcavation:raw_diamond", 8)], 200, [1, 0],
     "Алмазная жила", "Тропические недра",
     ["Добудьте 8 сырого алмаза с тропических буровых жил.",
      "Алмазы нужны для энергетического ядра Мегапроекта и алмазного бура."]),
    ("expeditions", "emerald_vein", "minecraft:emerald", ["tropical_journey"], [item_task("minecraft:emerald", 8)], 150, [1, 1],
     "Изумрудная жила", "Тропические недра",
     ["Добудьте 8 изумрудов в тропиках.",
      "Изумруды нужны для энергетического ядра Мегапроекта."]),
    ("expeditions", "rice_farm", "farmersdelight:rice", ["tropical_journey"], [item_task("farmersdelight:rice", 16)], 100, [2, 0],
     "Рисовая ферма", "Тропические культуры",
     ["Вырастите 16 риса. Рис растёт только в тропическом поясе — постройте ферму на южной базе.",
      "EverCrops позволяет фермам расти, даже когда чанки не загружены."]),
    ("expeditions", "tomato_farm", "farmersdelight:tomatoes", ["rice_farm"], [item_task("farmersdelight:tomatoes", 8)], 100, [3, 0],
     "Томатная ферма", "Тропические культуры",
     ["Вырастите 8 томатов в тропиках. Лук и томаты — тоже только здесь."]),
    ("expeditions", "cabbage_farm", "farmersdelight:cabbages", ["polar_journey"], [item_task("farmersdelight:cabbages", 8)], 100, [1, 2],
     "Капустная ферма", "Холодные культуры",
     ["Вырастите 8 капусты в холодном поясе на севере.",
      "Капуста — единственная культура холодного пояса."]),
    ("expeditions", "atlas", "map_atlases:atlas", ["tropical_journey"], [item_task("map_atlases:atlas")], 100, [2, 1],
     "Атлас", "Картография огромного мира",
     ["Соберите атлас Map Atlases — он собирает карты в единый атлас мира.",
      "В мире на 100 000 блоков атлас незаменим для навигации."]),
    ("expeditions", "natures_compass", "naturescompass:naturescompass", ["polar_journey"], [item_task("naturescompass:naturescompass")], 50, [2, 2],
     "Компас природы", "Поиск биомов",
     ["Сделайте компас природы — он находит ближайшие биомы.",
      "Полезен для поиска тропиков, пустынь и полярных земель."]),
    ("expeditions", "explorers_compass", "explorerscompass:explorerscompass", ["tropical_journey"], [item_task("explorerscompass:explorerscompass")], 50, [2, -1],
     "Компас исследователя", "Поиск структур",
     ["Сделайте компас исследователя — он находит структуры.",
      "Структуры в этом мире в 3 раза реже, но награды в них богаче (глава «Боссы»)."]),

    # ================= BOSSES =================
    ("bosses", "structure_hunter", "minecraft:chest", ["first_iron"], [item_task("create:precision_mechanism")], 100, [0, 0],
     "Охотник за структурами", "Редкие, но богатые",
     ["Найдите структуру и добудьте прецизионный механизм из сундука.",
      "Структуры разбросаны в 3 раза реже обычного (Structurify), но лут в них усилен: прецизионные механизмы, рельсы, золото."]),
    ("bosses", "precision_loot", "create:precision_mechanism", ["structure_hunter"], [item_task("create:precision_mechanism", 4)], 150, [1, 0],
     "Промышленные реликвии", "Лут структур",
     ["Соберите 4 прецизионных механизма из сундуков структур.",
      "Пустынные пирамиды, храмы джунглей, шахты и бастионы дают больше всего."]),
    ("bosses", "track_loot", "create:track", ["structure_hunter"], [item_task("create:track", 32)], 100, [1, 1],
     "Рельсовые наборы", "Лут структур",
     ["Соберите 32 рельса из сундуков структур — готовые наборы для железных дорог.",
      "Шахты и аванпосты разбойников дают рельсы в большом количестве."]),
    ("bosses", "ancient_remnant", "cataclysm:ancient_metal_ingot", ["diamond_drill"], [kill_task("cataclysm:ancient_remnant")], 300, [0, 0],
     "Древний остаток", "L_Ender's Cataclysm",
     ["Победите Древнего остатка — первого крупного босса Cataclysm.",
      "Идите в глубокие пещеры и подземные храмы. Босс требует алмазного снаряжения и еды."]),
    ("bosses", "burning_ashes", "cataclysm:burning_ashes", ["ancient_remnant"], [item_task("cataclysm:burning_ashes", 2)], 200, [1, 0],
     "Горящий пепел", "Дроп босса",
     ["Добудьте 2 горящего пепла с боссов Cataclysm.",
      "Пепел нужен для катализатора запуска Мегапроекта."]),
    ("bosses", "ancient_metal", "cataclysm:ancient_metal_ingot", ["ancient_remnant"], [item_task("cataclysm:ancient_metal_ingot", 8)], 150, [1, 1],
     "Древний металл", "Дроп босса",
     ["Добудьте 8 слитков древнего металла с боссов Cataclysm."]),
    ("bosses", "netherite_monstrosity", "cataclysm:netherite_monstrosity_spawn_egg", ["ancient_remnant"], [kill_task("cataclysm:netherite_monstrosity")], 300, [1, -1],
     "Незеритовый голем", "L_Ender's Cataclysm",
     ["Победите незеритового голема в Незере.",
      "Голем даёт незеритовый лом и горящий пепел для Мегапроекта."]),
    ("bosses", "lich", "bosses_of_mass_destruction:soul_star", ["ancient_remnant"], [kill_task("bosses_of_mass_destruction:lich")], 300, [2, 0],
     "Древний лич", "Bosses of Mass Destruction",
     ["Победите Древнего лича в его башне.",
      "Лич даёт звезду душ и обсидиановое сердце для Мегапроекта."]),
    ("bosses", "soul_star", "bosses_of_mass_destruction:soul_star", ["lich"], [item_task("bosses_of_mass_destruction:soul_star")], 200, [3, 0],
     "Звезда душ", "Дроп лича",
     ["Добудьте звезду душ с Древнего лича."]),
    ("bosses", "obsidian_heart", "bosses_of_mass_destruction:obsidian_heart", ["lich"], [item_task("bosses_of_mass_destruction:obsidian_heart")], 200, [3, 1],
     "Обсидиановое сердце", "Дроп лича",
     ["Добудьте обсидиановое сердце с Древнего лича."]),
    ("bosses", "wither_slayer", "minecraft:nether_star", ["lich"], [kill_task("minecraft:wither")], 300, [3, -1],
     "Убийца визера", "Ванильный босс",
     ["Призовите и победите визера. Его звезда — финальный ингредиент многих эндгейм-рецептов."]),

    # ================= MEGAPROJECT =================
    ("megaproject", "alloy_plate", "megaproject:alloy_plate", ["first_zinc"], [item_task("megaproject:alloy_plate", 8)], 100, [0, 0],
     "Сплавная пластина", "Мегапроект: шаг 1",
     ["Соберите 8 сплавных пластин из железа и цинка (умеренный пояс).",
      "Это базовый компонент Инженерного Мегапроекта — аналога космического лифта из Satisfactory."]),
    ("megaproject", "precision_frame", "megaproject:precision_frame", ["alloy_plate", "gold_vein"], [item_task("megaproject:precision_frame", 4)], 200, [1, 0],
     "Прецизионная рама", "Мегапроект: шаг 2",
     ["Соберите 4 прецизионные рамы: сплавные пластины + золото + редстоун.",
      "Золото и редстоун — из аридного пояса. Мегапроект заставляет строить трансконтинентальную логистику."]),
    ("megaproject", "energy_core", "megaproject:energy_core", ["precision_frame", "diamond_vein"], [item_task("megaproject:energy_core", 2)], 300, [2, 0],
     "Энергетическое ядро", "Мегапроект: шаг 3",
     ["Соберите 2 энергетических ядра: рамы + алмазы + изумруды.",
      "Алмазы и изумруды — из тропиков или полярного пояса."]),
    ("megaproject", "launch_catalyst", "megaproject:launch_catalyst", ["energy_core", "burning_ashes"], [item_task("megaproject:launch_catalyst")], 500, [3, 0],
     "Катализатор запуска", "Мегапроект: шаг 4",
     ["Соберите катализатор запуска: ядра + незерит + горящий пепел с боссов.",
      "Катализатор открывает космическую программу: без него не собрать обтекатель ракеты."]),
    ("megaproject", "orbital_module", "megaproject:orbital_module", ["launch_catalyst"], [item_task("megaproject:orbital_module", 2)], 400, [4, 0],
     "Орбитальный модуль", "Мегапроект: шаг 5",
     ["Соберите 2 орбитальных модуля: катализаторы + стальные пластины Ad Astra.",
      "Стальные пластины крафтятся из стали — см. главу «Космическая программа»."]),
    ("megaproject", "megaproject_core", "megaproject:core", ["orbital_module"], [item_task("megaproject:core")], 500, [5, 0],
     "Ядро Мегапроекта", "Мегапроект: финал",
     ["Соберите ядро Мегапроекта из 8 орбитальных модулей и катализатора.",
      "Это центральный блок конструкции — огромный поглотитель ресурсов всей игры."]),
    ("megaproject", "launch_pad", "megaproject:launch_pad", ["megaproject_core"], [item_task("megaproject:launch_pad")], 500, [6, 0],
     "Стартовая площадка", "Мегапроект: финал",
     ["Соберите стартовую площадку из ядра и незеритовых блоков.",
      "Мегапроект завершён. Теперь — в космос."]),

    # ================= SPACE =================
    ("space", "steel_plate", "ad_astra:steel_plate", ["launch_catalyst"], [item_task("ad_astra:steel_plate", 16)], 100, [0, 0],
     "Стальные пластины", "Ad Astra: материалы",
     ["Соберите 16 стальных пластин Ad Astra из стальных слитков.",
      "Сталь плавится из железа и угля. Пластины нужны для ракет и орбитальных модулей."]),
    ("space", "nasa_workbench", "ad_astra:nasa_workbench", ["steel_plate"], [item_task("ad_astra:nasa_workbench")], 150, [1, 0],
     "Верстак NASA", "Ad Astra: сборка ракет",
     ["Соберите верстак NASA — в нём крафтятся ракеты всех тиров."]),
    ("space", "rocket_fin", "ad_astra:rocket_fin", ["nasa_workbench"], [item_task("ad_astra:rocket_fin", 4)], 100, [2, 0],
     "Стабилизаторы ракеты", "Ad Astra: детали",
     ["Соберите 4 стабилизатора ракеты из стальных пластин."]),
    ("space", "nose_cone", "ad_astra:rocket_nose_cone", ["launch_catalyst"], [item_task("ad_astra:rocket_nose_cone")], 150, [2, 1],
     "Обтекатель ракеты", "Гейт Мегапроекта",
     ["Соберите обтекатель ракеты. В этом модпаке он требует катализатор запуска Мегапроекта.",
      "Без Мегапроекта в космос не попасть — сначала соберите все компоненты."]),
    ("space", "tier1_rocket", "ad_astra:tier_1_rocket", ["nose_cone", "rocket_fin"], [item_task("ad_astra:tier_1_rocket")], 300, [3, 0],
     "Ракета тира 1", "Первый полёт",
     ["Соберите ракету тира 1 в верстаке NASA и заправьте топливом.",
      "Ракета 1 тира летит на Луну. Поставьте её на стартовую площадку и запускайте."]),
    ("space", "moon", "ad_astra:desh_ingot", ["tier1_rocket"], [item_task("ad_astra:desh_ingot", 8)], 400, [4, 0],
     "Луна", "Деш — лунная руда",
     ["Добудьте 8 слитков деша на Луне.",
      "Деш — главный материал ракет 2 тира. На Луне нет кислорода: возьмите кислородное снаряжение."]),
    ("space", "desh_plate", "ad_astra:desh_plate", ["moon"], [item_task("ad_astra:desh_plate", 16)], 200, [5, 0],
     "Дешовые пластины", "Ad Astra: материалы",
     ["Соберите 16 дешовых пластин из лунного деша."]),
    ("space", "tier2_rocket", "ad_astra:tier_2_rocket", ["desh_plate"], [item_task("ad_astra:tier_2_rocket")], 400, [6, 0],
     "Ракета тира 2", "Полёт на Марс",
     ["Соберите ракету тира 2 из дешовых блоков, баков и двигателя.",
      "Ракета 2 тира летит на Марс."]),
    ("space", "ostrum", "ad_astra:ostrum_ingot", ["tier2_rocket"], [item_task("ad_astra:ostrum_ingot", 8)], 400, [7, 0],
     "Марс", "Острум — марсианская руда",
     ["Добудьте 8 слитков острума на Марсе.",
      "Острум — главный материал ракет 3 тира."]),
    ("space", "tier3_rocket", "ad_astra:tier_3_rocket", ["ostrum"], [item_task("ad_astra:tier_3_rocket")], 500, [8, 0],
     "Ракета тира 3", "Полёт на Венеру",
     ["Соберите ракету тира 3 из острумовых блоков, баков и двигателя.",
      "Ракета 3 тира летит на Венеру и Меркурий."]),
    ("space", "calorite", "ad_astra:calorite_ingot", ["tier3_rocket"], [item_task("ad_astra:calorite_ingot", 8)], 500, [9, 0],
     "Венера и Меркурий", "Калорит — руда дальних планет",
     ["Добудьте 8 слитков калорита на Венере или Меркурии.",
      "Калорит — главный материал ракет 4 тира."]),
    ("space", "tier4_rocket", "ad_astra:tier_4_rocket", ["calorite"], [item_task("ad_astra:tier_4_rocket")], 600, [10, 0],
     "Ракета тира 4", "Финал космической программы",
     ["Соберите ракету тира 4 из калоритовых блоков, баков и двигателя.",
      "Ракета 4 тира летит на Глейсио — самую дальнюю планету Ad Astra. Космическая программа завершена!"]),
    ("space", "jet_suit", "ad_astra:jet_suit", ["tier1_rocket"], [item_task("ad_astra:jet_suit")], 200, [4, 1],
     "Реактивный ранец", "Ad Astra: снаряжение",
     ["Соберите реактивный ранец для полётов в разрежённой атмосфере планет."]),
    ("space", "oxygen_gear", "ad_astra:oxygen_gear", ["tier1_rocket"], [item_task("ad_astra:oxygen_gear")], 150, [4, -1],
     "Кислородное снаряжение", "Ad Astra: выживание",
     ["Соберите кислородное снаряжение: маску, баки и распределитель кислорода.",
      "Без кислорода на Луне и планетах вы задохнётесь за секунды."]),
    ("space", "gravity_normalizer", "ad_astra:gravity_normalizer", ["moon"], [item_task("ad_astra:gravity_normalizer")], 200, [5, 1],
     "Нормализатор гравитации", "Ad Astra: базы",
     ["Соберите нормализатор гравитации для лунных и планетарных баз."]),

    # ================= GUIDE =================
    ("guide", "guide_climate", "minecraft:leather_chestplate", [], [dummy_task()], 10, [0, 0],
     "Климат и выживание", "Cold Sweat + Natural Temperature",
     ["Мир разделён на 5 климатических поясов: полярный, холодный, умеренный (спавн), аридный и тропический.",
      "Cold Sweat следит за температурой тела: на севере утепляйтесь (кожа, шерсть, костры), на экваторе охлаждайтесь.",
      "Create: Cold Sweat: механизмы Create хуже работают на морозе — отапливайте мастерские."]),
    ("guide", "guide_farming", "farmersdelight:rice", [], [dummy_task()], 10, [1, 0],
     "Фермерство по поясам", "Biome Limited Growth + EverCrops",
     ["Культуры растут только в своём поясе: пшеница/морковь/картофель — умеренный, рис/лук/томаты — тропики, капуста — холодный пояс.",
      "Стройте фермы в разных поясах и перевозите урожай поездами.",
      "EverCrops: фермы продолжают расти, даже когда чанки не загружены."]),
    ("guide", "guide_worldgen", "minecraft:grass_block", [], [dummy_task()], 10, [2, 0],
     "Генерация мира", "Tectonic + Structurify + Distant Horizons",
     ["Tectonic генерирует континенты и горы на десятки тысяч блоков.",
      "Structurify: структуры в 3 раза реже, но лут в них многократно богаче.",
      "Distant Horizons показывает ландшафт на километры вперёд — используйте для планирования маршрутов."]),
    ("guide", "guide_survival", "comforts:sleeping_bag_white", [], [dummy_task()], 10, [3, 0],
     "Выживание в пути", "Comforts + рюкзаки + ящики",
     ["Comforts: спальные мешки и гамаки для ночёвок в экспедициях.",
      "Traveler's Backpack: рюкзак для дальних вылазок.",
      "Storage Drawers: ящики с сортировкой для баз и поездов."]),
    ("guide", "guide_navigation", "map_atlases:atlas", [], [dummy_task()], 10, [4, 0],
     "Навигация", "Атласы + компасы + дороги",
     ["Map Atlases: атлас собирает карты в единый обзор мира.",
      "Nature's Compass находит биомы, Explorer's Compass — структуры.",
      "Via Romana: дороги ускоряют тележки; карта дорог показывает маршруты."]),
    ("guide", "guide_create", "createaddition:electric_motor", [], [dummy_task()], 10, [5, 0],
     "Дополнения Create", "Дизель, электричество, навигация",
     ["Create: Diesel Generators: дизельные двигатели для мощных составов.",
      "Create Crafts & Additions: электромоторы, прокатный стан, катушки Теслы.",
      "Create: New Age: продвинутая энергетика. Create Railways Navigator: расписания и табло. Create Track Map: карта сети поездов."]),
    ("guide", "guide_bosses", "cataclysm:cursed_eye", [], [dummy_task()], 10, [6, 0],
     "Боссы и структуры", "Cataclysm + BOMD + End Remastered",
     ["L_Ender's Cataclysm: Древний остаток, незеритовый голем и другие боссы.",
      "Bosses of Mass Destruction: Древний лич, обсидилит и другие.",
      "End Remastered усиливает лут ванильных структур. Explorify добавляет поселения и мавзолеи."]),
    ("guide", "guide_space", "ad_astra:space_suit", [], [dummy_task()], 10, [7, 0],
     "Космос", "Ad Astra + Giselle Addon",
     ["Ad Astra: Луна, Марс, Венера, Меркурий и Глейсио. Ракеты тиров 1–4.",
      "Ракеты требуют катализатор запуска Мегапроекта (обтекатель).",
      "Ad Astra: Giselle Addon добавляет новые материалы и рецепты."]),
    ("guide", "guide_perf", "minecraft:clock", [], [dummy_task()], 10, [8, 0],
     "Интерфейс и производительность", "JEI/EMI/Jade + Sodium/C2ME",
     ["JEI и EMI: просмотр рецептов. Jade: информация о блоках и мобах. AppleSkin: голод и насыщение.",
      "Sodium, Lithium, C2ME, ModernFix и другие ускоряют игру — важно для огромного мира.",
      "Chunky: ускоренная генерация чанков для новых территорий."]),
]

GROUPS = [
    ("start", "minecraft:compass", "circles"),
    ("workshop", "create:mechanical_mixer", "gears"),
    ("transport", "create:track", "hexagons"),
    ("regions", "minecraft:gold_ingot", "diamonds"),
    ("expeditions", "minecraft:diamond", "octagons"),
    ("bosses", "cataclysm:burning_ashes", "hearts"),
    ("megaproject", "megaproject:energy_core", "gears"),
    ("space", "ad_astra:tier_1_rocket", "pentagons"),
    ("guide", "minecraft:book", "rounded_squares"),
]

SETTINGS = {
    "unlockNotification": True,
    "showDependencyArrow": True,
    "repeatable": False,
    "individual_progress": False,
    "hidden": "LOCKED",
}

def main():
    os.makedirs(QUESTS_DIR, exist_ok=True)
    os.makedirs(LANG_DIR, exist_ok=True)
    layout = positions()
    assert set(layout) == {q[1] for q in QUESTS}
    lang_ru = {}
    lang_en = {}
    for group, qid, icon, deps, tasks, xp, pos, title, subtitle, desc in QUESTS:
        quest = {
            "dependencies": deps,
            "tasks": {f"task{i+1}": t for i, t in enumerate(tasks)},
            "rewards": {"reward1": xp_reward(xp)},
            "display": {
                "title": json.dumps({"text": title}, ensure_ascii=False),
                "subtitle": json.dumps({"text": subtitle}, ensure_ascii=False),
                "description": desc,
                "groups": {CHAPTERS[group]: {"position": layout[qid]}},
                "icon": {"type": "heracles:item", "item": {"id": icon, "count": 1}},
                "icon_background": "heracles:textures/gui/quest_backgrounds/default.png",
            },
            "settings": dict(SETTINGS),
        }
        gdir = os.path.join(QUESTS_DIR, group)
        os.makedirs(gdir, exist_ok=True)
        with open(os.path.join(gdir, f"{qid}.json"), "w", encoding="utf-8") as f:
            json.dump(quest, f, indent=2, ensure_ascii=False)
        lang_ru[f"quest.longhaul.{qid}.title"] = title
        lang_ru[f"quest.longhaul.{qid}.subtitle"] = subtitle
        # English fallback = Russian text (pack is Russian-first)
        lang_en[f"quest.longhaul.{qid}.title"] = title
        lang_en[f"quest.longhaul.{qid}.subtitle"] = subtitle

    # groups.txt
    with open(os.path.join(CONFIG_DIR, "groups.txt"), "w", encoding="utf-8") as f:
        for g, _, _ in GROUPS:
            f.write(CHAPTERS[g] + "\n")

    # group_settings.json
    gs = {}
    for g, icon, bg in GROUPS:
        gs[CHAPTERS[g]] = {
            "icon": icon,
            "iconEnabled": True,
            "background": "",
            "backgroundOpacity": 100,
        }
    with open(os.path.join(CONFIG_DIR, "group_settings.json"), "w", encoding="utf-8") as f:
        json.dump(gs, f, indent=2, ensure_ascii=False)

    # lang files
    with open(os.path.join(LANG_DIR, "ru_ru.json"), "w", encoding="utf-8") as f:
        json.dump(lang_ru, f, indent=2, ensure_ascii=False)
    with open(os.path.join(LANG_DIR, "en_us.json"), "w", encoding="utf-8") as f:
        json.dump(lang_en, f, indent=2, ensure_ascii=False)

    print(f"Generated {len(QUESTS)} quests in {len(GROUPS)} groups")
    # validate: all deps exist, all files valid JSON
    ids = {q[1] for q in QUESTS}
    for group, qid, icon, deps, tasks, xp, pos, title, subtitle, desc in QUESTS:
        for d in deps:
            assert d in ids, f"Quest {qid} depends on missing quest {d}"
    print("All dependencies valid")

if __name__ == "__main__":
    main()
