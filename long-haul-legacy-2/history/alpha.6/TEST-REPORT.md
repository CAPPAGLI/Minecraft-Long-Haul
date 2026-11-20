# Long Haul Legacy 2.0 — Alpha 6 — протокол проверки

## Итог

**Оба headless-теста на выделенном сервере Forge 47.4.10 (`void` и обычный Overworld с Terralith + Tectonic + Biomes O' Plenty + Regions Unexplored + Alex's Caves + YUNG's + IDAS + Dungeons and Taverns + When Dungeons Arise + Structory + Formations + Towns & Towers + Structurify) пройдены в GitHub Actions (run `44782816968`, commit `f047b7f`, `16m7s`). Графический клиент и физика транспорта в движении ещё не проверены.**

Финальные результаты из CI (`44782816968`):

- **Inspect JARs:** `368` внешних JAR (`296` серверных / `72` только клиентских) + `1` собственный `longhaul-runtime-1.20.1-0.1.0.jar`, `436` mod ID включая вложенные зависимости, **`Missing: 0`**, **`Range mismatches: 0`**.
- **Void integration test (`--heap 4096`):** `ready: true, exit_code: 0, integration_pass: true, integration_fail: false, clean_exit: true`.
- **Normal Overworld generation test (`--heap 6144`):** `ready: true, exit_code: 0, integration_pass: true, integration_fail: false, clean_exit: true` (генерация Overworld/Nether/End со всеми биомными и структурными модами включая `alexs-caves` и `structurify`, граница мира `175000`, планирование 10 узлов и 6 объектов восстановления в `±84000`, установка и проверка ролевых `11×7×11` `.nbt` структур, выполнение всех серверных тестов и штатное сохранение).
- **KubeJS:** `3/3` startup-скриптов и `11/11` server-скриптов загружены с `0` ошибок и `0` предупреждений (`37,465` рецептов).
- **Упаковка:** `Long-Haul-Legacy-2.0-alpha.6.mrpack` (`526,778` байт, `879,321,974` байт внешних загрузок), `Long-Haul-Legacy-2.0-alpha.6-Sources-and-Report.zip` (`1,087,885` байт).

Строка интеграционной проверки в обоих режимах:

```text
LH_INTEGRATION_PASS: items + contracts + shift + brigadier + sites + nbt_structures + archive_repair + production + recovery + photo + cc + camp + cargo + advancement sync
```

## Среда и состав проверки

- Minecraft `1.20.1`, Forge `47.4.10`, Java `17` (Temurin), Linux x86_64 (GitHub Actions runner).
- **368 внешних JAR + 1 собственный `longhaul-runtime-1.20.1-0.1.0.jar`** (`436` mod ID включая вложенные).
- **17/17 чистых JS-тестов** (`node long-haul-legacy-2/tools/test_contracts.js`): контракты приёмки, временны́е окна, JSON roundtrip, детерминированный планировщик 10 узлов и 6 объектов восстановления в `±84000`, валидатор маршрутов, граф экономики без циклических тупиков и индекс всех 240 заказов каталога.
- **16 ролевых `.nbt` структур** (`DataVersion: 3465`, `11×7×11`) сгенерированы и проверены `generate_structures.py`.
- **311 квестов Heracles** (11 групп: 71 базовый + 240 из `design/quest-catalog.json`) и **294 серверных advancement** сгенерированы и проверены `generate_alpha_quests.py`.

## Что подтверждено в живом Forge 47.4.10 (`99_integration_test.js`)

| Проверка | Результат |
|---|---|
| Регистрация предметов и текстур | 10 кастомных предметов `longhaul:*` + 10 16×16 текстур загружены без ошибок |
| Инвентарная бочка и контракты | Извлечение из настоящей бочки, выполнение `plates` и выдача квитанции |
| Временны́е окна и перезагрузка состояния | Живой `plate_shift` (3 окна), сброс `LHState = null` и восстановление из `server.persistentData` |
| Команды Brigadier `/lh` | Полная регистрация и живое выполнение команд (`/lh help`, `/lh sites`, `/lh site info`, `/lh camp list`, `/lh route list`, `/lh status`, `/lh recovery list`, `/lh photo status`, `/lh cc status`, `/lh catalog list|stage|info`, `/lh stage`, `/lh vehicle status`) |
| Ролевые `11×7×11` `.nbt` структуры и ремонт архива | `/place template longhaul:sites/forest` и `continental_archive`, проверка ролевых блоков (`spruce_planks`, `spruce_log`, `polished_deepslate`, `lectern`, `minecraft:barrel`), идемпотентный `/lh site repair_archive` |
| Каталог 240 заказов (`/lh catalog verify`) | Верификация `site_visit` (`region_forest_01`), `photo_evidence` (`photo_forest_arrival`), `camp_visit` (`expedition_02`), `computer_challenge` (`engineering_cc_01`), и честного списания из депо (`main_1_01`) |
| Логистические рецепты, стартовые тупики и запреты | Подтверждены `longhaul:expedition_bundle`, `longhaul:bulk_rail_from_sheets`, `longhaul:cure_leather_smoking`, `longhaul:cure_leather_campfire`; проверены все `37,465` рецептов в `RecipeManager` на отсутствие выхода `/jetpack/`, `minecraft:ender_chest`, `minecraft:shulker_box`, `supplementaries:sack`, `supplementaries:safe`, `quark:backpack`, `functionalstorage:ender_drawer` |
| 4-этапная прогрессия GameStages (`22_stage_progression.js`) | `lhStageRecompute` корректно открывает `longhaul_stage_1..3` по реальным введённым узлам и CC-испытаниям с сохранением в `server.persistentData` |
| Телеметрия транспорта (`23_vehicle_telemetry.js`) | 1-Hz сэмплер засчитывает `50` м поездки в `create:carriage_contraption` (`rail`) и отклоняет телепорт-скачок `5000` м (`rejectedJumps >= 1`) |
| Восстановление 6 промышленных объектов | `/lh recovery survey|restore` + размещение `longhaul:recovery/sawmill` `.nbt`, проверка наличия механизмов Create и материалов в бочке |
| Полевые фотоотчёты Exposure и телеметрия CC | `/lh photo report` отклоняет `minecraft:paper` и повторные токены; `/lh cc challenge|verify` проверяет `computercraft:computer_normal` и запас в депо |
| Экспедиционный лагерь и груз | Развёртывание/сворачивание лагеря, запрет сворачивания с непустой бочкой, выдача и доставка серверной накладной `/lh cargo` |
| Advancements и обычный Overworld | Синхронизация advancement на headless `ServerPlayer`; полная генерация и сохранение всех измерений при границе `175000` |

## Обнаруженные и устранённые проблемы в ходе `alpha.6`

1. **`clockwork-additions` (`0.0.7`):** удалён из `alpha6.json` — при загрузке Create `6.0.8` его Mixin падал с `ClassMetadataNotFoundException: com.simibubi.create.foundation.utility.Couple` (класс переехал в Catnip в Create 6, т.к. аддон собирался под Clockwork 0.1.x / Create 0.5.1).
2. **`create-contraption-terminals` и `create-stock-bridge`:** исключены до добавления в профиль — проверка кэша Modrinth показала обязательные зависимости `toms-storage` (`XZNI4Cpy`) и `appliedenergistics2` (`XxWD5pD3`).
3. **Удаление рецептов джетпаков:** `create-stuff-additions` добавлен с автоматическим удалением любых рецептов `*jetpack*` в `20_basics.js`, подтверждённым полным сканом `37,465` рецептов в `RecipeManager`.

## Что этот тест НЕ подтверждает

- Запуск графического клиента, импорт `.mrpack` в Prism Launcher, GUI Heracles, рендер Embeddium/Oculus/ImmediatelyFast/FancyMenu/DrippyLoadingScreen и работу голоса/камеры.
- Физику и управление поездами Create, кораблями Valkyrien Skies/Eureka/Clockwork и самолётами в движении.
- Многочасовую нагрузку на реальном мультиплеерном сервере и финальное расширение с 368 до ~500 модов.
