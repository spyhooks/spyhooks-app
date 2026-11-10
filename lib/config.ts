export type NavItem = { key: string; label: string; href: string }

export type SiteConfig = {
  siteName: string
  tagline: string
  description: string
  logo: string
  favicon: string
  token: {
    name: string
    ticker: string
    contract: string
    supply: string
    buyUrl: string
    chartUrl?: string
    /** Optional manual values in USD, copied from a trusted market data source. */
    volume24hUsd?: number | null
    liquidityUsd?: number | null
  }
  /** Site-wide count floor for confirmed surfaced tokens. Update as more tokens graduate. */
  stats?: { surfacedCount?: number; launchStartBlock?: number; launchStartAt?: string }
  network: {
    name: string
    currency: string
    dex: string
    explorerUrl: string
  }
  links: {
    x: string
    xHandle: string
    github?: string
    telegram: string
    website: string
    docs: string
  }
  fees: { wallet: string; bps: number }
  swap: { routerAddress: string }
  api: { tokensUrl: string; rpcUrl?: string; ponsFactory?: string }
  hero: { eyebrow: string; title: string; subtitle: string }
  nav: NavItem[]
  launchpads: { name: string; chain: string; url: string; description: string; logo?: string }[]
}

export const fallbackConfig: SiteConfig = {
  siteName: 'SpyHooks',
  tagline: 'Hook the curve. Surface on Uniswap.',
  description: 'Routes Uniswap v4 swaps into launchpad bonding curves.',
  logo: '/logo.png',
  favicon: '/logo.png',
  token: { name: 'SPYHOOKS', ticker: 'SPYHOOKS', contract: '', supply: '', buyUrl: '', chartUrl: '', volume24hUsd: null, liquidityUsd: null },
  stats: { surfacedCount: 0 },
  network: { name: 'Robinhood Chain', currency: 'ETH', dex: 'Uniswap v4', explorerUrl: '' },
  links: { x: '', xHandle: '', telegram: '', website: '', docs: '/docs' },
  fees: { wallet: '', bps: 50 },
  swap: { routerAddress: '' },
  api: { tokensUrl: '' },
  hero: { eyebrow: '', title: '', subtitle: '' },
  nav: [
    { key: 'tokens', label: 'Tokens', href: '/' },
    { key: 'swap', label: 'Swap', href: '/swap' },
    { key: 'launchpads', label: 'Launchpads', href: '/launchpads' },
    { key: 'token', label: '$SPYHOOKS', href: '/token' },
    { key: 'docs', label: 'Docs', href: '/docs' },
  ],
  launchpads: [],
}

export function shortAddress(address: string) {
  if (!address || address.length < 12) return address || '—'
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}
