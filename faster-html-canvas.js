const trim = (num, min, max) => Math.min(max, Math.max(min, num))

export class PZcanvas {
  constructor (canvas, shadowWidth, shadowHeight) {
    canvas.width *= window.devicePixelRatio
    canvas.height *= window.devicePixelRatio
    this.width = canvas.width
    this.height = canvas.height
    this.shadowWidth = shadowWidth
    this.shadowHeight = shadowHeight

    this.canvas = canvas
    this.ctx = this.canvas.getContext('2d')

    this.shadowCanvas = document.createElement('canvas')
    this.shadowCanvas.width = shadowWidth
    this.shadowCanvas.height = shadowHeight
    this.shadowCtx = this.shadowCanvas.getContext('2d')

    this.clear()
  }

  clear () {
    const { width, height, shadowWidth, shadowHeight, shadowCtx } = this
    this.drawings = []
    this.scale = 1

    this.refX = Math.round((shadowWidth - width) / 2)
    this.refY = Math.round((shadowHeight - height) / 2)
    this.panX = 0
    this.panY = 0

    this.halfZoom = { zoom: 1 }
    shadowCtx.resetTransform()
    this.update()
  }

  resize () {
    const { canvas, shadowCanvas } = this
    if (canvas.width > shadowCanvas.width) shadowCanvas.width = canvas.width
    if (canvas.height > shadowCanvas.height) shadowCanvas.height = canvas.height
    this.refX = Math.round(this.refX - (canvas.width - this.width) / 2)
    this.refY = Math.round(this.refY - (canvas.height - this.height) / 2)
    this.width = canvas.width
    this.height = canvas.height
    if (this.pan(-1, -1, false) || this.pan(1, 1, false)) return
    this.update()
  }

  addNewDrawing (func) {
    this.drawings.push(func)
  }

  isReady () {
    return this.halfZoom.zoom === 1
  }

  convertPoint (x, y) {
    const { refX, panX, refY, panY, scale } = this
    return { x: (x + refX - panX) / scale, y: (y + refY - panY) / scale }
  }

  update () {
    const { shadowWidth, shadowHeight, shadowCtx, panX, panY, scale } = this
    this.clearZoomTimeout()
    this.halfZoom.zoom = 1
    requestAnimationFrame(() => {
      shadowCtx.save()
      shadowCtx.resetTransform()
      shadowCtx.clearRect(0, 0, shadowWidth, shadowHeight)
      shadowCtx.translate(panX, panY)
      shadowCtx.scale(scale, scale)
      shadowCtx.lineWidth = 1 / scale
      shadowCtx.strokeRect(0, 0, shadowWidth, shadowHeight)
      this.drawings.forEach(draw => draw())
      shadowCtx.restore()
      this.refresh()
    })
  }

  pan (dx, dy, event = true) {
    if (window.devicePixelRatio !== 1 && event) {
      dx *= window.devicePixelRatio
      dy *= window.devicePixelRatio
    }
    const { width, height, shadowWidth, shadowHeight, scale, refX, refY } = this
    dx = trim(dx, this.panX - refX, scale * shadowWidth - (refX + width) + this.panX)
    dy = trim(dy, this.panY - refY, scale * shadowHeight - (refY + height) + this.panY)
    if (Math.abs(dx) < 0.5) dx = 0
    if (Math.abs(dy) < 0.5) dy = 0
    if (!dx && !dy) return
    this.clearZoomTimeout()
    const overX = trim(dx, -refX, shadowWidth - width - refX)
    const overY = trim(dy, -refY, shadowHeight - height - refY)
    this.refX += dx
    this.refY += dy
    if (Math.abs(dx - overX) >= 1 || Math.abs(dy - overY) >= 1) {
      const x = this.refX
      const y = this.refY
      this.refX = (shadowWidth - width) / 2
      this.refY = (shadowHeight - height) / 2

      this.panX -= x - this.refX
      this.panY -= y - this.refY

      this.fixOverFlow()
      this.update()
      return true
    }
    this.halfZoom.rx += dx / this.halfZoom.zoom
    this.halfZoom.ry += dy / this.halfZoom.zoom
    this.refresh()
    if (this.halfZoom.zoom !== 1) this.setZoomTimeout()
  }

  zoom (scale, x, y, event = true) {
    if (window.devicePixelRatio !== 1 && event) {
      x *= window.devicePixelRatio
      y *= window.devicePixelRatio
    }
    const { shadowCtx, width, height, shadowWidth, shadowHeight, halfZoom } = this
    scale = trim(scale, 1 / (this.scale * Math.min(shadowWidth / width, shadowHeight / height)), 20 / this.scale)
    if (scale === 1) return
    this.clearZoomTimeout()
    if (halfZoom.zoom === 1) {
      halfZoom.rx = this.refX + x * (1 - 1 / scale)
      halfZoom.ry = this.refY + y * (1 - 1 / scale)
      halfZoom.zoom = scale
    } else {
      halfZoom.rx += x * (1 - 1 / scale) / halfZoom.zoom
      halfZoom.ry += y * (1 - 1 / scale) / halfZoom.zoom
      halfZoom.zoom *= scale
    }

    if (!this.throttled) {
      this.throttled = true
      setTimeout(() => {
        this.throttled = false
        this.refresh()
      }, 1000 / 60)
    }

    let pt = this.real2canvas(x, y)
    shadowCtx.scale(scale, scale)
    shadowCtx.save()
    const pt2 = this.real2canvas(x, y)
    this.panX -= (pt2.x - pt.x) / this.scale
    this.panY -= (pt2.y - pt.y) / this.scale
    shadowCtx.translate(
      -(pt2.x - pt.x) / this.scale,
      -(pt2.y - pt.y) / this.scale
    )
    this.scale *= scale
    pt = this.real2canvas(x, y)
    this.refX = (shadowWidth - width) / 2
    this.refY = (shadowHeight - height) / 2
    pt = this.real2canvas(x, y)
    shadowCtx.restore()
    this.panX -= (pt2.x - pt.x) / this.scale
    this.panY -= (pt2.y - pt.y) / this.scale
    this.setZoomTimeout()
  }

  setZoomTimeout () {
    this.zoomDebounceTimeout = setTimeout(() => {
      this.zoomDebounceTimeout = null
      this.halfZoom.zoom = 1
      // panning and reversing so the overflow will be fixed
      if (this.pan(1, 1, false) || this.pan(-1, -1, false)) return
      this.update()
    }, 500)
  }

  clearZoomTimeout () {
    if (!this.zoomDebounceTimeout) return
    clearTimeout(this.zoomDebounceTimeout)
    this.zoomDebounceTimeout = null
  }

  fixOverFlow () {
    const { panX, panY } = this
    if (panX > 0) {
      this.refX -= this.panX
      this.panX = 0
    }
    if (panY > 0) {
      this.refY -= this.panY
      this.panY = 0
    }
    if (panX < -this.shadowWidth * (this.scale - 1)) {
      const diff = this.panX + this.shadowWidth * (this.scale - 1)
      this.refX -= diff
      this.panX -= diff
    }
    if (panY < -this.shadowHeight * (this.scale - 1)) {
      const diff = this.panY + this.shadowHeight * (this.scale - 1)
      this.refY -= diff
      this.panY -= diff
    }
  }

  real2canvas (x, y) {
    x += this.refX - this.panX
    y += this.refY - this.panY
    const inv = this.shadowCtx.getTransform()
    return {
      x: inv.a * x + inv.c * y + inv.e,
      y: inv.b * x + inv.d * y + inv.f
    }
  }

  refresh () {
    const { width, height, ctx, shadowCanvas, refX, refY } = this
    const { rx, ry, zoom } = this.halfZoom

    if (zoom < 1 && this.halfZoom.oldZoom === zoom) {
      const dx = -(rx - this.halfZoom.oldRx) * zoom
      const dy = -(ry - this.halfZoom.oldRy) * zoom
      ctx.save()
      ctx.globalCompositeOperation = 'copy'
      ctx.drawImage(this.canvas, dx, dy)
      ctx.restore()
      const w = Math.abs(dx)
      if (dx) {
        const x = dx > 0 ? 0 : (width + dx)
        ctx.drawImage(shadowCanvas, rx + x / zoom, ry, w / zoom, height / zoom, x, 0, w, height)
      }
      if (dy) {
        const x = dx > 0 ? dx : 0
        const y = dy > 0 ? 0 : (height + dy)
        const h = Math.abs(dy)
        ctx.drawImage(shadowCanvas, rx + x / zoom, ry + y / zoom, (width - w) / zoom, h / zoom, x, y, width - w, h)
      }
    } else {
      ctx.save()
      ctx.globalCompositeOperation = 'copy'
      ctx.imageSmoothingEnabled = zoom >= 1
      ctx.drawImage(
        shadowCanvas,
        Math.round(zoom === 1 ? refX : rx),
        Math.round(zoom === 1 ? refY : ry),
        width / zoom, height / zoom,
        0, 0, width, height
      )
      ctx.restore()
    }
    this.halfZoom.oldRx = rx
    this.halfZoom.oldRy = ry
    this.halfZoom.oldZoom = zoom
  }
}
