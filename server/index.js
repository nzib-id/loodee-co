// Loodee Co. HQ Server
import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import cors from 'cors'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import path from 'path'

const GALLERY_DIR = path.join(homedir(), '.openclaw/workspace/projects/nano-banana-gen/gallery')
const GALLERY_META = path.join(GALLERY_DIR, 'metadata.json')

// Ensure gallery dir exists
mkdirSync(GALLERY_DIR, { recursive: true })

const PORT = 3001
const WS_SECRET_TOKEN = process.env.WS_SECRET_TOKEN
const SESSIONS_FILES = [
  path.join(homedir(), '.openclaw/agents/main/sessions/sessions.json'),
  path.join(homedir(), '.openclaw/agents/kobo/sessions/sessions.json'),
]
const POLL_INTERVAL = 5000 // poll sessions file every 5s

const app = express()
app.use(cors())
app.use(express.json({ limit: '20mb' }))

const httpServer = createServer(app)
const wss = new WebSocketServer({ server: httpServer })

// Track all connected clients
const clients = new Set()

// Broadcast to all connected clients
function broadcast(data) {
  const msg = JSON.stringify(data)
  for (const client of clients) {
    if (client.readyState === 1) { // OPEN
      client.send(msg)
    }
  }
}

// Gallery: save image to filesystem
app.post('/api/gallery/save', (req, res) => {
  const { imageData, mime, prompt, model, aspectRatio } = req.body
  if (!imageData) return res.status(400).json({ error: 'imageData required' })
  try {
    const timestamp = Date.now()
    const filename = `nanobanan-${timestamp}.png`
    const filepath = path.join(GALLERY_DIR, filename)
    // Save image file
    const buffer = Buffer.from(imageData, 'base64')
    writeFileSync(filepath, buffer)
    // Update metadata
    let metadata = []
    if (existsSync(GALLERY_META)) {
      try { metadata = JSON.parse(readFileSync(GALLERY_META, 'utf8')) } catch (_) {}
    }
    metadata.unshift({ filename, prompt: prompt ?? '', model: model ?? '', aspectRatio: aspectRatio ?? '', timestamp })
    writeFileSync(GALLERY_META, JSON.stringify(metadata, null, 2))
    console.log(`[gallery] Saved ${filename}`)
    res.json({ ok: true, filename })
  } catch (err) {
    console.error('[gallery] Save error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Gallery: list all images
app.get('/api/gallery', (req, res) => {
  try {
    let images = []
    if (existsSync(GALLERY_META)) {
      images = JSON.parse(readFileSync(GALLERY_META, 'utf8'))
    }
    res.json({ images })
  } catch (err) {
    res.json({ images: [] })
  }
})

// Gallery: serve image file
app.get('/api/gallery/:filename', (req, res) => {
  const filename = path.basename(req.params.filename)
  const filepath = path.join(GALLERY_DIR, filename)
  if (!existsSync(filepath)) return res.status(404).json({ error: 'not found' })
  res.sendFile(filepath)
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', clients: clients.size, uptime: process.uptime() })
})

// In-memory message store for Meet Room DMs
const messageStore = []

// Chat + log history for replay on reconnect (max 200 entries)
const chatHistory = []
function broadcastAndStore(data) {
  chatHistory.push(data)
  if (chatHistory.length > 200) chatHistory.shift()
  broadcast(data)
}
let messageIdCounter = 1

const AGENT_COLORS = {
  loodee: '#ffe500',
  kobo: '#22d3ee',
  rebo: '#a78bfa',
  krebo: '#fb923c',
  system: '#4ade80',
}

function agentColor(agentId) {
  return AGENT_COLORS[agentId] ?? '#888'
}

// Broadcast a chat message to all clients, optionally store for a specific agent
app.post('/api/message', (req, res) => {
  const { agentId, agentName, msg, color, to } = req.body
  if (!agentId || !msg) return res.status(400).json({ error: 'agentId and msg required' })
  const record = {
    id: messageIdCounter++,
    from: agentId,
    to: to ?? null,
    msg,
    status: 'unread',
    timestamp: Date.now(),
  }
  messageStore.push(record)
  broadcastAndStore({ type: 'chat', agentId, agentName: agentName ?? agentId, msg, color: color ?? agentColor(agentId), to })
  console.log(`[chat] ${agentName ?? agentId}${to ? ` → ${to}` : ''}: ${msg}`)
  res.json({ ok: true, id: record.id })
})

// Debug: get ALL messages
app.get('/api/messages/all', (req, res) => {
  res.json({ messages: messageStore })
})

// Get unread messages for a specific agent
app.get('/api/messages', (req, res) => {
  const { for: forAgent } = req.query
  if (!forAgent) return res.status(400).json({ error: 'for query param required' })
  const unread = messageStore.filter(m => m.to === forAgent && m.status === 'unread')
  res.json({ messages: unread })
})

// Log a message between agents
app.post('/api/messages', (req, res) => {
  const { from, to, content, type } = req.body
  if (!from || !to || !content) return res.status(400).json({ error: 'from, to, and content required' })
  const record = {
    id: messageIdCounter++,
    from,
    to,
    msg: content,
    type: type ?? 'message',
    status: 'unread',
    timestamp: Date.now(),
  }
  messageStore.push(record)
  broadcast({ type: 'chat', agentId: from, agentName: from, msg: content, color: agentColor(from), to })
  res.json({ ok: true, id: String(record.id) })
})

// Mark a message as read
app.post('/api/messages/:id/read', (req, res) => {
  const id = parseInt(req.params.id, 10)
  const msg = messageStore.find(m => m.id === id)
  if (!msg) return res.status(404).json({ error: 'message not found' })
  msg.status = 'read'
  res.json({ ok: true })
})

// Set agent status manually (used by orchestrator)
app.post('/api/agent-status', (req, res) => {
  const { agentId, status, load } = req.body
  if (!agentId || !status) return res.status(400).json({ error: 'agentId and status required' })
  agentState.set(agentId, { id: agentId, status, load: load ?? 0 })
  broadcast({ type: 'agent_status', agentId, status, load: load ?? 0 })
  console.log(`[api] ${agentId} set to ${status}`)
  res.json({ ok: true })
})

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const token = url.searchParams.get('token')

  if (!WS_SECRET_TOKEN || token !== WS_SECRET_TOKEN) {
    ws.close(4401, 'Unauthorized')
    console.warn(`[ws] Rejected connection — invalid token (ip: ${req.socket.remoteAddress})`)
    return
  }

  clients.add(ws)
  console.log(`[ws] Client connected (total: ${clients.size})`)

  // Send initial state immediately
  ws.send(JSON.stringify({
    type: 'log',
    agentId: 'system',
    agentName: 'System',
    msg: 'Connected to Loodee Co. HQ 🏠',
    color: '#4ade80',
  }))

  // Send current agent states
  for (const agent of agentState.values()) {
    ws.send(JSON.stringify({
      type: 'agent_status',
      agentId: agent.id,
      status: agent.status,
      load: agent.load,
    }))
  }

  // Replay last 50 chat + log messages so client gets history on connect
  const history = chatHistory.slice(-50)
  for (const entry of history) {
    ws.send(JSON.stringify(entry))
  }

  ws.on('close', () => {
    clients.delete(ws)
    console.log(`[ws] Client disconnected (total: ${clients.size})`)
  })

  ws.on('error', (err) => {
    console.error('[ws] Error:', err.message)
    clients.delete(ws)
  })
})

// In-memory agent state (synced from OpenClaw)
const agentState = new Map([
  ['loodee', { id: 'loodee', status: 'active', load: 0 }],
  ['kobo',   { id: 'kobo',   status: 'idle',   load: 0 }],
  ['rebo',   { id: 'rebo',   status: 'idle',   load: 0 }],
  ['krebo',  { id: 'krebo',  status: 'idle',   load: 0 }],
])

// Task registry: agentId → { startedAt, ttlMs, label }
// When a task is active and within TTL, agent is shown as active
const taskRegistry = new Map()

// POST /api/task-start — mark agent as working on a task
// Body: { agentId, label?, ttlMs? }
// ttlMs defaults to 30 minutes; use 0 for no auto-expire
app.post('/api/task-start', (req, res) => {
  const { agentId, label = 'Working...', ttlMs = 30 * 60 * 1000 } = req.body
  if (!agentId) return res.status(400).json({ error: 'agentId required' })
  taskRegistry.set(agentId, { startedAt: Date.now(), ttlMs, label })
  agentState.set(agentId, { id: agentId, status: 'active', load: 75 })
  broadcast({ type: 'agent_status', agentId, status: 'active', load: 75 })
  broadcastAndStore({ type: 'log', agentId, agentName: agentId, msg: `Task started: ${label}`, color: '#4ade80' })
  console.log(`[task] ${agentId} started: ${label}`)
  res.json({ ok: true })
})

// POST /api/task-done — mark agent task as complete
// Body: { agentId, label? }
app.post('/api/task-done', (req, res) => {
  const { agentId, label = 'Task complete' } = req.body
  if (!agentId) return res.status(400).json({ error: 'agentId required' })
  taskRegistry.delete(agentId)
  agentState.set(agentId, { id: agentId, status: 'idle', load: 0 })
  broadcast({ type: 'agent_status', agentId, status: 'idle', load: 0 })
  broadcastAndStore({ type: 'log', agentId, agentName: agentId, msg: `✓ ${label}`, color: '#ffe500' })
  console.log(`[task] ${agentId} done: ${label}`)
  res.json({ ok: true })
})

// Auto-expire tasks that exceeded their TTL
setInterval(() => {
  const now = Date.now()
  for (const [agentId, task] of taskRegistry.entries()) {
    if (task.ttlMs > 0 && now - task.startedAt > task.ttlMs) {
      taskRegistry.delete(agentId)
      agentState.set(agentId, { id: agentId, status: 'idle', load: 0 })
      broadcast({ type: 'agent_status', agentId, status: 'idle', load: 0 })
      broadcastAndStore({ type: 'log', agentId, agentName: agentId, msg: `Task expired (TTL exceeded)`, color: '#888' })
      console.log(`[task] ${agentId} expired`)
    }
  }
}, 10000)

// Read OpenClaw sessions.json and derive agent states
function pollOpenClaw() {
  try {
    const allSessions = {}
    for (const file of SESSIONS_FILES) {
      try {
        const raw = readFileSync(file, 'utf8')
        Object.assign(allSessions, JSON.parse(raw))
      } catch (_) {}
    }
    const now = Date.now()
    const ACTIVE_THRESHOLD_MS = 10 * 60 * 1000 // fallback for sessions without status field

    // Aggregate per agent: track whether any session is running, plus most recent updatedAt
    // Sessions with explicit status field use that as authoritative signal.
    // Sessions without status field fall back to updatedAt freshness (backward compat).
    const agentInfo = new Map() // agentId → { running: bool, lastUpdated: ms }
    for (const [key, session] of Object.entries(allSessions)) {
      const id = mapSessionToAgent(key)
      if (!id) continue
      const prev = agentInfo.get(id) ?? { running: false, lastUpdated: 0 }
      const updatedAt = session.updatedAt ?? 0
      let isRunning
      if (session.status != null) {
        isRunning = session.status === 'running'
      } else {
        // Legacy format: no status field — treat as running if recently updated
        isRunning = updatedAt > 0 && (now - updatedAt) < ACTIVE_THRESHOLD_MS
      }
      agentInfo.set(id, {
        running: prev.running || isRunning,
        lastUpdated: Math.max(prev.lastUpdated, updatedAt),
      })
    }

    function deriveLoad(running, lastUpdated) {
      if (!running) return 0
      const msSince = now - lastUpdated
      // Fresher updates = higher load, decays over 10 min, floor 20
      return Math.min(90, Math.max(20, 60 - Math.round(msSince / 10000)))
    }

    // Always broadcast ALL agent statuses every poll so frontend stays in sync
    for (const id of ['loodee', 'kobo', 'rebo', 'krebo']) {
      // taskRegistry override: explicit signal from orchestrator takes priority
      const task = taskRegistry.get(id)
      if (task) {
        const load = Math.min(95, Math.round(55 + ((now - task.startedAt) / 60000) * 2))
        broadcast({ type: 'agent_status', agentId: id, status: 'active', load })
        continue
      }

      const info = agentInfo.get(id) ?? { running: false, lastUpdated: 0 }
      const newStatus = info.running ? 'active' : 'idle'
      const newLoad = deriveLoad(info.running, info.lastUpdated)

      const current = agentState.get(id)
      if (current && current.status !== newStatus) {
        agentState.set(id, { ...current, status: newStatus, load: newLoad })
        console.log(`[poll] ${id}: ${current.status} → ${newStatus}`)
      }
      broadcast({ type: 'agent_status', agentId: id, status: newStatus, load: newLoad })
    }

  } catch (err) {
    console.error('[poll] Error reading sessions file:', err.message)
  }
}

function mapSessionToAgent(sessionKey) {
  // agent:main:telegram:direct:1927609058 → loodee (main session)
  if (sessionKey.startsWith('agent:main')) return 'loodee'
  if (sessionKey.includes('kobo')) return 'kobo'
  if (sessionKey.includes('research') || sessionKey.includes('rebo')) return 'rebo'
  if (sessionKey.includes('creative') || sessionKey.includes('krebo')) return 'krebo'
  return null
}

// Start polling
setInterval(pollOpenClaw, POLL_INTERVAL)
pollOpenClaw() // immediate first poll

// Heartbeat ping to all clients every 30s
setInterval(() => {
  broadcast({
    type: 'log',
    agentId: 'system',
    agentName: 'System',
    msg: `Heartbeat — ${clients.size} client(s) connected`,
    color: '#444',
  })
}, 30000)

httpServer.on('listening', () => {
  console.log(`🏠 Loodee Co. backend running on ws://localhost:${PORT}`)
  console.log(`   Health: http://localhost:${PORT}/health`)
  console.log(`   Sessions files: ${SESSIONS_FILES.join(', ')}`)
})

// Never crash on EADDRINUSE — just keep retrying every 2s
httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[server] Port ${PORT} in use, retrying in 2s...`)
    setTimeout(() => httpServer.listen(PORT), 2000)
  } else {
    throw err
  }
})

httpServer.listen(PORT)

// Graceful shutdown — release port immediately on exit
function shutdown() {
  console.log('[server] Shutting down...')
  httpServer.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 3000)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
