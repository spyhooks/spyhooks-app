'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Check, Copy, Search, Star, SlidersHorizontal, GitCompareArrows } from 'lucide-react'
import { useConfig } from '@/components/config-provider'
import { useTokens } from '@/components/use-tokens'
import { formatAge, formatEth, formatUsdMarketCap, type TokenRow } from '@/lib/tokens'
import { useEthUsd } from '@/components/use-eth-usd'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'curve' | 'graduating' | 'graduated'

const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'curve', label: 'On curve' },
  { key: 'graduating', label: 'Graduating' },
  { key: 'graduated', label: 'Surfaced' },
]

function TokenCard({ token, ethUsd, isFavorite, onToggleFavorite }: {
  token: TokenRow
  ethUsd: number | null
  isFavorite: boolean
  onToggleFavorite: (address: string) => void
}) {
  const { network } = useConfig()
  const [logoFailed, setLogoFailed] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const progress = Math.max(0, Math.min(100, token.progress))
  // Stable, restrained accents keep the feed calm while giving each card character.
  // Derived from the contract address so the tint does not shift when sorting/filtering.
  const palette = [
    '245, 142, 78',  // warm copper
    '131, 155, 180', // slate blue
    '79, 165, 133',  // muted jade
    '149, 124, 183', // soft violet
    '101, 147, 183', // steel blue
    '182, 137, 98',  // muted amber
  ]
  const colorIndex = [...token.address.toLowerCase()].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 1009, 0) % palette.length
  const accent = palette[colorIndex]

  async function copyContract() {
    if (!token.address || copyStatus === 'copied') return
    try {
      await navigator.clipboard.writeText(token.address)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  return (
    <li
      className="group relative isolate flex min-w-0 flex-col gap-3 overflow-hidden rounded-[20px] border border-white/[0.16] bg-[#121417] p-3.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_10px_28px_rgba(0,0,0,0.13)] transition-[border-color,box-shadow] duration-200 hover:border-white/[0.32] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.065),0_14px_32px_rgba(0,0,0,0.18)] xl:flex-row xl:items-center xl:gap-4"
      style={{
        backgroundImage: `radial-gradient(ellipse 46% 125% at 100% 105%, rgba(${accent}, 0.12), transparent 78%), linear-gradient(110deg, #1a1c20 0%, #121519 48%, #0e1013 100%)`,
      }}
    >
      {/* Purely decorative lines stay behind all buttons and data. */}
      <svg aria-hidden="true" focusable="false" className="pointer-events-none absolute bottom-0 right-0 z-0 h-[80px] w-[210px] opacity-50" viewBox="0 0 210 80" fill="none">
        <path d="M-5 85 C70 84 130 72 215 23" stroke={`rgba(${accent}, 0.4)`} strokeWidth="0.8" />
        <path d="M-5 91 C67 91 136 82 215 42" stroke={`rgba(${accent}, 0.23)`} strokeWidth="0.8" />
        <path d="M-5 98 C82 92 148 91 215 59" stroke={`rgba(${accent}, 0.15)`} strokeWidth="0.8" />
      </svg>
      <div className="relative z-10 flex min-w-0 items-center gap-3 xl:w-[215px] xl:shrink-0">
        <div className="relative size-11 shrink-0 overflow-hidden rounded-full border border-white/20 bg-black/60 font-mono text-sm font-bold" aria-label={`${token.ticker} token logo`}>
          {token.logoUrl && !logoFailed ? <img src={token.logoUrl} alt={`${token.name} logo`} loading="lazy" referrerPolicy="no-referrer" onError={() => setLogoFailed(true)} className="size-full object-cover" /> : <span className="flex size-full items-center justify-center">{token.ticker.slice(0,2)}</span>}
        </div>
        <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold" title={token.name}>{token.name}</h3><p className="truncate text-[11px] text-zinc-400">${token.ticker} · {formatAge(token.ageMinutes)} ago</p>
          <button type="button" onClick={copyContract} title={token.address} className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] text-zinc-400 hover:text-white"><span>{token.address.slice(0,6)}…{token.address.slice(-4)}</span>{copyStatus==='copied'?<Check className="size-3"/>:<Copy className="size-3"/>}</button>
        </div>
      </div>
      <div className="relative z-10 flex flex-wrap items-center gap-x-4 gap-y-2 xl:min-w-0 xl:flex-1">
        <div className="min-w-[96px] flex-1 xl:flex-none"><p className="text-[10px] uppercase text-zinc-500">Market cap</p><p className="mt-0.5 text-sm font-semibold tabular-nums">{formatUsdMarketCap(token.mcap, ethUsd)}</p></div>
        <div className="min-w-[96px] flex-1 xl:flex-none"><p className="text-[10px] uppercase text-zinc-500">Routed volume</p><p className="mt-0.5 text-xs font-semibold tabular-nums">{formatEth(token.volume)} {network.currency}</p></div>
        <div className="min-w-[125px] flex-[2] xl:flex-1"><div className="flex items-center justify-between gap-2 text-[10px]"><span className="text-zinc-400">{token.status === 'graduated' ? 'Surfaced' : token.status === 'graduating' ? 'Graduating' : 'On curve'}</span><span className="font-mono">{progress}%</span></div><div className="mt-2 h-1 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-[#ff781f]" style={{width:`${progress}%`}}/></div></div>
      </div>
      <div className="relative z-10 flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
        <Link href={`/compare?add=${encodeURIComponent(token.address)}`} title="Add to comparison" aria-label={`Compare ${token.ticker}`} className="inline-flex size-9 items-center justify-center rounded-full border border-white/20 text-zinc-300 hover:border-[#ff781f]/60 hover:text-[#ff781f]"><GitCompareArrows className="size-4"/></Link>
        <button type="button" onClick={()=>onToggleFavorite(token.address)} aria-label={isFavorite?'Remove favorite':'Add favorite'} aria-pressed={isFavorite} className={cn('inline-flex size-9 items-center justify-center rounded-full border',isFavorite?'border-[#ff781f]/60 text-[#ff781f]':'border-white/20 text-zinc-300')}><Star className={cn('size-4',isFavorite&&'fill-current')}/></button>
        <Link href={`/swap?ca=${encodeURIComponent(token.address)}`} className="inline-flex h-9 items-center justify-center rounded-full bg-[#ff781f] px-4 text-xs font-bold text-black hover:brightness-110">Swap</Link>
        <a href={`https://robinhoodchain.blockscout.com/token/${token.address}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${token.ticker} contract`} className="inline-flex h-9 items-center gap-1 rounded-full border border-white/20 px-3 text-xs text-zinc-300 hover:border-white/40">Explorer <ArrowUpRight className="size-3"/></a>
      </div>
      <span className="sr-only" role="status" aria-live="polite">{copyStatus==='copied'?'Contract copied':copyStatus==='failed'?'Copy failed':''}</span>
    </li>
  )
}

function TokenCardSkeleton() {
  return (
    <li className="glass flex flex-col gap-4 rounded-3xl p-5" aria-hidden="true">
      <div className="flex items-start gap-3">
        <div className="size-11 shrink-0 animate-pulse rounded-2xl bg-white/10" />
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <div className="h-4 w-28 animate-pulse rounded bg-white/10" />
          <div className="h-3 w-36 animate-pulse rounded bg-white/5" />
        </div>
        <div className="h-5 w-16 animate-pulse rounded-full bg-white/5" />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <div className="h-3 w-24 animate-pulse rounded bg-white/5" />
          <div className="h-3 w-8 animate-pulse rounded bg-white/5" />
        </div>
        <div className="h-1.5 animate-pulse rounded-full bg-white/5" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <div className="h-3 w-14 animate-pulse rounded bg-white/5" />
          <div className="h-4 w-20 animate-pulse rounded bg-white/10" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-16 animate-pulse rounded bg-white/5" />
          <div className="h-4 w-20 animate-pulse rounded bg-white/10" />
        </div>
      </div>

      <div className="mt-auto h-10 animate-pulse rounded-full bg-white/5" />
    </li>
  )
}

export function TokenBoard() {
  const { tokens, isLoading, error, refreshTokens } = useTokens()
  const { ethUsd } = useEthUsd()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  // SPYHOOKS_LIVE_TOOLS_V1 — client-only favorites, filter and search.
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'mcap' | 'volume' | 'progress'>('newest')
  const [favorites, setFavorites] = useState<string[]>([])
  const [favoritesLoaded, setFavoritesLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('spyhooks:favorite-contracts:v1')
      const data: unknown = raw ? JSON.parse(raw) : []
      if (Array.isArray(data)) {
        setFavorites(data.filter((address): address is string => typeof address === 'string' && /^0x[0-9a-f]{40}$/.test(address)))
      }
    } catch {
      // Private browsing or blocked storage: favorites still work during the session.
    } finally {
      setFavoritesLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!favoritesLoaded) return
    try {
      window.localStorage.setItem('spyhooks:favorite-contracts:v1', JSON.stringify(favorites))
    } catch {
      // Browser storage unavailable.
    }
  }, [favorites, favoritesLoaded])

  const favoriteSet = useMemo(() => new Set(favorites), [favorites])
  function toggleFavorite(address: string) {
    const ca = address.toLowerCase()
    if (!/^0x[0-9a-f]{40}$/.test(ca)) return
    setFavorites((previous) => previous.includes(ca) ? previous.filter((value) => value !== ca) : [...previous, ca])
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matching = tokens.filter((t) =>
      (filter === 'all' || t.status === filter) &&
      (!favoriteOnly || favoriteSet.has((t.address || '').toLowerCase())) &&
      (!q || t.name.toLowerCase().includes(q) || t.ticker.toLowerCase().includes(q) ||
        (t.address || '').toLowerCase().includes(q))
    )
    return matching.sort((a, b) => {
      if (sortBy === 'oldest') return b.ageMinutes - a.ageMinutes
      if (sortBy === 'mcap') return b.mcap - a.mcap
      if (sortBy === 'volume') return b.volume - a.volume
      if (sortBy === 'progress') return b.progress - a.progress
      return a.ageMinutes - b.ageMinutes
    })
  }, [tokens, filter, query, favoriteOnly, favoriteSet, sortBy])

  return (
    <section aria-labelledby="board-title" className="pb-8">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h2 id="board-title" className="text-2xl font-bold tracking-tight">
          Live tokens
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div role="tablist" aria-label="Filter tokens" className="glass flex rounded-full p-1">
            {filters.map((f) => (
              <button
                key={f.key}
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'flex-1 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition',
                  filter === f.key ? 'bg-brand text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setFavoriteOnly((value) => !value)}
            aria-pressed={favoriteOnly}
            className={cn(
              'glass inline-flex h-10 items-center justify-center gap-2 rounded-full border px-3 text-sm transition-colors',
              favoriteOnly ? 'border-[#ff781f]/65 text-[#ff781f]' : 'border-white/15 text-muted-foreground hover:text-foreground'
            )}
            title="Show favorite tokens only"
          >
            <Star className={cn('size-4', favoriteOnly && 'fill-current')} aria-hidden="true" />
            <span className="hidden lg:inline">Favorites</span>
          </button>
          <label className="glass inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm">
            <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Sort token list</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="max-w-[120px] cursor-pointer bg-transparent text-xs text-foreground outline-none [&>option]:bg-zinc-900"
              aria-label="Sort tokens"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="mcap">Market cap</option>
              <option value="volume">Volume</option>
              <option value="progress">Curve progress</option>
            </select>
          </label>
          <label className="glass flex h-10 min-w-0 items-center gap-2 rounded-full px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <span className="sr-only">Search by name, ticker or contract address</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, ticker or CA"
              className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground sm:w-44"
            />
          </label>
        </div>
      </div>

      {error && tokens.length > 0 && (
        <p role="status" className="mb-4 rounded-2xl border border-[#ff781f]/35 bg-[#ff781f]/10 px-4 py-3 text-sm text-[#ffb27b]">
          Live token refresh failed. Showing the previous snapshot; retrying automatically.
        </p>
      )}
      {isLoading ? (
        <div aria-label="Loading live tokens" aria-busy="true">
          <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="size-2 animate-pulse rounded-full bg-primary" />
            Syncing live tokens...
          </p>
          <ul className="grid grid-cols-1 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <TokenCardSkeleton key={i} />
            ))}
          </ul>
        </div>
      ) : error && tokens.length === 0 ? (
        <div className="glass rounded-3xl p-10 text-center">
          <p className="font-medium">Unable to load live tokens</p>
          <p className="mt-2 text-sm text-muted-foreground">
            The live Pons feed is temporarily unavailable. Check your RPC connection and retry.
          </p>
          <button type="button" onClick={() => void refreshTokens()} className="mt-4 rounded-full border border-[#ff781f]/60 px-4 py-2 text-sm text-[#ff9b54] hover:bg-[#ff781f]/10">
            Retry live scan
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="glass rounded-3xl p-10 text-center text-muted-foreground">
          <p>{tokens.length === 0 ? 'No live tokens returned by the Pons scanner yet.' : 'No tokens match your filter.'}</p>
          {tokens.length === 0 && (
            <button type="button" onClick={() => void refreshTokens()} className="mt-4 rounded-full border border-[#ff781f]/60 px-4 py-2 text-sm text-[#ff9b54] hover:bg-[#ff781f]/10">
              Refresh live tokens
            </button>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {visible.map((token) => (
            <TokenCard
              key={`${token.ticker}-${token.address}`}
              token={token}
              ethUsd={ethUsd}
              isFavorite={favoriteSet.has((token.address || '').toLowerCase())}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
