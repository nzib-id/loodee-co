import { useAgentStore } from '../store/agentStore.js'

const WS_TOKEN = import.meta.env.VITE_WS_TOKEN ?? ''
const WS_BASE = import.meta.env.PROD ? 'wss://api.loodee.art' : 'ws://localhost:3001'
const WS_URL = WS_TOKEN ? `${WS_BASE}?token=${WS_TOKEN}` : WS_BASE
const RECONNECT_DELAY = 3000

let ws = null
let reconnectTimer = null

function connect() {
  try {
    ws = new WebSocket(WS_URL)
  } catch {
    scheduleReconnect()
    return
  }

  ws.onopen = () => {
    const { setWsConnected, addLog } = useAgentStore.getState()
    setWsConnected(true)
    addLog({ agent: 'system', agentName: 'System', msg: 'WebSocket connected to HQ server', color: '#4ade80' })
  }

  ws.onclose = () => {
    const { setWsConnected } = useAgentStore.getState()
    setWsConnected(false)
    scheduleReconnect()
  }

  ws.onerror = () => {
    ws?.close()
  }

  ws.onmessage = (event) => {
    let msg
    try {
      msg = JSON.parse(event.data)
    } catch {
      return
    }
    handleMessage(msg)
  }
}

function handleMessage(msg) {
  const { updateAgent, addLog, addChatMessage } = useAgentStore.getState()

  switch (msg.type) {
    case 'agent_status':
      if (msg.agentId && msg.status) {
        updateAgent(msg.agentId, { status: msg.status, load: msg.load ?? 0 })
      }
      break

    case 'log':
      addLog({
        agent: msg.agentId ?? 'system',
        agentName: msg.agentName ?? 'System',
        msg: msg.msg,
        color: msg.color ?? '#888',
      })
      break

    case 'chat':
      addChatMessage({
        agent: msg.agentId ?? 'system',
        agentName: msg.agentName ?? 'System',
        msg: msg.msg,
        color: msg.color ?? '#888',
      })
      break

    case 'agent_update':
      if (msg.agentId) {
        updateAgent(msg.agentId, msg.patch ?? {})
      }
      break

    default:
      break
  }
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer)
  reconnectTimer = setTimeout(connect, RECONNECT_DELAY)
}

export function send(data) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data))
  }
}

export function initSocket() {
  connect()
}
