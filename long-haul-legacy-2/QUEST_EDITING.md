# Инструкция по редактированию текста квестов (Heracles 1.20.1)

Все ~4 742 квеста в `long-haul-legacy-2/overrides/config/heracles/quests/*.json` **генерируются автоматически** из Python-исходников.
**Не редактируйте `.json` файлы в `overrides/config/heracles/quests/` напрямую** — при следующей генерации они будут перезаписаны.

## 1. Где лежат тексты квестов

| Файл | Что внутри |
| --- | --- |
| `long-haul-legacy-2/tools/quest_chapters/ch_core.py` | Сюжетные главы `00..14` (пролог «Ушёл за хлебом», основы, индустрия, 240 региональных заказов, магия, OpenTTD, DOOMED, фото и т.д.). |
| `long-haul-legacy-2/tools/quest_chapters/ch_expansion.py` | Главы `15..61` (прогрессия по модам: Create, IE, Mekanism/Electrodynamics, NuclearCraft, Draconic Evolution, Botania, Hex Casting и т.д.). |
| `long-haul-legacy-2/tools/quest_chapters/common.py` | Вспомогательные функции (`quest(...)`, `t_check(...)`, `tier_rewards(...)`, список запрещённых предметов `BANNED_ITEM_SUBSTRINGS`). |

## 2. Структура записи квеста в коде

Обычно квесты в `ch_core.py` и `ch_expansion.py` выглядят так:

```python
quest(
    'alpha_welcome',                     # 1. Уникальный ID квеста (имя .json файла) — НЕ меняйте у существующих!
    'Заголовок квеста',                  # 2. Название в интерфейсе Heracles
    '01 · Основы и старт',               # 3. Название вкладки/главы (сортируется по префиксу "NN · ...")
    [0, 0],                              # 4. Координаты [X, Y] на экране главы (не должны совпадать в одной главе!)
    'minecraft:compass',                 # 5. Иконка квеста
    t_check('Подтвердить шаг'),          # 6. Задача (или t_item('minecraft:iron_ingot', 4))
    [                                    # 7. Описание: список абзацев (каждый элемент — новая строка)
        'Первый абзац описания.',
        'Второй абзац. Можно использовать цветовые коды §eжёлтый§r, §aзелёный§r.',
    ],
    deps=['story_06_forgot_the_milk'],   # 8. Зависимости (ID предыдущих квестов)
    subtitle='Подзаголовок под названием',
    rewards={'xp': r_xp(15, 'POINTS')},  # 9. Награды (у каждого квеста должна быть хотя бы 1 награда!)
)
```

В списках вроде `story_ch00` или `lanes` используются кортежи с теми же полями (`id`, `title`, `icon`, `pos`, `task`, `desc`, `deps`, `rewards`).

### Частые правила и ограничения (валидатор проверяет автоматически)
1. **Не меняйте `qid` и названия групп `NN · ...`** без необходимости — на них завязаны зависимости и выдача/проверка прогресса в KubeJS (`26_hard_features_and_territory.js`).
2. **Каждый квест обязан иметь награду (`rewards`)** — иначе `generate_alpha_quests.py` завершится с ошибкой `Quests missing rewards`.
3. **Координаты `[x, y]` внутри одной главы должны быть уникальны** — иначе будет ошибка `Duplicate coordinate`.
4. **Не используйте запрещённые предметы** (`shulker`, `ender_chest`, `jetpack`, `waystones`, `tempad`, `spawn_egg` и др. из `BANNED_ITEM_SUBSTRINGS` в `common.py`).
5. **UTF-8 без BOM**: сохраняйте `.py` файлы в кодировке UTF-8. Экранировать кириллицу в `\uXXXX` не нужно.
6. **Формат Heracles 1.20.1**: функция `quest(...)` сама оборачивает `title` и `subtitle` в `{"text": "..."}` — передавайте обычную строку Python.

## 3. Как применить изменения в игру за 2 секунды (без перекачивания сборки)

1. Отредактируйте нужные тексты в `ch_core.py` или `ch_expansion.py`.
2. Перегенерируйте `.json` и проверьте валидацию:
   ```bat
   python long-haul-legacy-2/tools/generate_alpha_quests.py
   ```
3. Залейте изменённые файлы в вашу папку игры (и только их!):
   ```bat
   long-haul-legacy-2\sync_instance.bat --instance "D:\Minecraft\game\home\Long-Haul 1.20.1-forge-47.4.10"
   ```
   *(Начиная со второго запуска путь запоминается, и можно просто запускать `long-haul-legacy-2\sync_instance.bat` без параметров.)*
4. Если игра уже запущена, в мире выполните `/reload` (или перезайдите в мир), чтобы Heracles перечитал обновлённые тексты квестов.
