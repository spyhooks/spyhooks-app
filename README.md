<div align="center">

# SPYHOOKS

### Discover the curve. Follow the liquidity.

**Token discovery, contract intelligence, and swap tools for Robinhood Chain.**

[**Launch App**](https://spyhooks.app) · [**SPY Scanner**](https://spyhooks.app/spy) · [**SPY Intelligence**](https://spyhooks.app/intelligence) · [**Compare Tokens**](https://spyhooks.app/compare) · [**Swap**](https://spyhooks.app/swap) · [**Documentation**](https://spyhooks.app/docs) · [**Report an Issue**](https://github.com/spyhooks/spyhooks-app/issues)

</div>

---

## Overview

Spyhooks is a Web3 application focused on token discovery, bonding-curve activity, contract inspection, and token swaps on **Robinhood Chain**.

The platform brings launchpad token data, token lifecycle information, market comparison, transaction activity, and trading utilities together in one responsive workspace. Spyhooks aims to make emerging markets easier to explore while distinguishing verifiable on-chain information from estimates or unavailable data.

> **Project status:** The application is under active development. New interface and API features are available in the source repository; this does not guarantee that every feature is deployed to the production website or that external market-data services are always available. Some functions require supported contracts, configured providers, and a compatible wallet.

## Platform Features

| Feature | Description |
| --- | --- |
| **Live Token Discovery** | Browse emerging tokens with search, sorting, and lifecycle filters. |
| **Bonding-Curve Lifecycle** | Follow **On Curve**, **Graduating**, and **Surfaced** stages when supported by available data. |
| **Pons Trending Tokens** | Explore token activity and available market metrics with refreshed cards, search, and handling for cached or unavailable provider data. |
| **SPY Intelligence** | Dedicated dashboard and read-only trade activity feed with token-address filtering, subject to provider coverage and rate limits. |
| **Token Comparison** | Compare two tokens side by side, including available metadata, price, market cap, volume, liquidity, and lifecycle information. |
| **Trade Calculator** | Workspace utility for indicative trading calculations; results are not executable quotes. |
| **Workspace Sidebar** | Persistent navigation between token discovery, intelligence, comparison, and calculator views. |
| **SPY Contract Scanner** | Read-only contract inspection with token details, Pons provenance, available curve data, and preliminary risk indicators. |
| **SPY Risk Score** | Coverage-aware heuristics using available holder concentration, upgradeability signals, and applicable creator-tax data. **Not an audit or safety certification.** |
| **Swap Interface** | Supported token swap workflows and compatible Web3 wallet connection. |
| **Token & Market Statistics** | Show available prices, market capitalization, activity, and launch statistics with source-dependent limitations. |
| **$SPYHOOKS Information** | Project token overview, published contract address, supply, and fee details. |
| **Responsive UI** | Token Board and workspace improvements, updated navigation, and a collapsible homepage hero. |

Displayed market values, contract checks, and token status depend on chain conditions and the coverage of underlying data sources.

## Explore the App

| Section | Route | Purpose |
| --- | --- | --- |
| Token Discovery | `/` | Live tokens, lifecycle filters, and workspace |
| SPY Intelligence | `/intelligence` | Trade activity dashboard and token filtering |
| Token Comparison | `/compare` | Side-by-side comparison of token and market information |
| Trade Calculator | `/calculator` | Indicative trading calculations |
| SPY Scanner | `/spy` | Read-only contract inspection and preliminary risk signals |
| Swap | `/swap` | Supported token swap interface |
| Launchpads | `/launchpads` | Launchpad information |
| $SPYHOOKS Token | `/token` | Official token overview |
| Documentation | `/docs` | Project concepts and application documentation |

Routes shown here are implemented in the repository. Production availability depends on deployment and configuration.

## $SPYHOOKS Token

The official Spyhooks token page publishes the following $SPYHOOKS contract address on Robinhood Chain:

```text
0xf3055c8ded42f94807f8d749339c2d0666d94601
```

- **Network:** Robinhood Chain
- **Fee wallet:** `0xc0acb9cb2cf00d6760faa4cd189a39845be5f4d8`
- **Token page:** [spyhooks.app/token](https://spyhooks.app/token)
- **Explorer:** [View contract on Blockscout](https://robinhoodchain.blockscout.com/token/0xf3055c8ded42f94807f8d749339c2d0666d94601)
- **Supply displayed on the token page:** 1,000,000,000
- **Router fee displayed on the token page:** 0.50%

> **Source and verification:** The contract address and figures above reflect project-published information, not an independent audit or verification of token ownership, contract safety, or trading conditions. Always confirm details against the official token page and block explorer before transacting.

## SPY Contract Scanner & Risk Score

The **SPY Scanner** provides read-only inspection of supported Robinhood Chain contracts. Depending on data coverage, results may include:

- Contract address, token name, symbol, and other metadata.
- Pons factory registration, launch stage, and relevant curve data.
- Available pricing, reserves, fee information, and explorer links.
- Holder-concentration indicators and applicable creator-tax parameters.
- Upgradeability signals based on available explorer information and EIP-1967 storage checks.
- A preliminary Risk Score with a visible **coverage** percentage and warnings when evidence is missing.

**Important limitations:** The score does not prove a token is safe, liquid, sellable, or free of harmful contract behavior. It is not a full contract audit, honeypot simulation, or transaction-safety guarantee. Unavailable checks are not treated as passing.

## Trending Tokens

The Trending Tokens workspace provides available Pons market information, including 24-hour trading volume, price change, capitalization, and trading activity where supplied by the provider.

The latest source changes refine token-card presentation and add rate-limit handling, cached snapshots, and unavailable-data states. Ranking and refresh behavior remain provider-dependent; trending is not an investment recommendation.

## SPY Intelligence

The application now includes a dedicated **SPY Intelligence** page and a server-side **Live Trade Feed** integration. The read-only feed is designed to show available BUY/SELL activity, transaction references, trader addresses, and selected-token activity.

- Token contract-address filtering where supported.
- Trade activity snapshots with provider attribution and update status.
- Cached or stale responses when the upstream source is temporarily unavailable.
- Rate-limit-aware requests and reduced sampling when operating without a configured provider key.

**Current scope:** The dashboard and trade-feed route have been implemented and passed repository TypeScript and production-build checks. Data coverage is limited by the configured upstream provider; this is **not** a claim that a network-wide feed, accurate wallet profitability, or full smart-money tracking has been validated. Expanded wallet intelligence, watch functionality, and advanced analytics remain areas for further development.

## Token Comparison

The **Token Comparison** page provides a side-by-side view of two token addresses. Depending on available information, it can display token metadata, Pons lifecycle status, price, 24-hour volume and change, market capitalization, and liquidity.

The comparison APIs use Robinhood Chain RPC and available external market data. Market metrics may describe a token's **most liquid indexed pool** rather than all of its markets; missing values are left unavailable instead of estimated as facts. Comparison data is informational and should not be interpreted as an execution quote.

## Trade Calculator & Workspace Navigation

The Trade Calculator is accessible from its own route in the shared workspace. It provides indicative calculations and does not execute transactions or replace actual swap quotes, which can vary due to fees, liquidity, slippage, and price impact.

A persistent Workspace Sidebar allows users to move between supported platform tools without losing access to workspace navigation.

## How Spyhooks Fits the Token Lifecycle

```text
Supported Launchpad
       |
       v
    On Curve
       |
       v
   Graduating
       |
       v
    Surfaced
       |
       +--> SPY Scanner and risk indicators
       +--> Token discovery, trending, and comparison
       +--> SPY Intelligence trade activity
       +--> Workspace calculator and supported swap workflows
```

Lifecycle labels reflect available application data, not guarantees of transaction-route availability or contract safety.

## Technology Stack

| Layer | Technology |
| --- | --- |
| Application framework | Next.js 16 |
| UI | React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Blockchain interaction | viem |
| Package manager | pnpm |
| CI | GitHub Actions |
| Target network | Robinhood Chain |

## Project Structure

```text
app/
  api/
    compare/market/        Indexed pool market information
    compare/token/         Token identification via RPC
    intelligence/trades/   Read-only trade feed
    eth-usd/               ETH/USD data
    launch-stats/          Launch statistics
    onchain-token-stats/   On-chain token statistics
    pons/                  Token discovery and lifecycle data
    pons-trending/         Trending Pons market data
    spy/scan/              Contract inspection and risk signals
    token-live-price/      Available token price data
  calculator/              Trade Calculator page
  compare/                 Token Comparison page
  intelligence/            SPY Intelligence page
  docs/                    Documentation
  launchpads/              Launchpad information
  spy/                     SPY Scanner page
  swap/                    Swap page
  token/                   $SPYHOOKS information
components/                 UI, workspace, token, scanner and swap components
lib/                        Shared application and blockchain utilities
public/                     Public assets
.github/workflows/          Automated checks
```

## Local Development

### Requirements

- Node.js version compatible with the current Next.js release.
- pnpm and Git.
- Required local configuration and access to supported data providers.

### Installation

```bash
git clone https://github.com/spyhooks/spyhooks-app.git
cd spyhooks-app
pnpm install --frozen-lockfile
```

Provide the local application configuration, then run:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

> Some environment-specific configuration is maintained separately from this public repository. A fresh clone may require additional configuration before wallet-dependent features or live external data operate. Never place provider secrets in `public/`.

### Validation

```bash
pnpm exec tsc --noEmit
pnpm run build
```

These checks validate types and build output; they do not test provider uptime, live blockchain responses, contract safety, or end-to-end swaps.

## Server API Routes

| Route | Purpose |
| --- | --- |
| `GET /api/pons` | Token discovery and lifecycle data |
| `GET /api/pons-trending` | Trending market data and provider fallback behavior |
| `GET /api/intelligence/trades` | Read-only trade activity feed; optional token filtering |
| `GET /api/compare/token` | Token metadata and Pons recognition |
| `GET /api/compare/market` | Indexed market and top-pool metrics |
| `GET /api/spy/scan` | Contract inspection and preliminary risk signals |
| `GET /api/launch-stats` | Available launch statistics |
| `GET /api/onchain-token-stats` | On-chain token statistics |
| `GET /api/token-live-price` | Available token pricing information |
| `GET /api/eth-usd` | ETH/USD pricing data |

Endpoint availability and completeness depend on configuration, network connectivity, and external data services.

## Development Roadmap

### Implemented in the repository

- [x] Token discovery and lifecycle views.
- [x] Token Board and persistent Workspace Sidebar.
- [x] Pons Trending Tokens component and API rate-limit handling.
- [x] SPY Contract Scanner and coverage-aware preliminary risk scoring.
- [x] SPY Intelligence dashboard and read-only trade-feed API.
- [x] Token Comparison page and supporting token/market APIs.
- [x] Trade Calculator page.
- [x] Swap and wallet connection interface.
- [x] TypeScript and Next.js build validation in the development workflow.

### Ongoing priorities

- [ ] Verify trade-feed coverage, provider rate limits, and live runtime behavior in the target deployment.
- [ ] Expand wallet intelligence, address watch features, and market analytics.
- [ ] Validate scanner results against additional contracts and improve coverage.
- [ ] Improve RPC resilience, monitoring, and stale-data handling.
- [ ] Expand swap testing and network compatibility.
- [ ] Add automated runtime and integration tests.
- [ ] Keep token information consistent across the website and announcements.

See [GitHub Issues](https://github.com/spyhooks/spyhooks-app/issues) for issues and proposals. A successful build does not prove that every live data integration is currently functioning.

## Development Workflow

| Branch | Purpose |
| --- | --- |
| `main` | Release-oriented source |
| `develop` | Development and integration |
| `feature/*` | Isolated feature changes |

Features are developed in focused commits, reviewed through pull requests, and checked with GitHub Actions before merging.

## Security & Disclaimer

- Never commit private keys, seed phrases, passwords, or provider credentials.
- Treat everything under `public/` as accessible after deployment.
- Independently verify contract addresses, token metadata, and transaction parameters.
- Review wallet prompts before signing or submitting any transaction.
- Treat market estimates, comparisons, and risk indicators as informational.

**Spyhooks is not represented as independently audited.** Digital asset activity involves financial, smart-contract, liquidity, and network risks. Nothing in this repository or application is investment advice.

## Contributing

Bug reports, documentation corrections, and feature proposals are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and use [GitHub Issues](https://github.com/spyhooks/spyhooks-app/issues).

## Links

- **Website:** https://spyhooks.app
- **SPY Scanner:** https://spyhooks.app/spy
- **SPY Intelligence:** https://spyhooks.app/intelligence
- **Token Comparison:** https://spyhooks.app/compare
- **Trade Calculator:** https://spyhooks.app/calculator
- **Swap:** https://spyhooks.app/swap
- **$SPYHOOKS Token:** https://spyhooks.app/token
- **Documentation:** https://spyhooks.app/docs
- **Repository:** https://github.com/spyhooks/spyhooks-app

---

<div align="center">

**SPYHOOKS**

*Built for discovery. Designed for the curve.*

Robinhood Chain Ecosystem

</div>
