
'use client'

import useSWR from 'swr'
import { useConfig } from '@/components/config-provider'
import type { TokenRow } from '@/lib/tokens'

const LOGO_CACHE_KEY = 'spyhooks-token-logos-v1'

type LogoCache = Record<string, string>

function readLogoCache(): LogoCache {
  try {
    const stored = localStorage.getItem(LOGO_CACHE_KEY)
    return stored ? (JSON.parse(stored) as LogoCache) : {}
  } catch {
    return {}
  }
}

function mergeAndSaveLogos(rows: TokenRow[]): TokenRow[] {
  try {
    const cache = readLogoCache()

    for (const token of rows) {
      if (token.logoUrl?.startsWith('https://')) {
        cache[token.address.toLowerCase()] = token.logoUrl
      }
    }

    localStorage.setItem(LOGO_CACHE_KEY, JSON.stringify(cache))

    return rows.map((token) => ({
      ...token,
      logoUrl:
        token.logoUrl?.startsWith('https://')
          ? token.logoUrl
          : cache[token.address.toLowerCase()],
    }))
  } catch {
    return rows
  }
}

export function useTokens() {
  const { api } = useConfig()
  // Live Pons feed is independent of the $SPYHOOKS CA. An empty config must
  // never disable the scanner or silently turn the board into an empty list.
  const url = api.tokensUrl?.trim() || '/api/pons'

  const { data, isLoading, error, mutate } = useSWR<TokenRow[]>(
    url,
    async (endpoint: string) => {
      // Force the API to await a fresh scan when the server snapshot expires.
      // Cache-bust both browser caches and intermediate hosting/CDN caches.
      const separator = endpoint.includes('?') ? '&' : '?'
      const requestUrl = `${endpoint}${separator}fresh=1&_t=${Date.now()}`
      const res = await fetch(requestUrl, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })

      if (!res.ok) {
        throw new Error(`Failed to load tokens: ${res.status}`)
      }

      const rows: unknown = await res.json()
      if (!Array.isArray(rows)) throw new Error('Live token API returned an invalid response')
      return mergeAndSaveLogos(rows as TokenRow[])
    },
    {
      revalidateOnMount: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 10000,
      dedupingInterval: 0,
      keepPreviousData: true,
      shouldRetryOnError: true,
      errorRetryCount: 3,
      errorRetryInterval: 2000,
    },
  )

  return {
    tokens: data ?? [],
    isLoading,
    error,
    refreshTokens: () => mutate(),
  }
}
