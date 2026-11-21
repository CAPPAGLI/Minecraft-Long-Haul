# Long Haul Legacy 2.0 — Alpha 16 — протокол проверки

## Итог

**Оба headless-теста на выделенном сервере Forge 47.4.10 (`void` и обычный Overworld с Terralith + Tectonic + BOP + RU + Alex's Caves + YUNG's + YUNG's Cave Biomes + Aquamirae + Repurposed Structures + MVS/MES/MNS/MSS + CTOV + L_Ender's Cataclysm + Friends&Foes + It Takes a Pillage + Distant Horizons + Lootr + Smart Mobs + 17 монорудными чанками) пройдены в GitHub Actions (run `44939657123`, commit `77754ce`, `18m18s`). Графический клиент и физика транспорта в движении ещё не проверены.**

Финальные результаты из CI (`44939657123`):

- **Inspect JARs:** `432` внешних JAR (`353` серверных / `79` только клиентских) + `1` собственный `longhaul-runtime-1.20.1-0.1.0.jar` (`433` JAR всего), `501` mod ID включая вложенные зависимости, **`Missing: 0`**, **`Range mismatches: 0`**.
- **Void integration test (`--heap 4096`):** `ready: true, exit_code: 0, world_border_175000: true, integration_pass: true, integration_fail: false, clean_exit: true`.
- **Normal Overworld generation test (`--heap 7168`):** `ready: true, exit_code: 0, world_border_175000: true, integration_pass: true, integration_fail: false, clean_exit: true`.
- **KubeJS:** `3/3` startup-скриптов и `13/13` server-скриптов загружены с `0` ошибок и `0` предупреждений; `client_scripts/01_longhaul_tooltips.js`, все `321` квест Heracles и `pack.mcmeta` проверены в `test_contracts.js` (`20/20` тестов).
- **Упаковка:** `Long-Haul-Legacy-2.0-alpha.16.mrpack` (`587,659` байт, `1,163,362,627` байт внешних загрузок), `Long-Haul-Legacy-2.0-alpha.16-Sources-and-Report.zip` (`1,246,347` байт).

Строка интеграционной проверки в обоих режимах:

```text
LH_INTEGRATION_PASS: items + contracts + shift + brigadier + sites + nbt_structures + archive_repair + production + recovery + photo + cc + camp + cargo + advancement sync
```

## Среда и состав проверки

- Minecraft `1.20.1`, Forge `47.4.10`, Java `17` (Temurin), Linux x86_64 (GitHub Actions runner).
- **432 внешних JAR + 1 собственный `longhaul-runtime-1.20.1-0.1.0.jar`** (`501` mod ID включая вложенные).
- **20/20 чистых JS-тестов** (`node long-haul-legacy-2/tools/test_contracts.js`), включая проверку `pack.mcmeta` (`pack_format: 15`) и формата `display.title` / `display.subtitle` во всех 321 квесте Heracles.
- **18 `.nbt` структур**, **29 worldgen-оверрайдов руд + 17 монорудных богатых чанков + `longhaul:sky_refuges`**, **321 квест Heracles** + **300 серверных advancement**.

## Что нового проверено в живом Forge 47.4.10 (`alpha.16`)

| Проверка | Результат |
|---|---|
| `distanthorizons` (`3.3.0..3.3.2`) + `Chunky` + `Valkyrien Skies 2.4.11` + `Alex's Caves 2.0.2` | Отловлен и обойдён upstream-краш `DistantHorizons 3.3.3` (`ChunkyAccessor.bindOnGenerationProgressEvent` → `IllegalStateException: Chunky is not loaded` в run `44938926943`); с веткой `3.3.0..3.3.2` оба теста (`void` и `normal`) и остановка всех 3 измерений DH завершены без ошибок |
| Create `6.0.8+` и транспортные аддоны (`create-radars`, `hypertube`, `create-mobile-packages`) | Полная совместимость с Create `6.0.8` и Valkyrien Skies `2.4.11` в живом запуске (`Missing: 0, Range mismatches: 0`) |
| Мир и контент (`friends-and-foes-forge`, `friends-and-foes-flowery-mooblooms-forge`, `friends-and-foes-beekeeper-hut-forge`, `it-takes-a-pillage`, `villager-names-serilum`, `lets-do-herbalbrews`) + клиентские QoL (`3dskinlayers`, `not-enough-animations`, `extreme_sound_muffler`, `justenoughbreeding`) | `432` внешних JAR (`501` mod ID), `void` (`4096 MB`) и `normal` Overworld (`7168 MB`) завершены с `LH_INTEGRATION_PASS` и `clean_exit: true` |

## Что этот тест НЕ подтверждает

- Запуск графического клиента (включая клиентский LOD-рендер Distant Horizons с Oculus 1.8.0 / Embeddium 0.3.31 и визуальную отрисовку GUI Heracles), импорт `.mrpack` в лаунчере.
- Физику и управление поездами Create, кораблями Valkyrien Skies/Eureka/Clockwork и самолётами в движении.
- Официальный `Thaumcraft` (заменён на `Primal Magick` + `Thaumon`) и опциональный CurseForge-only `DOOMED` (см. `DOOMED.md`).
- Дальнейшее расширение с 432 до ~500 внешних JAR (сейчас 433 JAR / 501 mod ID).
