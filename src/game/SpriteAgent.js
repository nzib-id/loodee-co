import { Assets, Texture, Rectangle, AnimatedSprite, Container, Text, TextStyle } from 'pixi.js'

export const SPRITE_FRAME_SIZE = 100

export const ANIMATIONS = {
  Idle: 6,
  Walk: 8,
  Attack01: 6,
  Attack02: 6,
  Attack03: 9,
  Death: 4,
  Hurt: 4,
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
    anim.anchor.set(0.5, 1)
    anim.scale.set(this.scale)
    anim.play()

    this.currentAnim = anim
    this.container.addChildAt(anim, 0)
  }

  _addNameLabel() {
    const style = new TextStyle({
      fontFamily: 'Courier New',
      fontSize: 10,
      fill: '#7c6af7',
      letterSpacing: 1,
    })
    const label = new Text({ text: this.name, style })
    label.anchor.set(0.5, 0)
    label.y = 4
    this.container.addChild(label)
  }

  setPosition(x, y) {
    this.container.x = x
    this.container.y = y
  }

  destroy() {
    this.currentAnim?.stop()
    this.container.destroy({ children: true })
  }
}
