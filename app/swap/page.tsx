import { Suspense } from 'react'
import { SwapCard } from '@/components/swap-card'

export default function SwapPage() {
  return (
    <section className="py-6">
      <h1 className="mb-1 text-center text-3xl font-bold tracking-tight">Swap</h1>
      <p className="mx-auto mb-8 max-w-md text-center text-muted-foreground">Trade launchpad tokens through the hook, straight into the curve.</p>
      <Suspense fallback={null}>
        <SwapCard />
      </Suspense>
    </section>
  )
}
