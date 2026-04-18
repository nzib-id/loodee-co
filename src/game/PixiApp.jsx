import { useEffect, useRef } from 'react'
import { Application, Assets, Container, Sprite, Texture, Rectangle } from 'pixi.js'
import { SpriteAgent } from './SpriteAgent.js'

import charIdle from '../../assets/sprites/Character/character-idle.png'
import charWalk from '../../assets/sprites/Character/character-walk.png'
import charDrag from '../../assets/sprites/Character/character-drag.png'
import charFall from '../../assets/sprites/Character/character-fall.png'

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
  fgLayer.eventMode = 'none' // don't block pointer events to sprites below
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
  const zoomRef = useRef({ scale: 1, x: 0, y: 0, pinchDist: null })

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
      // Snap mountain so bottom edge sits on top of grass row
      const groundTopY = app.screen.height - GROUND_ROWS * TILE_SIZE
      const mtH = mountainTexture.height * mtScale
      mountainSprite.y = groundTopY - mtH + 60 + landscapeOffset
      app.stage.addChild(mountainSprite)

      // Bushes — behind trees
      const bush1Tex = await Assets.load('/assets/bush1.png')
      const bush2Tex = await Assets.load('/assets/bush2.png')
      const bush3Tex = await Assets.load('/assets/bush3.png')
      bush1Tex.source.scaleMode = 'nearest'
      bush2Tex.source.scaleMode = 'nearest'
      bush3Tex.source.scaleMode = 'nearest'
      const BUSH_SCALE = 5
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
      const TREE_SCALE = 5
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

      const charSprites = { Idle: charIdle, Walk: charWalk, Drag: charDrag, Fall: charFall }

      // Loodee
      const loodee = new SpriteAgent({
        name: 'Loodee',
        spritePaths: charSprites,
        scale: 4,
        animationSpeed: 0.13,
      })
      await loodee.load()
      loodee.enableDrag(app, floorY)
      loodee.playAnim('Walk')
      const loodeeStartX = app.screen.width * 0.15
      loodee.setPosition(loodeeStartX, floorY)
      app.stage.addChild(loodee.container)
      agentsRef.current.push(loodee)

      // CodeBot
      const codebot = new SpriteAgent({
        name: 'Kobo',
        spritePaths: charSprites,
        scale: 4,
        animationSpeed: 0.1,
      })
      await codebot.load()
      codebot.enableDrag(app, floorY)
      codebot.playAnim('Walk')
      const codebotStartX = app.screen.width * 0.55
      codebot.setPosition(codebotStartX, floorY)
      app.stage.addChild(codebot.container)
      agentsRef.current.push(codebot)

      // ResearchBot
      const researchbot = new SpriteAgent({
        name: 'Rebo',
        spritePaths: charSprites,
        scale: 4,
        animationSpeed: 0.09,
      })
      await researchbot.load()
      researchbot.enableDrag(app, floorY)
      researchbot.playAnim('Walk')
      const researchbotStartX = app.screen.width * 0.70
      researchbot.setPosition(researchbotStartX, floorY)
      app.stage.addChild(researchbot.container)
      agentsRef.current.push(researchbot)

      // CreativeBot
      const creativebot = new SpriteAgent({
        name: 'Krebo',
        spritePaths: charSprites,
        scale: 4,
        animationSpeed: 0.11,
      })
      await creativebot.load()
      creativebot.enableDrag(app, floorY)
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

      const WALK_MARGIN = 20
      const SCREEN_W = app.screen.width

      // Random target-based walk: each agent picks a random target X, walks to it, pauses, picks new target
      function makeWalker(agent, startX, speed) {
        const pickTarget = (fromX) => {
          const range = SCREEN_W * (0.2 + Math.random() * 0.5) // walk 20-70% of screen
          const dir = Math.random() < 0.5 ? 1 : -1
          const target = Math.min(SCREEN_W - WALK_MARGIN, Math.max(WALK_MARGIN, fromX + dir * range))
          return target
        }
        return {
          agent,
          x: startX,
          speed,
          target: pickTarget(startX),
          pauseFrames: 0,
          pickTarget,
        }
      }

      const walkerLoodee   = makeWalker(loodee,      loodeeStartX,      0.8)
      const walkerCodebot  = makeWalker(codebot,     codebotStartX,     0.6)
      const walkerResearch = makeWalker(researchbot, researchbotStartX, 0.5)
      const walkerCreative = makeWalker(creativebot, creativebotStartX, 0.7)
      const allWalkers = [walkerLoodee, walkerCodebot, walkerResearch, walkerCreative]

      function tickWalker(w) {
        if (w.agent.isDragging || w.agent._fallTicker) {
          // Sync position after drag/fall, pick new target from drop point
          w.x = w.agent.container.x
          w.target = w.pickTarget(w.x)
          w.pauseFrames = 0
          return
        }

        if (w.pauseFrames > 0) {
          if (!w.pausing) { w.pausing = true; w.agent.playAnim('Idle') }
          w.pauseFrames--
          return
        }
        if (w.pausing) { w.pausing = false; w.agent.playAnim('Walk') }

        const dir = w.target > w.x ? 1 : -1
        w.x += w.speed * dir
        w.agent.setFlip(dir < 0)
        w.agent.container.x = w.x

        // Reached target
        if (Math.abs(w.x - w.target) < w.speed + 1) {
          w.x = w.target
          w.agent.container.x = w.x
          w.pauseFrames = Math.floor(60 + Math.random() * 180)
          w.target = w.pickTarget(w.x)
        }
      }

      app.ticker.add(() => {
        for (const w of allWalkers) tickWalker(w)
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

  // Pinch zoom handler
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const MIN_SCALE = 0.5
    const MAX_SCALE = 3

    function getDist(t1, t2) {
      const dx = t1.clientX - t2.clientX
      const dy = t1.clientY - t2.clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    function onTouchStart(e) {
      if (e.touches.length === 2) {
        zoomRef.current.pinchDist = getDist(e.touches[0], e.touches[1])
      }
    }

    function onTouchMove(e) {
      const app = appRef.current
      if (!app || e.touches.length !== 2) return
      e.preventDefault()

      const newDist = getDist(e.touches[0], e.touches[1])
      const { pinchDist } = zoomRef.current
      if (!pinchDist) return

      const ratio = newDist / pinchDist
      const z = zoomRef.current
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, z.scale * ratio))

      // Zoom toward pinch midpoint
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      const rect = canvas.getBoundingClientRect()
      const cx = midX - rect.left
      const cy = midY - rect.top

      app.stage.x = cx - (cx - app.stage.x) * (newScale / z.scale)
      app.stage.y = cy - (cy - app.stage.y) * (newScale / z.scale)
      app.stage.scale.set(newScale)

      z.scale = newScale
      zoomRef.current.pinchDist = newDist
    }

    function onTouchEnd(e) {
      if (e.touches.length < 2) {
        zoomRef.current.pinchDist = null
      }
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
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


