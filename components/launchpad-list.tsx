'use client'

import { ExternalLink, Rocket } from 'lucide-react'
import { useConfig } from '@/components/config-provider'
import { useTokens } from '@/components/use-tokens'
import { formatEth } from '@/lib/tokens'

export function LaunchpadList() {
  const { launchpads, network } = useConfig()
  const { tokens } = useTokens()

  return (
    <ul className="mt-8 grid gap-4 md:grid-cols-2">
      {launchpads.map((pad) => {
        const own = tokens.filter((t) => t.launchpad === pad.name)
        const volume = own.reduce((sum, t) => sum + t.volume, 0)
        return (
          <li key={pad.name} className="glass flex flex-col gap-5 rounded-3xl p-6">
            <div className="flex items-center gap-3">
              <span className="bg-brand flex size-12 items-center justify-center rounded-2xl text-primary-foreground">
                <Rocket className="size-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold">{pad.name}</h2>
                <p className="text-sm text-muted-foreground">{pad.chain}</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{pad.description}</p>
            <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4 font-mono text-sm">
              <div>
                <dt className="font-sans text-[11px] uppercase tracking-wider text-muted-foreground">Tokens</dt>
                <dd className="text-lg">{own.length}</dd>
              </div>
              <div>
                <dt className="font-sans text-[11px] uppercase tracking-wider text-muted-foreground">Volume</dt>
                <dd className="text-lg">
                  {formatEth(volume)} {network.currency}
                </dd>
              </div>
            </dl>
            {pad.url && (
              <a href={pad.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                Visit {pad.name} <ExternalLink className="size-3.5" />
              </a>
            )}
          </li>
        )
      })}
    </ul>
  )
}
