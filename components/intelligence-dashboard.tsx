'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Activity, ArrowDownLeft, ArrowLeft, ArrowRightLeft, ArrowUpRight, Bell, Check, Copy, ExternalLink, Filter, Radar, RefreshCcw, Search, ShieldCheck, Star, TrendingUp, Wallet, X } from 'lucide-react'

type Token = { address: string; name: string; symbol: string; image: string | null }
type Trade = {
  id: string
  address: string
  name: string
  symbol: string
  side: 'buy' | 'sell'
  trader: string
  tx: string | null
  timestamp: number
  valueUsd: number | null
  priceUsd: number | null
  amountBase: number | null
  dex: string | null
  finality: string | null
}
type Feed = {
  tokens: Token[]
  trades: Trade[]
  updatedAt: string | null
  stale: boolean
  source: string
  coverage: string
  warning: string | null
}
type Mode = 'trades' | 'wallets'
type Side = 'all' | 'buy' | 'sell'
const POLL_INTERVAL = 120_000
const STORAGE = 'spyhooks:intelligence:followed-wallets:v1'
const addressRE = /^0x[a-f0-9]{40}$/i

function short(value: string, size = 6) { return value.length > size*2 ? `${value.slice(0,size)}…${value.slice(-4)}` : value }
function usd(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—'
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`
  return `$${value.toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2})}`
}
function date(ms: number) { return new Date(ms).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) }
function relative(ms: number, now: number) {
  const n = Math.max(0, Math.floor((now-ms)/1000))
  return n < 60 ? `${n}s ago` : n < 3600 ? `${Math.floor(n/60)}m ago` : n < 86400 ? `${Math.floor(n/3600)}h ago` : `${Math.floor(n/86400)}d ago`
}

const INTELLIGENCE_MAINTENANCE = true

export function IntelligenceDashboard() {
  const [mode,setMode] = useState<Mode>('trades')
  const [feed,setFeed] = useState<Feed | null>(null)
  const [error,setError] = useState<string | null>(null)
  const [busy,setBusy] = useState(true)
  const [query,setQuery] = useState('')
  const [tokenAddress,setTokenAddress] = useState('')
  const [side,setSide] = useState<Side>('all')
  const [minimum,setMinimum] = useState('0')
  const [walletInput,setWalletInput] = useState('')
  const [followed,setFollowed] = useState<string[]>([])
  const [ready,setReady] = useState(false)
  const [onlyFollowed,setOnlyFollowed] = useState(false)
  const [selectedWallet,setSelectedWallet] = useState<string | null>(null)
  const retryUntil = useRef(0)
  const [now,setNow] = useState(() => Date.now())
  const [copied,setCopied] = useState<string | null>(null)

  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE) ?? '[]')
      if (Array.isArray(parsed)) setFollowed(parsed.filter((a): a is string => typeof a === 'string' && addressRE.test(a)).slice(0,30).map(a => a.toLowerCase()))
    } catch { /* storage unavailable */ }
    setReady(true)
  }, [])
  useEffect(() => {
    if (!ready) return
    try { localStorage.setItem(STORAGE,JSON.stringify(followed)) } catch { /* storage unavailable */ }
  },[followed,ready])
  useEffect(() => {
    const interval = setInterval(()=>setNow(Date.now()),10_000)
    return ()=>clearInterval(interval)
  },[])

  const load = useCallback(async (signal?: AbortSignal) => {
    if (Date.now() < retryUntil.current) return
    const token = tokenAddress
    setBusy(true)
    setError(null)
    try {
      const res=await fetch(`/api/intelligence/trades${token?`?token=${encodeURIComponent(token)}`:''}`,{cache:'no-store',signal})
      const json: unknown=await res.json()
      if (!res.ok) {
        const errorBody = json as { error?: unknown; retryAfterSeconds?: unknown }
        const seconds = Number(errorBody?.retryAfterSeconds)
        if (res.status === 429 && Number.isFinite(seconds) && seconds > 0)
          retryUntil.current = Date.now() + Math.min(seconds, 86400) * 1000
        // Never render upstream provider errors in the dashboard. They can include
        // quota details, network information, or implementation-specific text.
        throw new Error('Live trade feed temporarily unavailable')
      }
      retryUntil.current = 0
      const data=json as Feed
      if (!Array.isArray(data.trades) || !Array.isArray(data.tokens)) throw new Error('Unexpected feed response')
      if (!signal?.aborted) setFeed(data)
    } catch(e) {
      // Use a fixed client-facing message even for unexpected network/JSON errors.
      if (!signal?.aborted) setError('Live trade feed temporarily unavailable')
    } finally {
      if (!signal?.aborted) setBusy(false)
    }
  },[tokenAddress])
  useEffect(() => {
    // Maintenance mode: do not spend any Crius quota while the feature is paused.
    if (INTELLIGENCE_MAINTENANCE) {
      setBusy(false)
      return
    }
    const controller=new AbortController()
    void load(controller.signal)
    const timer=setInterval(()=>{void load(controller.signal)},POLL_INTERVAL)
    return ()=>{controller.abort();clearInterval(timer)}
  },[load])

  function toggleFollow(wallet: string) {
    if (!addressRE.test(wallet)) return
    const normalized=wallet.toLowerCase()
    setFollowed(old=>old.includes(normalized)?old.filter(x=>x!==normalized):old.length>=30?old:[...old,normalized])
  }
  function addWallet() {
    if (addressRE.test(walletInput.trim())) { toggleFollow(walletInput.trim()); setWalletInput('') }
  }
  function applyToken() {
    const value=query.trim()
    if (value === '' || addressRE.test(value)) setTokenAddress(value.toLowerCase())
  }
  async function copy(value:string) {
    try { await navigator.clipboard.writeText(value);setCopied(value) } catch { /* clipboard might be unavailable */ }
  }

  const observed=useMemo(()=>feed?.trades ?? [],[feed])
  const filtered=useMemo(()=>observed.filter(t=>{
    const needle=query.toLowerCase().trim()
    const search=tokenAddress ? '' : needle
    return (side==='all'||t.side===side) && (t.valueUsd??0)>=Number(minimum) &&
      (!onlyFollowed||followed.includes(t.trader.toLowerCase())) &&
      (!selectedWallet||t.trader.toLowerCase()===selectedWallet) &&
      (!search||t.symbol.toLowerCase().includes(search)||t.name.toLowerCase().includes(search)||t.address.includes(search)||t.trader.includes(search))
  }),[observed,query,tokenAddress,side,minimum,onlyFollowed,followed,selectedWallet])
  const wallets=useMemo(()=>{
    const map=new Map<string,{address:string; trades:number; buys:number;sells:number;last:number; buyUsd:number;sellUsd:number}>()
    for(const t of observed){
      const wallet=t.trader.toLowerCase()
      const prev=map.get(wallet)??{address:wallet,trades:0,buys:0,sells:0,last:0,buyUsd:0,sellUsd:0}
      prev.trades++; prev.last=Math.max(prev.last,t.timestamp)
      if(t.side==='buy'){prev.buys++;prev.buyUsd+=t.valueUsd??0}
      else {prev.sells++;prev.sellUsd+=t.valueUsd??0}
      map.set(wallet,prev)
    }
    return [...map.values()].sort((a,b)=>b.trades-a.trades||b.last-a.last)
  },[observed])
  const uniqueTraders=new Set(filtered.map(t=>t.trader)).size
  const observedUsd=filtered.reduce((sum,t)=>sum+(t.valueUsd??0),0)

  const card='rounded-[24px] border border-white/[0.13] bg-[#141416]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_15px_40px_rgba(0,0,0,0.15)]'
  if (INTELLIGENCE_MAINTENANCE) {
    return (
      <section className="min-w-0 pb-16 text-white">
        <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(ellipse_at_90%_5%,rgba(255,115,30,0.10),transparent_55%),linear-gradient(110deg,#161618,#080809)] px-6 py-8 sm:px-9 sm:py-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#ff781f]/30 bg-[#ff781f]/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#ffab65]"><Radar className="size-3.5"/> Robinhood Chain · Pons ecosystem</div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-5xl">SPY <span className="text-[#ff832b]">Intelligence</span></h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-400">Smart Money Tracker & Live Trade Feed</p>
        </div>
        <div className="mt-5 flex min-h-[300px] flex-col items-center justify-center rounded-[28px] border border-white/10 bg-[#141416]/95 px-6 py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-[#ff781f]/30 bg-[#ff781f]/10 text-[#ff913e]"><Activity className="size-6"/></div>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#ff781f]/30 bg-[#ff781f]/10 px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#ffab65]">Under maintenance</div>
          <h2 className="mt-4 text-2xl font-semibold">This feature is under maintenance</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-zinc-400">We're improving the data connection for Smart Money Tracker and Live Trade Feed. This section will be available again after maintenance.</p>
          <Link href="/" className="mt-6 inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-[#ff781f]/60"><ArrowLeft className="size-4"/> Back to Live Tokens</Link>
        </div>
      </section>
    )
  }
  return <section className="min-w-0 pb-16 text-white">
    <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(ellipse_at_90%_5%,rgba(255,115,30,0.13),transparent_55%),linear-gradient(110deg,#161618,#080809)] px-6 py-8 sm:px-9 sm:py-10">
      <div className="pointer-events-none absolute -right-24 -top-36 size-[340px] rounded-full border border-[#ff781f]/15" aria-hidden="true" />
      <div className="inline-flex items-center gap-2 rounded-full border border-[#ff781f]/30 bg-[#ff781f]/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#ffab65]"><Radar className="size-3.5"/> Robinhood Chain · Pons ecosystem</div>
      <div className="mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">SPY <span className="text-[#ff832b]">Intelligence</span></h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-400">Follow observed wallet activity, explore on-chain trades, and track token movements from a single workspace.</p>
        </div>
        <button onClick={()=>void load()} type="button" disabled={busy} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-white/20 bg-[#19191b] px-4 py-2.5 text-xs font-semibold hover:border-[#ff781f]/60 disabled:opacity-50"><RefreshCcw className={`size-4 ${busy?'animate-spin':''}`}/> Refresh feed</button>
      </div>
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      {[
        {label:'OBSERVED TRADES',value:feed?String(filtered.length):'—',info:'Recent sampled events',icon:Activity},
        {label:'OBSERVED VALUE',value:feed?usd(observedUsd):'—',info:'Not full-chain 24h volume',icon:TrendingUp},
        {label:'ACTIVE TRADERS',value:feed?String(uniqueTraders):'—',info:'Unique trader addresses',icon:Wallet},
      ].map(v=><div key={v.label} className={`${card} p-5`}><div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-zinc-500"><span>{v.label}</span><v.icon className="size-4 text-[#ff832b]"/></div><div className="mt-3 text-3xl font-bold tabular-nums">{v.value}</div><div className="mt-1 text-xs text-zinc-500">{v.info}</div></div>)}
    </div>

    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-full border border-white/15 bg-[#111113] p-1">
        <button type="button" onClick={()=>setMode('trades')} className={`rounded-full px-5 py-2.5 text-xs font-semibold transition ${mode==='trades'?'bg-white text-black':'text-zinc-400 hover:text-white'}`}><Activity className="mr-2 inline size-4"/>Live Trades</button>
        <button type="button" onClick={()=>setMode('wallets')} className={`rounded-full px-5 py-2.5 text-xs font-semibold transition ${mode==='wallets'?'bg-white text-black':'text-zinc-400 hover:text-white'}`}><Wallet className="mr-2 inline size-4"/>Wallet Tracker</button>
      </div>
      <div className="flex items-center gap-2 text-xs text-zinc-500"><span className={`size-2 rounded-full ${feed&&!feed.stale&&!error?'bg-emerald-400':'bg-amber-400'}`}/>{feed?(feed.stale||error?'Cached snapshot':`Updated ${feed.updatedAt?new Date(feed.updatedAt).toLocaleTimeString():'—'}`):error?'Temporarily unavailable':'Connecting…'}</div>
    </div>

    <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_275px]">
      <div className="min-w-0 space-y-4">
        <div className={`${card} p-4`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/15 bg-black/30 px-4 py-2.5"><Search className="size-4 shrink-0 text-zinc-500"/><input value={query} onChange={e=>{setQuery(e.target.value);if(!e.target.value)setTokenAddress('')}} onKeyDown={e=>{if(e.key==='Enter')applyToken()}} placeholder="Search name, ticker, wallet or paste token CA" className="w-full min-w-0 bg-transparent text-xs outline-none placeholder:text-zinc-600"/></label>
            <button type="button" onClick={applyToken} disabled={!!query.trim()&&!addressRE.test(query.trim())} className="rounded-full border border-[#ff781f]/50 bg-[#ff781f]/10 px-4 py-2.5 text-xs text-[#ffb078] hover:bg-[#ff781f]/20 disabled:opacity-40">{tokenAddress?'Token CA active':'Scan Token CA'}</button>
            {tokenAddress&&<button onClick={()=>{setQuery('');setTokenAddress('')}} className="rounded-full border border-white/15 p-2.5" aria-label="Clear selected token"><X className="size-4"/></button>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <Filter className="size-3.5 text-zinc-500"/>
            {(['all','buy','sell'] as const).map(v=><button type="button" key={v} onClick={()=>setSide(v)} className={`rounded-full border px-3 py-1.5 uppercase ${side===v?'border-[#ff781f]/60 bg-[#ff781f]/15 text-[#ffab65]':'border-white/10 text-zinc-400 hover:border-white/20'}`}>{v}</button>)}
            <select aria-label="Minimum USD value" value={minimum} onChange={e=>setMinimum(e.target.value)} className="rounded-full border border-white/15 bg-[#151517] px-3 py-1.5 text-zinc-300 outline-none"><option value="0">Any size</option><option value="100">$100+</option><option value="500">$500+</option><option value="1000">$1K+</option><option value="10000">$10K+</option></select>
            <button type="button" aria-pressed={onlyFollowed} onClick={()=>setOnlyFollowed(v=>!v)} className={`rounded-full border px-3 py-1.5 ${onlyFollowed?'border-[#ff781f] text-[#ffab65]':'border-white/10 text-zinc-400'}`}><Star className="mr-1 inline size-3"/>Followed</button>
          </div>
        </div>

        {/* Keep provider diagnostics on the server, not in a large warning banner. */}
        {mode==='trades'?<div className={`${card} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-5 py-4"><div><h2 className="font-semibold">Live Trade Feed</h2><p className="mt-1 text-xs text-zinc-500">{feed?.stale||error ? 'Showing last available data' : (feed?.coverage??'Connecting to source…')} · Updates when available</p></div><span className="rounded-full border border-white/10 px-2 py-1 font-mono text-[10px] text-zinc-500">READ ONLY</span></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[590px] border-collapse text-left"><thead className="bg-white/[0.025] text-[10px] uppercase tracking-wide text-zinc-500"><tr><th className="px-5 py-3 font-medium">Action / Token</th><th className="px-3 py-3 font-medium">Value</th><th className="px-3 py-3 font-medium">Trader</th><th className="px-3 py-3 font-medium">Time</th><th className="px-5 py-3 text-right font-medium">Transaction</th></tr></thead><tbody className="divide-y divide-white/[0.06]">
          {filtered.map(t=><tr key={t.id} className="transition hover:bg-white/[0.035]"><td className="px-5 py-3"><div className="flex items-center gap-2"><div className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${t.side==='buy'?'bg-emerald-500/10 text-emerald-400':'bg-rose-500/10 text-rose-400'}`}>{t.side==='buy'?<ArrowDownLeft className="size-4"/>:<ArrowUpRight className="size-4"/>}</div><div className="min-w-0"><div className="flex items-center gap-2"><span className={`text-[10px] font-semibold uppercase ${t.side==='buy'?'text-emerald-400':'text-rose-400'}`}>{t.side}</span><Link href={`/swap?ca=${t.address}`} className="max-w-[115px] truncate text-xs font-semibold hover:text-[#ff9d4b]">${t.symbol}</Link></div><span className="block max-w-[130px] truncate text-[10px] text-zinc-500" title={t.address}>{t.name}</span></div></div></td><td className="px-3 py-3 font-mono text-xs font-medium">{usd(t.valueUsd)}</td><td className="px-3 py-3"><button type="button" onClick={()=>{setMode('wallets');setSelectedWallet(t.trader)}} className="font-mono text-xs text-zinc-300 hover:text-[#ffab65]">{short(t.trader)}</button></td><td className="px-3 py-3 text-xs text-zinc-400" title={date(t.timestamp)}>{relative(t.timestamp,now)}</td><td className="px-5 py-3 text-right">{t.tx?<a href={`https://robinhoodchain.blockscout.com/tx/${t.tx}`} target="_blank" rel="noreferrer" aria-label="View transaction in explorer" className="inline-flex rounded-full border border-white/10 p-2 text-zinc-300 hover:border-[#ff781f]/50 hover:text-[#ff781f]"><ExternalLink className="size-3.5"/></a>:<span className="text-zinc-600">—</span>}</td></tr>)}
          </tbody></table></div>{!busy&&!filtered.length&&<p className="p-8 text-center text-sm text-zinc-400">{error&&!feed?'Live trade feed temporarily unavailable. Please try again later.':feed?.stale?'No trades in the last saved snapshot.': 'No matching trades in the sampled token feeds. Try changing the filters.'}</p>}{busy&&!feed&&<p className="p-8 text-center text-sm text-zinc-400">Loading verified trades…</p>}
        </div>:<div className={`${card} p-5`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Wallet Activity Tracker</h2><p className="mt-1 text-xs text-zinc-500">Observed wallet activity in sampled token feeds, not a verified profitability ranking.</p></div>{selectedWallet&&<button type="button" onClick={()=>setSelectedWallet(null)} className="rounded-full border border-white/20 px-3 py-2 text-xs text-zinc-300"><X className="mr-1 inline size-3"/>Clear wallet filter</button>}</div>
          <div className="space-y-2">{wallets.filter(w=>!selectedWallet||w.address===selectedWallet).slice(0,40).map(w=><div key={w.address} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3"><div><div className="flex items-center gap-2"><span className="font-mono text-sm text-white">{short(w.address)}</span><button type="button" onClick={()=>copy(w.address)} aria-label="Copy wallet address" className="text-zinc-500 hover:text-white">{copied===w.address?<Check className="size-3.5"/>:<Copy className="size-3.5"/>}</button></div><div className="mt-1 text-xs text-zinc-500">{w.trades} observed trades · {w.buys} buys · {w.sells} sells</div></div><div className="flex items-center gap-3"><div className="text-right"><div className="font-mono text-xs text-zinc-200">Buy {usd(w.buyUsd)}</div><div className="font-mono text-xs text-zinc-500">Sell {usd(w.sellUsd)}</div></div><button type="button" onClick={()=>toggleFollow(w.address)} aria-label={followed.includes(w.address)?'Unfollow wallet':'Follow wallet'} className={`rounded-full border p-2 ${followed.includes(w.address)?'border-[#ff781f]/50 bg-[#ff781f]/15 text-[#ff892f]':'border-white/15 text-zinc-400'}`}><Star className={`size-4 ${followed.includes(w.address)?'fill-current':''}`}/></button><a target="_blank" rel="noreferrer" href={`https://robinhoodchain.blockscout.com/address/${w.address}`} aria-label="Open wallet in explorer" className="text-zinc-400 hover:text-[#ff892f]"><ArrowUpRight className="size-4"/></a></div></div>)}{!wallets.length&&<p className="py-9 text-center text-sm text-zinc-500">No wallets observed yet.</p>}</div>
          <p className="mt-5 text-xs leading-5 text-zinc-500">Buying and selling totals are NOT net profit. Actual realized PnL and win rate require full cost-basis history, fees, and inventory accounting.</p>
        </div>}
      </div>
      <aside className="space-y-4">
        <div className={`${card} p-5`}><div className="flex items-center gap-2"><Star className="size-4 text-[#ff8b32]"/><h2 className="font-semibold">Wallet Watchlist</h2></div><p className="mt-2 text-xs leading-5 text-zinc-500">Follow up to 30 wallets. Saved in this browser; no wallet signature needed.</p>
          <div className="mt-4 flex gap-2"><input aria-label="Wallet address to follow" value={walletInput} onChange={e=>setWalletInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addWallet()}} className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 font-mono text-xs outline-none focus:border-[#ff781f]/60" placeholder="0x wallet address"/><button type="button" onClick={addWallet} disabled={!addressRE.test(walletInput.trim())||followed.length>=30} className="rounded-xl bg-[#ff781f] px-3 text-xs font-bold text-black disabled:opacity-40">Follow</button></div>
          <div className="mt-4 space-y-2">{followed.map(w=><div key={w} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2"><button type="button" onClick={()=>{setSelectedWallet(w);setMode('wallets')}} className="truncate font-mono text-xs text-zinc-300 hover:text-[#ff9a52]">{short(w)}</button><button type="button" aria-label={`Unfollow ${w}`} onClick={()=>toggleFollow(w)} className="text-zinc-500 hover:text-rose-400"><X className="size-3.5"/></button></div>)}{!followed.length&&<p className="py-3 text-center text-xs text-zinc-500">No wallets followed yet</p>}</div>
        </div>
        <div className={`${card} p-5`}><div className="flex items-center gap-2"><ShieldCheck className="size-4 text-[#ff8b32]"/><h2 className="font-semibold">Data integrity</h2></div><div className="mt-3 space-y-3 text-xs leading-5 text-zinc-400"><p>Trades are attributed to trader wallets by the data provider. Transaction links can be inspected independently.</p><p>Results cover sampled Pons token feeds; they are not a chain-wide global trade stream.</p><p>Smart Money performance scores are deliberately disabled until verified historical PnL data is available.</p></div><div className="mt-4 rounded-xl border border-[#ff781f]/20 bg-[#ff781f]/5 p-3 text-xs text-[#ffb47a]"><Bell className="mr-2 inline size-3.5"/>Wallet alerts coming in a later release.</div></div>
        <Link href="/" className="flex items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-3 text-xs text-zinc-300 hover:border-[#ff781f]/50"><ArrowLeft className="size-4"/> Back to Live Tokens</Link>
      </aside>
    </div>
  </section>
}
