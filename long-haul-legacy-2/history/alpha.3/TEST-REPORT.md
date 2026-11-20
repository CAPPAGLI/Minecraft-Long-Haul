# Long Haul Legacy 2.0 — Alpha 3 — протокол проверки

## Итог

**Оба headless-теста на выделенном сервере Forge 47.4.10 (`void` и обычный Overworld с Terralith + Tectonic + Biomes O' Plenty + Regions Unexplored + YUNG's + IDAS + Dungeons and Taverns + Structory + Formations + Towns & Towers) пройдены в GitHub Actions (run `44642411231`, commit `3383574`). Графический клиент и физика транспорта в движении ещё не проверены.**

Финальные результаты из CI (`44642411231`):

- **Inspect JARs:** `266` внешних JAR (`214` серверных / `52` только клиентских) + `1` собственный `longhaul-runtime-1.20.1-0.1.0.jar`, `291` mod ID включая вложенные зависимости, **`Missing: 0`**, **`Range mismatches: 0`** (включая проверку необязательных установленных зависимостей `mandatory: false`).
- **Void integration test (`--heap 4096`):** `ready: true, exit_code: 0, integration_pass: true, integration_fail: false, clean_exit: true`.
- **Normal Overworld generation test (`--heap 4096`):** `ready: true, exit_code: 0, integration_pass: true, integration_fail: false, clean_exit: true` (генерация Overworld/Nether/End со всеми биомными и структурными модами, граница мира `175000`, планирование 10 узлов и 6 объектов восстановления в `±84000`, выполнение всех серверных тестов и штатное сохранение).
- **KubeJS:** `2/2` startup-скриптов и `7/7` server-скриптов загружены с `0` ошибок и `0` предупреждений (`47115` рецептов).
- **Упаковка:** `Long-Haul-Legacy-2.0-alpha.3.mrpack` (`167,865` байт, `600,945,061` байт внешних загрузок), `Long-Haul-Legacy-2.0-alpha.3-Sources-and-Report.zip` (`636,567` байт).

Строка интеграционной проверки в обоих режимах:

```text
LH_INTEGRATION_PASS: items + contracts + shift + brigadier + sites + production + recovery + photo + cc + camp + cargo + advancement sync
```

## Среда и состав проверки

- Minecraft `1.20.1`, Forge `47.4.10`, Java `17` (Temurin), Linux x86_64 (GitHub Actions runner).
- **266 внешних JAR + 1 собственный `longhaul-runtime-1.20.1-0.1.0.jar`** (`291` mod ID включая вложенные).
- **16/16 чистых JS-тестов** (`node long-haul-legacy-2/tools/test_contracts.js`): контракты приёмки, временны́е окна, JSON roundtrip, детерминированный планировщик 10 узлов и 6 объектов восстановления в `±84000`, валидатор маршрутов и граф экономики без циклических тупиков.
- **71 квест Heracles** (6 групп) и **54 серверных advancement** сгенерированы и проверены `generate_alpha_quests.py`.

## Что подтверждено в живом Forge 47.4.10 (`99_integration_test.js`)

| Проверка | Результат |
|---|---|
| Регистрация предметов и текстур | 10 кастомных предметов `longhaul:*` + 10 16×16 текстур загружены без ошибок |
| Инвентарная бочка и контракты | Извлечение из настоящей бочки, выполнение `plates` и выдача квитанции |
| Временны́е окна и перезагрузка состояния | Живой `plate_shift` (3 окна), сброс `LHState = null` и восстановление из `server.persistentData` |
| Команды Brigadier `/lh` | Полная регистрация и живое выполнение команд (`/lh help`, `/lh sites`, `/lh site info`, `/lh camp list`, `/lh route list`, `/lh status`, `/lh recovery list`, `/lh photo status`, `/lh cc status`) |
| Стратегические узлы и локальное производство | Планирование 10 узлов внутри `±84000`, ввод в строй и производство `longhaul:treated_timber` на месте |
| Восстановление 6 промышленных объектов | `/lh recovery survey|restore` (проверка наличия механизмов Create и материалов в бочке, отказ без оборудования) |
| Полевые фотоотчёты Exposure | `/lh photo report` принимает подлинный `exposure:photograph` с уникальным токеном и отклоняет `minecraft:paper` и повторное использование токена |
| Телеметрия CC: Tweaked | `/lh cc challenge|verify` проверяет наличие `computercraft:computer_normal` и требуемого запаса в инвентаре депо |
| Экспедиционный лагерь и груз | Развёртывание/сворачивание лагеря, запрет сворачивания с непустой бочкой, выдача и доставка серверной накладной `/lh cargo` |
| Advancements и обычный Overworld | Синхронизация advancement на headless `ServerPlayer`; полная генерация и сохранение всех измерений при границе `175000` |

## Обнаруженные и устранённые проблемы в ходе `alpha.3`

1. **Исключены моды с нежелательными зависимостями:** `create-contraption-terminals` (тянул `toms-storage`), `create-stock-bridge` (тянул `appliedenergistics2` и `guideme`) и `kubejs-thermal` (тянул исключённый `thermal-expansion`).
2. **`ends-delight 2.4`:** удалён из `alpha3.json`, так как `create_central_kitchen` (`[2.6.1,)`) и `delightful` (`[2.5,)`) отклоняли установленную версию на этапе предзагрузки Forge даже как опциональную.
3. **`polymorph` (`0.49.11` → `0.49.10+1.20.1`):** расширение `inspect_alpha.py` для проверки `versionRange` установленных опциональных (`mandatory: false`) зависимостей выявило требование `polymorph 0.49.11` к бета-версии `jei >= 15.57.0.207` (против релизной `jei 15.56.0.205`); зафиксирован `polymorph 0.49.10+1.20.1` (`audit/polymorph-0.49.10.json`).
4. **`radium`:** удалён из `alpha3.json` из-за фатального конфликта миксина `PointOfInterestStorageMixin` с `valkyrienskies-common` (`MixinPOIManager`).
5. **`every-compat` и `smoke_server.py`:** удалён `every-compat` (генерировал 3532+ дополнительных блоков Macaw's Furniture и замедлял загрузку реестров); `smoke_server.py` теперь ждёт фактического сигнала `LH_INTEGRATION_PASS`/`FAIL` вместо жёстких 15 с и завершается сразу при `Preparing crash report` / `Encountered an unexpected exception`; в `tools/fixtures/server.properties` выставлен `max-tick-time=-1` для тяжёлой первичной генерации Overworld на CI-раннере.

## Известные нефатальные предупреждения сторонних модов

- **Valkyrien Skies:** `MixinVibrationSystemTicker` и `RuntimeDistCleaner` для клиентского `PoseStack$Pose` на сервере (нефатально).
- **IDAS (`Integrated Dungeons and Structures`):** логирует отсутствующие опциональные сущности/лут `ars_nouveau` и `iceandfire` для структур, привязанных к этим модам.
- **Cultural Delights / Farmer's Respite / Collector's Reap / SOB / Beautify:** логируют нефатальные ошибки разбора отдельных datapack-ресурсов; на скрипты Long Haul и стабильность сервера не влияют.

## Что этот тест НЕ подтверждает

- Запуск графического клиента, импорт `.mrpack` в Prism Launcher, GUI Heracles, рендер Embeddium/Oculus/ImmediatelyFast и работу голоса/камеры.
- Физику и управление поездами Create, кораблями Valkyrien Skies/Eureka/Clockwork и самолётами в движении.
- Многочасовую нагрузку на реальном мультиплеерном сервере, уникальные NBT-схемы городов и финальное расширение с 266 до ~500 модов.
