# Long Haul Legacy 2.0 — Alpha 10 (`2.0-alpha.10`)

**Расширенная серверно-проверенная альфа сборки, НЕ финальный релиз по полному ТЗ.** Импортируемый `.mrpack` предназначен для отдельного тестового профиля и нового обычного мира. Рабочая 1.1.1 не изменена. Исторические снимки прошлых альф сохранены в `history/alpha.1/` – `history/alpha.10/`.

## Что нового в `2.0-alpha.10`

- **Выбросы при смерти (Death Stranding Voidout) + трупы (`corpse`) + роль Тотемов бессмертия (`25_voidout_and_toxic_gas.js`):**
  - Каждая настоящая гибель игрока с задержкой в `3` тика вызывает мощнейший взрыв (`strength 24.0`, огонь, кратер, удар молнии и оповещение по серверу), мотивирующий не складывать всю базу в одной точке.
  - Инвентарь сохраняется в трупе мода **`Corpse`** (`corpse:corpse` защищён от урона и взрывов).
  - Срабатывание **Тотема бессмертия** предотвращает смерть и полностью отменяет взрыв — важно брать тотемы в редкие данжи и структуры.
- **Летающие острова и небесные структуры (`embers-floating-islands`, `create-sky-village`, `longhaul:sky_refuges`):**
  - Добавлены моды **`Ember's Floating Islands`** и **`Create: Sky Village`**, а также собственные парящие острова-убежища (`sky_refuge_camp`, `sky_beacon_isle`) на высоте **`Y = 172..212`**.
- **Сезонный поднимающийся токсичный газ (`25_voidout_and_toxic_gas.js`, `/lh gas status|phase`):**
  - Цикл из 4 сезонных фаз (`Чистый сезон` → `Подъём тумана` → `Пик прилива Y=114` → `Спад`).
  - На пике токсичного прилива равнины и низины затапливаются ядовитыми испарениями — безопасными остаются только **высокие горы (`Y >= 114`)** и **летающие острова (`Y >= 172`)**.
- **Жёсткое загрязнение среды и тайная магия (`pollution-of-the-realms`, `advanced-chimneys`, `primal-magick`, `thaumon`):**
  - Добавлены **`Pollution of the Realms`** (`adpother-common.toml`: `globalEmissionRate = 2.5`, `environmentDegradationRate = 0.8`, `maxGasEntitiesInChunk = 24`, дым от факелов и костров) и **`Advanced Chimneys`** для отвода дыма.
  - Так как официальный **Thaumcraft** остановился на 1.12.2 и ещё не вышел для Forge 1.20.1, интегрированы **`Primal Magick`** (система исследований, первородных эссенций, рун и магической техники в духе Thaumcraft) и **`Thaumon`**.
- *(Унаследовано из `2.0-alpha.9`)* Паркур `ParCool!`, запрет саженцев + `-40%` дропа брёвен, 10× снижение руд + 6 редких богатых чанков (`/lh prospect`), Бессмертная Улитка (`/lh snail status`) и 6-главная история «Ушёл за хлебом» (`320` квестов Heracles).

Профиль сборки: `profiles/alpha10.json` (динамически разрешаемый список и хэши в CI → артефакт `Long-Haul-Legacy-2.0-alpha.10.mrpack` и `Long-Haul-Legacy-2.0-alpha.10-Sources-and-Report.zip`). Подробности проверки: `TEST-REPORT.md`, машинный статус: `STATUS.json`.

## Установка тестового профиля

1. Соберите или скачайте `Long-Haul-Legacy-2.0-alpha.10.mrpack` (артефакт CI `long-haul-legacy-2.0-alpha.10`, либо локально: `python tools/assemble_alpha.py --profile profiles/alpha10.json --lock-only && python tools/generate_modlist.py && python tools/package_alpha.py --version 2.0-alpha.10 --skip-jar-bytes-check`, либо без `--lock-only`/`--skip-jar-bytes-check` для полной локальной проверки SHA-512). Не смешивайте с `1.1.1`.
2. Импортируйте в Prism Launcher или совместимый лаунчер.
3. Выберите **Java 17** и начните с **8–10 ГБ RAM** (на системе с 32 ГБ RAM; не выделяйте всю память).
4. Создайте **новый обычный мир**.

## Основные команды `/lh`

- `/lh help` — справка по командам.
- `/lh prospect`, `/lh snail status`, `/lh gas status` — геологоразведка редких рудных чанков, статус Бессмертной Улитки и уровень сезонного токсичного газа.
- `/lh terminal`, `/lh accept <id>`, `/lh status`, `/lh abort`, `/lh team <join|leave> [имя]` — приёмка и кооперативные контракты.
- `/lh stage`, `/lh vehicle status` — текущая промышленная стадия GameStages и одометр транспорта.
- `/lh catalog list|stage <1..4>|info <id>|verify <id>` — просмотр и серверная проверка 240 заказов каталога.
- `/lh sites`, `/lh site info <id>`, `/lh site commission <id>`, `/lh site produce <id> <bootstrap|industrial>`, `/lh site archive`, `/lh site repair_archive` — разведка, ввод в строй, ремонт архива и локальное производство на 10 стратегических узлах.
- `/lh recovery list|info|survey|restore` — обследование и восстановление 6 разрушенных объектов.
- `/lh photo report|status`, `/lh cc challenge|verify|status` — полевые фотоотчёты Exposure и телеметрия CC: Tweaked.
- `/lh camp deploy|pack|list`, `/lh route begin|gate|finish|start|list`, `/lh cargo issue|deliver` — лагеря, маршруты без телепортации и серверные грузовые накладные.

## Что ещё осталось до финального релиза

| Требование | Состояние `2.0-alpha.10` |
|---|---|
| ~500 полезных модов | В процессе: 378 внешних JAR / 447 mod ID (расширение к ~500 за счёт совместимых модов) |
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
python3 long-haul-legacy-2/tools/assemble_alpha.py --profile long-haul-legacy-2/profiles/alpha10.json
python3 long-haul-legacy-2/tools/generate_modlist.py
python3 long-haul-legacy-2/tools/prepare_server.py --mode void
python3 long-haul-legacy-2/tools/build_runtime.py
python3 long-haul-legacy-2/tools/inspect_alpha.py
python3 long-haul-legacy-2/tools/smoke_server.py --heap 4096 --timeout 450 --world-label "alpha8 void integration test"
python3 long-haul-legacy-2/tools/prepare_server.py --mode normal --skip-forge-install
python3 long-haul-legacy-2/tools/smoke_server.py --heap 6144 --timeout 780 --world-label "alpha8 normal overworld test"
python3 long-haul-legacy-2/tools/package_alpha.py --version 2.0-alpha.8
```

Срез выбора версий — **19.11.2026**. Полный цикл сборки и оба smoke-теста автоматизированы в `.github/workflows/ci.yml`.
