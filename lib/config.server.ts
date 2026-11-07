import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fallbackConfig, type SiteConfig } from './config'

export async function getServerConfig(): Promise<SiteConfig> {
  try {
    const raw = await readFile(path.join(process.cwd(), 'public', 'config.json'), 'utf8')
    return { ...fallbackConfig, ...(JSON.parse(raw) as Partial<SiteConfig>) }
  } catch {
    return fallbackConfig
  }
}
