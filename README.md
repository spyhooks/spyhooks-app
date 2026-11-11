<div align="center">

# SPYHOOKS

### Discover the curve. Follow the liquidity.

**Token discovery, contract intelligence, and swap tools for Robinhood Chain.**

[**Launch App**](https://spyhooks.app) · [**SPY Scanner**](https://spyhooks.app/spy) · [**Swap**](https://spyhooks.app/swap) · [**Documentation**](https://spyhooks.app/docs) · [**Report an Issue**](https://github.com/spyhooks/spyhooks-app/issues)

</div>

---

## Overview

Spyhooks is a Web3 application focused on token discovery, bonding-curve activity, contract inspection, and token swaps on **Robinhood Chain**.

The platform brings launchpad token data, token lifecycle information, and market-oriented tools together in one responsive interface. Spyhooks is built to make emerging markets easier to explore while clearly distinguishing available on-chain evidence from estimates or unavailable data.

> **Project status:** The application is under active development. Some features require supported contracts, configured data providers, and a connected wallet. Displayed market data can be delayed or unavailable.

## Platform Features

| Feature | Description |
| --- | --- |
| **Live Token Discovery** | Browse emerging tokens with search, sorting, and lifecycle filters. |
| **Bonding-Curve Lifecycle** | Follow tokens through **On Curve**, **Graduating**, and **Surfaced** stages when supporting data is available. |
| **Trending Tokens** | Explore Pons tokens ranked using available 24-hour trading volume and market metrics, with token search and links to swap or view contracts. |
| **SPY Contract Scanner** | Inspect a Robinhood Chain token contract through a read-only scan, including contract metadata, Pons factory registration, launch stage, and available curve information. |
| **SPY Risk Score** | View preliminary, evidence-based risk indicators and scan coverage, with explicit limitations for checks that are not performed. **Not a security audit.** |
| **Token Workspace** | Switch between token discovery and additional market-oriented views from the homepage. |
| **Swap Interface** | Access token swap workflows for supported tokens and connect a compatible Web3 wallet. |
| **Token & Market Statistics** | View available token prices, market capitalization, volume, and launch statistics where data can be retrieved. |
| **$SPYHOOKS Information** | View project token information, when available, from the dedicated token page. |
| **Responsive UI** | Navigate a dark-themed interface with updated navigation and a collapsible homepage hero. |

Market metrics, contract checks, and displayed statuses depend on network conditions, provider availability, and the scope of the underlying checks.

## Explore the App

| Section | URL | Purpose |
| --- | --- | --- |
| Token Discovery | [spyhooks.app](https://spyhooks.app) | Live tokens, lifecycle filters, and the token workspace |
| Swap | [/swap](https://spyhooks.app/swap) | Token swap interface |
| Launchpads | [/launchpads](https://spyhooks.app/launchpads) | Supported launchpad information |
| SPY Scanner | [/spy](https://spyhooks.app/spy) | Read-only contract inspection and preliminary risk signals |
| $SPYHOOKS | [/token](https://spyhooks.app/token) | Project token overview |
| Documentation | [/docs](https://spyhooks.app/docs) | Project concepts, routing, swaps, and configuration |

## SPY Contract Scanner

The **SPY Scanner** provides a read-only overview for supported Robinhood Chain and Pons contracts. Depending on the contract and available data, results may include:

- Contract identification and basic token metadata.
- Pons factory registration and token lifecycle status.
- Curve and routing details, including available fee-related parameters.
- Indicative price, market-cap, and reserve information where applicable.
- Preliminary risk indicators with a visible **coverage** percentage.
- Warnings and links to relevant contract or swap views.

**Important limitations:** A scan does **not** establish that a token is safe. Honeypot simulation, comprehensive permission audits, and sellability testing are not included in the displayed preliminary checks. Missing evidence must not be interpreted as a passing result.

## Trending Tokens

Trending Tokens presents available Pons market data in a dedicated view, including metrics such as:

- 24-hour trading volume and price change.
- Market capitalization and trader count, where provided.
- Contract address search, explorer links, and swap entry points.
- Periodic refresh with a clear indication when cached or stale information is displayed.

Rankings and metrics depend on the configured data provider and can change rapidly. They are not investment recommendations.

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
       +--> Contract inspection (SPY Scanner)
       +--> Token discovery & market views
       +--> Supported swap / routing workflows
```

Lifecycle labels reflect available application data; they should not be treated as proof that any specific transaction route or contract is safe or available.

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
    eth-usd/             ETH/USD data
    launch-stats/        Launch statistics
    onchain-token-stats/ On-chain token statistics
    pons/                Token discovery and lifecycle data
    pons-trending/       Trending Pons market data
    spy/scan/            Read-only contract scanning and risk signals
    token-live-price/    Available token price data
  docs/                  Documentation
  launchpads/            Launchpad information
  spy/                   SPY Scanner page
  swap/                  Swap page
  token/                 $SPYHOOKS information
components/              UI, token workspace, scanner, wallet and swap components
lib/                     Shared application and blockchain utilities
public/                  Public assets
.github/workflows/       Automated checks
```

## Local Development

### Requirements

- Node.js version compatible with the project's Next.js release.
- pnpm.
- Git.
- Required application configuration and access to supported data providers.

### Installation

```bash
git clone https://github.com/spyhooks/spyhooks-app.git
cd spyhooks-app
pnpm install --frozen-lockfile
```

Provide the application configuration required for your local environment, then start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

> Some environment-specific configuration is maintained separately from the public repository. A fresh clone may require additional configuration before live data and wallet-dependent features operate.

### Validation

```bash
pnpm exec tsc --noEmit
pnpm run build
```

The production build uses the project's configured Next.js build command. Passing TypeScript and build checks does not verify provider uptime, on-chain correctness, contract security, or end-to-end wallet transactions.

## Server API Routes

| Route | Purpose |
| --- | --- |
| `GET /api/pons` | Token discovery and lifecycle data |
| `GET /api/pons-trending` | Trending token market data |
| `GET /api/spy/scan` | Contract scan results for a supplied contract address |
| `GET /api/launch-stats` | Available launch statistics |
| `GET /api/onchain-token-stats` | On-chain token statistics |
| `GET /api/token-live-price` | Available token pricing information |
| `GET /api/eth-usd` | ETH/USD pricing data |

API behavior and response completeness depend on configuration and external services. Endpoints are not a guarantee of data availability or a public service-level commitment.

## Development Roadmap

### Implemented in the application

- [x] Token discovery and lifecycle views.
- [x] Homepage Token Workspace and refreshed Hexa Tech token visuals.
- [x] Pons Trending Tokens component and server route.
- [x] SPY Contract Scanner page, API, and preliminary risk scoring.
- [x] Swap interface and wallet integration UI.
- [x] Updated header, navigation, and collapsible hero.
- [x] TypeScript and production build checks in the development workflow.

### Ongoing priorities

- [ ] Validate live scanner results and risk indicators against additional contract scenarios.
- [ ] Improve RPC resilience, provider monitoring, and stale-data handling.
- [ ] Expand token search, filtering, and market-data accuracy.
- [ ] Strengthen swap testing, transaction safety, and network compatibility.
- [ ] Review contract-scanning coverage and Uniswap v4 hook-specific analysis.
- [ ] Expand automated tests and production observability.

See [GitHub Issues](https://github.com/spyhooks/spyhooks-app/issues) for tracked work and proposals. Implemented UI or API routes should not be taken as evidence that every live integration has been fully verified.

## Development Workflow

| Branch | Purpose |
| --- | --- |
| `main` | Release-oriented source |
| `develop` | Development and integration |
| `feature/*` | Isolated feature changes |

Features are developed in focused commits, reviewed through pull requests, and validated with GitHub Actions before merging.

## Security & Disclaimer

- Never commit private keys, seed phrases, passwords, or provider secrets.
- Treat any assets under `public/` as publicly accessible after deployment.
- Independently verify token contract addresses and transaction parameters.
- Review wallet prompts before confirming a transaction.
- Treat market estimates and risk scores as informational, not as a guarantee of safety.

**Spyhooks has not been represented here as independently audited.** Interacting with digital assets involves financial, smart-contract, and network risks. Nothing in this repository or application constitutes investment advice.

## Contributing

Bug reports, documentation corrections, and feature proposals are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and use [GitHub Issues](https://github.com/spyhooks/spyhooks-app/issues) to discuss changes.

## Links

- **Website:** https://spyhooks.app
- **SPY Scanner:** https://spyhooks.app/spy
- **Swap:** https://spyhooks.app/swap
- **Documentation:** https://spyhooks.app/docs
- **Repository:** https://github.com/spyhooks/spyhooks-app

---

<div align="center">

**SPYHOOKS**  
*Built for discovery. Designed for the curve.*  
Robinhood Chain Ecosystem

</div>
