'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Activity, ArrowUpRight, Copy, Check, RefreshCw, Search, TrendingUp, GitCompareArrows } from 'lucide-react'
import { formatAge } from '@/lib/tokens'

type TrendingToken = {
  address: string
  name: string
  ticker: string
  logoUrl: string | null
  ageMinutes: number | null
  featured?: boolean
  status: string
  priceUsd: number | null
  marketCapUsd: number | null
  volume24hUsd: number | null
  traders24h: number | null
  change24hPct: number | null
  liquidityUsd: number | null
}
type TrendingResponse = {
  tokens: TrendingToken[]
  updatedAt?: number
  source?: string
  stale?: boolean
  error?: string
}

const SNAPSHOT_KEY = 'spyhooks:pons-trending:last-success:v1'

const fetcher = async (url: string): Promise<TrendingResponse> => {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Trending data unavailable')
  return response.json() as Promise<TrendingResponse>
}

function usd(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—'
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1000).toFixed(2)}K`
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function PriceChange({ value }: { value: number | null }) {
  if (value === null) return <span className="text-zinc-500">—</span>
  const positive = value >= 0
  return <span className={positive ? 'text-emerald-400' : 'text-rose-400'}>{positive ? '+' : ''}{value.toFixed(2)}%</span>
}

function TrendingCard({ token, rank }: { token: TrendingToken; rank: number }) {
  const [copied, setCopied] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  // Match Live Tokens' calm, deterministic per-contract color accent.
  const palette = [
    '185, 121, 76',  // muted copper
    '131, 155, 180', // slate blue
    '79, 165, 133',  // muted jade
    '149, 124, 183', // soft violet
    '101, 147, 183', // steel blue
    '182, 137, 98',  // muted amber
  ]
  const colorIndex = [...token.address.toLowerCase()].reduce(
    (hash, char) => (hash * 31 + char.charCodeAt(0)) % 1009, 0,
  ) % palette.length
  const accent = palette[colorIndex]
  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(token.address)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <li
      className="group relative isolate flex min-w-0 flex-col gap-3 overflow-hidden rounded-[20px] border border-white/[0.16] bg-[#121417] p-3.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_10px_28px_rgba(0,0,0,0.13)] transition-[border-color,box-shadow] duration-200 hover:border-white/[0.32] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.065),0_14px_32px_rgba(0,0,0,0.18)] xl:flex-row xl:items-center xl:gap-4"
      style={{
        backgroundImage: `radial-gradient(ellipse 46% 125% at 100% 105%, rgba(${accent}, 0.12), transparent 78%), linear-gradient(110deg, #1a1c20 0%, #121519 48%, #0e1013 100%)`,
      }}
    >
      {/* Decorative lines are non-interactive and stay behind the content. */}
      <svg aria-hidden="true" focusable="false" className="pointer-events-none absolute bottom-0 right-0 z-0 h-[80px] w-[210px] opacity-50" viewBox="0 0 210 80" fill="none">
        <path d="M-5 85 C70 84 130 72 215 23" stroke={`rgba(${accent}, 0.4)`} strokeWidth="0.8" />
        <path d="M-5 91 C67 91 136 82 215 42" stroke={`rgba(${accent}, 0.23)`} strokeWidth="0.8" />
        <path d="M-5 98 C82 92 148 91 215 59" stroke={`rgba(${accent}, 0.15)`} strokeWidth="0.8" />
      </svg>
      <div className="relative z-10 flex min-w-0 items-center gap-3 xl:w-[215px] xl:shrink-0">
        <div className="relative size-11 shrink-0 overflow-hidden rounded-full border border-white/20 bg-black/60 font-mono text-sm font-bold">
          {token.logoUrl && !imageFailed ? <img src={token.logoUrl} alt={`${token.name} token logo`} loading="lazy" referrerPolicy="no-referrer" onError={()=>setImageFailed(true)} className="size-full object-cover"/> : <span className="flex size-full items-center justify-center">{token.ticker.slice(0,2)}</span>}
        </div>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold" title={token.name}>{token.name}</p><p className="truncate text-[11px] text-zinc-400">${token.ticker} · {token.ageMinutes===null?'Established':`${formatAge(token.ageMinutes)} old`}</p>
          <button type="button" onClick={()=>void copyAddress()} title={token.address} className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] text-zinc-400 hover:text-white"><span>{token.address.slice(0,6)}…{token.address.slice(-4)}</span>{copied?<Check className="size-3"/>:<Copy className="size-3"/>}</button>
        </div>
        <span className="rounded-full border border-[#ff781f]/35 px-2 py-1 text-[10px] text-[#ff9b54]">{token.featured?'PONS':`#${rank}`}</span>
      </div>
      <div className="relative z-10 grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 xl:flex xl:flex-1 xl:items-center xl:justify-between">
        <div><p className="text-[10px] uppercase text-zinc-500">24h volume</p><p className="mt-0.5 text-sm font-semibold tabular-nums">{usd(token.volume24hUsd)}</p></div>
        <div><p className="text-[10px] uppercase text-zinc-500">24h change</p><p className="mt-0.5 text-sm font-semibold tabular-nums"><PriceChange value={token.change24hPct}/></p></div>
        <div><p className="text-[10px] uppercase text-zinc-500">Market cap</p><p className="mt-0.5 text-sm font-semibold tabular-nums">{usd(token.marketCapUsd)}</p></div>
        <div><p className="text-[10px] uppercase text-zinc-500">24h traders</p><p className="mt-0.5 text-sm font-semibold tabular-nums">{token.traders24h?.toLocaleString('en-US')??'—'}</p></div>
      </div>
      <div className="relative z-10 flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
        <Link href={`/compare?add=${encodeURIComponent(token.address)}`} title="Add to comparison" aria-label={`Compare ${token.ticker}`} className="inline-flex size-9 items-center justify-center rounded-full border border-white/20 text-zinc-300 hover:border-[#ff781f]/60 hover:text-[#ff781f]"><GitCompareArrows className="size-4"/></Link>
        <Link href={`/swap?ca=${encodeURIComponent(token.address)}`} className="inline-flex h-9 items-center justify-center rounded-full bg-[#ff781f] px-4 text-xs font-bold text-black hover:brightness-110">Swap</Link>
        <a href={`https://robinhoodchain.blockscout.com/token/${token.address}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1 rounded-full border border-white/20 px-3 text-xs text-zinc-300 hover:border-white/40">Explorer <ArrowUpRight className="size-3"/></a>
      </div>
    </li>
  )
}

export function PonsTrending() {
  const [query, setQuery] = useState('')
  const [saved, setSaved] = useState<TrendingResponse | null>(null)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY)
      if (!raw) return
      const previous = JSON.parse(raw) as TrendingResponse
      // Only use a genuinely fetched ranking, not a placeholder PONS-only result.
      if (Array.isArray(previous.tokens) && previous.tokens.length > 1 && typeof previous.updatedAt === 'number') setSaved(previous)
    } catch { /* local storage may be disabled */ }
  }, [])
  const { data, error, isLoading, mutate, isValidating } = useSWR<TrendingResponse>('/api/pons-trending', fetcher, {
    refreshInterval: 15 * 60_000,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
    keepPreviousData: true,
  })
  useEffect(() => {
    if (!data || data.stale || !Array.isArray(data.tokens) || data.tokens.length < 2) return
    setSaved(data)
    try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(data)) } catch { /* optional */ }
  }, [data])
  const effective = data && !data.stale && data.tokens.length > 1 ? data : saved ?? data
  const sourceUnavailable = Boolean(error || data?.stale)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (effective?.tokens ?? []).filter((t) => !q || t.name.toLowerCase().includes(q) || t.ticker.toLowerCase().includes(q) || t.address.toLowerCase().includes(q))
  }, [effective?.tokens, query])

  return (
    <section aria-labelledby="trending-title" className="min-w-0">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><TrendingUp className="size-5 text-[#ff781f]"/><h2 id="trending-title" className="text-2xl font-bold tracking-tight">Trending Tokens</h2></div>
          <p className="mt-1 text-xs text-zinc-400">Pons · Robinhood Chain · Ranked by real 24h USD trading volume</p>
          <p className="mt-1 text-[11px] text-zinc-500">Main PONS is featured separately. Other tokens are ranked by 24-hour volume, with a minimum age of 24 hours and at least $1K in 24-hour volume.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 items-center gap-2 rounded-full border border-white/15 bg-[#111112] px-3"><Search className="size-4 text-zinc-400"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, ticker or CA" aria-label="Search trending tokens" className="w-44 max-w-full bg-transparent text-xs text-white outline-none placeholder:text-zinc-500"/></label>
          <button type="button" disabled={isValidating} onClick={() => void mutate()} title="Refresh trending" aria-label="Refresh trending tokens" className="inline-flex size-10 items-center justify-center rounded-full border border-white/15 bg-[#111112] text-zinc-300 hover:text-white disabled:opacity-50"><RefreshCw className={`size-4 ${isValidating ? 'animate-spin' : ''}`}/></button>
        </div>
      </div>
      {sourceUnavailable && effective?.tokens && effective.tokens.length > 1 && <p role="status" className="mb-4 text-xs text-zinc-500">Showing the last available market snapshot. Values may be outdated.</p>}
      {isLoading && !effective ? (
        <p className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#111112] p-6 text-sm text-zinc-400"><Activity className="size-4 animate-pulse text-[#ff781f]"/> Loading 24h Pons trading data…</p>
      ) : (error || data?.stale) && (!effective || effective.tokens.length <= 1) ? (
        <div role="status" className="rounded-2xl border border-white/10 bg-[#111112] p-6 text-sm text-zinc-400">Trending market data is temporarily unavailable. The last verified ranking will reappear when the provider connection is restored.</div>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-[#111112] p-6 text-sm text-zinc-400">{query ? 'No tokens match your search.' : 'No eligible trending tokens are available from the provider yet.'}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {filtered.map((token) => <TrendingCard key={token.address.toLowerCase()} rank={(effective?.tokens ?? []).filter((row) => !row.featured).findIndex((row) => row.address.toLowerCase() === token.address.toLowerCase()) + 1} token={token}/>)}
        </ul>
      )}
      {effective?.updatedAt && <p className="mt-4 text-[11px] text-zinc-500">{sourceUnavailable ? 'Last successful update' : 'Updated'}: {new Date(effective.updatedAt).toLocaleString()} · Source: Crius (independent Pons market data). Cached figures may be outdated.</p>}
    </section>
  )
}
