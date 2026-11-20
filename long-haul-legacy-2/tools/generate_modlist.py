#!/usr/bin/env python3
"""Generate MODLIST.md from assembly/lock.json."""
import json, pathlib

R = pathlib.Path(__file__).resolve().parents[1]
lock = json.loads((R / 'assembly/lock.json').read_text(encoding='utf-8'))
mods = sorted(lock['mods'], key=lambda m: m['title'].lower())
version = lock.get('version', '2.0-alpha.2')

lines = [
    f'# Состав Long Haul Legacy {version}',
    '',
    f'{len(mods)} внешних JAR + Long Haul Runtime 0.1.0. Библиотеки включены в число. Полные URL и SHA-512 находятся в `assembly/lock.json`. Все ссылки ведут на выбранные проекты, не на произвольные зеркала.',
    '',
    '| Проект | Версия | На сервере |',
    '|---|---|---|',
]
for m in mods:
    side = 'Нет: клиентский профиль' if m.get('client_only') else 'Да'
    lines.append(f"| [{m['title']}](https://modrinth.com/mod/{m['slug']}) | {m['version']} | {side} |")

lines += [
    '| Long Haul Runtime | 0.1.0 (собственный MIT) | Да |',
    '',
    '## Исключения после проверки',
    '',
    '- Extended Cogwheels 2.1.1: обращения к удалённым классам Create 0.5; несовместим с выбранным Create 6.',
    '- Create Track Map 1.4: NoSuchMethodError в Kotlin coroutines/Ktor на событии запуска сервера.',
    '- Clockwork 0.5.7: не найден соответствующий Kelvin в использованном графе; закреплён 0.5.6 со вложенным Kelvin 0.5.0.',
    '- ServerCore/Fastload: экспериментальные варианты подготовки спавна не дали подтверждённого решения и не включены.',
    '- DOOMED: официальный экспериментальный мод, отдельно вручную; см. DOOMED.md.',
    '',
    'JEI и EMI оставлены совместно как просмотрщик и совместимый слой рецептурных плагинов; это не два независимых пункта прогрессии. Не учитывать библиотеки и интеграционные слои как отдельные игровые системы.',
    '',
]
(R / 'MODLIST.md').write_text('\n'.join(lines), encoding='utf-8')
print(f'Generated MODLIST.md for {len(mods)} external mods ({version}).')
