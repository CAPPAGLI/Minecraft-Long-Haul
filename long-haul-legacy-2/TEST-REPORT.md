# Long Haul Legacy 2.0 — Alpha 15 — протокол проверки

## Итог

**Оба headless-теста на выделенном сервере Forge 47.4.10 (`void` и обычный Overworld с Terralith + Tectonic + BOP + RU + Alex's Caves + YUNG's + YUNG's Cave Biomes + Aquamirae + Repurposed Structures + MVS/MES/MNS/MSS + CTOV + L_Ender's Cataclysm + Lootr + Smart Mobs + 17 монорудными чанками) пройдены в GitHub Actions (run `44919176698`, commit `ba9fe26`, `20m37s`). Графический клиент и физика транспорта в движении ещё не проверены.**

Финальные результаты из CI (`44919176698`):

- **Inspect JARs:** `418` внешних JAR (`343` серверных / `75` только клиентских) + `1` собственный `longhaul-runtime-1.20.1-0.1.0.jar` (`419` JAR всего), `487` mod ID включая вложенные зависимости, **`Missing: 0`**, **`Range mismatches: 0`**, локальный JAR проверен на валидный `pack.mcmeta` (`pack_format: 15`).
- **Void integration test (`--heap 4096`):** `ready: true, exit_code: 0, world_border_175000: true, integration_pass: true, integration_fail: false, clean_exit: true`.
- **Normal Overworld generation test (`--heap 6144`):** `ready: true, exit_code: 0, world_border_175000: true, integration_pass: true, integration_fail: false, clean_exit: true`.
- **KubeJS:** `3/3` startup-скриптов и `13/13` server-скриптов загружены с `0` ошибок и `0` предупреждений; `client_scripts/01_longhaul_tooltips.js`, все `321` квест Heracles и `pack.mcmeta` проверены в `test_contracts.js` (`20/20` тестов).
- **Упаковка:** `Long-Haul-Legacy-2.0-alpha.15.mrpack` (`585,492` байт, `1,116,417,216` байт внешних загрузок), `Long-Haul-Legacy-2.0-alpha.15-Sources-and-Report.zip` (`1,229,883` байт).

Строка интеграционной проверки в обоих режимах:

```text
LH_INTEGRATION_PASS: items + contracts + shift + brigadier + sites + nbt_structures + archive_repair + production + recovery + photo + cc + camp + cargo + advancement sync
```

## Среда и состав проверки

- Minecraft `1.20.1`, Forge `47.4.10`, Java `17` (Temurin), Linux x86_64 (GitHub Actions runner).
- **418 внешних JAR + 1 собственный `longhaul-runtime-1.20.1-0.1.0.jar`** (`487` mod ID включая вложенные).
- **20/20 чистых JS-тестов** (`node long-haul-legacy-2/tools/test_contracts.js`), включая проверку `pack.mcmeta` (`pack_format: 15`) и формата `display.title` / `display.subtitle` во всех 321 квесте Heracles.
- **18 `.nbt` структур** (`16` узлов/руин `11×7×11` + `2` небесных острова-убежища `15×14×15`), **29 worldgen-оверрайдов руд (`17` ванильных + `12` модовых) + 17 монорудных богатых чанков (`6` ванильных + `11` модовых) + `longhaul:sky_refuges`**, **321 квест Heracles** + **300 серверных advancement**.

## Что нового проверено в живом Forge 47.4.10 (`alpha.15`)

| Проверка | Результат |
|---|---|
| Добавление `pack.mcmeta` (`pack_format: 15`) в `longhaul-runtime-1.20.1-0.1.0.jar` | `build_runtime.py` собирает JAR с `pack.mcmeta`; `inspect_alpha.py` и `test_contracts.js` подтверждают `pack_format == 15`, устраняя клиентское предупреждение `Missing metadata in pack mod:longhaul_runtime` / `failed to load a valid ResourcePackInfo` |
| Полный прогон сборки `2.0-alpha.15` (`418` внешних JAR, `487` mod ID, `321` квест Heracles, `eccentrictome:tome`) | `Missing: 0, Range mismatches: 0`; `void` (`4096 MB`) и `normal` Overworld (`6144 MB`) завершены с `LH_INTEGRATION_PASS` и `clean_exit: true` |

## Что этот тест НЕ подтверждает

- Запуск графического клиента (включая клиентский рендер, визуальную отрисовку GUI Heracles после правки и JEI/JER), импорт `.mrpack` в лаунчере.
- Физику и управление поездами Create, кораблями Valkyrien Skies/Eureka/Clockwork и самолётами в движении.
- Официальный `Thaumcraft` (отсутствует в виде нативного релиза для Forge `1.20.1`; заменён на `Primal Magick` + `Thaumon`).
- Финальное расширение с 418 до ~500 модов.
