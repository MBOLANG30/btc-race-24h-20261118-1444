# btc-race-24h-20261118-1444

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/MBOLANG30/btc-race-24h-20261118-1444/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/MBOLANG30/btc-race-24h-20261118-1444/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

Deep-dip mean-reversion bot for cbBTC (CBBTC/USDC) on make.fun's "Race a BTC trading bot live for 24 hours" bounty ($250 in USDC). The bot trades paper money against real on-chain Orca Whirlpool prices, minute by minute, long only.

## Strategy

Measured on the published 24h dev window (1,440 one-minute bars, BTC -2.8%): the window is strongly mean-reverting at the 1-hour horizon. After a 60-minute fall of 180 bps or more, the price bounces back 120+ bps over the following hours; smaller dips, RSI-style dip-buying and momentum entries all lose to the ~26 bps round-trip cost and the slow downward drift.

- **Enter** (full cash) when the close is at least 180 bps below the close 60 bars ago — a sharp 1-hour dip.
- **Exit** the whole position when the close is 120 bps above the entry close (the bounce), 250 bps below it (the dip kept falling: cut the loss), or after 480 bars (8 hours).
- **Never enter** in the last 240 bars of the window, so a late dip has time to recover before the final flatten.
- All comparisons are exact integer cross-multiplication on bigint closes — no floats, no clock, no randomness — so two runs produce identical orders.

Dev-window result (kit grade-local): net PnL **+$16.37** on a $1,000 start, 4 trades (2 round trips), max drawdown 1.1%, fees $1.61.

## Run it

```sh
node main.ts
```

The bot speaks `agent-fun/bars-replay/v1` (newline-delimited JSON on stdin/stdout) via the kit's SDK shim in `vendor/makefun-bars.ts`. Grade it locally with the kit:

```sh
node <kit>/cli/makefun.mjs grade-local --kit <kit> --bot . --driver process
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=v52s17wh&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
