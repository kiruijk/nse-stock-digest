// Static pieces of index.html written by update-stocks.js: SEO head tags, the market
// summary strip, and plain-HTML versions of the stock list and news feed. The page's
// script replaces the lists with interactive versions on load; the static copies are what
// search engines and no-JS visitors see.

const { escapeHtml, formatPct, formatPrice, formatKes, pctColor } = require('./profile');
const { tip } = require('./glossary');

function renderHomeHead(site) {
  return `  <meta name="description" content="${escapeHtml(site.description)}">
  <meta property="og:title" content="${escapeHtml(site.name)} — NSE Share Prices, Dividends &amp; News">
  <meta property="og:description" content="${escapeHtml(site.description)}">
  <meta property="og:type" content="website">
  <link rel="canonical" href="${site.url}">
  <meta property="og:url" content="${site.url}">
  <meta property="og:site_name" content="${escapeHtml(site.name)}">`;
}

// NASI level, day and YTD change, market cap and today's advancers/decliners
function renderMarketStrip(market, stocks) {
  if (!market || market.nasi == null) return '';
  const up = stocks.filter(s => s.change > 0).length;
  const down = stocks.filter(s => s.change < 0).length;
  const flat = stocks.filter(s => s.change === 0).length;
  const item = (label, value) => `<div class="market-item"><div class="market-label">${label}</div><div class="market-value">${value}</div></div>`;
  return `<div class="market-strip">
          ${item(tip('NASI', 'nasi'), `${market.nasi.toFixed(2)} <span style="color: ${pctColor(market.nasiChangePercent)}">${formatPct(market.nasiChangePercent)}</span>`)}
          ${item('NASI YTD', `<span style="color: ${pctColor(market.nasiYtdPercent)}">${formatPct(market.nasiYtdPercent)}</span>`)}
          ${item('Market Cap', formatKes(market.marketCap))}
          ${item('Gainers / Losers', `<span style="color: #059669">${up}</span> / <span style="color: #dc2626">${down}</span> <span class="market-flat">(${flat} flat)</span>`)}
        </div>`;
}

// Stocks by 1-day change, as a plain list of links
function renderStaticStocks(stocks) {
  // Suspended counters last; they can't be traded
  const ranked = [...stocks].sort((a, b) => (Boolean(a.suspended) - Boolean(b.suspended)) || (b.changePercent ?? -Infinity) - (a.changePercent ?? -Infinity));
  return `<ol class="static-list">
${ranked.map(s => `          <li><a href="stocks/${s.symbol.toLowerCase()}.html">${s.symbol} — ${escapeHtml(s.name)}</a> KES ${formatPrice(s.price)} ${s.suspended ? '(suspended)' : `(${formatPct(s.changePercent)} today)`}</li>`).join('\n')}
        </ol>`;
}

// Latest headlines across all stocks, newest first
function renderStaticNews(stocks, limit = 25) {
  const byUrl = new Map();
  for (const s of stocks) {
    for (const n of (s.news || []).slice(0, 3)) {
      if (!n.url) continue;
      if (!byUrl.has(n.url)) byUrl.set(n.url, { ...n, tickers: [] });
      byUrl.get(n.url).tickers.push(s.symbol);
    }
  }
  const news = [...byUrl.values()].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, limit);
  return `<ul class="static-list">
${news.map(n => `          <li>${n.tickers.join(', ')}: <a href="${escapeHtml(n.url)}" rel="noopener">${escapeHtml(n.title)}</a> (${escapeHtml(n.source)})</li>`).join('\n')}
        </ul>`;
}

module.exports = { renderHomeHead, renderMarketStrip, renderStaticStocks, renderStaticNews };
