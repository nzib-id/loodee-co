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
  ['loodee',      { id: 'loodee',      status: 'active', load: 0 }],
  ['codebot',     { id: 'codebot',     status: 'idle',   load: 0 }],
  ['researchbot', { id: 'researchbot', status: 'idle',   load: 0 }],
  ['creativebot', { id: 'creativebot', status: 'idle',   load: 0 }],
])

// Read OpenClaw sessions.json and derive agent states
function pollOpenClaw() {
  try {
    const raw = readFileSync(SESSIONS_FILE, 'utf8')
    const sessions = JSON.parse(raw)
    const now = Date.now()
    const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000 // active if updated within 5 minutes

    let changed = false

    for (const [key, session] of Object.entries(sessions)) {
      const id = mapSessionToAgent(key)
      if (!id) continue

      const msSinceUpdate = now - (session.updatedAt ?? 0)
      const isActive = msSinceUpdate < ACTIVE_THRESHOLD_MS
      const newStatus = isActive ? 'active' : 'idle'

      const current = agentState.get(id)
      if (current && current.status !== newStatus) {
        agentState.set(id, { ...current, status: newStatus, load: isActive ? 60 : 0 })
        broadcast({ type: 'agent_status', agentId: id, status: newStatus, load: isActive ? 60 : 0 })
        changed = true
      }
    }

    if (changed) {
      console.log('[poll] Agent states updated')
    }
  } catch (err) {
    console.error('[poll] Error reading sessions file:', err.message)
  }
}

function mapSessionToAgent(sessionKey) {
  // agent:main:telegram:direct:1927609058 → loodee (main session)
  if (sessionKey.startsWith('agent:main')) return 'loodee'
  if (sessionKey.includes('code')) return 'codebot'
  if (sessionKey.includes('research')) return 'researchbot'
  if (sessionKey.includes('creative')) return 'creativebot'
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

httpServer.listen(PORT, () => {
  console.log(`🏠 Loodee Co. backend running on ws://localhost:${PORT}`)
  console.log(`   Health: http://localhost:${PORT}/health`)
  console.log(`   Sessions file: ${SESSIONS_FILE}`)
})
