# Long Haul Legacy 2.0 — Alpha 14 (`2.0-alpha.14`)

**Расширенная серверно-проверенная альфа сборки, НЕ финальный релиз по полному ТЗ.** Импортируемый `.mrpack` предназначен для отдельного тестового профиля и нового обычного мира. Рабочая 1.1.1 не изменена. Исторические снимки прошлых альф сохранены в `history/alpha.1/` – `history/alpha.14/`.

## Что нового в `2.0-alpha.14`

- **Исправлено форматирование квестбука Heracles (все 321 квест):**
  - В `tools/generate_alpha_quests.py` поля `display.title` и `display.subtitle` переведены с двойной сериализации `json.dumps({'text': ...})` на настоящие JSON-объекты `{'text': ...}` (как требует `ExtraCodecs.COMPONENT` в `QuestDisplay.java` для Heracles `1.20.1`), чтобы в подсказках квестов не выводился сырой текст `{"text": "..."}`.
  - В `tools/test_contracts.js` добавлена автоматическая проверка всех `.json` квестов.
- **Единая книга гайдов на старте (`Eccentric Tome`):**
  - Удалён дубликат `akashic-tome`; оставлен актуальный **`Eccentric Tome`** (`eccentrictome:tome`).
  - В `kubejs/server_scripts/20_basics.js` при первом входе вместе с `heracles:quest_book` сразу выдаётся **`eccentrictome:tome`**, а в разделе `01 · Начало и правила` добавлен квест `alpha_eccentric_tome` с инструкцией (положить `Eccentric Tome` и любые книги модов в верстак — ПКМ выбирает книгу, Shift+ЛКМ возвращает в том).
- **Расширение сборки до `418` внешних JAR (`487` mod ID включая вложенные):**
  - **Create 6.0.8 и логистика:** `create-encased`, `create-vibrant-vaults`, `create_factory_logistics`, `escalated`, `create-6.0.8-backported-fixes`.
  - **Биомы, данжи и структуры:** `yungs-cave-biomes`, `mes-moogs-end-structures`, `mns-moogs-nether-structures`, `mss-moogs-soaring-structures`, `ct-overhaul-village`, `l_enders-cataclysm` (+ зависимости).
  - **Стабильность, оптимизация и клиент:** `neruina`, `lmd` (Let Me Despawn), `no-chat-reports`, `rubidium-extra` (Embeddium Extra, client-only).
  - В `tools/smoke_server.py` поднят лимит `-XX:MaxMetaspaceSize=1024m` для стабильной работы с `487` mod ID.
- *(Унаследовано из `2.0-alpha.13` и более ранних)* `MVS - Moog's Voyager Structures`, `17` ванильных + `12` модовых оверрайдов снижения руд, `17` редких монорудных чанков (`/lh prospect`), `Smart Mobs`, квота чанклоадинга активного маршрута (`<= 2`), выбросы Death Stranding Voidout + `Corpse`, летающие острова (`Y=172..212`) + сезонный токсичный газ (`Y=114`), `AdPother` + `Advanced Chimneys`, `Primal Magick` + `Thaumon`, `ParCool!`, Бессмертная Улитка и 240 заказов каталога в 321 квесте Heracles.

Профиль сборки: `profiles/alpha14.json` (динамически разрешаемый список и хэши в CI → артефакт `Long-Haul-Legacy-2.0-alpha.14.mrpack` и `Long-Haul-Legacy-2.0-alpha.14-Sources-and-Report.zip`). Подробности проверки: `TEST-REPORT.md`, машинный статус: `STATUS.json`.

## Установка тестового профиля (ВАЖНО: только Minecraft 1.20.1 / Forge 47.4.10 / Java 17!)

1. Скачайте `Long-Haul-Legacy-2.0-alpha.14.mrpack` (артефакт CI `long-haul-legacy-2.0-alpha.14`). **Не запускайте в профиле Forge 1.21.1, Java 21 или Java 25 — сборка строго для Minecraft `1.20.1`, Forge `47.4.10` и Java `17`!**
2. Импортируйте `.mrpack` как **новый отдельный профиль** в Prism Launcher / Modrinth App (лаунчер автоматически поставит Minecraft `1.20.1` и Forge `47.4.10`).
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

| Требование | Состояние `2.0-alpha.14` |
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
python3 long-haul-legacy-2/tools/assemble_alpha.py --profile long-haul-legacy-2/profiles/alpha14.json
python3 long-haul-legacy-2/tools/generate_modlist.py
python3 long-haul-legacy-2/tools/prepare_server.py --mode void
python3 long-haul-legacy-2/tools/build_runtime.py
python3 long-haul-legacy-2/tools/inspect_alpha.py
python3 long-haul-legacy-2/tools/smoke_server.py --heap 4096 --timeout 450 --world-label "alpha14 void integration test"
python3 long-haul-legacy-2/tools/prepare_server.py --mode normal --skip-forge-install
python3 long-haul-legacy-2/tools/smoke_server.py --heap 6144 --timeout 780 --world-label "alpha14 normal overworld test"
python3 long-haul-legacy-2/tools/package_alpha.py --version 2.0-alpha.14
```
