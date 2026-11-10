import { NextResponse } from 'next/server'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getServerConfig } from '@/lib/config.server'
import { readHistory } from '@/lib/launch-history.server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// This is an independent, cumulative on-chain ledger. It does not use the
// current Live Tokens list, so On Curve and Swap remain unchanged.
const TOKEN_LAUNCHED = '0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607'
const ADDRESS = /^0x[a-f\d]{40}$/i
const DEFAULT_FACTORY = '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e'
const DEFAULT_RPC = 'https://rpc.mainnet.chain.robinhood.com'
const CHUNK_BLOCKS = 2000
const MAX_CHUNKS_PER_REQUEST = 8
const FINALITY_BLOCKS = 4

type Ledger = {
  version: 1
  factory: string
  startBlock: number
  lastScannedBlock: number
  addresses: string[]
}
type RpcLog = { topics?: string[]; data?: string }

const dataDir = () => process.env.SPYHOOKS_DATA_DIR || path.join(process.cwd(), 'data')
const ledgerPath = (factory: string, startBlock: number) =>
  path.join(dataDir(), `spyhooks-launches-${factory.toLowerCase().slice(2)}-${startBlock}.json`)
const hex = (value: number) => `0x${value.toString(16)}`

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`)
  const result = (await response.json()) as { result?: T; error?: { code: number; message: string } }
  if (result.error || result.result === undefined || result.result === null) {
    throw new Error(`RPC ${method}: ${result.error?.message || 'missing result'}`)
  }
  return result.result
}

async function loadLedger(factory: string, startBlock: number): Promise<Ledger> {
  const file = ledgerPath(factory, startBlock)
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as Partial<Ledger>
    if (parsed.factory?.toLowerCase() !== factory.toLowerCase() || parsed.startBlock !== startBlock ||
      !Number.isSafeInteger(parsed.lastScannedBlock) || !Array.isArray(parsed.addresses)) {
      throw new Error('Ledger is malformed or its launch start block has changed')
    }
    return {
      version: 1,
      factory: factory.toLowerCase(),
      startBlock,
      lastScannedBlock: parsed.lastScannedBlock!,
      addresses: [...new Set(parsed.addresses.filter((address): address is string => typeof address === 'string' && ADDRESS.test(address)).map(address => address.toLowerCase()))],
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    return { version: 1, factory: factory.toLowerCase(), startBlock, lastScannedBlock: startBlock - 1, addresses: [] }
  }
}

async function saveLedger(ledger: Ledger): Promise<void> {
  await mkdir(dataDir(), { recursive: true })
  const file = ledgerPath(ledger.factory, ledger.startBlock)
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temporary, JSON.stringify(ledger), { encoding: 'utf8', flag: 'wx' })
  await rename(temporary, file)
}

/** The Pons scanner counts native-ETH TokenLaunched events (pairToken=0, threshold>0). */
function nativePonsToken(log: RpcLog): string | null {
  const topic = log.topics?.[1]
  if (!topic || !/^0x[a-f\d]{64}$/i.test(topic)) return null
  const token = `0x${topic.slice(-40)}`.toLowerCase()
  if (!ADDRESS.test(token)) return null
  const data = log.data || ''
  if (!/^0x(?:[a-f\d]{64}){3,}/i.test(data)) return null
  try {
    const pairToken = BigInt(`0x${data.slice(2, 66)}`)
    const threshold = BigInt(`0x${data.slice(130, 194)}`)
    return pairToken === 0n && threshold > 0n ? token : null
  } catch { return null }
}

// Avoid overlapping requests competing for the same ledger in one Node process.
const jobs = new Map<string, Promise<Ledger>>()
async function updateLedger(rpcUrl: string, factory: string, startBlock: number): Promise<Ledger> {
  const key = `${factory.toLowerCase()}:${startBlock}`
  const existing = jobs.get(key)
  if (existing) return existing
  const job = (async () => {
    const ledger = await loadLedger(factory, startBlock)
    const headHex = await rpc<string>(rpcUrl, 'eth_blockNumber', [])
    const head = Number.parseInt(headHex, 16) - FINALITY_BLOCKS
    if (!Number.isSafeInteger(head) || head < 0) throw new Error('Invalid chain head')
    if (head < ledger.lastScannedBlock) throw new Error('Chain head is behind the saved cursor')
    const known = new Set(ledger.addresses)
    let from = Math.max(startBlock, ledger.lastScannedBlock + 1)
    let chunks = 0
    while (from <= head && chunks < MAX_CHUNKS_PER_REQUEST) {
      const to = Math.min(head, from + CHUNK_BLOCKS - 1)
      const logs = await rpc<RpcLog[]>(rpcUrl, 'eth_getLogs', [{
        address: factory, fromBlock: hex(from), toBlock: hex(to), topics: [TOKEN_LAUNCHED],
      }])
      if (!Array.isArray(logs)) throw new Error('Invalid launch logs')
      for (const log of logs) {
        const address = nativePonsToken(log)
        if (address) known.add(address)
      }
      // Save after every successful chunk: a later RPC failure does not erase progress.
      ledger.addresses = [...known]
      ledger.lastScannedBlock = to
      await saveLedger(ledger)
      from = to + 1
      chunks += 1
    }
    return ledger
  })()
  jobs.set(key, job)
  try { return await job } finally { jobs.delete(key) }
}

export async function GET() {
  const config = await getServerConfig()
  const factory = config.api.ponsFactory || DEFAULT_FACTORY
  const startBlock = config.stats?.launchStartBlock
  const saved = await readHistory(factory)
  // This is the immediate baseline from contracts already observed by the scanner.
  // The current token list is NOT used as a live counter; older saved addresses remain.
  const observed = new Set(saved.filter(row => ADDRESS.test(row.address)).map(row => row.address.toLowerCase()))
  const surfacedHistory = saved.filter(row => row.status === 'graduated').map(row => ({
    address: row.address, name: row.name, ticker: row.ticker, launchBlock: row.launchBlock,
  }))
  const base = { surfacedHistory, updatedAt: new Date().toISOString() }
  if (!ADDRESS.test(factory)) {
    return NextResponse.json({ ...base, totalLaunch: observed.size, status: 'error', reason: 'Invalid Pons factory address' },
      { status: 500, headers: { 'cache-control': 'no-store' } })
  }
  if (!Number.isSafeInteger(startBlock) || (startBlock ?? 0) <= 0) {
    // No start block yet: show count immediately from persistent observed launches.
    return NextResponse.json({ ...base, totalLaunch: observed.size, status: 'observed',
      reason: 'Counting all observed contract addresses. Set launchStartBlock for historical backfill.' },
      { headers: { 'cache-control': 'no-store' } })
  }
  try {
    const ledger = await updateLedger(config.api.rpcUrl || DEFAULT_RPC, factory, startBlock!)
    const headHex = await rpc<string>(config.api.rpcUrl || DEFAULT_RPC, 'eth_blockNumber', [])
    const head = Number.parseInt(headHex, 16) - FINALITY_BLOCKS
    const all = new Set(ledger.addresses)
    // Include scanner-observed launches from the defined website launch block onward.
    for (const row of saved) {
      if (ADDRESS.test(row.address) && typeof row.launchBlock === 'number' && row.launchBlock >= startBlock!) {
        all.add(row.address.toLowerCase())
      }
    }
    return NextResponse.json({ ...base, totalLaunch: all.size,
      status: ledger.lastScannedBlock >= head ? 'synced' : 'indexing',
      startBlock, lastScannedBlock: ledger.lastScannedBlock,
      remainingBlocks: Math.max(0, head - ledger.lastScannedBlock),
    }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    let ledger: Ledger | null = null
    try { ledger = await loadLedger(factory, startBlock!) } catch { /* use observed count */ }
    const all = new Set(ledger?.addresses || [])
    for (const row of saved) {
      if (ADDRESS.test(row.address) && typeof row.launchBlock === 'number' && row.launchBlock >= startBlock!) {
        all.add(row.address.toLowerCase())
      }
    }
    console.error('[spyhooks] Total Launch indexing:', error)
    return NextResponse.json({ ...base, totalLaunch: all.size, status: 'partial',
      reason: (error as Error).message, lastScannedBlock: ledger?.lastScannedBlock },
      { headers: { 'cache-control': 'no-store' } })
  }
}
