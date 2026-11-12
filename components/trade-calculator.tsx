'use client'

import { useMemo, useState } from 'react'
import { Calculator, ChevronDown } from 'lucide-react'

function usd(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
}
function signed(n: number) { return `${n > 0 ? '+' : n < 0 ? '-' : ''}${usd(Math.abs(n))}` }

export function TradeCalculator() {
  const [investment, setInvestment] = useState('100')
  const [entry, setEntry] = useState('0.001')
  const [target, setTarget] = useState('0.002')
  const [buyFee, setBuyFee] = useState('1')
  const [sellFee, setSellFee] = useState('1')
  const [gasUsd, setGasUsd] = useState('0')
  const [feesOpen, setFeesOpen] = useState(false)
  const calculated = useMemo(() => {
    if ([investment, entry, target, buyFee, sellFee, gasUsd].some(v => !v.trim())) return null
    const amount = Number(investment), buyPrice = Number(entry), sellPrice = Number(target)
    const b = Number(buyFee), s = Number(sellFee), gas = Number(gasUsd)
    if (![amount, buyPrice, sellPrice, b, s, gas].every(Number.isFinite) || amount <= 0 || buyPrice <= 0 || sellPrice < 0 || b < 0 || b >= 100 || s < 0 || s >= 100 || gas < 0) return null
    const tokens = amount * (1 - b / 100) / buyPrice
    const proceeds = tokens * sellPrice * (1 - s / 100) - gas
    const pnl = proceeds - amount
    return { tokens, proceeds, pnl, roi: pnl / amount * 100, breakEven: (amount + gas) / (tokens * (1 - s / 100)) }
  }, [investment, entry, target, buyFee, sellFee, gasUsd])
  const fields = [
    {label:'Investment (USD)',value:investment,set:setInvestment},
    {label:'Entry price (USD)',value:entry,set:setEntry},
    {label:'Target price (USD)',value:target,set:setTarget},
  ]
  const feeFields = [
    {label:'Buy fee (%)',value:buyFee,set:setBuyFee},
    {label:'Sell fee (%)',value:sellFee,set:setSellFee},
    {label:'Total gas (USD)',value:gasUsd,set:setGasUsd},
  ]
  return <section className="min-w-0 space-y-5 pb-16 text-white">
    <header className="rounded-[24px] border border-white/15 bg-[#121214] px-5 py-6 sm:px-8">
      <div className="flex items-center gap-3"><div className="rounded-xl border border-white/15 bg-[#1b1b1d] p-2.5"><Calculator className="size-5 text-[#ff8b36]"/></div><div><h1 className="text-2xl font-bold sm:text-3xl">Trade Calculator</h1><p className="mt-1 text-sm text-zinc-400">Estimate your trading outcome with your own assumptions.</p></div></div>
    </header>
    <div className="rounded-[22px] border border-white/15 bg-[#141416] p-5 sm:p-7">
      <h2 className="text-sm font-semibold">Trade details</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">{fields.map(f=><label key={f.label} className="rounded-xl border border-white/15 bg-[#0b0b0d] p-4"><span className="block text-xs text-zinc-400">{f.label}</span><input type="number" min="0" step="any" inputMode="decimal" value={f.value} onChange={e=>f.set(e.target.value)} className="mt-2 w-full bg-transparent font-mono text-base text-white outline-none focus-visible:ring-1 focus-visible:ring-white/50"/></label>)}</div>
      <button type="button" onClick={()=>setFeesOpen(v=>!v)} aria-expanded={feesOpen} className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs text-zinc-300 hover:border-white/40">{feesOpen?'Hide':'Adjust'} fees and gas <ChevronDown className={`size-4 transition-transform ${feesOpen?'rotate-180':''}`}/></button>
      {feesOpen&&<div className="mt-3 grid gap-3 sm:grid-cols-3">{feeFields.map(f=><label key={f.label} className="rounded-xl border border-white/15 bg-[#0b0b0d] p-4"><span className="block text-xs text-zinc-400">{f.label}</span><input type="number" min="0" step="any" inputMode="decimal" value={f.value} onChange={e=>f.set(e.target.value)} className="mt-2 w-full bg-transparent font-mono text-base text-white outline-none"/></label>)}</div>}
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-[20px] border border-white/15 bg-[#141416] p-5"><p className="text-xs text-zinc-400">Net exit value</p><p className="mt-2 text-2xl font-bold tabular-nums">{calculated?usd(calculated.proceeds):'—'}</p></div>
      <div className="rounded-[20px] border border-white/15 bg-[#141416] p-5"><p className="text-xs text-zinc-400">Estimated profit / loss</p><p className={`mt-2 text-2xl font-bold tabular-nums ${calculated ? calculated.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400' : ''}`}>{calculated?signed(calculated.pnl):'—'}</p></div>
      <div className="rounded-[20px] border border-white/15 bg-[#141416] p-5"><p className="text-xs text-zinc-400">Estimated ROI</p><p className={`mt-2 text-2xl font-bold tabular-nums ${calculated ? calculated.roi >= 0 ? 'text-emerald-400' : 'text-rose-400' : ''}`}>{calculated?`${calculated.roi > 0?'+':''}${calculated.roi.toFixed(2)}%`:'—'}</p></div>
    </div>
    <div className="rounded-[20px] border border-white/15 bg-[#121214] p-5 text-sm text-zinc-400">{calculated?<p>Estimated quantity: <span className="text-white">{calculated.tokens.toLocaleString('en-US',{maximumFractionDigits:6})}</span> · Break-even: <span className="text-white">${calculated.breakEven.toPrecision(6)}</span> per token.</p>:<p>Enter valid amounts, prices and fee estimates to calculate.</p>}<p className="mt-3 text-xs leading-6 text-zinc-500">Illustrative calculator only. No live price quotes. Slippage, liquidity limits, price impact and variable taxes are excluded. This is not financial advice.</p></div>
  </section>
}
