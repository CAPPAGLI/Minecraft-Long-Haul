# Long Haul Legacy 2.0 — Alpha 6 (`2.0-alpha.6`)

**Расширенная серверно-проверенная альфа сборки, НЕ финальный релиз по полному ТЗ.** Импортируемый `.mrpack` предназначен для отдельного тестового профиля и нового обычного мира. Рабочая 1.1.1 не изменена. Исторические снимки прошлых альф сохранены в `history/alpha.1/` – `history/alpha.5/`.

## Что нового в `2.0-alpha.6`

- **368 внешних JAR (296 серверных / 72 только клиентских) + 1 собственный `longhaul-runtime-1.20.1-0.1.0.jar`** (`879,321,974` байт внешних загрузок с Modrinth CDN, **436 объявленных mod ID** включая вложенные зависимости, 0 отсутствующих зависимостей, 0 конфликтов версий Maven).
- **4-этапная прогрессия GameStages (`22_stage_progression.js`):**
  - Этапы `longhaul_stage_1` … `longhaul_stage_4` и `longhaul_finale` синхронизируются с `GameStages`, сохраняются в `server.persistentData` и обновляются по реальным запускам узлов, восстановлениям объектов, ритм-контрактам и CC-испытаниям; добавлена команда `/lh stage`.
- **Серверная телеметрия транспорта с шагом 1 Гц (`23_vehicle_telemetry.js`):**
  - Раз в секунду (без сканирования мира на каждом тике) учитывает реальный пробег и время по семействам (`rail`, `road_vehicle`, `cart`, `watercraft`, `aircraft_vs`, `mount`, `foot`) с отсечением телепортационных скачков (`> 96 м/с` или `> 180 м`); добавлена команда `/lh vehicle status`.
- **Заводские конфиги и защита от тупиков/эксплойтов (`overrides/defaultconfigs/`, `20_basics.js`, `21_economy_recipes.js`):**
  - Проверенный `vs-core-server.toml` включён прямо в `overrides/defaultconfigs/valkyrienskies/vs-core-server.toml` для новых миров из `.mrpack`.
  - В `21_economy_recipes.js` добавлена выделка кожи из гнилой плоти в коптильне и на костре (`longhaul:cure_leather_smoking`, `longhaul:cure_leather_campfire`), чтобы ранние походные узелки, повозки и ленты Create никогда не зависали в биомах без коров.
  - В `20_basics.js` автоматически удаляются все рецепты `*jetpack*` (проверено полным сканом всех `37 465` рецептов в `RecipeManager`), наряду с запретом шалкеров, эндер-сундуков, мешков и `functionalstorage:ender_drawer`.
- **Расширение модпака (+7 внешних JAR / +7 mod ID относительно `alpha.5`):**
  - `create-stuff-additions` (без джетпаков), `create-liquid-fuel`, `create-confectionery`, `smooth-boot-reloaded`, `default-server-properties`, `simple-discord-rpc` (`client_only`).
  - Pre-Create-6 `clockwork-additions` отброшен при проверке совместимости; `create-contraption-terminals` и `create-stock-bridge` отклонены до сборки из-за скрытых зависимостей на `toms-storage` и `appliedenergistics2`.
- **Без космоса и температурных модов.** `DOOMED` не включён; инструкция по необязательной ручной установке находится в `DOOMED.md`.

Профиль сборки: `profiles/alpha6.json` (динамически разрешаемый список и хэши в CI → артефакт `Long-Haul-Legacy-2.0-alpha.6.mrpack` и `Long-Haul-Legacy-2.0-alpha.6-Sources-and-Report.zip`). Подробности проверки: `TEST-REPORT.md`, машинный статус: `STATUS.json`.

## Установка тестового профиля

1. Соберите или скачайте `Long-Haul-Legacy-2.0-alpha.6.mrpack` (артефакт CI `long-haul-legacy-2.0-alpha.6`, либо локально: `python tools/assemble_alpha.py --profile profiles/alpha6.json --lock-only && python tools/generate_modlist.py && python tools/package_alpha.py --version 2.0-alpha.6 --skip-jar-bytes-check`, либо без `--lock-only`/`--skip-jar-bytes-check` для полной локальной проверки SHA-512). Не смешивайте с `1.1.1`.
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

| Требование | Состояние `2.0-alpha.6` |
|---|---|
| ~500 полезных модов | В процессе: 368 внешних JAR / 436 mod ID (расширение к ~500 за счёт новых совместимых модов) |
| Клиентское, графическое и транспортное тестирование | Не пройдено: проверен только headless Linux-сервер (void + обычный Overworld) |
| Полная интеграция всех 240 спецификаций из `design/quest-catalog.*` | Реализовано в Heracles (311 квестов, 11 групп, 294 advancement) и сервере (`/lh catalog`) |
| Физические NBT-структуры городов и объектов восстановления | Реализованы 16 ролевых `11×7×11` `.nbt` шаблонов + авторазмещение и ремонт архива |
| Проверка физики поездов/кораблей VS в клиенте | Не проведена в графическом клиенте |

## Воспроизведение и CI

```bash
node long-haul-legacy-2/tools/test_contracts.js
python3 long-haul-legacy-2/tools/generate_structures.py
python3 long-haul-legacy-2/tools/generate_alpha_quests.py
python3 long-haul-legacy-2/tools/assemble_alpha.py --profile long-haul-legacy-2/profiles/alpha6.json
python3 long-haul-legacy-2/tools/generate_modlist.py
python3 long-haul-legacy-2/tools/prepare_server.py --mode void
python3 long-haul-legacy-2/tools/build_runtime.py
python3 long-haul-legacy-2/tools/inspect_alpha.py
python3 long-haul-legacy-2/tools/smoke_server.py --heap 4096 --timeout 450 --world-label "alpha6 void integration test"
python3 long-haul-legacy-2/tools/prepare_server.py --mode normal --skip-forge-install
python3 long-haul-legacy-2/tools/smoke_server.py --heap 6144 --timeout 780 --world-label "alpha6 normal overworld test"
python3 long-haul-legacy-2/tools/package_alpha.py --version 2.0-alpha.6
```

Срез выбора версий — **19.11.2026**. Полный цикл сборки и оба smoke-теста автоматизированы в `.github/workflows/ci.yml`.
