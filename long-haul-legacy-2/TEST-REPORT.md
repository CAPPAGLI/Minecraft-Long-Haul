# Long Haul Legacy 2.0 — Alpha 9 — протокол проверки

## Итог

**Оба headless-теста на выделенном сервере Forge 47.4.10 (`void` и обычный Overworld с Terralith + Tectonic + Biomes O' Plenty + Regions Unexplored + Alex's Caves + YUNG's + IDAS + Dungeons and Taverns + When Dungeons Arise + Structory + Formations + Towns & Towers + Structurify + обновлённой генерацией руд) пройдены в GitHub Actions (run `44817033789`, commit `ff80e20`, `16m12s`). Графический клиент и физика транспорта в движении ещё не проверены.**

Финальные результаты из CI (`44817033789`):

- **Inspect JARs:** `371` внешних JAR (`299` серверных / `72` только клиентских) + `1` собственный `longhaul-runtime-1.20.1-0.1.0.jar`, `440` mod ID включая вложенные зависимости, **`Missing: 0`**, **`Range mismatches: 0`**.
- **Void integration test (`--heap 4096`):** `ready: true, exit_code: 0, world_border_175000: true, integration_pass: true, integration_fail: false, clean_exit: true`.
- **Normal Overworld generation test (`--heap 6144`):** `ready: true, exit_code: 0, world_border_175000: true, integration_pass: true, integration_fail: false, clean_exit: true`.
- **KubeJS:** `3/3` startup-скриптов и `12/12` server-скриптов загружены с `0` ошибок и `0` предупреждений (`37,784` рецептов); `client_scripts/01_longhaul_tooltips.js` проверен синтаксическим разбором в Node/VM (`test_contracts.js` — `18/18` тестов).
- **Упаковка:** `Long-Haul-Legacy-2.0-alpha.9.mrpack` (`551,383` байт, `949,480,289` байт внешних загрузок), `Long-Haul-Legacy-2.0-alpha.9-Sources-and-Report.zip` (`1,132,574` байт), артефакт `long-haul-legacy-2.0-alpha.9` (`14670801211`, `1,800,390` байт).

Строка интеграционной проверки в обоих режимах:

```text
LH_INTEGRATION_PASS: items + contracts + shift + brigadier + sites + nbt_structures + archive_repair + production + recovery + photo + cc + camp + cargo + advancement sync
```

## Среда и состав проверки

- Minecraft `1.20.1`, Forge `47.4.10`, Java `17` (Temurin), Linux x86_64 (GitHub Actions runner).
- **371 внешних JAR + 1 собственный `longhaul-runtime-1.20.1-0.1.0.jar`** (`440` mod ID включая вложенные).
- **18/18 чистых JS-тестов** (`node long-haul-legacy-2/tools/test_contracts.js`).
- **16 ролевых `.nbt` структур** (`DataVersion: 3465`, `11×7×11`), **17 worldgen-оверрайдов руд + 6 редких рудных чанков**, **317 квестов Heracles** + **300 серверных advancement**.

## Что нового проверено в живом Forge 47.4.10 (`alpha.9`)

| Проверка | Результат |
|---|---|
| Паркур `ParCool!` (`parcool`) | В `assemble_alpha.py` автоматически выбрана новейшая версия `parcool` под Forge `47.4.10` (т.к. самая свежая требовала `[47.4.23,)`). `Missing: 0, Range mismatches: 0`, чистая загрузка сервера |
| Запрет саженцев и урезание дерева (`20_basics.js`, `01_longhaul_tooltips.js`) | Удалён дроп `#minecraft:saplings` и листвы `azalea`, блокируется установка/использование саженцев через `hasTag('minecraft:saplings')`, дроп `#minecraft:logs` снижен на `40%` (`randomChance(0.4)`) |
| Ребаланс руд в 10 раз и редкие богатые чанки (`generate_worldgen.py`, `24_immortal_snail.js`) | `17` vanilla Overworld `placed_feature` урезаны ~в 10 раз; добавлены `6` редких `longhaul:rich_*_chunk` через `longhaul/forge/biome_modifier/add_rich_ore_chunks.json`; команда `/lh prospect` проверена в живом Forge (`lhProspectChunk === 1`) |
| Бессмертная Улитка (`24_immortal_snail.js`) | Проверено: НЕ просыпается на спауне (`lhSnailStepPlayer` при `tick=20` возвращает `0`); при пробуждении появляется в `64` м (исправлен выбор тригонометрии через `LHWorldPlanner.cosRad/sinRad`), проходит сквозь блоки, наносит смертельный удар при контакте `<= 2.2` м и уходит на перезарядку `120` с в `80` м; урон по сущности отменяется |
| Сюжетная линия «Ушёл за хлебом» (`generate_alpha_quests.py`, `22_stage_progression.js`) | `6` глав в группе `00 · Сюжет: Ушёл за хлебом` (`story_01..06`) привязаны к `longhaul:story/*` advancement и выдаются по ходу этапов и пробуждения Улитки; исправлен идентификатор узла `machine` в `22_stage_progression.js` и `01_longhaul_tooltips.js` |

## Что этот тест НЕ подтверждает

- Запуск графического клиента (включая клиентский паркур ParCool, анимации/рендер, отображение `client_scripts/01_longhaul_tooltips.js` в JEI и клиентский рендер `timeless-and-classics-zero`), импорт `.mrpack` в Prism Launcher, GUI Heracles, рендер Embeddium/Oculus/ImmediatelyFast/FancyMenu/DrippyLoadingScreen и работу голоса/камеры.
- Физику и управление поездами Create, кораблями Valkyrien Skies/Eureka/Clockwork и самолётами в движении.
- Многочасовую нагрузку на реальном мультиплеерном сервере и финальное расширение с 371 до ~500 модов.
