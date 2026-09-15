/**
 * dsh-context, Client bundle (ModuleLoader format, React.createElement only).
 *
 * Registers:
 * - `conversation.input.right`: a small button beside the composer's context
 *   ring. Clicking it opens the floating context window — numbered blocks of
 *   the exact model-visible context served by the host half
 *   (`/context-view/snapshot`). Hovering a block animates it open and reveals
 *   the full payload.
 * - `shell.overlay`: the floating window itself (frame layer, like the agents
 *   board): draggable by its header, resizable by the right, bottom, and
 *   bottom-right edges; the layout persists in localStorage.
 * - `settings.plugin.item` (key `context-view`, last priority): the
 *   Settings → Plugins card with the live enable switch and the Auto/EN/RU
 *   language picker.
 */
window.__ModuleLoader__.load({
	id: "dsh-context",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let primitives = require("@deepseek-ai/dsh-client-ui-primitives");

		//#region stylesheet
		const css = [
			".cv-root{display:inline-flex;align-items:center}",
			".cv-button{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;box-sizing:border-box;padding:0;border:1px solid transparent;border-radius:8px;background:0 0;color:var(--dsw-alias-label-tertiary);cursor:pointer;transition:background .15s ease,color .15s ease}",
			".cv-button:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-fill-l2)}",
			".cv-buttonOpen{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-fill-l2);border-color:var(--dsw-alias-border-l3)}",
			".cv-button svg{flex:none}",
			".cv-panel{position:fixed;z-index:78;display:flex;flex-direction:column;box-sizing:border-box;padding:0 0 10px;background:var(--dsw-specific-menu);border:1px solid var(--dsw-alias-border-l1);border-radius:16px;box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-primary);pointer-events:auto;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2)}",
			".cv-header{flex:none;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 14px 8px;cursor:move;user-select:none;touch-action:none}",
			".cv-title{margin:0;font-size:13px;font-weight:600;line-height:18px}",
			".cv-chips{display:flex;flex:1;gap:5px;flex-wrap:wrap;min-width:0}",
			".cv-chip{display:inline-flex;align-items:center;gap:4px;padding:0 7px;border-radius:999px;background:var(--dsw-alias-fill-l2);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px;white-space:nowrap}",
			".cv-chip strong{font-weight:600;color:var(--dsw-alias-label-primary)}",
			".cv-headerAction{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:0;border-radius:8px;background:0 0;color:var(--dsw-alias-label-tertiary);cursor:pointer;transition:color .15s ease,background .15s ease}",
			".cv-headerAction:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-fill-l2)}",
			".cv-refreshBusy{animation:cv-spin .9s linear infinite}",
			"@keyframes cv-spin{to{transform:rotate(360deg)}}",
			".cv-list{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding:2px 14px}",
			/* The main scrollbar, wider than the theme's 8px — the thumb is hard
			   to catch at that size. Colours still resolve from the theme's
			   --dsh-scrollbar-thumb tokens rebound on .cv-panel. */
			".cv-list::-webkit-scrollbar{width:18px}",
			".cv-list::-webkit-scrollbar-track{background:transparent}",
			".cv-list::-webkit-scrollbar-thumb{border:4px solid transparent;background-clip:content-box;border-radius:6px}",
			".cv-note{margin:8px 2px;font-size:12px;line-height:16px;color:var(--dsw-alias-label-tertiary)}",
			".cv-block{box-sizing:border-box;padding:6px 8px;border:1px solid var(--dsw-alias-border-l3);border-radius:10px;background:var(--dsw-alias-fill-l1,transparent);cursor:default;transform-origin:left top;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}",
			".cv-block:hover{transform:scale(1.008);border-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-flat,var(--dsw-elevation-prominent))}",
			".cv-block{cursor:pointer}",
			".cv-blockHead{display:flex;align-items:center;gap:7px;min-width:0}",
			".cv-num{flex:none;min-width:20px;padding:0 5px;border-radius:6px;background:var(--dsw-alias-fill-l2);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px;text-align:center;font-variant-numeric:tabular-nums}",
			".cv-kind{flex:none;display:inline-block;min-width:64px;padding:0 6px;border-radius:6px;font-size:10px;font-weight:600;line-height:18px;text-align:center;white-space:nowrap;color:#fff}",
			".cv-kindUser{background:#3b82f6}",
			".cv-kindAssistant{background:#8b5cf6}",
			".cv-kindContext{background:#0ea5a4}",
			".cv-kindCompaction{background:#d97706}",
			".cv-kindPinned{background:#10b981}",
			".cv-kindToolresult{background:#f97316}",
			".cv-kindTools{background:#64748b}",
			".cv-kindSystemprompt{background:#22c55e}",
			".cv-kindUnknown{background:#6b7280}",
			".cv-preview{flex:1;min-width:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".cv-tokens{flex:none;font-size:11px;line-height:18px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}",
			/* Grid-rows expansion: the row height animates to the exact content
			   height (no arbitrary max-height overshoot, no overflow flip mid
			   transition — the previous source of the hover jank). */
			".cv-body{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows .2s ease,opacity .16s ease}",
			".cv-block:hover .cv-body{grid-template-rows:1fr;opacity:1}",
			/* A click pins a block open; the pin survives hover-out and refreshes. */
			".cv-blockOpen .cv-body{grid-template-rows:1fr;opacity:1}",
			".cv-blockOpen:hover .cv-body{grid-template-rows:1fr;opacity:1}",
			".cv-blockOpen{border-color:var(--dsw-alias-border-l1)}",
			".cv-bodyInner{min-height:0;overflow:hidden}",
			".cv-scroll{max-height:260px;overflow-y:auto;overflow-x:hidden;margin-top:6px}",
			".cv-meta{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:4px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}",
			".cv-metaItem strong{font-weight:600;color:var(--dsw-alias-label-secondary)}",
			".cv-text{margin:0;white-space:pre-wrap;word-break:break-word;font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:11px;line-height:15px;color:var(--dsw-alias-label-secondary)}",
			".cv-truncated{margin-top:4px;font-size:11px;color:var(--dsw-alias-label-tertiary)}",
			/* Dialog mode renders messages as block cards too (same hover
			   expansion); the body is real Markdown through MarkdownText.
			   The sizing overrides tame headings inside a compact window. */
			".cv-md{font-size:12px;line-height:16px;color:var(--dsw-alias-label-secondary);word-break:break-word}",
			".cv-md :is(h1,h2,h3,h4,h5,h6){font-size:13px;line-height:18px;margin:6px 0 2px;color:var(--dsw-alias-label-primary)}",
			".cv-md :is(p,ul,ol,blockquote){margin:3px 0}",
			".cv-md :is(ul,ol){padding-left:18px}",
			".cv-md pre{max-width:100%;overflow-x:auto;font-size:11px;line-height:15px}",
			".cv-md code{font-size:11px}",
			".cv-md table{font-size:11px}",
			/* Compaction translation control (inside the expanded body). */
			".cv-trBar{display:flex;align-items:center;gap:6px;margin:0 0 6px}",
			".cv-trGo{height:20px;padding:0 9px;border:1px solid var(--dsw-alias-border-l3);border-radius:999px;background:var(--dsw-alias-fill-l2);color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:18px;cursor:pointer;white-space:nowrap}",
			".cv-trGo:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-fill-l3,var(--dsw-alias-fill-l2))}",
			".cv-trBusy{font-size:10.5px;color:var(--dsw-alias-label-tertiary)}",
			".cv-trDanger{color:#ef4444;border-color:rgba(239,68,68,.35)}",
			".cv-trDanger:hover{color:#dc2626;background:rgba(239,68,68,.10)}",
			".cv-nameInput{flex:1;min-width:0;height:18px;padding:0 6px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-fill-l1);color:var(--dsw-alias-label-primary);font-size:11px}",
			".cv-pinNamed{color:var(--dsw-alias-label-primary);font-weight:600}",
			".cv-mergeInput{flex:0 0 3.5em;width:3.5em;text-align:center}",
			".cv-grip{flex:0 0 auto;padding:0 2px;font-size:13px;line-height:1;opacity:.45;cursor:grab;user-select:none}",
			".cv-grip:hover{opacity:1}",
			".cv-dragging{opacity:.4}",
			".cv-dropTarget{border-color:#10b981;box-shadow:inset 0 0 0 1px #10b981}",
			/* The \"To context\" button, seated in the chat header corner. */
			".cv-selbtn{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-fill-l2);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px;cursor:pointer;white-space:nowrap;user-select:none;transition:color .12s ease,background .12s ease,border-color .12s ease}",
			".cv-selbtn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-fill-l3,var(--dsw-alias-fill-l2))}",
			".cv-selbtnOk{color:#22c55e}",
			".cv-selbtnFail{color:#ef4444}",
			".cv-grip{position:absolute;z-index:2;touch-action:none}",
			".cv-gripE{top:0;right:0;bottom:0;width:6px;cursor:ew-resize}",
			".cv-gripS{left:0;right:0;bottom:0;height:6px;cursor:ns-resize}",
			".cv-gripSe{right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;border-bottom-right-radius:16px;background:repeating-linear-gradient(-45deg,transparent 0 4px,var(--dsw-alias-label-tertiary) 4px 5px);opacity:.4}",
			".cv-settings{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:12px;border:1px solid var(--dsw-alias-border-l3);border-radius:12px}",
			".cv-settingsText{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}",
			".cv-settingsTitle{margin:0;font-size:13px;font-weight:600;line-height:18px;color:var(--dsw-alias-label-primary)}",
			".cv-settingsDesc{margin:0;font-size:12px;line-height:16px;color:var(--dsw-alias-label-tertiary)}",
			".cv-settingsControls{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end}",
			".cv-fieldRow{display:flex;align-items:center;gap:8px}",
			".cv-fieldLabel{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}",
			".cv-segmented{display:inline-flex;align-items:stretch;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-fill-l2);padding:2px;gap:2px}",
			".cv-segment{border:0;border-radius:6px;background:0 0;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:18px;padding:1px 9px;cursor:pointer;transition:background .12s ease,color .12s ease}",
			".cv-segment:hover{color:var(--dsw-alias-label-primary)}",
			".cv-segmentActive{background:var(--dsw-specific-menu);color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-elevation-flat,0 1px 2px rgba(0,0,0,.15))}",
			".cv-segment:disabled{cursor:default;opacity:.5}",
		].join("\n");
		const tagId = "dsh-context/context-view.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-context";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region locales
		const en = {
			"button.tooltip": "Context blocks",
			"panel.title": "Chat context",
			"panel.empty": "Nothing has entered the context yet.",
			"panel.loading": "Loading…",
			"panel.error.disabled": "The context panel is off — enable it in Settings → Plugins.",
			"panel.error.offline": "Host route unavailable — restart the web server once.",
			"panel.error.session": "This session is not open on the host.",
			"panel.error.generic": "Failed to load the context snapshot.",
			"panel.refresh": "Refresh",
			"panel.close": "Close",
			"panel.resize": "Drag to resize",
			"panel.dragHint": "Drag the header to move",
			"chip.user": "user",
			"chip.assistant": "assistant",
			"chip.context": "context",
			"chip.compaction": "compaction",
			"chip.tool-result": "tool",
			"chip.tools": "tools",
			"chip.system-prompt": "system",
			"chip.unknown": "block",
			"stats.blocks": "blocks",
			"stats.used": "used",
			"stats.window": "window",
			"stats.system": "system",
			"stats.tools": "tools",
			"stats.messages": "messages",
			"meta.seq": "seq",
			"meta.turn": "turn",
			"meta.step": "step",
			"meta.time": "time",
			"meta.tool": "tool",
			"meta.producer": "producer",
			"meta.form": "form",
			"meta.shadowed": "shadowed",
			"meta.chars": "chars",
			"meta.range": "range",
			"meta.error": "error",
			"truncated": "text cut for transport",
			"mode.blocks": "Blocks",
			"mode.dialog": "Dialog",
			"addctx.label": "To context",
			"addctx.hint": "Pin the selected fragment to the dialog board (the model is not involved)",
			"addctx.ok": "Pinned",
			"addctx.fail": "Failed",
			"md.copy": "Copy",
			"md.copied": "Copied",
			"md.footnotes": "Footnotes",
			"pin.label": "pinned",
			"pin.empty": "The board is empty. Select any text in the chat and press \"To context\" in the top corner of the chat — the fragment is stored verbatim here and survives context compaction.",
			"pin.rename": "Rename",
			"pin.namePh": "Block name",
			"pin.mergeTo": "Merge into №",
			"pin.mergeToHint": "Type the target block's number (1, 2, 3…) to join this fragment into it, separated by a rule; this card then leaves the board",
			"pin.mergePh": "№",
			"pin.remove": "Remove from dialog",
			"pin.remind": "Remind",
			"pin.remindHint": "Send this fragment into the live context under a \"---Reminder---\" banner: the model will see it in the next message, but wakes up and analyzes nothing right now. The card stays on the board.",
			"pin.reminding": "Sending…",
			"pin.remindOk": "Sent",
			"pin.remindFail": "Failed — session open?",
			"remind.prefix": "---Reminder---",
			"remind.tag": "Reminder",
			"pin.drag": "Drag to reorder the board",
			"unload.label": "Unload to compaction",
			"unload.hint": "Ask the compaction engine to fold the oldest context into one summary. It runs when the chat is free — if the agent is mid-turn this waits — and lands the summary in place, not at the end. Pinned dialog copies are never touched.",
			"unload.busy": "Waiting for a free moment…",
			"unload.ok": "Sent — the block was replaced by a summary",
			"unload.nothing": "Nothing older to fold — recent blocks stay",
			"unload.fail": "Failed — try again",
			"stats.pins": "pinned",
			"settings.title": "Context panel",
			"settings.description": "A button beside the context % ring opens a floating window with two views. The Dialog board keeps fragments you pinned yourself (select text, press \"To context\" in the top corner of the chat) — stored verbatim, never compressed, the model is not involved; cards can be renamed (double-click the title), merged into a block by its number, reordered by dragging the grip, and \"Remind\" sends a fragment into the live context under a ---Reminder--- banner without waking the model. Blocks shows the live model context, where any block can be sent to compaction (\"Unload\") — pressed any time, it runs the moment the chat goes quiet and folds the oldest content in place. The window drags by its header and resizes from the right/bottom edges.",
			"settings.switch": "Show the context panel button",
			"settings.language": "Language",
			"settings.languageAuto": "Auto"
		};
		const ru = {
			"button.tooltip": "Блоки контекста",
			"panel.title": "Контекст чата",
			"panel.empty": "В контекст пока ничего не попало.",
			"panel.loading": "Загрузка…",
			"panel.error.disabled": "Панель контекста выключена — включите её в Settings → Plugins.",
			"panel.error.offline": "Маршрут хоста недоступен — перезапустите web-сервер один раз.",
			"panel.error.session": "Эта сессия не открыта на хосте.",
			"panel.error.generic": "Не удалось снять снимок контекста.",
			"panel.refresh": "Обновить",
			"panel.close": "Закрыть",
			"panel.resize": "Потяните, чтобы изменить размер",
			"panel.dragHint": "Перетащите за заголовок",
			"chip.user": "пользователь",
			"chip.assistant": "ассистент",
			"chip.context": "контекст",
			"chip.compaction": "упаковка",
			"chip.tool-result": "инструмент",
			"chip.tools": "инструменты",
			"chip.system-prompt": "система",
			"chip.unknown": "блок",
			"stats.blocks": "блоков",
			"stats.used": "занято",
			"stats.window": "окно",
			"stats.system": "система",
			"stats.tools": "тулзы",
			"stats.messages": "сообщения",
			"meta.seq": "seq",
			"meta.turn": "ход",
			"meta.step": "шаг",
			"meta.time": "время",
			"meta.tool": "инструмент",
			"meta.producer": "источник",
			"meta.form": "форма",
			"meta.shadowed": "затенено",
			"meta.chars": "символов",
			"meta.range": "диапазон",
			"meta.error": "ошибка",
			"truncated": "текст обрезан при передаче",
			"mode.blocks": "Блоки",
			"mode.dialog": "Диалог",
			"addctx.label": "В контекст",
			"addctx.hint": "Закрепить выделенный фрагмент в окне «Диалог» (модель в этом не участвует)",
			"addctx.ok": "Закреплено",
			"addctx.fail": "Не вышло",
			"md.copy": "Копировать",
			"md.copied": "Скопировано",
			"md.footnotes": "Сноски",
			"pin.label": "закреплено",
			"pin.empty": "Доска пуста. Выделите любой текст в чате и нажмите «В контекст» в верхнем углу чата — фрагмент хранится здесь дословно и переживает сжатие контекста.",
			"pin.rename": "Переименовать",
			"pin.namePh": "Имя блока",
			"pin.mergeTo": "Слить в №",
			"pin.mergeToHint": "Введите номер блока-цели (1, 2, 3…), чтобы присоединить этот фрагмент к нему через разделитель; эта карточка уйдёт с доски",
			"pin.mergePh": "№",
			"pin.remove": "Убрать из диалога",
			"pin.remind": "Напомнить",
			"pin.remindHint": "Отправить этот фрагмент в живой контекст под шапкой «---Напоминание---»: модель увидит его в следующем сообщении, но сейчас не просыпается и ничего не анализирует. Карточка остаётся на доске.",
			"pin.reminding": "Отправляю…",
			"pin.remindOk": "Отправлено",
			"pin.remindFail": "Не вышло — сессия открыта?",
			"remind.prefix": "---Напоминание---",
			"remind.tag": "Напоминание",
			"pin.drag": "Перетащите, чтобы поменять порядок",
			"unload.label": "Выгрузить на сжатие",
			"unload.hint": "Просьба движку компакции свернуть самое старое содержимое в одну сводку. Выполняется, когда чат свободен: если агент посреди хода — подождёт. Сводка встаёт на место свёрнутого, а не в конец. Закреплённые копии в «Диалоге» не трогаются.",
			"unload.busy": "Жду, когда чат освободится…",
			"unload.ok": "Выгружено — блок заменён сводкой",
			"unload.nothing": "Сворачивать уже нечего — свежие блоки остаются",
			"unload.fail": "Не вышло — ещё раз",
			"stats.pins": "закреплено",
			"settings.title": "Панель контекста",
			"settings.description": "Кнопка рядом с кольцом контекста % открывает плавающее окно с двумя видами. «Диалог» — доска закреплённых вами фрагментов (выделите текст и нажмите «В контекст» в верхнем углу чата): хранятся дословно, не сжимаются, модель в этом не участвует; карточки можно переименовывать (двойной клик по заголовку), сливать с блоком по номеру, менять порядок перетаскиванием за ⠿, а «Напомнить» отправляет фрагмент в живой контекст под шапкой «---Напоминание---», не будя модель. «Блоки» — живой контекст модели, где любой блок можно выгрузить на сжатие: нажимайте в любой момент, выполнится, когда чат освободится, — свёрнутая сводка встанет на место старого содержимого. Окно перемещается за заголовок и растягивается за правый/нижний края.",
			"settings.switch": "Показывать кнопку панели контекста",
			"settings.language": "Язык",
			"settings.languageAuto": "Авто"
		};
		//#endregion
		//#region helpers
		const { Switch, MarkdownText } = primitives;
		function identity(value) {
			return value;
		}
		/** Treat a loading/unavailable scope as the composition default (enabled). */
		function isEnabled(cv) {
			return cv.status === "ready" ? (cv.value ? cv.value.enabled !== false : true) : true;
		}
		/** One dictionary-bound translator with the English map as its terminus. */
		function dictT(dict) {
			return (key) => (dict[key] !== undefined ? dict[key] : (en[key] !== undefined ? en[key] : key));
		}
		// Stable translator identities: MarkdownText caches on the labels
		// object, which is built from these, so a new function per render
		// would discard the markdown render cache every refresh tick.
		const T_EN = dictT(en);
		const T_RU = dictT(ru);
		/** The seat locale chain, with the built-in English map as its terminus. */
		function resolveT(seatT) {
			if (typeof seatT === "function") return seatT;
			return T_EN;
		}
		/**
		 * Language resolution: an explicit `en`/`ru` setting pins that
		 * dictionary; `auto` (the default) follows the GUI locale chain.
		 */
		function pickT(cv, seatT) {
			if (cv.status === "ready" && cv.value) {
				if (cv.value.language === "ru") return T_RU;
				if (cv.value.language === "en") return T_EN;
			}
			return resolveT(seatT);
		}
		/** Compact token count: 1234 → 1.2K, 1234567 → 1.2M. */
		function formatTokens(value) {
			const n = Number(value);
			if (!Number.isFinite(n) || n <= 0) return "0";
			if (n < 1000) return String(Math.round(n));
			if (n < 1000000) return String(Math.round(n / 100) / 10).replace(/\.0$/, "") + "K";
			return String(Math.round(n / 100000) / 10).replace(/\.0$/, "") + "M";
		}
		const KIND_CLASS = {
			user: "cv-kindUser",
			assistant: "cv-kindAssistant",
			context: "cv-kindContext",
			compaction: "cv-kindCompaction",
			"tool-result": "cv-kindToolresult",
			tools: "cv-kindTools",
			"system-prompt": "cv-kindSystemprompt",
			unknown: "cv-kindUnknown"
		};
		function kindClass(kind) {
			return KIND_CLASS[kind] !== undefined ? KIND_CLASS[kind] : "cv-kindUnknown";
		}
		function kindLabel(t, kind) {
			return t("chip." + (en["chip." + kind] !== undefined ? kind : "unknown"));
		}
		function formatTime(ms) {
			const n = Number(ms);
			if (!Number.isFinite(n) || n <= 0) return "";
			try {
				return new Date(n).toLocaleTimeString();
			} catch {
				return "";
			}
		}
		/** One labeled meta item for the expanded block header line. */
		function metaItem(t, key, value) {
			if (value === undefined || value === null || value === "") return null;
			return react.createElement("span", { key: key, className: "cv-metaItem" },
				react.createElement("strong", null, t("meta." + key) + ":"),
				" " + String(value)
			);
		}
		/** Storage ceilings mirrored from the host's pin normalizer. */
		const PIN_MAX_TEXT = 32000;
		const PIN_MAX_COUNT = 500;
		const PINS_TOTAL_CHARS = 600000;
		/** Surface blocks whose kind a single-node compaction span accepts. */
		const UNLOADABLE_KINDS = { user: true, assistant: true, context: true, "tool-result": true, compaction: true };
		/**
		 * Parse the settings `pins` JSON string into well-shaped pin objects.
		 * Pins are the dialog board: user-pinned fragments stored verbatim,
		 * surviving compaction because they never live in the model context.
		 */
		function parsePins(raw) {
			if (typeof raw !== "string" || raw === "") return [];
			let parsed;
			try {
				parsed = JSON.parse(raw);
			} catch {
				return [];
			}
			if (!Array.isArray(parsed)) return [];
			const pins = [];
			for (const pin of parsed) {
				if (pin === null || typeof pin !== "object") continue;
				if (typeof pin.id !== "string" || pin.id === "") continue;
				if (typeof pin.text !== "string" || pin.text === "") continue;
				pins.push(pin);
			}
			return pins;
		}
		/**
		 * Minimal observable store shared between the composer button and the
		 * overlay window (same bundle closure): open flag + owning session.
		 */
		function createMiniStore(initial) {
			let value = initial;
			const listeners = new Set();
			return {
				getSnapshot: () => value,
				set: (next) => {
					if (next === value) return;
					value = next;
					for (const listener of listeners) listener();
				},
				subscribe: (listener) => {
					listeners.add(listener);
					return () => listeners.delete(listener);
				}
			};
		}
		//#endregion
		//#region view mode (dialog / all blocks)
		const MODE_KEY = "context-view.mode";
		/** Read the persisted view mode; the clean dialog is the default. */
		function readMode() {
			try {
				const raw = localStorage.getItem(MODE_KEY);
				return raw === "blocks" ? "blocks" : "dialog";
			} catch {
				return "dialog";
			}
		}
		function writeMode(mode) {
			try {
				localStorage.setItem(MODE_KEY, mode);
			} catch {
				// Unwritable storage keeps the mode session-only.
			}
		}
		//#endregion
		//#region window layout (drag + resize, localStorage-persisted)
		const LAYOUT_KEY = "context-view.layout";
		const MIN_WIDTH = 380;
		const MIN_HEIGHT = 260;
		function clampBetween(value, min, max) {
			return Math.min(Math.max(value, min), Math.max(min, max));
		}
		/** The pre-drag default: a panel-sized window above the composer area. */
		function defaultLayout() {
			const width = clampBetween(640, MIN_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - 24));
			const height = clampBetween(Math.round(window.innerHeight * 0.62), MIN_HEIGHT, Math.max(MIN_HEIGHT, window.innerHeight - 140));
			return {
				width,
				height,
				left: clampBetween(window.innerWidth - width - 16, 8, Math.max(8, window.innerWidth - width - 8)),
				top: clampBetween(window.innerHeight - height - 120, 8, Math.max(8, window.innerHeight - height - 8))
			};
		}
		/** Restore the persisted window layout, clamped to the current viewport. */
		function readLayout() {
			try {
				const raw = localStorage.getItem(LAYOUT_KEY);
				if (!raw) return undefined;
				const parsed = JSON.parse(raw);
				if (!parsed || typeof parsed !== "object") return undefined;
				const vw = window.innerWidth;
				const vh = window.innerHeight;
				const width = clampBetween(Number(parsed.width), MIN_WIDTH, Math.max(MIN_WIDTH, vw - 16));
				const height = clampBetween(Number(parsed.height), MIN_HEIGHT, Math.max(MIN_HEIGHT, vh - 16));
				const left = clampBetween(Number(parsed.left), Math.min(8, vw - 120), vw - 120);
				const top = clampBetween(Number(parsed.top), 0, Math.max(0, vh - 40));
				if (![width, height, left, top].every(Number.isFinite)) return undefined;
				return { width, height, left, top };
			} catch {
				// Unreadable storage (private mode, quota): fall back to the default layout.
				return undefined;
			}
		}
		function writeLayout(layout) {
			try {
				localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
			} catch {
				// Unwritable storage keeps the layout session-only.
			}
		}
		/** One active drag/resize gesture, seeded with the pointer origin and the layout snapshot. */
		function applyGesture(prev, gesture, clientX, clientY) {
			const dx = clientX - gesture.startX;
			const dy = clientY - gesture.startY;
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			if (gesture.mode === "move") {
				return {
					...prev,
					left: clampBetween(gesture.start.left + dx, -(prev.width - 120), vw - 120),
					top: clampBetween(gesture.start.top + dy, 0, vh - 40)
				};
			}
			const next = { ...prev };
			if (gesture.mode === "resize-e" || gesture.mode === "resize-se") {
				next.width = clampBetween(gesture.start.width + dx, MIN_WIDTH, vw - prev.left - 8);
			}
			if (gesture.mode === "resize-s" || gesture.mode === "resize-se") {
				next.height = clampBetween(gesture.start.height + dy, MIN_HEIGHT, vh - prev.top - 8);
			}
			return next;
		}
		//#endregion
		//#region icons
		function IconLayers() {
			return react.createElement("svg", { viewBox: "0 0 16 16", width: "15", height: "15", "aria-hidden": true, fill: "none", stroke: "currentColor", "stroke-width": "1.4", "stroke-linejoin": "round" },
				react.createElement("path", { d: "M8 1.8 14 5 8 8.2 2 5Z" }),
				react.createElement("path", { d: "M3.4 7.6 8 10.1l4.6-2.5" }),
				react.createElement("path", { d: "M3.4 10.6 8 13.1l4.6-2.5" })
			);
		}
		function IconRefresh() {
			return react.createElement("svg", { viewBox: "0 0 16 16", width: "16", height: "16", "aria-hidden": true, fill: "none", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round" },
				react.createElement("path", { d: "M13.5 8a5.5 5.5 0 1 1-1.6-3.9" }),
				react.createElement("path", { d: "M12.6 1.5v3h-3" })
			);
		}
		function IconClose() {
			return react.createElement("svg", { viewBox: "0 0 16 16", width: "16", height: "16", "aria-hidden": true, fill: "none", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round" },
				react.createElement("path", { d: "M3.5 3.5 12.5 12.5 M12.5 3.5 3.5 12.5" })
			);
		}
		//#endregion
		//#region dialog (pin board) view
		/**
		 * One pinned fragment: the block-card look (number, chip, one-line
		 * preview, hover-expand, click-pin) with the verbatim text rendered as
		 * Markdown, plus board actions: rename, merge INTO BLOCK №N (the
		 * number printed on the target card), REMIND (hand the fragment back
		 * to the live context under a reminder banner — the model is not
		 * woken, the card stays), remove; and a grip for drag-reordering.
		 * Pins live in the plugin settings — the model never sees them unless
		 * reminded.
		 */
		function PinBlockView(props) {
			const pin = props.pin;
			const t = props.t;
			const text = String(pin.text === undefined ? "" : pin.text);
			const title = typeof pin.title === "string" ? pin.title : "";
			const flat = text.replace(/[*`#>_~]/g, "").replace(/^\s*[-+]\s+/gm, "").replace(/\s+/g, " ").trim();
			const preview = flat.length > 160 ? flat.slice(0, 160) + "…" : flat;
			const time = formatTime(pin.time);
			const metaBits = [];
			if (time !== "") metaBits.push(t("meta.time") + ": " + time);
			metaBits.push(t("meta.chars") + ": " + String(text.length));
			const [editing, setEditing] = react.useState(false);
			const [merging, setMerging] = react.useState(false);
			const [remind, setRemind] = react.useState("idle");
			const commit = (event) => {
				setEditing(false);
				const next = event.target.value.replace(/\s+/g, " ").trim().slice(0, 120);
				if (next !== title) props.onRename(next);
			};
			const commitMerge = (event) => {
				setMerging(false);
				const target = parseInt(event.target.value, 10);
				if (Number.isFinite(target) && target >= 1 && target <= props.total && target !== props.index + 1) {
					props.onMergeTo(target);
				}
			};
			const doRemind = () => {
				if (remind === "busy") return;
				setRemind("busy");
				Promise.resolve(props.onRemind()).then((ok) => {
					if (ok === true) {
						setRemind("ok");
						setTimeout(() => { setRemind("idle"); }, 1600);
					} else {
						setRemind("fail");
					}
				}, () => { setRemind("fail"); });
			};
			const head = editing ? react.createElement("input", {
				className: "cv-nameInput",
				defaultValue: title,
				placeholder: t("pin.namePh"),
				autoFocus: true,
				onClick: (event) => { event.stopPropagation(); },
				onKeyDown: (event) => {
					event.stopPropagation();
					if (event.key === "Enter") commit(event);
					else if (event.key === "Escape") setEditing(false);
				},
				onBlur: commit
			}) : react.createElement("span", {
				className: title === "" ? "cv-preview" : "cv-preview cv-pinNamed",
				title: t("pin.rename"),
				onDoubleClick: (event) => {
					event.stopPropagation();
					setEditing(true);
				}
			}, title === "" ? preview : title);
			return react.createElement("div", {
				className: "cv-block"
					+ (props.open ? " cv-blockOpen" : "")
					+ (props.dragging === true ? " cv-dragging" : "")
					+ (props.dropTarget === true ? " cv-dropTarget" : ""),
				onDragOver: (event) => {
					if (props.dragId === null || props.dragId === undefined || props.dragId === pin.id) return;
					event.preventDefault();
					props.onDragOver();
				},
				onDrop: (event) => {
					event.preventDefault();
					props.onDrop();
				}
			},
				react.createElement("div", { className: "cv-blockHead", onClick: pinOnToggle(props) },
					react.createElement("span", {
						className: "cv-grip",
						draggable: true,
						title: t("pin.drag"),
						onClick: (event) => { event.stopPropagation(); },
						onDragStart: (event) => {
							event.stopPropagation();
							if (event.dataTransfer !== undefined && event.dataTransfer !== null) {
								event.dataTransfer.effectAllowed = "move";
								try { event.dataTransfer.setData("text/plain", pin.id); } catch { /* private mode */ }
							}
							props.onDragStart();
						},
						onDragEnd: () => { props.onDragEnd(); }
					}, "⠿"),
					react.createElement("span", { className: "cv-num" }, String(props.index + 1)),
					react.createElement("span", { className: "cv-kind cv-kindPinned" }, t("pin.label")),
					head,
					react.createElement("span", { className: "cv-tokens" }, "~" + formatTokens(Math.round(text.length / 4) + 2))
				),
				react.createElement("div", { className: "cv-body" },
					react.createElement("div", { className: "cv-bodyInner" },
						react.createElement("div", { className: "cv-scroll cv-md" },
							react.createElement("div", { className: "cv-trBar" },
								react.createElement("span", { className: "cv-trBusy" }, metaBits.join(" · ")),
								react.createElement("span", { style: { flex: "1" } }),
								merging ? react.createElement("input", {
									className: "cv-nameInput cv-mergeInput",
									defaultValue: "",
									placeholder: t("pin.mergePh"),
									autoFocus: true,
									title: t("pin.mergeToHint"),
									onClick: (event) => { event.stopPropagation(); },
									onKeyDown: (event) => {
										event.stopPropagation();
										if (event.key === "Enter") commitMerge(event);
										else if (event.key === "Escape") setMerging(false);
									},
									onBlur: () => { setMerging(false); }
								}) : props.total > 1 ? react.createElement("button", {
									type: "button",
									className: "cv-trGo",
									title: t("pin.mergeToHint"),
									onClick: () => { setMerging(true); }
								}, t("pin.mergeTo")) : null,
								react.createElement("button", {
									type: "button",
									className: "cv-trGo",
									onClick: () => { setEditing(true); }
								}, t("pin.rename")),
								react.createElement("button", {
									type: "button",
									className: "cv-trGo",
									title: t("pin.remindHint"),
									disabled: remind === "busy",
									onClick: doRemind
								}, remind === "busy" ? t("pin.reminding") : remind === "ok" ? t("pin.remindOk") : remind === "fail" ? t("pin.remindFail") : t("pin.remind")),
								react.createElement("button", {
									type: "button",
									className: "cv-trGo cv-trDanger",
									onClick: props.onDelete
								}, t("pin.remove"))
							),
							react.createElement(MarkdownText, { text, labels: props.labels })
						)
					)
				)
			);
		}
		//#endregion
		//#region block view
		/** One context block: collapsed row + smoothly animated full-information body. */
		/**
		 * A pin toggle that ignores the click ending a text selection:
		 * selecting text inside a block must not collapse/re-pin it.
		 */
		function pinOnToggle(props) {
			return (event) => {
				event.stopPropagation();
				const selection = typeof window !== "undefined" && typeof window.getSelection === "function" ? window.getSelection() : null;
				if (selection !== null && !selection.isCollapsed) return;
				props.onToggle();
			};
		}
		function BlockView(props) {
			const block = props.block;
			const t = props.t;
			const meta = [];
			if (block.seq !== undefined) meta.push(metaItem(t, "seq", block.seq));
			if (block.turn !== undefined) meta.push(metaItem(t, "turn", block.turn));
			if (block.step !== undefined) meta.push(metaItem(t, "step", block.step));
			if (block.tool) meta.push(metaItem(t, "tool", block.tool));
			if (block.producer) meta.push(metaItem(t, "producer", block.producer));
			if (block.form) meta.push(metaItem(t, "form", block.form));
			if (block.shadowed !== undefined) meta.push(metaItem(t, "shadowed", block.shadowed));
			if (block.range) meta.push(metaItem(t, "range", block.range.start + "–" + block.range.end));
			if (block.isError) meta.push(metaItem(t, "error", "tool result"));
			const time = formatTime(block.time);
			if (time !== "") meta.push(metaItem(t, "time", time));
			if (block.chars !== undefined) meta.push(metaItem(t, "chars", block.chars));
			const items = meta.filter(Boolean);
			const busy = props.unloadStatus === "busy";
			const unloadRow = props.canUnload ? react.createElement("div", { className: "cv-trBar" },
				react.createElement("button", {
					type: "button",
					className: "cv-trGo cv-trDanger",
					title: t("unload.hint"),
					disabled: busy,
					onClick: () => props.onUnload(block.seq)
				}, busy ? t("unload.busy") : props.unloadStatus === "error" ? t("unload.fail") : props.unloadStatus === "none" ? t("unload.nothing") : t("unload.label"))
			) : null;
			return react.createElement("div", { className: props.open ? "cv-block cv-blockOpen" : "cv-block" },
				react.createElement("div", { className: "cv-blockHead", onClick: pinOnToggle(props) },
					react.createElement("span", { className: "cv-num" }, String(props.index + 1)),
					react.createElement("span", { className: "cv-kind " + kindClass(block.kind) }, kindLabel(t, block.kind)),
					react.createElement("span", { className: "cv-preview" }, block.preview === "" || block.preview === undefined ? (block.title || "") : block.preview),
					react.createElement("span", { className: "cv-tokens" }, "~" + formatTokens(block.tokens))
				),
				react.createElement("div", { className: "cv-body" },
					react.createElement("div", { className: "cv-bodyInner" },
						react.createElement("div", { className: "cv-scroll" },
							unloadRow,
							items.length > 0 ? react.createElement("div", { className: "cv-meta" }, items) : null,
							block.text === "" && block.truncated ? react.createElement("pre", { className: "cv-text" }, "…") : react.createElement("pre", { className: "cv-text" }, block.text === "" ? "—" : block.text),
							block.truncated ? react.createElement("div", { className: "cv-truncated" }, t("truncated")) : null
						)
					)
				)
			);
		}
		//#endregion
		//#region floating window (shell.overlay)
		/** The draggable, resizable context window. Mounted only while open. */
		function ContextWindow(props) {
			const cv = props.useCv(identity);
			const view = props.useView(identity);
			const t = pickT(cv, props.t);
			const session = view.session;
			const [layout, setLayout] = react.useState(() => readLayout() || defaultLayout());
			const gesture = react.useRef(null);
			const [mode, setMode] = react.useState(() => readMode());
			const switchMode = (next) => {
				setMode(next);
				writeMode(next);
			};
			const [data, setData] = react.useState(null);
			const [error, setError] = react.useState(null);
			const [busy, setBusy] = react.useState(false);
			// Blocks pinned open by a click; the set survives hover-out and the
			// 5 s live refreshes (keys follow the block's seq).
			const [pinned, setPinned] = react.useState(() => new Set());
			const togglePin = (key) => {
				setPinned((prev) => {
					const next = new Set(prev);
					if (next.has(key)) next.delete(key);
					else next.add(key);
					return next;
				});
			};
			// Per-seq unload ("send to compaction") request states, and one-
			// shot success toasts that clear on the next snapshot arrival.
			const [unloads, setUnloads] = react.useState({});
			// Dialog board drag-reorder state: the pin id being dragged and the
			// card currently hovered as a drop target. Order on the board IS
			// the order inside the pins array (filtered per session).
			const [drag, setDrag] = react.useState(null);
			const [over, setOver] = react.useState(null);
			// Open scrolled to the bottom (the latest actions), and keep riding
			// the bottom on live refreshes as long as the user has not scrolled
			// up to read older blocks.
			const listRef = react.useRef(null);
			const firstDataRef = react.useRef(true);
			// A session switch re-arms the scroll-to-bottom on first data.
			react.useEffect(() => {
				firstDataRef.current = true;
			}, [session]);
			react.useEffect(() => {
				if (data === null) return;
				const el = listRef.current;
				if (el === null) return;
				const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
				if (firstDataRef.current || nearBottom) {
					el.scrollTop = el.scrollHeight;
					firstDataRef.current = false;
				}
			}, [data]);
			const load = react.useCallback(() => {
				if (session === undefined || session === null) return;
				setBusy(true);
				fetch("/context-view/snapshot?session=" + encodeURIComponent(String(session)))
					.then((response) => {
						if (response.status === 404) {
							return response.text().then((body) => {
								let code = "";
								try {
									code = String(JSON.parse(body).error || "");
								} catch {
									code = body;
								}
								if (code.indexOf("disabled") >= 0) setError("disabled");
								else if (code.indexOf("session-not-open") >= 0) setError("session");
								else setError("offline");
								setData(null);
							});
						}
						if (!response.ok) return void setError("offline");
						return response.json().then((value) => {
							setData(value);
							setError(null);
						});
					})
					.catch(() => setError("offline"))
					.finally(() => setBusy(false));
			}, [session]);
			/**
			 * Send the live context to manual compaction, anchored on this
			 * block. The host queues the request while the agent is mid-turn,
			 * so this fetch may stay pending for minutes — the card just keeps
			 * showing "compacting" until the final answer arrives.
			 */
			const unloadBlock = react.useCallback((seq) => {
				if (typeof seq !== "number" || session === undefined || session === null) return;
				setUnloads((prev) => ({ ...prev, [seq]: "busy" }));
				fetch("/context-view/unload", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ session: String(session), seq }),
				})
					.then((response) => response.json().then((value) => ({ ok: response.ok, value })))
					.then(({ ok, value }) => {
						if (ok && value !== null && value !== undefined && value.ok === true) {
							setUnloads((prev) => ({ ...prev, [seq]: "ok" }));
							load();
						} else if (ok && value !== null && value !== undefined && value.reason === "nothing-to-compact") {
							setUnloads((prev) => ({ ...prev, [seq]: "none" }));
						} else {
							setUnloads((prev) => ({ ...prev, [seq]: "error" }));
						}
					}, () => setUnloads((prev) => ({ ...prev, [seq]: "error" })));
			}, [session, load]);
			react.useEffect(() => {
				load();
				const timer = setInterval(load, 5000);
				return () => clearInterval(timer);
			}, [load]);
			react.useEffect(() => {
				const onKey = (event) => {
					if (event.key === "Escape") props.actions.closeWindow();
				};
				window.addEventListener("keydown", onKey);
				return () => { window.removeEventListener("keydown", onKey); };
			}, [props.actions]);
			// Keep a persisted layout inside the viewport when the window shrinks.
			react.useEffect(() => {
				const onResize = () => {
					setLayout((prev) => {
						const next = {
							width: clampBetween(prev.width, MIN_WIDTH, window.innerWidth - 16),
							height: clampBetween(prev.height, MIN_HEIGHT, window.innerHeight - 16),
							left: clampBetween(prev.left, Math.min(8, window.innerWidth - 120), window.innerWidth - 120),
							top: clampBetween(prev.top, 0, Math.max(0, window.innerHeight - 40))
						};
						return next.width === prev.width && next.height === prev.height && next.left === prev.left && next.top === prev.top ? prev : next;
					});
				};
				window.addEventListener("resize", onResize);
				return () => { window.removeEventListener("resize", onResize); };
			}, []);
			// Persist the layout with a small debounce: a gesture fires every
			// pointermove, and localStorage writes are synchronous.
			react.useEffect(() => {
				const timer = setTimeout(() => writeLayout(layout), 150);
				return () => clearTimeout(timer);
			}, [layout]);
			const beginGesture = (mode) => (event) => {
				if (event.button !== 0) return;
				if (mode === "move" && typeof event.target.closest === "function" && event.target.closest("button")) return;
				event.preventDefault();
				gesture.current = { mode, startX: event.clientX, startY: event.clientY, start: layout };
				const onMove = (moveEvent) => {
					const active = gesture.current;
					if (!active) return;
					setLayout((prev) => applyGesture(prev, active, moveEvent.clientX, moveEvent.clientY));
				};
				const onUp = () => {
					gesture.current = null;
					window.removeEventListener("pointermove", onMove);
					window.removeEventListener("pointerup", onUp);
				};
				window.addEventListener("pointermove", onMove);
				window.addEventListener("pointerup", onUp);
			};
			const blocks = data !== null && Array.isArray(data.blocks) ? data.blocks : null;
			// The dialog board: only the fragments the user pinned for the
			// current session, in add order. The settings mirror is its source
			// of truth, so the board works even while the host route is offline.
			const sessionKey = session === undefined || session === null ? "" : String(session);
			const pins = (cv.value ? parsePins(cv.value.pins) : []).filter((pin) => String(pin.session) === sessionKey);
			// Reference-stable Markdown chrome: a fresh labels object would
			// discard the memoized render cache of every message per refresh.
			const mdLabels = react.useMemo(() => ({
				code: { copyLabel: t("md.copy"), copiedLabel: t("md.copied") },
				footnotes: t("md.footnotes")
			}), [t]);
			return react.createElement("div", {
				className: "cv-panel",
				role: "dialog",
				"aria-label": t("panel.title"),
				style: {
					left: layout.left + "px",
					top: layout.top + "px",
					width: layout.width + "px",
					height: layout.height + "px"
				}
			},
				react.createElement("header", { className: "cv-header", onPointerDown: beginGesture("move"), title: t("panel.dragHint") },
					react.createElement("h3", { className: "cv-title" }, t("panel.title")),
					react.createElement("div", { className: "cv-chips" },
						data !== null && data.model ? react.createElement("span", { className: "cv-chip", key: "model" }, data.model.provider === "" ? data.model.model : data.model.provider + "/" + data.model.model) : null,
						blocks !== null ? react.createElement("span", { className: "cv-chip", key: "blocks" }, t("stats.blocks") + ": ", react.createElement("strong", null, String(blocks.length))) : null,
						blocks !== null ? react.createElement("span", { className: "cv-chip", key: "used" }, t("stats.used") + " ~", react.createElement("strong", null, formatTokens(data.totalTokens)), data.contextWindow !== null && data.contextWindow !== undefined ? " / " + formatTokens(data.contextWindow) : "") : null,
						blocks !== null ? react.createElement("span", { className: "cv-chip", key: "system" }, t("stats.system") + " ~" + formatTokens(data.systemTokens)) : null,
						blocks !== null ? react.createElement("span", { className: "cv-chip", key: "tools" }, t("stats.tools") + " ~" + formatTokens(data.toolsTokens)) : null,
						blocks !== null ? react.createElement("span", { className: "cv-chip", key: "messages" }, t("stats.messages") + " ~" + formatTokens(data.messageTokens)) : null,
						react.createElement("span", { className: "cv-chip", key: "pins" }, t("stats.pins") + ": ", react.createElement("strong", null, String(pins.length)))
					),
					react.createElement("div", { className: "cv-segmented", role: "group", "aria-label": t("panel.title") },
						react.createElement("button", {
							type: "button",
							className: mode === "dialog" ? "cv-segment cv-segmentActive" : "cv-segment",
							"aria-pressed": mode === "dialog",
							onClick: () => switchMode("dialog")
						}, t("mode.dialog")),
						react.createElement("button", {
							type: "button",
							className: mode === "blocks" ? "cv-segment cv-segmentActive" : "cv-segment",
							"aria-pressed": mode === "blocks",
							onClick: () => switchMode("blocks")
						}, t("mode.blocks"))
					),
					react.createElement("button", {
						type: "button",
						className: "cv-headerAction" + (busy ? " cv-refreshBusy" : ""),
						"aria-label": t("panel.refresh"),
						title: t("panel.refresh"),
						onClick: load
					}, react.createElement(IconRefresh, null)),
					react.createElement("button", {
						type: "button",
						className: "cv-headerAction",
						"aria-label": t("panel.close"),
						title: t("panel.close"),
						onClick: props.actions.closeWindow
					}, react.createElement(IconClose, null))
				),
				react.createElement("div", { className: "cv-list", ref: listRef },
					error !== null ? react.createElement("div", { className: "cv-note" }, t("panel.error." + error)) : null,
					mode === "dialog" ? (
						pins.length === 0
							? react.createElement("div", { className: "cv-note" }, t("pin.empty"))
							: pins.map((pin, index) => {
								const key = "p:" + pin.id;
								return react.createElement(PinBlockView, {
									key,
									pin,
									index,
									total: pins.length,
									labels: mdLabels,
									t,
									open: pinned.has(key),
									onToggle: () => togglePin(key),
									onRename: (title) => props.actions.renamePin(pin.id, title),
									onMergeTo: (target) => props.actions.mergePin(pin.id, target, sessionKey),
									onRemind: () => props.actions.remindPin(pin, t("remind.prefix"), t("remind.tag")),
									onDelete: () => props.actions.removePin(pin.id),
									dragId: drag,
									dragging: drag === pin.id,
									dropTarget: over === pin.id && drag !== null && drag !== pin.id,
									onDragStart: () => { setDrag(pin.id); setOver(pin.id); },
									onDragOver: () => { setOver((cur) => (cur === pin.id ? cur : pin.id)); },
									onDragEnd: () => { setDrag(null); setOver(null); },
									onDrop: () => {
										if (drag !== null && drag !== pin.id) props.actions.movePin(drag, pin.id);
										setDrag(null);
										setOver(null);
									}
								});
							})
					) : null,
					mode === "blocks" ? (
						blocks === null
							? (error === null ? react.createElement("div", { className: "cv-note" }, t("panel.loading")) : null)
							: blocks.length === 0
								? react.createElement("div", { className: "cv-note" }, t("panel.empty"))
								: blocks.map((block, index) => {
									const key = "b:" + (block.seq !== undefined ? "s" + String(block.seq) : block.kind + "-i" + String(index));
									const seq = typeof block.seq === "number" ? block.seq : undefined;
									const canUnload = seq !== undefined && UNLOADABLE_KINDS[block.kind] === true;
									return react.createElement(BlockView, {
										key,
										block,
										index,
										t,
										open: pinned.has(key),
										onToggle: () => togglePin(key),
										canUnload,
										unloadStatus: seq !== undefined ? unloads[seq] : undefined,
										onUnload: unloadBlock
									});
								})
					) : null
				),
				react.createElement("span", { className: "cv-grip cv-gripE", onPointerDown: beginGesture("resize-e") }),
				react.createElement("span", { className: "cv-grip cv-gripS", onPointerDown: beginGesture("resize-s") }),
				react.createElement("span", { className: "cv-grip cv-gripSe", onPointerDown: beginGesture("resize-se"), title: t("panel.resize") })
			);
		}
		/** Overlay gate: hooks stay unconditional, then render nothing while closed. */
		function ContextOverlay(props) {
			const cv = props.useCv(identity);
			const view = props.useView(identity);
			if (!view.open || !isEnabled(cv)) return null;
			return react.createElement(ContextWindow, props);
		}
		//#endregion
		//#region composer button
		/** The composer-row button: toggles the floating window. */
		function ContextVizSeat(props) {
			const cv = props.useCv(identity);
			const t = pickT(cv, props.t);
			const sessionId = props.sessionId;
			const view = props.useView(identity);
			// Keep the shared session fresh so a session switch follows the window.
			react.useEffect(() => {
				if (sessionId !== undefined && sessionId !== null && view.session !== sessionId) {
					props.actions.syncSession(sessionId);
				}
			}, [sessionId, view.session, props.actions]);
			if (!isEnabled(cv)) return null;
			return react.createElement("span", { className: "cv-root" },
				react.createElement("button", {
					type: "button",
					className: view.open ? "cv-button cv-buttonOpen" : "cv-button",
					"aria-label": t("button.tooltip"),
					"aria-haspopup": "dialog",
					"aria-expanded": view.open,
					title: t("button.tooltip"),
					onClick: props.actions.toggleWindow
				}, react.createElement(IconLayers, null))
			);
		}
		//#endregion
		//#region settings card
		function ContextVizSettingsCard(props) {
			const cv = props.useCv(identity);
			if (cv.status !== "ready") return null;
			const t = pickT(cv, props.t);
			const enabled = cv.value ? cv.value.enabled !== false : true;
			const language = cv.value && (cv.value.language === "en" || cv.value.language === "ru") ? cv.value.language : "auto";
			return react.createElement("div", { className: "cv-settings" },
				react.createElement("div", { className: "cv-settingsText" },
					react.createElement("h3", { className: "cv-settingsTitle" }, t("settings.title")),
					react.createElement("p", { className: "cv-settingsDesc" }, t("settings.description"))
				),
				react.createElement("div", { className: "cv-settingsControls" },
					react.createElement("div", { className: "cv-fieldRow" },
						react.createElement("span", { className: "cv-fieldLabel" }, t("settings.language")),
						react.createElement("div", { className: "cv-segmented", role: "group", "aria-label": t("settings.language") },
							["auto", "en", "ru"].map((code) => react.createElement("button", {
								key: code,
								type: "button",
								className: code === language ? "cv-segment cv-segmentActive" : "cv-segment",
								disabled: cv.writable !== true,
								"aria-pressed": code === language,
								onClick: () => props.actions.setLanguage(code)
							}, code === "auto" ? t("settings.languageAuto") : code.toUpperCase()))
						)
					),
					react.createElement(Switch, {
						checked: enabled,
						label: t("settings.switch"),
						disabled: cv.writable !== true,
						onChange: (next) => props.actions.setEnabled(next)
					})
				)
			);
		}
		//#endregion
		//#region entry
		const NS = "context-view";
		const inject = ["slots", "locale", "settingsScope"];
		/** Defensive snapshot of the settings scope (status/value/writable). */
		function settingsState(scope) {
			try {
				return scope.getSnapshot() || {};
			} catch {
				return {};
			}
		}
		/**
		 * Watch page text selection and mirror it into the shared selection
		 * store (the header button renders from it). preventDefault on the
		 * button's mousedown keeps the selection alive through the click, so
		 * no press-flag dance is needed here.
		 * @returns {() => void} disposer removing every listener.
		 */
		function setupSelectionWatcher(selStore, enabledFn) {
			if (typeof document === "undefined" || typeof window === "undefined") {
				return () => {};
			}
			const clear = () => {
				if (selStore.getSnapshot().text !== "") selStore.set({ text: "" });
			};
			const read = () => {
				const selection = window.getSelection();
				if (selection === null || selection.isCollapsed) return clear();
				const text = String(selection.toString()).trim();
				if (text.length < 2 || !enabledFn()) return clear();
				if (selStore.getSnapshot().text !== text) selStore.set({ text });
			};
			const onMouseUp = () => setTimeout(read, 0);
			const onKeyup = (event) => {
				if (event.shiftKey || event.key === "Shift") read();
			};
			const onSelectionChange = () => {
				const selection = window.getSelection();
				if (selection === null || selection.isCollapsed) clear();
			};
			const onScroll = () => clear();
			const onKeyDown = (event) => {
				if (event.key === "Escape") clear();
			};
			document.addEventListener("mouseup", onMouseUp);
			document.addEventListener("keyup", onKeyup);
			document.addEventListener("selectionchange", onSelectionChange);
			document.addEventListener("keydown", onKeyDown);
			window.addEventListener("scroll", onScroll, true);
			return () => {
				document.removeEventListener("mouseup", onMouseUp);
				document.removeEventListener("keyup", onKeyup);
				document.removeEventListener("selectionchange", onSelectionChange);
				document.removeEventListener("keydown", onKeyDown);
				window.removeEventListener("scroll", onScroll, true);
			};
		}
		/**
		 * The "To context" button seated in the chat-header corner (the
		 * utilities list): visible only while a valid text selection exists.
		 * Clicking adds exactly the selection to the session without making
		 * the model answer: the prompt is followed by a cancel of the turn it
		 * woke, with a few retries while the wake is still climbing.
		 */
		function SelectionAddAction(props) {
			const cv = props.useCv(identity);
			const sel = props.useSel(identity);
			const t = pickT(cv, props.t);
			const [flash, setFlash] = react.useState("");
			const timerRef = react.useRef(null);
			react.useEffect(() => () => {
				if (timerRef.current !== null) clearTimeout(timerRef.current);
			}, []);
			if (!isEnabled(cv)) return null;
			if (sel.text === "" && flash === "") return null;
			const onClick = () => {
				if (flash !== "") return;
				const text = sel.text;
				if (text === "") return;
				void props.actions.addSelected(props.sessionId, text).then((ok) => {
					setFlash(ok ? "ok" : "fail");
					if (timerRef.current !== null) clearTimeout(timerRef.current);
					timerRef.current = setTimeout(() => {
						timerRef.current = null;
						setFlash("");
					}, 900);
				});
			};
			const label = flash === "ok" ? t("addctx.ok") : flash === "fail" ? t("addctx.fail") : t("addctx.label");
			return react.createElement("button", {
				type: "button",
				className: flash === "ok" ? "cv-selbtn cv-selbtnOk" : flash === "fail" ? "cv-selbtn cv-selbtnFail" : "cv-selbtn",
				title: t("addctx.hint"),
				onMouseDown: (event) => {
					// Keep the browser selection alive through the click.
					event.preventDefault();
				},
				onClick
			}, label);
		}
		/**
		 * Client plugin body: dictionaries, the settings scope, the shared view
		 * store, the composer button, the overlay window, and the settings card.
		 * @param {object} ctx - client plugin context.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { en, ru }), "dsh-context: dictionaries");
			const scope = ctx.settingsScope.bind({ namespace: NS });
			const view = createMiniStore({ open: false, session: null });
			const sel = createMiniStore({ text: "" });
			ctx.effect(
				() => setupSelectionWatcher(sel, () => isEnabled(settingsState(scope))),
				"dsh-context: selection watcher",
			);
			/**
			 * Pins source of truth. Writes go to the settings service and come
			 * back through its mirror; between the two, the mirror still shows
			 * the PRE-write board. A last-written override keeps back-to-back
			 * board edits (rename then merge, two fast pins) from reading a
			 * stale array and overwriting each other; it retires as soon as
			 * the mirror catches up (or after a safety window).
			 */
			let pinsOverride = null;
			let pinsOverrideAt = 0;
			const pinsRaw = () => {
				const state = settingsState(scope);
				const mirrored = state.value && typeof state.value.pins === "string" ? state.value.pins : "";
				if (pinsOverride !== null) {
					if (mirrored === pinsOverride || Date.now() - pinsOverrideAt > 4000) pinsOverride = null;
					else return pinsOverride;
				}
				return mirrored;
			};
			const writePins = (arr) => {
				pinsOverride = JSON.stringify(arr);
				pinsOverrideAt = Date.now();
				void scope.set("pins", pinsOverride);
			};
			/**
			 * Pin the selected text onto the dialog board: the fragment is
			 * stored verbatim in this plugin's settings namespace (mirrored
			 * live, persisted across restarts, invisible to the model). No
			 * prompt, no cancel, no model call — nothing in the session
			 * wakes up from this click.
			 */
			const addSelected = (sessionId, text) => {
				if (typeof sessionId !== "string" || sessionId === "" || typeof text !== "string" || text.trim() === "") {
					return Promise.resolve(false);
				}
				const fragment = text.trim();
				if (fragment.length > PIN_MAX_TEXT) return Promise.resolve(false);
				const pins = parsePins(pinsRaw());
				let chars = fragment.length;
				for (const pin of pins) chars += String(pin.text).length;
				if (pins.length >= PIN_MAX_COUNT || chars > PINS_TOTAL_CHARS) return Promise.resolve(false);
				pins.push({
					id: "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
					session: sessionId,
					text: fragment,
					time: Date.now(),
				});
				writePins(pins);
				try {
					const selection = window.getSelection();
					if (selection !== null) selection.removeAllRanges();
				} catch {
					// Selection APIs are best-effort.
				}
				sel.set({ text: "" });
				return Promise.resolve(true);
			};
			/** Drop one fragment from the board, by pin id. */
			const removePin = (pinId) => {
				if (typeof pinId !== "string" || pinId === "") return;
				const pins = parsePins(pinsRaw()).filter((pin) => pin.id !== pinId);
				writePins(pins);
			};
			/** Set (or clear with "") the display name of a pinned fragment. */
			const renamePin = (pinId, title) => {
				if (typeof pinId !== "string" || pinId === "") return;
				const clean = typeof title === "string" ? title.replace(/\s+/g, " ").trim().slice(0, 120) : "";
				const pins = parsePins(pinsRaw());
				const index = pins.findIndex((pin) => pin.id === pinId);
				if (index < 0) return;
				const next = pins.slice();
				const updated = { ...next[index] };
				if (clean === "") delete updated.title;
				else updated.title = clean;
				next[index] = updated;
				writePins(next);
			};
			/**
			 * Merge one board card INTO the card with a given display number
			 * (1-based, the numbers printed on this session's cards). Text is
			 * joined chronologically under a `***` rule, the result keeps the
			 * TARGET's slot, and the source card leaves the board.
			 */
			const mergePin = (pinId, targetNumber) => {
				if (typeof pinId !== "string" || pinId === "") return;
				if (!Number.isInteger(targetNumber)) return;
				const pins = parsePins(pinsRaw());
				const index = pins.findIndex((pin) => pin.id === pinId);
				if (index < 0) return;
				const cur = pins[index];
				// Board order = global array order filtered to this session.
				const board = [];
				for (let j = 0; j < pins.length; j += 1) {
					if (String(pins[j].session) === String(cur.session)) board.push(j);
				}
				if (targetNumber < 1 || targetNumber > board.length) return;
				const targetGlobal = board[targetNumber - 1];
				if (targetGlobal === index) return;
				const target = pins[targetGlobal];
				const first = index < targetGlobal ? cur : target;
				const second = index < targetGlobal ? target : cur;
				const merged = String(first.text) + "\n\n***\n\n" + String(second.text);
				// Past the host's per-pin ceiling the merge would silently drop
				// the card on the next settings load — refuse instead.
				if (merged.length > PIN_MAX_TEXT) return;
				const joined = {
					...target,
					title: typeof target.title === "string" && target.title !== "" ? target.title : typeof cur.title === "string" ? cur.title : "",
					text: merged,
				};
				if (joined.title === "") delete joined.title;
				const next = pins.slice();
				next[targetGlobal] = joined;
				next.splice(index, 1);
				writePins(next);
			};
			/**
			 * Remind: send one pinned fragment back into the LIVE context under
			 * a reminder banner as a plugin-sourced notice — model-visible on
			 * the next request, no turn opens, the model does not start reading
			 * anything now. The card stays on the board; the boolean drives
			 * the button's ok/fail flash.
			 */
			const remindPin = (pin, prefix, tag) => {
				if (pin === undefined || pin === null || typeof pin.id !== "string" || pin.id === "") return Promise.resolve(false);
				const body = String(prefix) + "\n\n" + String(pin.text === undefined ? "" : pin.text);
				if (body.length > PIN_MAX_TEXT) return Promise.resolve(false);
				const flat = String(pin.text === undefined ? "" : pin.text).replace(/\s+/g, " ").trim();
				const summary = (String(tag) + ": " + flat).slice(0, 200);
				return fetch("/context-view/remind", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ session: String(pin.session === undefined ? "" : pin.session), text: body, summary }),
				})
					.then((response) => response.json().then((value) => response.ok === true && value !== null && value !== undefined && value.ok === true))
					.then((ok) => ok === true, () => false);
			};
			/** Reorder: move the dragged card to just before the target card. */
			const movePin = (dragId, targetId) => {
				if (typeof dragId !== "string" || typeof targetId !== "string" || dragId === targetId) return;
				const pins = parsePins(pinsRaw());
				const from = pins.findIndex((pin) => pin.id === dragId);
				const to = pins.findIndex((pin) => pin.id === targetId);
				if (from < 0 || to < 0) return;
				if (String(pins[from].session) !== String(pins[to].session)) return;
				const next = pins.slice();
				const moved = next.splice(from, 1)[0];
				next.splice(from < to ? to - 1 : to, 0, moved);
				writePins(next);
			};
			const actions = {
				toggleWindow: () => {
					const current = view.getSnapshot();
					view.set({ ...current, open: !current.open });
				},
				closeWindow: () => {
					const current = view.getSnapshot();
					if (current.open) view.set({ ...current, open: false });
				},
				syncSession: (id) => {
					const current = view.getSnapshot();
					if (current.session !== id) view.set({ ...current, session: id });
				},
				addSelected,
				removePin,
				renamePin,
				mergePin,
				remindPin,
				movePin,
				setEnabled: (next) => {
					void scope.set("enabled", next);
				},
				setLanguage: (next) => {
					void scope.set("language", next);
				}
			};
			const face = () => ({ hooks: { cv: scope, view, sel }, actions });
			ctx.slots.inject("conversation.input.right", () => ctx.slots.register({
				name: "conversation.input.right",
				id: "context-view-button",
				order: 30,
				locale: NS,
				inject: face
			}, ContextVizSeat));
			ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
				name: "conversation.session.header.utilities",
				id: "context-view-add-selection",
				order: 60,
				locale: NS,
				inject: face
			}, SelectionAddAction));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "context-view-window",
				order: 45,
				locale: NS,
				inject: face
			}, ContextOverlay));
			// Priority 100: the keyed slot sorts ascending, so this card renders
			// below the shipped cards and below every other plugin (priority 0).
			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				key: NS,
				locale: NS,
				priority: 100,
				inject: face
			}, ContextVizSettingsCard));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
