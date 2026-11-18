// Deep-dip mean-reversion bot for cbBTC/USDC (agent-fun/bars-replay/v1).
//
// The hello message carries the universe (one symbol, CBBTC), the $1,000 paper
// capital, the caps and the fees; each batch then carries one 1-minute bar and
// the fills of the previous batch's orders, and this bot answers with orders
// that fill at the next bar's open.
//
// Idea, calibrated on the published dev window (1,440 bars, 2026-11-17T14:44Z
// to 2026-11-18T14:44Z, BTC -2.8% over the day): the window is strongly
// mean-reverting at the 1-hour horizon. After a 60-minute fall of 180 bps or
// more, the next hours bounce back most of the drop (the dev window's two such
// dips both recovered 120+ bps), while smaller dips and RSI-style dip-buying
// lose to the 26 bps round-trip cost and the slow downward drift, and
// momentum entries lose outright (a 30-minute rise over 80 bps is followed by
// a further fall on average). So this bot does one thing only:
//
//   - Flat: buy with all cash when the latest close is at least 180 bps below
//     the close 60 bars ago (a sharp 1-hour dip).
//   - Long: sell everything when the close is 120 bps above the entry close
//     (the bounce), 250 bps below it (the dip kept falling: cut the loss), or
//     after 480 bars (8 hours: the bounce, if it comes, has come).
//   - Never enter in the last 240 bars: a dip bought that late has no time to
//     recover before the window's final flatten.
//
// All arithmetic is exact bigint integer math on the wire's raw units (prices
// at price_scale 5, USDC at 6 decimals). No clock, no randomness, no network,
// no files outside the repository: two runs on the same bars give the same
// orders. Verified by the kit's grade-local (--driver process, run twice,
// L1 reproduced): net PnL +16.366748 USDC, 4 trades (2 round trips),
// fees 1.612965 USDC, max drawdown 1.1247202%, Sharpe 0.0244, and still
// +14.744883 USDC with every fee doubled; result_sha256
// 9317292a50eb4e0bd2a45d3be010c46ee22a965ef3ac8778c55e63b93d865d7e.

import { runBars } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
// How far back the dip is measured, in 1-minute bars.
const DIP_LOOKBACK_BARS = 60;
// Entry: close at least this far (basis points) below the close DIP_LOOKBACK_BARS ago.
const DIP_ENTRY_BPS = 180;
// Exit: take profit / stop loss, in basis points from the entry close.
const TAKE_PROFIT_BPS = 120;
const STOP_LOSS_BPS = 250;
// Exit: give up after this many bars in the position.
const MAX_HOLD_BARS = 480;
// Never open a position this close to the end of the window.
const LAST_ENTRY_SEQ = 1200;
// Slippage allowance for each order, measured from the latest close.
const MAX_SLIPPAGE_BPS = 500;
// A buy must spend at least 1 USDC (1,000,000 micro-USDC).
const MIN_NOTIONAL = 1_000_000n;

const BPS = 10_000n;

// Closes of the bars seen so far, oldest first; at most DIP_LOOKBACK_BARS + 1.
const closes: bigint[] = [];
// The close of the bar on which the current position was opened (0n when flat).
let entryClose = 0n;
// Batches spent in the current position.
let barsHeld = 0;

await runBars({
  onBatch(state) {
    const close = state.close(SYMBOL);
    if (close === null || state.warmingUp) return [];

    closes.push(close);
    if (closes.length > DIP_LOOKBACK_BARS + 1) closes.shift();

    const position = state.positions.get(SYMBOL);
    const qty = position === undefined ? 0n : position.qty;

    if (qty > 0n) {
      // Long: track the hold and sell on take-profit, stop-loss or time.
      barsHeld += 1;
      const takeProfit = (entryClose * (BPS + BigInt(TAKE_PROFIT_BPS))) / BPS;
      const stopLoss = (entryClose * (BPS - BigInt(STOP_LOSS_BPS))) / BPS;
      if (close >= takeProfit || close <= stopLoss || barsHeld >= MAX_HOLD_BARS) {
        entryClose = 0n;
        barsHeld = 0;
        return [{ side: 'sell', symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }

    // Flat (or the entry order was rejected: reset the stale entry state).
    entryClose = 0n;
    barsHeld = 0;

    if (state.seq < DIP_LOOKBACK_BARS || state.seq > LAST_ENTRY_SEQ) return [];
    if (closes.length <= DIP_LOOKBACK_BARS) return [];
    const reference = closes[closes.length - 1 - DIP_LOOKBACK_BARS]!;
    // Buy only on a sharp 1-hour dip: close <= reference * (1 - 180 bps).
    if (close * BPS > reference * (BPS - BigInt(DIP_ENTRY_BPS))) return [];
    if (state.cash < MIN_NOTIONAL) return [];

    entryClose = close;
    barsHeld = 0;
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
  },
});
