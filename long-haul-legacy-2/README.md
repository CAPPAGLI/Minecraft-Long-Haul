# Long Haul Legacy 2.0 — Alpha 3 (`2.0-alpha.3`)

**Расширенная серверно-проверенная альфа сборки, НЕ финальный релиз по полному ТЗ.** Импортируемый `.mrpack` предназначен для отдельного тестового профиля и нового обычного мира. Рабочая 1.1.1 не изменена. Исторические снимки прошлых альф сохранены в `history/alpha.1/` и `history/alpha.2/`.

## Что находится в пакете (`2.0-alpha.3`)

- **Minecraft 1.20.1 / Forge 47.4.10 / Java 17.**
- **266 внешних JAR (214 серверных / 52 клиентских) + 1 собственный `longhaul-runtime-1.20.1-0.1.0.jar`** (`600,945,061` байт внешних загрузок с Modrinth CDN, **291 объявленный mod ID** включая вложенные зависимости, 0 отсутствующих зависимостей, 0 конфликтов версий Maven).
- **Транспорт и индустрия:** Create 6.0.8, Steam ’n’ Rails, Crafts & Additions, Enchantment Industry, Connected, Deco, Slice & Dice, Central Kitchen, Diesel Generators, Ore Excavation, New Age, Railways Navigator, Create: Metallurgy, Create: Goggles, Create Low-Heated, Create: Optical, Create: Garnished, Create: Bitterballen, Create: Tweaked Controllers, Numismatics, Create: Framed, Immersive Engineering + Immersive Petroleum + Immersive Geology, PneumaticCraft: Repressurized, Little Logistics, Railcraft Reborn, More Minecarts, Valkyrien Skies, Clockwork 0.5.6 (с Kelvin 0.5.0), Eureka, Trackwork, Automobility, AstikorCarts Redux, Immersive Aircraft, Man of Many Planes, Small Ships.
- **Связь, автоматизация, съёмка:** CC: Tweaked, Advanced Peripherals, CC:C Bridge, Tom's Peripherals, Exposure + Expanded + Catalog + Polaroid, Simple Voice Chat + Voice Chat Recording + Walkie-Talkie, Zume.
- **Мир 175 000 × 175 000:** Tectonic, Terralith, Biomes O' Plenty, Regions Unexplored, Atmospheric, Autumnity, Environmental, Ecologics, Upgrade Aquatic, Towns and Towers, IDAS, Dungeons and Taverns, Structory + Towers, Formations, Explorify, Repurposed Structures, Better Archeology, Bountiful, Alex's Mobs, Naturalist, полный набор структур YUNG, ChoiceTheorem's Overhauled Village. Waystones **отсутствуют** (телепортация исключена), граница `175000` блоков (`±87500` от центра `0,0`) выставляется автоматически при старте мира.
- **Фермерство, строительство, QoL и производительность:** экосистема Farmer's Delight (Brewin' and Chewin', Farmer's Respite, Cultural Delights, Miner's Delight, Rustic Delight, Delightful, Corn Delight, Crabber's Delight, Fruits Delight, Collector's Reap, Ube's Delight, Chef's Delight, Aquaculture), Quark, Supplementaries (+ Squared, Amendments), FramedBlocks, Chipped, Rechiseled, Macaw's, Storage Drawers (шалкер-боксы, эндер-сундуки, `supplementaries:sack` и `supplementaries:safe` заблокированы), Embeddium, Oculus, ImmediatelyFast, EntityCulling, ModernFix, FerriteCore, Saturn, Noisium, JEI, EMI, Jade, Xaero's World Map & Minimap.
- **Игровая механика Long Haul (KubeJS + `longhaul-runtime`):**
  - **8 серверных контрактов приёмки** (включая временны́е испытания с окнами и кооперативный режим `/lh share <player>`).
  - **10 детерминированных стратегических узлов** внутри `±84000` (8 производственных центров с собственными товарами `longhaul:*`, `continental_archive` и `continental_hub`).
  - **6 восстанавливаемых промышленных объектов** (`/lh recovery <list|info|survey|restore>`): лесопилка, карьер, речной порт, сортировочный узел, энергостанция и обрушенный мост.
  - **Полевые фотоотчёты Exposure и телеметрия CC: Tweaked:** `/lh photo <report|status>` (9 уникальных кадров без повторного использования) и `/lh cc <challenge|verify|status>` (8 задач мониторинга депо).
  - **Разворачиваемый экспедиционный лагерь и анти-читовый учёт маршрутов:** `/lh camp deploy|pack|list`, `/lh route begin|gate|finish|start|list`, серверные накладные `/lh cargo issue|deliver`.
  - **71 установленный квест Heracles** (6 групп) и **54 серверных advancement** в `kubejs/data/longhaul/advancements/`.
- **Без космоса и температурных модов.** `DOOMED` не включён; инструкция по необязательной ручной установке находится в `DOOMED.md`.

Профиль сборки: `profiles/alpha3.json` (динамически разрешаемый список и хэши в CI → артефакт `Long-Haul-Legacy-2.0-alpha.3.mrpack` и `alpha3-build-and-test-logs`). Подробности проверки: `TEST-REPORT.md`, машинный статус: `STATUS.json`.

## Установка тестового профиля

1. Соберите или скачайте `Long-Haul-Legacy-2.0-alpha.3.mrpack` (артефакт CI или `python3 tools/assemble_alpha.py --profile profiles/alpha3.json` + `tools/package_alpha.py --version 2.0-alpha.3`). Не смешивайте с 1.1.1.
2. Импортируйте в Prism Launcher или совместимый лаунчер.
3. Выберите **Java 17** и начните с **8–10 ГБ RAM** (на системе с 32 ГБ RAM; не выделяйте всю память).
4. Создайте **новый обычный мир**.

## Основные команды `/lh`

- `/lh help` — справка по командам.
- `/lh terminal`, `/lh accept <id>`, `/lh status`, `/lh abort`, `/lh share <player>` — приёмка и кооперативные контракты.
- `/lh sites`, `/lh site info <id>`, `/lh site commission <id>`, `/lh site produce <id> <bootstrap|industrial>`, `/lh site archive` — разведка, ввод в строй и локальное производство на 10 стратегических узлах.
- `/lh recovery list|info|survey|restore` — обследование и восстановление 6 разрушенных объектов.
- `/lh photo report|status`, `/lh cc challenge|verify|status` — полевые фотоотчёты Exposure и телеметрия CC: Tweaked.
- `/lh camp deploy|pack|list`, `/lh route begin|gate|finish|start|list`, `/lh cargo issue|deliver` — лагеря, маршруты без телепортации и серверные грузовые накладные.

## Что ещё осталось до финального релиза

| Требование | Состояние `2.0-alpha.3` |
|---|---|
| ~500 полезных модов | В процессе: 266 внешних JAR / 291 mod ID (следующий этап расширения к ~500) |
| Клиентское, графическое и транспортное тестирование | Не пройдено: проверен только headless Linux-сервер (void + обычный Overworld) |
| Полная интеграция всех 240 спецификаций из `design/quest-catalog.*` | В Heracles собрано 71 квест (6 групп); остальные описаны в каталоге спецификаций |
| Пользовательские NBT-структуры 8 городов и 6 объектов восстановления | Логика и координаты работают на сервере; уникальные NBT-постройки ещё не созданы |
| Проверка физики поездов/кораблей VS в клиенте | Не проведена в графическом клиенте |

## Воспроизведение и CI

```bash
node long-haul-legacy-2/tools/test_contracts.js
python3 long-haul-legacy-2/tools/generate_alpha_quests.py
python3 long-haul-legacy-2/tools/assemble_alpha.py --profile long-haul-legacy-2/profiles/alpha3.json
python3 long-haul-legacy-2/tools/generate_modlist.py
python3 long-haul-legacy-2/tools/prepare_server.py --mode void
python3 long-haul-legacy-2/tools/build_runtime.py
python3 long-haul-legacy-2/tools/inspect_alpha.py
python3 long-haul-legacy-2/tools/smoke_server.py --heap 4096 --timeout 360 --world-label "alpha3 void integration test"
python3 long-haul-legacy-2/tools/prepare_server.py --mode normal
python3 long-haul-legacy-2/tools/smoke_server.py --heap 4096 --timeout 540 --world-label "alpha3 normal overworld test"
python3 long-haul-legacy-2/tools/package_alpha.py --version 2.0-alpha.3
```

Срез выбора версий — **15.11.2026**. Полный цикл сборки и оба smoke-теста автоматизированы в `.github/workflows/ci.yml`.
