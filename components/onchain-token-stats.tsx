'use client'

import useSWR from 'swr'
import { useConfig } from '@/components/config-provider'
import { useEthUsd } from '@/components/use-eth-usd'
import type { TokenRow } from '@/lib/tokens'

type Stats = {
  source: string
  status: 'ok' | 'unavailable' | 'awaiting_launch' | 'unsupported'
  reason: string | null
  marketCapUsd: number | null
  volume24hUsd: number | null
  liquidityUsd: number | null
  curveReserveEth: number | null
  updatedAt: string | null
}

async function fetchStats(url: string): Promise<Stats> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Unable to retrieve on-chain token stats')
  return response.json() as Promise<Stats>
}

function usd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 0) return '—'
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
}

export function OnchainTokenStats() {
  const { token, api } = useConfig()
  const { ethUsd } = useEthUsd()
  const ca = token.contract?.trim() ?? ''
  const hasContract = /^0x[a-fA-F0-9]{40}$/.test(ca) && !/^0x0{40}$/i.test(ca)

  // Retain existing Live Tokens MC source and reserve-ratio fallback.
  const { data: liveTokens } = useSWR<TokenRow[]>(api.tokensUrl || null, async (url: string) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error('Live Tokens unavailable')
    return res.json() as Promise<TokenRow[]>
  }, { dedupingInterval: 15_000, revalidateOnFocus: false, keepPreviousData: true })
  const matchingToken = hasContract ? liveTokens?.find(row => row.address.toLowerCase() === ca.toLowerCase()) : undefined
  const liveMarketCapUsd = matchingToken && ethUsd != null && Number.isFinite(matchingToken.mcap)
    ? matchingToken.mcap * ethUsd : null

  const { data, error, isLoading } = useSWR<Stats>(
    hasContract ? '/api/onchain-token-stats' : null, fetchStats,
    { refreshInterval: 90_000, revalidateOnFocus: false, dedupingInterval: 30_000, keepPreviousData: true, errorRetryInterval: 10_000, errorRetryCount: 2 },
  )
  const manualUsd = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
  const fields = [
    { label: 'MC', value: hasContract ? liveMarketCapUsd ?? data?.marketCapUsd : null, hint: 'Estimated market cap from Live Tokens or on-chain curve data.' },
    { label: 'VOLUME', value: hasContract ? manualUsd(token.volume24hUsd) ?? data?.volume24hUsd : null, hint: 'Manual 24h USD volume from config.json, or on-chain volume if available.' },
  ]

  const state = !hasContract ? 'Awaiting Token Launch'
    : isLoading && !data ? 'Loading token statistics…'
    : error || data?.status === 'unavailable' ? 'Chain data unavailable'
    : data?.status === 'unsupported' ? 'Token not supported by curve stats'
    : data?.status === 'awaiting_launch' ? 'Awaiting Token Launch'
    : 'Robinhood Chain'

  return (
    <div className="w-full" aria-label="On-chain SpyHooks token statistics">
      {/* One shared panel, two columns: market cap and volume only. */}
      <div className="grid grid-cols-2 divide-x divide-white/10 rounded-2xl border border-white/15 bg-black/25 py-3">
        {fields.map(item => (
          <div key={item.label} className="min-w-0 px-1 text-center sm:px-2" title={item.hint}>
            <p className="text-[9px] font-medium uppercase tracking-[.1em] text-muted-foreground sm:text-[10px]">{item.label}</p>
            <p className="mt-1 truncate font-mono text-sm font-semibold tabular-nums text-foreground sm:text-base" title={`${usd(item.value)} — ${item.hint}`}>
              {usd(item.value)}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-center gap-2" aria-live="polite">
        <span aria-hidden="true" className={`size-1.5 rounded-full ${!hasContract || error || data?.status === 'unavailable' ? 'bg-neutral-500' : 'bg-neutral-300'}`} />
        <span className="font-mono text-[10px] text-muted-foreground">{state}</span>
      </div>
    </div>
  )
}
