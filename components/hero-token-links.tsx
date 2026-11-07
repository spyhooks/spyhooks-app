'use client'

import { useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { useConfig } from '@/components/config-provider'
import { OnchainTokenStats } from '@/components/onchain-token-stats'

const ZERO_ADDRESS = /^0x0{40}$/i
const VALID_CA = /^0x[a-fA-F0-9]{40}$/

export function HeroTokenLinks() {
  const { token } = useConfig()
  const ca = token.contract?.trim() ?? ''
  const configured = VALID_CA.test(ca) && !ZERO_ADDRESS.test(ca)
  const url = token.chartUrl?.trim() ?? ''
  const chartReady = /^https:\/\//i.test(url)
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    if (!configured) return
    try { await navigator.clipboard.writeText(ca); setCopied(true); window.setTimeout(() => setCopied(false), 1800) } catch { setCopied(false) }
  }
  return (
    <div className="mx-auto w-full max-w-sm space-y-2">
      <OnchainTokenStats />
      <p className="text-center font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">{token.ticker || 'Token'} · Contract Address</p>
      <div className="glass flex items-center gap-2 rounded-xl px-3 py-2.5">
        <code className="min-w-0 flex-1 break-all font-mono text-[11px] leading-5 text-foreground">{configured ? ca : 'Contract address not configured'}</code>
        <button type="button" onClick={() => void copy()} disabled={!configured} aria-label={copied ? 'Copied' : 'Copy full contract address'} title="Copy contract address" className="shrink-0 rounded-lg border border-border p-2 transition hover:bg-muted disabled:opacity-40">{copied ? <Check className="size-4" /> : <Copy className="size-4" />}</button>
      </div>
      {chartReady ? <a href={url} target="_blank" rel="noopener noreferrer" className="bg-brand flex h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold text-primary-foreground transition hover:brightness-110">View Chart <ExternalLink className="size-4" /></a> : <span className="glass flex h-10 items-center justify-center rounded-full text-xs text-muted-foreground" title="Set token.chartUrl in public/config.json">Chart link not configured</span>}
    </div>
  )
}
