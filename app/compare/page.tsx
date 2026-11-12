import { Suspense } from 'react'
import { TokenComparison } from '@/components/token-comparison'
import { WorkspaceSidebar } from '@/components/workspace-sidebar'

export default function ComparePage() {
  return <div className="grid min-w-0 gap-5 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start"><WorkspaceSidebar /><Suspense fallback={<div className="p-8 text-sm text-zinc-400">Loading comparison…</div>}><TokenComparison /></Suspense></div>
}
