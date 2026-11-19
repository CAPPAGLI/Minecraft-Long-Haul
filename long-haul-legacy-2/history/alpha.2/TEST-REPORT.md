# Long Haul Legacy 2.0 — Alpha 2 — протокол проверки

## Итог

**Оба headless-теста на выделенном сервере Forge 47.4.10 (`void` и обычный Overworld с Terralith + Tectonic + BOP + YUNG + Towns) пройдены в GitHub Actions (run `44633948134`, commit `937a258`). Графический клиент и физика транспорта в движении ещё не проверены.**

Финальные результаты из CI (`44633948134`):

- **Void integration test (`--mode void --heap 4096`):** `ready: true, exit_code: 0, integration_pass: true, integration_fail: false, clean_exit: true`.
- **Normal Overworld generation test (`--mode normal --heap 4096`):** `ready: true, exit_code: 0, integration_pass: true, integration_fail: false, clean_exit: true` (успешная генерация Overworld/Nether/End с Terralith + Tectonic + Biomes O' Plenty + YUNG's + Towns & Towers, установка границы `175000`, планирование 10 узлов и сохранение без watchdog kill).
- **Упаковка:** `Long-Haul-Legacy-2.0-alpha.2.mrpack` (`111,414` байт), `Long-Haul-Legacy-2.0-alpha.2-Sources-and-Report.zip` (`470,960` байт).

Строка интеграционной проверки в обоих режимах:

```text
LH_INTEGRATION_PASS: items + contracts + shift + brigadier + sites + production + camp + cargo + advancement sync
The world border is currently 175000 block(s) wide
No errors or warnings found!
Saved the game
ThreadedAnvilChunkStorage: All dimensions are saved
```

## Среда и состав проверки

- Minecraft `1.20.1`, Forge `47.4.10`, Java `17` (Temurin), Linux x86_64 (GitHub Actions runner).
- **115 внешних JAR + 1 собственный `longhaul-runtime-1.20.1-0.1.0.jar`** (`132` mod ID включая вложенные зависимости, `0` отсутствующих зависимостей, `0` несоответствий диапазонов Maven).
- **15/15 чистых JS-тестов** (`node long-haul-legacy-2/tools/test_contracts.js`): контракты приёмки, временны́е окна, JSON roundtrip, детерминированный планировщик 10 узлов в `±84000` с дистанцией `>= 2400`, валидатор маршрутов (отклонение телепортационной скорости) и граф экономики без циклических тупиков.
- **48 квестов Heracles** (5 групп) и **31 серверный advancement** сгенерированы и проверены `generate_alpha_quests.py`.

## Что подтверждено в живом Forge 47.4.10 (`99_integration_test.js`)

| Проверка | Результат |
|---|---|
| Регистрация предметов и текстур | 10 кастомных предметов `longhaul:*` + 10 16×16 текстур загружены без ошибок |
| Инвентарная бочка и контракты | Извлечение из настоящей бочки, выполнение `plates` и выдача квитанции |
| Временны́е окна и перезагрузка состояния | Живой `plate_shift` (3 окна), сброс `LHState = null` и восстановление из `server.persistentData` |
| Команды Brigadier `/lh` | Полная регистрация и живое выполнение команд через `StringArgumentType` (`/lh help`, `/lh sites`, `/lh site info`, `/lh camp info`, `/lh route info`, `/lh cargo`) |
| Стратегические узлы и локальное производство | Планирование 10 узлов внутри `±84000` на чистом Rhino (чисто арифметические `sin/cos/sqrt/round`), ввод в строй и производство `longhaul:*` на месте |
| Экспедиционный лагерь и груз | Развёртывание/сворачивание лагеря, измерение маршрута и проверка лимита ручного груза |
| Advancements и KubeJS | Синхронизация advancement на headless `ServerPlayer` без повторного XP; `kubejs errors server` → `No errors or warnings found!` |
| Обычный Overworld (Terralith + Tectonic + BOP + YUNG + Towns) | Полная генерация и сохранение всех измерений с установленной границей `175000` |

## Обнаруженные и устранённые проблемы в ходе `alpha.2`

1. `inspect_alpha.py`: исправлен разбор Maven-диапазонов с пробелами вроде `"[46, )"` (`jade` → `forge`).
2. `10_contracts.js` и `16_routes_and_camps.js`: заменён `event.arguments` (`A.STRING.create`) на прямой `Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType')`, устранив сбой `RegisterCommandsEvent` в KubeJS 2001.6.5.
3. `00_contract_engine.js`: `Math.imul` и `Math.cos`/`Math.sin` в кросс-контекстном Rhino KubeJS давали `NaN` при размещении узлов, а `java.lang.Math` запрещён class-фильтром KubeJS; реализованы чистые ES5 DJB2 + Park-Miller LCG + чистая арифметика `sin/cos/sqrt/round`, прошедшие и Node, и Forge Rhino.
4. `.github/workflows/ci.yml` и `smoke_server.py`: включён `set -o pipefail`, добавлены `permissions: contents: write` для отчётов и быстрый выход `smoke_server.py` при падении загрузки модов.

## Известные нефатальные предупреждения сторонних модов

- **Valkyrien Skies:** `MixinVibrationSystemTicker` (непубличный метод в интерфейсном миксине) и `RuntimeDistCleaner` для клиентского `PoseStack$Pose` на сервере (присутствовало и в `alpha.1`, не мешает запуску).
- **Farmer's Delight / Cultural Delights / Farmer's Respite:** сторонние моды логируют нефатальные ошибки разбора нескольких datapack-файлов (`minecraft:recipes/beetroot_soup.json`/`mushroom_stew.json`/`rabbit_stew*` пустые JSON, `culturaldelights:blocks/avocado_leaves` `minecraft:alternative`, `farmersrespite:blocks/kettle` `farmersrespite:copy_meal`, advancement `farmersrespite:main/stunt_tea_bush`). Они не затрагивают скрипты Long Haul и не блокируют сервер.

## Что этот тест НЕ подтверждает

- Запуск графического клиента, импорт `.mrpack` в Prism Launcher, GUI Heracles, рендер Embeddium/Oculus/ImmediatelyFast и работу голоса/камеры.
- Физику и управление поездами Create, кораблями Valkyrien Skies/Eureka/Clockwork и самолётами в движении.
- Многочасовую нагрузку на реальном мультиплеерном сервере и целевое расширение со 115 до ~500 модов.
