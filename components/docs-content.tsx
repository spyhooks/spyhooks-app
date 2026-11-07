'use client'

import { useConfig } from '@/components/config-provider'

export function DocsContent() {
  const { siteName, network, fees, token } = useConfig()

  const sections = [
    {
      id: 'overview',
      title: 'Overview',
      body: `${siteName} is a ${network.dex} hook that makes launchpad bonding-curve tokens visible to Uniswap. Without it, a token on a curve cannot be found by any Uniswap router until it graduates.`,
    },
    {
      id: 'how-it-works',
      title: 'How it works',
      body: `When a token is hooked, a ${network.dex} pool is registered for it. Any swap into that pool is intercepted by the hook and forwarded to the launchpad's curve, so the buyer pays the curve's own price. After graduation the hook steps aside and liquidity moves to the regular pool.`,
    },
    {
      id: 'opening',
      title: 'Opening a token',
      body: `Launch on a supported launchpad, then open the token from the Tokens tab. One transaction registers the pool and the hook. From that moment aggregators and wallets can route to your curve.`,
    },
    {
      id: 'swap',
      title: 'Swapping',
      body: `Use the Swap tab to buy or sell any hooked token. Quotes are calculated from the curve price and include the router fee. Connect any EIP-1193 wallet to trade on ${network.name}.`,
    },
    {
      id: 'fees',
      title: 'Fees',
      body: `A router fee of ${(fees.bps / 100).toFixed(2)}% is applied to routed swaps and sent to the fee wallet ${fees.wallet || '(not configured)'}. Launchpad curve fees are unchanged.`,
    },
    {
      id: 'token',
      title: `$${token.ticker}`,
      body: `$${token.ticker} is the ${siteName} token. Its contract address, supply and fee wallet are available on the $${token.ticker} tab.`,
    },
  ]

  return (
    <div className="grid gap-8 py-6 lg:grid-cols-[14rem_1fr]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <h1 className="text-3xl font-bold tracking-tight">Docs</h1>
        <nav aria-label="Docs sections" className="glass mt-4 flex flex-wrap gap-1 rounded-3xl p-2 lg:flex-col">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="rounded-full px-4 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground">
              {s.title}
            </a>
          ))}
          <a href="#config" className="rounded-full px-4 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground">
            Configuration
          </a>
        </nav>
      </aside>

      <article className="space-y-5">
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="glass scroll-mt-6 rounded-3xl p-6">
            <h2 className="text-xl font-semibold">{s.title}</h2>
            <p className="mt-2 leading-relaxed text-muted-foreground">{s.body}</p>
          </section>
        ))}
      </article>
    </div>
  )
}
