# Long Haul Legacy 2.0 — Alpha 10 — протокол проверки

## Итог

**Оба headless-теста на выделенном сервере Forge 47.4.10 (`void` и обычный Overworld с Terralith + Tectonic + BOP + RU + Alex's Caves + YUNG's + летающими островами + ребалансом руд + Pollution of the Realms + Primal Magick + Corpse) пройдены в GitHub Actions (run `44823032029`, commit `c0803ad`, `17m11s`). Графический клиент и физика транспорта в движении ещё не проверены.**

Финальные результаты из CI (`44823032029`):

- **Inspect JARs:** `378` внешних JAR (`306` серверных / `72` только клиентских) + `1` собственный `longhaul-runtime-1.20.1-0.1.0.jar`, `447` mod ID включая вложенные зависимости, **`Missing: 0`**, **`Range mismatches: 0`**.
- **Void integration test (`--heap 4096`):** `ready: true, exit_code: 0, world_border_175000: true, integration_pass: true, integration_fail: false, clean_exit: true`.
- **Normal Overworld generation test (`--heap 6144`):** `ready: true, exit_code: 0, world_border_175000: true, integration_pass: true, integration_fail: false, clean_exit: true`.
- **KubeJS:** `3/3` startup-скриптов и `13/13` server-скриптов загружены с `0` ошибок и `0` предупреждений; `client_scripts/01_longhaul_tooltips.js` проверен синтаксическим разбором в Node/VM (`test_contracts.js` — `18/18` тестов).
- **Упаковка:** `Long-Haul-Legacy-2.0-alpha.10.mrpack` (`564,349` байт, `963,197,679` байт внешних загрузок), `Long-Haul-Legacy-2.0-alpha.10-Sources-and-Report.zip` (`1,157,406` байт).

Строка интеграционной проверки в обоих режимах:

```text
LH_INTEGRATION_PASS: items + contracts + shift + brigadier + sites + nbt_structures + archive_repair + production + recovery + photo + cc + camp + cargo + advancement sync
```

## Среда и состав проверки

- Minecraft `1.20.1`, Forge `47.4.10`, Java `17` (Temurin), Linux x86_64 (GitHub Actions runner).
- **378 внешних JAR + 1 собственный `longhaul-runtime-1.20.1-0.1.0.jar`** (`447` mod ID включая вложенные).
- **18/18 чистых JS-тестов** (`node long-haul-legacy-2/tools/test_contracts.js`).
- **18 `.nbt` структур** (`16` узлов/руин `11×7×11` + `2` небесных острова-убежища `15×14×15`), **17 worldgen-оверрайдов руд + 6 редких рудных чанков + `longhaul:sky_refuges`**, **320 квестов Heracles** + **300 серверных advancement**.

## Что нового проверено в живом Forge 47.4.10 (`alpha.10`)

| Проверка | Результат |
|---|---|
| Выброс Voidout при смерти + могилы `Corpse` (`25_voidout_and_toxic_gas.js`, `corpse`) | Очередь взрыва через `3` тика после настоящей смерти игрока, защита `corpse:corpse` от взрыва, живой вызов `overworld.createExplosion(...).strength(...).explosionMode(...).explode()` в Forge `47.4.10`; Тотем бессмертия отменяет смерть на уровне ванили до `EntityEvents.death` |
| Летающие острова и небесные структуры (`embers-floating-islands`, `create-sky-village`, `longhaul:sky_refuges`) | Оба мода + `2` собственные структуры `sky_islands/*.nbt` (`Y=172..212`) загружены и пройдены в `normal` Overworld-генерации |
| Сезонный токсичный газ снизу (`25_voidout_and_toxic_gas.js`) | Цикл из 4 фаз (`0..3`, 24k тиков на фазу, пик `Y=114`); в `99_integration_test.js` подтверждено: низина `Y=70` -> `inGas: true`, летающий остров `Y=175` -> `inGas: false` |
| Жёсткое загрязнение и первородная магия (`pollution-of-the-realms`, `advanced-chimneys`, `primal-magick`, `thaumon`) | Все моды + `ForgeEndertech` совместимы с Forge `47.4.10`; `adpother-common.toml` настроен жёстче (`globalEmissionRate = 2.5`, `environmentDegradationRate = 0.8`, `maxGasEntitiesInChunk = 24`, дым от факелов и костров) |

## Что этот тест НЕ подтверждает

- Запуск графического клиента (включая клиентский рендер `Primal Magick`, `Thaumon`, `Corpse`, `Pollution of the Realms`, паркур `ParCool`, GUI Heracles и JEI tooltips), импорт `.mrpack` в Prism Launcher.
- Физику и управление поездами Create, кораблями Valkyrien Skies/Eureka/Clockwork и самолётами в движении.
- Официальный `Thaumcraft` (отсутствует в виде нативного релиза для Forge `1.20.1`; заменён на `Primal Magick` + `Thaumon`).
- Финальное расширение с 378 до ~500 модов.
