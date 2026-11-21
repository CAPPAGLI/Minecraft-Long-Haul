# Long Haul Legacy 2.0 — Alpha 15 (`2.0-alpha.15`)

**Расширенная серверно-проверенная альфа сборки, НЕ финальный релиз по полному ТЗ.** Импортируемый `.mrpack` предназначен для отдельного тестового профиля и нового обычного мира. Рабочая 1.1.1 не изменена. Исторические снимки прошлых альф сохранены в `history/alpha.1/` – `history/alpha.15/`.

## Что нового в `2.0-alpha.15`

- **Исправлено предупреждение загрузки клиента (`failed to load a valid ResourcePackInfo`):**
  - В `runtime-mod/src/main/resources/pack.mcmeta` добавлен валидный `pack.mcmeta` (`"pack_format": 15` для Minecraft `1.20.1`) и пересобран `overrides/mods/longhaul-runtime-1.20.1-0.1.0.jar`.
  - Устранено клиентское предупреждение `Missing metadata in pack mod:longhaul_runtime` → `File Mod File: ... longhaul-runtime-1.20.1-0.1.0.jar failed to load a valid ResourcePackInfo`, из-за которого открывался экран `LoadingErrorScreen` («1 warning has occurred during loading») и срабатывал Crash Assistant.
  - В `tools/inspect_alpha.py` и `tools/test_contracts.js` добавлены автоматические проверки наличия `pack.mcmeta` (`pack_format: 15`) в локальном моде.
- *(Унаследовано из `2.0-alpha.14` и более ранних)* Исправленный JSON-формат Heracles (`ExtraCodecs.COMPONENT` для всех 321 квеста), стартовый `Eccentric Tome` (`eccentrictome:tome`, дубликат `akashic-tome` удалён), `418` внешних JAR (`487` mod ID) с `create-encased`, `create-vibrant-vaults`, `create_factory_logistics`, `escalated`, `create-6.0.8-backported-fixes`, `yungs-cave-biomes`, `mes/mns/mss/mvs`, `ct-overhaul-village`, `l_enders-cataclysm`, `neruina`, `lmd`, `no-chat-reports`, `rubidium-extra`, `17` монорудных чанков (`/lh prospect`), `Smart Mobs`, Death Stranding Voidout + `Corpse`, летающие острова (`Y=172..212`) + сезонный токсичный газ (`Y=114`), `AdPother`, `Primal Magick`, `ParCool!`, Бессмертная Улитка и 240 заказов каталога.

Профиль сборки: `profiles/alpha15.json` (динамически разрешаемый список и хэши в CI → артефакт `Long-Haul-Legacy-2.0-alpha.15.mrpack` и `Long-Haul-Legacy-2.0-alpha.15-Sources-and-Report.zip`). Подробности проверки: `TEST-REPORT.md`, машинный статус: `STATUS.json`.

## Установка тестового профиля (ВАЖНО: чистый профиль Minecraft 1.20.1 / Forge 47.4.10 / Java 17!)

1. Скачайте `Long-Haul-Legacy-2.0-alpha.15.mrpack` (артефакт CI `long-haul-legacy-2.0-alpha.15`). **Не запускайте в профиле Forge 1.21.1, Java 21 или Java 25 — сборка строго для Minecraft `1.20.1`, Forge `47.4.10` и Java `17`!**
2. Импортируйте `.mrpack` как **новый чистый отдельный профиль** в Prism Launcher / Modrinth App (или очистите старую папку `mods/` перед обновлением, чтобы не оставался удалённый `AkashicTome-1.7-27.jar` и старые версии модов).
3. Выберите **Java 17** и выделите **8–10 ГБ RAM** (`-Xms4096M -Xmx8192M` или `10240M` на системе с 32 ГБ RAM; не ставьте `-Xmx24G`).
4. Создайте **новый обычный мир**.

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

| Требование | Состояние `2.0-alpha.15` |
|---|---|
| ~500 полезных модов | В процессе: 418 внешних JAR (+1 runtime = 419 JAR / 487 mod ID; осталось ~80 JAR к ~500) |
| Клиентское, графическое и транспортное тестирование | Не пройдено: проверен только headless Linux-сервер (void + обычный Overworld) |
| Полная интеграция всех 240 спецификаций из `design/quest-catalog.*` | Реализовано в Heracles (321 квест, 12 групп, 300 advancement) и сервере (`/lh catalog`, все 19 `verification_type` + сюжет «Ушёл за хлебом») |
| Физические NBT-структуры городов и объектов восстановления | Реализованы 18 `.nbt` шаблонов (16 узлов/руин `11×7×11` + 2 летающих острова `15×14×15`) + авторазмещение и ремонт архива |
| Проверка физики поездов/кораблей VS в клиенте | Не проведена в графическом клиенте |

## Воспроизведение и CI

```bash
node long-haul-legacy-2/tools/test_contracts.js
python3 long-haul-legacy-2/tools/generate_structures.py
python3 long-haul-legacy-2/tools/generate_worldgen.py
python3 long-haul-legacy-2/tools/generate_alpha_quests.py
python3 long-haul-legacy-2/tools/assemble_alpha.py --profile long-haul-legacy-2/profiles/alpha15.json
python3 long-haul-legacy-2/tools/generate_modlist.py
python3 long-haul-legacy-2/tools/prepare_server.py --mode void
python3 long-haul-legacy-2/tools/build_runtime.py
python3 long-haul-legacy-2/tools/inspect_alpha.py
python3 long-haul-legacy-2/tools/smoke_server.py --heap 4096 --timeout 450 --world-label "alpha15 void integration test"
python3 long-haul-legacy-2/tools/prepare_server.py --mode normal --skip-forge-install
python3 long-haul-legacy-2/tools/smoke_server.py --heap 6144 --timeout 780 --world-label "alpha15 normal overworld test"
python3 long-haul-legacy-2/tools/package_alpha.py --version 2.0-alpha.15
```
