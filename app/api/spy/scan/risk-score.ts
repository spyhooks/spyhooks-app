/** A transparent preliminary risk-signal heuristic, NOT an audit or safety certification. */
export type RiskCheck = {
  key: 'verified' | 'holders' | 'creatorTax' | 'proxy' | 'ponsFactory'
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
  const checks: RiskCheck[] = [
    {
      key: 'ponsFactory', label: 'Pons factory provenance', maxPoints: 20,
      points: input.ponsFactory === null ? null : input.ponsFactory ? 20 : 0,
      detail: input.ponsFactory === null ? 'Not checked' : input.ponsFactory
        ? 'Factory registration confirmed on-chain (not an audit)'
        : 'Not registered in the configured Pons factory',
    },
    {
      key: 'verified', label: 'Source code verified', maxPoints: 25,
      points: input.verified === null ? null : input.verified ? 25 : 0,
      detail: input.verified === null ? 'Not checked' : input.verified ? 'Verified by Blockscout' : 'Not verified on Blockscout',
    },
    {
      key: 'holders', label: 'Top 10 concentration', maxPoints: 35,
      points: input.top10Percent === null ? null : input.top10Percent <= 10 ? 35 : input.top10Percent <= 25 ? 27 : input.top10Percent <= 40 ? 18 : input.top10Percent <= 60 ? 8 : 0,
      detail: input.top10Percent === null ? 'Not checked' : `${input.top10Percent.toFixed(2)}% of total supply held by the ten largest addresses (may include pools/contracts)`,
    },
    {
      key: 'creatorTax', label: 'Pons creator tax', maxPoints: 20,
      points: input.creatorTaxBps === null ? null : input.creatorTaxBps <= 100 ? 20 : input.creatorTaxBps <= 300 ? 14 : input.creatorTaxBps <= 500 ? 7 : 0,
      detail: input.creatorTaxBps === null ? 'Not checked / not applicable' : `${(input.creatorTaxBps / 100).toFixed(2)}% creator tax (other fees may apply)`,
    },
    {
      key: 'proxy', label: 'Upgradeable proxy indicator', maxPoints: 20,
      points: input.proxy === null ? null : input.proxy ? 0 : 20,
      detail: input.proxy === null ? 'Not checked' : input.proxy ? 'Possible proxy/upgradeable contract reported by Blockscout' : 'No proxy classification reported by Blockscout',
    },
  ]
  const possiblePoints = checks.reduce((n, c) => n + c.maxPoints, 0)
  const eligible = checks.filter((c) => c.points !== null)
  const evaluatedMax = eligible.reduce((n, c) => n + c.maxPoints, 0)
  const evaluatedPoints = eligible.reduce((n, c) => n + (c.points ?? 0), 0)
  const coverage = Math.round((evaluatedMax / possiblePoints) * 100)
  // Two independent checks are required; provenance plus creator tax can produce
  // a LIMITED-EVIDENCE score even when Blockscout is unavailable. Unknown checks
  // remain excluded from both numerator and denominator.
  const score = coverage >= 30 && eligible.length >= 2
    ? Math.round((evaluatedPoints / evaluatedMax) * 100) : null
  const label = score === null ? 'Insufficient data' : coverage < 60 ? 'Limited evidence' : score >= 75 ? 'Fewer observed flags' : score >= 45 ? 'Some risk signals' : 'Elevated risk signals'
  return {
    score, coverage, evaluatedPoints, possiblePoints, label, checks,
    disclaimer: 'Preliminary signal score from available checks only. When coverage is low, a high score is not evidence of overall safety. Not an audit, honeypot test, guarantee of sellability, or proof a token is safe. Unknown signals are excluded from scoring; check coverage before interpreting the score.',
  }
}
