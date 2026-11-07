'use client'

import { createContext, useContext, useEffect } from 'react'
import useSWR from 'swr'
import { fallbackConfig, type SiteConfig } from '@/lib/config'

const ConfigContext = createContext<SiteConfig>(fallbackConfig)

const fetchConfig = (url: string) =>
  fetch(url, { cache: 'no-store' })
    .then((res) => res.json())
    .then((data) => ({ ...fallbackConfig, ...data }) as SiteConfig)

export function ConfigProvider({ initial, children }: { initial: SiteConfig; children: React.ReactNode }) {
  const { data } = useSWR<SiteConfig>('/config.json', fetchConfig, {
    fallbackData: initial,
    revalidateOnFocus: false,
  })
  const config = data ?? initial

  useEffect(() => {
    document.title = `${config.siteName} — ${config.tagline}`
    let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = config.favicon
  }, [config.siteName, config.tagline, config.favicon])

  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
}

export const useConfig = () => useContext(ConfigContext)
