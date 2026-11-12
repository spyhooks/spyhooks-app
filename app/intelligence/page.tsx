import { IntelligenceDashboard } from '@/components/intelligence-dashboard'
import { WorkspaceSidebar } from '@/components/workspace-sidebar'

export const metadata = {
  title: 'SPY Intelligence — Live Trades & Wallet Tracker',
  description: 'Explore observed trades and track wallet activity on Robinhood Chain.',
}

export default function IntelligencePage() {
  return <div className="grid min-w-0 gap-5 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start"><WorkspaceSidebar /><div className="min-w-0"><IntelligenceDashboard /></div></div>
}
