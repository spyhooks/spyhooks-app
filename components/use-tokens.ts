
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
  const url = api.tokensUrl || null

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

      const rows = (await res.json()) as TokenRow[]
      return mergeAndSaveLogos(rows)
    },
    {
      revalidateOnMount: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: url ? 10000 : 0,
      dedupingInterval: 0,
      keepPreviousData: true,
      shouldRetryOnError: true,
      errorRetryCount: 3,
      errorRetryInterval: 2000,
    },
  )

  return {
    tokens: data ?? [],
    isLoading: Boolean(url) && isLoading,
    error,
    refreshTokens: () => mutate(),
  }
}
