
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
      const res = await fetch(endpoint, {
        cache: 'no-store',
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
      refreshInterval: url ? 15000 : 0,
      dedupingInterval: 0,
      keepPreviousData: false,
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
