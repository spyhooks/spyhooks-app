# SPYHOOKS

<div align="center">

### Discover the curve. Follow the liquidity.

**Token Discovery & Swap Infrastructure for Robinhood Chain**

[![CI](https://github.com/spyhooks/spyhooks-app/actions/workflows/ci.yml/badge.svg)](https://github.com/spyhooks/spyhooks-app/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![Robinhood Chain](https://img.shields.io/badge/Network-Robinhood%20Chain-89B85B)
![Status](https://img.shields.io/badge/Status-Active%20Development-8ABF60)

**[Website](https://spyhooks.app)** · **[Documentation](https://spyhooks.app/docs)** · **[Issues](https://github.com/spyhooks/spyhooks-app/issues)** · **[Development Activity](https://github.com/spyhooks/spyhooks-app/pulls)**

---

*Explore token launches, track bonding-curve activity, and navigate on-chain markets through a unified Web3 interface.*

</div>

## Overview

**Spyhooks** is a Web3 application built for the Robinhood Chain ecosystem.

It brings together token discovery, bonding-curve tracking, on-chain market information, and swap functionality within a streamlined interface.

Spyhooks is designed around a simple objective: make emerging token markets easier to discover, understand, and navigate.

## Platform Features

| Feature | Description |
|---|---|
| Token Discovery | Explore token launches and discover emerging assets |
| Bonding Curve Tracking | Monitor token progress during the launch lifecycle |
| Token Lifecycle | Distinguish on-curve, graduating, and graduated tokens |
| Market Intelligence | Display available token prices, market capitalization, and trading volume |
| Token Search | Discover assets through supported search functionality |
| Swap Interface | Access token swapping workflows through a unified interface |
| Wallet Connectivity | Connect compatible Web3 wallets |
| On-Chain Data | Retrieve token activity through blockchain RPC and API integrations |
| Responsive Interface | Navigate the platform on desktop and mobile devices |

Some capabilities depend on available RPC data, compatible contracts, and external services.

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 |
| UI | React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Blockchain Interaction | viem |
| Package Manager | pnpm |
| Version Control | Git & GitHub |
| Continuous Integration | GitHub Actions |
| Target Network | Robinhood Chain |

## Architecture

```text
Spyhooks Application
│
├── Web Interface
│   ├── Token Discovery
│   ├── Token Details
│   ├── Swap
│   └── Documentation
│
├── API Layer
│   ├── Pons Token Data
│   ├── ETH/USD Data
│   └── On-Chain Token Statistics
│
├── Blockchain Integration
│   ├── Robinhood Chain RPC
│   ├── Event Processing
│   └── Token Lifecycle Tracking
│
└── Application Services
    ├── Configuration
    ├── Caching
    └── External Data Providers
```

## Getting Started

### Prerequisites

You will need a compatible Node.js installation, pnpm, and Git.

### Installation

Clone the repository:

```bash
git clone https://github.com/spyhooks/spyhooks-app.git
cd spyhooks-app
```

Install dependencies:

```bash
pnpm install --frozen-lockfile
```

Configure the required local application settings before starting. Some runtime configuration is intentionally excluded from the public repository.

Start the development server:

```bash
pnpm dev
```

Open `http://localhost:3000` in your browser.

### Production Build

Validate TypeScript:

```bash
pnpm exec tsc --noEmit
```

Create an optimized production build:

```bash
pnpm build
```

Start the production server:

```bash
pnpm start
```

A successful build does not, by itself, verify all live blockchain integrations.

## API Endpoints

The application includes the following server-side API routes:

| Endpoint | Purpose |
|---|---|
| `GET /api/pons` | Pons token discovery and lifecycle data |
| `GET /api/eth-usd` | ETH/USD market data |
| `GET /api/onchain-token-stats` | On-chain token statistics |

API responses depend on provider availability, network conditions, and configuration.

## Development Roadmap

Spyhooks follows an incremental development approach focused on reliability, usability, and Web3 integration.

### Completed

- [x] Initialize the Next.js application
- [x] Establish GitHub development workflow
- [x] Configure automated CI checks
- [x] Resolve Pons API TypeScript cache error
- [x] Validate local TypeScript compilation
- [x] Validate the Next.js production build
- [x] Improve Git repository hygiene

### Planned / Under Review

- [ ] Strengthen repository branch protection
- [ ] Implement API health monitoring
- [ ] Improve RPC reliability checks
- [ ] Validate official contract configuration integrity
- [ ] Complete production deployment verification
- [ ] Expand wallet and swap security testing
- [ ] Improve token data accuracy and lifecycle validation
- [ ] Enhance token search and filtering
- [ ] Develop Contract Scanner for Robinhood Chain tokens and Uniswap v4 hooks
      
Progress and priorities are tracked through GitHub Issues and the Spyhooks Development Roadmap.

## Development Workflow

The repository uses a structured Git workflow:

| Branch | Purpose |
|---|---|
| `main` | Production-oriented source code |
| `develop` | Ongoing development and integration |
| `feature/*` | Isolated feature development |

GitHub Actions runs automated checks for TypeScript compilation and Next.js production builds.

## Security

Security and configuration integrity are important parts of Spyhooks development.

- Sensitive credentials must not be committed to the repository.
- Private keys and recovery phrases must never be requested or stored.
- Production configuration changes should be controlled.
- Contract addresses should be verified independently.
- Transaction details should be reviewed before wallet confirmation.

**Disclaimer:** Spyhooks is not presented as independently audited. Blockchain transactions involve financial and technical risks. Users should verify contract addresses and transaction details before interacting with tokens.

## Contributing

Contributions, bug reports, and improvement suggestions are welcome.

Before contributing, please review [CONTRIBUTING.md](CONTRIBUTING.md).

You can also submit feedback through [GitHub Issues](https://github.com/spyhooks/spyhooks-app/issues).

## Project Links

**Website:** https://spyhooks.app

**GitHub:** https://github.com/spyhooks/spyhooks-app

**Documentation:** https://spyhooks.app/docs

---

<div align="center">

**SPYHOOKS**

*Built for discovery. Designed for the curve.*

**Robinhood Chain Ecosystem**

</div>
