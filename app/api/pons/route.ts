import { NextResponse } from 'next/server'
import { getServerConfig } from '@/lib/config.server'
import type { TokenRow } from '@/lib/tokens'

export const dynamic = 'force-dynamic'

const TOKEN_LAUNCHED = '0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607'
const CURVE_BUY = '0xec36bf571f136799e8dc0b0b8bea4b04d8bd3d43de838aab0d5fc21d4cbfc455'
const CURVE_SELL = '0x8113d738abdcb6b38357e9d53a54a7157861a09031b453651f0fe7fe151f59df'
const LAUNCH_SWEPT = '0xcdb72f157fd3666758a6ce201387ffb52038c7562e4fff352828da1096c4b6b4'
const POOL_GRADUATED = '0x0a44ef75df69c534f43cd6c1aa3ef8983065fe5fe79ef9e79f6494e6f258c259'
const DEFAULT_RPC = 'https://rpc.mainnet.chain.robinhood.com'
const DEFAULT_FACTORY = '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e'
const LOOKBACK_BLOCKS = 100_000
const TOTAL_SUPPLY = 1_000_000_000
const CACHE_MS = 60_000
const LOGO_RETRY_MS = 30_000

type RpcCall = { method: string; params: unknown[] }
type Log = { topics: string[]; data: string; blockNumber: string; logIndex: string }

let cache: { at: number; rows: TokenRow[] } | null = null
let refreshPromise: Promise<void> | null = null
// Keep discovered artwork across API refreshes for as long as this server process runs.
const logoCache = new Map<string, string>()
const logoLastChecked = new Map<string, number>()

async function rpcBatch<T>(url: string, calls: RpcCall[]): Promise<(T | null)[]> {
  const out: (T | null)[] = []
  for (let i = 0; i < calls.length; i += 15) {
    const slice = calls.slice(i, i + 15)
    let res: Response | null = null
    for (let attempt = 0; attempt < 4; attempt++) {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(slice.map((c, n) => ({ jsonrpc: '2.0', id: n, ...c }))),
        cache: 'no-store',
      })
      if (res.status !== 429) break
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
    }
    if (!res || !res.ok) throw new Error(`RPC ${res?.status}`)
    const json = (await res.json()) as { id: number; result?: T }[]
    const byId = new Map(json.map((r) => [r.id, r.result ?? null]))
    slice.forEach((_, n) => out.push((byId.get(n) as T | null) ?? null))
  }
  return out
}

const hex = (n: number) => '0x' + n.toString(16)
const words = (data: string) => (data.slice(2).match(/.{64}/g) ?? []).map((w) => BigInt('0x' + w))
const eth = (wei: bigint) => Number(wei) / 1e18

function decodeString(data: string | null) {
  if (!data || data.length < 130) return ''
  const len = Number(BigInt('0x' + data.slice(66, 130)))
  const body = data.slice(130, 130 + len * 2)
  return Buffer.from(body, 'hex').toString('utf8')
}

async function buildRows(rpcUrl: string, factory: string): Promise<TokenRow[]> {
  const [headHex] = await rpcBatch<string>(rpcUrl, [{ method: 'eth_blockNumber', params: [] }])
  const head = parseInt(headHex as string, 16)

  const [oldBlock, headBlock, launchLogs, lifecycleLogs] = await rpcBatch<{ timestamp: string } | Log[]>(rpcUrl, [
    { method: 'eth_getBlockByNumber', params: [hex(head - LOOKBACK_BLOCKS), false] },
    { method: 'eth_getBlockByNumber', params: [hex(head), false] },
    {
      method: 'eth_getLogs',
      params: [{ address: factory, fromBlock: hex(head - LOOKBACK_BLOCKS), toBlock: 'latest', topics: [TOKEN_LAUNCHED] }],
    },
    {
      method: 'eth_getLogs',
      params: [{ address: factory, fromBlock: hex(head - LOOKBACK_BLOCKS), toBlock: 'latest', topics: [[LAUNCH_SWEPT, POOL_GRADUATED]] }],
    },
  ])

  // Only PoolGraduated proves the token has completed graduation into Uniswap v4.
  // LaunchSwept is an intermediate state and must not be counted as surfaced.
  const sweptTokens = new Set(
    ((lifecycleLogs as Log[] | null) ?? [])
      .filter((log) => log.topics[0]?.toLowerCase() === LAUNCH_SWEPT)
      .map((log) => ('0x' + log.topics[1].slice(26)).toLowerCase()),
  )
  const lifecycle = (lifecycleLogs as Log[] | null) ?? []
  const graduatingTokens = new Set(
    lifecycle
      .filter((log) => log.topics[0]?.toLowerCase() === LAUNCH_SWEPT)
      .map((log) => ('0x' + (log.topics[1] ?? '').slice(-40)).toLowerCase()),
  )
  const graduatedTokens = new Set(
    lifecycle
      .filter((log) => log.topics[0]?.toLowerCase() === POOL_GRADUATED)
      .map((log) => ('0x' + (log.topics[1] ?? '').slice(-40)).toLowerCase()),
  )

  const secPerBlock =
    (parseInt((headBlock as { timestamp: string }).timestamp, 16) - parseInt((oldBlock as { timestamp: string }).timestamp, 16)) /
    LOOKBACK_BLOCKS

  const launched = (launchLogs as Log[])
    .map((l) => {
      const w = words(l.data)
      return {
        token: '0x' + l.topics[1].slice(26),
        curve: '0x' + l.topics[2].slice(26),
        pairToken: w[0],
        threshold: w[2],
        block: parseInt(l.blockNumber, 16),
      }
    })
    .filter((l) => l.pairToken === 0n && l.threshold > 0n)
    .sort((a, b) => b.block - a.block)

  const calls: RpcCall[] = launched.flatMap((l) => [
    { method: 'eth_call', params: [{ to: l.token, data: '0x06fdde03' }, 'latest'] },
    { method: 'eth_call', params: [{ to: l.token, data: '0x95d89b41' }, 'latest'] },
    {
      method: 'eth_getLogs',
      params: [{ address: l.curve, fromBlock: hex(l.block), toBlock: 'latest', topics: [[CURVE_BUY, CURVE_SELL]] }],
    },
  ])
  const results = await rpcBatch<string | Log[]>(rpcUrl, calls)

  return launched.map((l, i) => {
    const name = decodeString(results[i * 3] as string | null)
    const symbol = decodeString(results[i * 3 + 1] as string | null)
    const trades = (results[i * 3 + 2] as Log[] | null) ?? []

    let raised = 0n
    let volume = 0n
    let price = 0
    for (const t of trades) {
      const [a, b, fee] = words(t.data)
      if (t.topics[0] === CURVE_BUY) {
        raised += a - fee
        volume += a
        if (b > 0n) price = eth(a - fee) / (Number(b) / 1e18)
      } else {
        raised -= b
        volume += b
        if (a > 0n) price = eth(b) / (Number(a) / 1e18)
      }
    }

    const progress = Math.max(0, Math.min(100, Math.round(Number((raised * 10000n) / l.threshold) / 100)))
    return {
      name: name || 'Unnamed',
      ticker: symbol || '???',
      launchpad: 'Pons',
      progress,
      mcap: price * TOTAL_SUPPLY,
      volume: eth(volume),
      ageMinutes: Math.max(0, Math.round(((head - l.block) * secPerBlock) / 60)),
      status: graduatedTokens.has(l.token.toLowerCase())
        ? 'graduated'
        : sweptTokens.has(l.token.toLowerCase()) ? 'graduating' : 'curve',
      price,
      address: l.token,
      curveAddress: l.curve,
    }
  })
}


async function resolveLogo(row: TokenRow): Promise<TokenRow> {
  const addressKey = row.address.toLowerCase()
  const cachedLogo = logoCache.get(addressKey)
  if (cachedLogo) return { ...row, logoUrl: cachedLogo }

  const lastChecked = logoLastChecked.get(addressKey) ?? 0
  if (Date.now() - lastChecked < LOGO_RETRY_MS) return row
  logoLastChecked.set(addressKey, Date.now())
  const isHttpsImage = (value: unknown): value is string =>
    typeof value === 'string' && value.startsWith('https://')

  // Resolve logos after the token API responds, so third-party image services
  // never delay the initial token list.
  try {
    const response = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/robinhood/tokens/${row.address}`,
      { headers: { accept: 'application/json;version=20230302' }, cache: 'no-store', signal: AbortSignal.timeout(2500) },
    )
    if (response.ok) {
      const data = await response.json() as { data?: { attributes?: { image_url?: unknown } } }
      const imageUrl = data.data?.attributes?.image_url
      if (isHttpsImage(imageUrl)) {
        logoCache.set(addressKey, imageUrl)
        return { ...row, logoUrl: imageUrl }
      }
    }
  } catch { /* Try Blockscout. */ }

  try {
    const response = await fetch(
      `https://robinhoodchain.blockscout.com/api/v2/tokens/${row.address}`,
      { cache: 'no-store', signal: AbortSignal.timeout(2500) },
    )
    if (response.ok) {
      const data = await response.json() as { icon_url?: unknown }
      if (isHttpsImage(data.icon_url)) {
        logoCache.set(addressKey, data.icon_url)
        return { ...row, logoUrl: data.icon_url }
      }
    }
  } catch { /* No published image yet. */ }

  // Dexscreener fallback; require a matching Robinhood pair and token address.
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${row.address}`, {
      cache: 'no-store', signal: AbortSignal.timeout(2500),
    })
    if (response.ok) {
      const data = await response.json() as { pairs?: Array<{ chainId?: string; baseToken?: { address?: string }; quoteToken?: { address?: string }; info?: { imageUrl?: unknown }; liquidity?: { usd?: number } }> }
      const address = row.address.toLowerCase()
      const pairs = (data.pairs ?? []).filter((pair) =>
        pair.chainId?.toLowerCase() === 'robinhood' &&
        (pair.baseToken?.address?.toLowerCase() === address || pair.quoteToken?.address?.toLowerCase() === address) &&
        isHttpsImage(pair.info?.imageUrl),
      ).sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))
      const imageUrl = pairs[0]?.info?.imageUrl
      if (isHttpsImage(imageUrl)) {
        logoCache.set(addressKey, imageUrl)
        return { ...row, logoUrl: imageUrl }
      }
    }
  } catch { /* Retry after LOGO_RETRY_MS. */ }
  return row
}

function startBackgroundLogoResolution(rows: TokenRow[]) {
  const pending = [...rows]
  const workers = Array.from({ length: 5 }, async () => {
    while (pending.length) {
      const row = pending.shift()
      if (!row) return
      const enriched = await resolveLogo(row)
      if (!enriched.logoUrl || !cache) continue
      const index = cache.rows.findIndex((item) => item.address.toLowerCase() === row.address.toLowerCase())
      if (index >= 0) {
        const updated = [...cache.rows]
        updated[index] = { ...updated[index], logoUrl: enriched.logoUrl }
        cache = { ...cache, rows: updated }
      }
    }
  })
  void Promise.all(workers).catch((error) => console.error('[pons] logo lookup failed:', error))
}

async function refreshCache(rpcUrl: string, factory: string) {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const rows = await buildRows(rpcUrl, factory)
      // Return token data without waiting for external image providers.
      // Existing logo cache is merged immediately; missing images can be resolved later.
      const withCachedLogos = rows.map((row) => ({
        ...row,
        logoUrl: row.logoUrl || logoCache.get(row.address.toLowerCase()),
      }))
      cache = { at: Date.now(), rows: withCachedLogos }
      startBackgroundLogoResolution(withCachedLogos)
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}


function getCacheSnapshot(): {
  at: number
  rows: TokenRow[]
} | null {
  return cache
}


export async function GET() {
  const config = await getServerConfig()
  const rpcUrl = config.api.rpcUrl || DEFAULT_RPC
  const factory = config.api.ponsFactory || DEFAULT_FACTORY

  try {
    const existingCache = getCacheSnapshot()

    if (existingCache) {
      const isStale = Date.now() - existingCache.at > CACHE_MS

      if (isStale) {
        void refreshCache(rpcUrl, factory).catch((error) => {
          console.error('[pons] background refresh failed:', error)
        })
      }

      return NextResponse.json(existingCache.rows, {
        headers: {
          'cache-control':
            'public, s-maxage=10, stale-while-revalidate=60',
          'x-spyhooks-cache': isStale ? 'stale' : 'fresh',
        },
      })
    }

    // First request: build the initial token list.
    await refreshCache(rpcUrl, factory)

    const freshCache = getCacheSnapshot()

    if (!freshCache) {
      throw new Error('Pons data is not available yet')
    }

    return NextResponse.json(freshCache.rows, {
      headers: {
        'cache-control':
          'public, s-maxage=10, stale-while-revalidate=60',
        'x-spyhooks-cache': 'miss',
      },
    })
  } catch (error) {
    const fallbackCache = getCacheSnapshot()

    if (fallbackCache) {
      return NextResponse.json(fallbackCache.rows)
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load Pons data',
      },
      { status: 502 },
    )
  }
}
