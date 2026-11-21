# Long Haul Legacy 2.0 — Alpha 17 — протокол проверки

## Итог

**Оба headless-теста на выделенном сервере Forge 47.4.10 (`void` и обычный Overworld с Terralith + Tectonic + BOP + RU + Alex's Caves + YUNG's + YUNG's Cave Biomes + Aquamirae + Repurposed Structures + MVS/MES/MNS/MSS + CTOV + L_Ender's Cataclysm + Friends&Foes + It Takes a Pillage + Distant Horizons + Ultimate Chess + Vinery + Nyf's Spiders + Lootr + Smart Mobs + 17 монорудными чанками) пройдены в GitHub Actions (run `44949453172`, commit `c7d90b7`, `16m44s`). Графический клиент и физика транспорта в движении ещё не проверены.**

Финальные результаты из CI (`44949453172`):

- **Inspect JARs:** `438` внешних JAR (`357` серверных / `81` только клиентских) + `1` собственный `longhaul-runtime-1.20.1-0.1.0.jar` (`439` JAR всего), `509` mod ID включая вложенные зависимости, **`Missing: 0`**, **`Range mismatches: 0`**.
- **Void integration test (`--heap 4096`):** `ready: true, exit_code: 0, world_border_175000: true, integration_pass: true, integration_fail: false, clean_exit: true`.
- **Normal Overworld generation test (`--heap 7168`):** `ready: true, exit_code: 0, world_border_175000: true, integration_pass: true, integration_fail: false, clean_exit: true`.
- **KubeJS:** `3/3` startup-скриптов и `13/13` server-скриптов загружены с `0` ошибок и `0` предупреждений; `client_scripts/01_longhaul_tooltips.js`, все `321` квест Heracles и `pack.mcmeta` проверены в `test_contracts.js` (`20/20` тестов).
- **Упаковка:** `Long-Haul-Legacy-2.0-alpha.17.mrpack` (`589,908` байт, `1,178,021,903` байт внешних загрузок), `Long-Haul-Legacy-2.0-alpha.17-Sources-and-Report.zip` (`1,256,971` байт).

Строка интеграционной проверки в обоих режимах:

```text
LH_INTEGRATION_PASS: items + contracts + shift + brigadier + sites + nbt_structures + archive_repair + production + recovery + photo + cc + camp + cargo + advancement sync
```

## Среда и состав проверки

- Minecraft `1.20.1`, Forge `47.4.10`, Java `17` (Temurin), Linux x86_64 (GitHub Actions runner).
- **438 внешних JAR + 1 собственный `longhaul-runtime-1.20.1-0.1.0.jar`** (`509` mod ID включая вложенные).
- **20/20 чистых JS-тестов** (`node long-haul-legacy-2/tools/test_contracts.js`), включая проверку `pack.mcmeta` (`pack_format: 15`) и формата `display.title` / `display.subtitle` во всех 321 квесте Heracles.
- **18 `.nbt` структур**, **29 worldgen-оверрайдов руд + 17 монорудных богатых чанков + `longhaul:sky_refuges`**, **321 квест Heracles** + **300 серверных advancement**.

## Что нового проверено в живом Forge 47.4.10 (`alpha.17`)

| Проверка | Результат |
|---|---|
| `ultimate-chess` (`chessmod-forge-1.1.4-1.20.jar`, Chess & Checkers, замена удалённого `chess-and-checks`) | Загружен на сервере без конфликтов (`Missing: 0, Range mismatches: 0`) в обоих прогонах |
| `lets-do-vinery`, `nyfs-spiders`, клиентские `cull-leaves` (+ `midnightlib`), `eating-animations` (+ `gml`) | `438` внешних JAR (`509` mod ID), `void` (`4096 MB`) и `normal` Overworld (`7168 MB`) завершены с `LH_INTEGRATION_PASS` и `clean_exit: true` |
| Отклонённый в CI `4213462` кандидат `macaws-biomes-o-plenty` | Отловлено несовпадение `biomesoplenty >= 19.0.0.80` vs зафиксированный `18.0.0.592`; кандидат исключён, мир и worldgen BOP `18.0.0.592` сохранены |
| Инструментарий `optional-mods/` (`--include-optional-mods` в `prepare_server.py`, `inspect_alpha.py`, `package_alpha.py`) | Проверена синтаксическая чистота (`py_compile`) и CLI-поддержка локального/CurseForge-бандлинга без нарушения политики репозитория |

## Что этот тест НЕ подтверждает

- Запуск графического клиента (включая клиентский рендер `Ultimate Chess`, `Cull Leaves`, `Eating Animations`, `Distant Horizons` с `Oculus 1.8.0` / `Embeddium 0.3.31` и визуальную отрисовку GUI Heracles), импорт `.mrpack` в лаунчере.
- Физику и управление поездами Create, кораблями Valkyrien Skies/Eureka/Clockwork и самолётами в движении.
- Официальный `Thaumcraft` (заменён на `Primal Magick` + `Thaumon`) и опциональный CurseForge-only `DOOMED` (см. `DOOMED.md` и `optional-mods/README.md`).
- Дальнейшее расширение с 438 до ~500 внешних JAR (сейчас 439 JAR / 509 mod ID).
