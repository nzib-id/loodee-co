import { useAgentStore } from '../store/agentStore.js'

const STATUS_CONFIG = {
  active:  { dot: '#4ade80', label: 'Active',  pulse: true },
  idle:    { dot: '#ffe500', label: 'Idle',    pulse: false },
  busy:    { dot: '#ffe500', label: 'Busy',    pulse: true },
  offline: { dot: 'rgba(255,255,255,0.2)', label: 'Offline', pulse: false },
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
      className="w-full text-left p-4 transition-all duration-150"
      style={{
        background: selected ? 'rgba(255,229,0,0.06)' : '#292929',
        border: selected ? '2px solid #ffe500' : '2px solid rgba(255,255,255,0.12)',
        boxShadow: selected ? '3px 3px 0 rgba(0,0,0,1)' : 'none',
        borderRadius: 0,
      }}
    >
      {/* Top color accent bar */}
      <div
        className="w-full h-0.5 mb-3"
        style={{ background: agent.color }}
      />

      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 shrink-0 flex items-center justify-center overflow-hidden"
          style={{
            background: agent.color,
            border: `2px solid ${agent.color}`,
            borderRadius: 0,
          }}
        >
          <img
            src="/assets/pfp1.png"
            alt="avatar"
            style={{ imageRendering: 'pixelated', width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="font-heading text-sm truncate"
            style={{ color: selected ? '#ffe500' : '#ffffff' }}
          >
            {agent.name}
          </div>
          <div className="text-[10px] tracking-widest mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {agent.role}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <span
          className={`inline-block w-2 h-2 shrink-0 ${s.pulse ? 'status-active' : ''}`}
          style={{ background: s.dot, borderRadius: 0 }}
        />
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{s.label}</span>
      </div>

      {/* Load bar */}
      <div className="mt-2">
        <div className="flex justify-between text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <span>LOAD</span>
          <span>{agent.load}%</span>
        </div>
        <div className="h-1 overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <div
            className="h-full transition-all duration-1000"
            style={{ width: `${agent.load}%`, background: agent.color }}
          />
        </div>
      </div>

      <div
        className="mt-2 inline-block px-2 py-0.5 text-[10px] font-mono"
        style={{
          color: 'rgba(255,255,255,0.4)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 0,
        }}
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
    <div className="flex flex-col h-full" style={{ background: '#292929' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: '2px solid rgba(255,255,255,0.12)' }}
      >
        <div className="flex items-center gap-3">
          <img
            src="/assets/logo/logo.svg"
            alt="Loodee Co."
            className="h-6 w-auto"
          />
          <span className="font-heading text-sm" style={{ color: '#ffe500' }}>
            LOODEE CO.
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 status-active"
            style={{
              background: wsConnected ? '#ffe500' : 'rgba(255,255,255,0.2)',
              borderRadius: 0,
              display: 'inline-block',
            }}
          />
          <span
            className="text-[10px] tracking-widest font-heading"
            style={{ color: wsConnected ? '#ffe500' : 'rgba(255,255,255,0.3)' }}
          >
            {wsConnected ? 'HQ LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Agent cards */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        <div
          className="text-[10px] tracking-widest px-1 mb-2 font-heading"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          AGENTS — {agents.filter(a => a.status === 'active').length} ACTIVE
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
