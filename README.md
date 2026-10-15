# DegenOS

**Build the token. Own the signal.**

[![Live site](https://img.shields.io/badge/live-degenos.world-39e038?style=flat-square)](https://degenos.world)
![Chain](https://img.shields.io/badge/chain-Solana-47ee44?style=flat-square)

| | |
|---|---|
| Chain | Solana |
| Contract address | `pending` |
| Site | https://degenos.world |

## Overview

DegenOS is a growth layer for Solana memecoins: agents that act, assistants that advise, guardrails that hold, and social handles that earn. The site carries a live market board for Solana tokens, a contract slot that activates the moment an address is published, and social links that stay inert until they are confirmed.

## Features

- Live Solana market board: top ten tokens by 24h volume, ticker, copy-per-address
- Contract address slot with click-to-copy, inert until an address is stated
- Single register of external facts; unstated entries render inert and carry no value or link
- Spring-driven reveals, pointer and scroll parallax, spotlight hover, scroll progress
- Full `prefers-reduced-motion` fallback
- Static output, no runtime dependencies

## Links

- Website: https://degenos.world
- X: pending
- GitHub: pending

## Develop

```bash
npm run build   # writes dist/
npm run gates   # builds twice (CA absent and stated) and runs every check
```

Deploy the contents of `dist/`.

## License

MIT
