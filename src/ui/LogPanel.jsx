import { useRef, useEffect } from 'react'
import { useAgentStore } from '../store/agentStore.js'

function LogEntry({ entry }) {
  return (
    <div className="flex gap-3 py-1.5 border-b border-dungeon-border/50 text-xs last:border-0">
      <span className="text-zinc-600 shrink-0 tabular-nums w-10">{entry.time}</span>
      <span
        className="shrink-0 w-24 truncate font-semibold"
        style={{ color: entry.color }}
      >
        {entry.agentName}
      </span>
      <span className="text-zinc-400 flex-1 min-w-0 break-words">{entry.msg}</span>
    </div>
  )
}

export default function LogPanel() {
  const logs = useAgentStore((s) => s.logs)
  const bottomRef = useRef(null)

  // Auto-scroll to top when new log arrives (logs are newest-first)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs.length])

  return (
    <div className="flex flex-col h-full border-t border-dungeon-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-dungeon-border shrink-0">
        <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Activity Log</span>
        <span className="text-[10px] text-zinc-600">{logs.length} entries</span>
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
