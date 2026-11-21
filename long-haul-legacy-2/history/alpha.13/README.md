# Long Haul Legacy 2.0 — Alpha 13 (`2.0-alpha.13`)

**Расширенная серверно-проверенная альфа сборки, НЕ финальный релиз по полному ТЗ.** Импортируемый `.mrpack` предназначен для отдельного тестового профиля и нового обычного мира. Рабочая 1.1.1 не изменена. Исторические снимки прошлых альф сохранены в `history/alpha.1/` – `history/alpha.13/`.

## Что нового в `2.0-alpha.13`

- **Добавлен `MVS - Moog's Voyager Structures` (`moogs-voyager-structures` + `moogs-structure-lib`):**
  - В профиль `profiles/alpha13.json` добавлен **`MVS - Moog's Voyager Structures`** с автоматической зависимостью **`Moog's Structure Lib`**.
  - Сборка перешагнула отметку **`401` внешний Modrinth JAR** (`327` серверных / `74` только клиентских) + `1` собственный `longhaul-runtime-1.20.1-0.1.0.jar` = **`402` JAR всего (`468` mod ID включая вложенные)**.
- *(Унаследовано из `2.0-alpha.12` и более ранних)* `17` ванильных + `12` модовых оверрайдов снижения руд, `17` редких монорудных чанков (`6` ванильных + `11` модовых: цинк, боксит/алюминий, свинец, серебро, никель, уран, торий, олово, сера, каменная соль, кварц) с `/lh prospect`, `Smart Mobs`, квота чанклоадинга активного маршрута (`<= 2`), выбросы Death Stranding Voidout + `Corpse`, летающие острова (`Y=172..212`) + сезонный токсичный газ (`Y=114`), `AdPother` + `Advanced Chimneys`, `Primal Magick` + `Thaumon`, `ParCool!`, Бессмертная Улитка и 320 квестов Heracles.

Профиль сборки: `profiles/alpha13.json` (динамически разрешаемый список и хэши в CI → артефакт `Long-Haul-Legacy-2.0-alpha.13.mrpack` и `Long-Haul-Legacy-2.0-alpha.13-Sources-and-Report.zip`). Подробности проверки: `TEST-REPORT.md`, машинный статус: `STATUS.json`.

## Установка тестового профиля (ВАЖНО: только Minecraft 1.20.1 / Forge 47.4.10 / Java 17!)

1. Скачайте `Long-Haul-Legacy-2.0-alpha.13.mrpack` (артефакт CI `long-haul-legacy-2.0-alpha.13`). **Не запускайте в профиле Forge 1.21.1 / Java 21 — сборка строго для Minecraft `1.20.1`, Forge `47.4.10` и Java `17`!**
2. Импортируйте `.mrpack` как **новый отдельный профиль** в Prism Launcher / Modrinth App (лаунчер автоматически поставит Minecraft `1.20.1` и Forge `47.4.10`).
3. Выберите **Java 17** и выделите **8–10 ГБ RAM** (на системе с 32 ГБ RAM).
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

| Требование | Состояние `2.0-alpha.13` |
|---|---|
| ~500 полезных модов | В процессе: 401 внешний JAR (+1 runtime = 402 JAR / 468 mod ID; расширение к ~500) |
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
python3 long-haul-legacy-2/tools/assemble_alpha.py --profile long-haul-legacy-2/profiles/alpha13.json
python3 long-haul-legacy-2/tools/generate_modlist.py
python3 long-haul-legacy-2/tools/prepare_server.py --mode void
python3 long-haul-legacy-2/tools/build_runtime.py
python3 long-haul-legacy-2/tools/inspect_alpha.py
python3 long-haul-legacy-2/tools/smoke_server.py --heap 4096 --timeout 450 --world-label "alpha13 void integration test"
python3 long-haul-legacy-2/tools/prepare_server.py --mode normal --skip-forge-install
python3 long-haul-legacy-2/tools/smoke_server.py --heap 6144 --timeout 780 --world-label "alpha13 normal overworld test"
python3 long-haul-legacy-2/tools/package_alpha.py --version 2.0-alpha.13
```

Срез выбора версий — **19.11.2026**. Полный цикл сборки и оба smoke-теста автоматизированы в `.github/workflows/ci.yml`.
