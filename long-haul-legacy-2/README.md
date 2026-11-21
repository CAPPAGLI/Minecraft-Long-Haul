# Long Haul Legacy 2.0 — Alpha 17 (`2.0-alpha.17`)

**Расширенная серверно-проверенная альфа сборки, НЕ финальный релиз по полному ТЗ.** Импортируемый `.mrpack` предназначен для отдельного тестового профиля и нового обычного мира. Рабочая 1.1.1 не изменена. Исторические снимки прошлых альф сохранены в `history/alpha.1/` – `history/alpha.17/`.

## Что нового в `2.0-alpha.17`

- **Добавлены шахматы и шашки (`ultimate-chess`):**
  - Запрашивавшийся проект `Chess & Checks` (`https://modrinth.com/mod/chess-and-checks`, ID `qnDougSR`) был удалён/скрыт автором на Modrinth (`Project not found`, на CurseForge также отсутствует).
  - Вместо него подключён **`Ultimate Chess`** (`ultimate-chess`, `chessmod-forge-1.1.4-1.20.jar`, Forge `1.20–1.20.1`, Client & Server) — полноценно добавляет в игру доски и фигуры для **шахмат и шашек** (включая окрашиваемые наборы и золотые доски).
- **Добавлена папка `optional-mods/` и поддержка `--include-optional-mods` для локальных/CurseForge `.jar`:**
  - В `long-haul-legacy-2/optional-mods/` размещены `README.md` и `curseforge-addons.json` (с метаданными `DOOMED` `1589967` и `Doomed: Guns`).
  - `tools/prepare_server.py`, `tools/inspect_alpha.py` и `tools/package_alpha.py` обновлены флагом `--include-optional-mods` (и в `package_alpha.py` снято жёсткое ограничение `len(local_jars) == 1`): теперь при желании можно локально положить свои `.jar` в `optional-mods/` или `overrides/mods/` и собрать/проверить собственный `.mrpack` без ошибок сборки.
- **Расширение до `438` внешних JAR (`509` mod ID с учётом встроенных зависимостей):**
  - **Мир, мобы и кулинария:** `[Let's Do] Vinery` (`lets-do-vinery`, виноградники и виноделие), `Nyf's Spiders` (`nyfs-spiders`, реалистичное лазание пауков по стенам и потолкам).
  - **Клиентские визуальные и оптимизационные моды (`client_only`):** `Cull Leaves` (`cull-leaves` + `MidnightLib`), `Eating Animations` (`eating-animations` + `GroovyModLoader`).
  - *(Отклонено в CI-проверке `4213462`)*: `macaws-biomes-o-plenty` (`1.20.1-1.6`) требует `biomesoplenty >= 19.0.0.80`, тогда как сборка фиксирует `BiomesOPlenty 18.0.0.592` ради стабильности мирогенерации.
- *(Унаследовано из `2.0-alpha.16` и более ранних)* `Distant Horizons` (`distanthorizons 3.3.0..3.3.2`, обходящий краш `3.3.3` с `Chunky`), `Create 6.0.8+` аддоны (`create-radars`, `hypertube`, `create-mobile-packages`), `pack.mcmeta` (`pack_format: 15`) в `longhaul-runtime-1.20.1-0.1.0.jar`, исправленный JSON-формат Heracles (`ExtraCodecs.COMPONENT` для всех 321 квеста), стартовый `Eccentric Tome` (`eccentrictome:tome`), `17` монорудных чанков (`/lh prospect`), `Smart Mobs`, Death Stranding Voidout + `Corpse`, летающие острова (`Y=172..212`) + сезонный токсичный газ (`Y=114`), `AdPother`, `Primal Magick`, `ParCool!`, Бессмертная Улитка и 240 заказов каталога.

Профиль сборки: `profiles/alpha17.json` (динамически разрешаемый список и хэши в CI → артефакт `Long-Haul-Legacy-2.0-alpha.17.mrpack` и `Long-Haul-Legacy-2.0-alpha.17-Sources-and-Report.zip`). Подробности проверки: `TEST-REPORT.md`, машинный статус: `STATUS.json`.

## Установка тестового профиля (ВАЖНО: чистый профиль Minecraft 1.20.1 / Forge 47.4.10 / Java 17!)

1. Скачайте `Long-Haul-Legacy-2.0-alpha.17.mrpack` (артефакт CI `long-haul-legacy-2.0-alpha.17`). **Не запускайте в профиле Forge 1.21.1, Java 21 или Java 25 — сборка строго для Minecraft `1.20.1`, Forge `47.4.10` и Java `17`!**
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

| Требование | Состояние `2.0-alpha.17` |
|---|---|
| ~500 полезных модов | В процессе: 438 внешних JAR (+1 runtime = 439 JAR / 509 mod ID включая встроенные) |
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
python3 long-haul-legacy-2/tools/assemble_alpha.py --profile long-haul-legacy-2/profiles/alpha17.json
python3 long-haul-legacy-2/tools/generate_modlist.py
python3 long-haul-legacy-2/tools/prepare_server.py --mode void
python3 long-haul-legacy-2/tools/build_runtime.py
python3 long-haul-legacy-2/tools/inspect_alpha.py
python3 long-haul-legacy-2/tools/smoke_server.py --heap 4096 --timeout 450 --world-label "alpha17 void integration test"
python3 long-haul-legacy-2/tools/prepare_server.py --mode normal --skip-forge-install
python3 long-haul-legacy-2/tools/smoke_server.py --heap 7168 --timeout 960 --world-label "alpha17 normal overworld test"
python3 long-haul-legacy-2/tools/package_alpha.py --version 2.0-alpha.17
```
