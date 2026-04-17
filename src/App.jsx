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
    <span id="hq-clock" className="text-xs text-zinc-600 tabular-nums" />
  )
}

export default function App() {
  useEffect(() => {
    initSocket()
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-dungeon-bg">
      {/* Left — Pixi.js game canvas */}
      <div className="relative flex-1 min-w-0 overflow-hidden scanline-overlay">
        {/* Corner HUD */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 pointer-events-none">
          <div className="px-2 py-1 bg-black/60 border border-dungeon-border rounded text-[10px] text-loodee tracking-widest font-mono">
            LOODEE CO. HQ
          </div>
          <LiveClock />
        </div>

        {/* Coordinate display bottom-left */}
        <div className="absolute bottom-3 left-3 z-10 pointer-events-none">
          <span className="text-[10px] text-zinc-700 font-mono">MAP: DUNGEON_01 — SECTOR 4</span>
        </div>

        <PixiApp className="w-full h-full" />
      </div>

      {/* Right — UI panels */}
      <div
        className="w-72 shrink-0 flex flex-col border-l border-dungeon-border bg-dungeon-panel overflow-hidden"
      >
        {/* Agent list — takes upper 2/3 */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <AgentPanel />
        </div>

        {/* Activity log — takes lower 1/3 */}
        <div className="h-64 shrink-0 overflow-hidden">
          <LogPanel />
        </div>
      </div>
    </div>
  )
}
