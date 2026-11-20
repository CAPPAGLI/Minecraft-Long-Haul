# Long Haul Legacy 2.0 — Alpha 11 (`2.0-alpha.11`)

**Расширенная серверно-проверенная альфа сборки, НЕ финальный релиз по полному ТЗ.** Импортируемый `.mrpack` предназначен для отдельного тестового профиля и нового обычного мира. Рабочая 1.1.1 не изменена. Исторические снимки прошлых альф сохранены в `history/alpha.1/` – `history/alpha.11/`.

## Что нового в `2.0-alpha.11`

- **Квотирование чанклоадинга по активным маршрутам (`16_routes_and_camps.js`, `/lh route quota|abort`):**
  - Введено жёсткое серверное ограничение `LH_ROUTE_MAX_ANCHORS = 2` на одного игрока: во время активного рейса по зарегистрированному маршруту автоматически якорятся только до 2 чанков коридора (текущие и следующие ворота) через `forceload`, без безлимитной прогрузки вагонов.
  - При завершении маршрута, прерывании (`/lh route abort`) или нарушении лимита скорости телепортацией чанки немедленно освобождаются (`forceload remove`).
- **Расширение модпака до `398` внешних Modrinth JAR / `465` mod ID (+`longhaul-runtime` = `399` JAR / `466` ID):**
  - **Картография, разведка и данжи:** `Map Atlases` (`map-atlases-forge`), `Lootr` (индивидуальный лут в сундуках для мультиплеера), `Aquamirae` + `Obscure API`, `Repurposed Structures`, `Exposure` (экспедиционная камера и фото).
  - **Индустрия Create 6 и инфраструктура:** `Create: Enchantment Industry`, `Create: Central Kitchen`, `Create Deco`, `Iron Furnaces`, `Torchmaster`, `Macaw's Stairs`, `AttributeFix`.
  - **Экспедиционный быт и провизия:** `Comforts` (спальные мешки и гамаки без перезаписи точки возрождения), `Nether's Delight`, `Ocean's Delight`, `Brewin' And Chewin'`.
  - **QoL, интерфейс и клиентская производительность:** `Akashic Tome`, `TrashSlot`, `BetterF3`, `Dynamic Lights`, `Presence Footsteps`, `Jade Addons`, `Just Enough Resources (JER)`, `NetherPortalFix`, `Easy Anvils`, `Easy Magic`, `Enchanting Infuser`, `Trading Post`.
- *(Унаследовано из `2.0-alpha.10`)* Выбросы Death Stranding Voidout + трупы `Corpse`, летающие острова (`Y=172..212`) и сезонный поднимающийся токсичный газ (`Y=114`), жёсткий `AdPother` + `Advanced Chimneys`, `Primal Magick` + `Thaumon`, `ParCool!`, запрет саженцев, 10× снижение руд и 320 квестов Heracles.

Профиль сборки: `profiles/alpha11.json` (динамически разрешаемый список и хэши в CI → артефакт `Long-Haul-Legacy-2.0-alpha.11.mrpack` и `Long-Haul-Legacy-2.0-alpha.11-Sources-and-Report.zip`). Подробности проверки: `TEST-REPORT.md`, машинный статус: `STATUS.json`.

## Установка тестового профиля

1. Соберите или скачайте `Long-Haul-Legacy-2.0-alpha.11.mrpack` (артефакт CI `long-haul-legacy-2.0-alpha.11`, либо локально: `python tools/assemble_alpha.py --profile profiles/alpha11.json --lock-only && python tools/generate_modlist.py && python tools/package_alpha.py --version 2.0-alpha.11 --skip-jar-bytes-check`, либо без `--lock-only`/`--skip-jar-bytes-check` для полной локальной проверки SHA-512). Не смешивайте с `1.1.1`.
2. Импортируйте в Prism Launcher или совместимый лаунчер.
3. Выберите **Java 17** и начните с **8–10 ГБ RAM** (на системе с 32 ГБ RAM; не выделяйте всю память).
4. Создайте **новый обычный мир**.

## Основные команды `/lh`

- `/lh help` — справка по командам.
- `/lh prospect`, `/lh snail status`, `/lh gas status` — геологоразведка редких рудных чанков, статус Бессмертной Улитки и уровень сезонного токсичного газа.
- `/lh terminal`, `/lh accept <id>`, `/lh status`, `/lh abort`, `/lh team <join|leave> [имя]` — приёмка и кооперативные контракты.
- `/lh stage`, `/lh vehicle status` — текущая промышленная стадия GameStages и одометр транспорта.
- `/lh catalog list|stage <1..4>|info <id>|verify <id>` — просмотр и серверная проверка 240 заказов каталога.
- `/lh sites`, `/lh site info <id>`, `/lh site commission <id>`, `/lh site produce <id> <bootstrap|industrial>`, `/lh site archive`, `/lh site repair_archive` — разведка, ввод в строй, ремонт архива и локальное производство на 10 стратегических узлах.
- `/lh recovery list|info|survey|restore` — обследование и восстановление 6 разрушенных объектов.
- `/lh photo report|status`, `/lh cc challenge|verify|status` — полевые фотоотчёты Exposure и телеметрия CC: Tweaked.
- `/lh camp deploy|pack|list`, `/lh route begin|gate|finish|start|abort|quota|list`, `/lh cargo issue|deliver` — лагеря, маршруты без телепортации с квотой чанклоадинга (`<= 2`) и серверные грузовые накладные.

## Что ещё осталось до финального релиза

| Требование | Состояние `2.0-alpha.11` |
|---|---|
| ~500 полезных модов | В процессе: 398 внешних JAR / 465 mod ID (расширение к ~500 за счёт совместимых модов) |
| Клиентское, графическое и транспортное тестирование | Не пройдено: проверен только headless Linux-сервер (void + обычный Overworld) |
| Полная интеграция всех 240 спецификаций из `design/quest-catalog.*` | Реализовано в Heracles (320 квестов, 12 групп, 300 advancement) и сервере (`/lh catalog`, все 19 `verification_type` + сюжет «Ушёл за хлебом») |
| Физические NBT-структуры городов и объектов восстановления | Реализованы 18 `.nbt` шаблонов (16 узлов/руин `11×7×11` + 2 летающих острова `15×14×15`) + авторазмещение и ремонт архива |
| Проверка физики поездов/кораблей VS в клиенте | Не проведена в графическом клиенте |

## Воспроизведение и CI

```bash
node long-haul-legacy-2/tools/test_contracts.js
python3 long-haul-legacy-2/tools/generate_structures.py
python3 long-haul-legacy-2/tools/generate_worldgen.py
python3 long-haul-legacy-2/tools/generate_alpha_quests.py
python3 long-haul-legacy-2/tools/assemble_alpha.py --profile long-haul-legacy-2/profiles/alpha11.json
python3 long-haul-legacy-2/tools/generate_modlist.py
python3 long-haul-legacy-2/tools/prepare_server.py --mode void
python3 long-haul-legacy-2/tools/build_runtime.py
python3 long-haul-legacy-2/tools/inspect_alpha.py
python3 long-haul-legacy-2/tools/smoke_server.py --heap 4096 --timeout 450 --world-label "alpha11 void integration test"
python3 long-haul-legacy-2/tools/prepare_server.py --mode normal --skip-forge-install
python3 long-haul-legacy-2/tools/smoke_server.py --heap 6144 --timeout 780 --world-label "alpha11 normal overworld test"
python3 long-haul-legacy-2/tools/package_alpha.py --version 2.0-alpha.11
```

Срез выбора версий — **19.11.2026**. Полный цикл сборки и оба smoke-теста автоматизированы в `.github/workflows/ci.yml`.
