# dsh-context

A context-visualization window for the DeepSeek Harness web GUI: a small button appears beside the composer's context % ring; clicking it opens a floating window that lists — in numbered blocks, in model-visible order — everything currently in the chat context (system prompt, tool schemas, user / assistant / tool / injected-context messages, compaction checkpoints). Hovering a block animates it open and reveals the full payload with its meta (seq, turn/step, tool name, timestamp, token price). The window drags by its header and resizes from the right, bottom, and bottom-right edges (like the agents board; the layout persists). Settings → Plugins carries the enable switch and the panel language (Auto/EN/RU) — both work live, without any restart; the card sits at the bottom of the Plugins tab.

Версия плагина: **1.1.0**.

> **Languages / Языки:** English first, the Russian original follows after the divider.

---

## Installation

Requirements: an installed DeepSeek Harness and at least one `pnpm dsh web` run on this PC (so `%DSH_HOME%\profiles\web\` exists; by default `%DSH_HOME%` = `C:\<user>\.dsh`). Windows PowerShell 5.1+ ships with Windows.

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
```

Or just double-click `install.bat` — it runs the same script and keeps the window open.

The script (run from the plugin folder):

1. Copies the **whole folder** into `%DSH_HOME%\plugins\dsh-context\`. That copy is the live plugin.
2. Adds a managed row to `%DSH_HOME%\profiles\web\cordis.patch.yml` (marked `# dsh-context (managed by install.ps1)`), pointing at `…\plugins\dsh-context\host.mjs`.
3. Rewrites `cordis.patch.yml` in the master folder — an informational copy of the installed row only.

Re-running is safe and idempotent: the copy and the row are refreshed, no duplicates appear. The harness **never reads** the master folder after installation — you may rename, move, or copy it to another PC. If you changed files in the master folder, run `install.ps1` again to refresh the installed copy.

The web profile watches its patch layer (`patchReload: live`), so the host half mounts without a restart. After installing, reload the page (F5). If the button still does not appear, restart `pnpm dsh web` once — the client module registry is built at server start. From then on, the Settings → Plugins toggle works live, without any restart, and every future `pnpm dsh web` re-attaches the plugin by itself from the managed row.

## Uninstalling

```powershell
powershell -ExecutionPolicy Bypass -File uninstall.ps1
```

Or double-click `uninstall.bat` — when run from the installed copy it first moves itself to `%TEMP%`, so the plugin folder can delete cleanly.

The script works the same from the master folder and from the installed copy. It:

1. Removes the managed row from `%DSH_HOME%\profiles\web\cordis.patch.yml`.
2. Deletes the installed copy `%DSH_HOME%\plugins\dsh-context\`.
3. Removes the `context-view` section from `settings.yaml`.

The system returns to its pre-install state. The master folder is left untouched; delete it yourself if you no longer need it. Restart `pnpm dsh web` afterwards.

## Moving to another PC

1. Copy the whole `dsh-context` folder to the other PC at any path (for example `C:\Tools\dsh-context`).
2. That PC needs the harness installed and `pnpm dsh web` run at least once.
3. Run `powershell -ExecutionPolicy Bypass -File C:\Tools\dsh-context\install.ps1`.
4. Reload the page — the button is live.

## How it works

- **host.mjs** — the host half (no imports at all): registers the `context-view` settings section (`enabled`) through the settings service and mounts `/context-view/*` routes on the web server. `GET /context-view/snapshot?session=<id>` reads the live `Session`: the last `request/header` (system prompt, tool schemas, model) and `request/context` (window capacity), the model-visible surface (`session.surface.nodes`) in order, and per-node token prices from the `tokenMeter` service when mounted (a chars/4 heuristic otherwise). Compaction checkpoints surface as their own block kind. Block texts are capped per block and per response so the panel stays light. `GET /context-view/health` is a boot canary.
- **client.js** — the browser bundle in ModuleLoader format, `React.createElement` only, externals: react, ui-primitives. Registers the composer button (`conversation.input.right`), the floating window (`shell.overlay`: draggable by the header, resizable by the right/bottom/bottom-right edges, layout kept in `localStorage`, close on Escape or ✕, auto-refresh every 5 s while open), and the Settings → Plugins card (`settings.plugin.item`, key `context-view`, registered with `priority: 100` so it renders last). Blocks render collapsed to one line; hovering expands the body with the full text and its meta (grid-rows animation — no max-height overshoot, no scrollbar pop, no jank). The dictionaries are `en`/`ru`; language Auto follows the GUI locale, EN/RU pin it explicitly.
- **Storage**: settings live in `%DSH_HOME%\settings.yaml` (section `context-view`), so the on/off state survives restarts and applies live through the settings mirror.

## Files

| File | Role |
|---|---|
| `package.json` | manifest: name `dsh-context`, `dsh.client.platform: web`, export `./client` → `client.js` |
| `host.mjs` | host half: the settings section + the `/context-view/*` snapshot routes |
| `client.js` | browser bundle: composer button, blocks panel, settings card |
| `install.ps1` | one-run installation (copy into `%DSH_HOME%\plugins\` + the profile-patch row) |
| `uninstall.ps1` | one-run removal (the row + the installed copy + the settings section) |
| `install.bat` / `uninstall.bat` | double-click wrappers for the two scripts |
| `cordis.patch.yml` | informational copy of the installed row (rewritten by install.ps1) |
| `README.md` | this file; copied into the installed folder |

## Troubleshooting

- **The button is missing after installation.** Reload the page (F5); if it stays missing, restart `pnpm dsh web` once. Check: `http://127.0.0.1:3080/plugins/dsh-context/client.js` must be served (not 404), and `http://127.0.0.1:3080/context-view/health` must answer `ok`.
- **The panel says the host route is unavailable.** The web server was started before installation — restart it once.
- **The panel is empty for an old session.** A cold (not open) session has no live surface on the host; open the session in the GUI (it attaches) and press Refresh.
- **Switched off in Settings and the button stayed.** The button hides within one settings-mirror tick; a page reload is always safe.

---

# Русский (оригинал)

Панель визуализации контекста для web GUI DeepSeek Harness: рядом с кольцом контекста % на панели ввода появляется кнопка; по нажатию открывается панель, где по нумерованным блокам в порядке, видимом модели, показано всё, что сейчас в контексте чата (системный промпт, схемы инструментов, сообщения user/assistant/tool/инжектированного контекста, чекпойнты упаковки). При наведении блок анимированно раскрывается и показывает полную информацию: текст, seq, ход/шаг, инструмент, время, цену в токенах. Переключатель в Settings → Plugins работает живьём, без перезапусков.

## Установка

Требуется: установленный DeepSeek Harness и хотя бы один запуск `pnpm dsh web` на этом ПК (чтобы существовал `%DSH_HOME%\profiles\web\`; по умолчанию `%DSH_HOME%` = `C:\<пользователь>\.dsh`).

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
```

Или просто дважды кликните `install.bat` — он делает то же самое и не закрывает окно.

Скрипт (запускаемый из папки плагина):

1. Копирует **всю папку** в `%DSH_HOME%\plugins\dsh-context\`. Эта копия и есть живой плагин.
2. Добавляет управляемую строку в `%DSH_HOME%\profiles\web\cordis.patch.yml` (маркер `# dsh-context (managed by install.ps1)`), указывающую на `…\plugins\dsh-context\host.mjs`.
3. Переписывает `cordis.patch.yml` в мастер-папке — это только информационная копия установленного ряда.

Повторный запуск безопасен и идемпотентен. Папка-мастер после установки harness'ом **не читается** — её можно перенести или скопировать на другой ПК. Изменили файлы в мастер-папке — запустите `install.ps1` заново.

Web-профиль следит за своим патч-слоем (`patchReload: live`), поэтому host-половина подмонтируется без рестарта. После установки обновите страницу (F5). Если кнопка не появилась — один раз перезапустите `pnpm dsh web` (реестр клиентских модулей строится при старте сервера). Дальше переключатель в Settings → Plugins работает живьём, а каждый новый `pnpm dsh web` сам подтягивает плагин из управляемой строки.

## Удаление

```powershell
powershell -ExecutionPolicy Bypass -File uninstall.ps1
```

Или двойной клик `uninstall.bat` — при запуске из установленной копии он сначала копирует скрипт в `%TEMP%`, чтобы папка плагина удалилась чисто.

Скрипт работает одинаково из мастер-папки и из установленной копии. Он:

1. Убирает управляемую строку из `%DSH_HOME%\profiles\web\cordis.patch.yml`.
2. Удаляет установленную копию `%DSH_HOME%\plugins\dsh-context\`.
3. Убирает раздел `context-view` из `settings.yaml`.

Система возвращается в первоначальное состояние. Мастер-папку скрипт не трогает — удалите её сами, если она больше не нужна. После удаления перезапустите `pnpm dsh web`.

## Перенос на другой ПК

1. Скопируйте всю папку `dsh-context` на другой ПК в любой путь — флешкой, архивом, по сети.
2. На том ПК должен быть установлен harness и хотя бы раз запущен `pnpm dsh web`.
3. Запустите `powershell -ExecutionPolicy Bypass -File C:\Tools\dsh-context\install.ps1`.
4. Обновите страницу — кнопка заработает.

## Как это устроено

- **host.mjs** — host-половина (без единого импорта): регистрирует секцию настроек `context-view` (`enabled`) и навешивает на web-сервер маршруты `/context-view/*`. `GET /context-view/snapshot?session=<id>` читает живую `Session`: последний `request/header` (системный промпт, схемы инструментов, модель) и `request/context` (ёмкость окна), поверхность, видимую модели (`session.surface.nodes`), по порядку, и цены узлов в токенах из сервиса `tokenMeter` (если смонтирован; иначе эвристика ~4 символа на токен). Чекпойнты упаковки — отдельный вид блока. Тексты блоков ограничены по длине, чтобы панель оставалась лёгкой. `GET /context-view/health` — canary запуска.
- **client.js** — клиентский бандл в формате ModuleLoader, только `React.createElement`, внешние модули: react, ui-primitives. Регистрирует кнопку в панели ввода (`conversation.input.right`), плавающее окно (`shell.overlay`: перемещение за заголовок, растягивание за правый/нижний/нижний-правый края, макет хранится в `localStorage`, закрытие по Escape или ✕, автообновление каждые 5 с, пока открыто) и карточку в Settings → Plugins (`settings.plugin.item`, ключ `context-view`, `priority: 100` — карточка внизу списка). Блоки свёрнуты в одну строку; при наведении разворачиваются с полным текстом и метаданными (анимация через grid-rows — без рывков). Словари `en`/`ru`; язык «Авто» следует локали GUI, EN/RU закрепляют язык явно.
- **Хранилище**: настройки — `%DSH_HOME%\settings.yaml` (раздел `context-view`), поэтому состояние вкл/выкл переживает перезапуски и применяется живьём через зеркало настроек.

## Устранение неполадок

- **Кнопка не появилась после установки.** Обновите страницу (F5); не помогло — один раз перезапустите `pnpm dsh web`. Проверки: `http://127.0.0.1:3080/plugins/dsh-context/client.js` должен отдаваться (не 404), а `http://127.0.0.1:3080/context-view/health` — отвечать `ok`.
- **Панель пишет, что маршрут хоста недоступен.** Web-сервер запущен до установки — перезапустите его один раз.
- **Панель пуста для старой сессии.** Холодная (не открытая) сессия не имеет живой поверхности на хосте; откройте сессию в GUI (она присоединится) и нажмите «Обновить».
- **Выключил в Settings, а кнопка осталась.** Кнопка скрывается за один тик зеркала настроек; перезагрузка страницы всегда безопасна.
