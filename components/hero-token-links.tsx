'use client'

import { useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { useConfig } from '@/components/config-provider'
import { OnchainTokenStats } from '@/components/onchain-token-stats'
import { LiveTokenPrice } from '@/components/live-token-price'

const ZERO_ADDRESS = /^0x0{40}$/i
const VALID_CA = /^0x[a-fA-F0-9]{40}$/

/** Static token identity card. The provided artwork supplies the entire border/background. */
export function HeroTokenLinks() {
  const { token, logo, siteName } = useConfig()
  const ca = token.contract?.trim() ?? ''
  const configured = VALID_CA.test(ca) && !ZERO_ADDRESS.test(ca)
  const chartUrl = token.chartUrl?.trim() ?? ''
  const chartReady = configured && /^https:\/\//i.test(chartUrl)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (!configured) return
    try {
      await navigator.clipboard.writeText(ca)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section
      aria-label={`${siteName} token overview`}
      className="relative isolate w-full min-h-[550px] overflow-hidden rounded-[24px] bg-[#0c0b0c] text-white shadow-[0_16px_55px_rgba(0,0,0,.45)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 select-none bg-[url('/spyhooks-token-card-bg.webp')] bg-[length:100%_100%] bg-center bg-no-repeat"
      />

      <div className="relative z-10 flex min-h-[550px] flex-col px-7 pb-8 pt-9 sm:px-8">
        {/* Static logo only: no mouse tilt, cube faces or 3D borders. */}
        <div className="flex shrink-0 items-center justify-center">
          <img
            src={logo}
            alt={`${siteName} logo`}
            width={128}
            height={128}
            draggable={false}
            className="block h-[128px] w-[128px] select-none rounded-[24px] object-contain drop-shadow-[0_9px_16px_rgba(0,0,0,.35)]"
          />
        </div>

        <div className="mt-2 flex min-h-7 flex-wrap items-center justify-center gap-2">
          <h2 className="text-center text-[17px] font-black italic uppercase leading-tight tracking-[.04em] text-white sm:text-lg">
            {token.name || siteName}
          </h2>
          <span className="rounded-full border border-[#ff821c]/70 bg-black/55 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#ff941f]">
            Token
          </span>
        </div>

        <LiveTokenPrice />

        <div className="mt-3">
          <OnchainTokenStats />
        </div>

        <div className="mt-3 border-t border-white/15 pt-3">
          <p className="mb-2 text-center font-mono text-[9px] uppercase tracking-[.18em] text-neutral-300">
            Contract Address
          </p>
          <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/25 bg-black/65 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,.035)]">
            <div
              className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:thin]"
              title={configured ? ca : 'Not configured'}
            >
              <code className="block w-max whitespace-nowrap font-mono text-[9px] leading-5 text-white sm:text-[10px]">
                {configured ? ca : 'Not configured'}
              </code>
            </div>
            <button
              type="button"
              onClick={() => void copy()}
              disabled={!configured}
              aria-label={copied ? 'Address copied' : 'Copy contract address'}
              title={copied ? 'Copied!' : 'Copy full contract address'}
              className="shrink-0 rounded-xl border border-white/20 bg-white/5 p-2 text-white transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </button>
          </div>
        </div>

        {chartReady ? (
          <a
            href={chartUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex h-10 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/90 text-xs font-semibold text-black transition hover:bg-white"
          >
            View Chart <ExternalLink className="size-3.5" />
          </a>
        ) : (
          <span
            aria-disabled="true"
            className="mt-3 flex h-10 cursor-not-allowed items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-xs text-neutral-300"
          >
            Chart Unavailable
          </span>
        )}
      </div>
    </section>
  )
}
