import { useEffect } from 'react'
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
  useEffect(() => {
    initSocket()
  }, [])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: '#292929' }}>
      {/* Canvas — fixed height on mobile, flex-1 on desktop */}
      <div className="relative h-[280px] lg:flex-1 min-w-0 overflow-hidden scanline-overlay">
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

      {/* Panels — always visible below canvas */}
      <div
        className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden panel-divider"
        style={{ background: '#292929' }}
      >
        {/* Agent list */}
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
          <AgentPanel />
        </div>

        {/* Activity log */}
        <div className="h-44 shrink-0 lg:h-auto lg:w-64 overflow-hidden log-divider">
          <LogPanel />
        </div>
      </div>
    </div>
  )
}
