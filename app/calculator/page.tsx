import { WorkspaceSidebar } from '@/components/workspace-sidebar'
import { TradeCalculator } from '@/components/trade-calculator'

export default function CalculatorPage() {
  return <div className="grid min-w-0 gap-5 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start"><WorkspaceSidebar/><TradeCalculator/></div>
}
