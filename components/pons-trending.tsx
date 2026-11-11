'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Activity, ArrowUpRight, Copy, Check, RefreshCw, Search, TrendingUp } from 'lucide-react'
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
    <li className="group flex min-w-0 flex-col gap-4 rounded-[25px] border border-white/15 bg-[linear-gradient(145deg,#222225,#111113_52%,#09090a)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] transition-colors hover:border-[#ff781f]/55 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="relative size-12 shrink-0 overflow-hidden rounded-full border border-white/20 bg-black/60 font-mono text-sm font-bold">
          {token.logoUrl && !imageFailed ? (
            <img src={token.logoUrl} alt={`${token.name} token logo`} loading="lazy" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center">{token.ticker.slice(0, 2)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p title={token.name} className="truncate font-semibold text-white">{token.name}</p>
          <p className="truncate text-xs text-zinc-400">${token.ticker} · Pons · {token.ageMinutes === null ? 'Established' : `${formatAge(token.ageMinutes)} old`}</p>
          <button onClick={() => void copyAddress()} title={token.address} aria-label={`Copy ${token.ticker} contract address`} className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 font-mono text-[10px] text-zinc-300 hover:text-white">
            <span className="truncate">{token.address.slice(0, 7)}...{token.address.slice(-5)}</span>
            {copied ? <Check className="size-3 shrink-0"/> : <Copy className="size-3 shrink-0"/>}
          </button>
        </div>
        <span className="shrink-0 rounded-full border border-[#ff781f]/45 bg-[#ff781f]/10 px-2 py-1 text-[10px] font-bold text-[#ff9b54]">{token.featured ? 'PONS' : `#${rank}`}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
        <div><p className="text-[10px] uppercase tracking-wider text-zinc-400">24H Volume</p><p className="mt-1 text-xl font-bold text-[#ff962f] tabular-nums">{usd(token.volume24hUsd)}</p></div>
        <div><p className="text-[10px] uppercase tracking-wider text-zinc-400">24H Change</p><p className="mt-1 text-lg font-semibold tabular-nums"><PriceChange value={token.change24hPct}/></p></div>
        <div><p className="text-[10px] uppercase tracking-wider text-zinc-400">Market Cap</p><p className="mt-1 font-semibold tabular-nums">{usd(token.marketCapUsd)}</p></div>
        <div><p className="text-[10px] uppercase tracking-wider text-zinc-400">24H Traders</p><p className="mt-1 font-semibold tabular-nums">{token.traders24h?.toLocaleString('en-US') ?? '—'}</p></div>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2">
        <Link href={`/swap?ca=${encodeURIComponent(token.address)}`} className="inline-flex h-10 items-center justify-center rounded-full border border-[#ff781f] bg-[#ff781f] px-2 text-center text-xs font-bold text-black transition hover:brightness-110 sm:text-sm">
          Swap on SpyHooks
        </Link>
        <a href={`https://robinhoodchain.blockscout.com/token/${token.address}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center justify-center gap-1 rounded-full border border-[#ff781f]/50 bg-[#ff781f]/10 px-2 text-xs font-semibold text-[#ff9b54] transition hover:bg-[#ff781f]/20 sm:text-sm">
          View contract <ArrowUpRight className="size-3.5" />
        </a>
      </div>
    </li>
  )
}

export function PonsTrending() {
  const [query, setQuery] = useState('')
  const { data, error, isLoading, mutate, isValidating } = useSWR<TrendingResponse>('/api/pons-trending', fetcher, {
    refreshInterval: 120_000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    keepPreviousData: true,
  })
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data?.tokens ?? []).filter((t) => !q || t.name.toLowerCase().includes(q) || t.ticker.toLowerCase().includes(q) || t.address.toLowerCase().includes(q))
  }, [data?.tokens, query])

  return (
    <section aria-labelledby="trending-title" className="min-w-0">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><TrendingUp className="size-5 text-[#ff781f]"/><h2 id="trending-title" className="text-2xl font-bold tracking-tight">Trending Tokens</h2></div>
          <p className="mt-1 text-xs text-zinc-400">Pons · Robinhood Chain · Ranked by real 24h USD trading volume</p>
          <p className="mt-1 text-[11px] text-zinc-500">PONS utama ditampilkan khusus. Token lain diperingkat berdasarkan volume 24 jam, berusia 24 jam+, dan volume $1K+.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 items-center gap-2 rounded-full border border-white/15 bg-[#111112] px-3"><Search className="size-4 text-zinc-400"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, ticker or CA" aria-label="Search trending tokens" className="w-44 max-w-full bg-transparent text-xs text-white outline-none placeholder:text-zinc-500"/></label>
          <button type="button" disabled={isValidating} onClick={() => void mutate()} title="Refresh trending" aria-label="Refresh trending tokens" className="inline-flex size-10 items-center justify-center rounded-full border border-white/15 bg-[#111112] text-zinc-300 hover:text-white disabled:opacity-50"><RefreshCw className={`size-4 ${isValidating ? 'animate-spin' : ''}`}/></button>
        </div>
      </div>
      {data?.stale && <p role="status" className="mb-4 text-xs text-amber-400">Live provider temporarily unavailable. Showing previously fetched results.</p>}
      {isLoading && !data ? (
        <p className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#111112] p-6 text-sm text-zinc-400"><Activity className="size-4 animate-pulse text-[#ff781f]"/> Loading 24h Pons trading data…</p>
      ) : error && !data ? (
        <div role="alert" className="rounded-2xl border border-white/10 bg-[#111112] p-6"><p>Unable to load Pons trending.</p><button className="mt-3 rounded-full border border-[#ff781f]/50 px-4 py-2 text-sm" onClick={() => void mutate()}>Retry</button></div>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-[#111112] p-6 text-sm text-zinc-400">{query ? 'No tokens match your search.' : 'No eligible trending tokens are available from the provider yet.'}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((token) => <TrendingCard key={token.address.toLowerCase()} rank={(data?.tokens ?? []).filter((row) => !row.featured).findIndex((row) => row.address.toLowerCase() === token.address.toLowerCase()) + 1} token={token}/>)}
        </ul>
      )}
      {data?.updatedAt && <p className="mt-4 text-[11px] text-zinc-500">Updated: {new Date(data.updatedAt).toLocaleString()} · Source: Crius (independent Pons market data). Prices and volume can change rapidly.</p>}
    </section>
  )
}
