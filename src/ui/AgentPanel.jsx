import { useAgentStore } from '../store/agentStore.js'

const STATUS_CONFIG = {
  active: { dot: 'bg-green-400 shadow-[0_0_6px_#4ade80]', label: 'Active', pulse: true },
  idle:   { dot: 'bg-amber-400',  label: 'Idle',   pulse: false },
  busy:   { dot: 'bg-loodee',     label: 'Busy',   pulse: true },
  offline:{ dot: 'bg-zinc-600',   label: 'Offline',pulse: false },
}

const ROLE_ICON = {
  Orchestrator: '🤙',
  Engineering:  '🤖',
  Intelligence: '🔍',
  Creative:     '🎨',
}

function AgentCard({ agent, selected, onClick }) {
  const s = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.offline
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl p-4 border transition-all duration-200 bg-dungeon-panel
        ${selected
          ? 'border-loodee shadow-[0_0_16px_rgba(124,106,247,0.2)]'
          : 'border-dungeon-border hover:border-zinc-600'
        }`}
      style={{ borderTopColor: selected ? agent.color : undefined }}
    >
      {/* Top accent */}
      <div className="w-full h-0.5 -mt-4 mb-3 -mx-4 rounded-t-xl" style={{ background: agent.color, width: 'calc(100% + 2rem)' }} />

      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
          style={{ background: `${agent.color}22` }}
        >
          {ROLE_ICON[agent.role] ?? '?'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-white text-sm truncate">{agent.name}</div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-widest">{agent.role}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <span
          className={`inline-block w-2 h-2 rounded-full shrink-0 ${s.dot} ${s.pulse ? 'status-active' : ''}`}
        />
        <span className="text-xs text-zinc-400">{s.label}</span>
      </div>

      {/* Load bar */}
      <div className="mt-2">
        <div className="flex justify-between text-[10px] text-zinc-600 mb-1">
          <span>LOAD</span>
          <span>{agent.load}%</span>
        </div>
        <div className="h-1 bg-dungeon-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${agent.load}%`, background: agent.color }}
          />
        </div>
      </div>

      <div
        className="mt-2 inline-block px-2 py-0.5 rounded-full text-[10px] text-zinc-500 bg-dungeon-muted"
      >
        {agent.model}
      </div>
    </button>
  )
}

export default function AgentPanel() {
  const agents = useAgentStore((s) => s.agents)
  const selectedAgent = useAgentStore((s) => s.selectedAgent)
  const setSelectedAgent = useAgentStore((s) => s.setSelectedAgent)
  const wsConnected = useAgentStore((s) => s.wsConnected)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dungeon-border shrink-0">
        <h1 className="text-white font-bold tracking-widest text-sm">
          LOODEE <span className="text-loodee">CO.</span>
        </h1>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-zinc-600'}`} />
          <span className="text-[10px] text-zinc-500">{wsConnected ? 'HQ LIVE' : 'HQ OFFLINE'}</span>
        </div>
      </div>

      {/* Agent cards */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        <div className="text-[10px] text-zinc-600 uppercase tracking-widest px-1 mb-2">
          Agents — {agents.filter(a => a.status === 'active').length} active
        </div>
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            selected={selectedAgent === agent.id}
            onClick={() => setSelectedAgent(agent.id)}
          />
        ))}
      </div>
    </div>
  )
}
