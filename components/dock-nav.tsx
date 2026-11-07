'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeftRight, BookOpen, Coins, Radar, Rocket, type LucideIcon } from 'lucide-react'
import { useConfig } from '@/components/config-provider'
import { cn } from '@/lib/utils'

const icons: Record<string, LucideIcon> = {
  tokens: Radar,
  swap: ArrowLeftRight,
  launchpads: Rocket,
  token: Coins,
  docs: BookOpen,
}

export function DockNav() {
  const { nav } = useConfig()
  const pathname = usePathname()

  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-3">
      <ul className="glass flex w-full max-w-xl items-center justify-between gap-1 rounded-full p-1.5 shadow-2xl shadow-primary/15">
        {nav.map((item) => {
          const Icon = icons[item.key] ?? Radar
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-full px-2 py-2 text-[11px] font-semibold transition sm:flex-row sm:justify-center sm:gap-2 sm:px-4 sm:text-sm',
                  active ? 'bg-brand text-primary-foreground shadow-md shadow-primary/30' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
