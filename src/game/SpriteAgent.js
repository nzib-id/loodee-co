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
    // anchor center-top, offset Y so feet (pixel 56/100) align to container origin
    anim.anchor.set(0.5, 0)
    anim.scale.set(this.scale)
    // feet are at pixel row 56 out of 100 → offset sprite up so feet = y:0 in container
    anim.y = -56 * this.scale
    anim.play()

    this.currentAnim = anim
    this.container.addChildAt(anim, 0)
  }

  _addNameLabel() {
    const style = new TextStyle({
      fontFamily: 'Courier New',
      fontSize: 16,
      fontWeight: 'bold',
      fill: '#ffffff',
      letterSpacing: 1,
      stroke: { color: '#000000', width: 3 },
    })
    const label = new Text({ text: this.name, style })
    label.anchor.set(0.5, 1)  // anchor bottom-center
    // Head is at ~(56-39)*scale = 17*scale above container origin
    label.y = -17 * this.scale - 8  // just above head
    this.nameLabel = label
    this.container.addChild(label)
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
