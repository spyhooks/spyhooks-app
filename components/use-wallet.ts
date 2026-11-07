'use client'

import useSWR from 'swr'

type Eip1193 = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }

function getProvider(): Eip1193 | undefined {
  return (globalThis as unknown as { ethereum?: Eip1193 }).ethereum
}

async function readAccount(): Promise<string | null> {
  const provider = getProvider()
  if (!provider) return null
  const accounts = (await provider.request({ method: 'eth_accounts' })) as string[]
  return accounts[0] ?? null
}

export function useWallet() {
  const { data, mutate } = useSWR('wallet-account', readAccount, { revalidateOnFocus: true })

  const connect = async () => {
    const provider = getProvider()
    if (!provider) {
      window.alert('No EVM wallet detected. Install MetaMask, Rabby or another EIP-1193 wallet.')
      return
    }
    const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[]
    await mutate(accounts[0] ?? null, { revalidate: false })
  }

  const disconnect = () => mutate(null, { revalidate: false })

  return { account: data ?? null, connect, disconnect }
}
