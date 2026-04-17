import { useEffect, useRef } from 'react'
import { Application, Graphics } from 'pixi.js'
import { SpriteAgent } from './SpriteAgent.js'

// Vite resolves these at build time → hashed URLs in dist
import soldierIdle from '../../assets/sprites/Soldier/Soldier/Soldier-Idle.png'
import soldierWalk from '../../assets/sprites/Soldier/Soldier/Soldier-Walk.png'
import soldierAttack01 from '../../assets/sprites/Soldier/Soldier/Soldier-Attack01.png'
import soldierDeath from '../../assets/sprites/Soldier/Soldier/Soldier-Death.png'
import soldierHurt from '../../assets/sprites/Soldier/Soldier/Soldier-Hurt.png'
import orcIdle from '../../assets/sprites/Orc/Orc/Orc-Idle.png'
import orcWalk from '../../assets/sprites/Orc/Orc/Orc-Walk.png'
import orcDeath from '../../assets/sprites/Orc/Orc/Orc-Death.png'

const TILE = 32
const COLS = 20
const ROWS = 14

function drawDungeon(app) {
  const bg = new Graphics()

  // Floor
  bg.rect(0, 0, app.screen.width, app.screen.height).fill({ color: 0x0d1a0d })

  // Tile grid — subtle darker squares for dungeon floor tiles
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = col * TILE
      const y = row * TILE
      const shade = (col + row) % 2 === 0 ? 0x0f1f0f : 0x0a150a
      bg.rect(x + 1, y + 1, TILE - 2, TILE - 2).fill({ color: shade })
    }
  }

  // Border walls
  bg.rect(0, 0, app.screen.width, 4).fill({ color: 0x1a2e1a })
  bg.rect(0, app.screen.height - 4, app.screen.width, 4).fill({ color: 0x1a2e1a })
  bg.rect(0, 0, 4, app.screen.height).fill({ color: 0x1a2e1a })
  bg.rect(app.screen.width - 4, 0, 4, app.screen.height).fill({ color: 0x1a2e1a })

  // Torches (orange glow spots)
  const torchPositions = [
    [TILE * 2, TILE * 2],
    [TILE * 17, TILE * 2],
    [TILE * 2, TILE * 11],
    [TILE * 17, TILE * 11],
  ]
  for (const [tx, ty] of torchPositions) {
    bg.circle(tx, ty, 24).fill({ color: 0x1a0800, alpha: 0.9 })
    bg.circle(tx, ty, 14).fill({ color: 0x3a1800, alpha: 0.8 })
    bg.circle(tx, ty, 6).fill({ color: 0xf59e0b, alpha: 0.9 })
  }

  app.stage.addChild(bg)
}

export default function PixiApp({ className = '' }) {
  const canvasRef = useRef(null)
  const appRef = useRef(null)
  const agentsRef = useRef([])

  useEffect(() => {
    let cancelled = false

    async function init() {
      if (!canvasRef.current) return
      // Wait one frame so the canvas has real dimensions
      await new Promise(r => requestAnimationFrame(r))
      if (cancelled) return
      const w = canvasRef.current.offsetWidth || 640
      const h = canvasRef.current.offsetHeight || 448
      const app = new Application()
      await app.init({
        canvas: canvasRef.current,
        width: w,
        height: h,
        background: 0x0a0a0f,
        antialias: false,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })

      if (cancelled) {
        app.destroy()
        return
      }

      appRef.current = app
      drawDungeon(app)

      // Loodee — Soldier sprite, center of dungeon
      const loodee = new SpriteAgent({
        name: 'Loodee',
        spritePaths: {
          Idle: soldierIdle,
          Walk: soldierWalk,
          Attack01: soldierAttack01,
          Death: soldierDeath,
          Hurt: soldierHurt,
        },
        scale: 2.8,
        animationSpeed: 0.13,
      })
      await loodee.load()
      loodee.setPosition(app.screen.width / 2, app.screen.height / 2 + 60)
      app.stage.addChild(loodee.container)
      agentsRef.current.push(loodee)

      // Orc — idle enemy in corner
      const orc = new SpriteAgent({
        name: 'Orc',
        spritePaths: {
          Idle: orcIdle,
          Walk: orcWalk,
          Death: orcDeath,
        },
        scale: 2.5,
        animationSpeed: 0.1,
      })
      await orc.load()
      orc.setPosition(app.screen.width * 0.75, app.screen.height * 0.35)
      app.stage.addChild(orc.container)
      agentsRef.current.push(orc)

      // Breathing ambient torch flicker via ticker
      let tick = 0
      app.ticker.add(() => {
        tick += 0.04
        // subtle brightness oscillation could go here
      })
    }

    init().catch(console.error)

    return () => {
      cancelled = true
      agentsRef.current.forEach((a) => a.destroy())
      agentsRef.current = []
      if (appRef.current) {
        appRef.current.destroy(false)
        appRef.current = null
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full block ${className}`}
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
