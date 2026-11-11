import { SpyScanner } from '@/components/spy-scanner'
import { getServerConfig } from '@/lib/config.server'
import './spy-layout.css'

export default async function SpyScannerPage() {
  const config = await getServerConfig()
  return <SpyScanner defaultContract={config.token.contract || ''}/>
}
