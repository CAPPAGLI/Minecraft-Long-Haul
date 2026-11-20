# Long Haul Legacy 2.0 — Alpha 8 (`2.0-alpha.8`)

**Расширенная серверно-проверенная альфа сборки, НЕ финальный релиз по полному ТЗ.** Импортируемый `.mrpack` предназначен для отдельного тестового профиля и нового обычного мира. Рабочая 1.1.1 не изменена. Исторические снимки прошлых альф сохранены в `history/alpha.1/` – `history/alpha.7/`.

## Что нового в `2.0-alpha.8`

- **Честная серверная верификация всех 19 `verification_type` из `design/quest-catalog.json` (`19_catalog_orders.js`, `23_vehicle_telemetry.js`):**
  - `vehicle_delivery` (28 заказов) и `vehicle_trial` (2 заказа) требуют реальный пробег нужного семейства транспорта (`rail`, `watercraft`, `aircraft_vs`, `cart`, `road_vehicle`, `mount`, включая `smallships:*`, `immersive_aircraft:*`, `man_of_many_planes:*`) в `23_vehicle_telemetry.js` + приёмку в бочке.
  - `scheduled_train` (10 заказов) требует зафиксированный ЖД-пробег (`>= 100` м) или завершённый ЖД-рейс по маршруту + приёмку груза.
  - `network_supply` (12 заказов) требует фактического ввода в строй нужного числа региональных узлов (`distinct_regions`), `sample_return` — подтверждённые фотоотчёты Exposure и активные узлы, `delivery`/`multi_input_supply` — разнообразие различных предметов (`distinct_inputs`), а `ration_delivery` — съедобные рационы.
- **Усиленный контроль границы мира `175000` и запрет переносных хранилищ (`10_contracts.js`, `20_basics.js`, `smoke_server.py`):**
  - Граница мира `175000 × 175000` выставляется напрямую через Java API `WorldBorder` (`setCenter(0, 0)`, `setSize(175000)`) и проверяется как в `99_integration_test.js`, так и в `smoke_server.py` (`world_border_175000: true`).
  - В `20_basics.js` добавлен запрет установки (`BlockEvents.placed`) для `minecraft:ender_chest` и всех 17 `shulker_box`, а также использования (`ItemEvents.rightClicked`) для `quark:backpack` и `functionalstorage:ender_drawer`.
- **Расширение и аудит совместимости модов (`370` внешних JAR / `439` mod ID):**
  - Добавлены **`ends-delight`** (`2.6.1+forge.1.20.1`, закрывает опциональную совместимость с `create_central_kitchen` и `delightful`) и **`timeless-and-classics-zero`** (`1.2.0-hotfix`, TaCZ).
  - При проверке на живом Forge отклонены `subtle-effects` (требует `forge >= 47.4.14`), `every-compat` (+18.8 тыс. рецептов и GC-перегрузка в 4 ГБ RAM) и `villager-recruits` (ломает ранний `CommandEvent` через `NullPointerException`).
  - Без космоса и температурных модов (`DOOMED` не включён; инструкция в `DOOMED.md`).

Профиль сборки: `profiles/alpha8.json` (динамически разрешаемый список и хэши в CI → артефакт `Long-Haul-Legacy-2.0-alpha.8.mrpack` и `Long-Haul-Legacy-2.0-alpha.8-Sources-and-Report.zip`). Подробности проверки: `TEST-REPORT.md`, машинный статус: `STATUS.json`.

## Установка тестового профиля

1. Соберите или скачайте `Long-Haul-Legacy-2.0-alpha.8.mrpack` (артефакт CI `long-haul-legacy-2.0-alpha.8`, либо локально: `python tools/assemble_alpha.py --profile profiles/alpha8.json --lock-only && python tools/generate_modlist.py && python tools/package_alpha.py --version 2.0-alpha.8 --skip-jar-bytes-check`, либо без `--lock-only`/`--skip-jar-bytes-check` для полной локальной проверки SHA-512). Не смешивайте с `1.1.1`.
2. Импортируйте в Prism Launcher или совместимый лаунчер.
3. Выберите **Java 17** и начните с **8–10 ГБ RAM** (на системе с 32 ГБ RAM; не выделяйте всю память).
4. Создайте **новый обычный мир**.

## Основные команды `/lh`

- `/lh help` — справка по командам.
- `/lh terminal`, `/lh accept <id>`, `/lh status`, `/lh abort`, `/lh team <join|leave> [имя]` — приёмка и кооперативные контракты.
- `/lh stage`, `/lh vehicle status` — текущая промышленная стадия GameStages и одометр транспорта.
- `/lh catalog list|stage <1..4>|info <id>|verify <id>` — просмотр и серверная проверка 240 заказов каталога.
- `/lh sites`, `/lh site info <id>`, `/lh site commission <id>`, `/lh site produce <id> <bootstrap|industrial>`, `/lh site archive`, `/lh site repair_archive` — разведка, ввод в строй, ремонт архива и локальное производство на 10 стратегических узлах.
- `/lh recovery list|info|survey|restore` — обследование и восстановление 6 разрушенных объектов.
- `/lh photo report|status`, `/lh cc challenge|verify|status` — полевые фотоотчёты Exposure и телеметрия CC: Tweaked.
- `/lh camp deploy|pack|list`, `/lh route begin|gate|finish|start|list`, `/lh cargo issue|deliver` — лагеря, маршруты без телепортации и серверные грузовые накладные.

## Что ещё осталось до финального релиза

| Требование | Состояние `2.0-alpha.8` |
|---|---|
| ~500 полезных модов | В процессе: 370 внешних JAR / 439 mod ID (расширение к ~500 за счёт новых совместимых модов) |
| Клиентское, графическое и транспортное тестирование | Не пройдено: проверен только headless Linux-сервер (void + обычный Overworld) |
| Полная интеграция всех 240 спецификаций из `design/quest-catalog.*` | Реализовано в Heracles (311 квестов, 11 групп, 294 advancement) и сервере (`/lh catalog`, все 19 `verification_type`) |
| Физические NBT-структуры городов и объектов восстановления | Реализованы 16 ролевых `11×7×11` `.nbt` шаблонов + авторазмещение и ремонт архива |
| Проверка физики поездов/кораблей VS в клиенте | Не проведена в графическом клиенте |

## Воспроизведение и CI

```bash
node long-haul-legacy-2/tools/test_contracts.js
python3 long-haul-legacy-2/tools/generate_structures.py
python3 long-haul-legacy-2/tools/generate_alpha_quests.py
python3 long-haul-legacy-2/tools/assemble_alpha.py --profile long-haul-legacy-2/profiles/alpha8.json
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
