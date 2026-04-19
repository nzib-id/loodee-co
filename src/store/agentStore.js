import { create } from 'zustand'

const initialAgents = [
  {
    id: 'loodee',
    name: 'Loodee',
    role: 'Orchestrator',
    model: 'claude-sonnet-4-6',
    status: 'offline',
    load: 0,
    color: '#ffe500',
    sprite: 'soldier',
  },
  {
    id: 'kobo',
    name: 'Kobo',
    role: 'Engineering',
    model: 'claude-sonnet-4-6',
    status: 'offline',
    load: 0,
    color: '#38bdf8',
    sprite: 'orc',
  },
  {
    id: 'rebo',
    name: 'Rebo',
    role: 'Intelligence',
    model: 'qwen2.5:7b',
    status: 'offline',
    load: 0,
    color: '#f59e0b',
    sprite: null,
  },
  {
    id: 'krebo',
    name: 'Krebo',
    role: 'Creative',
    model: 'claude-sonnet-4-6',
    status: 'offline',
    load: 0,
    color: '#f472b6',
    sprite: null,
  },
]

const initialLogs = []

export const useAgentStore = create((set) => ({
  agents: initialAgents,
  logs: initialLogs,
  chatMessages: [],
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

  addChatMessage: (entry) =>
    set((state) => ({
      chatMessages: [
        ...state.chatMessages,
        { id: Date.now() + Math.random(), time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), ...entry },
      ].slice(-200),
    })),

  setWsConnected: (connected) => set({ wsConnected: connected }),
}))
