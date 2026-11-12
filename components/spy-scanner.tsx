'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowUpRight, Check, ChevronDown, Clipboard, Copy, ExternalLink, Fingerprint, Info, LoaderCircle, Radar, Search, Shield, ShieldCheck, ShieldQuestion } from 'lucide-react'

type ScanResponse = {
  status: 'ok' | 'external' | 'invalid' | 'error'
  message: string
  address: string
  explorerUrl: string
  swapUrl: string | null
  token: { name: string | null; symbol: string | null; decimals: number | null; totalSupply: string | null }
  pons: {
    exists: boolean
    scanStatus: 'curve' | 'graduating' | 'graduated' | 'external'
    curveAddress: string | null
    deployer: string | null
    creatorFeeRecipient: string | null
    pairToken: string | null
    poolFee: number | null
    tickSpacing: number | null
    creatorTaxBps: number | null
    nativeQuote: boolean | null
    readyToGraduate: boolean | null
  }
  metrics: { priceUsd: number | null; marketCapUsd: number | null; quoteReserveEth: number | null }
  warnings: string[]
  risk?: {
    score: number | null
    coverage: number
    label: string
    disclaimer: string
    checks: Array<{ key: string; label: string; maxPoints: number; points: number | null; detail: string }>
  }
  evidence?: { sourceVerified: boolean | null; top10Percent: number | null; proxyIndicator: boolean | null }
}

const CA_RE = /^0x[a-f\d]{40}$/i
const card = 'rounded-[24px] border border-white/[0.13] bg-[linear-gradient(150deg,#18181a,#0e0e10_72%)] shadow-[0_15px_42px_rgba(0,0,0,.22)]'

function short(value: string | null | undefined) {
  return value && value.length > 16 ? `${value.slice(0, 7)}…${value.slice(-5)}` : value || '—'
}
function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`
  if (value !== 0 && value < .0001) return `$${value.toExponential(2)}`
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 6 })}`
}
function stage(result: ScanResponse) {
  if (result.status === 'invalid') return 'No contract detected'
  if (!result.pons.exists) return 'Outside configured Pons factory'
  if (result.pons.scanStatus === 'curve') return 'On the Pons curve'
  if (result.pons.scanStatus === 'graduating') return 'Graduating'
  return 'Surfaced / Graduated'
}
function scoreColor(score: number | null) {
  if (score === null) return '#aaa7af'
  if (score >= 80) return '#41dba4'
  if (score >= 50) return '#ffad50'
  return '#ff7181'
}
function scoreCategory(score: number | null, coverage: number) {
  if (score === null) return 'Insufficient evidence'
  if (coverage < 85) return 'Preliminary · Limited checks'
  if (score >= 80) return 'Fewer observed risk indicators'
  if (score >= 50) return 'Some risk indicators'
  return 'Multiple risk indicators'
}
function DetailLine({ label, value, copy }: { label: string; value: string; copy?: string | null }) {
  const [copied, setCopied] = useState(false)
  return <div className="flex min-w-0 items-center justify-between gap-3 border-b border-white/[.075] py-3 last:border-b-0">
    <span className="shrink-0 text-xs text-zinc-400">{label}</span>
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="truncate text-right text-xs font-medium text-zinc-100" title={copy || value}>{value}</span>
      {copy && <button type="button" aria-label={`Copy ${label}`} onClick={async () => { try { await navigator.clipboard.writeText(copy); setCopied(true); window.setTimeout(() => setCopied(false), 1500) } catch {} }} className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-white">{copied ? <Check size={14}/> : <Copy size={14}/>}</button>}
    </div>
  </div>
}

export function SpyScanner({ defaultContract }: { defaultContract?: string }) {
  const [ca, setCa] = useState(defaultContract || '')
  const [result, setResult] = useState<ScanResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scannedCA, setScannedCA] = useState('')

  async function scan(value = ca) {
    const clean = value.trim()
    if (!CA_RE.test(clean) || loading) {
      if (!CA_RE.test(clean)) setError('Enter a valid 0x contract address (40 hexadecimal characters).')
      return
    }
    setError('')
    setLoading(true)
    setResult(null)
    try {
      const response = await fetch(`/api/spy/scan?address=${encodeURIComponent(clean)}`, { cache: 'no-store' })
      const data = await response.json() as ScanResponse
      setResult(data)
      setScannedCA(clean)
      if (!response.ok) setError(data.message || 'Unable to scan this contract.')
    } catch { setError('Unable to contact the scanner. Please try again.') }
    finally { setLoading(false) }
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void scan() }
  async function paste() {
    try { const text = await navigator.clipboard.readText(); setCa(text.trim()); setError('') }
    catch { setError('Clipboard access was blocked. Paste the CA manually.') }
  }

  const valid = result && (result.status === 'ok' || result.status === 'external')
  const risk = valid ? result.risk : undefined
  const score = risk?.score ?? null
  const coverage = risk?.coverage ?? 0
  const tone = scoreColor(score)
  const isCurve = result?.pons.scanStatus === 'curve'
  const isNativeCurve = isCurve && result?.pons.nativeQuote === true
  const warnings = result?.warnings ?? []

  return <div className="spy-scanner-page mx-auto w-full max-w-[1220px] space-y-5 pb-14 text-white">
    <div className={`${card} relative overflow-hidden px-5 py-7 sm:px-9 sm:py-9`}>
      <div className="pointer-events-none absolute -right-24 -top-32 size-72 rounded-full border border-[#ff781f]/15" aria-hidden="true"/>
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-[#ff9b52]"><Radar size={14}/> SPY / CONTRACT SCANNER</div>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Know what you&apos;re trading.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Explore Pons contract details and evidence-based risk signals on Robinhood Chain.</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-2 rounded-2xl border border-white/15 bg-[#09090b] p-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5">
          <Fingerprint size={18} className="shrink-0 text-zinc-500"/>
          <input value={ca} onChange={event => { setCa(event.target.value); setError('') }} className="min-w-0 w-full bg-transparent font-mono text-xs text-white outline-none placeholder:text-zinc-500 sm:text-sm" placeholder="Paste a token contract address (0x...)" aria-label="Token contract address" spellCheck={false}/>
          <button type="button" onClick={paste} aria-label="Paste contract address" className="shrink-0 p-1 text-zinc-400 hover:text-white"><Clipboard size={17}/></button>
        </div>
        <button type="submit" disabled={!CA_RE.test(ca.trim()) || loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#ff781f] px-6 text-sm font-bold text-[#150d07] transition hover:brightness-110 disabled:opacity-40">
          {loading ? <LoaderCircle className="animate-spin" size={16}/> : <Search size={16}/>} {loading ? 'Scanning...' : 'Scan contract'}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <span>Read-only · No wallet connection required</span>
        {defaultContract && CA_RE.test(defaultContract) && <button type="button" className="text-[#ff9c52] hover:underline" onClick={() => { setCa(defaultContract); void scan(defaultContract) }}>· Scan $SPYHOOKS</button>}
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-200">{error}</p>}
    </div>

    {!result && !loading && <div className={`${card} flex flex-col items-center gap-2 px-5 py-12 text-center`}>
      <ShieldQuestion size={32} className="text-[#ff8b2b]"/>
      <h2 className="mt-2 font-semibold">Ready to scan</h2>
      <p className="max-w-md text-sm text-zinc-400">Enter a CA to see the SPY risk assessment, Pons trading stage and contract information.</p>
    </div>}
    {loading && <div className={`${card} flex items-center justify-center gap-3 px-6 py-12 text-sm text-zinc-400`}><LoaderCircle size={21} className="animate-spin text-[#ff8b2b]"/> Checking contract and on-chain signals...</div>}

    {result && <>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <section className={`${card} min-w-0 overflow-hidden`}>
          <div className="border-b border-white/[.09] px-5 py-5 sm:px-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[.18em] text-[#ff9b52]"><Shield size={15}/> SPY RISK ASSESSMENT</div>
                <h2 className="mt-2 break-words text-2xl font-bold tracking-tight">{result.token.name || 'Contract overview'}</h2>
                <p className="mt-1 text-sm text-zinc-400">{result.token.symbol ? `$${result.token.symbol}` : 'Unknown ticker'} · Robinhood Chain</p>
              </div>
              <span className="rounded-full border border-[#ff781f]/35 bg-[#ff781f]/10 px-3 py-1.5 text-[11px] font-medium text-[#ffab70]">{stage(result)}</span>
            </div>
            <div className="mt-3 flex items-center gap-2"><span className="break-all font-mono text-[11px] text-zinc-500">{short(result.address)}</span><button type="button" className="text-zinc-400 hover:text-white" aria-label="Copy contract address" onClick={() => { void navigator.clipboard.writeText(result.address).catch(() => {}) }}><Copy size={13}/></button></div>
          </div>
          <div className="grid gap-6 px-5 py-6 sm:grid-cols-[164px_1fr] sm:px-7">
            <div className="flex items-center justify-center">
              <div className="flex size-[158px] shrink-0 items-center justify-center rounded-full p-[9px]" style={{background:`conic-gradient(${tone} ${score ?? 0}%, #303034 0)`}}>
                <div className="flex size-full flex-col items-center justify-center rounded-full bg-[#111113]">
                  <strong className="text-5xl font-bold tabular-nums" style={{color: score === null ? '#ddd' : tone}}>{score ?? '—'}</strong>
                  <span className="mt-1 text-xs text-zinc-500">/ 100</span>
                </div>
              </div>
            </div>
            <div className="min-w-0 self-center">
              <div className="text-lg font-semibold">{scoreCategory(score,coverage)}</div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{score === null ? 'Not enough independent checks to issue a meaningful score.' : 'Higher score means fewer risk indicators among the checks that completed.'}</p>
              <div className="mt-4 flex items-center justify-between gap-2 text-xs"><span className="text-zinc-400">Scan coverage</span><span className="font-mono text-zinc-200">{coverage}%</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#ff781f] transition-[width]" style={{width:`${coverage}%`}}/></div>
              <p className="mt-2 text-[11px] leading-5 text-zinc-500">{coverage < 85 ? 'Limited evidence. Missing checks are never counted as passing.' : 'Multiple checks completed. This is still not an audit.'}</p>
            </div>
          </div>
          <div className="border-t border-[#ff781f]/20 bg-[#ff781f]/[.045] px-5 py-4 text-xs leading-5 text-[#ffbc89] sm:px-7"><Info size={15} className="mr-2 inline align-[-3px]"/> Preliminary indicators only. Not an audit, honeypot test, or guarantee that you can sell.</div>
        </section>

        <section className={`${card} min-w-0 p-5 sm:p-7`}>
          <div className="flex items-center gap-2 text-base font-semibold"><ShieldCheck size={18} className="text-[#ff892f]"/> How this score works</div>
          <p className="mt-2 text-xs leading-5 text-zinc-400">Each completed check contributes up to its weight. Unknown checks are excluded from the score and reduce coverage. A score appears only when at least two checks and 55% coverage are available.</p>
          <div className="mt-5 space-y-0">
            {(risk?.checks || []).map(item => {
              const deduction = item.points === null ? null : item.maxPoints - item.points
              return <div key={item.key} className="flex min-w-0 gap-3 border-b border-white/[.09] py-3.5 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{item.label}</div>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">{item.detail}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm font-semibold" style={{color: deduction === null ? '#a1a1aa' : deduction === 0 ? '#57d9a4' : '#ff9a58'}}>{deduction === null ? 'Unknown' : deduction === 0 ? 'No penalty' : `−${deduction}`}</div>
                  <div className="mt-1 text-[10px] text-zinc-500">Weight {item.maxPoints}</div>
                </div>
              </div>
            })}
            {!risk?.checks.length && <p className="py-8 text-sm text-zinc-500">No risk data available for this contract.</p>}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] text-zinc-400">
            <span className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 py-2 text-center text-emerald-300">80–100 · Fewer flags</span>
            <span className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-2 text-center text-amber-200">50–79 · Some flags</span>
            <span className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-2 py-2 text-center text-rose-300">0–49 · More flags</span>
          </div>
          <p className="mt-4 text-[11px] leading-5 text-zinc-500">Verification status and Pons factory membership identify the contract, but do not award risk points. Other permissions and sellability checks are not yet covered.</p>
        </section>
      </div>

      <section className={`${card} min-w-0 p-5 sm:p-7`}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 font-semibold"><Radar size={18} className="text-[#ff892f]"/> Pons trading stage</div><span className="rounded-full border border-[#ff781f]/30 bg-[#ff781f]/10 px-3 py-1 text-xs text-[#ffab70]">{stage(result)}</span></div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">{!result.pons.exists
          ? 'This contract is not registered with the currently configured Pons factory. Its origin and trading route need independent verification.'
          : isCurve
            ? 'This token is trading on its Pons bonding curve. Graduation progress is not available from the verified scanner data, so no percentage is shown.'
            : result.pons.scanStatus === 'graduating'
              ? 'Graduation readiness was detected. Check the curve and DEX route before trading.'
              : 'The token is marked as surfaced / graduated by the configured Pons factory. Pool trading conditions may differ from the bonding curve.'}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="text-[11px] uppercase tracking-wider text-zinc-500">Pons registration</div><div className="mt-2 text-sm font-semibold">{result.pons.exists ? 'Confirmed' : 'Not confirmed'}</div></div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="text-[11px] uppercase tracking-wider text-zinc-500">Quote asset</div><div className="mt-2 text-sm font-semibold">{result.pons.nativeQuote === null ? 'Unknown' : result.pons.nativeQuote ? 'Native ETH' : 'Non-native'}</div></div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="text-[11px] uppercase tracking-wider text-zinc-500">Creator tax</div><div className="mt-2 text-sm font-semibold">{result.pons.creatorTaxBps == null ? 'Unknown' : `${(result.pons.creatorTaxBps / 100).toFixed(2)}%`}</div></div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="text-[11px] uppercase tracking-wider text-zinc-500">Source verified</div><div className="mt-2 text-sm font-semibold">{result.evidence?.sourceVerified == null ? 'Unknown' : result.evidence.sourceVerified ? 'Yes' : 'Not verified'}</div></div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {result.swapUrl && <Link href={result.swapUrl} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ff781f] px-5 py-3 text-sm font-bold text-black hover:brightness-110">Swap on SpyHooks <ArrowUpRight size={16}/></Link>}
          {result.explorerUrl && <a href={result.explorerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-medium text-zinc-200 hover:border-[#ff781f]/50">View contract <ExternalLink size={15}/></a>}
        </div>
        {!result.swapUrl && <p className="mt-3 text-xs text-zinc-500">Direct swap is not confirmed for this contract. Review its route before trading.</p>}
      </section>

      <section className={`${card} p-5 sm:p-7`}>
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden"><span>Additional token & contract details</span><ChevronDown size={18} className="text-[#ff892f] transition-transform group-open:rotate-180"/></summary>
          <div className="mt-5 grid gap-6 border-t border-white/10 pt-5 sm:grid-cols-2 lg:grid-cols-3">
            <div><h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Token estimates</h3><div className="mt-2"><DetailLine label="Market cap" value={isNativeCurve ? money(result.metrics.marketCapUsd) : '—'}/><DetailLine label="Price" value={isNativeCurve ? money(result.metrics.priceUsd) : '—'}/><DetailLine label="ETH reserve" value={isNativeCurve && result.metrics.quoteReserveEth != null ? `${result.metrics.quoteReserveEth.toFixed(4)} ETH` : '—'}/><DetailLine label="Supply" value={result.token.totalSupply || '—'}/></div></div>
            <div><h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Pons routing</h3><div className="mt-2"><DetailLine label="Curve" value={short(result.pons.curveAddress)} copy={result.pons.curveAddress}/><DetailLine label="Pair token" value={short(result.pons.pairToken)} copy={result.pons.pairToken}/><DetailLine label="Deployer" value={short(result.pons.deployer)} copy={result.pons.deployer}/><DetailLine label="Fee recipient" value={short(result.pons.creatorFeeRecipient)} copy={result.pons.creatorFeeRecipient}/></div></div>
            <div><h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Contract checks</h3><div className="mt-2"><DetailLine label="Top 10 holders" value={result.evidence?.top10Percent == null ? 'Unknown' : `${result.evidence.top10Percent.toFixed(2)}%`}/><DetailLine label="Proxy indicator" value={result.evidence?.proxyIndicator == null ? 'Unknown' : result.evidence.proxyIndicator ? 'Detected' : 'No EIP-1967 slot found'}/><DetailLine label="Pool fee" value={result.pons.poolFee == null ? '—' : String(result.pons.poolFee)}/><DetailLine label="Tick spacing" value={result.pons.tickSpacing == null ? '—' : String(result.pons.tickSpacing)}/></div></div>
          </div>
          <p className="mt-4 text-xs leading-5 text-zinc-500">Curve price and market cap are approximate values only for active native-ETH curves, not post-graduation pool prices.</p>
        </details>
      </section>
      {warnings.length > 0 && <section className={`${card} p-5 sm:p-7`}><h3 className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle size={16} className="text-[#ff8b2b]"/> Notes from on-chain scan</h3><div className="mt-3 space-y-2">{warnings.map((item, i) => <p key={`${i}-${item}`} className="text-xs leading-6 text-zinc-400">{item}</p>)}</div></section>}
      <p className="text-center text-[11px] text-zinc-600">Read-only scan of {short(scannedCA)} · Evidence availability depends on the RPC and explorer.</p>
    </>}
  </div>
}
