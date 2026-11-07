'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useConfig } from '@/components/config-provider'
import { useTokens } from '@/components/use-tokens'
import { formatEth } from '@/lib/tokens'

export function Hero() {
  const { hero, network, siteName, logo } = useConfig()
  const { tokens } = useTokens()

  // These metrics describe only the token rows returned by /api/pons.
  // Progress reaching 100% is not, by itself, proof of a successful migration.
  const belowThreshold = tokens.filter((t) => t.progress < 100).length
  const atFullProgress = tokens.filter((t) => t.progress >= 100).length
  const volume = tokens.reduce((sum, t) => sum + t.volume, 0)

  const stats = [
    { label: 'Tokens tracked', value: tokens.length.toString() },
    { label: 'Below curve threshold', value: belowThreshold.toString() },
    { label: 'At 100% progress', value: atFullProgress.toString() },
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

      <div className="relative mx-auto flex aspect-square w-full max-w-xs items-center justify-center" aria-hidden="true">
        <span className="ripple absolute inset-4 rounded-full border border-primary/50" />
        <span className="ripple absolute inset-4 rounded-full border border-primary/40 [animation-delay:1.6s]" />
        <span className="ripple absolute inset-4 rounded-full border border-primary/30 [animation-delay:3.2s]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" className="relative size-40 rounded-full bg-white p-1 shadow-2xl shadow-primary/40" />
        <span className="sr-only">{siteName}</span>
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
