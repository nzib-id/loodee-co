import { useRef, useEffect } from 'react'
import { useAgentStore } from '../store/agentStore.js'

function LogEntry({ entry }) {
  const isSystem = entry.agentName === 'SYSTEM' || !entry.agentName
  return (
    <div
      className="flex gap-3 py-1.5 text-xs last:border-0"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <span className="shrink-0 tabular-nums w-10 font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
        {entry.time}
      </span>
      <span
        className="shrink-0 w-24 truncate font-heading text-[10px]"
        style={{ color: isSystem ? '#ffe500' : entry.color }}
      >
        {entry.agentName}
      </span>
      <span className="flex-1 min-w-0 break-words font-mono" style={{ color: 'rgba(255,255,255,0.6)' }}>
        {entry.msg}
      </span>
    </div>
  )
}

export default function LogPanel() {
  const logs = useAgentStore((s) => s.logs)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs.length])

  return (
    <div
      className="flex flex-col h-full log-divider"
      style={{ background: '#292929' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <span className="text-[10px] tracking-widest font-heading" style={{ color: '#ffe500' }}>
          ACTIVITY LOG
        </span>
        <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {logs.length} entries
        </span>
      </div>

      {/* Scrollable log list */}
      <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col-reverse">
        <div ref={bottomRef} />
        {logs.map((entry) => (
          <LogEntry key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  )
}
