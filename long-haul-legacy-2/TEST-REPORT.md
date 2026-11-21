# Long Haul Legacy 2.0 — Alpha 13 — протокол проверки

## Итог

**Оба headless-теста на выделенном сервере Forge 47.4.10 (`void` и обычный Overworld с Terralith + Tectonic + BOP + RU + Alex's Caves + YUNG's + Aquamirae + Repurposed Structures + MVS - Moog's Voyager Structures + Lootr + Smart Mobs + 17 монорудными чанками) пройдены в GitHub Actions (run `44867383564`, commit `ac8c0c7`, `18m43s`). Графический клиент и физика транспорта в движении ещё не проверены.**

Финальные результаты из CI (`44867383564`):

- **Inspect JARs:** `401` внешний JAR (`327` серверных / `74` только клиентских) + `1` собственный `longhaul-runtime-1.20.1-0.1.0.jar` (`402` JAR всего), `468` mod ID включая вложенные зависимости, **`Missing: 0`**, **`Range mismatches: 0`**.
- **Void integration test (`--heap 4096`):** `ready: true, exit_code: 0, world_border_175000: true, integration_pass: true, integration_fail: false, clean_exit: true`.
- **Normal Overworld generation test (`--heap 6144`):** `ready: true, exit_code: 0, world_border_175000: true, integration_pass: true, integration_fail: false, clean_exit: true`.
- **KubeJS:** `3/3` startup-скриптов и `13/13` server-скриптов загружены с `0` ошибок и `0` предупреждений; `client_scripts/01_longhaul_tooltips.js` проверен синтаксическим разбором в Node/VM (`test_contracts.js` — `18/18` тестов).
- **Упаковка:** `Long-Haul-Legacy-2.0-alpha.13.mrpack` (`582,859` байт, `996,771,559` байт внешних загрузок), `Long-Haul-Legacy-2.0-alpha.13-Sources-and-Report.zip` (`1,203,074` байт).

Строка интеграционной проверки в обоих режимах:

```text
LH_INTEGRATION_PASS: items + contracts + shift + brigadier + sites + nbt_structures + archive_repair + production + recovery + photo + cc + camp + cargo + advancement sync
```

## Среда и состав проверки

- Minecraft `1.20.1`, Forge `47.4.10`, Java `17` (Temurin), Linux x86_64 (GitHub Actions runner).
- **401 внешний JAR + 1 собственный `longhaul-runtime-1.20.1-0.1.0.jar`** (`468` mod ID включая вложенные).
- **18/18 чистых JS-тестов** (`node long-haul-legacy-2/tools/test_contracts.js`).
- **18 `.nbt` структур** (`16` узлов/руин `11×7×11` + `2` небесных острова-убежища `15×14×15`), **29 worldgen-оверрайдов руд (`17` ванильных + `12` модовых) + 17 монорудных богатых чанков (`6` ванильных + `11` модовых) + `longhaul:sky_refuges`**, **320 квестов Heracles** + **300 серверных advancement**.

## Что нового проверено в живом Forge 47.4.10 (`alpha.13`)

| Проверка | Результат |
|---|---|
| Интеграция `MVS - Moog's Voyager Structures` (`moogs-voyager-structures`) + `Moog's Structure Lib` (`moogs-structure-lib`) | Оба мода загружены и проверены на Forge `47.4.10` (`Missing: 0, Range mismatches: 0`); генерация `normal` Overworld завершилась чисто |
| Превышение планки в 400+ внешних JAR (`401` внешних + `1` runtime = `402` JAR, `468` mod ID) | Все версии и зависимости проверены на Forge `47.4.10` |

## Что этот тест НЕ подтверждает

- Запуск графического клиента (включая клиентский рендер, GUI Heracles и JEI/JER), импорт `.mrpack` в Prism Launcher.
- Физику и управление поездами Create, кораблями Valkyrien Skies/Eureka/Clockwork и самолётами в движении.
- Официальный `Thaumcraft` (отсутствует в виде нативного релиза для Forge `1.20.1`; заменён на `Primal Magick` + `Thaumon`).
- Финальное расширение с 401 до ~500 модов.
