'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { ArrowLeft, ArrowUpRight, ChevronDown, Copy, GitCompareArrows, Plus, RefreshCw, Search, X } from 'lucide-react'
import { useEthUsd } from '@/components/use-eth-usd'
import { formatEth, formatUsdMarketCap, type TokenRow } from '@/lib/tokens'

const KEY = 'spyhooks:compare:selection:v1'
const ADDRESS = /^0x[a-fA-F0-9]{40}$/

type TrendingToken = {
  address: string
  name: string
  ticker: string
  logoUrl: string | null
  marketCapUsd: number | null
  volume24hUsd: number | null
  traders24h: number | null
  change24hPct: number | null
  liquidityUsd: number | null
  status: string
  priceUsd: number | null
}
type TrendingResponse = { tokens: TrendingToken[]; stale?: boolean; updatedAt?: number }
type MarketData = {
  address: string
  source: 'GeckoTerminal' | 'unavailable'
  scope: 'top pool' | 'not indexed'
  poolAddress: string | null
  poolName: string | null
  priceUsd: number | null
  marketCapUsd: number | null
  volume24hUsd: number | null
  change24hPct: number | null
  liquidityUsd: number | null
  updatedAt: string | null
  note: string
}
type LookupToken = { address: string; name: string | null; ticker: string | null; logoUrl: string | null; decimals: number | null; recognizedPons: boolean; stage: string | null; source: string }
type Compared = {
  address: string
  name: string
  ticker: string
  logoUrl: string | null
  live?: TokenRow
  trend?: TrendingToken
  lookup?: LookupToken
  market?: MarketData
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Data source unavailable (${response.status})`)
  return response.json() as Promise<T>
}
function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}
function formatPrice(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  if (value === 0) return '$0'
  if (value < 0.000001) return `$${value.toExponential(4)}`
  if (value < 0.01) return `$${value.toPrecision(5)}`
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 6 })}`
}
function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}
function safeSaved(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((a): a is string => typeof a === 'string' && ADDRESS.test(a)).slice(0, 2).map(a => a.toLowerCase()) : []
  } catch { return [] }
}

function TokenAvatar({ token }: { token: Compared }) {
  const [failed, setFailed] = useState(false)
  return <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-black/40 text-xs font-bold">
    {token.logoUrl && !failed
      ? <img src={token.logoUrl} alt={`${token.name} logo`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="size-full object-cover" />
      : <span>{token.ticker.slice(0, 2).toUpperCase()}</span>}
  </div>
}

export function TokenComparison() {
  const params = useSearchParams()
  const add = params.get('add')
  const [selected, setSelected] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [showTokens, setShowTokens] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [copied, setCopied] = useState('')
  const { ethUsd } = useEthUsd()
  async function copyAddress(address: string) {
    try { await navigator.clipboard.writeText(address); setCopied(address) } catch { /* no clipboard permission */ }
  }

  const { data: live, error: liveError, isLoading: liveLoading, mutate: refreshLive } = useSWR<TokenRow[]>('/api/pons', fetchJson, { refreshInterval: 120_000, revalidateOnFocus: false, keepPreviousData: true, shouldRetryOnError: false })
  const { data: trending, error: trendError, isLoading: trendLoading, mutate: refreshTrend } = useSWR<TrendingResponse>('/api/pons-trending', fetchJson, { refreshInterval: 15 * 60_000, revalidateOnFocus: false, keepPreviousData: true, shouldRetryOnError: false })

  useEffect(() => {
    const saved = safeSaved()
    if (add && ADDRESS.test(add)) {
      const address = add.toLowerCase()
      const next = saved.includes(address) ? saved : saved.length === 2 ? [saved[1], address] : [...saved, address]
      setSelected(next)
    } else setSelected(saved)
    setHydrated(true)
  }, [add])
  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(KEY, JSON.stringify(selected)) } catch { /* private mode */ }
  }, [hydrated, selected])

  const externalA = selected[0] && ADDRESS.test(selected[0]) && !(live ?? []).some(t => t.address?.toLowerCase() === selected[0] && t.logoUrl) && !(trending?.tokens ?? []).some(t => t.address?.toLowerCase() === selected[0] && t.logoUrl) ? selected[0] : null
  const externalB = selected[1] && ADDRESS.test(selected[1]) && !(live ?? []).some(t => t.address?.toLowerCase() === selected[1] && t.logoUrl) && !(trending?.tokens ?? []).some(t => t.address?.toLowerCase() === selected[1] && t.logoUrl) ? selected[1] : null
  const { data: extraA, error: extraErrorA, isLoading: extraLoadingA, mutate: retryA } = useSWR<LookupToken>(externalA ? `/api/compare/token?address=${encodeURIComponent(externalA)}` : null, fetchJson, { revalidateOnFocus: false, dedupingInterval: 120_000, shouldRetryOnError: false })
  const { data: extraB, error: extraErrorB, isLoading: extraLoadingB, mutate: retryB } = useSWR<LookupToken>(externalB ? `/api/compare/token?address=${encodeURIComponent(externalB)}` : null, fetchJson, { revalidateOnFocus: false, dedupingInterval: 120_000, shouldRetryOnError: false })

  // Fetch independent token-CA market snapshots even when a token is present
  // in the Live feed. Live tokens do not contain DEX 24-hour statistics.
  const { data: marketA, error: marketErrorA, isLoading: marketLoadingA, mutate: reloadMarketA } = useSWR<MarketData>(
    selected[0] ? `/api/compare/market?address=${encodeURIComponent(selected[0])}` : null,
    fetchJson, { refreshInterval: 180_000, revalidateOnFocus: false, dedupingInterval: 60_000, shouldRetryOnError: false })
  const { data: marketB, error: marketErrorB, isLoading: marketLoadingB, mutate: reloadMarketB } = useSWR<MarketData>(
    selected[1] ? `/api/compare/market?address=${encodeURIComponent(selected[1])}` : null,
    fetchJson, { refreshInterval: 180_000, revalidateOnFocus: false, dedupingInterval: 60_000, shouldRetryOnError: false })

  const tokens = useMemo(() => {
    const map = new Map<string, Compared>()
    for (const t of live ?? []) {
      if (!ADDRESS.test(t.address)) continue
      map.set(t.address.toLowerCase(), { address: t.address.toLowerCase(), name: t.name, ticker: t.ticker, logoUrl: t.logoUrl || null, live: t })
    }
    for (const t of trending?.tokens ?? []) {
      if (!ADDRESS.test(t.address)) continue
      const key = t.address.toLowerCase()
      const current = map.get(key)
      map.set(key, { address: key, name: t.name || current?.name || 'Unknown token', ticker: t.ticker || current?.ticker || '—', logoUrl: t.logoUrl || current?.logoUrl || null, live: current?.live, trend: t })
    }
    for (const t of [extraA, extraB]) {
      if (!t || !ADDRESS.test(t.address)) continue
      const key = t.address.toLowerCase()
      const existing = map.get(key)
      if (existing) map.set(key, { ...existing, logoUrl: existing.logoUrl || t.logoUrl, lookup: t })
      else map.set(key, { address: key, name: t.name || 'Unnamed token', ticker: t.ticker || '—', logoUrl: t.logoUrl, lookup: t })
    }
    for (const market of [marketA, marketB]) {
      if (!market || !ADDRESS.test(market.address)) continue
      const key = market.address.toLowerCase()
      const existing = map.get(key)
      if (existing) map.set(key, { ...existing, market })
    }
    return map
  }, [live, trending, extraA, extraB, marketA, marketB])

  function choose(address: string) {
    const value = address.trim().toLowerCase()
    if (!ADDRESS.test(value)) return
    setSelected(old => old.includes(value) ? old : old.length === 2 ? [old[1], value] : [...old, value])
    setInput('')
    setShowTokens(false)
  }
  const choices = useMemo(() => [...tokens.values()].filter(t => {
    const q = query.trim().toLowerCase()
    return !selected.includes(t.address) && (!q || t.name.toLowerCase().includes(q) || t.ticker.toLowerCase().includes(q) || t.address.includes(q))
  }).slice(0, 12), [tokens, selected, query])
  const slots = [selected[0] ? tokens.get(selected[0]) || { address: selected[0], name: 'Loading contract metadata…', ticker: '—', logoUrl: null } : null,
    selected[1] ? tokens.get(selected[1]) || { address: selected[1], name: 'Loading contract metadata…', ticker: '—', logoUrl: null } : null] as (Compared | null)[]
  const active = (value: number | null | undefined) => value !== null && value !== undefined && Number.isFinite(value)
  const mc = (s: Compared | null) => s?.trend && active(s.trend.marketCapUsd) ? formatMoney(s.trend.marketCapUsd)
    : s?.market && active(s.market.marketCapUsd) ? formatMoney(s.market.marketCapUsd)
    : s?.live ? formatUsdMarketCap(s.live.mcap, ethUsd) : '—'
  const marketValue = (s: Compared | null, key: 'volume24hUsd' | 'change24hPct' | 'liquidityUsd') => {
    const trendValue = s?.trend?.[key]
    if (active(trendValue)) return trendValue
    const poolValue = s?.market?.[key]
    return active(poolValue) ? poolValue : null
  }
  const status = (s: Compared | null) => s?.live ? s.live.status === 'graduated' ? 'Surfaced' : s.live.status === 'graduating' ? 'Graduating' : 'On curve' : s?.lookup?.stage ?? '—'
  const stats: { label: string; values: [string, string]; note?: string }[] = [
    { label: 'Market cap (USD)', values: [mc(slots[0]), mc(slots[1])], note: 'Trending source when available; otherwise a curve estimate' },
    { label: '24h volume (USD)', values: slots.map(s => formatMoney(marketValue(s, 'volume24hUsd'))) as [string, string], note: 'Trending data or most liquid GeckoTerminal pool (if available)' },
    { label: '24h price change', values: slots.map(s => formatPercent(marketValue(s, 'change24hPct'))) as [string, string] },
    { label: '24h traders', values: slots.map(s => s?.trend?.traders24h?.toLocaleString('en-US') ?? '—') as [string, string] },
    { label: 'Liquidity (USD)', values: slots.map(s => formatMoney(marketValue(s, 'liquidityUsd'))) as [string, string], note: 'Top indexed pool liquidity when GeckoTerminal is the source' },
    { label: 'Spot price (USD)', values: slots.map(s => formatPrice(s?.trend?.priceUsd ?? s?.market?.priceUsd)) as [string, string], note: 'Token USD price from available market sources' },
    { label: 'Curve stage', values: [status(slots[0]), status(slots[1])], note: 'Stage shown only when confirmed by Live Tokens' },
    { label: 'Curve progress', values: slots.map(s => s?.live ? `${s.live.progress}%` : '—') as [string, string] },
    { label: 'Cumulative routed volume', values: slots.map(s => s?.live ? `${formatEth(s.live.volume)} ETH` : '—') as [string, string], note: 'Lifetime routed volume; not 24h volume' },
  ]

  const mainStats = stats.slice(0, 5)
  const extraStats = stats.slice(5)

  return <section className="mx-auto w-full max-w-[1320px] space-y-4 pb-16 text-white">
    {/* Compact heading, no oversized decorative hero */}
    <div className="rounded-[22px] border border-white/10 bg-[radial-gradient(ellipse_at_100%_0%,rgba(255,120,31,.09),transparent_55%),#121214] px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/" className="inline-flex items-center gap-1 text-[11px] text-zinc-500 transition hover:text-white"><ArrowLeft className="size-3"/> Tokens</Link>
          <h1 className="mt-2 flex items-center gap-2.5 text-2xl font-bold tracking-tight sm:text-[30px]"><GitCompareArrows className="size-6 shrink-0 text-[#ff832b]"/> Token Comparison</h1>
          <p className="mt-1.5 text-xs text-zinc-400 sm:text-sm">Compare two contracts, inspect key market metrics, and simulate a trade.</p>
        </div>
        <button type="button" onClick={() => { void refreshLive(); void refreshTrend(); void reloadMarketA(); void reloadMarketB() }} aria-label="Refresh comparison data" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3.5 py-2 text-xs text-zinc-300 transition hover:border-[#ff832b]/60 hover:text-white"><RefreshCw className="size-3.5"/> Refresh</button>
      </div>
    </div>

    {/* Token selection */}
    <div className="rounded-[20px] border border-white/10 bg-[#151517] px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <label className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-white/15 bg-[#0d0d0f] px-4 py-3 focus-within:border-[#ff832b]/60"><Search className="size-4 shrink-0 text-zinc-500"/><input aria-label="Token contract address" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if(e.key==='Enter') choose(input) }} placeholder="Paste token CA (0x...)" className="min-w-0 flex-1 bg-transparent font-mono text-xs text-white outline-none placeholder:text-zinc-500"/></label>
        <button type="button" disabled={!ADDRESS.test(input.trim())} onClick={() => choose(input)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff781f] px-5 py-3 text-xs font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"><Plus className="size-4"/> Add Token</button>
        <button type="button" onClick={() => setShowTokens(v => !v)} aria-expanded={showTokens} className="rounded-xl border border-white/20 px-4 py-3 text-xs text-zinc-200 transition hover:border-[#ff781f]/60">{showTokens ? 'Close List' : 'Browse Tokens'}</button>
      </div>
      {showTokens && <div className="mt-3 rounded-xl border border-white/10 bg-[#0e0e10] p-3">
        <label className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2"><Search className="size-3.5 text-zinc-500"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, symbol or CA" className="min-w-0 flex-1 bg-transparent text-xs outline-none"/></label>
        <div className="mt-2 grid max-h-52 gap-1 overflow-y-auto sm:grid-cols-2">{choices.map(t=><button key={t.address} type="button" onClick={()=>choose(t.address)} className="flex min-w-0 items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition hover:bg-white/5"><span className="min-w-0 truncate text-xs"><span className="font-semibold">{t.name}</span><span className="ml-2 text-zinc-500">${t.ticker}</span></span><Plus className="size-3.5 shrink-0 text-[#ff8b36]"/></button>)}{!choices.length&&<p className="p-3 text-xs text-zinc-500">No matches in current feeds. You can still enter a valid CA above.</p>}</div>
      </div>}
      <p className="mt-2 text-[11px] text-zinc-500">Two tokens maximum · Adding another replaces the oldest selection.</p>
    </div>

    {/* Selected tokens */}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{slots.map((token,index)=><div key={index} className="min-w-0 rounded-[20px] border border-white/15 bg-[linear-gradient(155deg,#1c1c1f,#101012_65%)] p-4 sm:p-5">
      {!token ? <div className="flex min-h-[120px] items-center justify-center gap-3 text-zinc-500"><Plus className="size-5 text-[#ff781f]"/><span className="text-sm">Select token {index+1}</span></div> : <>
        <div className="flex items-start gap-3"><TokenAvatar key={`${token.address}:${token.logoUrl ?? "none"}`} token={token} /><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold sm:text-base" title={token.name}>{token.name}</h2><p className="mt-0.5 truncate text-xs text-zinc-400">${token.ticker}</p></div><button type="button" aria-label={`Remove token ${index+1}`} onClick={()=>setSelected(old=>old.filter(a=>a!==token.address))} className="rounded-full border border-white/10 p-1.5 text-zinc-400 transition hover:text-white"><X className="size-3.5"/></button></div>
        <button onClick={()=>void copyAddress(token.address)} type="button" title="Copy CA" className="mt-3 flex max-w-full items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-left font-mono text-[11px] text-zinc-400 transition hover:text-white"><span className="truncate">{token.address.slice(0,10)}…{token.address.slice(-8)}</span>{copied===token.address?'Copied':<Copy className="size-3 shrink-0"/>}</button>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {token.market?.scope === 'top pool' && <span className="rounded-full border border-white/10 bg-white/[.04] px-2.5 py-1 text-[10px] text-zinc-400" title={token.market.note}>DEX pool market data</span>}
          {token.lookup&&<span className="rounded-full border border-[#ff781f]/25 bg-[#ff781f]/10 px-2.5 py-1 text-[10px] text-[#ffb17c]">{token.lookup.recognizedPons?'Pons verified':'ERC-20 contract'}</span>}
          {!token.live&&!token.trend&&!token.lookup&&<span className="text-[11px] text-zinc-400">{(index===0?extraLoadingA:extraLoadingB)?'Checking on-chain metadata…':(index===0?extraErrorA:extraErrorB)?'Metadata unavailable':'Looking up token…'}</span>}
          {!token.live&&!token.trend&&!token.lookup&&(index===0?extraErrorA:extraErrorB)&&<button className="text-[11px] text-[#ff9b54] underline" onClick={()=>void(index===0?retryA():retryB())}>Retry</button>}
        </div>
        <div className="mt-4 flex gap-2"><Link href={`/swap?ca=${encodeURIComponent(token.address)}`} className="rounded-xl bg-[#ff781f] px-4 py-2.5 text-xs font-semibold text-black transition hover:brightness-110">Swap</Link><a href={`https://robinhoodchain.blockscout.com/token/${token.address}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-white/20 px-3.5 py-2.5 text-xs text-zinc-300 transition hover:border-[#ff781f]/50">Explorer <ArrowUpRight className="size-3"/></a></div>
      </>}
    </div>)}</div>

    {/* Core comparison with strong visual hierarchy */}
    <div className="overflow-hidden rounded-[20px] border border-white/15 bg-[#151517]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-4 sm:px-6"><h2 className="text-sm font-semibold sm:text-base">Key Metrics</h2><span className="text-[11px] text-zinc-500">Unavailable data shown as —</span></div>
      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 border-b border-white/10 bg-white/[.025] px-4 py-2.5 text-[10px] uppercase tracking-wider text-zinc-500 sm:px-6"><span>Metric</span><span className="truncate text-center">{slots[0]?.ticker || 'Token 1'}</span><span className="truncate text-center">{slots[1]?.ticker || 'Token 2'}</span></div>
      <div className="divide-y divide-white/[.07]">{mainStats.map(row=><div key={row.label} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 px-4 py-3.5 sm:px-6"><span className="text-xs text-zinc-300 sm:text-sm">{row.label}</span><span className="break-words text-center font-mono text-xs font-semibold tabular-nums sm:text-sm">{row.values[0]}</span><span className="break-words text-center font-mono text-xs font-semibold tabular-nums sm:text-sm">{row.values[1]}</span></div>)}</div>
      <button type="button" onClick={()=>setAdvanced(v=>!v)} aria-expanded={advanced} className="flex w-full items-center justify-center gap-2 border-t border-white/10 px-4 py-3 text-xs text-[#ffab73] transition hover:bg-white/[.03]">{advanced?'Hide':'Show'} On-chain Details <ChevronDown className={`size-3.5 transition-transform ${advanced?'rotate-180':''}`}/></button>
      {advanced&&<div className="divide-y divide-white/[.07] border-t border-white/10">{extraStats.map(row=><div key={row.label} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 px-4 py-3.5 sm:px-6"><div><p className="text-xs text-zinc-300">{row.label}</p>{row.note&&<p className="mt-1 text-[10px] text-zinc-500">{row.note}</p>}</div><span className="break-words text-center font-mono text-xs font-semibold">{row.values[0]}</span><span className="break-words text-center font-mono text-xs font-semibold">{row.values[1]}</span></div>)}</div>}
    </div>

    {slots.some(s => s?.market?.scope === 'top pool') && <p className="text-xs leading-5 text-zinc-500">GeckoTerminal fallback displays statistics for the most liquid indexed pool only. 24h traders require a separate unique-trader source; swaps/transactions are not presented as traders. Tokens still on the launch curve may have no indexed DEX pool.</p>}
    {(marketLoadingA || marketLoadingB) && <p className="text-xs text-zinc-500">Checking independent pool market data…</p>}
    {(marketErrorA || marketErrorB) && <p className="text-xs text-zinc-500">Some token pool data could not be loaded. Other sources remain available.</p>}
    {(liveError||trendError||trending?.stale)&&<p className="text-xs text-zinc-500">Some market data is temporarily unavailable or cached. Missing values are not estimated.</p>}
    <p className="text-[11px] leading-5 text-zinc-500">Informational tool only. Market figures depend on available data sources; transaction compatibility must be checked in <Link href="/spy" className="text-[#ffae75] hover:underline">SPY Scanner</Link>.</p>
  </section>
}
