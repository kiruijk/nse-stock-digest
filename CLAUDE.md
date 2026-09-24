# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A zero-backend tracker for every stock on the Nairobi Securities Exchange. Static HTML/CSS/JS on GitHub Pages, kept fresh by `update-stocks.js` in a weekday GitHub Actions run. There's no build step, bundler, framework or npm dependency. It is a sibling of `biotech-stock-digest` and shares its architecture.

## Commands

`npm test` (Node's built-in runner, `tests/*.test.js`; fixtures in `tests/fixtures/` are saved AFX pages), `npm run update`, `npm run render` (rebuild from `data/` without fetching; use it when changing templates), `npm run backfill` (fetch details + history for tickers that have none; resumable). Preview by opening `index.html`.

## Data flow

1. **Listing** (`lib/afx.js` `parseListing`): one request to afx.kwayisi.org/nse/ gives every security's price, change, volume and suspended flag, plus the NASI summary. If it fails, every stock keeps its previous data, flagged `stale`.
2. **Details**: company page (`parseCompany`: description, EPS, DPS, shares, factsheet) and chart script (`parseChart`: ~10 years of daily closes) for the `DEFAULT_DETAILS_PER_RUN` (6) tickers with the oldest `data/details/<t>.json`. AFX's robots.txt asks for a **60s crawl delay**, so never parallelize these or shorten `CRAWL_DELAY_MS`.
3. **History**: the chart is merged into `data/history/<t>.json`. The listing's close is appended every run (dated in Africa/Nairobi time), matching the chart, which has a row for every session.
4. **Returns** (1D from the listing; 5D–10Y from history) and **valuation** (P/E = price/EPS, yield = DPS/price, market cap = shares × price, P/B = market cap / equity). Both are recomputed at render time from the latest price. AFX has no book value, so equity is hand-entered in `data/book-values.json` (`equity` in KES, `asOf`, `source`) from company results. Never estimate it; a stock without an entry shows P/B as —.
5. **Key ratios**: payout (DPS ÷ EPS), ROE (needs book value), distance from 52W high/low, 1Y volatility and 5Y max drawdown from history, and liquidity (average daily turnover and most-traded rank) parsed from the company page's 3-month trading summary. The chart history repeats the last price on days without trades, so it can't measure how often a stock trades. Cross-listed companies reporting in another currency (`reportingCurrency` in universe.json, e.g. BKG in RWF) get no P/E, P/B, yield or ROE.
6. **News**: Google News RSS, Kenya edition, searched for the quoted company name (or `news` in universe.json).
7. **Render**: `index.html` gets `demoData`, `SECTORS`, `SECTOR_INFO`, nav, footer, market strip, and static lists injected between markers. `stocks/<t>.html` and `sectors/<slug>.html` are fully regenerated from `templates/`. Also writes `sitemap.xml` and `robots.txt`.

When AFX changes its markup, the parser tests against fixtures still pass while live runs break. Symptoms are `check-freshness.js` failing (stale/missing prices or an old timestamp) or empty fields. Save a fresh page into `tests/fixtures/` and fix `lib/afx.js`.

## Adding a stock

Add `{symbol, name, sector}` to `data/universe.json` (sector must be one of `sectors`) and run `npm run update`. The run log warns about listed tickers missing from the universe (new listings).

## Automation

`.github/workflows/update-stocks.yml`: weekdays 16:00 UTC (7 PM EAT) or manual dispatch; not on push. Runs tests, updates, commits generated files and `data/` as "Stock Bot", then `check-freshness.js`. Expect frequent `🤖 Update NSE prices and news` commits.
