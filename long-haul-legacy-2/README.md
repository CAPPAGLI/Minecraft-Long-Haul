# Long Haul Legacy 2.0 — Alpha 18 (`2.0-alpha.18`)

**Расширенная серверно-проверенная альфа сборки, НЕ финальный релиз по полному ТЗ.** Импортируемый `.mrpack` предназначен для отдельного тестового профиля и нового обычного мира. Рабочая 1.1.1 не изменена. Исторические снимки прошлых альф сохранены в `history/alpha.1/` – `history/alpha.18/`.

## Что нового в `2.0-alpha.18`

- **Расширение до `452` внешних JAR (`453` JAR всего с учётом `longhaul-runtime`, `524` mod ID с учётом встроенных зависимостей):**
  - **Create и структуры:** `Create: Pattern Schematics` (`create-pattern-schematics`), `Create: Additional Lights` (`create-additional-lights`), `Create: Structures Arise` (`create-structures-arise`, Create `6.0.4+`).
  - **Мир, строительство и кулинария:** `Villager Recruits` (`villager-recruits`, наёмная охрана караванов и баз), `Straw Statues` (`straw-statues`), `Delightful Sandwiches` (`delightful-sandwiches`).
  - **Оптимизация и клиентский визуал (`performance` / `client_only`):** `Mobtimizations` (`mobtimizations`), `Subtle Effects` (`subtle-effects`, с автоподбором версии под Forge `47.4.10`), `[ETF] Entity Texture Features` (`entitytexturefeatures`), `Model Gap Fix` (`modelfix`), `Jade VS` (`jade-vs`, отмечен как `client_only`), `Shulker Box Tooltip` (`shulkerboxtooltip`), `Overflowing Bars` (`overflowing-bars`, + `Puzzles Lib`), `Raised` (`raised`).
- **Тюнинг и отловленные в CI конфликты:**
  - **Защита `MassDatapackResolver` (Valkyrien Skies 2.4.11):** исключён `every-compat` (`Every Compat`), вызывавший `OutOfMemoryError` на старте сервера из-за комбинаторного взрыва blockstates по всем модам биомов и декора; выделенный heap `smoke-void` повышен с `4096` до `5120 MB`.
  - **Исключён `villager-workers`:** его стартовая генерация таблицы цен (`VillagerPriceTable.build`) вызывала `EmeraldsForVillagerTypeItem` с конфликтом миксинов `Forgified Fabric API` + `MoreJS`.
  - **Усилен `tools/inspect_alpha.py`:** добавлен разбор `Implementation-Version` из `META-INF/MANIFEST.MF` при `${file.jarVersion}` и проверка обязательных `BOTH`/`SERVER`-зависимостей серверных модов на `client_only` моды (предотвращает краши вроде `jade_vs -> jade`).
  - **Усилен `tools/assemble_alpha.py`:** версии из `audit/candidates.json` теперь также проверяются на совместимость с Forge `47.4.10` (что автоматически переключило `subtle-effects` с версии под `47.4.14+` на совместимую с `47.4.10`).
  - **Подсказки в JEI/EMI (`client_scripts/01_longhaul_tooltips.js`):** добавлены явные красные предупреждения об отключении на `minecraft:ender_chest`, `supplementaries:sack`, `supplementaries:safe`, `quark:backpack` и `#minecraft:shulker_boxes` (синхронизировано с серверным запретом в `20_basics.js`).
- *(Унаследовано из `2.0-alpha.17` и более ранних)* `Ultimate Chess` (`ultimate-chess` — шахматы и шашки), папка `optional-mods/` и флаг `--include-optional-mods` для локальных CurseForge `.jar`, `Distant Horizons` (`3.3.0..3.3.2`), `Create 6.0.8+`, `pack.mcmeta` (`pack_format: 15`), `321` квест Heracles, `Eccentric Tome`, `17` монорудных чанков, `Smart Mobs`, `Nyf's Spiders`, `[Let's Do] Vinery` и `HerbalBrews`, Voidout + `Corpse`, летающие острова + сезонный токсичный газ, `AdPother`, `Primal Magick`, `ParCool!`, Бессмертная Улитка и 240 заказов каталога.

Профиль сборки: `profiles/alpha18.json` (динамически разрешаемый список и хэши в CI → артефакт `Long-Haul-Legacy-2.0-alpha.18.mrpack` и `Long-Haul-Legacy-2.0-alpha.18-Sources-and-Report.zip`). Подробности проверки: `TEST-REPORT.md`, машинный статус: `STATUS.json`.

## Установка тестового профиля (ВАЖНО: чистый профиль Minecraft 1.20.1 / Forge 47.4.10 / Java 17!)

1. Скачайте `Long-Haul-Legacy-2.0-alpha.18.mrpack` (артефакт CI `long-haul-legacy-2.0-alpha.18`). **Не запускайте в профиле Forge 1.21.1, Java 21 или Java 25 — сборка строго для Minecraft `1.20.1`, Forge `47.4.10` и Java `17`!**
2. Импортируйте `.mrpack` как **новый чистый отдельный профиль** в Prism Launcher / Modrinth App (или очистите старую папку `mods/` перед обновлением, чтобы не оставался удалённый `AkashicTome-1.7-27.jar` и старые версии модов).
3. Выберите **Java 17** и выделите **8–10 ГБ RAM** (`-Xms4096M -Xmx8192M` или `10240M` на системе с 32 ГБ RAM; не ставьте `-Xmx24G`).
4. Создайте **новый обычный мир**.
5. *(Опционально, на свой риск)* Если нужен `DOOMED`, установите его вручную с CurseForge в папку `mods/` отдельного профиля (или через `optional-mods/` и `--include-optional-mods`, см. `DOOMED.md` и `optional-mods/README.md`).

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

## Что ещё осталось до финального релиза

| Требование | Состояние `2.0-alpha.18` |
|---|---|
| ~500 полезных модов | В процессе: 452 внешних JAR (+1 runtime = 453 JAR / 524 mod ID включая встроенные) |
| Клиентское, графическое и транспортное тестирование | Не проведено: проверен только headless Linux-сервер (void + обычный Overworld) |
| Полная интеграция всех 240 спецификаций из `design/quest-catalog.*` | Реализовано в Heracles (321 квест, 12 групп, 300 advancement) и сервере (`/lh catalog`, все 19 `verification_type` + сюжет «Ушёл за хлебом») |
| Физические NBT-структуры городов и объектов восстановления | Реализованы 18 `.nbt` шаблонов (16 узлов/руин `11×7×11` + 2 летающих острова `15×14×15`) + авторазмещение и ремонт архива |
| Проверка физики поездов/кораблей VS в клиенте | Не проведена в графическом клиенте |

## Воспроизведение и CI

```bash
node long-haul-legacy-2/tools/test_contracts.js
python3 long-haul-legacy-2/tools/generate_structures.py
python3 long-haul-legacy-2/tools/generate_worldgen.py
python3 long-haul-legacy-2/tools/generate_alpha_quests.py
python3 long-haul-legacy-2/tools/assemble_alpha.py --profile long-haul-legacy-2/profiles/alpha18.json
python3 long-haul-legacy-2/tools/generate_modlist.py
python3 long-haul-legacy-2/tools/prepare_server.py --mode void
python3 long-haul-legacy-2/tools/build_runtime.py
python3 long-haul-legacy-2/tools/inspect_alpha.py
python3 long-haul-legacy-2/tools/smoke_server.py --heap 5120 --timeout 450 --world-label "alpha18 void integration test"
python3 long-haul-legacy-2/tools/prepare_server.py --mode normal --skip-forge-install
python3 long-haul-legacy-2/tools/smoke_server.py --heap 7168 --timeout 960 --world-label "alpha18 normal overworld test"
python3 long-haul-legacy-2/tools/package_alpha.py --version 2.0-alpha.18
```
