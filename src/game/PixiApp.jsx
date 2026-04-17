import { useEffect, useRef } from 'react'
import { Application, Assets, Container, Sprite, Texture, Rectangle } from 'pixi.js'
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
const GROUND_ROWS = 7

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

      // Extra frame so browser reflow is done (critical after orientation change)
      await new Promise(r => requestAnimationFrame(r))
      if (!canvasRef.current || cancelled) return
      const w = canvasRef.current.offsetWidth || window.innerWidth || 640
      const h = canvasRef.current.offsetHeight || window.innerHeight || 448

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

      // Mountain background — behind everything
      const mountainTexture = await Assets.load('/assets/mountain.png')
      mountainTexture.source.scaleMode = 'nearest'
      const mountainSprite = new Sprite(mountainTexture)
      const mtScale = app.screen.width / mountainTexture.width
      mountainSprite.scale.set(mtScale)
      mountainSprite.x = 0
      const isMobileLandscape = w > h && Math.min(window.screen.width, window.screen.height) < 768
      const landscapeOffset = isMobileLandscape ? 80 : 0
      // Snap mountain bottom — overlap with ground a bit
      const groundTopY = app.screen.height - GROUND_ROWS * TILE_SIZE
      mountainSprite.y = groundTopY - mountainTexture.height * mtScale + 200 + landscapeOffset
      app.stage.addChild(mountainSprite)

      // Bushes — behind trees
      const bush1Tex = await Assets.load('/assets/bush1.png')
      const bush2Tex = await Assets.load('/assets/bush2.png')
      const bush3Tex = await Assets.load('/assets/bush3.png')
      bush1Tex.source.scaleMode = 'nearest'
      bush2Tex.source.scaleMode = 'nearest'
      bush3Tex.source.scaleMode = 'nearest'
      const BUSH_SCALE = 3
      const bushTextures = [bush1Tex, bush2Tex, bush3Tex]
      const bushGroundY = app.screen.height - GROUND_ROWS * TILE_SIZE + 48
      // Fill full width with bushes, spacing ~40px, random pick from 3 types
      const bushSpacing = 40
      const bushCount = Math.ceil(app.screen.width / bushSpacing) + 1
      for (let i = 0; i < bushCount; i++) {
        const tex = bushTextures[i % bushTextures.length]
        const bushSprite = new Sprite(tex)
        bushSprite.scale.set(BUSH_SCALE)
        bushSprite.anchor.set(0.5, 1)
        bushSprite.x = i * bushSpacing
        bushSprite.y = bushGroundY + landscapeOffset
        app.stage.addChild(bushSprite)
      }

      // Trees — in front of mountain, behind sprites
      const tree1Tex = await Assets.load('/assets/tree1.png')
      const tree2Tex = await Assets.load('/assets/tree2.png')
      tree1Tex.source.scaleMode = 'nearest'
      tree2Tex.source.scaleMode = 'nearest'
      const TREE_SCALE = 2.5
      const treePositions = [
        { x: 0.04, tex: tree1Tex },
        { x: 0.14, tex: tree2Tex },
        { x: 0.30, tex: tree1Tex },
        { x: 0.55, tex: tree2Tex },
        { x: 0.72, tex: tree1Tex },
        { x: 0.88, tex: tree2Tex },
      ]
      const treeGroundY = app.screen.height - GROUND_ROWS * TILE_SIZE + 48
      for (const { x, tex } of treePositions) {
        const treeSprite = new Sprite(tex)
        treeSprite.scale.set(TREE_SCALE)
        treeSprite.anchor.set(0.5, 1)
        treeSprite.x = app.screen.width * x
        treeSprite.y = treeGroundY + landscapeOffset
        app.stage.addChild(treeSprite)
      }

      // Build tilemap: bgLayer (grass) added behind sprites, fgLayer (dirt) added after
      const { groundY, fgLayer } = await buildTilemap(app)

      // floorY = where character feet should touch
      const floorY = groundY + 45 + landscapeOffset
      fgLayer.y += landscapeOffset

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
      const loodeeStartX = app.screen.width * 0.15
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
      const codebotStartX = app.screen.width * 0.55
      codebot.setPosition(codebotStartX, floorY)
      app.stage.addChild(codebot.container)
      agentsRef.current.push(codebot)

      // ResearchBot — Orc
      const researchbot = new SpriteAgent({
        name: 'ResearchBot',
        spritePaths: {
          Idle: orcIdle,
          Walk: orcWalk,
          Attack01: orcAttack01,
          Death: orcDeath,
          Hurt: orcHurt,
        },
        scale: 2.5,
        animationSpeed: 0.09,
      })
      await researchbot.load()
      researchbot.playAnim('Walk')
      const researchbotStartX = app.screen.width * 0.70
      researchbot.setPosition(researchbotStartX, floorY)
      app.stage.addChild(researchbot.container)
      agentsRef.current.push(researchbot)

      // CreativeBot — Orc
      const creativebot = new SpriteAgent({
        name: 'CreativeBot',
        spritePaths: {
          Idle: orcIdle,
          Walk: orcWalk,
          Attack01: orcAttack01,
          Death: orcDeath,
          Hurt: orcHurt,
        },
        scale: 2.5,
        animationSpeed: 0.11,
      })
      await creativebot.load()
      creativebot.playAnim('Walk')
      const creativebotStartX = app.screen.width * 0.85
      creativebot.setPosition(creativebotStartX, floorY)
      app.stage.addChild(creativebot.container)
      agentsRef.current.push(creativebot)

      // Dirt layer on top of sprites — gives depth effect (sprites behind dirt)
      app.stage.addChild(fgLayer)

      // Walk cycle for Loodee
      let loodeeDir = 1
      let posX = loodeeStartX
      const loodeeSpeed = 0.8
      const loodeeMinX = app.screen.width * 0.06
      const loodeeMaxX = app.screen.width * 0.28

      // Walk cycles config
      const walkers = [
        { agent: codebot,     x: codebotStartX,    dir: -1, speed: 0.6,  minX: app.screen.width * 0.45, maxX: app.screen.width * 0.62 },
        { agent: researchbot, x: researchbotStartX, dir:  1, speed: 0.5,  minX: app.screen.width * 0.62, maxX: app.screen.width * 0.78 },
        { agent: creativebot, x: creativebotStartX, dir: -1, speed: 0.7,  minX: app.screen.width * 0.78, maxX: app.screen.width * 0.93 },
      ]

      app.ticker.add(() => {
        // Loodee
        posX += loodeeSpeed * loodeeDir
        if (posX > loodeeMaxX || posX < loodeeMinX) {
          loodeeDir *= -1
          loodee.setFlip(loodeeDir < 0)
        }
        loodee.container.x = posX

        // Other agents
        for (const w of walkers) {
          w.x += w.speed * w.dir
          if (w.x > w.maxX || w.x < w.minX) {
            w.dir *= -1
            w.agent.setFlip(w.dir < 0)
          }
          w.agent.container.x = w.x
        }
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

  // Re-init PixiJS on orientation change (mobile only)
  useEffect(() => {
    const handleOrientationChange = () => {
      setTimeout(() => {
        // Always reinit so canvas gets correct dimensions after rotate
        agentsRef.current.forEach(a => a.destroy())
        agentsRef.current = []
        if (appRef.current) {
          appRef.current.destroy(false)
          appRef.current = null
        }
        window.dispatchEvent(new Event('pixi-reinit'))
      }, 500) // extra delay so browser fully reflows
    }
    window.addEventListener('orientationchange', handleOrientationChange)
    return () => window.removeEventListener('orientationchange', handleOrientationChange)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full block ${className}`}
      style={{ imageRendering: 'pixelated' }}
    />
  )
}


