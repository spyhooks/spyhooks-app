import 'server-only'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { TokenRow } from '@/lib/tokens'

/** Persistent history on a writable Node server. Set SPYHOOKS_DATA_DIR to a backed-up volume. */
const ROOT = process.env.SPYHOOKS_DATA_DIR || path.join(process.cwd(), 'data')
const ADDRESS = /^0x[a-f0-9]{40}$/i
let queue: Promise<unknown> = Promise.resolve()
const key = (factory: string) => factory.toLowerCase().replace(/[^a-z0-9]/g, '')
function storagePath(factory: string) { return path.join(ROOT, `pons-${key(factory)}.json`) }

export async function readHistory(factory: string): Promise<TokenRow[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(storagePath(factory), 'utf8'))
    if (!Array.isArray(parsed)) return []
    return parsed.filter((row): row is TokenRow => Boolean(row && typeof row === 'object' &&
      'address' in row && typeof row.address === 'string' && ADDRESS.test(row.address) &&
      'status' in row && ['curve', 'graduating', 'graduated'].includes(String(row.status))))
  } catch { return [] }
}

/** Never demote a confirmed graduated token when its event drops out of RPC lookback. */
export function combineHistory(oldRows: TokenRow[], current: TokenRow[]): TokenRow[] {
  const map = new Map<string, TokenRow>()
  for (const row of oldRows) map.set(row.address.toLowerCase(), row)
  for (const row of current) {
    const address = row.address.toLowerCase()
    const old = map.get(address)
    map.set(address, { ...old, ...row,
      launchBlock: row.launchBlock ?? old?.launchBlock,
      logoUrl: row.logoUrl || old?.logoUrl,
      status: old?.status === 'graduated' ? 'graduated' : row.status })
  }
  // The persisted ledger retains every observed launch, including older on-curve tokens.
  // The API response below is filtered separately, so On Curve doesn't include stale rows.
  return [...map.values()]
}

export async function persistHistory(factory: string, current: TokenRow[]): Promise<TokenRow[]> {
  const action = async () => {
    const rows = combineHistory(await readHistory(factory), current)
    try {
      await mkdir(ROOT, { recursive: true })
      const filename = storagePath(factory)
      const tmp = `${filename}.${process.pid}.tmp`
      await writeFile(tmp, JSON.stringify(rows), 'utf8')
      await rename(tmp, filename)
    } catch (e) { console.error('[spyhooks] persistent launch history unavailable:', e) }
    const visible = new Set(current.map(row => row.address.toLowerCase()))
    return rows.filter(row => visible.has(row.address.toLowerCase()) || row.status === 'graduated')
  }
  const result = queue.then(action, action)
  queue = result.then(() => undefined, () => undefined)
  return result
}
