import { motionReduced, subscribeMotion } from '@/lib/motion'
import { useEffect, useRef, type RefObject } from 'react'
import { cn } from '@/lib/utils'
import { clamp, greetingOpacity } from '@/lib/animation'

export interface ParticleTypographyProps {
  lines?: readonly [string, string]
  colors?: readonly [string, string]
  className?: string
  progressRef?: RefObject<number>
  interactionRef?: RefObject<boolean>
}
const DEFAULT_LINES = ['Heyyyyy', 'Teddyyyyyyyyyy! ♡'] as const
const DEFAULT_COLORS = ['#F7E8DF', '#E9AFC8'] as const

/** Glyph-sampled dots with local tangential forces and deterministic spring return. */
export function ParticleTypography({ lines = DEFAULT_LINES, colors = DEFAULT_COLORS, className, progressRef, interactionRef }: ParticleTypographyProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [first, second] = lines
  const [ivory, rose] = colors

  useEffect(() => {
    const container = containerRef.current!
    const canvas = canvasRef.current!
    const reduced=matchMedia('(prefers-reduced-motion: reduce)')
    const ctx = canvas.getContext('2d')
    if (!ctx) { container.classList.add('particle-unavailable'); return }
    const fine = matchMedia('(any-hover: hover) and (any-pointer: fine)')
    // x, y, originX, originY, velocityX, velocityY, colorIndex.
    let dots = new Float32Array(0)
    let width = 0, height = 0, radius = 100, dotRadius = .85
    let bounds = container.getBoundingClientRect()
    let mouseX = -1000, mouseY = -1000, pointerInside = false
    let raf = 0, previousTime = 0, disposed = false, visible = true
    const motionState = (state: string) => { if (canvas.dataset.motionState !== state) canvas.dataset.motionState = state }
    const enabled = () => fine.matches && !motionReduced(reduced.matches) && !document.hidden
    const signalInteraction = (active: boolean) => {
      if (!interactionRef || interactionRef.current === active) return
      interactionRef.current = active
      window.dispatchEvent(new Event('teddy:progress'))
    }
    const reset = () => {
      for (let i = 0; i < dots.length; i += 7) {
        dots[i] = dots[i + 2]; dots[i + 1] = dots[i + 3]
        dots[i + 4] = 0; dots[i + 5] = 0
      }
    }
    const paint = () => {
      ctx.clearRect(0, 0, width, height)
      for (let color = 0; color < 2; color++) {
        ctx.beginPath()
        for (let i = 0; i < dots.length; i += 7) {
          if (dots[i + 6] !== color) continue
          ctx.moveTo(dots[i] + dotRadius, dots[i + 1])
          ctx.arc(dots[i], dots[i + 1], dotRadius, 0, Math.PI * 2)
        }
        ctx.fillStyle = color ? rose : ivory
        ctx.fill()
      }
    }
    const draw = (time: number) => {
      raf = 0
      if (disposed || !visible || !enabled()) { previousTime = 0; return }
      const dt = clamp((previousTime ? time - previousTime : 1000 / 60) / (1000 / 60), .25, 2)
      previousTime = time
      const friction = Math.pow(.84, dt)
      let moving = false, affected = false
      for (let i = 0; i < dots.length; i += 7) {
        let x = dots[i], y = dots[i + 1], vx = dots[i + 4], vy = dots[i + 5]
        const ox = dots[i + 2], oy = dots[i + 3]
        const dx = x - mouseX, dy = y - mouseY
        const distance = Math.hypot(dx, dy)
        // A fixed local field keeps distant letters intact, even after dragging.
        const originDistance = Math.hypot(ox - mouseX, oy - mouseY)
        if (pointerInside && distance < radius && originDistance < radius * 1.2) {
          const falloff = (1 - distance / radius) ** 2
          const nx = distance > .001 ? dx / distance : 1
          const ny = distance > .001 ? dy / distance : 0
          // Radial opening plus tangential acceleration creates the circular vortex.
          vx += (nx * .9 - ny * 2.8) * falloff * dt
          vy += (ny * .9 + nx * 2.8) * falloff * dt
          affected = true
        }
        vx = (vx + (ox - x) * .027 * dt) * friction
        vy = (vy + (oy - y) * .027 * dt) * friction
        x += vx * dt; y += vy * dt
        const displacement = Math.hypot(x - ox, y - oy)
        if (displacement > radius) {
          x = ox + (x - ox) * radius / displacement
          y = oy + (y - oy) * radius / displacement
          vx *= .5; vy *= .5
        }
        if (!pointerInside && displacement < .08 && Math.abs(vx) + Math.abs(vy) < .03) {
          x = ox; y = oy; vx = 0; vy = 0
        }
        if (Math.abs(x - ox) + Math.abs(y - oy) + Math.abs(vx) + Math.abs(vy) > .01) moving = true
        dots[i] = x; dots[i + 1] = y; dots[i + 4] = vx; dots[i + 5] = vy
      }
      if (!moving && !affected) reset()
      motionState(affected ? 'vortex' : moving ? 'returning' : 'rest')
      paint()
      if (moving || affected) raf = requestAnimationFrame(draw)
      else previousTime = 0
    }
    const wake = () => { if (!disposed && !raf && visible && enabled()) raf = requestAnimationFrame(draw) }
    const build = () => {
      if (disposed) return
      bounds = container.getBoundingClientRect()
      width = bounds.width; height = bounds.height
      const dpr = Math.max(1, devicePixelRatio || 1)
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const mask = document.createElement('canvas')
      // Sample in CSS pixels so the density is consistent across DPR changes.
      mask.width = Math.ceil(width); mask.height = Math.ceil(height)
      const sample = mask.getContext('2d', { willReadFrequently: true })!
      const points: number[] = []
      const grid = width < 380 ? 2.3 : 3
      dotRadius = width < 380 ? .65 : .85
      radius = Math.min(115, Math.max(65, width * .22))
      const lineText = [first, second]
      for (let line = 0; line < 2; line++) {
        sample.clearRect(0, 0, mask.width, mask.height)
        let size = Math.min(line ? 64 : 92, width * (line ? .13 : .19))
        sample.font = `600 ${size}px Georgia, 'Times New Roman', serif`
        const textWidth = sample.measureText(lineText[line]).width
        size *= Math.min(1, (width - 48) / textWidth)
        sample.font = `600 ${size}px Georgia, 'Times New Roman', serif`
        sample.textAlign = 'center'; sample.textBaseline = 'middle'; sample.fillStyle = '#fff'
        sample.fillText(lineText[line], width / 2, height * (line ? .64 : .30))
        const pixels = sample.getImageData(0, 0, mask.width, mask.height).data
        for (let y = 0; y < mask.height; y += grid) {
          for (let x = 0; x < mask.width; x += grid) {
            if (pixels[(Math.floor(y) * mask.width + Math.floor(x)) * 4 + 3] > 115) points.push(x, y, x, y, 0, 0, line)
          }
        }
      }
      dots = new Float32Array(points)
      motionState('rest')
      canvas.dataset.particleCount = String(dots.length / 7)
      canvas.dataset.motion = motionReduced(reduced.matches) || !fine.matches ? 'static' : 'full'
      if (visible) paint()
      wake()
    }
    const updateVisibility = () => {
      const opacity = greetingOpacity(progressRef?.current ?? 0)
      container.style.opacity = String(opacity)
      const nextVisible = opacity > 0
      if (visible && !nextVisible) {
        cancelAnimationFrame(raf); raf = 0; previousTime = 0
        pointerInside = false; reset()
        motionState('hidden')
        ctx.clearRect(0, 0, width, height)
        signalInteraction(false)
      }
      const returning = !visible && nextVisible
      visible = nextVisible
      if (returning) { paint(); wake() }
      container.inert = !visible
      if (!visible) signalInteraction(false)
    }
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || !visible || !enabled()) return
      mouseX = event.clientX - bounds.left; mouseY = event.clientY - bounds.top
      pointerInside = mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height
      signalInteraction(pointerInside)
      wake()
    }
    const leave = () => { pointerInside = false; signalInteraction(false); wake() }
    const preference = () => {
      cancelAnimationFrame(raf); raf = 0; previousTime = 0
      leave(); reset(); ctx.clearRect(0, 0, width, height)
      canvas.dataset.motion = motionReduced(reduced.matches) || !fine.matches ? 'static' : 'full'
      motionState(visible ? 'rest' : 'hidden')
      if (visible) paint()
      wake()
    }
    const resize = () => { leave(); build() }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    let dprQuery: MediaQueryList
    const dprChange = () => { resize(); watchDpr() }
    const watchDpr = () => {
      dprQuery?.removeEventListener('change', dprChange)
      dprQuery = matchMedia(`(resolution: ${devicePixelRatio}dppx)`)
      dprQuery.addEventListener('change', dprChange)
    }
    build(); updateVisibility(); watchDpr()
    void document.fonts.ready.then(() => { if (!disposed) build() })
    window.addEventListener('pointermove', move, { passive: true })
    document.documentElement.addEventListener('pointerleave', leave)
    window.addEventListener('blur', leave)
    window.addEventListener('resize', resize, { passive: true })
    window.addEventListener('teddy:progress', updateVisibility)
    document.addEventListener('visibilitychange', preference)
    fine.addEventListener('change', preference)
    const unsubscribeMotion = subscribeMotion(preference)
    return () => {
      disposed = true; cancelAnimationFrame(raf); observer.disconnect()
      window.removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('pointerleave', leave)
      window.removeEventListener('blur', leave)
      window.removeEventListener('resize', resize)
      window.removeEventListener('teddy:progress', updateVisibility)
      document.removeEventListener('visibilitychange', preference)
      fine.removeEventListener('change', preference)
      unsubscribeMotion()
      dprQuery?.removeEventListener('change', dprChange)
      signalInteraction(false)
      dots = new Float32Array(0)
      canvas.width = 0; canvas.height = 0
    }
  }, [first, second, ivory, rose, progressRef, interactionRef])

  return <div ref={containerRef} className={cn('particle-greeting', className)} data-testid="particle-typography">
    <h1 className="particle-fallback"><span style={{color: ivory}}>{first}</span><span style={{color: rose}}>{second}</span></h1>
    <canvas ref={canvasRef} className="particle-canvas" aria-hidden="true" data-testid="particle-canvas" />
  </div>
}
