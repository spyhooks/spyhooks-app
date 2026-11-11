import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, IBM_Plex_Mono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { ConfigProvider } from '@/components/config-provider'
import { SiteHeader } from '@/components/site-header'
import { HeroVisibilityProvider } from '@/components/hero-visibility'
import { AbstractWaveDepth } from '@/components/abstract-wave-depth'
import { getServerConfig } from '@/lib/config.server'
import './globals.css'

const grotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-grotesk' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' })

export async function generateMetadata(): Promise<Metadata> {
  const config = await getServerConfig()
  return {
    title: `${config.siteName} — ${config.tagline}`,
    description: config.description,
    icons: { icon: config.favicon, shortcut: config.favicon, apple: config.logo },
  }
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#080808' },
    { media: '(prefers-color-scheme: dark)', color: '#080808' },
  ],
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const config = await getServerConfig()
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${grotesk.variable} ${plexMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false} disableTransitionOnChange>
          <ConfigProvider initial={config}>
            <HeroVisibilityProvider>
            <div className="relative min-h-dvh overflow-x-clip">
              <div aria-hidden="true" className="site-backdrop pointer-events-none fixed inset-0 -z-10 hidden dark:block" />
              <div aria-hidden="true" className="site-backdrop-light pointer-events-none fixed inset-0 -z-10 dark:hidden" />
              <AbstractWaveDepth />
              <div className="relative z-10"><SiteHeader /></div>
              <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-14 pt-6 sm:px-6">{children}</main>
            </div>
            </HeroVisibilityProvider>
          </ConfigProvider>
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
