# Long Haul Legacy 2.0 — Alpha 19 — протокол проверки

## Итог

**Оба headless-теста на выделенном сервере Forge 47.4.10 (`void` и обычный Overworld) пройдены в GitHub Actions (run `44972514241`, commit `e512fbd`, `17m2s`). Изменения направлены на устранение периодических 1–2 с фризов каждые 2–15 с при Distant Horizons и установке ресурспака. Графический клиент и физика транспорта в движении ещё не проверены.**

Финальные результаты из CI (`44972514241`):

- **Inspect JARs:** `444` внешних JAR (`359` серверных / `85` только клиентских) + `1` собственный `longhaul-runtime-1.20.1-0.1.0.jar` (`445` JAR всего), `477` mod ID включая вложенные зависимости, **`Missing: 0`**, **`Range mismatches: 0`**.
- **Void integration test (`--heap 5120`):** `ready: true, exit_code: 0, world_border_175000: true, integration_pass: true, integration_fail: false, clean_exit: true`.
- **Normal Overworld generation test (`--heap 7168`):** `ready: true, exit_code: 0, world_border_175000: true, integration_pass: true, integration_fail: false, clean_exit: true`.
- **KubeJS:** `3/3` startup-скриптов и `13/13` server-скриптов загружены с `0` ошибок и `0` предупреждений.
- **Упаковка:** `Long-Haul-Legacy-2.0-alpha.19.mrpack` (`593,769` байт, `1,182,720,136` байт внешних загрузок), `Long-Haul-Legacy-2.0-alpha.19-Sources-and-Report.zip` (`1,272,328` байт).

Строка интеграционной проверки в обоих режимах:

```text
LH_INTEGRATION_PASS: items + contracts + shift + brigadier + sites + nbt_structures + archive_repair + production + recovery + photo + cc + camp + cargo + advancement sync
```

## Что изменено и проверено в `alpha.19`

| Изменение | Цель и результат |
|---|---|
| Добавлен `overrides/config/DistantHorizons.toml` (`_version = 4`) | `PRE_EXISTING_ONLY`, радиус `96`, `TWO_BLOCKS`, `FAKE` transparency, `SINGLE_PASS`, `enableSsao = false`, `lodBiomeBlending = 0`, `numberOfThreads = 2`, `threadRunTimeRatio = "0.5"` — убирает фоновый штурм генерации/GC каждые 2–15 с |
| Добавлен `overrides/config/modernfix-mixins.properties` | Включены `deduplicate_location`, `deduplicate_climate_parameters`, `compact_bit_storage`, `cache_strongholds`, `dynamic_sounds`, `packet_leak`; `dynamic_resources=false` и `faster_item_rendering=false` оставлены выключенными ради `Athena`/`Clockwork` |
| Добавлен `overrides/config/entity_texture_features.json` | `textureUpdateFrequency_V2: "Slow"` снижает нагрузку ETF при активных ресурспаках |
| Очищен `profiles/alpha19.json` | Исключены дублирующие и конфликтные моды: `dynamic-lights`, `fps-reducer`, `saturn`, `does-it-tick` (блокировал выход из сидений VS), `better-f3`, `trash-slot` |
| Обновлён `README.md` | Добавлены проверенные JVM-флаги Java 17 Shenandoah GC (`-XX:+UseShenandoahGC -XX:ShenandoahGCMode=iu`) и fallback G1GC против GC-пауз с ресурспаками |

## Что этот тест НЕ подтверждает

- Запуск графического клиента (включая замер frame-time с ресурспаком, `Distant Horizons`, `Oculus 1.8.0` и `Embeddium 0.3.31`), импорт `.mrpack` в лаунчере.
- Физику и управление поездами Create, кораблями Valkyrien Skies/Eureka/Clockwork и самолётами в движении.
- Официальный `Thaumcraft` (заменён на `Primal Magick` + `Thaumon`) и опциональный CurseForge-only `DOOMED`.
