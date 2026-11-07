'use client'

import { useEffect, useState } from 'react'

/** UTC time from the viewer's system clock (no external API). */
function getUtcTime() {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: 'UTC',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function UTCClock() {
  const [time, setTime] = useState<string | null>(null)

  useEffect(() => {
    const refresh = () => setTime(getUtcTime())
    refresh()
    const id = window.setInterval(refresh, 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div
      role="timer"
      aria-label={time ? `UTC time ${time}` : 'UTC clock loading'}
      className="glass pointer-events-auto inline-flex h-10 items-center gap-2.5 rounded-full border border-white/15 bg-black/40 px-4 font-mono text-xs text-foreground shadow-sm backdrop-blur-md"
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-foreground/75" />
      <span className="text-muted-foreground">UTC</span>
      <span className="min-w-[68px] text-center tabular-nums">{time ?? '--:--:--'}</span>
    </div>
  )
}
