'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'spyhooks:home-hero-visible:v1'

type HeroVisibilityValue = {
  heroVisible: boolean
  toggleHero: () => void
}

const HeroVisibilityContext = createContext<HeroVisibilityValue | null>(null)

export function HeroVisibilityProvider({ children }: { children: ReactNode }) {
  // Keep SSR and the first client render identical to avoid hydration mismatches.
  const [heroVisible, setHeroVisible] = useState(true)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'hidden') setHeroVisible(false)
      else if (saved === 'visible') setHeroVisible(true)
    } catch { /* Browser storage can be unavailable. */ }
  }, [])

  const toggleHero = () => {
    const next = !heroVisible
    setHeroVisible(next)
    try { localStorage.setItem(STORAGE_KEY, next ? 'visible' : 'hidden') } catch { /* Private browsing. */ }
  }

  return (
    <HeroVisibilityContext.Provider value={{ heroVisible, toggleHero }}>
      {children}
    </HeroVisibilityContext.Provider>
  )
}

export function useHeroVisibility(): HeroVisibilityValue {
  const context = useContext(HeroVisibilityContext)
  if (!context) throw new Error('useHeroVisibility must be used inside HeroVisibilityProvider')
  return context
}
