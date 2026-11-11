'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useConfig } from '@/components/config-provider'
import { WalletButton } from '@/components/wallet-button'
import { XIcon } from '@/components/x-icon'
import { cn } from '@/lib/utils'
import { useHeroVisibility } from '@/components/hero-visibility'

const SpyScanIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0">
    <path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" />
    <circle cx="11" cy="11" r="4" />
    <path d="m14.2 14.2 3.2 3.2" />
  </svg>
)

const GithubIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-current" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.38 7.86 10.9.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.16 1.18A11 11 0 0 1 12 6.12c.97 0 1.95.13 2.87.39 2.19-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.42-2.68 5.4-5.24 5.69.41.35.77 1.04.77 2.09 0 1.51-.02 2.73-.02 3.1 0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
  </svg>
)

export function SiteHeader() {
  const { siteName, logo, links, network, nav, token } = useConfig()
  // Read from the same live config as the hero card. Never activate for placeholders.
  const configuredContract = typeof token?.contract === 'string' ? token.contract.trim() : ''
  const isSpyhooksLive = /^0x[0-9a-fA-F]{40}$/.test(configuredContract) && !/^0x0{40}$/i.test(configuredContract)
  const pathname = usePathname()
  const { heroVisible, toggleHero } = useHeroVisibility()
  // SPY is always centered between Launchpads and $SPYHOOKS. All other tabs keep their existing order.
  const existingTabs = (nav ?? []).filter((item) => item.key !== 'spy' && item.href !== '/spy')
  const spyTab = { key: 'spy', label: 'SPY', href: '/spy' }
  const afterLaunchpads = existingTabs.findIndex((item) => item.key === 'launchpads' || item.href === '/launchpads')
  const beforeToken = existingTabs.findIndex((item) => item.key === 'token' || item.href === '/token')
  const spyIndex = afterLaunchpads >= 0 ? afterLaunchpads + 1 : beforeToken >= 0 ? beforeToken : Math.ceil(existingTabs.length / 2)
  const tabs = [...existingTabs.slice(0, spyIndex), spyTab, ...existingTabs.slice(spyIndex)]

  return (
    <header className="relative z-40 mx-auto w-full max-w-7xl px-4 pt-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 xl:flex-nowrap">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label={`${siteName} home`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo || '/placeholder.svg'} alt="" width={44} height={44} className="size-11 shrink-0 object-contain" />
          <span className="flex flex-col leading-none">
            <span className="text-xl font-black italic uppercase tracking-tight sm:text-[26px]">
              {siteName.toUpperCase() === 'SPYHOOKS' ? (
                <><span className="text-white">SPY</span><span className="text-black" style={{ WebkitTextStroke: '1.5px #fff', paintOrder: 'stroke fill' }}>HOOKS</span></>
              ) : siteName}
            </span>
            <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{network.name}</span>
          </span>
        </Link>

        {/* Desktop: navigation and social controls share the same vertical centerline. */}
        <nav aria-label="Primary" className="order-3 w-full overflow-x-auto [scrollbar-width:none] xl:order-none xl:w-auto xl:min-w-0 xl:flex-1 [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max items-center justify-start overflow-hidden rounded-full border border-white/15 bg-[#0b0b0d]/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-md xl:mx-auto xl:w-max">
            {tabs.map((item, index) => {
              const active = item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`)
              const isSpy = item.key === 'spy'
              const isMainToken = item.key === 'token' || item.href === '/token'
              return (
                <div key={item.key} className="flex shrink-0 items-center">
                  {index > 0 && <span aria-hidden="true" className="h-4 w-px bg-white/10" />}
                  {item.href === '/' ? (
                    <div className={cn(
                      'inline-flex h-9 shrink-0 items-center overflow-hidden rounded-full',
                      active ? 'bg-white text-black shadow-[0_2px_10px_rgba(255,255,255,0.18)]' : 'text-white/65'
                    )}>
                      <Link
                        href="/"
                        aria-current={active ? 'page' : undefined}
                        className="inline-flex h-9 items-center pl-3 pr-1.5 text-xs font-semibold transition hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff781f]"
                      >
                        {item.label}
                      </Link>
                      <button
                        type="button"
                        aria-label={heroVisible ? 'Hide homepage hero' : 'Show homepage hero'}
                        title={heroVisible ? 'Hide hero' : 'Show hero'}
                        aria-expanded={heroVisible}
                        aria-controls="spyhooks-home-hero"
                        onClick={toggleHero}
                        className="mr-1 inline-flex size-7 items-center justify-center rounded-full transition hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff781f] dark:hover:bg-black/15"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={cn('size-3.5 transition-transform duration-300', !heroVisible && 'rotate-180')}>
                          <path d="m6 14 6-6 6 6" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-semibold transition-[background-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff781f]',
                      active
                        ? 'bg-white text-black shadow-[0_2px_10px_rgba(255,255,255,0.18)]'
                        : 'text-white/65 hover:bg-white/10 hover:text-white',
                    )}
                  >
                    {isSpy && <SpyScanIcon />}
                    {item.label}
                    {isMainToken && isSpyhooksLive && (
                      <span className="ml-0.5 inline-flex items-center gap-1 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold leading-none tracking-wide text-emerald-400" aria-label="SPYHOOKS token contract configured, live">
                        <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                        LIVE
                      </span>
                    )}
                  </Link>
                  )}
                </div>
              )
            })}
          </div>
        </nav>

        {/* One shared pill for X, GitHub and Wallet, like the reference. */}
        <div className="flex h-12 shrink-0 items-center gap-0 rounded-full border border-white/20 bg-[#0b0b0d]/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_24px_rgba(0,0,0,0.3)] backdrop-blur-md">
          {links.x && (
            <a
              href={links.x}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${siteName} on X`}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-full px-3 text-xs font-medium text-white transition-colors hover:bg-white/10"
            >
              <XIcon className="size-4" />
              <span className="hidden sm:inline">{links.xHandle || 'X'}</span>
            </a>
          )}
          {links.x && links.github && /^https:\/\/github\.com(?:\/|$)/i.test(links.github) && (
            <span aria-hidden="true" className="mx-1 h-5 w-px bg-white/15" />
          )}
          {links.github && /^https:\/\/github\.com(?:\/|$)/i.test(links.github) && (
            <a
              href={links.github}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${siteName} on GitHub`}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-full px-3 text-xs font-medium text-white transition-colors hover:bg-white/10"
            >
              <GithubIcon />
              <span className="hidden sm:inline">GitHub</span>
            </a>
          )}
          {(links.x || (links.github && /^https:\/\/github\.com(?:\/|$)/i.test(links.github))) && (
            <span aria-hidden="true" className="mx-1 h-5 w-px bg-white/15" />
          )}
          <WalletButton />
        </div>
      </div>
    </header>
  )
}
