import { useEffect, useRef } from 'react'
import { Application, Assets, Container, Sprite, Texture, Rectangle, Text, TextStyle, Graphics } from 'pixi.js'
import { SpriteAgent } from './SpriteAgent.js'

import soldierIdle from '../../assets/sprites/Soldier/Soldier/Soldier-Idle.png'
import soldierWalk from '../../assets/sprites/Soldier/Soldier/Soldier-Walk.png'
import soldierAttack01 from '../../assets/sprites/Soldier/Soldier/Soldier-Attack01.png'
import soldierDeath from '../../assets/sprites/Soldier/Soldier/Soldier-Death.png'
import soldierHurt from '../../assets/sprites/Soldier/Soldier/Soldier-Hurt.png'
import orcIdle from '../../assets/sprites/Orc/Orc/Orc-Idle.png'
import orcWalk from '../../assets/sprites/Orc/Orc/Orc-Walk.png'
import orcAttack01 from '../../assets/sprites/Orc/Orc/Orc-Attack01.png'
import orcDeath from '../../assets/sprites/Orc/Orc/Orc-Death.png'
import orcHurt from '../../assets/sprites/Orc/Orc/Orc-Hurt.png'

// Tileset config
const TILE_SRC_SIZE = 16
const TILE_SCALE = 3
const TILE_SIZE = TILE_SRC_SIZE * TILE_SCALE  // 48px per tile
const GROUND_ROWS = 11  // ~50% of screen height (11 * 48px = 528px)

async function buildTilemap(app) {
  const screenW = app.screen.width
  const screenH = app.screen.height
  const cols = Math.ceil(screenW / TILE_SIZE) + 2

  const tilesetTexture = await Assets.load('/assets/tileset-v2.png')
  tilesetTexture.source.scaleMode = 'nearest'

  // Slice tiles from sprite sheet
  const texGrass     = new Texture({ source: tilesetTexture.source, frame: new Rectangle(32, 0, TILE_SRC_SIZE, TILE_SRC_SIZE) })
  const texDirtGrass = new Texture({ source: tilesetTexture.source, frame: new Rectangle(16, 0, TILE_SRC_SIZE, TILE_SRC_SIZE) })
  const texDirt      = new Texture({ source: tilesetTexture.source, frame: new Rectangle(0,  0, TILE_SRC_SIZE, TILE_SRC_SIZE) })

  // Single fg container — all ground tiles render in front of sprites
  const fgLayer = new Container()
  const groundY = screenH - GROUND_ROWS * TILE_SIZE

  for (let row = 0; row < GROUND_ROWS; row++) {
    const y = groundY + row * TILE_SIZE
    for (let col = 0; col < cols; col++) {
      const x = col * TILE_SIZE
      let tex
      if (row === 0) tex = texGrass
      else if (row === 1) tex = texDirtGrass
      else tex = texDirt

      const spr = new Sprite(tex)
      spr.x = x
      spr.y = y
      spr.width = TILE_SIZE
      spr.height = TILE_SIZE

      // All ground rows go in front of sprites
      fgLayer.addChild(spr)
    }
  }

  return { groundY, fgLayer }
}

export default function PixiApp({ className = '' }) {
  const canvasRef = useRef(null)
  const appRef = useRef(null)
  const agentsRef = useRef([])

  useEffect(() => {
    let cancelled = false

    async function init() {
      if (!canvasRef.current) return
      await new Promise(r => requestAnimationFrame(r))
      if (cancelled) return

      // Preload custom fonts so Pixi can use them in canvas
      await document.fonts.load('14px heading-font')

      const w = canvasRef.current.offsetWidth || 640
      const h = canvasRef.current.offsetHeight || 448

      const app = new Application()
      await app.init({
        canvas: canvasRef.current,
        width: w,
        height: h,
        background: 0x4d9be6,
        antialias: false,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })

      if (cancelled) { app.destroy(); return }
      appRef.current = app

      // Build tilemap: bgLayer (grass) added behind sprites, fgLayer (dirt) added after
      const { groundY, fgLayer } = await buildTilemap(app)

      // floorY = where character feet should touch
      const floorY = groundY + 45

      // Loodee — Soldier
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
      loodee.playAnim('Walk')
      const loodeeStartX = app.screen.width * 0.25
      loodee.setPosition(loodeeStartX, floorY)
      app.stage.addChild(loodee.container)
      agentsRef.current.push(loodee)

      // CodeBot — Orc, walks on right side
      const codebot = new SpriteAgent({
        name: 'CodeBot',
        spritePaths: {
          Idle: orcIdle,
          Walk: orcWalk,
          Attack01: orcAttack01,
          Death: orcDeath,
          Hurt: orcHurt,
        },
        scale: 2.5,
        animationSpeed: 0.1,
      })
      await codebot.load()
      codebot.playAnim('Walk')
      const codebotStartX = app.screen.width * 0.65
      codebot.setPosition(codebotStartX, floorY)
      app.stage.addChild(codebot.container)
      agentsRef.current.push(codebot)

      // ResearchBot — floating label agent (no sprite yet)
      const researchLabel = createFloatingAgent(app, 'ResearchBot', '#f59e0b', app.screen.width * 0.35, floorY - 60)
      app.stage.addChild(researchLabel)

      // CreativeBot — floating label agent (no sprite yet)
      const creativeLabel = createFloatingAgent(app, 'CreativeBot', '#f472b6', app.screen.width * 0.50, floorY - 90)
      app.stage.addChild(creativeLabel)

      // Dirt layer on top of sprites — gives depth effect (sprites behind dirt)
      app.stage.addChild(fgLayer)

      // Walk cycle for Loodee
      let loodeeDir = 1
      let posX = loodeeStartX
      const loodeeSpeed = 0.8
      const loodeeMinX = app.screen.width * 0.08
      const loodeeMaxX = app.screen.width * 0.45

      // Walk cycle for CodeBot
      let codebotDir = -1
      let codebotX = codebotStartX
      const codebotSpeed = 0.6
      const codebotMinX = app.screen.width * 0.52
      const codebotMaxX = app.screen.width * 0.88

      app.ticker.add(() => {
        // Loodee
        posX += loodeeSpeed * loodeeDir
        if (posX > loodeeMaxX || posX < loodeeMinX) {
          loodeeDir *= -1
          loodee.setFlip(loodeeDir < 0)
        }
        loodee.container.x = posX

        // CodeBot
        codebotX += codebotSpeed * codebotDir
        if (codebotX > codebotMaxX || codebotX < codebotMinX) {
          codebotDir *= -1
          codebot.setFlip(codebotDir < 0)
        }
        codebot.container.x = codebotX
      })
    }

    init().catch(console.error)

    return () => {
      cancelled = true
      agentsRef.current.forEach(a => a.destroy())
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

// Floating label for agents without a sprite yet
function createFloatingAgent(app, name, color, x, y) {
  const container = new Container()

  // Background pill
  const bg = new Graphics()
  bg.roundRect(-48, -14, 96, 28, 8)
  bg.fill({ color: 0x000000, alpha: 0.55 })
  bg.stroke({ color: color.replace('#', '0x'), width: 1.5, alpha: 0.8 })
  container.addChild(bg)

  // Name label
  const style = new TextStyle({
    fontFamily: 'heading-font, Courier New, monospace',
    fontSize: 11,
    fill: color,
    letterSpacing: 1,
    stroke: { color: '#000000', width: 2 },
  })
  const label = new Text({ text: name, style })
  label.anchor.set(0.5, 0.5)
  container.addChild(label)

  container.x = x
  container.y = y

  // Subtle float animation
  let t = Math.random() * Math.PI * 2
  app.ticker.add(() => {
    t += 0.02
    container.y = y + Math.sin(t) * 4
  })

  return container
}
