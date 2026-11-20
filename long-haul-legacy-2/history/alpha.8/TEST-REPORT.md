# Long Haul Legacy 2.0 — Alpha 8 — протокол проверки

## Итог

**Оба headless-теста на выделенном сервере Forge 47.4.10 (`void` и обычный Overworld с Terralith + Tectonic + Biomes O' Plenty + Regions Unexplored + Alex's Caves + YUNG's + IDAS + Dungeons and Taverns + When Dungeons Arise + Structory + Formations + Towns & Towers + Structurify) пройдены в GitHub Actions (run `44800294801`, commit `247977a`, `13m0s`). Графический клиент и физика транспорта в движении ещё не проверены.**

Финальные результаты из CI (`44800294801`):

- **Inspect JARs:** `370` внешних JAR (`298` серверных / `72` только клиентских) + `1` собственный `longhaul-runtime-1.20.1-0.1.0.jar`, `439` mod ID включая вложенные зависимости, **`Missing: 0`**, **`Range mismatches: 0`**.
- **Void integration test (`--heap 4096`):** `ready: true, exit_code: 0, world_border_175000: true, integration_pass: true, integration_fail: false, clean_exit: true`.
- **Normal Overworld generation test (`--heap 6144`):** `ready: true, exit_code: 0, world_border_175000: true, integration_pass: true, integration_fail: false, clean_exit: true`.
- **KubeJS:** `3/3` startup-скриптов и `11/11` server-скриптов загружены с `0` ошибок и `0` предупреждений; `client_scripts/01_longhaul_tooltips.js` проверен синтаксическим разбором в Node/VM (`test_contracts.js` — `18/18` тестов).
- **Упаковка:** `Long-Haul-Legacy-2.0-alpha.8.mrpack` (`530,071` байт, `948,326,237` байт внешних загрузок), `Long-Haul-Legacy-2.0-alpha.8-Sources-and-Report.zip` (`1,101,717` байт).

Строка интеграционной проверки в обоих режимах:

```text
LH_INTEGRATION_PASS: items + contracts + shift + brigadier + sites + nbt_structures + archive_repair + production + recovery + photo + cc + camp + cargo + advancement sync
```

## Среда и состав проверки

- Minecraft `1.20.1`, Forge `47.4.10`, Java `17` (Temurin), Linux x86_64 (GitHub Actions runner).
- **370 внешних JAR + 1 собственный `longhaul-runtime-1.20.1-0.1.0.jar`** (`439` mod ID включая вложенные).
- **18/18 чистых JS-тестов** (`node long-haul-legacy-2/tools/test_contracts.js`).
- **16 ролевых `.nbt` структур** (`DataVersion: 3465`, `11×7×11`) и **311 квестов Heracles** + **294 серверных advancement**.

## Что нового проверено в живом Forge 47.4.10 (`99_integration_test.js` и `smoke_server.py`)

| Проверка | Результат |
|---|---|
| Полная верификация всех 19 `verification_type` каталога (`19_catalog_orders.js`) | `delivery` (`main_1_02`, `distinct_inputs=2`) отклонён при 1 типе предмета и принят при 2 разных предметах; `vehicle_delivery` (`main_2_02`, `ship` → `watercraft`) отклонён без пробега судна и принят после `60` м пробега `smallships:cog` + `256` ед. груза; `network_supply` (`main_2_08`, `distinct_regions=3`) отклонён при 1 запущенном узле и принят при 3 запущенных узлах + грузе; также подключены `vehicle_trial`, `scheduled_train`, `sample_return` и `ration_delivery` |
| Строгая граница мира `175000` (`10_contracts.js`, `smoke_server.py`) | Установка через Java API `overworld.worldBorder.setCenter/setSize(175000)` + обязательная проверка `worldborder get` (`175000`) в `smoke_server.py` и `99_integration_test.js` |
| Блокировка переносных хранилищ (`20_basics.js`) | Добавлен запрет `BlockEvents.placed` на `ender_chest` и все 17 `shulker_box`, а также `ItemEvents.rightClicked` на `quark:backpack` и `functionalstorage:ender_drawer` |
| Новые совместимые моды | `ends-delight` `2.6.1+forge.1.20.1` (зафиксирован для `create_central_kitchen`/`delightful`) и `timeless-and-classics-zero` `1.2.0-hotfix` (`TimelessKubeJSPlugin`) |
| Выявленные и отсеянные проблемы совместимости | Отклонены `subtle-effects` (`forge >= 47.4.14`), `every-compat` (+18.8 тыс. рецептов и GC-перегрузка в 4 ГБ heap) и `villager-recruits` (`NullPointerException` в `FactionEvents.onTypeCommandEvent` на ранних серверных командах) |

## Что этот тест НЕ подтверждает

- Запуск графического клиента (в том числе отображение `client_scripts/01_longhaul_tooltips.js` в JEI и клиентский рендер `timeless-and-classics-zero`), импорт `.mrpack` в Prism Launcher, GUI Heracles, рендер Embeddium/Oculus/ImmediatelyFast/FancyMenu/DrippyLoadingScreen и работу голоса/камеры.
- Физику и управление поездами Create, кораблями Valkyrien Skies/Eureka/Clockwork и самолётами в движении.
- Многочасовую нагрузку на реальном мультиплеерном сервере и финальное расширение с 370 до ~500 модов.
