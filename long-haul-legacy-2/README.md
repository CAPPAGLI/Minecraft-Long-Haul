# Long Haul Legacy 2.0 — Alpha 9 (`2.0-alpha.9`)

**Расширенная серверно-проверенная альфа сборки, НЕ финальный релиз по полному ТЗ.** Импортируемый `.mrpack` предназначен для отдельного тестового профиля и нового обычного мира. Рабочая 1.1.1 не изменена. Исторические снимки прошлых альф сохранены в `history/alpha.1/` – `history/alpha.9/`.

## Что нового в `2.0-alpha.9`

- **Паркур-мод `ParCool!` (`profiles/alpha9.json`, `assemble_alpha.py`):**
  - Добавлен `parcool` (автоматически подбирается новейшая версия, совместимая с Forge `47.4.10`, совместно с `combat-roll`).
- **Удаление саженцев и дефицит древесины (`20_basics.js`, `01_longhaul_tooltips.js`):**
  - Саженцы (`#minecraft:saplings`, а также `azalea`/`flowering_azalea` из листвы) больше не выпадают и не сажаются в мире; дроп `#minecraft:logs` снижен на `40%`.
  - Для добычи дерева теперь нужно путешествовать к новым лесам или запускать региональную Лесную Артель (`forest`).
- **Ребаланс руд в 10 раз + редкие богатые рудные чанки (`tools/generate_worldgen.py`, `/lh prospect`):**
  - Частота `17` ванильных рудных генераторов Overworld (включая уголь, железо, медь, золото, редстоун, лазурит, алмазы и изумруды) снижена ~в `10` раз.
  - Через Forge biome modifier (`longhaul/forge/biome_modifier/add_rich_ore_chunks.json`) добавлены `6` редких монорудных жильных чанков (`rich_coal_chunk` `1/64`, `rich_iron_chunk` `1/72`, `rich_copper_chunk` `1/72`, `rich_gold_chunk` `1/96`, `rich_redstone_chunk` `1/96`, `rich_diamond_chunk` `1/160`).
  - Добавлена команда `/lh prospect` для разведки рудной жилы в текущем чанке.
- **Бессмертная Улитка (`24_immortal_snail.js`, `/lh snail status|wake`):**
  - Не пробуждается сразу на старте (льготный период `15` минут / `18000` тиков, либо минимум `3` минуты и выход дальше `150` м от `(0,0)`), никогда не убивает игроков сразу на спауне.
  - После пробуждения медленно и неумолимо ползёт сквозь любые блоки (`0.36–1.70` м/с), не получает урона, предупреждает при приближении к чанкам игрока и убивает при контакте (`<= 2.2` м), после чего уходит на перезарядку `120` с на дистанцию `80` м.
- **Мемная сюжетная линия «Ушёл за хлебом» (`generate_alpha_quests.py`, `22_stage_progression.js`):**
  - Добавлена новая стартовая группа квестов **`00 · Сюжет: Ушёл за хлебом`** (`6` глав, `317` квестов / `300` серверных advancement), развивающая историю о рождении сына и походе в магазин за хлебом по мере прохождения всех 4 промышленных стадий и встречи с Улиткой.

Профиль сборки: `profiles/alpha9.json` (динамически разрешаемый список и хэши в CI → артефакт `Long-Haul-Legacy-2.0-alpha.9.mrpack` и `Long-Haul-Legacy-2.0-alpha.9-Sources-and-Report.zip`). Подробности проверки: `TEST-REPORT.md`, машинный статус: `STATUS.json`.

## Установка тестового профиля

1. Соберите или скачайте `Long-Haul-Legacy-2.0-alpha.9.mrpack` (артефакт CI `long-haul-legacy-2.0-alpha.9`, либо локально: `python tools/assemble_alpha.py --profile profiles/alpha9.json --lock-only && python tools/generate_modlist.py && python tools/package_alpha.py --version 2.0-alpha.9 --skip-jar-bytes-check`, либо без `--lock-only`/`--skip-jar-bytes-check` для полной локальной проверки SHA-512). Не смешивайте с `1.1.1`.
2. Импортируйте в Prism Launcher или совместимый лаунчер.
3. Выберите **Java 17** и начните с **8–10 ГБ RAM** (на системе с 32 ГБ RAM; не выделяйте всю память).
4. Создайте **новый обычный мир**.

## Основные команды `/lh`

- `/lh help` — справка по командам.
- `/lh prospect`, `/lh snail status` — геологоразведка редких рудных чанков и статус Бессмертной Улитки.
- `/lh terminal`, `/lh accept <id>`, `/lh status`, `/lh abort`, `/lh team <join|leave> [имя]` — приёмка и кооперативные контракты.
- `/lh stage`, `/lh vehicle status` — текущая промышленная стадия GameStages и одометр транспорта.
- `/lh catalog list|stage <1..4>|info <id>|verify <id>` — просмотр и серверная проверка 240 заказов каталога.
- `/lh sites`, `/lh site info <id>`, `/lh site commission <id>`, `/lh site produce <id> <bootstrap|industrial>`, `/lh site archive`, `/lh site repair_archive` — разведка, ввод в строй, ремонт архива и локальное производство на 10 стратегических узлах.
- `/lh recovery list|info|survey|restore` — обследование и восстановление 6 разрушенных объектов.
- `/lh photo report|status`, `/lh cc challenge|verify|status` — полевые фотоотчёты Exposure и телеметрия CC: Tweaked.
- `/lh camp deploy|pack|list`, `/lh route begin|gate|finish|start|list`, `/lh cargo issue|deliver` — лагеря, маршруты без телепортации и серверные грузовые накладные.

## Что ещё осталось до финального релиза

| Требование | Состояние `2.0-alpha.9` |
|---|---|
| ~500 полезных модов | В процессе: 371 внешний JAR / 440 mod ID (расширение к ~500 за счёт новых совместимых модов, добавлен ParCool!) |
| Клиентское, графическое и транспортное тестирование | Не пройдено: проверен только headless Linux-сервер (void + обычный Overworld) |
| Полная интеграция всех 240 спецификаций из `design/quest-catalog.*` | Реализовано в Heracles (317 квестов, 12 групп, 300 advancement) и сервере (`/lh catalog`, все 19 `verification_type` + сюжет «Ушёл за хлебом») |
| Физические NBT-структуры городов и объектов восстановления | Реализованы 16 ролевых `11×7×11` `.nbt` шаблонов + авторазмещение и ремонт архива |
| Проверка физики поездов/кораблей VS в клиенте | Не проведена в графическом клиенте |

## Воспроизведение и CI

```bash
node long-haul-legacy-2/tools/test_contracts.js
python3 long-haul-legacy-2/tools/generate_structures.py
python3 long-haul-legacy-2/tools/generate_worldgen.py
python3 long-haul-legacy-2/tools/generate_alpha_quests.py
python3 long-haul-legacy-2/tools/assemble_alpha.py --profile long-haul-legacy-2/profiles/alpha9.json
python3 long-haul-legacy-2/tools/generate_modlist.py
python3 long-haul-legacy-2/tools/prepare_server.py --mode void
python3 long-haul-legacy-2/tools/build_runtime.py
python3 long-haul-legacy-2/tools/inspect_alpha.py
python3 long-haul-legacy-2/tools/smoke_server.py --heap 4096 --timeout 450 --world-label "alpha8 void integration test"
python3 long-haul-legacy-2/tools/prepare_server.py --mode normal --skip-forge-install
python3 long-haul-legacy-2/tools/smoke_server.py --heap 6144 --timeout 780 --world-label "alpha8 normal overworld test"
python3 long-haul-legacy-2/tools/package_alpha.py --version 2.0-alpha.8
```

Срез выбора версий — **19.11.2026**. Полный цикл сборки и оба smoke-теста автоматизированы в `.github/workflows/ci.yml`.
