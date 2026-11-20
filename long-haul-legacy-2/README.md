# Long Haul Legacy 2.0 — Alpha 4 (`2.0-alpha.4`)

**Расширенная серверно-проверенная альфа сборки, НЕ финальный релиз по полному ТЗ.** Импортируемый `.mrpack` предназначен для отдельного тестового профиля и нового обычного мира. Рабочая 1.1.1 не изменена. Исторические снимки прошлых альф сохранены в `history/alpha.1/`, `history/alpha.2/` и `history/alpha.3/`.

## Что нового в `2.0-alpha.4`

- **337 внешних JAR (270 серверных / 67 только клиентских) + 1 собственный `longhaul-runtime-1.20.1-0.1.0.jar`** (`819,540,941` байт внешних загрузок с Modrinth CDN, **364 объявленных mod ID** включая вложенные зависимости, 0 отсутствующих зависимостей, 0 конфликтов версий Maven).
- **Все 16 физических `.nbt` структур городов и объектов восстановления** (`DataVersion: 3465`, `9×6×9`, с реальной бочкой депо в центре `(4, 1, 4)`):
  - `overrides/kubejs/data/longhaul/structures/sites/*.nbt` — все 10 стратегических узлов (`forest`, `mine`, `quarry`, `farm`, `glass`, `swamp`, `chemical`, `machines`, `continental_archive`, `continental_hub`), идемпотентно возводятся на поверхности при приближении игрока (`<= 144` блоков) или вводе в строй; `/lh site repair_archive` восстанавливает постройки `continental_archive` без повторных наград.
  - `overrides/kubejs/data/longhaul/structures/recovery/*.nbt` — 6 разрушенных промышленных объектов (`sawmill`, `quarry_pit`, `river_port`, `sorting_yard`, `power_station`, `collapsed_bridge`), разворачиваются при `/lh recovery survey <id>`.
- **Полная интеграция всех 240 спецификаций из `design/quest-catalog.*`:**
  - **311 установленных квестов Heracles** (11 групп: 71 базовый квест + 240 заказов каталога across 4 стадии, 8 инженерных веток, 10 региональных линий, экспедиции, фотоотчёты Exposure и инфраструктуру CC: Tweaked).
  - **294 серверных advancement** в `kubejs/data/longhaul/advancements/`.
  - **Серверный верификатор каталога** (`startup_scripts/02_quest_catalog.js` + `server_scripts/19_catalog_orders.js`): `/lh catalog list|stage|info|verify` с честной проверкой сдачи предметов из бочки депо (без чтения инвентаря игрока), координат узлов, фото Exposure, маяков/периферии CC: Tweaked, маршрутов и этапов восстановления.
- **Расширение модпака (+71 JAR относительно `alpha.3`):**
  - **Транспорт, логистика, индустрия:** Create `6.0.8` + аддоны `6.0.6+` (`create-mechanical-extruder`, `create-sifting`, `create-big-cannons`, `create-deco-additions`), `ultimate-car-mod`, `super-factory-manager`, `modular-routers`, `integrated-dynamics`, `iron-chests`, `iron-barrels` (шалкеры, эндер-сундуки, `supplementaries:sack`, `supplementaries:safe` и `quark:backpack` заблокированы).
  - **Мир, биомы и подземелья:** добавлены `alexs-caves`, `hopo-better-mineshaft`, `hopo-better-underwater-ruins`, `hopo-better-ruined-portals`, `stony-cliffs-are-cool`, `when-dungeons-arise`, `when-dungeons-arise-seven-seas`, `guard-villagers`, `illager-invasion`, `mutant-monsters`, `mowzies-mobs`, `the-conjurer`, `nether-depths-upgrade`, `snowy-spirit`, `immersive-weathering`, `snow-real-magic`, `snow-under-trees`.
  - **Еда, строительство, боевые/QoL-инструменты и клиентские улучшения:** `enders-delight`, `collectors-reap`, `ubes-delight`, `chefs-delight`, `butchers-delight`, `pineapple-delight`, `casualness-delight`, `oceanic-delight`, `aquaculture-delight`, `productivebees`, `fruit-trees`, `culinary-construct`, `diet`, `buildersaddition`, `building-but-better`, `stoneworks`/`woodworks`/`clayworks`, `effortless-building`, `tetra` + `tetra-extras`, `simply-swords`, `immersive-armors`, `combat-roll`, `natures-compass`, `explorers-compass`, аддоны EMI/JEI/визуальные моды с пометкой `client_only`.
- **Без космоса и температурных модов.** `DOOMED` не включён; инструкция по необязательной ручной установке находится в `DOOMED.md`.

Профиль сборки: `profiles/alpha4.json` (динамически разрешаемый список и хэши в CI → артефакт `Long-Haul-Legacy-2.0-alpha.4.mrpack` и `Long-Haul-Legacy-2.0-alpha.4-Sources-and-Report.zip`). Подробности проверки: `TEST-REPORT.md`, машинный статус: `STATUS.json`.

## Установка тестового профиля

1. Соберите или скачайте `Long-Haul-Legacy-2.0-alpha.4.mrpack` (артефакт CI `long-haul-legacy-2.0-alpha.4`, либо локально: `python tools/assemble_alpha.py --profile profiles/alpha4.json --lock-only && python tools/generate_modlist.py && python tools/package_alpha.py --version 2.0-alpha.4 --skip-jar-bytes-check`, либо без `--lock-only`/`--skip-jar-bytes-check` для полной локальной проверки SHA-512). Не смешивайте с `1.1.1`.
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

| Требование | Состояние `2.0-alpha.4` |
|---|---|
| ~500 полезных модов | В процессе: 337 внешних JAR / 364 mod ID (следующий этап расширения к ~500) |
| Клиентское, графическое и транспортное тестирование | Не пройдено: проверен только headless Linux-сервер (void + обычный Overworld) |
| Полная интеграция всех 240 спецификаций из `design/quest-catalog.*` | Реализовано в Heracles (311 квестов, 11 групп, 294 advancement) и сервере (`/lh catalog`) |
| Физические NBT-структуры городов и объектов восстановления | Реализованы 16 `9×6×9` `.nbt` шаблонов + авторазмещение и ремонт архива |
| Проверка физики поездов/кораблей VS в клиенте | Не проведена в графическом клиенте |

## Воспроизведение и CI

```bash
node long-haul-legacy-2/tools/test_contracts.js
python3 long-haul-legacy-2/tools/generate_structures.py
python3 long-haul-legacy-2/tools/generate_alpha_quests.py
python3 long-haul-legacy-2/tools/assemble_alpha.py --profile long-haul-legacy-2/profiles/alpha4.json
python3 long-haul-legacy-2/tools/generate_modlist.py
python3 long-haul-legacy-2/tools/prepare_server.py --mode void
python3 long-haul-legacy-2/tools/build_runtime.py
python3 long-haul-legacy-2/tools/inspect_alpha.py
python3 long-haul-legacy-2/tools/smoke_server.py --heap 4096 --timeout 450 --world-label "alpha4 void integration test"
python3 long-haul-legacy-2/tools/prepare_server.py --mode normal --skip-forge-install
python3 long-haul-legacy-2/tools/smoke_server.py --heap 4096 --timeout 600 --world-label "alpha4 normal overworld test"
python3 long-haul-legacy-2/tools/package_alpha.py --version 2.0-alpha.4
```

Срез выбора версий — **15.11.2026**. Полный цикл сборки и оба smoke-теста автоматизированы в `.github/workflows/ci.yml`.
