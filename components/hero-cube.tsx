'use client'

import { useEffect, useRef, useState } from 'react'

type Props = { logo: string; label: string }
export function HeroCube({ logo, label }: Props) {
  const cube = useRef<HTMLDivElement>(null)
  const scene = useRef<HTMLDivElement>(null)
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    setEnabled(fine.matches && !reduced.matches)
  }, [])
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled || !scene.current || !cube.current) return
    const r = scene.current.getBoundingClientRect()
    const nx = Math.max(-1, Math.min(1, (e.clientX - r.left) / r.width * 2 - 1))
    const ny = Math.max(-1, Math.min(1, (e.clientY - r.top) / r.height * 2 - 1))
    cube.current.style.transform = `rotateX(${-ny * 14}deg) rotateY(${nx * 17}deg)`
  }
  const onLeave = () => { if (cube.current) cube.current.style.transform = 'rotateX(0deg) rotateY(0deg)' }
  return (
    <div ref={scene} className="spy-cube-scene relative flex h-64 w-full items-center justify-center" onPointerMove={onMove} onPointerLeave={onLeave} aria-label={`${label} interactive 3D logo`}>
      <div ref={cube} className="spy-cube" role="img" aria-label={label}>
        <div className="spy-cube-face spy-cube-front"><img src={logo} alt="" draggable={false} /></div>
        <div className="spy-cube-face spy-cube-side" />
        <div className="spy-cube-face spy-cube-top" />
      </div>
    </div>
  )
}
