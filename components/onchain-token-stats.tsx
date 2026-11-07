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
function usd(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value < 0) return '—'
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
}

export function OnchainTokenStats() {
  const { token, api } = useConfig()
  const { ethUsd } = useEthUsd()
  // Share the Live Tokens SWR cache/key to display the identical MC formula.
  const { data: liveTokens } = useSWR<TokenRow[]>(api.tokensUrl || null, async (url: string) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error('Live Tokens unavailable')
    return res.json() as Promise<TokenRow[]>
  }, { dedupingInterval: 15_000, revalidateOnFocus: false, keepPreviousData: true })
  const ca = token.contract?.toLowerCase()
  const matchingToken = ca ? liveTokens?.find((row) => row.address.toLowerCase() === ca) : undefined
  const liveMarketCapUsd = matchingToken && ethUsd != null && Number.isFinite(matchingToken.mcap)
    ? matchingToken.mcap * ethUsd : null
  const { data, error, isLoading } = useSWR<Stats>(
    '/api/onchain-token-stats', fetchStats,
    { refreshInterval: 90_000, revalidateOnFocus: false, dedupingInterval: 30_000, keepPreviousData: true, errorRetryInterval: 10_000, errorRetryCount: 2 },
  )
  // Prefer the same estimate shown on Live Tokens; fall back to the server's
  // on-chain reserve-ratio estimate when the token is not in the indexed list.
  const marketCapUsd = liveMarketCapUsd ?? data?.marketCapUsd ?? null
  // Manual values take priority once supplied in public/config.json.
  // Do not interpret null/empty/invalid values as zero volume or zero liquidity.
  const manualUsd = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
  const manualVolume = manualUsd(token.volume24hUsd)
  const manualLiquidity = manualUsd(token.liquidityUsd)
  const fields = [
    { label: 'MC', value: marketCapUsd, hint: liveMarketCapUsd != null
      ? 'Live Tokens market-cap estimate based on latest indexed trade price and ETH/USD.'
      : 'On-chain bonding-curve reserve-ratio market-cap estimate. May differ from Live Tokens or GMGN.' },
    { label: 'VOLUME', value: manualVolume ?? data?.volume24hUsd, hint: manualVolume != null ? 'Manually entered USD volume in public/config.json. Update to match current GMGN 24h volume.' : 'On-chain Pons 24h curve volume, if accessible.' },
    { label: 'LIQUIDITY', value: manualLiquidity ?? data?.liquidityUsd, hint: manualLiquidity != null ? 'Manually entered USD liquidity in public/config.json. Update when liquidity changes.' : 'On-chain liquidity if independently verified; curve reserve is not the same as pool liquidity.' },
  ]
  const state = isLoading && !data ? 'Loading chain data…'
    : data?.status === 'awaiting_launch' ? 'Awaiting Token Launch'
    : error || data?.status === 'unavailable' ? 'Chain data unavailable'
    : data?.status === 'unsupported' ? 'Token/pool not supported by curve stats'
    : 'Robinhood Chain · Pons curve'
  return (
    <div className="w-full" aria-label="On-chain SpyHooks token statistics">
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {fields.map((item) => (
          <div key={item.label} className="glass min-w-0 rounded-xl px-2 py-3 text-center sm:px-3" title={item.hint}>
            <p className="whitespace-nowrap text-[9px] font-medium tracking-wide text-muted-foreground sm:text-[10px]">{item.label}</p>
            <p className="mt-1 truncate font-mono text-sm font-semibold tabular-nums text-foreground sm:text-base" title={`${usd(item.value)} — ${item.hint}`}>{usd(item.value)}</p>
          </div>
        ))}
      </div>
      {(isLoading || error || data?.status !== 'ok') && (
        <p className="mt-1.5 text-center font-mono text-[9px] text-muted-foreground" aria-live="polite" title={data?.reason ?? undefined}>{state}</p>
      )}

    </div>
  )
}
