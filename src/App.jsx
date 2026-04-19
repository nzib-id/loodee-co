import { useEffect, useState } from 'react'
import PixiApp from './game/PixiApp.jsx'
import AgentPanel from './ui/AgentPanel.jsx'
import LogPanel from './ui/LogPanel.jsx'
import MeetRoomPanel from './ui/MeetRoomPanel.jsx'
import { initSocket } from './ws/socket.js'
import { useAgentStore } from './store/agentStore.js'

function LiveClock() {
  useEffect(() => {
    const el = document.getElementById('hq-clock')
    if (!el) return
    const tick = () => {
      el.textContent = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: true
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return <span id="hq-clock" className="tabular-nums font-heading text-2xl" style={{ color: '#ffffff', textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000' }} />
}

function isMobileDevice() {
  // Use smallest screen dimension — doesn't change on rotate
  return Math.min(window.screen.width, window.screen.height) < 768
}

function MeetRoomModal({ onClose }) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      {/* Modal */}
      <div
        className="fixed z-50 flex flex-col"
        style={{
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80vw',
          height: '80vh',
          background: '#1a1a1a',
          border: '2px solid rgba(244,114,182,0.4)',
          boxShadow: '0 0 40px rgba(244,114,182,0.15), 4px 4px 0 rgba(0,0,0,0.8)',
        }}
      >
        <MeetRoomPanel onClose={onClose} />
      </div>
    </>
  )
}

function BottomSection({ onOpenMeetRoom }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <span
          className="px-3 py-1.5 text-[9px] tracking-widest font-heading"
          style={{ color: '#ffe500', borderBottom: '2px solid #ffe500', marginBottom: '-1px' }}
        >
          ACTIVITY LOG
        </span>
        <button
          className="px-3 py-1.5 text-[9px] tracking-widest font-heading"
          style={{
            color: 'rgba(244,114,182,0.7)',
            borderBottom: '2px solid transparent',
            background: 'transparent',
            marginBottom: '-1px',
            cursor: 'pointer',
          }}
          onClick={onOpenMeetRoom}
        >
          ⚔ MEET ROOM
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <LogPanel />
      </div>
    </div>
  )
}

export default function App() {
  const [mobile, setMobile] = useState(isMobileDevice)
  const [panelOpen, setPanelOpen] = useState(false)
  const [meetRoomOpen, setWarRoomOpen] = useState(false)
  const [pixiKey, setPixiKey] = useState(0)

  useEffect(() => {
    initSocket()

    // Reinit PixiJS after orientation change
    const onReinit = () => setPixiKey(k => k + 1)
    window.addEventListener('pixi-reinit', onReinit)

    // Re-check mobile on resize (e.g. DevTools)
    const onResize = () => setMobile(isMobileDevice())
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('pixi-reinit', onReinit)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // ─── Desktop layout ───────────────────────────────────────────────────────
  if (!mobile) {
    return (
      <div className="flex flex-col lg:flex-row h-screen w-screen overflow-hidden" style={{ background: '#292929' }}>
        <div className="relative flex-1 min-w-0 overflow-hidden scanline-overlay">
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 pointer-events-none">
            <LiveClock />
          </div>
          <PixiApp key={pixiKey} className="w-full h-full" />
        </div>
        <div className="flex flex-col w-80 min-h-0 overflow-hidden panel-divider" style={{ background: '#292929' }}>
          <div className="flex-1 min-h-0 min-w-0 overflow-hidden"><AgentPanel /></div>
          <div className="h-64 shrink-0 overflow-hidden log-divider">
            <BottomSection onOpenMeetRoom={() => setWarRoomOpen(true)} />
          </div>
        </div>
        {meetRoomOpen && <MeetRoomModal onClose={() => setWarRoomOpen(false)} />}
      </div>
    )
  }

  // ─── Mobile layout (portrait & landscape) ─────────────────────────────────
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: '#292929' }}>
      {/* Canvas — always fullscreen on mobile */}
      <div className="absolute inset-0 scanline-overlay">
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 pointer-events-none">
          <LiveClock />
        </div>
        <PixiApp key={pixiKey} className="w-full h-full" />
      </div>

      {/* Toggle button */}
      <button
        className="fixed bottom-4 right-4 z-50 px-3 py-2 text-xs font-heading"
        style={{ background: '#292929', border: '2px solid #ffe500', boxShadow: '3px 3px 0 rgba(0,0,0,1)', color: '#ffe500' }}
        onClick={() => setPanelOpen(v => !v)}
      >
        {panelOpen ? '✕ CLOSE' : '≡ HQ'}
      </button>

      {/* Backdrop */}
      {panelOpen && (
        <div className="fixed inset-0 z-30"
          style={{ backdropFilter: 'blur(4px)', background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setPanelOpen(false)} />
      )}

      {/* Slide-up panel drawer */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 flex flex-col overflow-hidden"
        style={{
          height: '70vh',
          background: '#292929',
          borderTop: '2px solid rgba(255,229,0,0.3)',
          transform: panelOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s ease-in-out',
        }}
      >
        <div className="flex-1 min-h-0 overflow-hidden"><AgentPanel /></div>
        <div className="h-40 shrink-0 overflow-hidden" style={{ borderTop: '2px solid rgba(255,255,255,0.1)' }}>
          <BottomSection onOpenMeetRoom={() => setWarRoomOpen(true)} />
        </div>
      </div>
      {meetRoomOpen && <MeetRoomModal onClose={() => setWarRoomOpen(false)} />}
    </div>
  )
}
