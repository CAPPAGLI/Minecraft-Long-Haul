# Long Haul Legacy 2.0 — Alpha 20 (`2.0-alpha.20`)

**Стабилизированная по клиентским фризам, потреблению RAM (<= 12 ГБ) и серверно-проверенная альфа сборки, НЕ финальный релиз по полному ТЗ.** Импортируемый `.mrpack` предназначен для отдельного тестового профиля и нового обычного мира. Рабочая 1.1.1 не изменена. Исторические снимки прошлых альф сохранены в `history/alpha.1/` – `history/alpha.19/`.

## Что исправлено в `2.0-alpha.20` (против 247-с фриза при входе, 12 ГБ OOM и близких ботов)

1. **Устранён многоминутный фриз генерации мира при первом входе (`26_hard_features_and_territory.js` + `24_immortal_snail.js`):**
   - Исправлена ошибка, из-за которой `lhFirstJoinRandomSpawn` / `lhFindSafeRespawnY` делали до 3 синхронных блокирующих проб далёких чанков (`getChunkBlocking`) в `ServerEvents.tick` по пустому миру.
   - Теперь при `allowPlatform === false` проверяются только уже загруженные чанки (`hasChunkAt`), а генерация новой колонки допускается не более 1 раза в финальном выборе; защищены также `lhIsPlayerTrappedOrBedrock` и `lhProspectChunk`.
2. **Оптимизация RAM под лимит 10–12 ГБ (по практикам ATM9 / Prominence II для 440+ модов на Forge 1.20.1):**
   - `overrides/config/modernfix-mixins.properties`: включён `mixin.perf.dynamic_resources=true` (экономит ~3–5 ГБ Java Heap на 440+ модах; `faster_item_rendering=false` сохранён для `Valkyrien Skies` / `Clockwork`), плюс `dynamic_structure_manager=true`, `nbt_memory_usage=true`, `cache_blockstate_cache_arrays=true`, `world_leaks=true`.
   - `overrides/config/jei/jei-client.ini`: отключены дублирующие поисковые деревья JEI (`modNameSearchMode`, `tooltipSearchMode`, `tagSearchMode`, `colorSearchMode`, `resourceLocationSearchMode` = `DISABLED` и `lookupFluidContentsEnabled = false`), т.к. поиск ведёт EMI — это экономит Heap при `278,900` рецептах.
   - `overrides/config/DistantHorizons.toml`: переведён на схему DH 3.3.3 (`_version = 5`, `generatorPlan = "DISABLED"`, `chunkGeneratorMode = "PRE_EXISTING_ONLY"`, `lodChunkRenderDistanceRadius = 64`, `numberOfThreads = 2`, `threadPriority = 3`, `transparency = "DISABLED"` — без предупреждения валидатора).
   - `overrides/config/embeddium-options.json` (`chunk_builder_threads = 4`), `overrides/config/xaeroworldmap.txt` (`showFlowers:false`), `overrides/config/defaultoptions/options.txt` (`renderDistance:10`, `simulationDistance:6`).
3. **Случайное расселение стартовых ботов-компаний по расширенной территории (`00_contract_engine.js`, `27_openttd_companies.js`, `26_hard_features_and_territory.js`):**
   - Исправлен баг `ensureBots`, возвращавший штабы стартовых ботов на `(7,2)`/`(-7,-2)`. Добавлена `scatterDefaultBots`, которая при открытии расширенной территории (Глава 1+ / `ch00`) случайно разносит стартовых AI-конкурентов в кольцо `28%..85%` от радиуса открытой карты (на 1-м этапе — `~17..51` секторов = `4,352..13,056` блоков от спауна) с сохранением минимальной дистанции друг от друга.
4. **Дополнительно в ветке alpha.20:**
   - Линейная сериализация `YABN` (`O(N)` вместо `O(N^2)`) для 4,700+ файлов Heracles, отключён авторебилд тегов `AdditionalPlacements` при загрузке, защита `DhChunkyAccessorMixin` и `SmallSpawnMixin` (`3×3` spawn chunks).

Профиль сборки: `profiles/alpha20.json` (`assembly/lock.json`).

## Установка и JVM-флаги (ВАЖНО при 10–12 ГБ RAM и ресурспаках!)

1. Скачайте `Long-Haul-Legacy-2.0-alpha.20.mrpack` (артефакт CI) или синхронизируйте профиль через `long-haul-legacy-2\sync_instance.bat --skip-mods`. **Сборка строго для Minecraft `1.20.1`, Forge `47.4.10` и Java `17`!**
2. Импортируйте `.mrpack` как **новый чистый отдельный профиль** в Prism Launcher / Modrinth App / Legacy Launcher.
3. Выберите **Java 17 (Eclipse Temurin или Azul Zulu)** и выделите **10–12 ГБ RAM** (для ПК с 16 ГБ ОЗУ оптимально **10240–12288 МБ**, не выше 12 ГБ, чтобы оставалась память под Windows и нативные буферы).
   - *Примечание по PBR-ресурспакам:* тяжёлые PBR-паки (`512x` / `AVPBR Retextured`) вместе с шейдерами `Oculus` дополнительно расходуют 2–4 ГБ RAM/VRAM; при лимите 12 ГБ рекомендуется отключить тяжёлые PBR-паки на период первых запусков или использовать `128x`/`Vanilla`.
4. **Рекомендуемые аргументы JVM — низкопаузный G1GC (стабилен на Windows + Java 17; не используйте `-XX:ShenandoahGCMode=iu`, так как в Temurin 17 режим `iu` может падать с `EXCEPTION_ACCESS_VIOLATION`):**
   ```text
   -Xms4G -Xmx12G -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=50 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=16M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 -XX:ReservedCodeCacheSize=512M
   ```
   *(Если в Legacy Launcher включён выбор «Оптимизированные аргументы», просто выберите **`Использовать G1 GC`** и оставьте поле «Аргументы JVM» пустым.)*
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
