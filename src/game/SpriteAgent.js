import { Assets, Texture, Rectangle, AnimatedSprite, Container, Text, TextStyle, Circle, Graphics } from 'pixi.js'

export const SPRITE_FRAME_SIZE = 32

export const ANIMATIONS = {
  Idle: 7,
  Walk: 4,
  Drag: 2,
  Fall: 1,
}

export class SpriteAgent {
  constructor({ name, spritePaths, scale = 3, animationSpeed = 0.12 }) {
    this.name = name
    this.spritePaths = spritePaths // { Idle: url, Walk: url, ... }
    this.scale = scale
    this.animationSpeed = animationSpeed

    this.container = new Container()
    this.currentAnim = null
    this.textures = {}
    this.loaded = false
  }

  async load() {
    const entries = Object.entries(this.spritePaths)
    await Promise.all(
      entries.map(async ([animName, url]) => {
        const baseTexture = await Assets.load(url)
        // Nearest-neighbor — crisp pixel art, no blurring
        baseTexture.source.scaleMode = 'nearest'
        const frameCount = ANIMATIONS[animName] ?? 1
        const frames = []
        for (let i = 0; i < frameCount; i++) {
          frames.push(
            new Texture({
              source: baseTexture.source,
              frame: new Rectangle(i * SPRITE_FRAME_SIZE, 0, SPRITE_FRAME_SIZE, SPRITE_FRAME_SIZE),
            })
          )
        }
        this.textures[animName] = frames
      })
    )
    this.loaded = true
    this.playAnim('Idle')
    this._addNameLabel()
  }

  playAnim(animName) {
    if (!this.textures[animName]) return

    if (this.currentAnim) {
      this.currentAnim.stop()
      this.container.removeChild(this.currentAnim)
    }

    const anim = new AnimatedSprite(this.textures[animName])
    anim.animationSpeed = this.animationSpeed
    anim.loop = animName !== 'Death'
    // anchor center-top, offset Y so feet (pixel 56/100) align to container origin
    anim.anchor.set(0.5, 0)
    anim.scale.set(this.scale)
    // feet at bottom of 32px frame
    anim.y = -26 * this.scale
    anim.play()

    this.currentAnim = anim
    this.container.addChildAt(anim, 0)
  }

  _addNameLabel() {
    const style = new TextStyle({
      fontFamily: 'heading-font, Courier New, monospace',
      fontSize: 14,
      fontWeight: 'normal',
      fill: '#ffffff',
      letterSpacing: 2,
      stroke: { color: '#000000', width: 3 },
    })
    const label = new Text({ text: this.name, style })
    label.anchor.set(0.5, 1)  // anchor bottom-center
    // Head is at ~(56-39)*scale = 17*scale above container origin
    label.y = -32 * this.scale - 4  // just above head
    this.nameLabel = label
    this.container.addChild(label)
  }

  enableDrag(app, floorY) {
    this.isDragging = false
    this._floorY = floorY
    this._fallTicker = null
    this._squashTicker = null
    this.container.eventMode = 'static'
    this.container.cursor = 'grab'
    // Hit area centered on sprite body (offset up since sprite is drawn above container origin)
    const spriteH = SPRITE_FRAME_SIZE * this.scale
    const spriteW = SPRITE_FRAME_SIZE * this.scale
    // Hitbox: narrow width (~half frame), full sprite height
    const hitW = SPRITE_FRAME_SIZE * this.scale * 0.35
    const topY = -26 * this.scale
    const totalH = SPRITE_FRAME_SIZE * this.scale * 0.7
    this.container.hitArea = new Rectangle(-hitW / 2, topY, hitW, totalH)



    let dragOffsetX = 0
    let dragOffsetY = 0

    const cancelFall = () => {
      if (this._fallTicker) { app.ticker.remove(this._fallTicker); this._fallTicker = null }
      if (this._squashTicker) { app.ticker.remove(this._squashTicker); this._squashTicker = null }
      if (this._inertiaTicker) { app.ticker.remove(this._inertiaTicker); this._inertiaTicker = null }
    }

    const startSquash = () => {
      const flipSign = Math.sign(this.container.scale.x) || 1
      this.container.scale.set(1.1 * flipSign, 0.85)
      const t0 = performance.now()
      this._squashTicker = () => {
        const t = Math.min(1, (performance.now() - t0) / 200)
        this.container.scale.set((1.1 + (1 - 1.1) * t) * flipSign, 0.85 + (1 - 0.85) * t)
        if (t >= 1) {
          app.ticker.remove(this._squashTicker)
          this._squashTicker = null
          this.container.scale.set(flipSign, 1)
        }
      }
      app.ticker.add(this._squashTicker)
    }

    app.stage.eventMode = 'static'

    let targetX = 0
    let targetY = 0
    let velX = 0
    let velY = 0
    const LERP = 0.13       // lower = more lag/inertia
    const FRICTION = 0.65   // velocity decay each frame

    const onMove = (e) => {
      const pos = e.getLocalPosition(app.stage)
      targetX = pos.x + dragOffsetX
      targetY = Math.min(floorY, pos.y + dragOffsetY)
    }

    // Inertia ticker — runs while dragging, smoothly chases target
    this._inertiaTicker = null
    const startInertiaTicker = () => {
      if (this._inertiaTicker) return
      this._inertiaTicker = () => {
        if (!this.isDragging) return
        const dx = targetX - this.container.x
        const dy = targetY - this.container.y
        velX = velX * FRICTION + dx * LERP
        velY = velY * FRICTION + dy * LERP
        this.container.x += velX
        this.container.y = Math.min(floorY, this.container.y + velY)
      }
      app.ticker.add(this._inertiaTicker)
    }

    const stopDrag = () => {
      if (!this.isDragging) return
      this.isDragging = false
      this.container.cursor = 'grab'
      app.stage.off('pointermove', onMove)
      app.stage.off('pointerup', stopDrag)
      app.stage.off('pointerupoutside', stopDrag)
      // Stop inertia ticker
      if (this._inertiaTicker) { app.ticker.remove(this._inertiaTicker); this._inertiaTicker = null }

      // Carry over velocity from inertia into fall
      let vy = velY
      let vx = velX
      velX = 0; velY = 0

      this.playAnim('Fall')
      this._fallTicker = () => {
        vy += 0.6
        vx *= 0.92
        this.container.x += vx
        this.container.y = Math.min(floorY, this.container.y + vy)
        const hw = 16 * this.scale
        if (this.container.x < hw) { this.container.x = hw; vx = Math.abs(vx) * 0.4 }
        if (this.container.x > app.screen.width - hw) { this.container.x = app.screen.width - hw; vx = -Math.abs(vx) * 0.4 }
        if (this.container.y >= floorY) {
          this.container.y = floorY
          app.ticker.remove(this._fallTicker)
          this._fallTicker = null
          this.playAnim('Walk')
          startSquash()
        }
      }
      app.ticker.add(this._fallTicker)
    }

    this.container.on('pointerdown', (e) => {
      cancelFall()
      this.isDragging = true
      this.container.cursor = 'grabbing'
      const pos = e.getLocalPosition(app.stage)
      dragOffsetX = this.container.x - pos.x
      dragOffsetY = this.container.y - pos.y
      this.playAnim('Drag')
      targetX = this.container.x
      targetY = this.container.y
      velX = 0; velY = 0
      startInertiaTicker()
      // Attach move/up listeners only while dragging
      app.stage.on('pointermove', onMove)
      app.stage.on('pointerup', stopDrag)
      app.stage.on('pointerupoutside', stopDrag)
      e.stopPropagation()
    })
  }

  setPosition(x, y) {
    this.container.x = x
    this.container.y = y
  }

  setFlip(flipped) {
    const s = Math.abs(this.container.scale.x)
    this.container.scale.x = flipped ? -s : s
    // Counter-flip the label so text stays readable
    if (this.nameLabel) {
      this.nameLabel.scale.x = flipped ? -1 : 1
    }
  }

  destroy() {
    this.currentAnim?.stop()
    this.container.destroy({ children: true })
  }
}
