import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import fetch from 'node-fetch'
import cors from 'cors'

const PORT = 3001
const OPENCLAW_API = 'http://127.0.0.1:18789'
const POLL_INTERVAL = 5000 // poll OpenClaw every 5s

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

// Poll OpenClaw API for session/agent status
async function pollOpenClaw() {
  try {
    const res = await fetch(`${OPENCLAW_API}/api/sessions`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000),
    })

    if (!res.ok) return

    const data = await res.json()
    const sessions = data.sessions ?? data ?? []

    let changed = false

    for (const session of sessions) {
      // Map session keys to agent IDs
      const id = mapSessionToAgent(session.key ?? session.id ?? '')
      if (!id) continue

      const isActive = session.status === 'running' || session.status === 'active'
      const newStatus = isActive ? 'active' : 'idle'
      const newLoad = isActive ? Math.floor(Math.random() * 40 + 40) : 0 // placeholder load

      const current = agentState.get(id)
      if (current && (current.status !== newStatus || current.load !== newLoad)) {
        agentState.set(id, { id, status: newStatus, load: newLoad })
        broadcast({ type: 'agent_status', agentId: id, status: newStatus, load: newLoad })
        changed = true
      }
    }

    // Loodee (main agent) is always active if server is running
    const loodee = agentState.get('loodee')
    if (loodee?.status !== 'active') {
      agentState.set('loodee', { id: 'loodee', status: 'active', load: 65 })
      broadcast({ type: 'agent_status', agentId: 'loodee', status: 'active', load: 65 })
    }

    if (changed) {
      console.log('[poll] Agent states updated')
    }
  } catch (err) {
    // OpenClaw not reachable — keep last known state
    if (err.name !== 'AbortError' && err.code !== 'ECONNREFUSED') {
      console.error('[poll] Error:', err.message)
    }
  }
}

function mapSessionToAgent(sessionKey) {
  if (sessionKey.includes('main') || sessionKey.includes('loodee')) return 'loodee'
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
  console.log(`   OpenClaw API: ${OPENCLAW_API}`)
})
