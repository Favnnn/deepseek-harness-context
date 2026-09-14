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
 *    Settings → Plugins switch and gates the HTTP routes below.
 * 2) `/context-view/*` HTTP routes for the context panel:
 *    - GET /context-view/snapshot?session=<id> — the exact model-visible
 *      surface of one open Session, projected into numbered blocks: the
 *      request header (system prompt, tools) plus every surface event in
 *      head-to-tail order, with per-block token prices taken from the
 *      token-meter service when it is mounted (heuristic fallback otherwise).
 *    - GET /context-view/health — canary for troubleshooting.
 */

export const name = 'context-view'

// ─── settings ────────────────────────────────────────────────────────────────

/** Allowed panel languages; `auto` follows the GUI locale. */
const LANGUAGES = ['auto', 'en', 'ru']

/** Validate and normalize one merged settings candidate. Never throws. */
function resolveContextViewSection(candidate) {
  if (candidate === undefined || candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { enabled: true, language: 'auto' }
  }
  const enabled = typeof candidate.enabled === 'boolean' ? candidate.enabled : true
  const language = typeof candidate.language === 'string' && LANGUAGES.includes(candidate.language) ? candidate.language : 'auto'
  return { ...candidate, enabled, language }
}

/** Build the schemastery-compatible node for `{ enabled, language }`. */
function createContextViewSchema() {
  const refs = {
    0: { type: 'object', meta: {}, dict: { enabled: 1, language: 2 } },
    1: { type: 'boolean', meta: { default: true } },
    2: { type: 'string', meta: { default: 'auto' } },
  }
  const schema = (candidate) => resolveContextViewSection(candidate)
  schema.type = 'object'
  schema.meta = refs[0].meta
  schema.dict = { enabled: refs[1], language: refs[2] }
  schema.toJSON = () => ({ uid: 0, refs })
  return schema
}

/** Resolved section state for diagnostics and route gating. */
const viewState = { enabled: true, language: 'auto' }

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
    settingsCtx.settings.installSection(settingsCtx, 'context-view', createContextViewSchema(), { enabled: viewState.enabled, language: viewState.language }, {
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
      'context-view: snapshot routes',
    )
  }
  if (ctx.get('webServer') === undefined) ctx.inject(['webServer'], registerRoutes)
  else registerRoutes(ctx)
}

/** Current resolved state (host-side fallback when settings are absent). */
export function readContextViewState() {
  return { ...viewState }
}
