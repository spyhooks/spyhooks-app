'use client'

import useSWR from 'swr'
import { useConfig } from '@/components/config-provider'

type PriceResponse = {
  status: 'ok' | 'awaiting_launch' | 'unsupported' | 'unavailable'
  priceUsd: number | null
  updatedAt: string | null
  reason: string | null
}

async function fetchPrice(url: string): Promise<PriceResponse> {
  const result = await fetch(url, { cache: 'no-store' })
  if (!result.ok) throw new Error('Price endpoint unavailable')
  return result.json() as Promise<PriceResponse>
}

function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return '—'
  if (value >= 1) return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
  if (value >= 0.0001) return `$${value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')}`
  if (value >= 0.00000001) return `$${value.toFixed(10).replace(/0+$/, '').replace(/\.$/, '')}`
  return `$${value.toExponential(3)}`
}

export function LiveTokenPrice() {
  const { token } = useConfig()
  const ca = token.contract?.trim() ?? ''
  const configured = /^0x[0-9a-f]{40}$/i.test(ca) && !/^0x0{40}$/i.test(ca)
  const { data, isLoading, error } = useSWR<PriceResponse>(
    configured ? ['/api/token-live-price', ca.toLowerCase()] : null,
    ([url]) => fetchPrice(url),
    { refreshInterval: 15_000, dedupingInterval: 10_000, revalidateOnFocus: true, keepPreviousData: false },
  )
  const price = configured && data?.status === 'ok' ? data.priceUsd : null
  const label = !configured ? 'Awaiting Token Launch'
    : error ? 'Price temporarily unavailable'
    : isLoading && !data ? 'Checking on-chain price…'
    : data?.status === 'unsupported' ? 'Curve price unavailable'
    : data?.status === 'unavailable' ? 'Price temporarily unavailable'
    : 'Indicative curve price · excludes fees'

  return (
    <div className="mt-3 rounded-2xl border border-[#ff781f]/25 bg-black/55 px-3 py-3 text-center" aria-label="SPYHOOKS live token price">
      <div className="flex items-center justify-center gap-2">
        <span className={`size-1.5 rounded-full ${price != null ? 'bg-[#ff781f]' : 'bg-neutral-500'}`} aria-hidden="true" />
        <span className="text-[9px] font-semibold uppercase tracking-[.16em] text-neutral-300">Live price · USD</span>
      </div>
      <p className="mt-1 font-mono text-xl font-bold leading-tight tabular-nums text-white" aria-live="polite" title={data?.reason ?? undefined}>
        {formatPrice(price)}
      </p>
      <p className="mt-1 text-[9px] text-neutral-400">{label}</p>
    </div>
  )
}
