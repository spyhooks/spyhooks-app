export type TokenRow = {
  name: string
  ticker: string
  launchpad: string
  progress: number
  mcap: number
  volume: number
  ageMinutes: number
  /** Actual chain launch block when available. */
  launchBlock?: number
  status: 'curve' | 'graduating' | 'graduated'
  price: number
  address: string
  logoUrl?: string
  /** Per-launch Pons bonding curve address; required for pre-graduation trades. */
  curveAddress?: string
}

const t = (
  name: string,
  ticker: string,
  launchpad: string,
  progress: number,
  mcap: number,
  volume: number,
  ageMinutes: number,
  price: number,
  i: number,
): TokenRow => ({
  name,
  ticker,
  launchpad,
  progress,
  mcap,
  volume,
  ageMinutes,
  price,
  status: progress >= 100 ? 'graduated' : 'curve',
  address: `0x${(i + 1).toString(16).padStart(4, '0')}a1c9e07d5b3f42688d0c7e91b4a${(i * 7919).toString(16).padStart(9, '0')}`.slice(0, 42),
})

export const sampleTokens: TokenRow[] = [
  t('DiggerChain', 'DCG', 'Pons', 45, 0.799, 0, 1, 0.0000008, 0),
  t('Please Don’t Tokenize My Stock', 'STOCK', 'Pons', 1, 0.0101, 0, 4, 0.00000001, 1),
  t('OPENFORK', 'FORK', 'Pons', 2, 0.0228, 0, 14, 0.00000002, 2),
  t('Fuse', 'FUSE', 'Pons', 10, 0.1229, 0, 56, 0.0000001, 3),
  t('Digimon on Hood', 'DGRH', 'Pons', 69, 1.65, 0.004, 60, 0.0000016, 4),
  t('Vector Privacy', 'VECTOR', 'Pons', 61, 1.29, 0.01, 62, 0.0000013, 5),
  t('Prism', 'PRISM', 'Pons', 89, 2.94, 0.0179, 120, 0.0000029, 6),
  t('Bestiarypad', 'PET', 'Bestiarypad', 59, 1.21, 0, 180, 0.0000012, 7),
  t('Moon Cat Climber', 'MCAT', 'Pons', 0, 0.00036, 0, 130, 0.0000000004, 8),
  t('Ghost Vault', 'GHOSTVAULT', 'Pons', 2, 0.0292, 0, 140, 0.00000003, 9),
  t('SPLIT', 'SPLIT', 'Pons', 7, 0.0912, 0, 150, 0.00000009, 10),
  t('Orca Signal', 'ORCA', 'Bestiarypad', 100, 3.4, 0.092, 1500, 0.0000034, 11),
  t('Tidal', 'TIDE', 'Pons', 100, 3.4, 0.041, 2900, 0.0000034, 12),
  t('Sonar Cash', 'SONAR', 'Bestiarypad', 100, 3.4, 0.12, 4400, 0.0000034, 13),
]

export function formatAge(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`
  return `${Math.floor(minutes / 1440)}d`
}

export function formatEth(value: number) {
  if (value === 0) return '0'
  if (value >= 1) return value.toFixed(2)
  if (value >= 0.001) return value.toFixed(4)
  return value.toExponential(1)
}

/** USD denomination of an ETH-based bonding-curve market-cap estimate. */
export function formatUsdMarketCap(mcapEth: number, ethUsd: number | null): string {
  if (ethUsd === null || !Number.isFinite(mcapEth) || mcapEth < 0) return '—'
  const value = mcapEth * ethUsd
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
