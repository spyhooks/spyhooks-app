'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowDownUp, LoaderCircle } from 'lucide-react'
import { createWalletClient, custom, parseAbi, formatEther, formatUnits, getAddress, parseEther, parseUnits, type Address } from 'viem'
import { useConfig } from '@/components/config-provider'
import { useTokens } from '@/components/use-tokens'
import { useWallet } from '@/components/use-wallet'
import { shortAddress } from '@/lib/config'
import type { TokenRow } from '@/lib/tokens'
import { curveAbi, erc20Abi, factoryAbi, publicClient, robinhoodChain, RH_CHAIN_ID, quoteCurveBuy, quoteCurveSell, quoteGraduatedV4 } from '@/lib/pons-trading'

type Eip1193 = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
const FACTORY = '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e' as Address
const EXPLORER = 'https://robinhoodchain.blockscout.com/tx/'
const OFFICIAL_OPTION = '__spyhooks_official__'
const TRENDING_OPTION = '__trending_contract__'
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

function isConfiguredAddress(value: string | undefined): value is `0x${string}` {
  return Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value) && value.toLowerCase() !== ZERO_ADDRESS)
}

export function SwapCard() {
  const { network, fees, token: officialConfig, logo: siteLogo } = useConfig()
  const { tokens } = useTokens()
  const { account, connect } = useWallet()
  const params = useSearchParams()
  const requestedTicker = params.get('token')
  const requestedCA = params.get('ca')
  const validRequestedCA = requestedCA && ADDRESS_PATTERN.test(requestedCA) ? requestedCA.toLowerCase() : null
  // CA deep links take priority, avoiding ticker collisions and truncated Live Tokens history.
  const [ticker, setTicker] = useState(validRequestedCA ? TRENDING_OPTION : requestedTicker && requestedTicker.toLowerCase() !== (officialConfig.ticker || 'SPYHOOKS').toLowerCase() ? requestedTicker : OFFICIAL_OPTION)
  const [externalToken, setExternalToken] = useState<TokenRow | undefined>()
  const [externalError, setExternalError] = useState('')
  useEffect(() => {
    let cancelled = false
    setExternalToken(undefined)
    setExternalError('')
    if (!validRequestedCA) return
    setTicker(TRENDING_OPTION)
    ;(async () => {
      try {
        const address = getAddress(validRequestedCA)
        // Only allow the configured Pons factory's token registry to provide trading routes.
        const launch = await publicClient.readContract({
          address: FACTORY,
          abi: factoryAbi,
          functionName: 'getLaunchedToken',
          args: [address],
        })
        if (!launch.exists || launch.curve.toLowerCase() === ZERO_ADDRESS) {
          throw new Error('Token not indexed by the configured Pons V2 factory. It may be a Pons V1 token or another launch version.')
        }
        const metadataAbi = parseAbi([
          'function name() view returns (string)',
          'function symbol() view returns (string)',
        ])
        const [nameResult, symbolResult] = await Promise.allSettled([
          publicClient.readContract({ address, abi: metadataAbi, functionName: 'name' }),
          publicClient.readContract({ address, abi: metadataAbi, functionName: 'symbol' }),
        ])
        if (cancelled) return
        const name = nameResult.status === 'fulfilled' ? nameResult.value : 'Pons token'
        const symbol = symbolResult.status === 'fulfilled' ? symbolResult.value : 'TOKEN'
        const verifiedToken: TokenRow = {
          address,
          curveAddress: getAddress(launch.curve),
          name,
          ticker: symbol,
          launchpad: 'Pons',
          status: Number(launch.phase) === 2 ? 'graduated' : Number(launch.phase) === 1 ? 'graduating' : 'curve',
          progress: 0,
          mcap: 0,
          volume: 0,
          ageMinutes: 0,
          price: 0,
        }
        setExternalToken(verifiedToken)
        // Optional artwork is loaded after the on-chain verified token is already usable.
        try {
          const response = await fetch('/api/pons-trending', { cache: 'no-store' })
          if (response.ok) {
            const payload = await response.json() as { tokens?: Array<{ address: string; logoUrl?: string | null }> }
            const match = payload.tokens?.find((item) => item.address.toLowerCase() === address.toLowerCase())
            if (!cancelled && match?.logoUrl?.startsWith('https://')) {
              setExternalToken({ ...verifiedToken, logoUrl: match.logoUrl })
            }
          }
        } catch { /* Artwork is optional; never block swap. */ }
      } catch (error) {
        if (!cancelled) setExternalError(error instanceof Error ? error.message : 'Could not verify token on chain.')
      }
    })()
    return () => { cancelled = true }
  }, [validRequestedCA])
  const [officialLaunch, setOfficialLaunch] = useState<{ curve: Address; phase: number } | null>(null)
  const [officialStatus, setOfficialStatus] = useState<'soon' | 'checking' | 'active' | 'surfaced' | 'unavailable'>('soon')
  const configuredOfficialAddress = officialConfig.contract?.trim() ?? ''
  const hasOfficialAddress = isConfiguredAddress(configuredOfficialAddress)

  // Verify with the *same* Pons factory used for ordinary trades; a filled CA alone
  // is not permission to trade. This works even when the live token list is truncated.
  useEffect(() => {
    let cancelled = false
    setOfficialLaunch(null)
    if (!hasOfficialAddress) { setOfficialStatus('soon'); return }
    setOfficialStatus('checking')
    ;(async () => {
      try {
        const result = await publicClient.readContract({
          address: FACTORY,
          abi: factoryAbi,
          functionName: 'getLaunchedToken',
          args: [getAddress(configuredOfficialAddress)],
        })
        if (cancelled) return
        if (!result.exists || result.curve.toLowerCase() === ZERO_ADDRESS ||
            result.pairToken.toLowerCase() !== ZERO_ADDRESS) {
          setOfficialStatus('unavailable')
          return
        }
        const phase = Number(result.phase)
        setOfficialLaunch({ curve: getAddress(result.curve), phase })
        setOfficialStatus(phase === 0 ? 'active' : phase === 2 ? 'surfaced' : 'unavailable')
      } catch {
        if (!cancelled) setOfficialStatus('unavailable')
      }
    })()
    return () => { cancelled = true }
  }, [configuredOfficialAddress, hasOfficialAddress])
  const [amount, setAmount] = useState('')
  const [selling, setSelling] = useState(false)
  const [quote, setQuote] = useState('')
  const [route, setRoute] = useState('Checking on-chain token phase…')
  const [phase, setPhase] = useState<number | null>(null)
  const [nativeQuote, setNativeQuote] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [txHash, setTxHash] = useState('')
  const [tokenBalance, setTokenBalance] = useState<bigint | null>(null)
  const [ethBalance, setEthBalance] = useState<bigint | null>(null)
  const [balanceDecimals, setBalanceDecimals] = useState(18)
  const officialToken = useMemo<TokenRow | undefined>(() => {
    if (!hasOfficialAddress || !officialLaunch) return undefined
    const found = tokens.find((t) => t.address.toLowerCase() === configuredOfficialAddress.toLowerCase())
    return {
      name: officialConfig.name || 'SPYHOOKS',
      ticker: officialConfig.ticker || 'SPYHOOKS',
      address: getAddress(configuredOfficialAddress),
      curveAddress: officialLaunch.curve,
      logoUrl: siteLogo,
      launchpad: 'Pons',
      progress: found?.progress ?? 0,
      mcap: found?.mcap ?? 0,
      volume: found?.volume ?? 0,
      ageMinutes: found?.ageMinutes ?? 0,
      price: found?.price ?? 0,
      status: officialLaunch.phase === 2 ? 'graduated' : 'curve',
    }
  }, [hasOfficialAddress, officialLaunch, configuredOfficialAddress, officialConfig.name, officialConfig.ticker, tokens, siteLogo])
  const token = ticker === OFFICIAL_OPTION ? officialToken : ticker === TRENDING_OPTION ? externalToken : tokens.find((t) => t.ticker === ticker)
  const selectedOfficial = ticker === OFFICIAL_OPTION
  const valid = Number.isFinite(Number(amount)) && Number(amount) > 0
  const curveAddress = token?.curveAddress as Address | undefined
  const tokenAddress = token?.address as Address | undefined
  const canTradeCurve = phase === 0 && nativeQuote && Boolean(curveAddress) && Boolean(tokenAddress)
  const externalSwapLink = validRequestedCA ? `https://ponsfamily.com/launchpad/${validRequestedCA}` : null
  const unsupportedQuoteAsset = Boolean(tokenAddress && phase !== null && !nativeQuote)

  useEffect(() => {
    let cancelled = false
    setTokenBalance(null)
    setBalanceDecimals(18)
    if (!account || !tokenAddress) return
    ;(async () => {
      try {
        const [decimals, balance] = await Promise.all([
          publicClient.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'decimals' }),
          publicClient.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'balanceOf', args: [getAddress(account)] }),
        ])
        if (!cancelled) {
          setBalanceDecimals(Number(decimals))
          setTokenBalance(balance)
        }
      } catch {
        if (!cancelled) setTokenBalance(null)
      }
    })()
    return () => { cancelled = true }
  }, [account, tokenAddress, selling])

  // Native ETH balance for buy shortcuts, read on the same configured Robinhood chain.
  useEffect(() => {
    let cancelled = false
    setEthBalance(null)
    if (!account) return
    const read = async () => {
      try {
        const balance = await publicClient.getBalance({ address: getAddress(account) })
        if (!cancelled) setEthBalance(balance)
      } catch { if (!cancelled) setEthBalance(null) }
    }
    void read()
    return () => { cancelled = true }
  }, [account, selling, busy, txHash])

  function setBuyPercentage(percent: number) {
    if (ethBalance === null || ethBalance <= 0n) return
    // Keep a conservative gas reserve when using 100% of ETH.
    const gasReserve = parseEther('0.003')
    const spendable = ethBalance > gasReserve ? ethBalance - gasReserve : 0n
    const requested = (ethBalance * BigInt(percent)) / 100n
    const part = requested < spendable ? requested : spendable
    const formatted = formatEther(part)
    setAmount(formatted.includes('.') ? formatted.replace(/0+$/, '').replace(/\.$/, '') : formatted)
  }

  function setSellPercentage(percent: number) {
    if (tokenBalance === null) return
    const part = (tokenBalance * BigInt(percent)) / 100n
    const formatted = formatUnits(part, balanceDecimals)
    setAmount(formatted.includes('.') ? formatted.replace(/0+$/, '').replace(/\.$/, '') : formatted)
  }

  useEffect(() => {
    let cancelled = false
    setQuote('')
    setMessage('')
    setTxHash('')
    if (!tokenAddress) { setRoute('No verified token address'); setPhase(null); setNativeQuote(false); return }
    ;(async () => {
      try {
        const launch = await publicClient.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'getLaunchedToken', args: [getAddress(tokenAddress)] })
        if (cancelled) return
        const p = Number(launch.phase)
        setPhase(p)
        if (!launch.exists || !launch.curve || launch.curve === '0x0000000000000000000000000000000000000000') {
          setRoute('Token is not verified by the configured Pons factory'); return
        }
        const native = launch.pairToken === '0x0000000000000000000000000000000000000000'
        setNativeQuote(native)
        if (p === 0) setRoute(native ? 'Pons bonding curve (native ETH)' : 'Pons V2 curve — non-ETH quote asset; trading here is not enabled')
        else if (p === 2) setRoute(native ? 'Pons V2 — Uniswap v4 (ETH pair); execution not enabled' : 'Pons V2 — Uniswap v4 (non-ETH pair); trading here is not enabled')
        else if (p === 1) setRoute('Pons graduation in progress — trading paused')
        else setRoute('Pons launch rescued — normal trading disabled')
      } catch (e) {
        if (!cancelled) { setPhase(null); setRoute('Could not verify token phase on-chain'); setMessage(e instanceof Error ? e.message : 'Unable to read factory') }
      }
    })()
    return () => { cancelled = true }
  }, [tokenAddress])

  useEffect(() => {
    let cancelled = false
    const update = async () => {
      setQuote('')
      if (!valid || !account || !tokenAddress || !nativeQuote) return
      try {
        const tokenDecimals = Number(await publicClient.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'decimals' }))
        if (phase === 2) {
          const launch = await publicClient.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'getLaunchedToken', args: [getAddress(tokenAddress)] })
          if (Number(launch.phase) !== 2) throw new Error('Token phase changed. Refresh and quote again.')
          const amountIn = selling ? parseUnits(amount, tokenDecimals) : parseEther(amount)
          const result = await quoteGraduatedV4({ token: getAddress(tokenAddress), pairToken: getAddress(launch.pairToken), poolFee: Number(launch.poolFee), tickSpacing: Number(launch.tickSpacing), amountIn, selling })
          if (result.amountOut <= 0n) throw new Error('V4 quote output is zero.')
          if (!cancelled) setQuote(selling ? formatEther(result.amountOut) : formatUnits(result.amountOut, tokenDecimals))
          return
        }
        if (!curveAddress || phase !== 0) return
        if (selling) {
          const amountIn = parseUnits(amount, tokenDecimals)
          const result = await quoteCurveSell(curveAddress, amountIn)
          if (!cancelled) setQuote(formatEther(result.quoteOut))
        } else {
          const result = await quoteCurveBuy(curveAddress, parseEther(amount), getAddress(account))
          if (!cancelled) setQuote(formatUnits(result.tokensOut, tokenDecimals))
        }
      } catch (e) {
        if (!cancelled) setMessage(e instanceof Error ? e.message : 'Could not quote trade')
      }
    }
    void update()
    return () => { cancelled = true }
  }, [amount, account, curveAddress, tokenAddress, selling, valid, phase, nativeQuote])

  const outputLabel = selling ? network.currency : token?.ticker
  const inputLabel = selling ? token?.ticker : network.currency
  const actionLabel = useMemo(() => {
    if (selectedOfficial && officialStatus === 'soon') return 'SPYHOOKS — Soon'
    if (selectedOfficial && officialStatus === 'checking') return 'Checking SPYHOOKS launch…'
    if (selectedOfficial && officialStatus === 'unavailable') return 'SPYHOOKS trading unavailable'
    if (ticker === TRENDING_OPTION && !externalToken) return externalError ? 'Token not supported here — open on Pons' : 'Verifying Pons token…'
    if (unsupportedQuoteAsset) return 'Non-ETH market — open on Pons'
    if (phase === 2) return 'Uniswap v4 execution not enabled yet'
    if (busy) return 'Processing…'
    if (!account) return 'Connect wallet'
    if (!valid) return 'Enter an amount'
    if (phase !== 0 || !nativeQuote || !curveAddress) return 'Trading unavailable for this token'
    return selling ? `Sell ${token?.ticker}` : `Buy ${token?.ticker}`
  }, [account, busy, valid, phase, nativeQuote, curveAddress, selling, token?.ticker, selectedOfficial, officialStatus, ticker, externalToken, externalError, unsupportedQuoteAsset])

  async function trade() {
    if (selectedOfficial && officialStatus !== 'active') return
    if (!account) { await connect(); return }
    if (!valid || !tokenAddress || !curveAddress || phase !== 0 || !nativeQuote) { if (phase === 2) setMessage('Quote is available, but transaction execution remains disabled until Universal Router calldata is validated.'); return }
    const provider = (globalThis as unknown as { ethereum?: Eip1193 }).ethereum
    if (!provider) { setMessage('No EVM wallet detected.'); return }
    setBusy(true); setMessage(''); setTxHash('')
    try {
      const chainId = Number(await provider.request({ method: 'eth_chainId' }))
      if (chainId !== RH_CHAIN_ID) throw new Error('Switch your wallet to Robinhood Chain (chain ID 4663) before trading.')
      const wallet = createWalletClient({ account: getAddress(account), chain: robinhoodChain, transport: custom(provider as never) })
      const [tokenDecimals, launch] = await Promise.all([
        publicClient.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'decimals' }),
        publicClient.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'getLaunchedToken', args: [getAddress(tokenAddress)] }),
      ])
      if (Number(launch.phase) !== 0 || launch.curve.toLowerCase() !== curveAddress.toLowerCase()) throw new Error('Token phase or curve changed. Refresh and quote again.')
      let hash: `0x${string}`
      if (!selling) {
        const input = parseEther(amount)
        const q = await quoteCurveBuy(curveAddress, input, getAddress(account))
        if (q.tokensOut <= 0n) throw new Error('Quote output is zero.')
        const minOut = (q.tokensOut * 9900n) / 10000n
        hash = await wallet.writeContract({ address: curveAddress, abi: curveAbi, functionName: 'buy', args: [input, minOut, getAddress(account)], value: input, account: getAddress(account), chain: robinhoodChain })
      } else {
        const input = parseUnits(amount, tokenDecimals)
        const q = await quoteCurveSell(curveAddress, input)
        if (q.quoteOut <= 0n) throw new Error('Quote output is zero.')
        const minOut = (q.quoteOut * 9900n) / 10000n
        const allowance = await publicClient.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'allowance', args: [getAddress(account), curveAddress] })
        if (allowance < input) {
          setMessage('Approve token spending in your wallet…')
          const approveHash = await wallet.writeContract({ address: tokenAddress, abi: erc20Abi, functionName: 'approve', args: [curveAddress, input], account: getAddress(account), chain: robinhoodChain })
          await publicClient.waitForTransactionReceipt({ hash: approveHash })
        }
        hash = await wallet.writeContract({ address: curveAddress, abi: curveAbi, functionName: 'sell', args: [input, minOut, getAddress(account)], account: getAddress(account), chain: robinhoodChain })
      }
      setTxHash(hash); setMessage('Transaction submitted. Waiting for confirmation…')
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new Error('Transaction reverted. Check the transaction details on Blockscout.')
      setMessage('Swap confirmed successfully.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Transaction failed')
    } finally { setBusy(false) }
  }

  return (
    <div className="glass mx-auto w-full max-w-md rounded-[2rem] p-3 shadow-2xl shadow-primary/10">
      <div className="rounded-3xl bg-background/60 p-4">
        <label htmlFor="swap-in" className="text-xs uppercase tracking-wider text-muted-foreground">{selling ? 'You sell' : 'You pay'}</label>
        <div className="mt-2 flex items-center gap-3">
          <input id="swap-in" inputMode="decimal" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} className="w-full min-w-0 bg-transparent font-mono text-3xl outline-none placeholder:text-muted-foreground/50" />
          {selling ? <div className="flex items-center gap-2"><TokenLogo ticker={selectedOfficial ? (officialConfig.ticker || 'SPYHOOKS') : token?.ticker ?? '?'} logoUrl={selectedOfficial ? siteLogo : token?.logoUrl} /><TokenSelect value={ticker} onChange={setTicker} externalToken={externalToken} officialTicker={officialConfig.ticker || 'SPYHOOKS'} officialStatus={officialStatus} officialAddress={configuredOfficialAddress} /></div> : <span className="rounded-full bg-muted px-4 py-2 font-mono text-sm font-medium">{network.currency}</span>}
        </div>
        <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>Wallet balance</span>
              <span className="font-mono text-foreground">{selling ? (tokenBalance === null ? (account ? 'Loading balance…' : 'Connect wallet') : `${Number(formatUnits(tokenBalance, balanceDecimals)).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${token?.ticker ?? ''}`) : (ethBalance === null ? (account ? 'Loading balance…' : 'Connect wallet') : `${Number(formatEther(ethBalance)).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${network.currency}`)}</span>
            </div>
            <div className="grid grid-cols-5 gap-2" aria-label={selling ? "Sell percentage of balance" : "ETH percentage of available balance"}>
              {[20, 40, 60, 80, 100].map((percent) => (
                <button key={percent} type="button" disabled={busy || (selling ? (tokenBalance === null || tokenBalance === 0n) : (ethBalance === null || ethBalance <= parseEther('0.003')))} onClick={() => selling ? setSellPercentage(percent) : setBuyPercentage(percent)} className="rounded-full border border-white/10 bg-muted/70 px-2 py-2 text-xs font-semibold transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40">{percent}%</button>
              ))}
            </div>
          </div>
      </div>
      <div className="relative z-10 -my-3 flex justify-center"><button type="button" onClick={() => setSelling((s) => !s)} aria-label="Switch buy and sell" className="bg-brand flex size-9 items-center justify-center rounded-full border-4 border-background text-primary-foreground transition hover:rotate-180"><ArrowDownUp className="size-4" /></button></div>
      <div className="rounded-3xl bg-background/60 p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{unsupportedQuoteAsset ? 'Receive estimate unavailable for non-ETH pair' : 'You receive (estimated on-chain quote)'}</p>
        <div className="mt-2 flex items-center gap-3"><p className="w-full min-w-0 truncate font-mono text-3xl">{quote ? Number(quote).toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—'}</p>{selling ? <span className="rounded-full bg-muted px-4 py-2 font-mono text-sm font-medium">{network.currency}</span> : <div className="flex items-center gap-2"><TokenLogo ticker={selectedOfficial ? (officialConfig.ticker || 'SPYHOOKS') : token?.ticker ?? '?'} logoUrl={selectedOfficial ? siteLogo : token?.logoUrl} /><TokenSelect value={ticker} onChange={setTicker} externalToken={externalToken} officialTicker={officialConfig.ticker || 'SPYHOOKS'} officialStatus={officialStatus} officialAddress={configuredOfficialAddress} /></div>}</div>
      </div>
      <dl className="space-y-2 px-3 py-4 text-sm"><Row label="Route" value={selectedOfficial && officialStatus === 'soon' ? 'Awaiting SPYHOOKS launch' : selectedOfficial && officialStatus === 'checking' ? 'Verifying SPYHOOKS on-chain…' : route} /><Row label="Token" value={token?.address ? shortAddress(token.address) : selectedOfficial ? 'Not launched' : 'Unknown'} /><Row label={`Site fee setting (${(fees.bps / 100).toFixed(2)}%)`} value={fees.wallet ? shortAddress(fees.wallet) : 'not set'} /></dl>
      <button type="button" disabled={busy || (selectedOfficial && officialStatus !== 'active') || !tokenAddress || !canTradeCurve || (account ? !valid : false)} onClick={() => void trade()} className="bg-brand flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">{busy && <LoaderCircle className="size-4 animate-spin" />}{actionLabel}</button>
      {ticker === TRENDING_OPTION && !externalToken && <p role="status" className="break-words px-3 pt-3 text-center text-xs text-amber-300">{externalError || 'Checking token on the Pons V2 factory…'}</p>}
      {externalSwapLink && (unsupportedQuoteAsset || Boolean(externalError) || phase === 2) && (
        <a href={externalSwapLink} target="_blank" rel="noopener noreferrer" className="mx-3 mt-3 flex h-11 items-center justify-center rounded-full border border-[#ff781f]/65 bg-[#ff781f]/10 text-center text-xs font-semibold text-[#ffae69] hover:bg-[#ff781f]/20">
          Trade on Pons ↗
        </a>
      )}
      {message && <p role="status" className="break-words px-3 pb-1 pt-3 text-center text-xs">{message}</p>}
      {txHash && <p className="px-3 pb-1 text-center text-xs"><a className="underline" href={`${EXPLORER}${txHash}`} target="_blank" rel="noreferrer">View transaction on Blockscout</a></p>}
      <p className="px-3 pb-2 pt-3 text-center text-xs text-muted-foreground">Quotes are read on-chain from the active venue. Curve trades use a 1% minimum-output tolerance.</p>
      {phase === 2 && <p role="status" className="px-3 pb-2 text-center text-xs text-muted-foreground">Graduated token: this page does not yet execute Uniswap v4 trades. {nativeQuote ? 'On-chain ETH-pair quoting may be available.' : 'This pool uses a non-ETH quote asset, so an ETH input would be misleading.'}</p>}
      {unsupportedQuoteAsset && phase !== 2 && <p role="status" className="px-3 pb-2 text-center text-xs text-amber-300">This token trades against a non-ETH asset. SpyHooks only supports native ETH curves for direct execution at present.</p>}
      {(phase === 1 || phase === 3) && <p role="status" className="px-3 pb-2 text-center text-xs text-muted-foreground">This token is not in a normal tradable phase; no transaction will be sent.</p>}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="truncate font-mono">{value}</dd></div> }

function TokenLogo({ ticker, logoUrl }: { ticker: string; logoUrl?: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [logoUrl])
  return (
    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-muted text-xs font-bold text-foreground" title={`${ticker} token logo`}>
      {logoUrl && !failed ? <img src={logoUrl} alt={`${ticker} logo`} className="size-full object-cover" onError={() => setFailed(true)} /> : ticker.slice(0, 2).toUpperCase()}
    </span>
  )
}

function TokenSelect({ value, onChange, externalToken, officialTicker, officialStatus, officialAddress }: {
  value: string
  onChange: (v: string) => void
  externalToken?: TokenRow
  officialTicker: string
  officialStatus: 'soon' | 'checking' | 'active' | 'surfaced' | 'unavailable'
  officialAddress: string
}) {
  const { tokens } = useTokens()
  const statusLabel = { soon: 'SOON', checking: 'CHECKING', active: 'ACTIVE', surfaced: 'SURFACED', unavailable: 'UNAVAILABLE' }[officialStatus]
  return (
    <select aria-label="Select token" value={value} onChange={(e) => onChange(e.target.value)} className="max-w-36 shrink-0 rounded-full bg-muted px-3 py-2 font-mono text-sm font-medium outline-none">
      <option value={OFFICIAL_OPTION}>★ ${officialTicker} · {statusLabel}</option>
      {value === TRENDING_OPTION && <option value={TRENDING_OPTION}>${externalToken?.ticker ?? 'Checking token'} · Trending</option>}
      {tokens.filter((t) => t.address.toLowerCase() !== officialAddress.toLowerCase()).map((t) => (
        <option key={t.address} value={t.ticker}>${t.ticker}</option>
      ))}
    </select>
  )
}
