'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useConfig } from '@/components/config-provider'
import { useTokens } from '@/components/use-tokens'
import { formatEth } from '@/lib/tokens'
import { HeroCube } from '@/components/hero-cube'
import { HeroTokenLinks } from '@/components/hero-token-links'

// Browser persistence keeps confirmed graduated contracts even when the current
// RPC lookback window no longer includes their original launch logs.
// For a reliable count shared across all visitors, configure a verified
// stats.surfacedCount floor or deploy a persistent chain-event indexer.
const SURFACED_STORAGE_PREFIX = 'spyhooks-confirmed-surfaced-v1:'
const VALID_ADDRESS = /^0x[a-f0-9]{40}$/i

export function Hero() {
  const { hero, network, siteName, logo, stats: manualStats, api } = useConfig()
  const { tokens } = useTokens()

  const curve = tokens.filter((t) => t.status === 'curve').length
  const graduating = tokens.filter((t) => t.status === 'graduating').length
  const storageKey = SURFACED_STORAGE_PREFIX + (api.ponsFactory || 'pons').toLowerCase()
  const [savedSurfaced, setSavedSurfaced] = useState<string[]>([])
  const [loadedKey, setLoadedKey] = useState<string | null>(null)

  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]')
      setSavedSurfaced(Array.isArray(parsed) ? parsed.filter((v): v is string =>
        typeof v === 'string' && VALID_ADDRESS.test(v)).map(v => v.toLowerCase()) : [])
    } catch {
      setSavedSurfaced([])
    }
    setLoadedKey(storageKey)
  }, [storageKey])

  useEffect(() => {
    if (loadedKey !== storageKey) return
    const known = new Set(savedSurfaced)
    let changed = false
    for (const row of tokens) {
      if (row.status === 'graduated' && VALID_ADDRESS.test(row.address)) {
        const address = row.address.toLowerCase()
        if (!known.has(address)) {
          known.add(address)
          changed = true
        }
      }
    }
    if (!changed) return
    const next = [...known]
    setSavedSurfaced(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* Storage may be unavailable. */ }
  }, [tokens, savedSurfaced, storageKey, loadedKey])

  const confirmedNow = tokens.filter(t => t.status === 'graduated' && VALID_ADDRESS.test(t.address)).map(t => t.address.toLowerCase())
  const persistedCount = new Set([...(loadedKey === storageKey ? savedSurfaced : []), ...confirmedNow]).size
  const configuredFloor = typeof manualStats?.surfacedCount === 'number' && Number.isSafeInteger(manualStats.surfacedCount) && manualStats.surfacedCount >= 0
    ? manualStats.surfacedCount : 0
  const surfaced = Math.max(persistedCount, configuredFloor)
  const volume = tokens.reduce((sum, t) => sum + t.volume, 0)

  const stats = [
    { label: 'On curve', value: curve.toString() },
    { label: 'Graduating', value: graduating.toString() },
    { label: 'Surfaced', value: surfaced.toString() },
    { label: 'Tracked volume', value: `${formatEth(volume)} ${network.currency}` },
  ]

  return (
    <section className="relative grid items-center gap-10 py-10 lg:grid-cols-[1.4fr_1fr] lg:py-16">
      <div>
        <p className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-xs uppercase tracking-widest text-primary">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          {hero.eyebrow.replace('{dex}', network.dex)}
        </p>
        <h1 className="mt-5 text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          <span className="text-gradient">{hero.title}</span>
        </h1>
        <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">{hero.subtitle}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/swap" className="bg-brand inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:brightness-110">
            Start swapping <ArrowRight className="size-4" />
          </Link>
          <Link href="/docs" className="glass inline-flex h-11 items-center rounded-full px-6 text-sm font-semibold transition hover:text-primary">
            How it works
          </Link>
        </div>
      </div>

      <div className="relative mx-auto flex w-full max-w-sm flex-col items-center justify-center gap-2">
        <HeroCube logo={logo} label={siteName} />
        <HeroTokenLinks />
      </div>

      <dl className="glass col-span-full grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-3xl lg:grid-cols-4 lg:divide-y-0">
        {stats.map((s) => (
          <div key={s.label} className="px-5 py-4">
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</dt>
            <dd className="mt-1 font-mono text-2xl font-medium">{s.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
