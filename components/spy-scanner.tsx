'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import {
  Activity, ArrowLeftRight, ArrowUpRight, Check, Clipboard, Copy, ExternalLink,
  FileCode2, Info, Layers3, LockKeyhole, ScanSearch, Search, ShieldCheck,
  ShieldQuestion, Wallet, AlertTriangle, LoaderCircle,
} from 'lucide-react'

type ScanResponse = {
  status: 'ok' | 'external' | 'invalid' | 'error'
  message: string
  address: string
  source: string
  explorerUrl: string
  swapUrl: string | null
  token: { name: string | null; symbol: string | null; decimals: number | null; totalSupply: string | null; logoUrl: string | null }
  pons: {
    exists: boolean; scanStatus: 'curve' | 'graduating' | 'graduated' | 'external'
    curveAddress: string | null; deployer: string | null; creatorFeeRecipient: string | null
    pairToken: string | null; poolFee: number | null; tickSpacing: number | null
    creatorTaxBps: number | null; phase: number | null; nativeQuote: boolean | null
    readyToGraduate: boolean | null
  }
  metrics: {
    ethUsd: number | null; priceEth: number | null; priceUsd: number | null
    marketCapEth: number | null; marketCapUsd: number | null
    quoteReserveEth: number | null; tokenReserve: number | null
  }
  warnings: string[]
  risk?: {
    score: number | null
    coverage: number
    label: string
    disclaimer: string
    checks: Array<{ key: string; label: string; maxPoints: number; points: number | null; detail: string }>
  }
}

const CA_REGEX = /^0x[a-fA-F0-9]{40}$/
const panel = 'rounded-[22px] border border-white/[0.13] bg-[linear-gradient(150deg,rgba(30,30,31,0.96),rgba(10,10,11,0.98))] shadow-[0_14px_38px_rgba(0,0,0,0.25)]'
const heading = 'flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-white sm:text-base'
const muted = 'text-[11px] font-medium uppercase tracking-[0.11em] text-zinc-500'

function shortCA(value: string | null) {
  return value ? `${value.slice(0, 7)}…${value.slice(-5)}` : '—'
}
function fmt(value: number | null | undefined, type: 'usd' | 'eth' | 'number' = 'number') {
  if (value == null || !Number.isFinite(value)) return '—'
  const prefix = type === 'usd' ? '$' : ''
  const suffix = type === 'eth' ? ' ETH' : ''
  if (value >= 1e9) return `${prefix}${(value / 1e9).toFixed(2)}B${suffix}`
  if (value >= 1e6) return `${prefix}${(value / 1e6).toFixed(2)}M${suffix}`
  if (value >= 1e3) return `${prefix}${(value / 1e3).toFixed(2)}K${suffix}`
  if (value === 0) return `${prefix}0${suffix}`
  if (value < 0.000001) return `${prefix}${value.toExponential(2)}${suffix}`
  return `${prefix}${value.toLocaleString('en-US', { maximumFractionDigits: value < 1 ? 8 : 4 })}${suffix}`
}
function stageLabel(result: ScanResponse | null) {
  if (!result) return 'Awaiting scan'
  if (result.pons.scanStatus === 'curve') return 'On curve'
  if (result.pons.scanStatus === 'graduating') return 'Graduating'
  if (result.pons.scanStatus === 'graduated') return 'Surfaced'
  return 'Outside configured factory'
}
function DisplayLine({ label, value, copy }: { label: string; value: string; copy?: string | null }) {
  const [copied, setCopied] = useState(false)
  return <div className="flex min-w-0 items-center justify-between gap-2 border-b border-white/[0.08] py-2.5 last:border-b-0">
    <span className="shrink-0 text-[12px] text-zinc-400">{label}</span>
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="truncate text-right font-mono text-[11px] font-medium text-zinc-100 sm:text-xs" title={copy || value}>{value}</span>
      {copy && <button type="button" aria-label={`Copy ${label}`} title={`Copy ${label}`} onClick={async()=>{try{await navigator.clipboard.writeText(copy);setCopied(true)}catch{}}} className="shrink-0 rounded-md p-1 text-zinc-500 transition hover:bg-white/10 hover:text-white">{copied ? <Check size={13}/> : <Copy size={13}/>}</button>}
    </div>
  </div>
}

export function SpyScanner({ defaultContract }: { defaultContract?: string }) {
  const [ca, setCa] = useState(defaultContract ?? '')
  const [result, setResult] = useState<ScanResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastCA, setLastCA] = useState('')
  const valid = CA_REGEX.test(ca.trim())

  async function scan(address = ca) {
    const clean = address.trim()
    if (!CA_REGEX.test(clean) || loading) {
      if (!CA_REGEX.test(clean)) setError('Masukkan Contract Address lengkap (0x + 40 karakter heksadesimal).')
      return
    }
    setError('')
    setLoading(true)
    setLastCA(clean)
    setResult(null)
    try {
      const response = await fetch(`/api/spy/scan?address=${encodeURIComponent(clean)}`, { cache: 'no-store' })
      const data = await response.json() as ScanResponse
      setResult(data)
      if (!response.ok) setError(data.message || 'Scanner could not read the contract.')
    } catch {
      setError('Unable to reach the scanner API. Check the network or try again.')
    } finally { setLoading(false) }
  }
  function onSubmit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); void scan() }
  async function paste() {
    try { const value = await navigator.clipboard.readText(); setCa(value.trim()); setError('') }
    catch { setError('Clipboard access is not permitted. Paste the CA manually.') }
  }

  const external = result?.pons.exists === false
  const isNativeCurve = result?.pons.nativeQuote === true && result?.pons.scanStatus === 'curve'
  const showEthMetrics = isNativeCurve
  const checks = [
    { label: 'Contract bytecode', value: result ? (result.status === 'invalid' ? 'Not detected' : 'Detected') : 'Not scanned', ok: result ? result.status !== 'invalid' : null },
    { label: 'Pons factory registration', value: result ? (result.pons.exists ? 'Registered' : 'Not found') : 'Not scanned', ok: result ? result.pons.exists : null },
    { label: 'Trading stage', value: stageLabel(result), ok: result ? result.pons.exists : null },
    { label: 'Native ETH curve', value: result?.pons.nativeQuote == null ? 'Unknown' : result.pons.nativeQuote ? 'Yes' : 'No', ok: result?.pons.nativeQuote ?? null },
    { label: 'Graduation readiness', value: result?.pons.readyToGraduate == null ? 'Unknown' : result.pons.readyToGraduate ? 'Ready' : 'Not yet', ok: null },
    { label: 'Honeypot / sell simulation', value: 'Not checked', ok: null },
  ]

  return <div className="spy-scanner-page w-full space-y-5 pb-12 text-white sm:space-y-6">
    <header className="relative overflow-hidden rounded-[24px] border border-white/[0.1] bg-[radial-gradient(ellipse_at_78%_0%,rgba(255,120,31,0.13),transparent_43%),linear-gradient(120deg,rgba(18,18,19,0.98),rgba(7,7,8,0.95))] px-5 py-8 text-center sm:px-9 sm:py-10">
      <div className="pointer-events-none absolute right-[-60px] top-[-100px] size-80 rounded-full border border-[#ff781f]/10" aria-hidden="true"/>
      <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-[#ff781f]/40 bg-[#ff781f]/10 px-4 py-1.5 font-mono text-[10px] tracking-[0.21em] text-[#ff9c50]">
        <ScanSearch size={13}/> SPY · CONTRACT SCANNER
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-white sm:text-[42px]">Contract Scanner</h1>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-zinc-400">On-chain contract overview for Robinhood Chain and Pons tokens. View factory verification, curve data, and routing details in one place.</p>
      <form onSubmit={onSubmit} className="relative mx-auto mt-6 flex w-full max-w-[920px] flex-col gap-2 rounded-[18px] border border-white/15 bg-[#09090a] p-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.25)] sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left">
          <FileCode2 size={19} className="shrink-0 text-zinc-500"/>
          <input className="min-w-0 w-full bg-transparent font-mono text-[12px] text-white outline-none placeholder:font-sans placeholder:text-zinc-600 sm:text-sm" value={ca} onChange={e=>{setCa(e.target.value);setError('')}} placeholder="Enter token contract address (0x...)" aria-label="Token contract address" spellCheck={false}/>
          <button type="button" title="Paste CA" aria-label="Paste contract address" onClick={paste} className="shrink-0 rounded-md p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"><Clipboard size={16}/></button>
        </div>
        <button type="submit" disabled={!valid || loading} className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-b from-[#ff973c] to-[#ff741b] px-6 text-sm font-bold text-[#16100b] shadow-[0_3px_18px_rgba(255,120,31,0.17)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
          {loading ? <LoaderCircle size={16} className="animate-spin"/> : <Search size={16}/>} {loading ? 'Scanning...' : 'Scan Contract'}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-500">
        <span>Read-only · No wallet signature required</span>
        {defaultContract && CA_REGEX.test(defaultContract) && <><span className="text-zinc-700">·</span><button className="font-medium text-[#ff994b] hover:underline" type="button" onClick={()=>{setCa(defaultContract);void scan(defaultContract)}}>Scan $SPYHOOKS</button></>}
      </div>
      {error && <p role="alert" className="mx-auto mt-4 max-w-[920px] rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-left text-sm text-amber-200">{error}</p>}
    </header>

    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <section className={`${panel} min-w-0 p-5`}>
        <h2 className={heading}><ShieldQuestion size={18} className="text-[#ff8b2b]"/> SPY Risk Score</h2>
        <div className="mt-5 flex items-center gap-4">
          <div className="relative flex size-[112px] shrink-0 items-center justify-center rounded-full p-[9px]" style={{background: `conic-gradient(#ff8628 ${result?.risk?.score ?? 0}%, #343039 0%)`}}>
            <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#111113]">
              <span className="text-3xl font-bold tabular-nums">{result?.risk?.score ?? '—'}</span>
              <span className="text-[10px] text-zinc-500">/ 100</span>
            </div>
          </div>
          <div className="min-w-0 space-y-1.5">
            <p className="text-[15px] font-semibold text-white">{!result ? 'Ready to scan' : result.risk?.label ?? 'No score available'}</p>
            <p className="text-[11px] leading-5 text-zinc-400">{!result ? 'Scan a contract to calculate evidence-based risk signals.' : result.message}</p>
            <div className="inline-flex rounded-full border border-[#ff781f]/25 bg-[#ff781f]/10 px-2.5 py-1 text-[10px] text-[#ffac65]">{result?.risk?.coverage != null && result.risk.coverage < 60 ? 'Low coverage · Preliminary only' : 'Preliminary · Not audited'}</div>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs text-zinc-400"><span>Scan coverage</span><span className="tabular-nums text-zinc-200">{result?.risk?.coverage ?? 0}%</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#2d2d32]"><div className="h-full rounded-full bg-[#ff8628] transition-[width]" style={{width: `${result?.risk?.coverage ?? 0}%`}}/></div>
        </div>
        {result?.risk?.checks ? <div className="mt-3 space-y-2">{result.risk.checks.map(check => <div key={check.key} className="flex items-start justify-between gap-2 border-b border-white/[0.06] pb-2 text-[11px] last:border-none"><div className="min-w-0"><div className="text-zinc-200">{check.label}</div><div className="text-[10px] leading-4 text-zinc-500">{check.detail}</div></div><span className="shrink-0 font-mono text-[#ffae74]">{check.points == null ? 'N/A' : `${check.points}/${check.maxPoints}`}</span></div>)}</div> : null}
        <div className="mt-4 rounded-xl border border-[#ff781f]/15 bg-[#ff781f]/[0.055] px-3 py-2.5 text-[11px] leading-5 text-[#ddad88]"><Info size={14} className="mr-1 inline"/> {result?.risk?.disclaimer ?? 'Honeypot simulation, full permission audit, and sellability checks are not included. Unknown checks reduce coverage.'}</div>
      </section>

      <section className={`${panel} min-w-0 p-5`}>
        <h2 className={heading}><Activity size={18} className="text-[#ff8b2b]"/> Quick Checks</h2>
        <div className="mt-4 divide-y divide-white/[0.075]">
          {checks.map(item=><div key={item.label} className="flex items-center justify-between gap-2 py-2.5 text-xs">
            <span className="min-w-0 text-zinc-400">{item.label}</span>
            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium ${item.ok === true ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : item.ok === false ? 'border-amber-500/25 bg-amber-500/10 text-amber-300' : 'border-white/10 bg-white/[0.04] text-zinc-300'}`}>{item.value}</span>
          </div>)}
        </div>
      </section>

      <section className={`${panel} min-w-0 p-5`}>
        <h2 className={heading}><Layers3 size={18} className="text-[#ff8b2b]"/> Contract Overview</h2>
        <div className="mt-4">
          <DisplayLine label="Token name" value={result?.token.name || '—'}/>
          <DisplayLine label="Ticker" value={result?.token.symbol ? `$${result.token.symbol}` : '—'}/>
          <DisplayLine label="Network" value="Robinhood Chain"/>
          <DisplayLine label="Contract" value={shortCA(result?.address ?? null)} copy={result?.address}/>
          <DisplayLine label="Decimals" value={result?.token.decimals == null ? '—' : String(result.token.decimals)}/>
          <DisplayLine label="Status" value={stageLabel(result)}/>
        </div>
      </section>
    </div>

    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <section className={`${panel} min-w-0 p-5`}>
        <h2 className={heading}><Wallet size={18} className="text-[#ff8b2b]"/> Token Economics</h2>
        <div className="mt-4">
          <DisplayLine label="Market cap (est.)" value={showEthMetrics ? fmt(result?.metrics.marketCapUsd,'usd') : '—'}/>
          <DisplayLine label="Spot price (est.)" value={showEthMetrics ? fmt(result?.metrics.priceUsd,'usd') : '—'}/>
          <DisplayLine label="Total supply" value={result?.token.totalSupply || '—'}/>
          <DisplayLine label="Reserve (native ETH)" value={showEthMetrics ? fmt(result?.metrics.quoteReserveEth,'eth') : '—'}/>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-zinc-500">Curve estimates are only shown for active native-ETH curves, not post-graduation liquidity.</p>
      </section>

      <section className={`${panel} min-w-0 p-5`}>
        <h2 className={heading}><FileCode2 size={18} className="text-[#ff8b2b]"/> Pons Routing</h2>
        <div className="mt-4">
          <DisplayLine label="Curve" value={shortCA(result?.pons.curveAddress ?? null)} copy={result?.pons.curveAddress}/>
          <DisplayLine label="Pair token" value={shortCA(result?.pons.pairToken ?? null)} copy={result?.pons.pairToken}/>
          <DisplayLine label="Deployer" value={shortCA(result?.pons.deployer ?? null)} copy={result?.pons.deployer}/>
          <DisplayLine label="Fee recipient" value={shortCA(result?.pons.creatorFeeRecipient ?? null)} copy={result?.pons.creatorFeeRecipient}/>
        </div>
      </section>

      <section className={`${panel} min-w-0 p-5`}>
        <h2 className={heading}><AlertTriangle size={18} className="text-[#ff8b2b]"/> Warnings / Notes</h2>
        <div className="mt-4 space-y-2">
          {!result ? <p className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-xs leading-5 text-zinc-400">Results will appear after a contract is scanned.</p> : result.warnings.length > 0 ? result.warnings.map((w,i)=><p key={`${i}-${w}`} className="rounded-xl border border-[#ff781f]/25 bg-[#ff781f]/[0.07] p-3 text-xs leading-5 text-zinc-200">{w}</p>) : <p className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-xs leading-5 text-zinc-400">No factory-specific warnings returned. This is not a safety clearance.</p>}
          {external && <p className="text-xs leading-5 text-zinc-500">External tokens require a separate verified indexing method.</p>}
        </div>
      </section>

      <section className={`${panel} min-w-0 p-5`}>
        <h2 className={heading}><ArrowLeftRight size={18} className="text-[#ff8b2b]"/> Actions & Settings</h2>
        <div className="mt-4 space-y-2">
          {result?.swapUrl ? <Link href={result.swapUrl} className="flex items-center justify-between rounded-xl bg-[#ff781f] px-3.5 py-3 text-xs font-semibold text-black hover:brightness-110">Swap on SpyHooks <ArrowUpRight size={15}/></Link> : <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-xs text-zinc-500">Swap link unavailable</div>}
          {result?.explorerUrl ? <a href={result.explorerUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-white/15 bg-white/[0.035] px-3.5 py-3 text-xs font-medium text-white hover:border-[#ff781f]/45">View on Blockscout <ExternalLink size={14}/></a> : null}
          <DisplayLine label="Pool fee" value={result?.pons.poolFee == null ? '—' : String(result.pons.poolFee)}/>
          <DisplayLine label="Tick spacing" value={result?.pons.tickSpacing == null ? '—' : String(result.pons.tickSpacing)}/>
          <DisplayLine label="Creator tax" value={result?.pons.creatorTaxBps == null ? '—' : `${(result.pons.creatorTaxBps / 100).toFixed(2)}%`}/>
        </div>
      </section>
    </div>
    {result && <p className="text-center text-xs text-zinc-600">Results based on current RPC responses. Last scanned CA: {shortCA(lastCA)}. Scanner is read-only and does not certify contract safety.</p>}
  </div>
}
