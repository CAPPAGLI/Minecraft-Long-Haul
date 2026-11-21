# Long Haul Legacy 2.0 — Alpha 16 (`2.0-alpha.16`)

**Расширенная серверно-проверенная альфа сборки, НЕ финальный релиз по полному ТЗ.** Импортируемый `.mrpack` предназначен для отдельного тестового профиля и нового обычного мира. Рабочая 1.1.1 не изменена. Исторические снимки прошлых альф сохранены в `history/alpha.1/` – `history/alpha.16/`.

## Что нового в `2.0-alpha.16`

- **Добавлен Distant Horizons (`distanthorizons`, ветка `3.3.0..3.3.2`):**
  - В раннем аудите (`audit/candidates.csv`) ошибочно искался дефисный slug `distant-horizons` вместо фактического проекта `distanthorizons` (`uCdwusMi`), поэтому мод не попадал в список.
  - В `tools/assemble_alpha.py` зафиксирован фильтр `3.3.0..3.3.2` для `distanthorizons`: версия `3.3.3` добавила хук `ChunkyAccessor.bindOnGenerationProgressEvent`, который падал при старте сервера с установленным `Chunky` (`IllegalStateException: Chunky is not loaded`, upstream DH `#1329`). С `3.3.0..3.3.2` сервер с `Chunky`, `Oculus 1.8.0`, `Embeddium 0.3.31`, `Alex's Caves 2.0.2` и `Valkyrien Skies 2.4.11` успешно проходит оба дымовых теста Forge `47.4.10`.
- **Прояснён статус `DOOMED` (`long-haul-legacy-2/DOOMED.md`):**
  - Мод `DOOMED | UNKNOWN CASUALTY` распространяется **только на CurseForge** (Project ID `1589967`, лицензия `All Rights Reserved`, отсутствует на Modrinth). Формат `.mrpack` (`modrinth.index.json`) разрешает автоматические ссылки загрузки только с `cdn.modrinth.com`, а автор дополнительно предупреждает о `HEAVILY WORK IN PROGRESS. EXPECT WORLD CORRUPTION AND ITEM LOSSES`. Поэтому мод оставлен опциональным и вне `.mrpack` (подробности ручной установки в отдельный профиль — в `DOOMED.md`).
- **Расширение до `432` внешних JAR (`501` mod ID с учётом встроенных зависимостей):**
  - **Create 6.0.8+ и логистика:** `create-radars`, `hypertube` (`Create: Hypertubes`, совместимый с `Create 6.0.x` и `Valkyrien Skies 2.4.11`), `create-mobile-packages` (`[6.0.7,6.1.0)`).
  - **Мир, мобы, структуры и кулинария:** `friends-and-foes-forge`, `friends-and-foes-flowery-mooblooms-forge`, `friends-and-foes-beekeeper-hut-forge`, `it-takes-a-pillage`, `villager-names-serilum`, `lets-do-herbalbrews` (`1.0.10`, без `DoAPI`).
  - **Клиентские визуальные и QoL-моды (`client_only`):** `3dskinlayers`, `not-enough-animations`, `extreme_sound_muffler`, `justenoughbreeding`.
- *(Унаследовано из `2.0-alpha.15` и более ранних)* `pack.mcmeta` (`pack_format: 15`) в `longhaul-runtime-1.20.1-0.1.0.jar`, исправленный JSON-формат Heracles (`ExtraCodecs.COMPONENT` для всех 321 квеста), стартовый `Eccentric Tome` (`eccentrictome:tome`), `17` монорудных чанков (`/lh prospect`), `Smart Mobs`, Death Stranding Voidout + `Corpse`, летающие острова (`Y=172..212`) + сезонный токсичный газ (`Y=114`), `AdPother`, `Primal Magick`, `ParCool!`, Бессмертная Улитка и 240 заказов каталога.

Профиль сборки: `profiles/alpha16.json` (динамически разрешаемый список и хэши в CI → артефакт `Long-Haul-Legacy-2.0-alpha.16.mrpack` и `Long-Haul-Legacy-2.0-alpha.16-Sources-and-Report.zip`). Подробности проверки: `TEST-REPORT.md`, машинный статус: `STATUS.json`.

## Установка тестового профиля (ВАЖНО: чистый профиль Minecraft 1.20.1 / Forge 47.4.10 / Java 17!)

1. Скачайте `Long-Haul-Legacy-2.0-alpha.16.mrpack` (артефакт CI `long-haul-legacy-2.0-alpha.16`). **Не запускайте в профиле Forge 1.21.1, Java 21 или Java 25 — сборка строго для Minecraft `1.20.1`, Forge `47.4.10` и Java `17`!**
2. Импортируйте `.mrpack` как **новый чистый отдельный профиль** в Prism Launcher / Modrinth App (или очистите старую папку `mods/` перед обновлением, чтобы не оставался удалённый `AkashicTome-1.7-27.jar` и старые версии модов).
3. Выберите **Java 17** и выделите **8–10 ГБ RAM** (`-Xms4096M -Xmx8192M` или `10240M` на системе с 32 ГБ RAM; не ставьте `-Xmx24G`).
4. Создайте **новый обычный мир**.
5. *(Опционально, на свой риск)* Если нужен `DOOMED`, установите его вручную с CurseForge в отдельный профиль по инструкции в `DOOMED.md`.

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

| Требование | Состояние `2.0-alpha.16` |
|---|---|
| ~500 полезных модов | В процессе: 432 внешних JAR (+1 runtime = 433 JAR / 501 mod ID включая встроенные) |
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
python3 long-haul-legacy-2/tools/assemble_alpha.py --profile long-haul-legacy-2/profiles/alpha16.json
python3 long-haul-legacy-2/tools/generate_modlist.py
python3 long-haul-legacy-2/tools/prepare_server.py --mode void
python3 long-haul-legacy-2/tools/build_runtime.py
python3 long-haul-legacy-2/tools/inspect_alpha.py
python3 long-haul-legacy-2/tools/smoke_server.py --heap 4096 --timeout 450 --world-label "alpha16 void integration test"
python3 long-haul-legacy-2/tools/prepare_server.py --mode normal --skip-forge-install
python3 long-haul-legacy-2/tools/smoke_server.py --heap 7168 --timeout 960 --world-label "alpha16 normal overworld test"
python3 long-haul-legacy-2/tools/package_alpha.py --version 2.0-alpha.16
```
