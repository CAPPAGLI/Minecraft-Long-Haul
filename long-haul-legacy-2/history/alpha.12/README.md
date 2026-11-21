# Long Haul Legacy 2.0 — Alpha 12 (`2.0-alpha.12`)

**Расширенная серверно-проверенная альфа сборки, НЕ финальный релиз по полному ТЗ.** Импортируемый `.mrpack` предназначен для отдельного тестового профиля и нового обычного мира. Рабочая 1.1.1 не изменена. Исторические снимки прошлых альф сохранены в `history/alpha.1/` – `history/alpha.12/`.

## Что нового в `2.0-alpha.12`

- **Модовые монорудные чанки и ребаланс модовых руд (`tools/generate_worldgen.py`, `24_immortal_snail.js`):**
  - Помимо `17` ванильных оверрайдов руд добавлены **`12` оверрайдов снижения генерации для модовых руд**: `Create` (`zinc_ore`, `striated_ores_overworld`), `Immersive Engineering` (`bauxite`, `lead`, `silver`, `nickel`, `deep_nickel`, `uranium`) и `Primal Magick` (`ore_rock_salt_upper/lower`, `ore_quartz_upper/lower`).
  - К `6` ванильным монорудным богатым чанкам (`coal`, `iron`, `copper`, `gold`, `redstone`, `diamond`) добавлены **`11` модовых монорудных чанков** (`longhaul:rich_*_chunk`):
    - `rich_zinc_chunk` (`create:zinc_ore`),
    - `rich_bauxite_chunk` (`immersiveengineering:ore_aluminum`), `rich_lead_chunk`, `rich_silver_chunk`, `rich_nickel_chunk`, `rich_uranium_chunk`,
    - `rich_thorium_chunk` (`create_new_age:thorium_ore`),
    - `rich_tin_chunk` (`railcraft:tin_ore`), `rich_sulfur_chunk` (`railcraft:sulfur_ore`),
    - `rich_rock_salt_chunk` (`primalmagick:ore_rock_salt`), `rich_quartz_chunk` (`primalmagick:ore_quartz`).
  - Команда `/lh prospect` теперь сканирует и распознаёт все **`17` типов монорудных жил** (как ванильные, так и модовые).
- **Добавлен мод `Smart Mobs` (`smart-mobs`):**
  - В профиль `profiles/alpha12.json` добавлен **`Smart Mobs`** (`399` внешних Modrinth JAR + `longhaul-runtime` = **`400` JAR всего**, `466` mod ID): зомби ломают блоки, строят мосты и столбы; скелеты ведут прицельный снайперский огонь на упреждение; криперы пробивают препятствия и оставляют напалм; пауки стреляют паутиной; эндермены телепортируют цели.
- *(Унаследовано из `2.0-alpha.11` и `alpha.10`)* Квота чанклоадинга активного маршрута (`<= 2` чанков через `/lh route quota|abort`), выбросы Death Stranding Voidout + трупы `Corpse`, летающие острова (`Y=172..212`) и сезонный поднимающийся токсичный газ (`Y=114`), жёсткий `AdPother` + `Advanced Chimneys`, `Primal Magick` + `Thaumon`, `ParCool!`, запрет саженцев, Бессмертная Улитка и 320 квестов Heracles.

Профиль сборки: `profiles/alpha12.json` (динамически разрешаемый список и хэши в CI → артефакт `Long-Haul-Legacy-2.0-alpha.12.mrpack` и `Long-Haul-Legacy-2.0-alpha.12-Sources-and-Report.zip`). Подробности проверки: `TEST-REPORT.md`, машинный статус: `STATUS.json`.

## Установка тестового профиля

1. Соберите или скачайте `Long-Haul-Legacy-2.0-alpha.12.mrpack` (артефакт CI `long-haul-legacy-2.0-alpha.12`, либо локально: `python tools/assemble_alpha.py --profile profiles/alpha12.json --lock-only && python tools/generate_modlist.py && python tools/package_alpha.py --version 2.0-alpha.12 --skip-jar-bytes-check`, либо без `--lock-only`/`--skip-jar-bytes-check` для полной локальной проверки SHA-512). Не смешивайте с `1.1.1`.
2. Импортируйте в Prism Launcher или совместимый лаунчер.
3. Выберите **Java 17** и начните с **8–10 ГБ RAM** (на системе с 32 ГБ RAM; не выделяйте всю память).
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

| Требование | Состояние `2.0-alpha.12` |
|---|---|
| ~500 полезных модов | В процессе: 399 внешних JAR (+1 runtime = 400 JAR / 466 mod ID; расширение к ~500) |
| Клиентское, графическое и транспортное тестирование | Не пройдено: проверен только headless Linux-сервер (void + обычный Overworld) |
| Полная интеграция всех 240 спецификаций из `design/quest-catalog.*` | Реализовано в Heracles (320 квестов, 12 групп, 300 advancement) и сервере (`/lh catalog`, все 19 `verification_type` + сюжет «Ушёл за хлебом») |
| Физические NBT-структуры городов и объектов восстановления | Реализованы 18 `.nbt` шаблонов (16 узлов/руин `11×7×11` + 2 летающих острова `15×14×15`) + авторазмещение и ремонт архива |
| Проверка физики поездов/кораблей VS в клиенте | Не проведена в графическом клиенте |

## Воспроизведение и CI

```bash
node long-haul-legacy-2/tools/test_contracts.js
python3 long-haul-legacy-2/tools/generate_structures.py
python3 long-haul-legacy-2/tools/generate_worldgen.py
python3 long-haul-legacy-2/tools/generate_alpha_quests.py
python3 long-haul-legacy-2/tools/assemble_alpha.py --profile long-haul-legacy-2/profiles/alpha12.json
python3 long-haul-legacy-2/tools/generate_modlist.py
python3 long-haul-legacy-2/tools/prepare_server.py --mode void
python3 long-haul-legacy-2/tools/build_runtime.py
python3 long-haul-legacy-2/tools/inspect_alpha.py
python3 long-haul-legacy-2/tools/smoke_server.py --heap 4096 --timeout 450 --world-label "alpha12 void integration test"
python3 long-haul-legacy-2/tools/prepare_server.py --mode normal --skip-forge-install
python3 long-haul-legacy-2/tools/smoke_server.py --heap 6144 --timeout 780 --world-label "alpha12 normal overworld test"
python3 long-haul-legacy-2/tools/package_alpha.py --version 2.0-alpha.12
```

Срез выбора версий — **19.11.2026**. Полный цикл сборки и оба smoke-теста автоматизированы в `.github/workflows/ci.yml`.
