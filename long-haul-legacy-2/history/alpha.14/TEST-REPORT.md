# Long Haul Legacy 2.0 — Alpha 14 — протокол проверки

## Итог

**Оба headless-теста на выделенном сервере Forge 47.4.10 (`void` и обычный Overworld с Terralith + Tectonic + BOP + RU + Alex's Caves + YUNG's + YUNG's Cave Biomes + Aquamirae + Repurposed Structures + MVS/MES/MNS/MSS + CTOV + L_Ender's Cataclysm + Lootr + Smart Mobs + 17 монорудными чанками) пройдены в GitHub Actions (run `44882776129`, commit `ba1aa3e`, `13m22s`). Графический клиент и физика транспорта в движении ещё не проверены.**

Финальные результаты из CI (`44882776129`):

- **Inspect JARs:** `418` внешних JAR (`343` серверных / `75` только клиентских) + `1` собственный `longhaul-runtime-1.20.1-0.1.0.jar` (`419` JAR всего), `487` mod ID включая вложенные зависимости, **`Missing: 0`**, **`Range mismatches: 0`**.
- **Void integration test (`--heap 4096`):** `ready: true, exit_code: 0, world_border_175000: true, integration_pass: true, integration_fail: false, clean_exit: true`.
- **Normal Overworld generation test (`--heap 6144`):** `ready: true, exit_code: 0, world_border_175000: true, integration_pass: true, integration_fail: false, clean_exit: true`.
- **KubeJS:** `3/3` startup-скриптов и `13/13` server-скриптов загружены с `0` ошибок и `0` предупреждений; `client_scripts/01_longhaul_tooltips.js` и все `321` квест Heracles проверены в `test_contracts.js` (`19/19` тестов).
- **Упаковка:** `Long-Haul-Legacy-2.0-alpha.14.mrpack` (`584,323` байт, `1,116,417,216` байт внешних загрузок), `Long-Haul-Legacy-2.0-alpha.14-Sources-and-Report.zip` (`1,222,884` байт).

Строка интеграционной проверки в обоих режимах:

```text
LH_INTEGRATION_PASS: items + contracts + shift + brigadier + sites + nbt_structures + archive_repair + production + recovery + photo + cc + camp + cargo + advancement sync
```

## Среда и состав проверки

- Minecraft `1.20.1`, Forge `47.4.10`, Java `17` (Temurin), Linux x86_64 (GitHub Actions runner).
- **418 внешних JAR + 1 собственный `longhaul-runtime-1.20.1-0.1.0.jar`** (`487` mod ID включая вложенные).
- **19/19 чистых JS-тестов** (`node long-haul-legacy-2/tools/test_contracts.js`), включая проверку формата `display.title` / `display.subtitle` во всех 321 квесте Heracles.
- **18 `.nbt` структур** (`16` узлов/руин `11×7×11` + `2` небесных острова-убежища `15×14×15`), **29 worldgen-оверрайдов руд (`17` ванильных + `12` модовых) + 17 монорудных богатых чанков (`6` ванильных + `11` модовых) + `longhaul:sky_refuges`**, **321 квест Heracles** + **300 серверных advancement**.

## Что нового проверено в живом Forge 47.4.10 (`alpha.14`)

| Проверка | Результат |
|---|---|
| Исправление JSON-формата `display.title` / `display.subtitle` квестов Heracles | Все `321` квестов используют нативные JSON-объекты `{"text": "..."}` (`ExtraCodecs.COMPONENT`), проверено автотестом в `test_contracts.js` |
| Выдача `eccentrictome:tome` на старте + удаление дубликата `akashic-tome` | Предмет `eccentrictome:tome` подтверждён в живом реестре Forge (`Block 19` в `99_integration_test.js`); добавлен стартовый квест `alpha_eccentric_tome` |
| Расширение до `418` внешних JAR (`487` mod ID): `create-encased`, `create-vibrant-vaults`, `create_factory_logistics`, `escalated`, `create-6.0.8-backported-fixes`, `yungs-cave-biomes`, `mes-moogs-end-structures`, `mns-moogs-nether-structures`, `mss-moogs-soaring-structures`, `ct-overhaul-village`, `l_enders-cataclysm`, `neruina`, `lmd`, `no-chat-reports`, `rubidium-extra` | Все зависимости и диапазоны версий на Forge `47.4.10` + Create `6.0.8` проверены (`Missing: 0, Range mismatches: 0`); после поднятия `-XX:MaxMetaspaceSize=1024m` оба запуска (`void` и `normal`) завершились чисто |

## Что этот тест НЕ подтверждает

- Запуск графического клиента (включая клиентский рендер, визуальную отрисовку GUI Heracles после правки и JEI/JER), импорт `.mrpack` в лаунчере.
- Физику и управление поездами Create, кораблями Valkyrien Skies/Eureka/Clockwork и самолётами в движении.
- Официальный `Thaumcraft` (отсутствует в виде нативного релиза для Forge `1.20.1`; заменён на `Primal Magick` + `Thaumon`).
- Финальное расширение с 418 до ~500 модов.
