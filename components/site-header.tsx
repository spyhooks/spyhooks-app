'use client'

import Link from 'next/link'
import { useConfig } from '@/components/config-provider'
import { ThemeToggle } from '@/components/theme-toggle'
import { WalletButton } from '@/components/wallet-button'
import { XIcon } from '@/components/x-icon'
import { UTCClock } from '@/components/utc-clock'

export function SiteHeader() {
  const { siteName, logo, links, network } = useConfig()
  return (
    <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 pt-5 sm:px-6">
      <Link href="/" className="group flex items-center gap-3" aria-label={`${siteName} home`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo || '/placeholder.svg'} alt="" width={48} height={48} className="size-12 shrink-0 object-contain" />
        <span className="flex flex-col leading-none">
          <span className="text-lg font-black italic uppercase tracking-tight">{siteName}</span>
          <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{network.name}</span>
        </span>
      </Link>
      <div className="pointer-events-none absolute left-1/2 top-5 hidden -translate-x-1/2 lg:block">
        <UTCClock />
      </div>
      <div className="flex items-center gap-2">
        {links.x && (
          <a
            href={links.x}
            target="_blank"
            rel="noopener noreferrer"
            className="glass inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium transition hover:text-primary"
            aria-label={`${siteName} on X`}
          >
            <XIcon className="size-4" />
            <span className="hidden sm:inline">{links.xHandle || 'X'}</span>
          </a>
        )}
        {links.github && /^https:\/\/github\.com(?:\/|$)/i.test(links.github) && (
          <a
            href={links.github}
            target="_blank"
            rel="noopener noreferrer"
            className="glass inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium transition hover:text-primary"
            aria-label={`${siteName} on GitHub`}
            title="GitHub"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-4 fill-current"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.38 7.86 10.9.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.16 1.18A11 11 0 0 1 12 6.12c.97 0 1.95.13 2.87.39 2.19-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.42-2.68 5.4-5.24 5.69.41.35.77 1.04.77 2.09 0 1.51-.02 2.73-.02 3.1 0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
            </svg>
            <span className="hidden sm:inline">GitHub</span>
          </a>
        )}
        <ThemeToggle />
        <WalletButton />
      </div>
    </header>
  )
}
