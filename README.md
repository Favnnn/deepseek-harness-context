# dsh-context

A context-visualization window for the DeepSeek Harness web GUI: a small button appears beside the composer's context % ring; clicking it opens a floating window with two views. **Dialog** (default) is a *pin board*: it contains exactly the fragments of conversation you pinned there yourself — nothing is ever added automatically. Select any text in the chat and a **"To context" button appears in the very top corner of the chat** (the session header, right side); clicking it stores that text verbatim in the plugin's own settings. Pinned fragments are **never compressed**: they live outside the model context, so they survive context compaction and restarts, and the click does not wake the model (no answer is generated — no tokens are spent). Each pin renders as a numbered block card (hover-expand, real **Markdown**, click-to-pin open) with board actions: **rename** it (the name shows in the header instead of the preview; double-click the title or press the button), **merge into a block by its number** (type the target card's 1-based number; the fragments join with a rule into the target card, this one leaves the board), **remind** (the fragment is sent into the live context under a `---Reminder---` banner as injected context — the model sees it in its next request but is not woken now, and the card stays on the board), **reorder the board** by dragging the ⠿ grip (drop a card onto another to place it before that one), and **remove** it from the board. **Blocks** lists everything currently in the *live* model context in numbered model-visible order (system prompt, tool schemas, user / assistant / tool / injected-context messages, compaction checkpoints) with full payload and meta (seq, turn/step, tool name, timestamp, token price) — and every such block has an **"Unload to compaction"** button: the harness's own compaction engine folds the oldest part of the model context into one summary checkpoint — placed **in position** (where the old content was, not at the end), while the pinned dialog copies stay untouched. Press it **any time**: if the chat is mid-turn the request is queued and runs the moment the agent goes quiet (patience: 10 minutes). Hovering animates a block open; clicking pins it open (click again to unpin; selecting text inside a block does not toggle). The window drags by its header and resizes from the right, bottom, and bottom-right edges (like the agents board; the layout persists). The toggle and language (Auto/EN/RU) live in a card at the bottom of Settings → Plugins and work live, without restarts.

Plugin version: **2.4.0**.

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
3. Removes the `context-view` section from `settings.yaml` (the pin board lives there — uninstalling removes the pins too).

The system returns to its pre-install state. The master folder is left untouched; delete it yourself if you no longer need it. Restart `pnpm dsh web` afterwards.

## Moving to another PC

1. Copy the whole `dsh-context` folder to the other PC at any path (for example `C:\Tools\dsh-context`).
2. That PC needs the harness installed and `pnpm dsh web` run at least once.
3. Run `powershell -ExecutionPolicy Bypass -File C:\Tools\dsh-context\install.ps1`.
4. Reload the page — the button is live.

## How it works

- **host.mjs** — the host half (no imports at all): registers the `context-view` settings section (`enabled`, `language`, `pins`) and mounts `/context-view/*` routes on the web server. `pins` is one JSON string — the verbatim pin board — normalized on every settings load (shape-checked, optional `title` ≤120 chars, capped at 500 pins / 32 000 chars each) and mirrored live to every client; the model never sees it. `GET /context-view/snapshot?session=<id>` reads the live `Session`: the last `request/header` (system prompt, tool schemas, model) and `request/context` (window capacity), the model-visible surface (`session.surface.nodes`) in order, and per-node token prices from the `tokenMeter` service when mounted (a chars/4 heuristic otherwise). Compaction checkpoints surface as their own block kind. Block texts are capped per block and per response so the panel stays light. `POST /context-view/unload` `{session, seq?}` runs **queued manual compaction**: the route resolves the session's live `Agent` through the `agents` service, reads `compaction` off `agent.ctx` (the service is mounted in the agent's scoped realm — the host plane disables `compaction-basic`), and calls `compactNow(agent, signal)` — the exact transaction the shipped `/compact` command runs: it opens its own maintenance turn, folds the oldest useful prefix of the surface into ONE summary checkpoint, and lands that checkpoint **in place** at the head of the folded range (not at the end). `seq` is only a reference point: the response reports `targetCompacted` when the clicked block ended up folded. The engine refuses while an agent turn is open; instead of failing, the route holds the request and retries every 2 s (up to 10 minutes), so the button works at any moment. Other engine refusals (surface changed, persistence) come back as an error the card shows. `POST /context-view/remind` `{session, text, summary?}` appends one plugin-sourced `user/message` notice (`surfaceOp: 'append'`, source `{kind:'plugin', plugin:'dsh-context', form:'notice'}`) onto the live surface — the same injection pattern the harness's own runtime-context reminders use: the node is model-visible on the next request and renders in the chat, but the route issues no wake, so no turn opens and the model analyzes nothing at send time. `GET /context-view/health` is a boot canary.
- **client.js** — the browser bundle in ModuleLoader format, `React.createElement` only, externals: react, ui-primitives. Registers the composer button (`conversation.input.right`), the floating window (`shell.overlay`: draggable by the header, resizable by the right/bottom/bottom-right edges, layout kept in `localStorage`, close on Escape or ✕, auto-refresh every 5 s while open, opens scrolled to the latest block), the header pin button (`conversation.session.header.utilities`), and the Settings → Plugins card (`settings.plugin.item`, key `context-view`, `priority: 100` so it renders last). The window has a **Dialog / Blocks** toggle (persisted in `localStorage`, Dialog by default). Dialog renders the pin store of the current session — numbered cards (`MarkdownText` bodies, hover-expand, click-pin) with meta (time, chars, ~tokens) and three board actions: **rename** (inline input in the header; Enter saves, Escape cancels; the saved name replaces the preview and a double-click on it re-opens the editor), **merge into a block by number** (the button turns into a small `№` input; the entered number is the target card's printed number, fragments join chronologically under a `***` rule and the result keeps the target's slot; refused when the joined text would pass the host's per-pin ceiling), **remind** (the host injects `---Reminder---` + the fragment verbatim as a notice into the live session — model-visible on the next request, no wake, the card stays), **drag-reorder** by the ⠿ grip (drop before the target card), and **remove**. Blocks is the live technical list, and each unloadable card (user / assistant / tool-result / injected-context / compaction with a real seq) carries the **Unload to compaction** action against the host route — it stays in a waiting state while the host queues the request behind a busy turn, and a successful unload refreshes the snapshot so the old content visibly collapses into an in-place summary. The **"To context"** button appears whenever page text is selected (a capture-phase watcher mirrors the selection); clicking it appends `{id, session, text, time}` to the settings `pins` string via the bound `settingsScope` — purely a settings write: no prompt, no cancel, no model call. A short-lived last-write override keeps back-to-back board edits racing the settings mirror from clobbering each other. The dictionaries are `en`/`ru`; language Auto follows the GUI locale, EN/RU pin it explicitly.
- **Storage**: everything — on/off, language, and the pin board — lives in `%DSH_HOME%\settings.yaml` (section `context-view`), so pins survive compaction, restarts, and page reloads, and apply live through the settings mirror.

## Files

| File | Role |
|---|---|
| `package.json` | manifest: name `dsh-context`, `dsh.client.platform: web`, export `./client` → `client.js` |
| `host.mjs` | host half: the settings section + the `/context-view/*` snapshot and unload routes |
| `client.js` | browser bundle: composer button, pin button, window (board + blocks), settings card |
| `install.ps1` | one-run installation (copy into `%DSH_HOME%\plugins\` + the profile-patch row) |
| `uninstall.ps1` | one-run removal (the row + the installed copy + the settings section) |
| `install.bat` / `uninstall.bat` | double-click wrappers for the two scripts |
| `cordis.patch.yml` | informational copy of the installed row (rewritten by install.ps1) |
| `README.md` | this file; copied into the installed folder |

## Troubleshooting

- **The button is missing after installation.** Reload the page (F5); if it stays missing, restart `pnpm dsh web` once. Check: `http://127.0.0.1:3080/plugins/dsh-context/client.js` must be served (not 404), and `http://127.0.0.1:3080/context-view/health` must answer `ok`.
- **The panel says the host route is unavailable.** The web server was started before installation — restart it once. The Dialog board still works: pins come from the settings mirror, not the route.
- **"Unload" says it failed.** Pressing it at any moment is fine — while the agent is mid-turn the host simply queues and waits. A real failure means the engine changed its mind (the surface moved during summarization) or the chat stayed busy past 10 minutes; refresh and press again. "Nothing older to fold" just means the compactable prefix is empty right now.
- **The panel is empty for an old session.** A cold (not open) session has no live surface on the host; open the session in the GUI (it attaches) and press Refresh.
- **Switched off in Settings and the button stayed.** The button hides within one settings-mirror tick; a page reload is always safe.

---

# Русский (оригинал)

Панель визуализации контекста для web GUI DeepSeek Harness: рядом с кольцом контекста % на панели ввода появляется кнопка; по нажатию открывается плавающее окно с двумя видами. **Диалог** (по умолчанию) — это *доска закреплённого*: в ней ровно те фрагменты переписки, которые вы сами туда закрепили, и ничего не попадает автоматически. Выделите любой текст в чате — в **самом верхнем углу чата** появится кнопка **«В контекст»**; нажатие сохраняет выделенное дословно в настройки плагина. Закреплённые фрагменты **не сжимаются никогда**: они живут вне контекста модели, переживают сжатие контекста и перезапуски, а нажатие не будит модель (ответ не генерируется — токены не тратятся). Каждая карточка — нумерованный блок (разворот при наведении, живой **Markdown**, клик — закрепить открытым) с действиями: **переименовать** (имя показывается вместо превью; двойной клик по нему или кнопка), **слить с блоком по номеру** (кнопка превращается в поле «№»: введите номер целевой карточки — фрагменты объединятся через разделитель `***`, результат останется на месте цели), **напомнить** (фрагмент уходит в живой контекст под шапкой `---Напоминание---` как инжектированный контекст — модель увидит его в следующем запросе, но сейчас не просыпается, а карточка остаётся на доске), **менять порядок перетаскиванием** за ⠿ (бросьте карточку на другую — она встанет перед ней) и **убрать с доски**. **Блоки** — полный технический список того, что сейчас в *живом* контексте модели (системный промпт, схемы инструментов, сообщения user/assistant/tool/инжектированного контекста, чекпойнты упаковки) с текстом, seq, ходом/шагом, инструментом, временем и ценой в токенах — и на каждом таком блоке кнопка **«Выгрузить на сжатие»**: собственный движок компакции harness сворачивает самое старое содержимое в одну сводку — на его месте, а не в конце (закреплённые копии «Диалога» не трогаются). Нажимать можно в любой момент: если чат занят, запрос становится в очередь и выполнится, когда агент замолчит (терпение — 10 минут). Наведение разворачивает блок анимацией, клик закрепляет его открытым (повторный клик — открепить; выделение текста внутри блока не переключает). Окно перемещается за заголовок и растягивается за правый/нижний/нижний-правый края (макет сохраняется). Переключатель и язык (Авто/EN/RU) — в карточке внизу Settings → Plugins, работают живьём, без перезапусков.

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
3. Убирает раздел `context-view` из `settings.yaml` (доска закреплённого живёт там — при удалении пропадут и пины).

Система возвращается в первоначальное состояние. Мастер-папку скрипт не трогает — удалите её сами, если она больше не нужна. После удаления перезапустите `pnpm dsh web`.

## Перенос на другой ПК

1. Скопируйте всю папку `dsh-context` на другой ПК в любой путь — флешкой, архивом, по сети.
2. На том ПК должен быть установлен harness и хотя бы раз запущен `pnpm dsh web`.
3. Запустите `powershell -ExecutionPolicy Bypass -File C:\Tools\dsh-context\install.ps1`.
4. Обновите страницу — кнопка заработает.

## Как это устроено

- **host.mjs** — host-половина (без единого импорта): регистрирует секцию настроек `context-view` (`enabled`, `language`, `pins`) и навешивает на web-сервер маршруты `/context-view/*`. `pins` — одна JSON-строка, дословная доска закреплённого; при каждой загрузке настроек нормализуется (проверка формы, потолок 500 пинов по 32 000 символов) и живьём зеркалится всем клиентам; модель её не видит. `GET /context-view/snapshot?session=<id>` читает живую `Session`: последний `request/header` (системный промпт, схемы инструментов, модель) и `request/context` (ёмкость окна), поверхность, видимую модели (`session.surface.nodes`), по порядку, и цены узлов в токенах из сервиса `tokenMeter` (если смонтирован; иначе эвристика ~4 символа на токен). Чекпойнты упаковки — отдельный вид блока. Тексты блоков ограничены по длине, чтобы панель оставалась лёгкой. `POST /context-view/unload` `{session, seq?}` запускает **ручную компакцию в очереди**: маршрут находит живой `Agent` сессии через сервис `agents`, берёт `compaction` из `agent.ctx` (сервис живёт в скоупе агента — на корневом уровне `compaction-basic` отключён) и вызывает `compactNow(agent, signal)` — ровно ту же транзакцию, что и штатная команда `/compact`: она открывает свой служебный ход, сворачивает самую старую осмысленную часть поверхности в один чекпойнт-сводку и ставит его **на место** свёрнутого диапазона (в начало, а не в конец). `seq` — лишь ориентир: в ответе приходит `targetCompacted`, если нажатый блок попал в свёртку. Пока открыт ход агента, движок отказывает (`busy`) — поэтому маршрут не падает, а держит запрос и повторяет каждые 2 с (до 10 минут): кнопка работает в любой момент. Прочие отказы движка (поверхность изменилась, сброс на диск) возвращаются ошибкой, которую карточка и показывает. `POST /context-view/remind` `{session, text, summary?}` дописывает в живую поверхность один `user/message`-notice с плагинным источником (`{kind:'plugin', plugin:'dsh-context', form:'notice'}`, `surfaceOp:'append'`) — тем же узором, каким сам harness инжектирует рантайм-напоминания: узел виден модели со следующего запроса и отображается в чате, но wake не выдаётся — ход не открывается, модель ничего не анализирует в момент отправки. `GET /context-view/health` — canary запуска.
- **client.js** — клиентский бандл в формате ModuleLoader, только `React.createElement`, внешние модули: react, ui-primitives. Регистрирует кнопку в панели ввода (`conversation.input.right`), плавающее окно (`shell.overlay`: перемещение за заголовок, растягивание за края, макет в `localStorage`, закрытие по Escape или ✕, автообновление каждые 5 с, открывается прокрученным к последнему блоку), кнопку закрепления в шапке чата (`conversation.session.header.utilities`) и карточку в Settings → Plugins (`settings.plugin.item`, ключ `context-view`, `priority: 100` — карточка внизу списка). В окне переключатель **Диалог / Блоки** (хранится в `localStorage`, по умолчанию Диалог). Диалог рендерит доску закреплённого текущей сессии — нумерованные карточки с телом-`MarkdownText` и мета-строкой (время, символы, ~токены); действия: **переименовать** (инлайн-поле в заголовке; Enter — сохранить, Escape — отмена, двойной клик по имени — снова открыть), **слить в №** (кнопка превращается в поле с номером цельевой карточки; фрагменты склеиваются хронологически через `***`, результат занимает место цели), **напомнить** (хост инжектирует `---Напоминание---` + текст фрагмента дословно в живую сессию как notice — видно модели со следующего запроса, без пробуждения, карточка остаётся), **перестановка перетаскиванием** за ⠿ (бросок перед целевой карточкой) и красное **убрать**; пустая доска объясняет жест. Блоки — живой технический список; на каждой выгружаемой карточке (user/assistant/tool-result/инжектив/упаковка с настоящим seq) кнопка **«Выгрузить на сжатие»** против host-маршрута: пока хост держит запрос в очереди за занятым агентом, карточка показывает «жду…»; после успеха снимок обновляется, и старое содержимое заметно схлопывается в сводку на своём месте. Кнопка **«В контекст»** видна, пока в странице выделен текст (watcher на capture зеркалит выделение в мини-стор); клик дописывает `{id, session, text, time}` в строку `pins` настроек через связанный `settingsScope` — это чисто запись настроек: без prompt, без cancel, без обращений к модели. Словари `en`/`ru`; язык «Авто» следует локали GUI, EN/RU закрепляют язык явно.
- **Хранилище**: всё — вкл/выкл, язык и доска закреплённого — в `%DSH_HOME%\settings.yaml` (раздел `context-view`), поэтому пины переживают сжатие контекста, перезапуски и перезагрузки страницы и применяются живьём через зеркало настроек.

## Устранение неполадок

- **Кнопка не появилась после установки.** Обновите страницу (F5); не помогло — один раз перезапустите `pnpm dsh web`. Проверки: `http://127.0.0.1:3080/plugins/dsh-context/client.js` должен отдаваться (не 404), а `http://127.0.0.1:3080/context-view/health` — отвечать `ok`.
- **Панель пишет, что маршрут хоста недоступен.** Web-сервер запущен до установки — перезапустите его один раз. Сам «Диалог» при этом работает: пины приходят из зеркала настроек, а не из маршрута.
- **«Выгрузить» не получилось.** Нажимать можно в любой момент: посреди хода агента запрос просто стоит в очереди и ждёт. Настоящий ошибочный ответ — это изменение поверхности во время суммаризации или 10 минут занятости; обновите снимок и нажмите ещё раз. «Сворачивать уже нечего» означает, что свёртываемый хвост пока пуст.
- **Панель пуста для старой сессии.** Холодная (не открытая) сессия не имеет живой поверхности на хосте; откройте сессию в GUI (она присоединится) и нажмите «Обновить».
- **Выключил в Settings, а кнопка осталась.** Кнопка скрывается за один тик зеркала настроек; перезагрузка страницы всегда безопасна.
