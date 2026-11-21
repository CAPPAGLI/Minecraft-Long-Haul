# Long Haul Legacy 2.0 — Alpha 18 — протокол проверки

## Итог

**Оба headless-теста на выделенном сервере Forge 47.4.10 (`void` и обычный Overworld с Terralith + Tectonic + BOP + RU + Alex's Caves + YUNG's + YUNG's Cave Biomes + Aquamirae + Repurposed Structures + MVS/MES/MNS/MSS + CTOV + L_Ender's Cataclysm + Friends&Foes + It Takes a Pillage + Distant Horizons + Ultimate Chess + Vinery + Nyf's Spiders + Create Structures Arise + Villager Recruits + Mobtimizations + Lootr + Smart Mobs + 17 монорудными чанками) пройдены в GitHub Actions (run `44961633776`, commit `37e6142`, `18m2s`). Графический клиент и физика транспорта в движении ещё не проверены.**

Финальные результаты из CI (`44961633776`):

- **Inspect JARs:** `452` внешних JAR (`365` серверных / `87` только клиентских) + `1` собственный `longhaul-runtime-1.20.1-0.1.0.jar` (`453` JAR всего), `524` mod ID включая вложенные зависимости, **`Missing: 0`**, **`Range mismatches: 0`**.
- **Void integration test (`--heap 5120`):** `ready: true, exit_code: 0, world_border_175000: true, integration_pass: true, integration_fail: false, clean_exit: true`.
- **Normal Overworld generation test (`--heap 7168`):** `ready: true, exit_code: 0, world_border_175000: true, integration_pass: true, integration_fail: false, clean_exit: true`.
- **KubeJS:** `3/3` startup-скриптов и `13/13` server-скриптов загружены с `0` ошибок и `0` предупреждений; `client_scripts/01_longhaul_tooltips.js` (с подсказками на все заблокированные хранилища), все `321` квест Heracles и `pack.mcmeta` проверены в `test_contracts.js` (`20/20` тестов).
- **Упаковка:** `Long-Haul-Legacy-2.0-alpha.18.mrpack` (`592,457` байт, `1,187,768,095` байт внешних загрузок), `Long-Haul-Legacy-2.0-alpha.18-Sources-and-Report.zip` (`1,273,004` байт).

Строка интеграционной проверки в обоих режимах:

```text
LH_INTEGRATION_PASS: items + contracts + shift + brigadier + sites + nbt_structures + archive_repair + production + recovery + photo + cc + camp + cargo + advancement sync
```

## Среда и состав проверки

- Minecraft `1.20.1`, Forge `47.4.10`, Java `17` (Temurin), Linux x86_64 (GitHub Actions runner).
- **452 внешних JAR + 1 собственный `longhaul-runtime-1.20.1-0.1.0.jar`** (`524` mod ID включая вложенные).
- **20/20 чистых JS-тестов** (`node long-haul-legacy-2/tools/test_contracts.js`), включая проверку `pack.mcmeta` (`pack_format: 15`) и формата `display.title` / `display.subtitle` во всех 321 квесте Heracles.
- **18 `.nbt` структур**, **29 worldgen-оверрайдов руд + 17 монорудных богатых чанков + `longhaul:sky_refuges`**, **321 квест Heracles** + **300 серверных advancement**.

## Что нового проверено и оттюнинговано в `alpha.18`

| Проверка / Исправление | Результат |
|---|---|
| `create-pattern-schematics`, `create-additional-lights`, `create-structures-arise`, `villager-recruits`, `straw-statues`, `delightful-sandwiches`, `mobtimizations` + клиентские `subtle-effects`, `entitytexturefeatures`, `modelfix`, `jade-vs`, `shulkerboxtooltip`, `overflowing-bars`, `raised` | Все `452` внешних JAR (`524` mod ID) пройдены через `inspect_alpha.py` (`Missing: 0, Range mismatches: 0`) и оба серверных дымовых теста (`void` `5120 MB` и `normal` `7168 MB`) с `LH_INTEGRATION_PASS` |
| Отловленный конфликт `every-compat` + Valkyrien Skies (`MassDatapackResolver`) | В run `44960401382` `every-compat` переполнил heap `MassDatapackResolver.registerAllBlockStates` из-за тысяч сгенерированных blockstates; исключён + `smoke-void` поднят до `5120 MB` |
| Отловленный конфликт `villager-workers` + `Forgified Fabric API` + `MoreJS` | В run `44961013276` `VillagerPriceTable.build` вызвал `EmeraldsForVillagerTypeItem` LVT-конфликт; `villager-workers` исключён |
| Тюнинг `inspect_alpha.py` и `assemble_alpha.py` | Добавлены `Implementation-Version` из `MANIFEST.MF`, проверка `server -> client_only` (`side: BOTH/SERVER`) и валидация Forge `47.4.10` для записей из `candidates.json` (отловлен `subtle-effects [47.4.14,)` и `jade_vs -> jade`) |
| Тюнинг `client_scripts/01_longhaul_tooltips.js` | Добавлены красные предупреждения JEI/EMI на `ender_chest`, `supplementaries:sack`, `supplementaries:safe`, `quark:backpack` и `#minecraft:shulker_boxes` |

## Что этот тест НЕ подтверждает

- Запуск графического клиента (включая клиентский рендер `Subtle Effects`, `Entity Texture Features`, `Model Gap Fix`, `Overflowing Bars`, `Raised`, `Jade VS`, `Distant Horizons` с `Oculus 1.8.0` / `Embeddium 0.3.31` и визуальную отрисовку GUI Heracles), импорт `.mrpack` в лаунчере.
- Физику и управление поездами Create, кораблями Valkyrien Skies/Eureka/Clockwork и самолётами в движении.
- Официальный `Thaumcraft` (заменён на `Primal Magick` + `Thaumon`) и опциональный CurseForge-only `DOOMED` (см. `DOOMED.md` и `optional-mods/README.md`).
- Дальнейшее расширение с 452 до ~500 внешних JAR (сейчас 453 JAR / 524 mod ID).
