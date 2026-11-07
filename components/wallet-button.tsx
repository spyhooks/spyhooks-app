'use client'

import { Wallet } from 'lucide-react'
import { useWallet } from '@/components/use-wallet'
import { shortAddress } from '@/lib/config'

export function WalletButton() {
  const { account, connect, disconnect } = useWallet()
  return (
    <button
      type="button"
      onClick={account ? disconnect : connect}
      className="bg-brand inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:brightness-110"
    >
      <Wallet className="size-4" />
      <span className="hidden sm:inline">{account ? shortAddress(account) : 'Connect'}</span>
      <span className="sm:hidden">{account ? shortAddress(account).slice(0, 6) : 'Connect'}</span>
    </button>
  )
}
