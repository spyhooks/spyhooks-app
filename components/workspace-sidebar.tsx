'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calculator, GitCompareArrows, Radar, RadioTower, TrendingUp, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

export type WorkspaceView = 'live' | 'trending' | 'portfolio'
type Props = { activeView?: WorkspaceView; onViewChange?: (view: WorkspaceView) => void }
const views = [
  {id:'live' as const,label:'Live Tokens',Icon:RadioTower},
  {id:'trending' as const,label:'Trending',Icon:TrendingUp},
  {id:'portfolio' as const,label:'Portfolio',Icon:Wallet},
]
const routes = [
  {href:'/intelligence',label:'SPY Intelligence',Icon:Radar},
  {href:'/compare',label:'Token Comparison',Icon:GitCompareArrows},
  {href:'/calculator',label:'Trade Calculator',Icon:Calculator},
]
// Permanent desktop sidebar; compact row navigation on small screens.
const outer='w-full min-w-0 self-start rounded-[24px] border border-white/15 bg-[#101012]/95 p-2.5 shadow-[0_12px_35px_rgba(0,0,0,.22)] lg:sticky lg:top-24'
const item='inline-flex min-w-0 flex-1 items-center justify-center gap-2.5 rounded-xl border px-3 py-3 text-xs font-medium transition-colors sm:text-sm lg:w-full lg:flex-none lg:justify-start'
export function WorkspaceSidebar({activeView,onViewChange}:Props) {
  const pathname=usePathname()
  return <aside aria-label="Token workspace navigation" className={outer}>
    <nav className="flex flex-wrap gap-1 lg:flex-col" aria-label="Workspace pages">
      {views.map(({id,label,Icon})=>{
        const active=!!onViewChange&&activeView===id
        const classes=cn(item,active?'border-white/35 bg-[#f0f0f0] text-[#111]':'border-transparent text-zinc-300 hover:border-white/10 hover:bg-white/[.07] hover:text-white')
        const children=<><Icon className={cn('size-4 shrink-0',active?'text-[#e56c1c]':'text-zinc-400')} aria-hidden="true"/><span className="truncate">{label}</span></>
        return onViewChange?<button key={id} type="button" onClick={()=>onViewChange(id)} aria-current={active?'page':undefined} className={classes}>{children}</button>:<Link key={id} href={`/?workspace=${id}`} className={classes}>{children}</Link>
      })}
      <div className="my-0.5 hidden border-t border-white/10 lg:block"/>
      {routes.map(({href,label,Icon})=>{
        const active=pathname===href
        return <Link key={href} href={href} aria-current={active?'page':undefined} className={cn(item,active?'border-white/35 bg-[#f0f0f0] text-[#111]':'border-transparent text-zinc-300 hover:border-white/10 hover:bg-white/[.07] hover:text-white')}>
          <Icon className={cn('size-4 shrink-0',active?'text-[#e56c1c]':'text-zinc-400')} aria-hidden="true"/><span className="truncate">{label}</span>
        </Link>
      })}
    </nav>
  </aside>
}
