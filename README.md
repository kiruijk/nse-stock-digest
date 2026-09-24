# Nairobi Stock Digest

A daily tracker for every security listed on the Nairobi Securities Exchange (NSE): prices and returns (1 day to 10 years), P/E ratios, dividend yields, price charts, sector comparisons and news.

It's a static site (plain HTML/CSS/JS, no build step) hosted on GitHub Pages. A GitHub Actions workflow runs `update-stocks.js` after the NSE close each weekday, regenerates the pages, and commits them.

## Data sources

- **Prices, history, company facts:** [AFX](https://afx.kwayisi.org/nse/) (afx.kwayisi.org). The listing page has every price in one request. Company pages and 10-year price charts are fetched a few tickers per run, 60 seconds apart, as the site's `robots.txt` asks.
- **News:** Google News RSS (Kenya edition), searched by company name.

No API keys are needed.

## Commands

```bash
npm test          # unit tests (Node's built-in runner, no dependencies)
npm run update    # fetch prices + news, refresh 6 tickers' details, rebuild the site
npm run render    # rebuild the site from data/ without fetching
npm run backfill  # one-off: fetch details + history for every ticker without them (~2 min/ticker)
```

To preview, open `index.html` in a browser.

## Layout

| Path | What |
| --- | --- |
| `data/universe.json` | Every tracked ticker: symbol, name, NSE sector, optional news search phrase |
| `data/market.json` | Last run's prices, returns and news (written by the bot) |
| `data/details/<t>.json` | Company description, EPS, DPS, shares outstanding, factsheet |
| `data/history/<t>.json` | Daily closes, one `[date, close]` row per line |
| `data/book-values.json` | Hand-entered shareholders' equity per company (from results), used for P/B |
| `data/sectors/<slug>.json` | Optional hand-written sector background (`summary`, `sections`, `reviewed`) |
| `lib/afx.js` | Parsers for the AFX pages |
| `templates/` | Page templates (stock, sector, shared nav, homepage pieces) |
| `index.html` | Dashboard; generated sections are injected between marker comments |
| `stocks/`, `sectors/` | Generated pages. Don't edit these by hand. |

## Disclaimer

For information only; not investment advice. Not affiliated with the Nairobi Securities Exchange.
