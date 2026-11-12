import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, getAddress, http, isAddress, parseAbi, type Address } from 'viem'
import { getServerConfig } from '@/lib/config.server'
import { PONS_FACTORY, RPC_URL, factoryAbi, robinhoodChain } from '@/lib/pons-trading'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const abi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
])

// Token imagery is optional metadata, never evidence of token identity or safety.
function httpsImage(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null
  } catch { return null }
}

async function getTokenImage(address: string): Promise<string | null> {
  const sources = [
    `https://robinhoodchain.blockscout.com/api/v2/tokens/${address}`,
    `https://api.geckoterminal.com/api/v2/networks/robinhood/tokens/${address}/info`,
  ]
  // Both sources are independent. A failure must not block the core RPC lookup.
  const results = await Promise.all(sources.map(async (url) => {
    try {
      const response = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(4500) })
      if (!response.ok) return null
      const payload: unknown = await response.json()
      if (!payload || typeof payload !== 'object') return null
      const record = payload as Record<string, unknown>
      if (url.includes('blockscout')) return httpsImage(record.icon_url)
      const data = record.data as Record<string, unknown> | undefined
      const attributes = data?.attributes as Record<string, unknown> | undefined
      return httpsImage(attributes?.image_url)
    } catch { return null }
  }))
  return results[0] ?? results[1] ?? null
}

const empty = (address: string) => ({
  address, name: null as string | null, ticker: null as string | null,
  logoUrl: null as string | null, decimals: null as number | null,
  recognizedPons: false, stage: null as string | null,
  source: 'Robinhood Chain RPC',
})

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('address')?.trim() ?? ''
  if (!isAddress(raw)) return NextResponse.json({ error: 'Enter a valid contract address.' }, { status: 400 })
  const address = getAddress(raw)
  try {
    const config = await getServerConfig()
    const client = createPublicClient({
      chain: robinhoodChain,
      transport: http(config.api.rpcUrl || RPC_URL, { timeout: 10_000 }),
    })
    const code = await client.getBytecode({ address })
    if (!code || code === '0x') {
      return NextResponse.json({ error: 'No contract deployed at this address on Robinhood Chain.' }, { status: 404 })
    }
    const factoryAddress = (config.api.ponsFactory || PONS_FACTORY) as Address
    const [name, symbol, decimals, pons] = await Promise.all([
      client.readContract({ address, abi, functionName: 'name' }).catch(() => null),
      client.readContract({ address, abi, functionName: 'symbol' }).catch(() => null),
      client.readContract({ address, abi, functionName: 'decimals' }).catch(() => null),
      client.readContract({ address: factoryAddress, abi: factoryAbi, functionName: 'getLaunchedToken', args: [address] }).catch(() => null),
    ])
    const result = empty(address)
    result.name = typeof name === 'string' && name.trim() ? name.slice(0, 120) : null
    result.ticker = typeof symbol === 'string' && symbol.trim() ? symbol.slice(0, 35) : null
    result.decimals = typeof decimals === 'number' ? decimals : null
    if (pons?.exists) {
      result.recognizedPons = true
      result.stage = pons.sweptAt > 0n ? 'Surfaced' : pons.phase > 0 ? 'Graduating' : 'On curve'
    }
    if (!result.name && !result.ticker) {
      return NextResponse.json({ error: 'Contract exists but does not expose readable ERC-20 token metadata.' }, { status: 422 })
    }
    result.logoUrl = await getTokenImage(address)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, max-age=120' } })
  } catch (error) {
    console.error('[compare-token] rpc lookup failed', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Token lookup is temporarily unavailable. Please retry.' }, { status: 503 })
  }
}
