'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, Search } from 'lucide-react'
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

function TokenCard({ token, ethUsd }: { token: TokenRow; ethUsd: number | null }) {
  const { network } = useConfig()
  const [logoFailed, setLogoFailed] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

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
    <li className="glass group flex flex-col gap-4 rounded-3xl p-5 transition-all duration-200 motion-reduce:transition-none motion-safe:hover:-translate-y-1 hover:border-zinc-400/70 dark:hover:border-zinc-300/70 hover:shadow-[0_18px_40px_rgba(0,0,0,0.18)] dark:hover:shadow-[0_18px_45px_rgba(210,210,210,0.07)] focus-within:border-zinc-400/70">
      <div className="flex items-start gap-3">
        <div
          className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl font-mono text-sm font-medium text-white"
          style={{ background: "linear-gradient(135deg, #303030, #090909)" }}
          aria-label={`${token.ticker} token logo`}
        >
          {token.logoUrl && !logoFailed ? (
            <img
              src={token.logoUrl}
              alt={`${token.name} logo`}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setLogoFailed(true)}
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <span aria-hidden="true">{token.ticker.slice(0, 2)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{token.name}</h3>
          <p className="truncate text-xs text-muted-foreground">
            <span className="font-mono text-primary">${token.ticker}</span> · {token.launchpad} · {formatAge(token.ageMinutes)} ago
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="truncate font-mono text-[10px] text-muted-foreground" title={token.address}>
              {token.address ? `${token.address.slice(0, 6)}...${token.address.slice(-4)}` : 'CA unavailable'}
            </span>
            {token.address && (
              <button
                type="button"
                onClick={copyContract}
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition-colors hover:border-zinc-400 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                aria-label={copyStatus === 'copied' ? `Copied ${token.ticker} contract address` : `Copy ${token.ticker} contract address`}
                title={copyStatus === 'copied' ? 'Copied!' : copyStatus === 'failed' ? 'Copy failed — try again' : `Copy CA: ${token.address}`}
              >
                {copyStatus === 'copied' ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
              </button>
            )}
            <span role="status" aria-live="polite" className="sr-only">
              {copyStatus === 'copied' ? 'Contract address copied to clipboard' : copyStatus === 'failed' ? 'Unable to copy contract address' : ''}
            </span>
          </div>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
            token.status === 'graduated'
              ? 'bg-primary/15 text-primary'
              : token.status === 'graduating'
                ? 'bg-muted text-foreground'
                : 'bg-muted text-muted-foreground',
          )}
        >
          {token.status === 'graduated' ? 'Surfaced' : token.status === 'graduating' ? 'Graduating' : 'On curve'}
        </span>
      </div>

      <div>
        <div className="mb-1.5 flex justify-between font-mono text-xs text-muted-foreground">
          <span>Curve progress</span>
          <span className="text-foreground">{Math.min(token.progress, 100)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-300/60 dark:bg-zinc-800" role="progressbar" aria-valuenow={Math.min(token.progress, 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-gradient-to-r from-zinc-400 via-zinc-200 to-white dark:from-zinc-500 dark:via-zinc-300 dark:to-white transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${Math.min(token.progress, 100)}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 font-mono text-sm">
        <div>
          <p className="font-sans text-[11px] uppercase tracking-wider text-muted-foreground">Mkt cap</p>
          <span className="block text-lg font-bold leading-tight tracking-tight tabular-nums sm:text-xl" title={ethUsd === null ? "ETH/USD price unavailable" : "Estimated from bonding-curve trading price × token supply × live ETH/USD rate"}>
            {formatUsdMarketCap(token.mcap, ethUsd)}
          </span>
        </div>
        <div>
          <p className="font-sans text-[11px] uppercase tracking-wider text-muted-foreground">Routed vol</p>
          {formatEth(token.volume)} {network.currency}
        </div>
      </div>

      <Link
        href={`/swap?token=${token.ticker}`}
        className="mt-auto inline-flex h-10 items-center justify-center rounded-full border border-primary/40 text-sm font-semibold text-primary transition-colors duration-200 hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Swap via {network.dex}
      </Link>
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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tokens.filter(
      (t) => (filter === 'all' || t.status === filter) && (!q || t.name.toLowerCase().includes(q) || t.ticker.toLowerCase().includes(q)),
    )
  }, [tokens, filter, query])

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
          <label className="glass flex h-10 items-center gap-2 rounded-full px-4">
            <Search className="size-4 text-muted-foreground" />
            <span className="sr-only">Search tokens</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or ticker"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground sm:w-48"
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
            <TokenCard key={`${token.ticker}-${token.address}`} token={token} ethUsd={ethUsd} />
          ))}
        </ul>
      )}
    </section>
  )
}
