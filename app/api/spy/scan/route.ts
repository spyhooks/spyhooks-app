import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, formatUnits, getAddress, http, isAddress, parseAbi, type Address } from 'viem'
import { getServerConfig } from '@/lib/config.server'
import { PONS_FACTORY, RPC_URL, curveAbi, factoryAbi, robinhoodChain } from '@/lib/pons-trading'
import { assessRisk, type RiskAssessment } from './risk-score'

export const dynamic = 'force-dynamic'

const ZERO = '0x0000000000000000000000000000000000000000'

const tokenMetaAbi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
])

type ScanResponse = {
  status: 'ok' | 'external' | 'invalid' | 'error'
  message: string
  address: string
  source: string
  explorerUrl: string
  swapUrl: string | null
  token: {
    name: string | null
    symbol: string | null
    decimals: number | null
    totalSupply: string | null
    logoUrl: string | null
  }
  pons: {
    exists: boolean
    scanStatus: 'curve' | 'graduating' | 'graduated' | 'external'
    curveAddress: string | null
    deployer: string | null
    creatorFeeRecipient: string | null
    pairToken: string | null
    poolFee: number | null
    tickSpacing: number | null
    creatorTaxBps: number | null
    phase: number | null
    nativeQuote: boolean | null
    readyToGraduate: boolean | null
  }
  metrics: {
    ethUsd: number | null
    priceEth: number | null
    priceUsd: number | null
    marketCapEth: number | null
    marketCapUsd: number | null
    quoteReserveEth: number | null
    tokenReserve: number | null
  }
  warnings: string[]
  risk?: RiskAssessment
  evidence?: { sourceVerified: boolean | null; top10Percent: number | null; proxyIndicator: boolean | null }
}

function toNumber(value: bigint | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const out = Number(value)
  return Number.isFinite(out) ? out : null
}

function numFromUnits(value: bigint | null | undefined, decimals: number | null | undefined): number | null {
  if (value === null || value === undefined || decimals === null || decimals === undefined) return null
  const out = Number(formatUnits(value, decimals))
  return Number.isFinite(out) ? out : null
}

function formatSupply(value: bigint | null | undefined, decimals: number | null | undefined) {
  if (value === null || value === undefined || decimals === null || decimals === undefined) return null
  try {
    const amount = Number(formatUnits(value, decimals))
    if (!Number.isFinite(amount)) return null
    return amount.toLocaleString('en-US', { maximumFractionDigits: 4 })
  } catch {
    return null
  }
}

async function ethUsd(): Promise<number | null> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
    })
    if (res.ok) {
      const json = (await res.json()) as { ethereum?: { usd?: unknown } }
      const value = Number(json.ethereum?.usd)
      if (Number.isFinite(value) && value > 0) return value
    }
  } catch {}

  try {
    const res = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot', {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
    })
    if (res.ok) {
      const json = (await res.json()) as { data?: { amount?: string } }
      const value = Number(json.data?.amount)
      if (Number.isFinite(value) && value > 0) return value
    }
  } catch {}

  return null
}

async function resolveLogo(address: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.geckoterminal.com/api/v2/networks/robinhood/tokens/${address}`, {
      cache: 'no-store',
      headers: { accept: 'application/json;version=20230302' },
      signal: AbortSignal.timeout(2500),
    })
    if (res.ok) {
      const json = (await res.json()) as { data?: { attributes?: { image_url?: unknown } } }
      const image = json.data?.attributes?.image_url
      if (typeof image === 'string' && image.startsWith('https://')) return image
    }
  } catch {}

  try {
    const res = await fetch(`https://robinhoodchain.blockscout.com/api/v2/tokens/${address}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    })
    if (res.ok) {
      const json = (await res.json()) as { icon_url?: unknown }
      if (typeof json.icon_url === 'string' && json.icon_url.startsWith('https://')) return json.icon_url
    }
  } catch {}

  return null
}

type ExplorerMetadata = { verified: boolean | null; proxy: boolean | null; top10Percent: number | null }

async function getBlockscoutSignals(address: Address, totalSupply: bigint | null): Promise<ExplorerMetadata> {
  const bases = [
    'https://robinhoodchain.blockscout.com/api/v2',
    'https://api.blockscout.com/4663/api/v2',
  ]
  const fetchJson = async (path: string): Promise<unknown | null> => {
    for (const base of bases) {
      try {
        const response = await fetch(`${base}${path}`, {
          cache: 'no-store', signal: AbortSignal.timeout(4500),
          headers: { accept: 'application/json' },
        })
        if (response.ok) return response.json()
      } catch { /* Try the next endpoint. */ }
    }
    return null
  }

  const [addressResult, sourceResult, holdersResult] = await Promise.all([
    fetchJson(`/addresses/${address}`),
    fetchJson(`/smart-contracts/${address}`),
    fetchJson(`/tokens/${address}/holders`),
  ])

  let verified: boolean | null = null
  let proxy: boolean | null = null
  let top10Percent: number | null = null

  const addressData = addressResult && typeof addressResult === 'object'
    ? addressResult as { is_verified?: unknown; proxy_type?: unknown; implementations?: unknown }
    : null
  const sourceData = sourceResult && typeof sourceResult === 'object'
    ? sourceResult as { is_verified?: unknown; is_vyper_contract?: unknown; source_code?: unknown; proxy_type?: unknown; is_proxy?: unknown }
    : null

  // /smart-contracts/{ca} generally returns 404 if source is unverified.
  // A 404 alone cannot distinguish unverified code from a temporarily stale index.
  if (typeof addressData?.is_verified === 'boolean') verified = addressData.is_verified
  else if (sourceData && (typeof sourceData.source_code === 'string' || typeof sourceData.is_verified === 'boolean')) {
    verified = typeof sourceData.is_verified === 'boolean' ? sourceData.is_verified : true
  }
  if (typeof addressData?.proxy_type === 'string' && addressData.proxy_type.trim()) proxy = true
  else if (sourceData?.is_proxy === true) proxy = true
  else if (typeof sourceData?.proxy_type === 'string' && sourceData.proxy_type.length > 0) proxy = true

  if (holdersResult && typeof holdersResult === 'object' && totalSupply && totalSupply > 0n) {
    const data = holdersResult as {
      items?: Array<{ value?: unknown }>
      next_page_params?: unknown
    }
    if (Array.isArray(data.items) && (data.items.length >= 10 || (data.items.length > 0 && !data.next_page_params))) {
      const balances = data.items.slice(0, 10).map((item) => {
        try {
          return typeof item.value === 'string' && /^\d+$/.test(item.value) ? BigInt(item.value) : null
        } catch { return null }
      })
      if (balances.every((value) => value !== null)) {
        const top10 = (balances as bigint[]).reduce((sum, value) => sum + value, 0n)
        const percentage = Number((top10 * 10000n) / totalSupply) / 100
        if (percentage >= 0 && percentage <= 100) top10Percent = percentage
      }
    }
  }
  return { verified, proxy, top10Percent }
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('address')?.trim() || ''
  if (!isAddress(raw)) {
    return NextResponse.json<ScanResponse>({
      status: 'invalid',
      message: 'Enter a valid contract address to scan.',
      address: raw,
      source: 'Spy scanner',
      explorerUrl: '',
      swapUrl: null,
      token: { name: null, symbol: null, decimals: null, totalSupply: null, logoUrl: null },
      pons: {
        exists: false, scanStatus: 'external', curveAddress: null, deployer: null, creatorFeeRecipient: null, pairToken: null,
        poolFee: null, tickSpacing: null, creatorTaxBps: null, phase: null, nativeQuote: null, readyToGraduate: null,
      },
      metrics: { ethUsd: null, priceEth: null, priceUsd: null, marketCapEth: null, marketCapUsd: null, quoteReserveEth: null, tokenReserve: null },
      warnings: [],
    }, { status: 400 })
  }

  const address = getAddress(raw)
  const config = await getServerConfig()
  const rpcUrl = config.api.rpcUrl || RPC_URL
  const factory = (config.api.ponsFactory || PONS_FACTORY) as Address
  const explorerBase = config.network.explorerUrl || robinhoodChain.blockExplorers?.default.url || 'https://robinhoodchain.blockscout.com'
  const client = createPublicClient({ chain: robinhoodChain, transport: http(rpcUrl, { timeout: 12_000 }) })

  try {
    const code = await client.getBytecode({ address: address as Address })
    if (!code || code === '0x') {
      return NextResponse.json<ScanResponse>({
        status: 'invalid',
        message: 'No contract bytecode found at this address.',
        address,
        source: 'Robinhood Chain',
        explorerUrl: `${explorerBase}/address/${address}`,
        swapUrl: null,
        token: { name: null, symbol: null, decimals: null, totalSupply: null, logoUrl: null },
        pons: {
          exists: false, scanStatus: 'external', curveAddress: null, deployer: null, creatorFeeRecipient: null, pairToken: null,
          poolFee: null, tickSpacing: null, creatorTaxBps: null, phase: null, nativeQuote: null, readyToGraduate: null,
        },
        metrics: { ethUsd: null, priceEth: null, priceUsd: null, marketCapEth: null, marketCapUsd: null, quoteReserveEth: null, tokenReserve: null },
        warnings: ['This address looks like an EOA or an uninitialized contract address.'],
      }, { status: 404 })
    }

    const [nameResult, symbolResult, decimalsResult, supplyResult, launchResult, ethUsdResult, logoUrl] = await Promise.all([
      client.readContract({ address: address as Address, abi: tokenMetaAbi, functionName: 'name' }).catch(() => null),
      client.readContract({ address: address as Address, abi: tokenMetaAbi, functionName: 'symbol' }).catch(() => null),
      client.readContract({ address: address as Address, abi: tokenMetaAbi, functionName: 'decimals' }).catch(() => null),
      client.readContract({ address: address as Address, abi: tokenMetaAbi, functionName: 'totalSupply' }).catch(() => null),
      client.readContract({ address: factory, abi: factoryAbi, functionName: 'getLaunchedToken', args: [address as Address] }).catch(() => null),
      ethUsd(),
      resolveLogo(address),
    ])

    const decimals = decimalsResult !== null ? Number(decimalsResult) : null
    const totalSupply = typeof supplyResult === 'bigint' ? supplyResult : null
    const ethUsdValue = ethUsdResult
    const launch = launchResult as any
    const exists = Boolean(launch?.exists)

    let nativeQuote: boolean | null = null
    let readyToGraduate: boolean | null = null
    let quoteReserveEth: number | null = null
    let tokenReserve: number | null = null
    let priceEth: number | null = null
    let priceUsd: number | null = null
    let marketCapEth: number | null = null
    let marketCapUsd: number | null = null
    const warnings: string[] = []

    if (exists && launch?.curve && launch.curve !== ZERO) {
      const [reserves, nativeQuoteResult, readyResult] = await Promise.all([
        client.readContract({ address: launch.curve, abi: curveAbi, functionName: 'getReserves' }).catch(() => null),
        client.readContract({ address: launch.curve, abi: curveAbi, functionName: 'isNativeQuote' }).catch(() => null),
        client.readContract({ address: launch.curve, abi: curveAbi, functionName: 'readyToGraduate' }).catch(() => null),
      ])
      nativeQuote = typeof nativeQuoteResult === 'boolean' ? nativeQuoteResult : null
      readyToGraduate = typeof readyResult === 'boolean' ? readyResult : null
      if (Array.isArray(reserves) && reserves.length >= 2) {
        quoteReserveEth = numFromUnits(reserves[0] as bigint, 18)
        tokenReserve = numFromUnits(reserves[1] as bigint, decimals ?? 18)
      }
      if (nativeQuote !== true) quoteReserveEth = null
      if (quoteReserveEth !== null && tokenReserve && tokenReserve > 0) {
        priceEth = quoteReserveEth / tokenReserve
        if (ethUsdValue) priceUsd = priceEth * ethUsdValue
      }
      const supplyNumber = numFromUnits(totalSupply, decimals)
      if (priceEth !== null && supplyNumber !== null) marketCapEth = priceEth * supplyNumber
      if (marketCapEth !== null && ethUsdValue) marketCapUsd = marketCapEth * ethUsdValue

      if (nativeQuote === false) warnings.push('This curve does not use native ETH as quote asset, so ETH-based pricing is not shown.')
      if ((launch.sweptAt as bigint | undefined) && launch.sweptAt > 0n) warnings.push('This token has already moved beyond the active curve stage.')
      if (readyToGraduate) warnings.push('This curve is ready to graduate. Swap availability may shift to the surfaced pool soon.')
    } else {
      warnings.push('Valid contract found, but it is not registered in the configured Pons factory.')
    }

    const [explorerSignals, implementationSlot, beaconSlot] = await Promise.all([
      getBlockscoutSignals(address as Address, totalSupply),
      client.getStorageAt({ address: address as Address, slot: '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' }).catch(() => undefined),
      client.getStorageAt({ address: address as Address, slot: '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50' }).catch(() => undefined),
    ])
    const hasImplementation = (slot: `0x${string}` | undefined) => !!slot && /^0x[0-9a-f]+$/i.test(slot) && BigInt(slot) !== 0n
    const eip1967Detected = hasImplementation(implementationSlot) || hasImplementation(beaconSlot)
    const eip1967Checked = implementationSlot !== undefined && beaconSlot !== undefined
    const proxySignal = eip1967Detected || explorerSignals.proxy === true
      ? true : eip1967Checked ? false : null
    const risk = assessRisk({
      verified: explorerSignals.verified,
      proxy: proxySignal,
      top10Percent: explorerSignals.top10Percent,
      creatorTaxBps: exists ? toNumber(launch?.creatorTaxBps) : null,
      ponsFactory: launchResult !== null ? exists : null,
    })

    const scanStatus: ScanResponse['pons']['scanStatus'] = exists
      ? ((launch?.sweptAt as bigint | undefined) && launch.sweptAt > 0n)
        ? 'graduated'
        : readyToGraduate ? 'graduating' : 'curve'
      : 'external'

    const response: ScanResponse = {
      status: exists ? 'ok' : 'external',
      message: exists
        ? 'Token found in the configured Pons factory. Read-only diagnostics loaded successfully.'
        : 'Contract found. This address is outside the configured Pons factory, so SpyHooks swap support is not available yet.',
      address,
      source: exists ? 'Pons / Robinhood Chain' : 'Robinhood Chain contract',
      explorerUrl: `${explorerBase}/address/${address}`,
      swapUrl: exists && nativeQuote === true && !((launch?.sweptAt as bigint | undefined) && launch.sweptAt > 0n) ? `/swap?ca=${address}` : null,
      token: {
        name: typeof nameResult === 'string' ? nameResult : null,
        symbol: typeof symbolResult === 'string' ? symbolResult : null,
        decimals,
        totalSupply: formatSupply(totalSupply, decimals),
        logoUrl,
      },
      pons: {
        exists,
        scanStatus,
        curveAddress: exists && launch?.curve ? launch.curve : null,
        deployer: exists && launch?.deployer ? launch.deployer : null,
        creatorFeeRecipient: exists && launch?.creatorFeeRecipient ? launch.creatorFeeRecipient : null,
        pairToken: exists && launch?.pairToken ? launch.pairToken : null,
        poolFee: exists ? toNumber(launch?.poolFee) : null,
        tickSpacing: exists ? toNumber(launch?.tickSpacing) : null,
        creatorTaxBps: exists ? toNumber(launch?.creatorTaxBps) : null,
        phase: exists ? toNumber(launch?.phase) : null,
        nativeQuote,
        readyToGraduate,
      },
      metrics: {
        ethUsd: ethUsdValue,
        priceEth,
        priceUsd,
        marketCapEth,
        marketCapUsd,
        quoteReserveEth,
        tokenReserve,
      },
      warnings,
      risk,
      evidence: { sourceVerified: explorerSignals.verified, top10Percent: explorerSignals.top10Percent, proxyIndicator: proxySignal },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[spy-scan] failed', error)
    return NextResponse.json<ScanResponse>({
      status: 'error',
      message: 'Scanner failed to read this contract right now. Please retry in a moment.',
      address,
      source: 'Spy scanner',
      explorerUrl: `${explorerBase}/address/${address}`,
      swapUrl: null,
      token: { name: null, symbol: null, decimals: null, totalSupply: null, logoUrl: null },
      pons: {
        exists: false, scanStatus: 'external', curveAddress: null, deployer: null, creatorFeeRecipient: null, pairToken: null,
        poolFee: null, tickSpacing: null, creatorTaxBps: null, phase: null, nativeQuote: null, readyToGraduate: null,
      },
      metrics: { ethUsd: null, priceEth: null, priceUsd: null, marketCapEth: null, marketCapUsd: null, quoteReserveEth: null, tokenReserve: null },
      warnings: ['RPC temporarily unavailable or contract call failed.'],
    }, { status: 500 })
  }
}
