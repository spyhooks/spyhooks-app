'use client'

import useSWR from 'swr'

type PriceResponse = { usd: number | null; updatedAt: string | null }

export function useEthUsd() {
  const { data } = useSWR<PriceResponse>('/api/eth-usd', async (url: string) => {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) throw new Error(`ETH/USD quote unavailable (${response.status})`)
    return (await response.json()) as PriceResponse
  }, { refreshInterval: 60000, revalidateOnFocus: true, shouldRetryOnError: true })
  const rate = data?.usd
  return { ethUsd: typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : null, updatedAt: data?.updatedAt ?? null }
}
