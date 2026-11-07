'use client'

import { useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { useConfig } from '@/components/config-provider'
import { XIcon } from '@/components/x-icon'

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="rounded-2xl bg-background/60 p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <code className="truncate font-mono text-sm">{value || 'Not set in config.json'}</code>
        {value && (
          <button type="button" onClick={copy} aria-label={`Copy ${label}`} className="shrink-0 rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-primary">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </button>
        )}
      </div>
    </div>
  )
}

export function TokenInfo() {
  const { token, logo, links, fees, network, siteName } = useConfig()
  const feePct = (fees.bps / 100).toFixed(2)

  return (
    <section className="grid gap-6 py-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="glass flex flex-col items-center rounded-[2rem] p-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt={`${token.name} logo`} className="size-36 rounded-[1.75rem] object-contain shadow-2xl shadow-black/30" />
        <h1 className="mt-6 text-4xl font-bold tracking-tight">
          <span className="text-gradient">${token.ticker}</span>
        </h1>
        <p className="mt-1 text-muted-foreground">{token.name}</p>
        <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
          The native token of {siteName}. Router fees collected from every routed swap flow to the fee wallet.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {token.buyUrl && (
            <a href={token.buyUrl} target="_blank" rel="noopener noreferrer" className="bg-brand inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30">
              Buy ${token.ticker} <ExternalLink className="size-4" />
            </a>
          )}
          {links.x && (
            <a href={links.x} target="_blank" rel="noopener noreferrer" className="glass inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold hover:text-primary">
              <XIcon className="size-4" /> Follow
            </a>
          )}
        </div>
      </div>

      <div className="glass space-y-3 rounded-[2rem] p-6">
        <h2 className="px-1 text-xl font-semibold">Token details</h2>
        <CopyField label="Contract" value={token.contract} />
        <CopyField label="Fee wallet" value={fees.wallet} />
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Network', value: network.name },
            { label: 'Supply', value: token.supply || '—' },
            { label: 'Router fee', value: `${feePct}%` },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl bg-background/60 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{item.label}</p>
              <p className="mt-1.5 font-mono text-sm">{item.value}</p>
            </div>
          ))}
        </div>
        {token.contract && network.explorerUrl && (
          <a href={`${network.explorerUrl}/address/${token.contract}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-1 pt-2 text-sm font-semibold text-primary hover:underline">
            View on explorer <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
    </section>
  )
}
