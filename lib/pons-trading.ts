import { createPublicClient, defineChain, http, parseAbi, type Address } from 'viem'

export const RH_CHAIN_ID = 4663
export const RPC_URL = 'https://rpc.mainnet.chain.robinhood.com'
export const PONS_FACTORY = '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e' as Address

export const robinhoodChain = defineChain({
  id: RH_CHAIN_ID,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' } },
})

export const publicClient = createPublicClient({ chain: robinhoodChain, transport: http(RPC_URL) })

export const V4_QUOTER = '0x8dc178efb8111bb0973dd9d722ebeff267c98f94' as Address
export const PONS_V2_HOOK = '0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044' as Address

const v4QuoterAbi = parseAbi([
  'function quoteExactInputSingle(((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 exactAmount,bytes hookData) params) returns (uint256 amountOut,uint256 gasEstimate)',
])


/** Quote a graduated Pons v2 pool through the official Uniswap v4 Quoter.
 * This is a read-only eth_call; it does not submit a transaction.
 */
export async function quoteGraduatedV4(args: {
  token: Address
  pairToken: Address
  poolFee: number
  tickSpacing: number
  amountIn: bigint
  selling: boolean
}) {
  if (args.amountIn <= 0n) throw new Error('Enter an amount greater than zero.')
  if (args.amountIn > (1n << 128n) - 1n) throw new Error('Amount is too large for the v4 quoter.')
  const [currency0, currency1] = args.pairToken.toLowerCase() < args.token.toLowerCase()
    ? [args.pairToken, args.token]
    : [args.token, args.pairToken]
  const poolKey = {
    currency0, currency1, fee: args.poolFee, tickSpacing: args.tickSpacing, hooks: PONS_V2_HOOK,
  }
  // Buy: quote asset -> token. Sell: token -> quote asset.
  const inputCurrency = args.selling ? args.token : args.pairToken
  const zeroForOne = inputCurrency.toLowerCase() === currency0.toLowerCase()
  const result = await publicClient.readContract({
    address: V4_QUOTER, abi: v4QuoterAbi, functionName: 'quoteExactInputSingle',
    args: [{ poolKey, zeroForOne, exactAmount: args.amountIn, hookData: '0x' }],
  })
  return { amountOut: result[0], gasEstimate: result[1], poolKey, zeroForOne }
}


export const factoryAbi = parseAbi([
  'struct LaunchedToken { address token; address curve; address deployer; address creatorFeeRecipient; address pairToken; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; uint16 creatorTaxBps; bool buybackEnabled; uint8 phase; uint256 sweptQuote; uint256 sweptTokens; uint256 sweptAt; bool exists; }',
  'function getLaunchedToken(address token) view returns (LaunchedToken)',
])

export const curveAbi = parseAbi([
  'function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) payable returns (uint256 tokensOut)',
  'function sell(uint256 tokensIn, uint256 minQuoteOut, address recipient) returns (uint256 quoteOut)',
  'function getReserves() view returns (uint256 quoteReserve, uint256 tokenReserve)',
  'function sellableTokens() view returns (uint256)',
  'function feeBps() view returns (uint256)',
  'function creatorTaxBps() view returns (uint256)',
  'function currentSnipeTaxBps(address recipient) view returns (uint256)',
  'function readyToGraduate() view returns (bool)',
  'function isNativeQuote() view returns (bool)',
  'function pairToken() view returns (address)',
])

export const erc20Abi = parseAbi([
  'function decimals() view returns (uint8)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
])

const BPS = 10_000n
const amountOut = (input: bigint, reserveIn: bigint, reserveOut: bigint) => (input * reserveOut) / (reserveIn + input)
const amountIn = (output: bigint, reserveIn: bigint, reserveOut: bigint) => {
  if (output >= reserveOut) throw new Error('Requested output exceeds available curve reserves')
  return (output * reserveIn) / (reserveOut - output) + 1n
}
const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b

export async function quoteCurveBuy(curve: Address, quoteIn: bigint, recipient: Address) {
  const [reserves, sellable, feeBps, creatorTaxBps, rawSnipeBps, nativeQuote] = await Promise.all([
    publicClient.readContract({ address: curve, abi: curveAbi, functionName: 'getReserves' }),
    publicClient.readContract({ address: curve, abi: curveAbi, functionName: 'sellableTokens' }),
    publicClient.readContract({ address: curve, abi: curveAbi, functionName: 'feeBps' }),
    publicClient.readContract({ address: curve, abi: curveAbi, functionName: 'creatorTaxBps' }),
    publicClient.readContract({ address: curve, abi: curveAbi, functionName: 'currentSnipeTaxBps', args: [recipient] }),
    publicClient.readContract({ address: curve, abi: curveAbi, functionName: 'isNativeQuote' }),
  ])
  const [quoteReserve, tokenReserve] = reserves
  let snipeBps = rawSnipeBps
  if (snipeBps > 0n) {
    const maxSnipeBps = BPS - feeBps - creatorTaxBps - 100n
    if (snipeBps > maxSnipeBps) snipeBps = maxSnipeBps
  }
  let spent = quoteIn
  const fee = (spent * feeBps) / BPS
  const tax = (spent * creatorTaxBps) / BPS
  const snipeTax = (spent * snipeBps) / BPS
  let tokensOut = amountOut(spent - fee - tax - snipeTax, quoteReserve, tokenReserve)
  if (tokensOut > sellable) {
    tokensOut = sellable
    const net = amountIn(sellable, quoteReserve, tokenReserve)
    const grossed = ceilDiv(net * BPS, BPS - feeBps - creatorTaxBps - snipeBps)
    spent = grossed < quoteIn ? grossed : quoteIn
  }
  return { tokensOut, spent, refund: quoteIn - spent, nativeQuote }
}

export async function quoteCurveSell(curve: Address, tokensIn: bigint) {
  const [reserves, feeBps, creatorTaxBps, ready] = await Promise.all([
    publicClient.readContract({ address: curve, abi: curveAbi, functionName: 'getReserves' }),
    publicClient.readContract({ address: curve, abi: curveAbi, functionName: 'feeBps' }),
    publicClient.readContract({ address: curve, abi: curveAbi, functionName: 'creatorTaxBps' }),
    publicClient.readContract({ address: curve, abi: curveAbi, functionName: 'readyToGraduate' }),
  ])
  if (ready) throw new Error('Curve is closing for graduation; sell through its Uniswap v4 pool after phase 2.')
  const [quoteReserve, tokenReserve] = reserves
  const gross = amountOut(tokensIn, tokenReserve, quoteReserve)
  return { quoteOut: gross - (gross * feeBps) / BPS - (gross * creatorTaxBps) / BPS }
}
