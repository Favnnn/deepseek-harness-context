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
			".cv-blockHead{display:flex;align-items:center;gap:7px;min-width:0}",
			".cv-num{flex:none;min-width:20px;padding:0 5px;border-radius:6px;background:var(--dsw-alias-fill-l2);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px;text-align:center;font-variant-numeric:tabular-nums}",
			".cv-kind{flex:none;display:inline-block;min-width:64px;padding:0 6px;border-radius:6px;font-size:10px;font-weight:600;line-height:18px;text-align:center;white-space:nowrap;color:#fff}",
			".cv-kindUser{background:#3b82f6}",
			".cv-kindAssistant{background:#8b5cf6}",
			".cv-kindContext{background:#0ea5a4}",
			".cv-kindCompaction{background:#d97706}",
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
			".cv-bodyInner{min-height:0;overflow:hidden}",
			".cv-scroll{max-height:260px;overflow-y:auto;overflow-x:hidden;margin-top:6px}",
			".cv-meta{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:4px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}",
			".cv-metaItem strong{font-weight:600;color:var(--dsw-alias-label-secondary)}",
			".cv-text{margin:0;white-space:pre-wrap;word-break:break-word;font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:11px;line-height:15px;color:var(--dsw-alias-label-secondary)}",
			".cv-truncated{margin-top:4px;font-size:11px;color:var(--dsw-alias-label-tertiary)}",
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
			"settings.title": "Context panel",
			"settings.description": "A button beside the context % ring opens a floating window that lists, in numbered blocks, everything currently in the model context. Hover a block to expand it; drag the header, resize by the edges.",
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
			"settings.title": "Панель контекста",
			"settings.description": "Кнопка рядом с кольцом контекста % открывает плавающее окно, где по нумерованным блокам показано всё, что сейчас в контексте модели. Блок раскрывается при наведении; окно перемещается за заголовок и растягивается за края.",
			"settings.switch": "Показывать кнопку панели контекста",
			"settings.language": "Язык",
			"settings.languageAuto": "Авто"
		};
		//#endregion
		//#region helpers
		const { Switch } = primitives;
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
		/** The seat locale chain, with the built-in English map as its terminus. */
		function resolveT(seatT) {
			if (typeof seatT === "function") return seatT;
			return dictT(en);
		}
		/**
		 * Language resolution: an explicit `en`/`ru` setting pins that
		 * dictionary; `auto` (the default) follows the GUI locale chain.
		 */
		function pickT(cv, seatT) {
			if (cv.status === "ready" && cv.value) {
				if (cv.value.language === "ru") return dictT(ru);
				if (cv.value.language === "en") return dictT(en);
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
		//#region block view
		/** One context block: collapsed row + smoothly animated full-information body. */
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
			return react.createElement("div", { className: "cv-block" },
				react.createElement("div", { className: "cv-blockHead" },
					react.createElement("span", { className: "cv-num" }, String(props.index + 1)),
					react.createElement("span", { className: "cv-kind " + kindClass(block.kind) }, kindLabel(t, block.kind)),
					react.createElement("span", { className: "cv-preview" }, block.preview === "" || block.preview === undefined ? (block.title || "") : block.preview),
					react.createElement("span", { className: "cv-tokens" }, "~" + formatTokens(block.tokens))
				),
				react.createElement("div", { className: "cv-body" },
					react.createElement("div", { className: "cv-bodyInner" },
						react.createElement("div", { className: "cv-scroll" },
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
			const [data, setData] = react.useState(null);
			const [error, setError] = react.useState(null);
			const [busy, setBusy] = react.useState(false);
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
						blocks !== null ? react.createElement("span", { className: "cv-chip", key: "messages" }, t("stats.messages") + " ~" + formatTokens(data.messageTokens)) : null
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
					error === null && blocks === null ? react.createElement("div", { className: "cv-note" }, t("panel.loading")) : null,
					blocks !== null && blocks.length === 0 ? react.createElement("div", { className: "cv-note" }, t("panel.empty")) : null,
					blocks !== null ? blocks.map((block, index) => react.createElement(BlockView, { key: String(block.seq !== undefined ? block.seq : block.kind) + "-" + String(index), block, index, t })) : null
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
		/**
		 * Client plugin body: dictionaries, the settings scope, the shared view
		 * store, the composer button, the overlay window, and the settings card.
		 * @param {object} ctx - client plugin context.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { en, ru }), "dsh-context: dictionaries");
			const scope = ctx.settingsScope.bind({ namespace: NS });
			const view = createMiniStore({ open: false, session: null });
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
				setEnabled: (next) => {
					void scope.set("enabled", next);
				},
				setLanguage: (next) => {
					void scope.set("language", next);
				}
			};
			const face = () => ({ hooks: { cv: scope, view }, actions });
			ctx.slots.inject("conversation.input.right", () => ctx.slots.register({
				name: "conversation.input.right",
				id: "context-view-button",
				order: 30,
				locale: NS,
				inject: face
			}, ContextVizSeat));
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
