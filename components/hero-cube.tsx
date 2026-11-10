'use client'

import { useEffect, useRef } from 'react'

type Props = { logo: string; label: string }

/**
 * Follow the pointer across the entire viewport, not just the hero container.
 * No other controls or application logic are affected.
 */
export function HeroCube({ logo, label }: Props) {
  const cube = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = cube.current
    if (!element) return

    const finePointer = window.matchMedia('(pointer: fine)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let active = false
    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0

    const onPointerMove = (event: PointerEvent) => {
      const x = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2
      const y = (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2
      // Adjust these values to strengthen or soften the 3D tilt.
      targetX = -Math.max(-1, Math.min(1, y)) * 5
      targetY = Math.max(-1, Math.min(1, x)) * 15
    }

    const animate = () => {
      if (!active) return
      currentX += (targetX - currentX) * 0.075
      currentY += (targetY - currentY) * 0.075
      element.style.transform = `rotateX(${currentX.toFixed(2)}deg) rotateY(${currentY.toFixed(2)}deg)`
      frame = requestAnimationFrame(animate)
    }

    const sync = () => {
      const shouldAnimate = finePointer.matches && !reducedMotion.matches
      if (shouldAnimate === active) return
      active = shouldAnimate
      if (active) {
        window.addEventListener('pointermove', onPointerMove, { passive: true })
        frame = requestAnimationFrame(animate)
      } else {
        window.removeEventListener('pointermove', onPointerMove)
        cancelAnimationFrame(frame)
        currentX = 0
        currentY = 0
        targetX = 0
        targetY = 0
        element.style.transform = 'rotateX(0deg) rotateY(0deg)'
      }
    }

    sync()
    finePointer.addEventListener('change', sync)
    reducedMotion.addEventListener('change', sync)

    return () => {
      active = false
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onPointerMove)
      finePointer.removeEventListener('change', sync)
      reducedMotion.removeEventListener('change', sync)
    }
  }, [])

  return (
    <div className="spy-cube-scene relative flex h-64 w-full items-center justify-center" aria-label={`${label} interactive 3D logo`}>
      <div ref={cube} className="spy-cube" role="img" aria-label={label}>
        <div className="spy-cube-face spy-cube-front"><img src={logo} alt="" draggable={false} /></div>
        <div className="spy-cube-face spy-cube-side" />
        <div className="spy-cube-face spy-cube-top" />
      </div>
    </div>
  )
}
