# Long Haul Legacy 2.0 — Alpha 7 — протокол проверки

## Итог

**Оба headless-теста на выделенном сервере Forge 47.4.10 (`void` и обычный Overworld с Terralith + Tectonic + Biomes O' Plenty + Regions Unexplored + Alex's Caves + YUNG's + IDAS + Dungeons and Taverns + When Dungeons Arise + Structory + Formations + Towns & Towers + Structurify) пройдены в GitHub Actions (run `44790104903`, commit `f701b98`, `11m29s`). Графический клиент и физика транспорта в движении ещё не проверены.**

Финальные результаты из CI (`44790104903`):

- **Inspect JARs:** `368` внешних JAR (`296` серверных / `72` только клиентских) + `1` собственный `longhaul-runtime-1.20.1-0.1.0.jar`, `436` mod ID включая вложенные зависимости, **`Missing: 0`**, **`Range mismatches: 0`**.
- **Void integration test (`--heap 4096`):** `ready: true, exit_code: 0, integration_pass: true, integration_fail: false, clean_exit: true`.
- **Normal Overworld generation test (`--heap 6144`):** `ready: true, exit_code: 0, integration_pass: true, integration_fail: false, clean_exit: true` (генерация Overworld/Nether/End со всеми биомными и структурными модами включая `alexs-caves` и `structurify`, граница мира `175000`, планирование 10 узлов и 6 объектов восстановления в `±84000`, установка и проверка ролевых `11×7×11` `.nbt` структур, выполнение всех серверных тестов включая полный цикл `route_trial` и штатное сохранение).
- **KubeJS:** `3/3` startup-скриптов и `11/11` server-скриптов загружены с `0` ошибок и `0` предупреждений (`37,465` рецептов); `client_scripts/01_longhaul_tooltips.js` проверен синтаксическим разбором в Node/VM (`test_contracts.js` — `18/18` тестов).
- **Упаковка:** `Long-Haul-Legacy-2.0-alpha.7.mrpack` (`528,480` байт, `879,321,974` байт внешних загрузок), `Long-Haul-Legacy-2.0-alpha.7-Sources-and-Report.zip` (`1,092,913` байт).

Строка интеграционной проверки в обоих режимах:

```text
LH_INTEGRATION_PASS: items + contracts + shift + brigadier + sites + nbt_structures + archive_repair + production + recovery + photo + cc + camp + cargo + advancement sync
```

## Среда и состав проверки

- Minecraft `1.20.1`, Forge `47.4.10`, Java `17` (Temurin), Linux x86_64 (GitHub Actions runner).
- **368 внешних JAR + 1 собственный `longhaul-runtime-1.20.1-0.1.0.jar`** (`436` mod ID включая вложенные).
- **18/18 чистых JS-тестов** (`node long-haul-legacy-2/tools/test_contracts.js`): контракты приёмки, временны́е окна, JSON roundtrip, детерминированный планировщик 10 узлов и 6 объектов восстановления в `±84000`, валидатор маршрутов, граф экономики без циклических тупиков, индекс всех 240 заказов каталога (≥15 типов верификации) и синтаксический разбор всех 15 KubeJS startup/server/client и fixture-скриптов.
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
| Каталог 240 заказов (`/lh catalog verify`) | Верификация `site_visit` (`region_forest_01`), `photo_evidence` (`photo_forest_arrival`), `camp_visit` (`expedition_02`), `computer_challenge` (`engineering_cc_01`) и честного списания из депо (`main_1_01`) |
| Испытания маршрутов `route_trial` (`16_routes_and_camps.js`, `19_catalog_orders.js`) | `main_1_04` отклонён на черновике до реального заезда; проходит только после `lhRouteStart` + `lhRouteStepPlayer` (`completedCount == 1`, `verifiedFamilies.cart == true`); телепорт-скачок (400 м за 1 с) отменяет испытание (`-1`) |
| Автообновление стадий GameStages (`10..18` → `lhStageRecompute`) | Вехи контрактов, узлов, маршрутов, восстановлений, фотоотчётов Exposure и CC-испытаний автоматически вызывают `lhStageRecompute`; подтверждено сохранение `longhaul_stage_1..3` в `server.persistentData` |
| Логистические рецепты, стартовые тупики и запреты | Подтверждены `longhaul:expedition_bundle`, `longhaul:bulk_rail_from_sheets`, `longhaul:cure_leather_smoking`, `longhaul:cure_leather_campfire`; проверены все `37,465` рецептов в `RecipeManager` на отсутствие выхода `/jetpack/`, `minecraft:ender_chest`, `minecraft:shulker_box`, `supplementaries:sack`, `supplementaries:safe`, `quark:backpack`, `functionalstorage:ender_drawer` |
| Телеметрия транспорта (`23_vehicle_telemetry.js`) | 1-Hz сэмплер засчитывает `50` м поездки в `create:carriage_contraption` (`rail`) и отклоняет телепорт-скачок `5000` м (`rejectedJumps >= 1`) |
| Восстановление 6 промышленных объектов | `/lh recovery survey|restore` + размещение `longhaul:recovery/sawmill` `.nbt`, проверка наличия механизмов Create и материалов в бочке |
| Полевые фотоотчёты Exposure и телеметрия CC | `/lh photo report` отклоняет `minecraft:paper` и повторные токены; `/lh cc challenge|verify` проверяет `computercraft:computer_normal` и запас в депо |
| Экспедиционный лагерь и груз | Развёртывание/сворачивание лагеря, запрет сворачивания с непустой бочкой, выдача и доставка серверной накладной `/lh cargo` |
| Advancements и обычный Overworld | Синхронизация advancement на headless `ServerPlayer`; полная генерация и сохранение всех измерений при границе `175000` |

## Что этот тест НЕ подтверждает

- Запуск графического клиента (в том числе отображение `client_scripts/01_longhaul_tooltips.js` в JEI/инвентаре), импорт `.mrpack` в Prism Launcher, GUI Heracles, рендер Embeddium/Oculus/ImmediatelyFast/FancyMenu/DrippyLoadingScreen и работу голоса/камеры.
- Физику и управление поездами Create, кораблями Valkyrien Skies/Eureka/Clockwork и самолётами в движении.
- Многочасовую нагрузку на реальном мультиплеерном сервере и финальное расширение с 368 до ~500 модов.
