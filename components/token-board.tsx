'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Check, Copy, Search, Star, SlidersHorizontal } from 'lucide-react'
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
    <li className="group flex min-w-0 flex-col gap-3 rounded-[25px] border border-white/15 bg-[linear-gradient(145deg,#222225,#111113_52%,#09090a)] p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.08)] transition-colors hover:border-[#ff781f]/55 sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <div className="relative size-12 shrink-0 overflow-hidden rounded-full border border-white/20 bg-black/60 font-mono text-sm font-bold text-white" aria-label={`${token.ticker} token logo`}>
          {token.logoUrl && !logoFailed ? (
            <img src={token.logoUrl} alt={`${token.name} logo`} loading="lazy" referrerPolicy="no-referrer" onError={() => setLogoFailed(true)} className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center">{token.ticker.slice(0, 2)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-white" title={token.name}>{token.name}</h3>
          <p className="truncate text-xs text-zinc-400" title={`$${token.ticker} · ${token.launchpad} · ${formatAge(token.ageMinutes)} ago`}>
            ${token.ticker} · {token.launchpad} · {formatAge(token.ageMinutes)} ago
          </p>
          {token.address && (
            <button type="button" onClick={copyContract} title={token.address} aria-label={`Copy ${token.ticker} contract address`} className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 font-mono text-[10px] text-zinc-300 transition-colors hover:text-white">
              <span className="truncate">{token.address.slice(0, 7)}...{token.address.slice(-5)}</span>
              {copyStatus === 'copied' ? <Check className="size-3 shrink-0" /> : <Copy className="size-3 shrink-0" />}
            </button>
          )}
          <span className="sr-only" role="status" aria-live="polite">{copyStatus === 'copied' ? 'Contract copied' : copyStatus === 'failed' ? 'Copy failed' : ''}</span>
        </div>
        <button type="button" disabled={!token.address} onClick={() => onToggleFavorite(token.address)} aria-label={isFavorite ? `Remove ${token.ticker} from favorites` : `Add ${token.ticker} to favorites`} aria-pressed={isFavorite} title={isFavorite ? 'Remove favorite' : 'Add to favorites'} className={cn('flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors', isFavorite ? 'border-[#ff781f]/60 bg-[#ff781f]/15 text-[#ff781f]' : 'border-white/15 bg-black/30 text-zinc-300 hover:border-[#ff781f]/60 hover:text-[#ff781f]')}>
          <Star className={cn('size-4', isFavorite && 'fill-current')} aria-hidden="true" />
        </button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider', token.status === 'graduated' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-[#ff781f]/45 bg-[#ff781f]/10 text-[#ff9b54]')}>
          {token.status === 'graduated' ? 'Surfaced' : token.status === 'graduating' ? 'Graduating' : 'On curve'}
        </span>
        <span className="font-mono text-xs text-white">{progress}%</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] uppercase tracking-wider text-zinc-400"><span>Curve progress</span><span>{progress}%</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-gradient-to-r from-[#ff781f] to-[#ffab50] transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-3">
        <div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-zinc-400">Market Cap</p><p className="mt-1 truncate text-lg font-bold tabular-nums text-[#ff962f]" title="Estimated USD market cap">{formatUsdMarketCap(token.mcap, ethUsd)}</p></div>
        <div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-zinc-400">Routed Vol</p><p className="mt-1 truncate text-base font-semibold tabular-nums text-white" title="Cumulative routed volume, not 24h volume">{formatEth(token.volume)} {network.currency}</p></div>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2">
        <Link href={`/swap?ca=${encodeURIComponent(token.address)}`} className="inline-flex h-10 items-center justify-center rounded-full border border-[#ff781f] bg-[#ff781f] px-2 text-center text-xs font-bold text-black transition hover:brightness-110 sm:text-sm">Swap on SpyHooks</Link>
        <a href={`https://robinhoodchain.blockscout.com/token/${token.address}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center justify-center gap-1 rounded-full border border-[#ff781f]/50 bg-[#ff781f]/10 px-2 text-center text-xs font-semibold text-[#ff9b54] transition hover:bg-[#ff781f]/20 sm:text-sm">View contract <ArrowUpRight className="size-3.5 shrink-0" /></a>
      </div>
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
  const { tokens, isLoading, error } = useTokens()
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

      {isLoading ? (
        <div aria-label="Loading live tokens" aria-busy="true">
          <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="size-2 animate-pulse rounded-full bg-primary" />
            Syncing live tokens...
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <TokenCardSkeleton key={i} />
            ))}
          </ul>
        </div>
      ) : error && tokens.length === 0 ? (
        <div className="glass rounded-3xl p-10 text-center">
          <p className="font-medium">Unable to load live tokens</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Check your connection. We will retry automatically.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="glass rounded-3xl p-10 text-center text-muted-foreground">No tokens match your filter.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
