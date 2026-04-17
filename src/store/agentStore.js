import { create } from 'zustand'

const initialAgents = [
  {
    id: 'loodee',
    name: 'Loodee',
    role: 'Orchestrator',
    model: 'claude-sonnet-4-6',
    status: 'active',
    load: 72,
    color: '#7c6af7',
    sprite: 'soldier',
  },
  {
    id: 'codebot',
    name: 'CodeBot',
    role: 'Engineering',
    model: 'claude-sonnet-4-6',
    status: 'idle',
    load: 0,
    color: '#38bdf8',
    sprite: 'orc',
  },
  {
    id: 'researchbot',
    name: 'ResearchBot',
    role: 'Intelligence',
    model: 'qwen2.5:7b',
    status: 'idle',
    load: 0,
    color: '#f59e0b',
    sprite: null,
  },
  {
    id: 'creativebot',
    name: 'CreativeBot',
    role: 'Creative',
    model: 'claude-sonnet-4-6',
    status: 'idle',
    load: 0,
    color: '#f472b6',
    sprite: null,
  },
]

const initialLogs = [
  { id: 1, time: '01:04', agent: 'loodee', agentName: 'Loodee', msg: 'Loodee Co. HQ initialized ✅', color: '#7c6af7' },
  { id: 2, time: '00:51', agent: 'loodee', agentName: 'Loodee', msg: 'Vite + React + Pixi.js scaffold ready', color: '#7c6af7' },
  { id: 3, time: '00:29', agent: 'loodee', agentName: 'Loodee', msg: 'Ollama qwen3:8b + qwen2.5:7b connected', color: '#7c6af7' },
  { id: 4, time: '23:13', agent: 'loodee', agentName: 'Loodee', msg: 'Session started — Nzib online', color: '#7c6af7' },
]

export const useAgentStore = create((set) => ({
  agents: initialAgents,
  logs: initialLogs,
  selectedAgent: 'loodee',
  wsConnected: false,

  setSelectedAgent: (id) => set({ selectedAgent: id }),

  updateAgent: (id, patch) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    })),

  addLog: (entry) =>
    set((state) => ({
      logs: [
        { id: Date.now(), time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), ...entry },
        ...state.logs,
      ].slice(0, 200),
    })),

  setWsConnected: (connected) => set({ wsConnected: connected }),
}))
