// Loodee Co. HQ Server
import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import cors from 'cors'
import { readFileSync } from 'fs'
import { homedir } from 'os'
import path from 'path'

const PORT = 3001
const SESSIONS_FILE = path.join(homedir(), '.openclaw/agents/main/sessions/sessions.json')
const POLL_INTERVAL = 5000 // poll sessions file every 5s

const app = express()
app.use(cors())
app.use(express.json())

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
    const raw = readFileSync(SESSIONS_FILE, 'utf8')
    const sessions = JSON.parse(raw)
    const now = Date.now()
    const ACTIVE_THRESHOLD_MS = 10 * 60 * 1000 // active if updated within 10 minutes

    // Aggregate: per agent, take the most recent updatedAt across all matching sessions
    const latestUpdated = new Map()
    for (const [key, session] of Object.entries(sessions)) {
      const id = mapSessionToAgent(key)
      if (!id) continue
      const updated = session.updatedAt ?? 0
      if (!latestUpdated.has(id) || updated > latestUpdated.get(id)) {
        latestUpdated.set(id, updated)
      }
    }

    let changed = false
    for (const [id, updatedAt] of latestUpdated.entries()) {
      const msSinceUpdate = now - updatedAt
      const isActive = msSinceUpdate < ACTIVE_THRESHOLD_MS
      const newStatus = isActive ? 'active' : 'idle'
      const newLoad = isActive ? Math.round(60 - (msSinceUpdate / ACTIVE_THRESHOLD_MS) * 60) : 0

      const current = agentState.get(id)
      if (current && current.status !== newStatus) {
        agentState.set(id, { ...current, status: newStatus, load: newLoad })
        broadcast({ type: 'agent_status', agentId: id, status: newStatus, load: newLoad })
        changed = true
        console.log(`[poll] ${id}: ${newStatus} (${Math.round(msSinceUpdate / 1000)}s ago)`)
      }
    }

    // Always broadcast ALL agent statuses every poll so frontend stays in sync
    const loodeeUpdated = latestUpdated.get('loodee') ?? 0
    const loodeeMsSince = now - loodeeUpdated
    const loodeeActive = loodeeMsSince < ACTIVE_THRESHOLD_MS
    const loodeeLoad = loodeeActive ? Math.round(60 - (loodeeMsSince / ACTIVE_THRESHOLD_MS) * 60) : 0
    broadcast({ type: 'agent_status', agentId: 'loodee', status: loodeeActive ? 'active' : 'idle', load: loodeeLoad })

    // Kobo: active if task registry says so, else idle
    const koboTask = taskRegistry.get('kobo')
    const koboActive = !!koboTask
    const koboLoad = koboActive ? Math.min(95, Math.round(55 + ((Date.now() - koboTask.startedAt) / 60000) * 2)) : 0
    broadcast({ type: 'agent_status', agentId: 'kobo', status: koboActive ? 'active' : 'idle', load: koboActive ? koboLoad : 0 })

    // Rebo & Krebo: task registry first, fallback to session data
    for (const id of ['rebo', 'krebo']) {
      const task = taskRegistry.get(id)
      if (task) {
        const load = Math.min(95, Math.round(55 + ((now - task.startedAt) / 60000) * 2))
        broadcast({ type: 'agent_status', agentId: id, status: 'active', load })
      } else {
        const updated = latestUpdated.get(id) ?? 0
        const msSince = now - updated
        const isActive = updated > 0 && msSince < ACTIVE_THRESHOLD_MS
        broadcast({ type: 'agent_status', agentId: id, status: isActive ? 'active' : 'idle', load: isActive ? Math.round(60 - (msSince / ACTIVE_THRESHOLD_MS) * 60) : 0 })
      }
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
  console.log(`   Sessions file: ${SESSIONS_FILE}`)
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
