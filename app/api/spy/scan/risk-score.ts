/**
 * Preliminary, coverage-aware heuristics. This score is NOT an audit, a
 * sellability guarantee, or a prediction of losses. Provenance and verified
 * source are informational checks, not points for token safety.
 */
export type RiskCheck = {
  key: 'holders' | 'creatorTax' | 'proxy'
  label: string
  maxPoints: number
  points: number | null
  detail: string
}

export type RiskAssessment = {
  score: number | null
  coverage: number
  evaluatedPoints: number
  possiblePoints: number
  label: string
  checks: RiskCheck[]
  disclaimer: string
}

export function assessRisk(input: {
  verified: boolean | null
  top10Percent: number | null
  creatorTaxBps: number | null
  proxy: boolean | null
  ponsFactory: boolean | null
}): RiskAssessment {
  const holder = input.top10Percent
  const tax = input.creatorTaxBps
  const checks: RiskCheck[] = [
    {
      key: 'holders', label: 'Top 10 holder concentration', maxPoints: 40,
      points: holder === null ? null : holder <= 15 ? 40 : holder <= 30 ? 30 : holder <= 50 ? 18 : holder <= 70 ? 7 : 0,
      detail: holder === null ? 'Not available from the explorer' : `${holder.toFixed(2)}% of supply across top 10 addresses. Pools and locked contracts may be included.`,
    },
    {
      key: 'proxy', label: 'Upgradeability signal', maxPoints: 35,
      points: input.proxy === null ? null : input.proxy ? 0 : 35,
      detail: input.proxy === null ? 'Not checked' : input.proxy
        ? 'Proxy/implementation indicator detected; admin controls need manual review'
        : 'No EIP-1967 implementation or beacon slot detected; other upgrade methods remain possible',
    },
    {
      key: 'creatorTax', label: 'Pons creator tax', maxPoints: 25,
      points: tax === null ? null : tax <= 100 ? 25 : tax <= 300 ? 16 : tax <= 500 ? 8 : 0,
      detail: tax === null ? 'Not checked / not applicable' : `${(tax / 100).toFixed(2)}% creator tax, excluding other fees`,
    },
  ]
  const possiblePoints = checks.reduce((sum, c) => sum + c.maxPoints, 0)
  const evaluated = checks.filter((c) => c.points !== null)
  const evaluatedMax = evaluated.reduce((sum, c) => sum + c.maxPoints, 0)
  const evaluatedPoints = evaluated.reduce((sum, c) => sum + (c.points ?? 0), 0)
  const coverage = Math.round((evaluatedMax / possiblePoints) * 100)
  // At least two different evidence sources and 55% weighted coverage.
  // A high partial score must never be marketed as “safe”.
  const score = evaluated.length >= 2 && coverage >= 55
    ? Math.round((evaluatedPoints / evaluatedMax) * 100)
    : null
  const label = score === null ? 'Insufficient evidence'
    : coverage < 85 ? 'Partial assessment'
    : score < 45 ? 'Multiple risk indicators' : score < 75 ? 'Some risk indicators' : 'Fewer observed risk indicators'
  return {
    score,
    coverage,
    evaluatedPoints,
    possiblePoints,
    label,
    checks,
    disclaimer: 'Preliminary on-chain signals only. Missing checks are never treated as passing. This score cannot establish token safety, sellability, liquidity security, or honeypot status. Confirm contract controls and trading behavior independently.',
  }
}
