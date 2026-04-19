import { useRef, useEffect } from 'react'
import { useAgentStore } from '../store/agentStore.js'

function ChatBubble({ entry }) {
  const isSystem = entry.agentName === 'SYSTEM' || entry.agent === 'system'
  return (
    <div className="flex flex-col gap-0.5 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-baseline gap-2">
        <span
          className="text-[10px] font-heading shrink-0"
          style={{ color: isSystem ? '#ffe500' : entry.color }}
        >
          {entry.agentName}
        </span>
        <span className="text-[9px] font-mono tabular-nums" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {entry.time}
        </span>
      </div>
      <span className="text-xs font-mono leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
        {entry.msg}
      </span>
    </div>
  )
}

export default function MeetRoomPanel({ onClose }) {
  const messages = useAgentStore((s) => s.chatMessages)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className="flex flex-col h-full" style={{ background: '#1a1a1a' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: '2px solid rgba(244,114,182,0.3)' }}
      >
        <span className="text-xs tracking-widest font-heading" style={{ color: '#f472b6' }}>
          MEET ROOM
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {messages.length} msg
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs font-heading px-2 py-1"
              style={{
                color: 'rgba(255,255,255,0.5)',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
              no messages yet
            </span>
          </div>
        ) : (
          messages.map((entry) => <ChatBubble key={entry.id} entry={entry} />)
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
