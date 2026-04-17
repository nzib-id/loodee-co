import { useEffect, useRef } from 'react'
import { Application, Graphics, Sprite, Texture, Rectangle } from 'pixi.js'
import { SpriteAgent } from './SpriteAgent.js'

import soldierIdle from '../../assets/sprites/Soldier/Soldier/Soldier-Idle.png'
import soldierWalk from '../../assets/sprites/Soldier/Soldier/Soldier-Walk.png'
import soldierAttack01 from '../../assets/sprites/Soldier/Soldier/Soldier-Attack01.png'
import soldierDeath from '../../assets/sprites/Soldier/Soldier/Soldier-Death.png'
import soldierHurt from '../../assets/sprites/Soldier/Soldier/Soldier-Hurt.png'
import orcIdle from '../../assets/sprites/Orc/Orc/Orc-Idle.png'
import orcWalk from '../../assets/sprites/Orc/Orc/Orc-Walk.png'
import orcDeath from '../../assets/sprites/Orc/Orc/Orc-Death.png'
import tilesetSrc from '/assets/tileset.png'

// Tileset config (16x16 tiles, 3 tiles horizontal)
const TILE_SRC_SIZE = 16
const TILE_SCALE = 3           // render each tile at 48x48px
const TILE_SIZE = TILE_SRC_SIZE * TILE_SCALE

// Tile indices in sprite sheet (x offset in source px)
const TILE_DIRT       = 0   // x:0
const TILE_DIRT_GRASS = 16  // x:16
const TILE_GRASS      = 32  // x:32

// Ground layout: how many rows from bottom
const GROUND_ROWS = 5  // total ground rows
// Row 0 from bottom = pure grass top, row 1 = dirt-grass, rows 2+ = dirt

function buildTilemap(app, tilesetTexture) {
  const screenW = app.screen.width
  const screenH = app.screen.height
  const cols = Math.ceil(screenW / TILE_SIZE) + 1

  // Pre-slice tile textures
  const texDirt      = new Texture({ source: tilesetTexture.source, frame: new Rectangle(TILE_DIRT,       0, TILE_SRC_SIZE, TILE_SRC_SIZE) })
  const texDirtGrass = new Texture({ source: tilesetTexture.source, frame: new Rectangle(TILE_DIRT_GRASS, 0, TILE_SRC_SIZE, TILE_SRC_SIZE) })
  const texGrass     = new Texture({ source: tilesetTexture.source, frame: new Rectangle(TILE_GRASS,      0, TILE_SRC_SIZE, TILE_SRC_SIZE) })

  const tilemapContainer = new Graphics()

  // Ground top Y (where grass row starts)
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
      spr.scale.set(TILE_SCALE)
      // disable pixi texture smoothing for pixel art
      spr.texture.source.scaleMode = 'nearest'
      app.stage.addChild(spr)
    }
  }

  return { groundY, tilemapContainer }
}

function drawSky(app) {
  const sky = new Graphics()
  sky.rect(0, 0, app.screen.width, app.screen.height).fill({ color: 0x4d9be6 })
  app.stage.addChildAt(sky, 0)
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

      // Sky background
      drawSky(app)

      // Load tileset
      const tilesetTexture = await Texture.fromURL(tilesetSrc)
      tilesetTexture.source.scaleMode = 'nearest'

      // Build tilemap, get groundY
      const { groundY } = buildTilemap(app, tilesetTexture)

      // Ground line Y for character feet
      const floorY = groundY - 4

      // Loodee — Soldier, stands on ground
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
      // Anchor feet to ground
      const loodeeX = app.screen.width * 0.25
      loodee.setPosition(loodeeX, floorY - loodee.container.height / 2 + 10)
      app.stage.addChild(loodee.container)
      agentsRef.current.push(loodee)

      // Orc — further right, also on ground
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
      const orcX = app.screen.width * 0.65
      orc.setPosition(orcX, floorY - orc.container.height / 2 + 10)
      app.stage.addChild(orc.container)
      agentsRef.current.push(orc)

      // Simple walk cycle for Loodee
      let loodeeDir = 1
      let loodeePos = loodeeX
      const walkSpeed = 0.6
      const walkBound = app.screen.width * 0.45

      loodee.playAnim('Walk')

      app.ticker.add(() => {
        loodeePos += walkSpeed * loodeeDir
        if (loodeePos > walkBound || loodeePos < app.screen.width * 0.08) {
          loodeeDir *= -1
          loodee.container.scale.x = loodeeDir < 0
            ? -Math.abs(loodee.container.scale.x)
            : Math.abs(loodee.container.scale.x)
        }
        loodee.container.x = loodeePos
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
