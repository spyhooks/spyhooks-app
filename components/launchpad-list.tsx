'use client'

import { ExternalLink } from 'lucide-react'
import useSWR from 'swr'
import { useConfig } from '@/components/config-provider'
import { useTokens } from '@/components/use-tokens'
import { formatEth } from '@/lib/tokens'

export function LaunchpadList() {
  const { launchpads, network, stats } = useConfig()
  const { tokens } = useTokens()
  const { data: launchStats } = useSWR<{ totalLaunch: number | null }>(
    '/api/launch-stats', async (url: string) => {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error('Launch history unavailable')
      return res.json()
    }, { refreshInterval: 15000, keepPreviousData: true },
  )

  return (
    <ul className="mt-8 grid gap-4 md:grid-cols-2">
      {launchpads.map((pad) => {
        const own = tokens.filter((t) => t.launchpad === pad.name)
        const volume = own.reduce((sum, t) => sum + t.volume, 0)
        const startBlock = stats?.launchStartBlock
        const startAt = stats?.launchStartAt ? Date.parse(stats.launchStartAt) : NaN
        const hasStart = typeof startBlock === 'number' || Number.isFinite(startAt)
        const totalLaunch = hasStart ? own.filter(t =>
          typeof startBlock === 'number' ? typeof t.launchBlock === 'number' && t.launchBlock >= startBlock
          : Date.now() - t.ageMinutes * 60_000 >= startAt
        ).length : null
        const onCurve = own.filter(t => t.status === 'curve').length
        return (
          <li key={pad.name} className="glass flex flex-col gap-5 rounded-3xl p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-[#161616] text-foreground">
                {pad.logo?.startsWith('/') || pad.logo?.startsWith('https://') ? <img src={pad.logo} alt={`${pad.name} logo`} className="size-full object-contain" /> : <span className="text-sm font-black lowercase">{pad.name}</span>}
              </span>
              <div>
                <h2 className="text-xl font-semibold">{pad.name}</h2>
                <p className="text-sm text-muted-foreground">{pad.chain}</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{pad.description}</p>
            <dl className="grid grid-cols-3 gap-3 border-t border-border pt-4 font-mono text-sm">
              <div>
                <dt className="font-sans text-[10px] uppercase tracking-wider text-muted-foreground">Total Launch</dt>
                <dd className="text-lg">{pad.name.toLowerCase() === 'pons' ? (launchStats?.totalLaunch ?? totalLaunch ?? '—') : (totalLaunch ?? '—')}</dd>
              </div>
              <div>
                <dt className="font-sans text-[10px] uppercase tracking-wider text-muted-foreground">On Curve</dt>
                <dd className="text-lg">{onCurve}</dd>
              </div>
              <div>
                <dt className="font-sans text-[10px] uppercase tracking-wider text-muted-foreground">Volume</dt>
                <dd className="text-lg">
                  {formatEth(volume)} {network.currency}
                </dd>
              </div>
            </dl>
            {pad.url && (
              <a href={pad.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                Visit {pad.name} <ExternalLink className="size-3.5" />
              </a>
            )}
          </li>
        )
      })}
    </ul>
  )
}
