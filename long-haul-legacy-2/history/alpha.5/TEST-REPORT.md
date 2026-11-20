# Long Haul Legacy 2.0 — Alpha 5 — протокол проверки

## Итог

**Оба headless-теста на выделенном сервере Forge 47.4.10 (`void` и обычный Overworld с Terralith + Tectonic + Biomes O' Plenty + Regions Unexplored + Alex's Caves + YUNG's + IDAS + Dungeons and Taverns + When Dungeons Arise + Structory + Formations + Towns & Towers + Structurify) пройдены в GitHub Actions (run `44776166679`, commit `56a3be2`, `13m40s`). Графический клиент и физика транспорта в движении ещё не проверены.**

Финальные результаты из CI (`44776166679`):

- **Inspect JARs:** `361` внешних JAR (`290` серверных / `71` только клиентских) + `1` собственный `longhaul-runtime-1.20.1-0.1.0.jar`, `429` mod ID включая вложенные зависимости, **`Missing: 0`**, **`Range mismatches: 0`**.
- **Void integration test (`--heap 4096`):** `ready: true, exit_code: 0, integration_pass: true, integration_fail: false, clean_exit: true`.
- **Normal Overworld generation test (`--heap 6144`):** `ready: true, exit_code: 0, integration_pass: true, integration_fail: false, clean_exit: true` (генерация Overworld/Nether/End со всеми биомными и структурными модами включая `alexs-caves` и `structurify`, граница мира `175000`, планирование 10 узлов и 6 объектов восстановления в `±84000`, установка и проверка ролевых `11×7×11` `.nbt` структур, выполнение всех серверных тестов и штатное сохранение).
- **KubeJS:** `3/3` startup-скриптов и `9/9` server-скриптов загружены с `0` ошибок и `0` предупреждений (`37,241` рецептов).
- **Упаковка:** `Long-Haul-Legacy-2.0-alpha.5.mrpack` (`520,039` байт, `873,552,658` байт внешних загрузок), `Long-Haul-Legacy-2.0-alpha.5-Sources-and-Report.zip` (`1,073,845` байт).

Строка интеграционной проверки в обоих режимах:

```text
LH_INTEGRATION_PASS: items + contracts + shift + brigadier + sites + nbt_structures + archive_repair + production + recovery + photo + cc + camp + cargo + advancement sync
```

## Среда и состав проверки

- Minecraft `1.20.1`, Forge `47.4.10`, Java `17` (Temurin), Linux x86_64 (GitHub Actions runner).
- **361 внешних JAR + 1 собственный `longhaul-runtime-1.20.1-0.1.0.jar`** (`429` mod ID включая вложенные).
- **17/17 чистых JS-тестов** (`node long-haul-legacy-2/tools/test_contracts.js`): контракты приёмки, временны́е окна, JSON roundtrip, детерминированный планировщик 10 узлов и 6 объектов восстановления в `±84000`, валидатор маршрутов, граф экономики без циклических тупиков и индекс всех 240 заказов каталога.
- **16 ролевых `.nbt` структур** (`DataVersion: 3465`, `11×7×11`) сгенерированы и проверены `generate_structures.py`.
- **311 квестов Heracles** (11 групп: 71 базовый + 240 из `design/quest-catalog.json`) и **294 серверных advancement** сгенерированы и проверены `generate_alpha_quests.py`.

## Что подтверждено в живом Forge 47.4.10 (`99_integration_test.js`)

| Проверка | Результат |
|---|---|
| Регистрация предметов и текстур | 10 кастомных предметов `longhaul:*` + 10 16×16 текстур загружены без ошибок |
| Инвентарная бочка и контракты | Извлечение из настоящей бочки, выполнение `plates` и выдача квитанции |
| Временны́е окна и перезагрузка состояния | Живой `plate_shift` (3 окна), сброс `LHState = null` и восстановление из `server.persistentData` |
| Команды Brigadier `/lh` | Полная регистрация и живое выполнение команд (`/lh help`, `/lh sites`, `/lh site info`, `/lh camp list`, `/lh route list`, `/lh status`, `/lh recovery list`, `/lh photo status`, `/lh cc status`, `/lh catalog list|stage|info`) |
| Ролевые `11×7×11` `.nbt` структуры и ремонт архива | `/place template longhaul:sites/forest` и `continental_archive`, проверка ролевых блоков (`spruce_planks`, `spruce_log`, `polished_deepslate`, `lectern`, `minecraft:barrel`), идемпотентный `/lh site repair_archive` |
| Каталог 240 заказов (`/lh catalog verify`) | Верификация `site_visit` (`region_forest_01`), `photo_evidence` (`photo_forest_arrival`), `camp_visit` (`expedition_02`), `computer_challenge` (`engineering_cc_01`), и честного списания из депо (`main_1_01`) |
| Логистические рецепты и защита от телепорт-хранилищ | Подтверждены `longhaul:expedition_bundle` и `longhaul:bulk_rail_from_sheets`; проверены все `37,241` рецептов в `RecipeManager` на отсутствие выхода `minecraft:ender_chest`, `minecraft:shulker_box`, `supplementaries:sack`, `supplementaries:safe`, `quark:backpack`, `functionalstorage:ender_drawer` |
| Восстановление 6 промышленных объектов | `/lh recovery survey|restore` + размещение `longhaul:recovery/sawmill` `.nbt`, проверка наличия механизмов Create и материалов в бочке |
| Полевые фотоотчёты Exposure и телеметрия CC | `/lh photo report` отклоняет `minecraft:paper` и повторные токены; `/lh cc challenge|verify` проверяет `computercraft:computer_normal` и запас в депо |
| Экспедиционный лагерь и груз | Развёртывание/сворачивание лагеря, запрет сворачивания с непустой бочкой, выдача и доставка серверной накладной `/lh cargo` |
| Advancements и обычный Overworld | Синхронизация advancement на headless `ServerPlayer`; полная генерация и сохранение всех измерений при границе `175000` |

## Обнаруженные и устранённые проблемы в ходе `alpha.5`

1. **`servercore`:** отклонён на этапе `inspect_alpha.py` (находится в `FORBIDDEN` из-за рисков вмешательства в серверную симуляцию) и удалён из `profiles/alpha5.json`.
2. **`19_catalog_orders.js` (`computer_challenge`):** интеграционный тест выявил `ReferenceError: "lhHasNearbyComputer" is not defined` — исправлено на существующую функцию `lhFindNearbyComputer(level, depotPos)` из `18_field_and_cc.js`.
3. **Аудит `functionalstorage:ender_drawer`:** добавлен в `20_basics.js` (удаление рецептов, лута, запрет установки и ПКМ) и включён в автоматический скан `RecipeManager` в `99_integration_test.js`.

## Что этот тест НЕ подтверждает

- Запуск графического клиента, импорт `.mrpack` в Prism Launcher, GUI Heracles, рендер Embeddium/Oculus/ImmediatelyFast/FancyMenu/DrippyLoadingScreen и работу голоса/камеры.
- Физику и управление поездами Create, кораблями Valkyrien Skies/Eureka/Clockwork и самолётами в движении.
- Многочасовую нагрузку на реальном мультиплеерном сервере и финальное расширение с 361 до ~500 модов.
