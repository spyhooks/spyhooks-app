'use client'

import { useEffect, useRef } from 'react'

/** Pointer-following decorative spotlight; no interaction blocking or app-state changes. */
export function MouseSpotlight() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const finePointer = window.matchMedia('(pointer: fine)')
    if (reduceMotion.matches || !finePointer.matches) return
    let x = window.innerWidth / 2
    let y = window.innerHeight / 3
    let currentX = x
    let currentY = y
    let raf = 0
    let active = true
    const move = (event: PointerEvent) => { x = event.clientX; y = event.clientY }
    const animate = () => {
      if (!active) return
      currentX += (x - currentX) * 0.065
      currentY += (y - currentY) * 0.065
      el.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`
      raf = window.requestAnimationFrame(animate)
    }
    window.addEventListener('pointermove', move, { passive: true })
    raf = window.requestAnimationFrame(animate)
    return () => { active = false; window.cancelAnimationFrame(raf); window.removeEventListener('pointermove', move) }
  }, [])
  return <div ref={ref} aria-hidden="true" className="mouse-spotlight pointer-events-none fixed left-0 top-0 z-0 hidden dark:md:block" />
}
