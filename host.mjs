/**
 * dsh-context, Host half.
 *
 * A function plugin with NO imports (the installed copy lives outside any
 * pnpm tree, so bare imports cannot resolve here; Node builtins are not
 * needed either).
 *
 * Two responsibilities:
 * 1) The `context-view` settings section — a hand-rolled, schemastery-compatible
 *    node whose `toJSON()` yields the `{ uid, refs }` envelope the settings
 *    provider serializes to the wire. Its `enabled` flag drives the
 *    Settings → Plugins switch and gates the HTTP routes below; its `pins`
 *    string is the verbatim pin board (JSON array, mirrored live to clients).
 * 2) `/context-view/*` HTTP routes for the context panel:
 *    - GET /context-view/snapshot?session=<id> — the exact model-visible
 *      surface of one open Session, projected into numbered blocks: the
 *      request header (system prompt, tools) plus every surface event in
 *      head-to-tail order, with per-block token prices taken from the
 *      token-meter service when it is mounted (heuristic fallback otherwise).
 *    - POST /context-view/unload {session, seq?} — queued MANUAL compaction
 *      (the engine's compactNow, the same transaction the /compact command
 *      runs): resolves the session's live agent, reaches the `compaction`
 *      service in the agent's scoped realm, folds the oldest surface prefix
 *      into one in-place summary checkpoint, and waits out any busy turn.
 *    - POST /context-view/remind {session, text, summary?} — append one
 *      plugin-sourced notice (`user/message`, surface append) to the live
 *      session: a pinned fragment becomes model-visible context without
 *      opening a turn or waking the agent.
 *    - GET /context-view/health — canary for troubleshooting.
 */

export const name = 'context-view'

// ─── settings ────────────────────────────────────────────────────────────────

/** Allowed panel languages; `auto` follows the GUI locale. */
const LANGUAGES = ['auto', 'en', 'ru']
/** Pins are one JSON-string settings value; these are the storage ceilings. */
const PIN_MAX_COUNT = 500
const PIN_MAX_TEXT = 32000
const PINS_MAX_CHARS = 600000

/** Normalize the raw pins JSON string: valid array, shape-checked, capped. */
function normalizePinsRaw(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return '[]'
  if (raw.length > PINS_MAX_CHARS + 20000) return '[]'
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return '[]'
  }
  if (!Array.isArray(parsed)) return '[]'
  const clean = []
  for (const pin of parsed) {
    if (pin === null || typeof pin !== 'object' || Array.isArray(pin)) continue
    if (typeof pin.id !== 'string' || pin.id === '' || pin.id.length > 64) continue
    if (typeof pin.text !== 'string' || pin.text === '' || pin.text.length > PIN_MAX_TEXT) continue
    if (clean.length >= PIN_MAX_COUNT) break
    const title = typeof pin.title === 'string' ? pin.title.replace(/\s+/g, ' ').trim().slice(0, 120) : ''
    clean.push({
      id: pin.id,
      session: typeof pin.session === 'string' ? pin.session : '',
      text: pin.text,
      time: typeof pin.time === 'number' && Number.isFinite(pin.time) ? pin.time : 0,
      ...(title === '' ? {} : { title }),
    })
  }
  return JSON.stringify(clean)
}

/** Validate and normalize one merged settings candidate. Never throws. */
function resolveContextViewSection(candidate) {
  if (candidate === undefined || candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { enabled: true, language: 'auto', pins: '[]' }
  }
  const enabled = typeof candidate.enabled === 'boolean' ? candidate.enabled : true
  const language = typeof candidate.language === 'string' && LANGUAGES.includes(candidate.language) ? candidate.language : 'auto'
  const pins = normalizePinsRaw(candidate.pins)
  return { ...candidate, enabled, language, pins }
}

/** Build the schemastery-compatible node for `{ enabled, language, pins }`. */
function createContextViewSchema() {
  const refs = {
    0: { type: 'object', meta: {}, dict: { enabled: 1, language: 2, pins: 3 } },
    1: { type: 'boolean', meta: { default: true } },
    2: { type: 'string', meta: { default: 'auto' } },
    3: { type: 'string', meta: { default: '[]' } },
  }
  const schema = (candidate) => resolveContextViewSection(candidate)
  schema.type = 'object'
  schema.meta = refs[0].meta
  schema.dict = { enabled: refs[1], language: refs[2], pins: refs[3] }
  schema.toJSON = () => ({ uid: 0, refs })
  return schema
}

/** Resolved section state for diagnostics and route gating. */
const viewState = { enabled: true, language: 'auto', pins: '[]' }

// ─── context snapshot construction ───────────────────────────────────────────

/** Full-text cap for one block; longer payloads are cut with a marker. */
const MAX_BLOCK_TEXT = 16000
/** Whole-response text budget: once exhausted, later blocks ship preview only. */
const MAX_TOTAL_TEXT = 500000
/** One-line collapsed preview length. */
const PREVIEW_CHARS = 220

/** Fixed service-scale heuristic (~4 chars per token), used without a meter. */
function estTokens(text) {
  if (typeof text !== 'string' || text.length === 0) return 0
  return Math.max(1, Math.round(text.length / 4)) + 2
}

function previewOf(text) {
  const flat = String(text).replace(/\s+/g, ' ').trim()
  return flat.length <= PREVIEW_CHARS ? flat : flat.slice(0, PREVIEW_CHARS - 1) + '…'
}

/**
 * Flatten model-facing content blocks to display text. Placeholders name the
 * block kind so a block never looks empty for structural reasons.
 */
function contentToText(content, depth) {
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const block of content) {
    if (block === null || typeof block !== 'object') continue
    switch (block.type) {
      case 'text':
        if (typeof block.text === 'string') parts.push(block.text)
        break
      case 'reasoning':
        if (typeof block.text === 'string') parts.push('[reasoning]\n' + block.text)
        break
      case 'tool-call':
        parts.push('[tool-call ' + String(block.name || '?') + ']\n' + String(block.arguments || ''))
        break
      case 'tool-result': {
        const inner = contentToText(block.content, (depth || 0) + 1)
        parts.push('[tool-result]' + (inner === '' ? '' : '\n' + inner))
        break
      }
      case 'image': {
        const att = block.attachment || {}
        parts.push('[image ' + String(att.name || att.id || '') + ']')
        break
      }
      case 'file': {
        const att = block.attachment || {}
        parts.push('[file ' + String(att.name || att.path || att.id || '') + ']')
        break
      }
      default:
        parts.push('[' + String(block.type || 'block') + ']')
    }
  }
  return parts.join('\n')
}

/**
 * Project one open Session into the panel payload. Reads only primitives off
 * the live Session; returns plain JSON-safe data.
 */
function buildSnapshot(ctx, session, sessionId) {
  const events = session.snapshotEvents()
  let header = null
  let routeContext = null
  const toolNames = new Map()
  for (const event of events) {
    if (event.type === 'request/header') header = event.data.header || null
    else if (event.type === 'request/context') routeContext = event.data
    else if (event.type === 'tool/call') {
      if (event.data && event.data.callId !== undefined) toolNames.set(String(event.data.callId), String(event.data.name || '?'))
    } else if (event.type === 'assistant/message') {
      const content = event.data && event.data.message && event.data.message.content
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block && block.type === 'tool-call' && block.id !== undefined) toolNames.set(String(block.id), String(block.name || '?'))
        }
      }
    }
  }

  // Per-seq exact prices from the token-meter fold when the service is mounted.
  const priceBySeq = new Map()
  let meterSurfaceTokens = null
  let meterTotalTokens = null
  const meter = ctx.get('tokenMeter')
  if (meter !== undefined) {
    try {
      const measurement = meter.measure(session)
      for (const node of measurement.nodes) priceBySeq.set(Number(node.seq), node.tokens)
      meterSurfaceTokens = measurement.surfaceTokens
      meterTotalTokens = measurement.totalTokens
    } catch {
      // A malformed or racing log only costs exact prices, never the panel.
    }
  }

  const blocks = []
  let textBudget = MAX_TOTAL_TEXT

  const shipBlock = (block) => {
    let text = block.text === undefined ? '' : block.text
    block.chars = text.length
    if (text.length > MAX_BLOCK_TEXT) {
      text = text.slice(0, MAX_BLOCK_TEXT)
      block.truncated = true
    } else {
      block.truncated = false
    }
    if (textBudget <= 0 && text.length > 0) {
      text = ''
      block.truncated = true
    } else {
      textBudget -= text.length
    }
    block.text = text
    block.preview = previewOf(text)
    blocks.push(block)
  }

  // Envelope blocks first (the request header the next call would reuse).
  let systemTokens = 0
  if (header && typeof header.system === 'string' && header.system.length > 0) {
    systemTokens = estTokens(header.system)
    shipBlock({ kind: 'system-prompt', role: 'system', title: 'System prompt', tokens: systemTokens, text: header.system })
  }
  let toolsTokens = 0
  if (header && Array.isArray(header.tools) && header.tools.length > 0) {
    const lines = []
    for (const tool of header.tools) {
      if (tool === null || typeof tool !== 'object') continue
      const name = String(tool.name || '?')
      const desc = typeof tool.description === 'string' ? tool.description : ''
      lines.push('- ' + name + (desc === '' ? '' : ': ' + desc))
    }
    const toolsText = lines.join('\n')
    toolsTokens = estTokens(toolsText)
    shipBlock({
      kind: 'tools',
      role: 'system',
      title: 'Tools (' + String(header.tools.length) + ')',
      tokens: toolsTokens,
      toolCount: header.tools.length,
      text: toolsText,
    })
  }

  // The exact model-visible surface, in head-to-tail order.
  const surfaceSeqs = Array.isArray(session.surface && session.surface.nodes) ? session.surface.nodes : []
  let messageTokens = 0
  for (const seqValue of surfaceSeqs) {
    const seq = Number(seqValue)
    const event = session.eventAt(seqValue)
    if (event === undefined || event === null) continue
    const block = { seq, time: event.time, kind: 'unknown', role: 'user', text: '' }
    if (priceBySeq.has(seq)) block.tokens = priceBySeq.get(seq)
    switch (event.type) {
      case 'user/message': {
        const data = event.data || {}
        const source = data.source || {}
        const replaced = event.surfaceOp !== undefined && event.surfaceOp !== 'append'
        if (replaced) {
          block.kind = 'compaction'
          block.title = 'Compaction checkpoint'
          const op = event.surfaceOp
          if (op && typeof op === 'object') {
            block.range = { start: Number(op.start), end: Number(op.end) }
          }
          if (Array.isArray(event.sourceEventSeqs)) block.shadowed = event.sourceEventSeqs.length
        } else if (source.kind === 'plugin') {
          block.kind = 'context'
          block.producer = String(source.plugin || 'plugin')
          if (typeof source.form === 'string') block.form = source.form
          if (typeof source.summary === 'string') block.summary = source.summary
          block.title = 'Injected context'
        } else {
          block.kind = 'user'
          block.title = 'User message'
        }
        block.text = contentToText(data.content)
        break
      }
      case 'assistant/message': {
        block.kind = 'assistant'
        block.role = 'assistant'
        block.title = 'Assistant message'
        const data = event.data || {}
        if (typeof data.turn === 'number') block.turn = data.turn
        if (typeof data.step === 'number') block.step = data.step
        if (data.interrupted === true) block.interrupted = true
        const content = data.message && data.message.content
        block.text = contentToText(content)
        if (Array.isArray(content)) {
          const calls = []
          for (const part of content) {
            if (part && part.type === 'tool-call') calls.push(String(part.name || '?'))
          }
          if (calls.length > 0) block.calls = calls
        }
        break
      }
      case 'tool/result': {
        block.kind = 'tool-result'
        block.title = 'Tool result'
        const data = event.data || {}
        if (typeof data.turn === 'number') block.turn = data.turn
        if (typeof data.step === 'number') block.step = data.step
        const message = data.message || {}
        const source = message.source || {}
        const callId = source.callId !== undefined ? String(source.callId) : null
        if (callId !== null) {
          block.callId = callId
          if (toolNames.has(callId)) block.tool = toolNames.get(callId)
        }
        if (data.error !== undefined && data.error !== null) block.isError = true
        const first = Array.isArray(message.content) ? message.content[0] : null
        if (first !== null && first !== undefined && first.isError === true) block.isError = true
        block.text = contentToText(message.content)
        break
      }
      default:
        block.title = String(event.type)
        block.text = contentToText(event.data && event.data.content)
        break
    }
    if (block.tokens === undefined) block.tokens = block.text.length > 0 ? estTokens(block.text) : 0
    messageTokens += block.tokens
    if (block.title === undefined) block.title = block.kind
    shipBlock(block)
  }

  const surfaceTokens = meterSurfaceTokens !== null ? meterSurfaceTokens : messageTokens
  const totalTokens = meterTotalTokens !== null ? meterTotalTokens : surfaceTokens + systemTokens + toolsTokens
  return {
    sessionId: String(sessionId),
    generatedAt: Date.now(),
    model: header && header.config
      ? { provider: String(header.config.provider || ''), model: String(header.config.model || '') }
      : null,
    contextWindow: routeContext && typeof routeContext.contextWindow === 'number' ? routeContext.contextWindow : null,
    systemTokens,
    toolsTokens,
    messageTokens,
    surfaceTokens,
    totalTokens,
    blocks,
  }
}

// ─── unload (manual compaction, queued) ──────────────────────────────────────
// Engine reality: the public `compactRegion` only runs inside an OPEN turn
// (automatic in-loop compaction), so an outside request can never use it
// safely. The manual path for a quiet session is `compactNow` — exactly what
// the shipped `/compact` command runs: it wraps itself in a maintenance turn
// and folds the oldest useful prefix of the live surface into ONE checkpoint,
// placed IN PLACE at the head of the folded range (not appended at the end).
// The compaction service itself is mounted in each AGENT's scoped realm (the
// host plane disables compaction-basic), so the route reaches it through
// `agents.get(id).ctx`. While the agent is mid-turn, `compactNow` fails with
// ManualCompactionError('busy') — so the request QUEUES here: the response is
// held open and retried until the chat goes quiet or patience runs out.
const UNLOAD_WAIT_MS = 10 * 60 * 1000
const UNLOAD_RETRY_MS = 2000

/** Read and JSON-parse a small request body without any Buffer globals. */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const parts = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 262144) {
        reject(new Error('body too large'))
        try {
          req.destroy()
        } catch {
          // Already gone.
        }
        return
      }
      parts.push(typeof chunk === 'string' ? chunk : String(chunk))
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(parts.join('')))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function isBusyError(error) {
  if (error === null || typeof error !== 'object') return false
  if (error.code === 'busy') return true
  return typeof error.message === 'string' && /already has active work|requires an idle agent/i.test(error.message)
}

async function handleUnload(ctx, req, res) {
  if (req.method !== 'POST') return void respond(res, 405, 'text/plain', 'POST only')
  if (viewState.enabled !== true) return void respondJson(res, 404, { error: 'context-view is disabled' })
  let body
  try {
    body = await readJsonBody(req)
  } catch (error) {
    return void respondJson(res, 400, { error: 'bad-request', message: error && error.message ? error.message : String(error) })
  }
  const sessionId = typeof body.session === 'string' ? body.session : ''
  const targetSeq = Number.isInteger(Number(body.seq)) ? Number(body.seq) : null
  if (sessionId === '') return void respondJson(res, 400, { error: 'bad-request' })
  const sessions = ctx.get('sessions')
  if (sessions === undefined) return void respondJson(res, 503, { error: 'sessions-unavailable' })
  const agents = ctx.get('agents')
  const controller = new AbortController()
  const deadline = Date.now() + UNLOAD_WAIT_MS
  let queued = false
  for (;;) {
    let session
    try {
      session = sessions.get(sessionId)
    } catch {
      session = undefined
    }
    if (session === undefined) {
      return void respondJson(res, queued ? 502 : 404, { error: 'session-not-open', sessionId })
    }
    let agent
    try {
      agent = agents !== undefined ? agents.get(sessionId) : undefined
    } catch {
      agent = undefined
    }
    if (agent === undefined) return void respondJson(res, 503, { error: 'agent-not-attached', sessionId })
    let compaction
    if (agent.ctx !== undefined && typeof agent.ctx.get === 'function') {
      try {
        compaction = agent.ctx.get('compaction')
      } catch {
        compaction = undefined
      }
    }
    if (compaction === undefined) compaction = ctx.get('compaction')
    if (compaction === undefined || typeof compaction.compactNow !== 'function') {
      return void respondJson(res, 503, { error: 'compaction-unavailable' })
    }
    let result
    try {
      result = await compaction.compactNow(agent, controller.signal)
    } catch (error) {
      if (!isBusyError(error)) {
        return void respondJson(res, 502, { error: 'unload-failed', message: error && error.message ? error.message : String(error) })
      }
      queued = true
      if (Date.now() > deadline) {
        return void respondJson(res, 504, { error: 'agent-stayed-busy', message: 'the chat never became free in time; nothing was compacted' })
      }
      if (res.writableEnded) return // the panel went away mid-queue; stop responding
      await sleep(UNLOAD_RETRY_MS)
      continue
    }
    if (result === null) return void respondJson(res, 200, { ok: false, reason: 'nothing-to-compact', queued })
    const surface = session.surface && Array.isArray(session.surface.nodes) ? session.surface.nodes.map(Number) : []
    respondJson(res, 200, {
      ok: true,
      queued,
      shadowed: Array.isArray(result.shadowedSeqs) ? result.shadowedSeqs.length : null,
      shadowedTokens: typeof result.shadowedTokenCount === 'number' ? result.shadowedTokenCount : null,
      summarySeq: typeof result.summarySeq === 'number' ? result.summarySeq : null,
      ...(targetSeq === null ? {} : { targetCompacted: surface.indexOf(targetSeq) < 0 }),
    })
    return
  }
}


// ─── remind (inject a pin back into the live context as a notice) ────────────
// "Remind" takes the pinned fragment verbatim, banners it with a reminder
// header, and appends it to the live session surface as a plugin-sourced
// `user/message` notice — exactly how the harness itself injects runtime
// context (plan-mode, repeat-tool-guard, agent-instructions). The node is
// model-visible for the NEXT request and renders in the chat, but the route
// issues no wake: no turn opens, the model does not start analyzing anything,
// no tokens are spent until the session next runs. The board card stays.

const REMIND_MAX_TEXT = 32000

async function handleRemind(ctx, req, res) {
  if (req.method !== 'POST') return void respond(res, 405, 'text/plain', 'POST only')
  if (viewState.enabled !== true) return void respondJson(res, 404, { error: 'context-view is disabled' })
  let body
  try {
    body = await readJsonBody(req)
  } catch (error) {
    return void respondJson(res, 400, { error: 'bad-request', message: error && error.message ? error.message : String(error) })
  }
  const sessionId = typeof body.session === 'string' ? body.session : ''
  const text = typeof body.text === 'string' ? body.text : ''
  const summary = typeof body.summary === 'string' ? body.summary.replace(/\s+/g, ' ').trim().slice(0, 200) : ''
  if (sessionId === '' || text.trim() === '' || text.length > REMIND_MAX_TEXT) {
    return void respondJson(res, 400, { error: 'bad-request' })
  }
  const sessions = ctx.get('sessions')
  if (sessions === undefined) return void respondJson(res, 503, { error: 'sessions-unavailable' })
  let session
  try {
    session = sessions.get(sessionId)
  } catch {
    session = undefined
  }
  if (session === undefined) return void respondJson(res, 404, { error: 'session-not-open', sessionId })
  const rand = globalThis.crypto !== undefined && typeof globalThis.crypto.randomUUID === 'function'
    ? String(globalThis.crypto.randomUUID())
    : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
  const message = {
    id: 'dsh-context-' + rand,
    role: 'user',
    content: [{ type: 'text', text }],
    source: {
      kind: 'plugin',
      plugin: 'dsh-context',
      form: 'notice',
      ...(summary === '' ? {} : { summary }),
    },
  }
  try {
    const event = session.append('user/message', message, { surfaceOp: 'append' })
    respondJson(res, 200, { ok: true, ...(event && typeof event.seq === 'number' ? { seq: event.seq } : {}) })
  } catch (error) {
    respondJson(res, 502, { error: 'remind-failed', message: error && error.message ? error.message : String(error) })
  }
}


// ─── routes ──────────────────────────────────────────────────────────────────

function respond(res, code, contentType, body) {
  res.writeHead(code, { 'content-type': contentType, 'cache-control': 'no-store' })
  res.end(body)
}

function respondJson(res, code, value) {
  respond(res, code, 'application/json; charset=utf-8', JSON.stringify(value))
}

function handleRequest(ctx, req, res) {
  let url
  try {
    url = new URL(req.url ?? '/', 'http://context-view.local')
  } catch {
    return void respond(res, 400, 'text/plain', 'bad url')
  }
  let path = url.pathname
  if (path.startsWith('/context-view')) path = path.slice('/context-view'.length)
  if (path === '' || !path.startsWith('/')) path = '/'
  if (path === '/unload') return void handleUnload(ctx, req, res)
  if (path === '/remind') return void handleRemind(ctx, req, res)
  if (req.method !== 'GET' && req.method !== 'HEAD') return void respond(res, 405, 'text/plain', 'GET only')
  if (path === '/health') return void respond(res, 200, 'text/plain', 'ok')
  if (path !== '/snapshot') return void respond(res, 404, 'text/plain', 'unknown context-view route')
  if (viewState.enabled !== true) return void respond(res, 404, 'text/plain', 'context-view is disabled')
  const sessions = ctx.get('sessions')
  if (sessions === undefined) return void respondJson(res, 503, { error: 'sessions-unavailable' })
  const sessionId = url.searchParams.get('session') || ''
  if (sessionId.length === 0) return void respondJson(res, 400, { error: 'missing session' })
  let session
  try {
    session = sessions.get(sessionId)
  } catch {
    session = undefined
  }
  if (session === undefined) return void respondJson(res, 404, { error: 'session-not-open', sessionId })
  try {
    respondJson(res, 200, buildSnapshot(ctx, session, sessionId))
  } catch (error) {
    respondJson(res, 500, { error: 'snapshot-failed', message: error && error.message ? error.message : String(error) })
  }
}

// ─── plugin ──────────────────────────────────────────────────────────────────

/**
 * Plugin body: register the `context-view` settings section and the
 * `/context-view/*` routes on the web server.
 * @param {import('@deepseek-ai/cordis').Context} ctx - host plugin context.
 * @param {object | undefined} config - patch row `config`.
 */
export function apply(ctx, config) {
  const resolved = resolveContextViewSection(config ?? {})
  Object.assign(viewState, resolved)

  // The settings service may mount after this row (file:// inserts run early in
  // the layer); wait for it reactively so the card never races the provider.
  const registerSection = (settingsCtx) => {
    settingsCtx.settings.installSection(settingsCtx, 'context-view', createContextViewSchema(), { enabled: viewState.enabled, language: viewState.language, pins: viewState.pins }, {
      setSource: (current) => {
        Object.assign(viewState, resolveContextViewSection(current))
      },
      onChange: () => {
        ctx.logger?.debug?.('context-view: enabled=%s language=%s', viewState.enabled, viewState.language)
      },
    })
  }
  if (ctx.get('settings') !== undefined) registerSection(ctx)
  else ctx.inject(['settings'], registerSection)

  const registerRoutes = (webCtx) => {
    webCtx.effect(
      () => webCtx.webServer.register({ kind: 'prefix', path: '/context-view', handler: (req, res) => handleRequest(ctx, req, res) }),
      'context-view: panel routes',
    )
  }
  if (ctx.get('webServer') === undefined) ctx.inject(['webServer'], registerRoutes)
  else registerRoutes(ctx)
}

/** Current resolved state (host-side fallback when settings are absent). */
export function readContextViewState() {
  return { ...viewState }
}
