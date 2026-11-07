import { NextResponse } from 'next/server'
import { createPublicClient, http, formatUnits, parseAbi, type Address } from 'viem'
import { getServerConfig } from '@/lib/config.server'
import { curveAbi, factoryAbi, robinhoodChain, PONS_FACTORY, RPC_URL } from '@/lib/pons-trading'

export const dynamic = 'force-dynamic'

// Existing Pons curve trade event topic hashes, matching app/api/pons/route.ts.
const CURVE_BUY = '0xec36bf571f136799e8dc0b0b8bea4b04d8bd3d43de838aab0d5fc21d4cbfc455'
const CURVE_SELL = '0x8113d738abdcb6b38357e9d53a54a7157861a09031b453651f0fe7fe151f59df'
const ERC20_SUPPLY_ABI = parseAbi(['function totalSupply() view returns (uint256)', 'function decimals() view returns (uint8)'])
const CA_PATTERN = /^0x[a-f0-9]{40}$/i
const ZERO = '0x0000000000000000000000000000000000000000'
const CACHE_MS = 90_000
const FIFTEEN_MINUTES = 15 * 60_000

type Stats = {
  source: 'Robinhood Chain / Pons curve'
  status: 'ok' | 'unavailable' | 'awaiting_launch' | 'unsupported'
  reason: string | null
  marketCapUsd: number | null
  volume24hUsd: number | null
  liquidityUsd: number | null
  curveReserveEth: number | null
  updatedAt: string | null
}

const empty = (status: Stats['status'], reason: string): Stats => ({
  source: 'Robinhood Chain / Pons curve', status, reason,
  marketCapUsd: null, volume24hUsd: null, liquidityUsd: null, curveReserveEth: null, updatedAt: null,
})
let stored: { key: string; at: number; result: Stats } | null = null
let pending: { key: string; promise: Promise<Stats> } | null = null

function numberOf(raw: bigint, decimals: number): number | null {
  const n = Number(formatUnits(raw, decimals))
  return Number.isFinite(n) && n >= 0 ? n : null
}

async function ethUsd(): Promise<number | null> {
  // Uses the same independent ETH/USD reference services already used by /api/eth-usd.
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {
      cache: 'no-store', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(4000),
    })
    if (r.ok) {
      const v = (await r.json() as { ethereum?: { usd?: number } }).ethereum?.usd
      if (typeof v === 'number' && v > 0 && v < 1_000_000) return v
    }
  } catch { /* Try fallback. */ }
  try {
    const r = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot', {
      cache: 'no-store', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(4000),
    })
    if (r.ok) {
      const v = Number((await r.json() as { data?: { amount?: string } }).data?.amount)
      if (Number.isFinite(v) && v > 0 && v < 1_000_000) return v
    }
  } catch { /* Source unavailable. */ }
  return null
}

type TradeLog = { topics: string[]; data: string }
async function curveLogs(rpcUrl: string, curve: Address, fromBlock: bigint, toBlock: bigint): Promise<TradeLog[]> {
  const response = await fetch(rpcUrl, {
    method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(12000),
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'eth_getLogs',
      params: [{ address: curve, fromBlock: `0x${fromBlock.toString(16)}`, toBlock: `0x${toBlock.toString(16)}`, topics: [[CURVE_BUY, CURVE_SELL]] }],
    }),
  })
  if (!response.ok) throw new Error('RPC cannot retrieve the last 24h trading events')
  const json = await response.json() as { result?: TradeLog[]; error?: { message?: string } }
  if (!Array.isArray(json.result)) throw new Error(json.error?.message ?? 'RPC logs unavailable')
  return json.result
}

function eventQuoteWei(log: TradeLog): bigint | null {
  if (!/^0x[0-9a-f]+$/i.test(log.data)) return null
  const words = log.data.slice(2).match(/.{64}/g)
  if (!words || words.length < 3) return null
  const buy = log.topics[0]?.toLowerCase() === CURVE_BUY
  const sell = log.topics[0]?.toLowerCase() === CURVE_SELL
  if (!buy && !sell) return null
  // Same event decoding used in the existing /api/pons route:
  // Buy: quote in is word 0; Sell: quote out is word 1.
  return BigInt(`0x${words[buy ? 0 : 1]}`)
}

async function statsForToken(ca: Address, rpcUrl: string, factory: Address): Promise<Stats> {
  const client = createPublicClient({ chain: robinhoodChain, transport: http(rpcUrl, { timeout: 12000 }) })
  const launched = await client.readContract({ address: factory, abi: factoryAbi, functionName: 'getLaunchedToken', args: [ca] })
  if (!launched.exists || launched.curve.toLowerCase() === ZERO)
    return empty('unsupported', 'This token was not found in the configured Pons factory. Non-Pons tokens need a separate price/indexer integration.')
  // This method covers active Pons bonding curves, not post-graduation v4 pools.
  if (launched.sweptAt > 0n)
    return empty('unsupported', 'Token graduated or is graduating. Curve data is not equivalent to its Uniswap v4 pool statistics.')
  if (launched.pairToken.toLowerCase() !== ZERO)
    return empty('unsupported', 'Curve quote asset is not native ETH; ETH/USD conversion does not apply.')

  const [reserves, totalSupply, decimals, nativeQuote, head, usd] = await Promise.all([
    client.readContract({ address: launched.curve, abi: curveAbi, functionName: 'getReserves' }),
    client.readContract({ address: ca, abi: ERC20_SUPPLY_ABI, functionName: 'totalSupply' }),
    client.readContract({ address: ca, abi: ERC20_SUPPLY_ABI, functionName: 'decimals' }),
    client.readContract({ address: launched.curve, abi: curveAbi, functionName: 'isNativeQuote' }),
    client.getBlockNumber(),
    ethUsd(),
  ])
  if (!nativeQuote) return empty('unsupported', 'Curve uses a non-native quote asset.')
  const [quoteRaw, tokenRaw] = reserves
  const quoteReserveEth = numberOf(quoteRaw, 18)
  const tokenReserve = numberOf(tokenRaw, decimals)
  const supply = numberOf(totalSupply, decimals)
  if (quoteReserveEth == null || tokenReserve == null || supply == null)
    return empty('unavailable', 'On-chain reserve or supply could not be decoded.')

  // Curve spot ratio. Total supply used as proxy: estimate, NOT independently verified circulating market cap.
  const estMcap = usd != null && tokenReserve > 0
    ? (quoteReserveEth / tokenReserve) * supply * usd : null

  let volume24hUsd: number | null = null
  let volumeReason: string | null = null
  if (usd != null) {
    try {
      const threshold = BigInt(Math.floor(Date.now() / 1000) - 86400)
      let lo = 0n
      let hi = head
      // Find first chain block with a timestamp at/after 24h ago, avoiding block-time guesses.
      while (lo < hi) {
        const mid = (lo + hi) / 2n
        const block = await client.getBlock({ blockNumber: mid })
        if (block.timestamp < threshold) lo = mid + 1n
        else hi = mid
      }
      // RPC log limits can vary. Chunk queries to avoid oversized eth_getLogs requests.
      // Fetch chunks concurrently (bounded to 5) instead of one-by-one.
      // The 24-hour boundary is still resolved by actual block timestamps.
      const CHUNK = 2000n
      const ranges: Array<[bigint, bigint]> = []
      for (let from = lo; from <= head; from += CHUNK) {
        const to = from + CHUNK - 1n < head ? from + CHUNK - 1n : head
        ranges.push([from, to])
      }
      let next = 0
      const workers = Array.from({ length: Math.min(5, ranges.length) }, async () => {
        let subtotal = 0n
        while (next < ranges.length) {
          const [from, to] = ranges[next++]
          const logs = await curveLogs(rpcUrl, launched.curve, from, to)
          for (const log of logs) {
            const quote = eventQuoteWei(log)
            if (quote !== null) subtotal += quote
          }
        }
        return subtotal
      })
      const totals = await Promise.all(workers)
      const total = totals.reduce((sum, partial) => sum + partial, 0n)
      const ethVolume = numberOf(total, 18)
      volume24hUsd = ethVolume === null ? null : ethVolume * usd
    } catch {
      volumeReason = '24h curve events not available from this RPC.'
    }
  }

  // Do not invent a v4 liquidity USD figure from bonding-curve reserves: reserves may be virtual.
  // We report native quote reserve separately for transparency, leaving liquidityUsd null.
  const result: Stats = {
    source: 'Robinhood Chain / Pons curve', status: 'ok',
    reason: [
      'Market cap is an estimate using curve reserve ratio × total supply, not independently verified circulating supply.',
      'Liquidity USD is unavailable without a verified pool liquidity calculation.',
      volumeReason,
    ].filter(Boolean).join(' '),
    marketCapUsd: estMcap !== null && Number.isFinite(estMcap) && estMcap >= 0 ? estMcap : null,
    volume24hUsd: volume24hUsd !== null && Number.isFinite(volume24hUsd) && volume24hUsd >= 0 ? volume24hUsd : null,
    liquidityUsd: null,
    curveReserveEth: quoteReserveEth,
    updatedAt: new Date().toISOString(),
  }
  return result
}

export async function GET() {
  const config = await getServerConfig()
  const ca = config.token.contract?.trim() ?? ''
  if (!CA_PATTERN.test(ca) || ca.toLowerCase() === ZERO) return NextResponse.json(empty('awaiting_launch', 'Configure token.contract in public/config.json after launch.'))
  const rpcUrl = config.api.rpcUrl || RPC_URL
  const factory = config.api.ponsFactory || PONS_FACTORY
  if (!/^https:\/\//i.test(rpcUrl) || !CA_PATTERN.test(factory))
    return NextResponse.json(empty('unavailable', 'Configured RPC or factory is invalid.'), { status: 503 })
  const key = `${ca.toLowerCase()}:${rpcUrl}:${factory.toLowerCase()}`
  if (stored?.key === key && Date.now() - stored.at < CACHE_MS) return NextResponse.json(stored.result)

  // Existing successful snapshots can be served without waiting on the next chain scan.
  if (stored?.key === key && Date.now() - stored.at < FIFTEEN_MINUTES) {
    if (pending?.key !== key) {
      const promise = statsForToken(ca as Address, rpcUrl, factory as Address)
      pending = { key, promise }
      void promise.then((result) => {
        if (result.status === 'ok' || result.status === 'unsupported') stored = { key, at: Date.now(), result }
      }).catch((err) => {
        console.error('[onchain-token-stats] refresh failed:', err)
      }).finally(() => {
        if (pending?.promise === promise) pending = null
      })
    }
    return NextResponse.json(stored.result, { headers: { 'x-spyhooks-cache': 'stale' } })
  }
  try {
    if (pending?.key !== key) {
      const promise = statsForToken(ca as Address, rpcUrl, factory as Address)
      pending = { key, promise }
    }
    const current = pending
    const result = await current.promise
    if (result.status === 'ok' || result.status === 'unsupported') stored = { key, at: Date.now(), result }
    return NextResponse.json(result)
  } catch (err) {
    console.error('[onchain-token-stats] fetch failed:', err)
    return NextResponse.json(empty('unavailable', 'RPC or ETH/USD source failed. Retry later.'), { status: 503 })
  } finally {
    // Only clear the request that was actually awaited.
    if (pending?.key === key) pending = null
  }
}
