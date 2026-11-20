# Long Haul Legacy 2.0 — Alpha 11 — протокол проверки

## Итог

**Оба headless-теста на выделенном сервере Forge 47.4.10 (`void` и обычный Overworld с Terralith + Tectonic + BOP + RU + Alex's Caves + YUNG's + Aquamirae + Repurposed Structures + Lootr + летающими островами + AdPother + Primal Magick + Corpse) пройдены в GitHub Actions (run `44831536144`, commit `8bd1703`, `14m14s`). Графический клиент и физика транспорта в движении ещё не проверены.**

Финальные результаты из CI (`44831536144`):

- **Inspect JARs:** `398` внешних JAR (`324` серверных / `74` только клиентских) + `1` собственный `longhaul-runtime-1.20.1-0.1.0.jar`, `465` mod ID включая вложенные зависимости, **`Missing: 0`**, **`Range mismatches: 0`**.
- **Void integration test (`--heap 4096`):** `ready: true, exit_code: 0, world_border_175000: true, integration_pass: true, integration_fail: false, clean_exit: true`.
- **Normal Overworld generation test (`--heap 6144`):** `ready: true, exit_code: 0, world_border_175000: true, integration_pass: true, integration_fail: false, clean_exit: true`.
- **KubeJS:** `3/3` startup-скриптов (включая плагин `ExposureKubeJSPlugin`) и `13/13` server-скриптов загружены с `0` ошибок и `0` предупреждений; `client_scripts/01_longhaul_tooltips.js` проверен синтаксическим разбором в Node/VM (`test_contracts.js` — `18/18` тестов).
- **Упаковка:** `Long-Haul-Legacy-2.0-alpha.11.mrpack` (`569,015` байт, `993,180,733` байт внешних загрузок), `Long-Haul-Legacy-2.0-alpha.11-Sources-and-Report.zip` (`1,178,006` байт).

Строка интеграционной проверки в обоих режимах:

```text
LH_INTEGRATION_PASS: items + contracts + shift + brigadier + sites + nbt_structures + archive_repair + production + recovery + photo + cc + camp + cargo + advancement sync
```

## Среда и состав проверки

- Minecraft `1.20.1`, Forge `47.4.10`, Java `17` (Temurin), Linux x86_64 (GitHub Actions runner).
- **398 внешних JAR + 1 собственный `longhaul-runtime-1.20.1-0.1.0.jar`** (`465` mod ID включая вложенные).
- **18/18 чистых JS-тестов** (`node long-haul-legacy-2/tools/test_contracts.js`).
- **18 `.nbt` структур** (`16` узлов/руин `11×7×11` + `2` небесных острова-убежища `15×14×15`), **17 worldgen-оверрайдов руд + 6 редких рудных чанков + `longhaul:sky_refuges`**, **320 квестов Heracles** + **300 серверных advancement**.

## Что нового проверено в живом Forge 47.4.10 (`alpha.11`)

| Проверка | Результат |
|---|---|
| Квотирование чанклоадинга активного маршрута (`16_routes_and_camps.js`, блок 17 в `99_integration_test.js`) | `lhRouteQuotaSync` ограничивает число якорей чанков `<= 2` на активный рейс и корректно освобождает квоту по завершении / `/lh route abort` |
| Расширение с 378 до 398 внешних JAR (+20 модов: `map-atlases-forge`, `aquamirae` + `obscure-api`, `lootr`, `repurposed-structures-forge`, `create-enchantment-industry`, `create-central-kitchen`, `create-deco`, `nethers-delight`, `oceans-delight`, `brewin-and-chewin`, `exposure`, `comforts`, `iron-furnaces`, `torchmaster`, `akashic-tome`, `trash-slot`, `better-f3`, `dynamic-lights`, `presence-footsteps-forge`, `jade-addons-forge`, `just-enough-resources-jer`, `attributefix`, `netherportalfix`, `easy-anvils`, `easy-magic`, `enchanting-infuser`, `trading-post`, `macaws-stairs`) | Все зависимости и диапазоны версий на Forge `47.4.10` + Create `6.0.x` проверены (`Missing: 0, Range mismatches: 0`); оба запуска (`void` и `normal`) завершились чисто |
| Конфиги `adpother-common.toml` (`globalEmissionRate = 2.5`), `primalmagick-common.toml`, `adchimneys-common.toml` | Подтверждены в живом сервере |

## Что этот тест НЕ подтверждает

- Запуск графического клиента (включая клиентский рендер `Map Atlases`, `Exposure`, `Presence Footsteps`, `BetterF3`, `Dynamic Lights`, `Primal Magick`, `Corpse`, `ParCool`, GUI Heracles и JEI/JER), импорт `.mrpack` в Prism Launcher.
- Физику и управление поездами Create, кораблями Valkyrien Skies/Eureka/Clockwork и самолётами в движении.
- Официальный `Thaumcraft` (отсутствует в виде нативного релиза для Forge `1.20.1`; заменён на `Primal Magick` + `Thaumon`).
- Финальное расширение с 398 до ~500 модов.
