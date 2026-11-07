import { LaunchpadList } from '@/components/launchpad-list'

export default function LaunchpadsPage() {
  return (
    <section className="py-6">
      <h1 className="text-3xl font-bold tracking-tight">Launchpads</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">Launchpads whose bonding curves are hooked into the router. Tokens opened here are swappable on Uniswap from day one.</p>
      <LaunchpadList />
    </section>
  )
}
