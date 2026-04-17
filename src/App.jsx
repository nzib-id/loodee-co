import { useEffect, useState } from 'react'
import PixiApp from './game/PixiApp.jsx'
import AgentPanel from './ui/AgentPanel.jsx'
import LogPanel from './ui/LogPanel.jsx'
import { initSocket } from './ws/socket.js'

function LiveClock() {
  useEffect(() => {
    const el = document.getElementById('hq-clock')
    if (!el) return
    const tick = () => {
      el.textContent = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span id="hq-clock" className="text-xs tabular-nums text-white/50" />
  )
}

export default function App() {
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => {
    initSocket()
  }, [])

  return (
    <div className="flex flex-col lg:flex-row h-screen w-screen overflow-hidden" style={{ background: '#292929' }}>
      {/* Canvas — fixed full-screen on mobile, flex item on md+ */}
      <div className="canvas-area relative h-[45vh] md:h-[50vh] lg:h-auto lg:flex-1 min-w-0 overflow-hidden scanline-overlay">
        {/* Corner HUD */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 pointer-events-none">
          <div
            className="px-2 py-1 text-[10px] tracking-widest font-heading"
            style={{
              background: '#292929',
              border: '2px solid #ffe500',
              boxShadow: '3px 3px 0 rgba(0,0,0,1)',
              color: '#ffe500',
            }}
          >
            LOODEE CO. HQ
          </div>
          <LiveClock />
        </div>

        {/* Coordinate display bottom-left */}
        <div className="absolute bottom-3 left-3 z-10 pointer-events-none">
          <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
            MAP: DUNGEON_01 — SECTOR 4
          </span>
        </div>

        <PixiApp className="w-full h-full" />
      </div>

      {/* Mobile backdrop — only shown when panel open */}
      <div
        className={`fixed inset-0 z-30 md:hidden transition-opacity duration-300 ${panelOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ backdropFilter: 'blur(4px)', background: 'rgba(0,0,0,0.4)' }}
        onClick={() => setPanelOpen(false)}
      />

      {/* Mobile floating toggle button */}
      <button
        className="fixed bottom-4 right-4 z-50 md:hidden px-3 py-2 text-xs font-heading"
        style={{
          background: '#292929',
          border: '2px solid #ffe500',
          boxShadow: '3px 3px 0 rgba(0,0,0,1)',
          color: '#ffe500',
        }}
        onClick={() => setPanelOpen(v => !v)}
      >
        ≡ HQ
      </button>

      {/* Panels — slide-up drawer on mobile, flex item on md+ */}
      <div
        className={`panel-drawer ${panelOpen ? 'open' : ''} flex flex-col md:flex-row lg:flex-col flex-1 lg:flex-none lg:w-72 overflow-hidden panel-divider`}
        style={{ background: '#292929' }}
      >
        {/* Drag handle — mobile only */}
        <div className="md:hidden flex justify-center py-2 shrink-0 cursor-grab">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.3)' }} />
        </div>

        {/* Agent list */}
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
          <AgentPanel />
        </div>

        {/* Activity log — h-44 mobile, w-64 tablet, h-64 desktop */}
        <div className="h-44 shrink-0 md:h-auto md:w-64 lg:h-64 lg:w-auto overflow-hidden">
          <LogPanel />
        </div>
      </div>
    </div>
  )
}
