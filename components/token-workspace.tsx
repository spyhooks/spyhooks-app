'use client'

import { useEffect, useState } from 'react'
import { RadioTower, TrendingUp, Wallet, ExternalLink, RefreshCcw } from 'lucide-react'
import { TokenBoard } from '@/components/token-board'
import { PonsTrending } from '@/components/pons-trending'
import { useWallet } from '@/components/use-wallet'
import { useConfig } from '@/components/config-provider'
import { cn } from '@/lib/utils'

type View = 'live' | 'trending' | 'portfolio'
const menu: { id: View; label: string; Icon: typeof RadioTower }[] = [
  { id: 'live', label: 'Live Tokens', Icon: RadioTower },
  { id: 'trending', label: 'Trending', Icon: TrendingUp },
  { id: 'portfolio', label: 'Portofolio', Icon: Wallet },
]

function PortfolioOverview() {
  const { account, connect } = useWallet()
  const { network, api } = useConfig()
  const [balance, setBalance] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    if (!account || !api.rpcUrl) {
      setBalance(null)
      return
    }
    const controller = new AbortController()
    setBusy(true)
    setError('')
    fetch(api.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [account, 'latest'] }),
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('RPC unavailable')
        const data = await response.json() as { result?: string; error?: { message?: string } }
        if (!data.result || !/^0x[0-9a-f]+$/i.test(data.result)) throw new Error(data.error?.message || 'Invalid RPC response')
        return data.result
      })
      .then((hex) => {
        const wei = BigInt(hex)
        const whole = wei / 10n ** 18n
        const fractional = (wei % 10n ** 18n).toString().padStart(18, '0').slice(0, 6)
        setBalance(`${whole.toString()}.${fractional}`)
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setBalance(null)
          setError(reason instanceof Error ? reason.message : 'Balance unavailable')
        }
      })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [account, api.rpcUrl, revision])

  const explorer = /^https:\/\//i.test(network.explorerUrl) ? network.explorerUrl.replace(/\/$/, '') : ''
  return (
    <section aria-labelledby="portfolio-title" className="rounded-3xl border border-white/15 bg-[#111112]/90 p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="portfolio-title" className="text-2xl font-bold tracking-tight">Portofolio</h2>
          <p className="mt-1 text-sm text-zinc-400">Ringkasan wallet di {network.name}</p>
        </div>
        {account && <button type="button" onClick={() => setRevision((n) => n + 1)} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-xs text-zinc-300 hover:border-[#ff781f]/60"><RefreshCcw className="size-3.5" /> Refresh balance</button>}
      </div>
      {!account ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-6 text-center">
          <Wallet className="mx-auto mb-3 size-8 text-[#ff781f]" />
          <p className="font-semibold">Connect wallet to view your portfolio</p>
          <p className="mt-1 text-sm text-zinc-400">Hanya membaca alamat dan saldo. Tidak meminta tanda tangan transaksi.</p>
          <button type="button" onClick={() => void connect()} className="mt-4 rounded-full bg-[#ff781f] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#ff9b4a]">Connect wallet</button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Connected address</p>
            <p className="mt-2 break-all font-mono text-sm">{account}</p>
            {explorer && <a className="mt-2 inline-flex items-center gap-1 text-xs text-[#ff9b4a] hover:underline" href={`${explorer}/address/${account}`} target="_blank" rel="noopener noreferrer">View in explorer <ExternalLink className="size-3" /></a>}
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Native balance ({network.currency})</p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums">{busy ? 'Loading…' : balance === null ? '—' : `${balance} ${network.currency}`}</p>
            {error && <p className="mt-2 text-xs text-zinc-400">Saldo belum tersedia: {error}</p>}
          </div>
          <p className="text-xs text-zinc-400">Saldo token ERC-20 dan valuasi portofolio belum dihitung. Tidak ada angka estimasi yang dibuat-buat.</p>
        </div>
      )}
    </section>
  )
}

export function TokenWorkspace() {
  const [view, setView] = useState<View>('live')
  return (
    <div className="relative min-w-0">
      <aside aria-label="Token workspace navigation" className="mb-5 w-full rounded-2xl border border-white/10 bg-[#111112]/95 p-2 min-[1400px]:absolute min-[1400px]:right-[calc(100%+12px)] min-[1400px]:top-0 min-[1400px]:mb-0 min-[1400px]:w-[clamp(125px,calc((100vw-1152px)/2-28px),208px)]">
        <div className="flex flex-wrap gap-1 min-[1400px]:flex-col" role="group" aria-label="Token views">
          {menu.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-pressed={view === id}
              className={cn(
                'inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-medium transition-colors sm:text-sm min-[1400px]:flex-none min-[1400px]:justify-start',
                view === id
                  ? 'border border-[#ff781f]/45 bg-gradient-to-r from-[#6b2f0b] to-[#28160d] text-white shadow-[inset_0_1px_0_rgba(255,160,85,0.13)]'
                  : 'border border-transparent text-zinc-300 hover:bg-white/5 hover:text-white'
              )}
            >
              <Icon className={cn('size-4 shrink-0', view === id ? 'text-[#ff8b36]' : 'text-zinc-300')} aria-hidden="true" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      </aside>
      <div className="min-w-0">
        {view === 'live' && <TokenBoard key="live" />}
        {view === 'trending' && <PonsTrending />}
        {view === 'portfolio' && <PortfolioOverview />}
      </div>
    </div>
  )
}
