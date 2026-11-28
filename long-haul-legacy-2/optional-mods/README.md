# Optional CurseForge / Local Mods (`optional-mods/`)

Эта папка предназначена для **локальных или CurseForge-only `.jar` модов**, которые вы скачиваете со своего компьютера (например, `DOOMED` и `Doomed: Guns`), но которые **нельзя** автоматически скачать или перераспространять в этом репозитории.

## Почему CurseForge-only моды не лежат в Git по умолчанию

1. **Ограничение среды сборки и API:** агентская песочница и CI не имеют доступа к `curseforge.com` / `edge.forgecdn.net` (и CurseForge API требует приватный `x-api-key`), тогда как Modrinth API открыт и поддерживается `.mrpack` напрямую через `https://cdn.modrinth.com/`.
2. **Лицензия `All Rights Reserved`:** например, у мода `DOOMED | UNKNOWN CASUALTY` (CurseForge Project ID `1589967`) лицензия `All Rights Reserved` — публикация чужих скомпилированных `.jar` в публичном Git-репозитории без разрешения автора запрещена.
3. **Стандарт `.mrpack`:** `modrinth.index.json` принимает только ссылки `https://cdn.modrinth.com/`.

## Как подключить CurseForge-моды (3 способа)

### Способ 1 — автоматически через `sync_instance.bat` (на вашем ПК)
```bat
long-haul-legacy-2\sync_instance.bat --with-optional
```
- `--with-optional` (`--download-optional safe`): скачивает безопасные опциональные аддоны (`Realistic Walkie-Talkie`, `ToniCore`, `The Furry Project`) с CurseForge CDN в `long-haul-legacy-2/optional-mods/` и сразу копирует их в `<instance>/mods/`. Работает и вместе с `--skip-mods`.
- `--with-all-optional` (`--download-optional all`): дополнительно пытается скачать экспериментальный `DOOMED` и `Doomed: Guns` (использовать только на отдельном мире с бэкапами).
- При обычном интерактивном запуске `sync_instance.bat` без `--skip-mods` скрипт также предложит выбрать загрузку опциональных модов (`[N] / [S] / [A]`).
- Если CurseForge/Cloudflare заблокирует автоматическую загрузку для какого-либо файла без прямого `file_id`, скрипт выведет точную ссылку для ручного скачивания и продолжит синхронизацию без ошибки.

### Способ 2 — вручную прямо в лаунчере
1. Импортируйте `Long-Haul-Legacy-2.0-alpha.20.mrpack` в Prism Launcher / Modrinth App.
2. Скачайте `.jar` нужных CurseForge-модов (например `DOOMED`, `The Furry Project`, `Realistic Walkie-Talkie` (`1750447`) от Toni_Carter вместе с его обязательной библиотекой `ToniCore` (`tonicore >= 1.0.0`) — см. `curseforge-addons.json`) и положите их в папку `mods/` созданного профиля. Для `Realistic Walkie-Talkie` серверный конфиг уже подготовлен в `overrides/config/walkietalkies-server.properties`.

### Способ 3 — локальная пересборка `.mrpack` / серверного теста из этого репозитория
1. Положите скачанные `.jar` в `long-haul-legacy-2/optional-mods/` (или в `long-haul-legacy-2/overrides/mods/`).
2. Запустите инструменты с флагом `--include-optional-mods`:

```bash
python3 long-haul-legacy-2/tools/prepare_server.py --mode void --include-optional-mods
python3 long-haul-legacy-2/tools/inspect_alpha.py --include-optional-mods
python3 long-haul-legacy-2/tools/package_alpha.py --version 2.0-alpha.20 --include-optional-mods
```

Флаг `--include-optional-mods` добавит все `.jar` из `optional-mods/` в проверку `inspect_alpha.py`, серверный запуск `prepare_server.py` и внутрь `overrides/mods/` итогового `.mrpack` (если вы распространяете архив только для себя/своего сервера).
