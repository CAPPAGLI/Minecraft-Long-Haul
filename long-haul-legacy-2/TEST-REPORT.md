# Long Haul Legacy 2.0 — Alpha 12 — протокол проверки

## Итог

**Оба headless-теста на выделенном сервере Forge 47.4.10 (`void` и обычный Overworld с Terralith + Tectonic + BOP + RU + Alex's Caves + YUNG's + Aquamirae + Repurposed Structures + Lootr + Smart Mobs + 17 монорудными чанками и ребалансом ванильных и модовых руд) пройдены в GitHub Actions (run `44864873455`, commit `859a7f0`, `11m05s`). Графический клиент и физика транспорта в движении ещё не проверены.**

Финальные результаты из CI (`44864873455`):

- **Inspect JARs:** `399` внешних JAR (`325` серверных / `74` только клиентских) + `1` собственный `longhaul-runtime-1.20.1-0.1.0.jar` (`400` JAR всего), `466` mod ID включая вложенные зависимости, **`Missing: 0`**, **`Range mismatches: 0`**.
- **Void integration test (`--heap 4096`):** `ready: true, exit_code: 0, world_border_175000: true, integration_pass: true, integration_fail: false, clean_exit: true`.
- **Normal Overworld generation test (`--heap 6144`):** `ready: true, exit_code: 0, world_border_175000: true, integration_pass: true, integration_fail: false, clean_exit: true`.
- **KubeJS:** `3/3` startup-скриптов и `13/13` server-скриптов загружены с `0` ошибок и `0` предупреждений; `client_scripts/01_longhaul_tooltips.js` проверен синтаксическим разбором в Node/VM (`test_contracts.js` — `18/18` тестов).
- **Упаковка:** `Long-Haul-Legacy-2.0-alpha.12.mrpack` (`582,777` байт, `993,249,237` байт внешних загрузок), `Long-Haul-Legacy-2.0-alpha.12-Sources-and-Report.zip` (`1,197,252` байт).

Строка интеграционной проверки в обоих режимах:

```text
LH_INTEGRATION_PASS: items + contracts + shift + brigadier + sites + nbt_structures + archive_repair + production + recovery + photo + cc + camp + cargo + advancement sync
```

## Среда и состав проверки

- Minecraft `1.20.1`, Forge `47.4.10`, Java `17` (Temurin), Linux x86_64 (GitHub Actions runner).
- **399 внешних JAR + 1 собственный `longhaul-runtime-1.20.1-0.1.0.jar`** (`466` mod ID включая вложенные).
- **18/18 чистых JS-тестов** (`node long-haul-legacy-2/tools/test_contracts.js`).
- **18 `.nbt` структур** (`16` узлов/руин `11×7×11` + `2` небесных острова-убежища `15×14×15`), **29 worldgen-оверрайдов руд (`17` ванильных + `12` модовых) + 17 монорудных богатых чанков (`6` ванильных + `11` модовых) + `longhaul:sky_refuges`**, **320 квестов Heracles** + **300 серверных advancement**.

## Что нового проверено в живом Forge 47.4.10 (`alpha.12`)

| Проверка | Результат |
|---|---|
| Модовые оверрайды редкости руд (`Create`, `Immersive Engineering`, `Primal Magick`) и `11` модовых монорудных чанков (`zinc`, `bauxite`, `lead`, `silver`, `nickel`, `uranium`, `thorium`, `tin`, `sulfur`, `rock_salt`, `quartz`) | Все `29` оверрайдов, `8` `longhaul` `configured_feature` и `17` `placed_feature` загружены и пройдены в `normal` Overworld без ошибок worldgen |
| Расширенный `/lh prospect` (`24_immortal_snail.js`, блок 18 в `99_integration_test.js`) | Живой вызов `lhProspectChunk` в Forge `47.4.10` успешно сканирует все 17 типов ванильных и модовых руд |
| Интеграция `Smart Mobs` (`smart-mobs`) | Мод загружен с Modrinth на Forge `47.4.10`, сгенерирован `config/smartmobs-common.toml` (`blockBreaking`, `bridgeBuilding`, `pillarBuilding`, `omniscience`, `sniperAI`) |

## Что этот тест НЕ подтверждает

- Запуск графического клиента (включая клиентский рендер, GUI Heracles и JEI/JER), импорт `.mrpack` в Prism Launcher.
- Физику и управление поездами Create, кораблями Valkyrien Skies/Eureka/Clockwork и самолётами в движении.
- Официальный `Thaumcraft` (отсутствует в виде нативного релиза для Forge `1.20.1`; заменён на `Primal Magick` + `Thaumon`).
- Финальное расширение с 399 до ~500 модов.
