# Long Haul Legacy 2.0 — Alpha 2 (`2.0-alpha.2`)

**Продвинутая серверно-проверенная альфа сборки, НЕ финальный релиз по полному ТЗ.** Импортируемый `.mrpack` предназначен для отдельного тестового профиля и нового обычного мира. Рабочая 1.1.1 не изменена. Исторический снимок первой альфы сохранён в `history/alpha.1/`.

## Что находится в пакете (`2.0-alpha.2`)

- **Minecraft 1.20.1 / Forge 47.4.10 / Java 17.**
- **115 внешних JAR + 1 собственный `longhaul-runtime-1.20.1-0.1.0.jar`** (`270,537,607` байт внешних загрузок с Modrinth CDN, **132 объявленных mod ID** включая вложенные зависимости, 0 отсутствующих обязательных зависимостей, 0 конфликтов версий Maven).
- **Транспорт и индустрия:** Create 6.0.8, Steam ’n’ Rails, Crafts & Additions, Enchantment Industry, Connected, Deco, Slice & Dice, Central Kitchen, Diesel Generators, Ore Excavation, New Age, Railways Navigator, Immersive Engineering + Immersive Petroleum, Valkyrien Skies, Clockwork 0.5.6 (с Kelvin 0.5.0), Eureka, Trackwork, Immersive Aircraft, Man of Many Planes, Small Ships.
- **Связь, автоматизация, съёмка:** CC: Tweaked, Advanced Peripherals, Exposure, Simple Voice Chat, Zume.
- **Мир 175 000 × 175 000:** Tectonic, Terralith, Biomes O' Plenty, Towns and Towers, полный набор структур YUNG (Bridges, Mineshafts, Strongholds, Dungeons, Desert Temples, Ocean Monuments, Witch Huts, Nether Fortresses, End Island), ChoiceTheorem's Overhauled Village, Waystones **отсутствуют** (телепортация исключена). Граница `175000` блоков (`±87500` от центра `0,0`) выставляется автоматически при старте мира.
- **Фермерство, освещение, QoL и производительность:** Farmer's Delight, Brewin' and Chewin', Farmer's Respite, Cultural Delights, Miner's Delight, Rustic Delight, Storage Drawers, Tom's Simple Storage, Carry On, Comforts, Corpse, Supplementaries, Decorative Blocks, ModernFix, FerriteCore, Embeddium, ImmediatelyFast, Oculus, JEI, EMI, Jade, Xaero's World Map & Minimap.
- **Игровая механика Long Haul (KubeJS + `longhaul-runtime`):**
  - **8 серверных контрактов приёмки** (включая временны́е испытания с окнами и кооперативный режим `/lh share <player>`).
  - **10 детерминированных стратегических узлов** внутри `±84000` (8 производственных центров с собственными товарами `longhaul:*`, `continental_archive` и `continental_hub`) — выпуск продукции привязан к нахождению на месте (`bootstrap` x1 и `industrial` x8).
  - **Разворачиваемый экспедиционный лагерь и анти-читовый учёт маршрутов:** `/lh camp deploy|pack|info`, `/lh route start|finish|info`, лимит ручного груза `/lh cargo`.
  - **48 установленных квестов Heracles** (5 групп) и **31 серверный advancement** в `kubejs/data/longhaul/advancements/`.
- **Без космоса и температурных модов.** `DOOMED` не включён; инструкция по необязательной ручной установке находится в `DOOMED.md`.

Полный состав и хэши: `assembly/lock.json`, `MODLIST.md`. Подробности проверки: `TEST-REPORT.md`, машинный статус: `STATUS.json`.

## Установка тестового профиля

1. Соберите или скачайте `Long-Haul-Legacy-2.0-alpha.2.mrpack` (артефакт CI или `python3 tools/package_alpha.py --version 2.0-alpha.2`). Не смешивайте с 1.1.1.
2. Импортируйте в Prism Launcher или совместимый лаунчер.
3. Выберите **Java 17** и начните с **8–10 ГБ RAM** (на системе с 32 ГБ RAM; не выделяйте всю память).
4. Создайте **новый обычный мир**.

## Основные команды `/lh`

- `/lh help` — справка по командам.
- `/lh terminal`, `/lh accept <id>`, `/lh status`, `/lh abort`, `/lh share <player>` — приёмка и кооперативные контракты.
- `/lh sites`, `/lh site info <id>`, `/lh site commission <id>`, `/lh site produce <id> <bootstrap|industrial>`, `/lh site archive` — разведка, ввод в строй и локальное производство на 10 стратегических узлах.
- `/lh camp deploy|pack|info` — компактный экспедиционный лагерь.
- `/lh route start <id>`, `/lh route finish <id>`, `/lh route info`, `/lh cargo` — замер маршрутов без телепортации и контроль ручного груза.

## Что ещё осталось до финального релиза

| Требование | Состояние `2.0-alpha.2` |
|---|---|
| ~500 полезных модов | Частично: 115 внешних JAR / 132 mod ID (следующий слой ~150→300→500) |
| Клиентское, графическое и транспортное тестирование | Не пройдено: проверен только headless Linux-сервер (void + обычный Overworld) |
| Полная интеграция всех 240 спецификаций из `design/quest-catalog.*` | В Heracles собрано 48 квестов; остальные 192 описаны в каталоге спецификаций |
| Пользовательские NBT-структуры 8 городов | Логика и координаты 10 узлов работают на сервере; уникальные NBT-постройки городов ещё не созданы |
| Проверка физики поездов/кораблей VS в клиенте | Не проведена в графическом клиенте |

## Воспроизведение и CI

```bash
node long-haul-legacy-2/tools/test_contracts.js
python3 long-haul-legacy-2/tools/generate_alpha_quests.py
python3 long-haul-legacy-2/tools/assemble_alpha.py --profile long-haul-legacy-2/profiles/alpha2.json
python3 long-haul-legacy-2/tools/build_runtime.py
python3 long-haul-legacy-2/tools/inspect_alpha.py --profile long-haul-legacy-2/profiles/alpha2.json
python3 long-haul-legacy-2/tools/smoke_server.py --mode void --heap 4096 --timeout 360
python3 long-haul-legacy-2/tools/smoke_server.py --mode normal --heap 4096 --timeout 420
python3 long-haul-legacy-2/tools/package_alpha.py --version 2.0-alpha.2
```

Срез выбора версий — **15.11.2026**. Полный цикл сборки и оба smoke-теста автоматизированы в `.github/workflows/ci.yml`.
