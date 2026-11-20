# Long Haul Legacy 2.0 — Alpha 5 (`2.0-alpha.5`)

**Расширенная серверно-проверенная альфа сборки, НЕ финальный релиз по полному ТЗ.** Импортируемый `.mrpack` предназначен для отдельного тестового профиля и нового обычного мира. Рабочая 1.1.1 не изменена. Исторические снимки прошлых альф сохранены в `history/alpha.1/`, `history/alpha.2/`, `history/alpha.3/` и `history/alpha.4/`.

## Что нового в `2.0-alpha.5`

- **361 внешний JAR (290 серверных / 71 только клиентских) + 1 собственный `longhaul-runtime-1.20.1-0.1.0.jar`** (`873,552,658` байт внешних загрузок с Modrinth CDN, **429 объявленных mod ID** включая вложенные зависимости, 0 отсутствующих зависимостей, 0 конфликтов версий Maven).
- **Ролевые `11×7×11` `.nbt` структуры всех 16 объектов (`tools/generate_structures.py` + `15_sites_and_economy.js`):**
  - `overrides/kubejs/data/longhaul/structures/sites/*.nbt` — 10 стратегических узлов с уникальной архитектурой и инвентарным наполнением под роль (`forest` лесопилка со штабелями, `mine` копер с рудой и рельсами, `quarry` каменный бункер, `farm` сеновал и оросительный лоток, `glass` плавильня со стеклом, `swamp` свайный настил, `port` пристань, `machines` сборочный цех, `continental_archive` архивный монумент с кафедрами и книгами, `continental_hub` командный холл), цоколь `[-5..5]` и депо-бочка строго в центре `(5, 1, 5)`.
  - `overrides/kubejs/data/longhaul/structures/recovery/*.nbt` — 6 разрушенных объектов с ролевыми руинами (`sawmill`, `quarry`, `river_port`, `sorting_yard`, `power_plant`, `collapsed_bridge`).
- **Логистические рецепты и защита от обхода (`20_basics.js` + `21_economy_recipes.js`):**
  - `minecraft:bundle` (узелок на 64 предмета для этапа I до вагонов/поездов), массовая сборка `24x minecraft:rail` из `create:iron_sheet` и `8x minecraft:powered_rail` из `create:golden_sheet` для магистралей на карте `175 000 × 175 000` без возможности обходить локальное производство `longhaul:*` на узлах.
  - Блокировка `functionalstorage:ender_drawer` (рецепты, лут, установка и ПКМ) в дополнение к шалкерам, `minecraft:ender_chest`, `supplementaries:sack`/`safe` и `quark:backpack`.
- **Исправления серверного верификатора (`19_catalog_orders.js` + расширенный `99_integration_test.js`):**
  - Исправлен вызов `lhFindNearbyComputer` для заказов типа `computer_challenge` (`engineering_cc_01`, `main_3_04`), расширено покрытие `99_integration_test.js` (`camp_visit`, `computer_challenge`, проверка всех 37 241 рецептов `RecipeManager`).
- **Расширение модпака (+24 внешних JAR / +65 mod ID относительно `alpha.4`):**
  - **Индустрия, структуры и NPC:** `functional-storage` (локальные ящики без `ender_drawer`), `structurify`, `easy-npc`.
  - **Оптимизация и серверный QoL:** `fastfurnace`, `does-it-tick`, `corpse`, `better-spawner-control`, `paxi`, `entityjs`, `game-stages`, `recipe-stages`, `item-stages`.
  - **Клиентский полиш (`client_only`):** `just-zoom`, `fancymenu`, `drippy-loading-screen`, `resource-pack-overrides` (+ `melody`, `konkrete` только на клиенте).
- **Без космоса и температурных модов.** `DOOMED` не включён; инструкция по необязательной ручной установке находится в `DOOMED.md`.

Профиль сборки: `profiles/alpha5.json` (динамически разрешаемый список и хэши в CI → артефакт `Long-Haul-Legacy-2.0-alpha.5.mrpack` и `Long-Haul-Legacy-2.0-alpha.5-Sources-and-Report.zip`). Подробности проверки: `TEST-REPORT.md`, машинный статус: `STATUS.json`.

## Установка тестового профиля

1. Соберите или скачайте `Long-Haul-Legacy-2.0-alpha.5.mrpack` (артефакт CI `long-haul-legacy-2.0-alpha.5`, либо локально: `python tools/assemble_alpha.py --profile profiles/alpha5.json --lock-only && python tools/generate_modlist.py && python tools/package_alpha.py --version 2.0-alpha.5 --skip-jar-bytes-check`, либо без `--lock-only`/`--skip-jar-bytes-check` для полной локальной проверки SHA-512). Не смешивайте с `1.1.1`.
2. Импортируйте в Prism Launcher или совместимый лаунчер.
3. Выберите **Java 17** и начните с **8–10 ГБ RAM** (на системе с 32 ГБ RAM; не выделяйте всю память).
4. Создайте **новый обычный мир**.

## Основные команды `/lh`

- `/lh help` — справка по командам.
- `/lh terminal`, `/lh accept <id>`, `/lh status`, `/lh abort`, `/lh share <player>` — приёмка и кооперативные контракты.
- `/lh catalog list|stage <1..4>|info <id>|verify <id>` — просмотр и серверная проверка 240 заказов каталога.
- `/lh sites`, `/lh site info <id>`, `/lh site commission <id>`, `/lh site produce <id> <bootstrap|industrial>`, `/lh site archive`, `/lh site repair_archive` — разведка, ввод в строй, ремонт архива и локальное производство на 10 стратегических узлах.
- `/lh recovery list|info|survey|restore` — обследование и восстановление 6 разрушенных объектов.
- `/lh photo report|status`, `/lh cc challenge|verify|status` — полевые фотоотчёты Exposure и телеметрия CC: Tweaked.
- `/lh camp deploy|pack|list`, `/lh route begin|gate|finish|start|list`, `/lh cargo issue|deliver` — лагеря, маршруты без телепортации и серверные грузовые накладные.

## Что ещё осталось до финального релиза

| Требование | Состояние `2.0-alpha.5` |
|---|---|
| ~500 полезных модов | В процессе: 361 внешний JAR / 429 mod ID (следующий шаг — безопасные аддоны Create 6 и совместимые структурные/атмосферные моды к ~500) |
| Клиентское, графическое и транспортное тестирование | Не пройдено: проверен только headless Linux-сервер (void + обычный Overworld) |
| Полная интеграция всех 240 спецификаций из `design/quest-catalog.*` | Реализовано в Heracles (311 квестов, 11 групп, 294 advancement) и сервере (`/lh catalog`) |
| Физические NBT-структуры городов и объектов восстановления | Реализованы 16 ролевых `11×7×11` `.nbt` шаблонов + авторазмещение и ремонт архива |
| Проверка физики поездов/кораблей VS в клиенте | Не проведена в графическом клиенте |

## Воспроизведение и CI

```bash
node long-haul-legacy-2/tools/test_contracts.js
python3 long-haul-legacy-2/tools/generate_structures.py
python3 long-haul-legacy-2/tools/generate_alpha_quests.py
python3 long-haul-legacy-2/tools/assemble_alpha.py --profile long-haul-legacy-2/profiles/alpha5.json
python3 long-haul-legacy-2/tools/generate_modlist.py
python3 long-haul-legacy-2/tools/prepare_server.py --mode void
python3 long-haul-legacy-2/tools/build_runtime.py
python3 long-haul-legacy-2/tools/inspect_alpha.py
python3 long-haul-legacy-2/tools/smoke_server.py --heap 4096 --timeout 450 --world-label "alpha5 void integration test"
python3 long-haul-legacy-2/tools/prepare_server.py --mode normal --skip-forge-install
python3 long-haul-legacy-2/tools/smoke_server.py --heap 6144 --timeout 780 --world-label "alpha5 normal overworld test"
python3 long-haul-legacy-2/tools/package_alpha.py --version 2.0-alpha.5
```

Срез выбора версий — **19.11.2026**. Полный цикл сборки и оба smoke-теста автоматизированы в `.github/workflows/ci.yml`.
