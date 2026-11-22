# Long Haul Legacy 2.0 — Alpha 19 (`2.0-alpha.19`)

**Стабилизированная по клиентским фризам и серверно-проверенная альфа сборки, НЕ финальный релиз по полному ТЗ.** Импортируемый `.mrpack` предназначен для отдельного тестового профиля и нового обычного мира. Рабочая 1.1.1 не изменена. Исторические снимки прошлых альф сохранены в `history/alpha.1/` – `history/alpha.19/`.

## Что исправлено в `2.0-alpha.19` (против периодических 1–2 с фризов каждые 2–15 с)

1. **Предустановленный конфиг `overrides/config/DistantHorizons.toml`:**
   - По умолчанию Distant Horizons генерирует полноценные чанки (`INTERNAL_SERVER`/`FEATURES`) на 8 потоках и держит радиус `256` чанков, что на 440+ модах вызывает постоянную нагрузку на CPU и сотни МБ/с временных аллокаций (→ паузы G1GC по 1–2 с).
   - Теперь по умолчанию выставлены: `distantGeneratorMode = "PRE_EXISTING_ONLY"` (LOD строятся без фоновой генерации новых чанков во время игры), `lodChunkRenderDistanceRadius = 96`, `maxHorizontalResolution = "TWO_BLOCKS"`, `transparency = "FAKE"`, `vanillaFadeMode = "SINGLE_PASS"`, `enableSsao = false`, `lodBiomeBlending = 0`, `numberOfThreads = 2`, `threadRunTimeRatio = "0.5"`.
2. **Безопасная настройка `overrides/config/modernfix-mixins.properties`:**
   - Включены безопасные оптимизации памяти и ресурсов (`deduplicate_location=true`, `deduplicate_climate_parameters=true`, `compact_bit_storage=true`, `cache_strongholds=true`, `dynamic_sounds=true`, `packet_leak=true`).
   - Осознанно оставлены отключёнными `dynamic_resources=false` и `faster_item_rendering=false` (для совместимости с `Athena`/`Chipped` и рендером предметов `Clockwork`/`Valkyrien Skies`).
3. **Снижена частота пересканирования текстур ресурспаков в `overrides/config/entity_texture_features.json`:**
   - `textureUpdateFrequency_V2` переведён с `"Fast"` на `"Slow"` (`3–5 с`), что снижает нагрузку на главный рендер-поток при активных ресурспаках.
4. **Удалены дублирующие/конфликтные моды из `profiles/alpha19.json`:**
   - Убран `dynamic-lights` (дублировал `ryoamiclights` и делал лишние серверные сканы).
   - Убран `fps-reducer` (дублировал `dynamic-fps`).
   - Убран `saturn` (дублировал `ModernFix` + `FerriteCore` и перезаписывал миксины `ModernFix`).
   - Убран `does-it-tick` (вызывал блокировку выхода с сидений кораблей Valkyrien Skies / Eureka / Clockwork).
   - Убраны дубли-клоны `better-f3` (оставлен `betterf3`) и `trash-slot` (оставлен `trashslot`), а также повторы слагов в категориях.

Профиль сборки: `profiles/alpha19.json` (`444` внешних JAR + `longhaul-runtime` = `445` JAR всего, `477` mod ID, `321` квест Heracles).

## Установка и JVM-флаги (ВАЖНО против GC-фризов с ресурспаками!)

1. Скачайте `Long-Haul-Legacy-2.0-alpha.19.mrpack` (артефакт CI `long-haul-legacy-2.0-alpha.19`). **Сборка строго для Minecraft `1.20.1`, Forge `47.4.10` и Java `17`!**
2. Импортируйте `.mrpack` как **новый чистый отдельный профиль** в Prism Launcher / Modrinth App.
3. Выберите **Java 17 (Eclipse Temurin или Azul Zulu)** и выделите **8–10 ГБ RAM** (или **10–12 ГБ** с тяжёлыми ресурспаками 64x+). **Не используйте 14+ ГБ с дефолтным G1GC** — при росте кучи без конкурентного GC паузы Stop-The-World только удлиняются.
4. **Обязательно замените аргументы JVM на Shenandoah GC (убирает паузы G1GC по 1–2 с при Distant Horizons и ресурспаках):**
   ```text
   -Xms6G -Xmx10G -XX:+UnlockExperimentalVMOptions -XX:+UseShenandoahGC -XX:ShenandoahGCMode=iu -XX:+AlwaysPreTouch -XX:+DisableExplicitGC
   ```
   *(Если ваш JDK 17 — Oracle HotSpot без Shenandoah, используйте низкопаузный G1GC:)*
   ```text
   -Xms6G -Xmx10G -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=50 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=32M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1
   ```
5. Если после этого с конкретным ресурспаком всё равно остаётся единичный пик, снимите 30-секундный профиль встроенным `spark`: `/sparkc profiler start --only-ticks-over 150 --timeout 30`.
6. *(Опционально, на свой риск)* `DOOMED` устанавливается вручную с CurseForge в `mods/` отдельного профиля (или через `optional-mods/` и `--include-optional-mods`, см. `DOOMED.md` и `optional-mods/README.md`).

## Основные команды `/lh`

- `/lh help` — справка по командам.
- `/lh prospect`, `/lh snail status`, `/lh gas status` — геологоразведка всех 17 ванильных и модовых монорудных чанков, статус Бессмертной Улитки и уровень сезонного токсичного газа.
- `/lh terminal`, `/lh accept <id>`, `/lh status`, `/lh abort`, `/lh team <join|leave> [имя]` — приёмка и кооперативные контракты.
- `/lh stage`, `/lh vehicle status` — текущая промышленная стадия GameStages и одометр транспорта.
- `/lh catalog list|stage <1..4>|info <id>|verify <id>` — просмотр и серверная проверка 240 заказов каталога.
- `/lh sites`, `/lh site info <id>`, `/lh site commission <id>`, `/lh site produce <id> <bootstrap|industrial>`, `/lh site archive`, `/lh site repair_archive` — разведка, ввод в строй, ремонт архива и локальное производство на 10 стратегических узлах.
- `/lh recovery list|info|survey|restore` — обследование и восстановление 6 разрушенных объектов.
- `/lh photo report|status`, `/lh cc challenge|verify|status` — полевые фотоотчёты Exposure и телеметрия CC: Tweaked.
- `/lh camp deploy|pack|list`, `/lh route begin|gate|finish|start|abort|quota|list`, `/lh cargo issue|deliver` — лагеря, маршруты без телепортации с квотой чанклоадинга (`<= 2`) и серверные грузовые накладные.

## Воспроизведение и CI

```bash
node long-haul-legacy-2/tools/test_contracts.js
python3 long-haul-legacy-2/tools/generate_structures.py
python3 long-haul-legacy-2/tools/generate_worldgen.py
python3 long-haul-legacy-2/tools/generate_alpha_quests.py
python3 long-haul-legacy-2/tools/assemble_alpha.py --profile long-haul-legacy-2/profiles/alpha19.json
python3 long-haul-legacy-2/tools/generate_modlist.py
python3 long-haul-legacy-2/tools/prepare_server.py --mode void
python3 long-haul-legacy-2/tools/build_runtime.py
python3 long-haul-legacy-2/tools/inspect_alpha.py
python3 long-haul-legacy-2/tools/smoke_server.py --heap 5120 --timeout 450 --world-label "alpha19 void integration test"
python3 long-haul-legacy-2/tools/prepare_server.py --mode normal --skip-forge-install
python3 long-haul-legacy-2/tools/smoke_server.py --heap 7168 --timeout 960 --world-label "alpha19 normal overworld test"
python3 long-haul-legacy-2/tools/package_alpha.py --version 2.0-alpha.19
```
