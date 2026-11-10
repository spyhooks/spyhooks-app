'use client'

import { useEffect, useState } from 'react'

function getUtcTime(): string {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: 'UTC',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** Compact Badge #07: orange UTC tab, dark live clock. */
export function UTCClock() {
  const [time, setTime] = useState<string | null>(null)

  useEffect(() => {
    const update = () => setTime(getUtcTime())
    update()
    const interval = window.setInterval(update, 1000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <div
      role="timer"
      aria-label={time ? `UTC time ${time}` : 'UTC clock loading'}
      className="pointer-events-auto inline-flex h-10 items-center overflow-hidden rounded-full border border-white/45 bg-[#0b0b0d] font-mono text-white shadow-[0_5px_20px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)]"
    >
      <span
        aria-hidden="true"
        className="relative flex h-full items-center bg-[#ff7a1a] pl-4 pr-5 text-[12px] font-extrabold tracking-[0.08em] text-white"
        style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 9px) 100%, 0 100%)' }}
      >
        UTC
      </span>
      <span className="min-w-[92px] px-3 pr-4 text-center text-[14px] font-bold tracking-[0.04em] tabular-nums sm:text-[15px]">
        {time ?? '--:--:--'}
      </span>
    </div>
  )
}
