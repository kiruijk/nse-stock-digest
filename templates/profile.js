// Renders a stock page (stocks/<ticker>.html) from the stock's market data plus its
// details (data/details/<ticker>.json: description, EPS/DPS, shares, factsheet).
// Pages are fully static HTML so they work without JavaScript and can be indexed.

const fs = require('fs');
const path = require('path');

const { sectorSlug } = require('../lib/sectors');
const { NAV_CSS, renderNav, renderFooterLinks, seoTags } = require('./site');

const CSS = fs.readFileSync(path.join(__dirname, 'profile.css'), 'utf8');

const DISCLAIMER = 'For informational purposes only — not investment advice. Prices come from AFX (afx.kwayisi.org), ' +
  'are published after the NSE close and may be delayed, incomplete or inaccurate. P/E and dividend yield use the latest ' +
  'reported EPS and dividend per share against the current price. Not affiliated with the Nairobi Securities Exchange. ' +
  'Do your own research and consult a licensed investment adviser before making investment decisions.';

const RETURN_LABELS = [
  ['1D', 'oneDay'], ['5D', 'fiveDay'], ['1M', 'oneMonth'], ['6M', 'sixMonth'], ['YTD', 'ytd'],
  ['1Y', 'oneYear'], ['3Y', 'threeYear'], ['5Y', 'fiveYear'], ['10Y', 'tenYear']
];

// Scraped text is escaped; sector explainers in data/sectors are trusted HTML
const escapeHtml = (s) => String(s ?? '')
  .replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// KES amounts: "KES 1.45T", "KES 820.3B", "KES 45.2M"
function formatKes(value) {
  if (value == null) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e12) return `KES ${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `KES ${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `KES ${(value / 1e6).toFixed(1)}M`;
  return `KES ${Math.round(value).toLocaleString('en-US')}`;
}

// Share price: 2 decimals, thousands separators (GLD trades above KES 5,000)
const formatPrice = (v) => (v == null ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

function formatCount(v) {
  if (v == null) return '—';
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  return Math.round(v).toLocaleString('en-US');
}

const formatPct = (v) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`);
const pctColor = (v) => (v == null ? '#6b7280' : v >= 0 ? '#059669' : '#dc2626');
const formatRatio = (v) => (v == null ? '—' : `${v.toFixed(1)}×`);
const formatYield = (v) => (v == null ? '—' : `${v.toFixed(1)}%`);

function formatDate(iso, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!iso) return '—';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00Z`) : new Date(iso);
  return d.toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
}

const card = (inner) => `        <div class="card">\n${inner}\n        </div>`;

function statCard(label, value, sub = '') {
  return card(`          <div class="card-subtitle">${label}</div>
          <div class="card-value">${value}</div>${sub ? `\n          <div class="card-subtitle">${sub}</div>` : ''}`);
}

// Interactive price chart: period buttons, area line, hover tooltip. `chart` holds
// { daily: [[date, close]...] for the last year, weekly: [...] before that }.
function renderChart(stock, chart) {
  if (!chart || (!chart.daily.length && !chart.weekly.length)) return '';
  // Official returns (same basis as the returns row) so the chart header always matches them
  const returns = { '1M': stock.oneMonth, '6M': stock.sixMonth, YTD: stock.ytd, '1Y': stock.oneYear, '3Y': stock.threeYear, '5Y': stock.fiveYear, '10Y': stock.tenYear };
  const data = JSON.stringify({ daily: chart.daily, weekly: chart.weekly, price: stock.price, returns });
  return `      <div class="chart" id="price-chart">
        <div class="chart-head">
          <div class="chart-change" id="chart-change"></div>
          <div class="chart-periods" role="group" aria-label="Chart period">
            ${['1M', '6M', 'YTD', '1Y', '3Y', '5Y', '10Y', 'Max'].map(p => `<button type="button" data-period="${p}">${p}</button>`).join('')}
          </div>
        </div>
        <svg id="chart-svg" viewBox="0 0 600 200" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(stock.symbol)} price chart"></svg>
        <div class="chart-tip" id="chart-tip" hidden></div>
        <div class="chart-range" id="chart-range"></div>
      </div>
      <script>
      (function () {
        var DATA = ${data};
        var all = DATA.weekly.concat(DATA.daily);
        var svg = document.getElementById('chart-svg');
        var tip = document.getElementById('chart-tip');
        var W = 600, H = 200, PAD = 8;
        var points = [];

        function startDate(period) {
          var d = new Date();
          if (period === 'Max') return all[0][0];
          if (period === 'YTD') return (d.getFullYear() - 1) + '-12-31';
          var months = { '1M': 1, '6M': 6, '1Y': 12, '3Y': 36, '5Y': 60, '10Y': 120 }[period];
          d.setMonth(d.getMonth() - months);
          return d.toISOString().slice(0, 10);
        }

        function fmtDate(iso) {
          return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }

        function fmtPrice(v) {
          return 'KES ' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        function draw(period) {
          var start = startDate(period);
          var src = ['1M', '6M', 'YTD', '1Y'].indexOf(period) >= 0 || (period === 'Max' && !DATA.weekly.length) ? DATA.daily : all;
          // Start from the last close on or before the start date, like the returns calculation
          var first = 0;
          for (var i = 0; i < src.length; i++) { if (src[i][0] <= start) first = i; else break; }
          var rows = src.slice(first);
          if (DATA.price != null && rows.length && rows[rows.length - 1][1] !== DATA.price) rows = rows.concat([[new Date().toISOString().slice(0, 10), DATA.price]]);
          var change = document.getElementById('chart-change');
          if (rows.length < 2 || all[0][0] > start) {
            svg.innerHTML = '';
            change.textContent = 'Not enough price history for ' + period;
            change.style.color = '#6b7280';
            document.getElementById('chart-range').textContent = '';
            points = [];
            return;
          }
          var vals = rows.map(function (r) { return r[1]; });
          var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
          var span = max - min || 1;
          points = rows.map(function (r, i) {
            return { x: PAD + (i / (rows.length - 1)) * (W - 2 * PAD), y: PAD + (1 - (r[1] - min) / span) * (H - 2 * PAD), d: r[0], v: r[1] };
          });
          var up = (DATA.returns[period] != null ? DATA.returns[period] : vals[vals.length - 1] - vals[0]) >= 0;
          var color = up ? '#059669' : '#dc2626';
          var line = points.map(function (p, i) { return (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' ');
          var area = line + ' L' + points[points.length - 1].x.toFixed(1) + ' ' + H + ' L' + points[0].x.toFixed(1) + ' ' + H + ' Z';
          svg.innerHTML =
            '<defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity="0.18"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
            '<path d="' + area + '" fill="url(#fill)"/>' +
            '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2" vector-effect="non-scaling-stroke"/>' +
            '<line id="chart-cursor" y1="0" y2="' + H + '" stroke="#9ca3af" stroke-width="1" vector-effect="non-scaling-stroke" visibility="hidden"/>';
          var official = DATA.returns[period];
          var pct = official != null ? official : (vals[vals.length - 1] / vals[0] - 1) * 100;
          change.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '% ' + (period === 'Max' ? 'since ' + fmtDate(rows[0][0]) : 'over ' + period);
          change.style.color = color;
          document.getElementById('chart-range').textContent =
            fmtDate(rows[0][0]) + ' – today · Low ' + fmtPrice(min) + ' · High ' + fmtPrice(max);
        }

        svg.addEventListener('mousemove', function (e) {
          if (!points.length) return;
          var box = svg.getBoundingClientRect();
          var x = (e.clientX - box.left) / box.width * W;
          var p = points.reduce(function (best, q) { return Math.abs(q.x - x) < Math.abs(best.x - x) ? q : best; });
          var cursor = document.getElementById('chart-cursor');
          cursor.setAttribute('x1', p.x); cursor.setAttribute('x2', p.x); cursor.setAttribute('visibility', 'visible');
          tip.hidden = false;
          tip.textContent = fmtDate(p.d) + ' · ' + fmtPrice(p.v);
          tip.style.left = Math.min(Math.max(p.x / W * box.width - 75, 0), box.width - 150) + 'px';
        });
        svg.addEventListener('mouseleave', function () {
          tip.hidden = true;
          var cursor = document.getElementById('chart-cursor');
          if (cursor) cursor.setAttribute('visibility', 'hidden');
        });
        var buttons = document.querySelectorAll('#price-chart .chart-periods button');
        function select(period) {
          buttons.forEach(function (b) { b.classList.toggle('active', b.dataset.period === period); });
          draw(period);
        }
        // Grey out periods the stock's history doesn't cover (e.g. recent listings)
        buttons.forEach(function (b) {
          if (b.dataset.period !== 'Max' && all[0][0] > startDate(b.dataset.period)) b.disabled = true;
        });
        document.querySelector('#price-chart .chart-periods').addEventListener('click', function (e) {
          var btn = e.target.closest('button');
          if (btn && !btn.disabled) select(btn.dataset.period);
        });
        // Open on 1Y, or Max when the stock hasn't traded that long
        select(document.querySelector('#price-chart button[data-period="1Y"]').disabled ? 'Max' : '1Y');
      })();
      </script>`;
}

// Key figures under the name and price in the page header
function renderHeaderStats(stock) {
  const d = stock.details || {};
  const range = stock.range52w;
  const stats = [
    ['Market Cap', formatKes(stock.marketCap)],
    ['P/E', formatRatio(stock.pe)],
    ['P/B', stock.pb == null ? '—' : `${stock.pb.toFixed(2)}×`],
    ['Div Yield', formatYield(stock.dividendYield)],
    ['EPS', d.eps == null ? '—' : `KES ${formatPrice(d.eps)}`],
    ['DPS', d.dps == null ? '—' : `KES ${formatPrice(d.dps)}`],
    ['52W Range', range ? `${formatPrice(range.low)} – ${formatPrice(range.high)}` : '—']
  ];
  return `    <dl class="header-stats">
${stats.map(([label, value]) => `      <div><dt>${label}</dt><dd>${value}</dd></div>`).join('\n')}
    </dl>`;
}

const pctPlain = (v) => (v == null ? '—' : `${v.toFixed(0)}%`);

// Under KES 1M traded per session on average over 3 months: prices can be stale and
// positions hard to build or exit
const THIN_TURNOVER = 1e6;
const isThinlyTraded = (s) => s.avgDailyTurnover != null && s.avgDailyTurnover < THIN_TURNOVER;

// Payout, ROE, liquidity and risk figures, each with a one-line explanation
function renderKeyRatios(stock) {
  const payoutNote = stock.payoutRatio == null
    ? 'Needs positive earnings and a dividend'
    : stock.payoutRatio > 100
      ? '<span class="warn">Paying out more than it earns</span>'
      : 'Share of earnings paid as dividends (approx.)';
  const turnoverNote = stock.avgDailyTurnover == null
    ? 'Not available yet'
    : isThinlyTraded(stock)
      ? '<span class="warn">Thinly traded: prices can be stale</span>'
      : `Per session, last 3 months${stock.liquidityRank ? ` · #${stock.liquidityRank} most traded` : ''}`;
  const since = stock.maxDrawdownSince && stock.maxDrawdownSince > new Date(Date.now() - 4.9 * 365.25 * 864e5).toISOString().slice(0, 10)
    ? `Worst fall since ${formatDate(stock.maxDrawdownSince)}`
    : 'Worst peak-to-trough fall, 5 years';
  return `    <!-- Key Ratios -->
    <div class="section">
      <h2>Key Ratios</h2>
      <div class="grid-3">
${statCard('Payout Ratio', pctPlain(stock.payoutRatio), payoutNote)}
${statCard('Return on Equity', stock.roe == null ? '—' : `${stock.roe.toFixed(1)}%`, stock.roe == null ? 'Needs book value (not yet entered)' : 'Net income ÷ shareholders\' equity')}
${statCard('Avg Daily Turnover', formatKes(stock.avgDailyTurnover), turnoverNote)}
${statCard('From 52W High', stock.fromHigh52w == null ? '—' : formatPct(stock.fromHigh52w), stock.fromLow52w == null ? 'Needs a year of history' : `${formatPct(stock.fromLow52w)} from 52W low`)}
${statCard('Volatility (1Y)', pctPlain(stock.volatility1y), 'Annualized; higher means bigger swings')}
${statCard('Max Drawdown', stock.maxDrawdown5y == null ? '—' : `${stock.maxDrawdown5y.toFixed(0)}%`, since)}
      </div>
      <div class="meta-line">Payout uses the latest reported EPS and dividend per share, which may be for different periods. Volatility and drawdown come from daily closing prices.</div>
    </div>`;
}

// Same-sector comparison table
function renderPeers(stock, peers) {
  if (!peers.length) return '';
  const rows = [stock, ...peers].sort((a, b) => (b.marketCap ?? -1) - (a.marketCap ?? -1)).map(s => `          <tr${s.symbol === stock.symbol ? ' class="current-row"' : ''}>
            <td>${s.symbol === stock.symbol ? `<strong>${s.symbol}</strong>` : `<a href="${s.symbol.toLowerCase()}.html">${s.symbol}</a>`}</td>
            <td>${escapeHtml(s.name)}</td>
            <td class="num">${formatPrice(s.price)}</td>
            <td class="num" style="color: ${pctColor(s.oneYear)}">${formatPct(s.oneYear)}</td>
            <td class="num">${formatKes(s.marketCap)}</td>
            <td class="num">${formatRatio(s.pe)}</td>
            <td class="num">${formatYield(s.dividendYield)}</td>
          </tr>`).join('\n');
  return `    <!-- Sector Peers -->
    <div class="section">
      <h2>${escapeHtml(stock.sector)} Peers</h2>
      <div style="overflow-x: auto;">
      <table>
        <thead>
          <tr><th>Ticker</th><th>Company</th><th class="num">Price</th><th class="num">1Y</th><th class="num">Mkt Cap</th><th class="num">P/E</th><th class="num">Yield</th></tr>
        </thead>
        <tbody>
${rows}
        </tbody>
      </table>
      </div>
      <p class="note"><a href="../sectors/${sectorSlug(stock.sector)}.html">All ${escapeHtml(stock.sector)} stocks →</a></p>
    </div>`;
}

// opts: { sectors, site, chart, peers }
function renderProfile(stock, opts = {}) {
  const { sectors = [], site = {}, chart = null, peers = [] } = opts;
  const d = stock.details || {};
  const title = `${stock.name} (NSE: ${stock.symbol})`;
  const description = (d.description || '').slice(0, 300) ||
    `${stock.name} (NSE: ${stock.symbol}) share price, returns, dividend yield, P/E and news.`;

  const sections = [];

  // Price, valuation and returns
  const dayChange = stock.change == null ? 'No trades today' : `${stock.change >= 0 ? '+' : ''}${formatPrice(stock.change)} (${formatPct(stock.changePercent)}) today`;
  sections.push(`    <!-- Price & Valuation -->
    <div class="section">
      <h2>Price &amp; Valuation</h2>
${renderChart(stock, chart)}
      <div class="grid-3">
${statCard('Share Price', `KES ${formatPrice(stock.price)}`, `<span style="color: ${pctColor(stock.change == null ? null : stock.changePercent)}">${dayChange}</span>`)}
${statCard('Market Cap', formatKes(stock.marketCap), d.sharesOutstanding ? `${formatCount(d.sharesOutstanding)} shares` : '')}
${statCard('Volume', formatCount(stock.volume), 'Shares traded, latest session')}
${statCard('P/E Ratio', formatRatio(stock.pe), d.eps != null ? `EPS KES ${d.eps}` : 'No EPS reported')}
${statCard('Dividend Yield', formatYield(stock.dividendYield), d.dps != null ? `DPS KES ${d.dps}` : 'No dividend reported')}
${statCard('YTD Return', `<span style="color: ${pctColor(stock.ytd)}">${formatPct(stock.ytd)}</span>`)}
      </div>
      <div class="returns">
${RETURN_LABELS.map(([label, field]) => `        <div class="return"><div class="return-label">${label}</div><div class="return-value" style="color: ${pctColor(stock[field])}">${formatPct(stock[field])}</div></div>`).join('\n')}
      </div>
      <div class="meta-line">P/E and yield use the latest reported EPS and dividend per share${d.fetchedAt ? ` (checked ${formatDate(d.fetchedAt)})` : ''} against today's price.</div>
    </div>`);

  sections.push(renderKeyRatios(stock));

  // About the company
  const facts = [
    ['Sector', escapeHtml(stock.sector)],
    ['Industry', escapeHtml(d.industry)],
    ['Listed on NSE', escapeHtml(d.listedSince)],
    ['Incorporated', escapeHtml(d.incorporated)],
    ['Employees', d.employees ? `~${d.employees.toLocaleString('en-US')}` : null],
    ['ISIN', escapeHtml(d.isin)],
    ['Website', d.website ? `<a href="https://${escapeHtml(d.website.replace(/^https?:\/\//, ''))}" target="_blank" rel="noopener">${escapeHtml(d.website.replace(/^https?:\/\//, ''))}</a>` : null],
    ['Address', escapeHtml(d.address)]
  ].filter(([, v]) => v);
  sections.push(`    <!-- About -->
    <div class="section">
      <h2>About ${escapeHtml(stock.name)}</h2>
      <p class="para">${escapeHtml(d.description || 'No company description available yet.')}</p>
${facts.length ? `      <dl class="facts">
${facts.map(([k, v]) => `        <div><dt>${k}</dt><dd>${v}</dd></div>`).join('\n')}
      </dl>` : ''}
    </div>`);

  const peersSection = renderPeers(stock, peers);
  if (peersSection) sections.push(peersSection);

  const news = (stock.news || []).filter(n => n.url);
  sections.push(`    <!-- Latest News -->
    <div class="section">
      <h2>Latest News</h2>
${news.length ? `      <ul class="item-list">
${news.map(n => `        <li><a href="${escapeHtml(n.url)}" target="_blank" rel="noopener">${escapeHtml(n.title)}</a><div class="item-meta">${escapeHtml(n.source)} · ${formatDate(n.date)}</div></li>`).join('\n')}
      </ul>` : '      <p class="note">No recent news.</p>'}
    </div>`);

  const notices = [];
  if (stock.suspended) {
    notices.push('    <div class="notice notice-stale">Trading in this security is suspended on the NSE. The price shown is the last traded price.</div>');
  }
  if (stock.stale) {
    notices.push(`    <div class="notice notice-stale">Prices couldn't be refreshed on the latest update; figures below are from ${formatDate(stock.staleSince)}.</div>`);
  }

  return `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(stock.name)} (${stock.symbol}) Share Price, Dividends &amp; News | ${escapeHtml(site.name)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:title" content="${escapeHtml(title)} — Share Price &amp; Profile">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="article">
${seoTags(site, `stocks/${stock.symbol.toLowerCase()}.html`)}
  <style>
${(CSS + NAV_CSS).replace(/^/gm, '    ').replace(/^\s+$/gm, '')}
  </style>
</head>

<body>
  <!-- Generated by update-stocks.js from data/ and live market data. Do not edit by hand. -->
  <!-- Prices as of: ${stock.pricesAsOf || 'unknown'} -->
${renderNav('../', sectors, escapeHtml(site.name))}

  <header>
    <div>
      <h1>${escapeHtml(title)}</h1>
      <div><a class="theme-tag" href="../sectors/${sectorSlug(stock.sector)}.html">${escapeHtml(stock.sector)}</a>${stock.suspended ? '<span class="theme-tag">Suspended</span>' : ''}</div>
    </div>
    <div class="header-price">
      <div class="header-price-value">KES ${formatPrice(stock.price)}</div>
      <div class="header-price-change">${stock.change == null ? 'unchanged' : formatPct(stock.changePercent)}</div>
    </div>
${renderHeaderStats(stock)}
  </header>

  <div class="container">

${notices.join('\n')}${notices.length ? '\n\n' : ''}${sections.join('\n\n')}

  </div>

  <footer class="disclaimer">
${renderFooterLinks('../', sectors, escapeHtml(site.name))}
    <p>${DISCLAIMER}</p>
  </footer>

</body>

</html>
`;
}

module.exports = {
  renderProfile, renderPeers, renderKeyRatios, isThinlyTraded, formatKes, formatPrice, formatCount, formatPct, pctColor, formatRatio,
  formatYield, formatDate, escapeHtml, CSS, DISCLAIMER
};
