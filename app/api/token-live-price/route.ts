import { NextResponse } from 'next/server'
import { createPublicClient, formatUnits, http, parseAbi, type Address } from 'viem'
import { getServerConfig } from '@/lib/config.server'
import { curveAbi, factoryAbi, robinhoodChain, PONS_FACTORY, RPC_URL } from '@/lib/pons-trading'

export const dynamic = 'force-dynamic'

const VALID_ADDRESS = /^0x[0-9a-f]{40}$/i
const ZERO = '0x0000000000000000000000000000000000000000'
const TOKEN_DECIMALS_ABI = parseAbi(['function decimals() view returns (uint8)'])
const CACHE_TTL = 12_000

type PriceResponse = {
  status: 'ok' | 'awaiting_launch' | 'unsupported' | 'unavailable'
  priceUsd: number | null
  updatedAt: string | null
  reason: string | null
}

let cache: { key: string; until: number; value: PriceResponse } | null = null
let inFlight: { key: string; promise: Promise<PriceResponse> } | null = null

function response(value: PriceResponse) {
  return NextResponse.json(value, { headers: { 'Cache-Control': 'no-store, max-age=0', 'Pragma': 'no-cache' } })
}

function missing(status: PriceResponse['status'], reason: string): PriceResponse {
  return { status, priceUsd: null, updatedAt: null, reason }
}

async function getEthUsd(): Promise<number | null> {
  // Same public ETH/USD sources as the site's current on-chain stats endpoint.
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {
      cache: 'no-store', signal: AbortSignal.timeout(4500),
    })
    if (res.ok) {
      const value = (await res.json() as { ethereum?: { usd?: number } }).ethereum?.usd
      if (typeof value === 'number' && value > 0 && Number.isFinite(value)) return value
    }
  } catch { /* fallback below */ }
  try {
    const res = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot', {
      cache: 'no-store', signal: AbortSignal.timeout(4500),
    })
    if (res.ok) {
      const value = Number((await res.json() as { data?: { amount?: string } }).data?.amount)
      if (value > 0 && Number.isFinite(value)) return value
    }
  } catch { /* source unavailable */ }
  return null
}

async function readPrice(ca: Address, rpcUrl: string, factory: Address): Promise<PriceResponse> {
  const client = createPublicClient({ chain: robinhoodChain, transport: http(rpcUrl, { timeout: 12_000 }) })
  const launched = await client.readContract({
    address: factory, abi: factoryAbi, functionName: 'getLaunchedToken', args: [ca],
  })
  if (!launched.exists || launched.curve.toLowerCase() === ZERO) {
    return missing('unsupported', 'Token not found in the configured Pons factory.')
  }
  if (launched.sweptAt > 0n) {
    return missing('unsupported', 'Token graduated: its Uniswap v4 pool needs a separate price source.')
  }
  if (launched.pairToken.toLowerCase() !== ZERO) {
    return missing('unsupported', 'Token is not paired with native ETH.')
  }

  const [reserves, decimals, nativeQuote, rate] = await Promise.all([
    client.readContract({ address: launched.curve, abi: curveAbi, functionName: 'getReserves' }),
    client.readContract({ address: ca, abi: TOKEN_DECIMALS_ABI, functionName: 'decimals' }),
    client.readContract({ address: launched.curve, abi: curveAbi, functionName: 'isNativeQuote' }),
    getEthUsd(),
  ])
  if (!nativeQuote || rate == null) return missing('unavailable', 'Native ETH price conversion is not available.')

  const [reserveEthRaw, reserveTokenRaw] = reserves
  if (reserveTokenRaw <= 0n || reserveEthRaw < 0n) return missing('unavailable', 'Invalid curve reserves.')
  const ethReserve = Number(formatUnits(reserveEthRaw, 18))
  const tokenReserve = Number(formatUnits(reserveTokenRaw, Number(decimals)))
  const priceUsd = (ethReserve / tokenReserve) * rate
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return missing('unavailable', 'Cannot calculate the curve spot price.')
  return { status: 'ok', priceUsd, updatedAt: new Date().toISOString(), reason: 'Indicative bonding-curve spot price (before fees and price impact).' }
}

export async function GET() {
  const config = await getServerConfig()
  const ca = config.token.contract?.trim() ?? ''
  if (!VALID_ADDRESS.test(ca) || ca.toLowerCase() === ZERO)
    return response(missing('awaiting_launch', 'Configure token.contract after the token launches.'))
  const rpcUrl = config.api.rpcUrl || RPC_URL
  const factory = config.api.ponsFactory || PONS_FACTORY
  if (!/^https:\/\//i.test(rpcUrl) || !VALID_ADDRESS.test(factory))
    return response(missing('unavailable', 'Invalid RPC or factory configuration.'))

  const key = `${ca.toLowerCase()}:${factory.toLowerCase()}:${rpcUrl}`
  if (cache?.key === key && Date.now() < cache.until) return response(cache.value)
  if (inFlight?.key !== key) {
    const promise = readPrice(ca as Address, rpcUrl, factory as Address)
    inFlight = { key, promise }
    void promise.finally(() => { if (inFlight?.promise === promise) inFlight = null }).catch(() => undefined)
  }
  try {
    const value = await inFlight.promise
    if (value.status === 'ok' || value.status === 'unsupported') {
      cache = { key, value, until: Date.now() + CACHE_TTL }
    }
    return response(value)
  } catch (error) {
    console.error('[token-live-price] Failed to retrieve token price:', error)
    return response(missing('unavailable', 'Price data temporarily unavailable.'))
  }
}
