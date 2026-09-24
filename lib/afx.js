// Parsers for afx.kwayisi.org, the free source for NSE prices. Three page types:
//   listing  https://afx.kwayisi.org/nse/            every listed security's price, one request
//   company  https://afx.kwayisi.org/nse/<t>.html     description, valuation stats, sector
//   chart    https://afx.kwayisi.org/chart/nse/<t>    ~10 years of daily closes (a JS file)
// The site asks for a 60-second crawl delay (robots.txt), so the listing is fetched every
// run and the per-ticker pages only a few at a time (see update-stocks.js).
// Everything here is pure string parsing, tested against tests/fixtures/.

const BASE = 'https://afx.kwayisi.org';
const listingUrl = () => `${BASE}/nse/`;
const companyUrl = (symbol) => `${BASE}/nse/${symbol.toLowerCase()}.html`;
const chartUrl = (symbol) => `${BASE}/chart/nse/${symbol.toLowerCase()}`;

const decodeEntities = (s) => String(s ?? '')
  .replace(/&amp;/g, '&')
  .replace(/&#0?39;|&#x27;|&apos;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&mdash;/g, '—')
  .replace(/&nbsp;/g, ' ');

const stripTags = (s) => decodeEntities(String(s ?? '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

// "1,234.50" → 1234.5; "" or "—" → null
function parseNumber(text) {
  const s = String(text ?? '').replace(/[,%\s]/g, '').replace(/^\+/, '');
  if (!s || !/^-?\d*\.?\d+$/.test(s)) return null;
  return Number(s);
}

// "40.1B" → 40.1e9, "2.5M" → 2.5e6, "1.45T" → 1.45e12, "850K" → 850e3
function parseSuffixed(text) {
  const m = String(text ?? '').replace(/,/g, '').trim().match(/^(-?\d*\.?\d+)\s*([KMBT]?)$/i);
  if (!m) return null;
  return Number(m[1]) * ({ '': 1, K: 1e3, M: 1e6, B: 1e9, T: 1e12 })[m[2].toUpperCase()];
}

// "1.37 million" → 1.37e6, "21,676" → 21676, "16.2 billion" → 16.2e9
function parseWords(text) {
  const m = String(text ?? '').trim().match(/^([\d.,]+)(?:\s+(thousand|million|billion|trillion))?$/i);
  if (!m) return null;
  const n = parseNumber(m[1]);
  return n == null ? null : n * ({ undefined: 1, thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12 })[m[2]?.toLowerCase()];
}

// The company page's 3-month trading summary: "… is the 59th most traded stock … over the
// past three months (…). LIMT has traded a total volume of 2,649 shares—in 258 deals—valued
// at KES 1.37 million over the period, averaging a volume of 42 shares (valued at KES 21,676)
// per session."
function parseLiquidity(html) {
  const text = decodeEntities(stripTags(html));
  const num = '([\\d.,]+(?: (?:thousand|million|billion|trillion))?)';
  const rank = text.match(/is the #?(\d+)(?:st|nd|rd|th)? most traded stock on the Nairobi Securities Exchange over the past three months/);
  const totals = text.match(new RegExp(`traded a total volume of ${num} shares\\s*—\\s*in ${num} deals\\s*—\\s*valued at KES ${num} over the period, averaging a volume of ${num} shares \\(valued at KES ${num}\\) per session`));
  return {
    liquidityRank: rank ? Number(rank[1]) : null,
    volume3m: totals ? parseWords(totals[1]) : null,
    deals3m: totals ? parseWords(totals[2]) : null,
    turnover3m: totals ? parseWords(totals[3]) : null,
    avgDailyVolume: totals ? parseWords(totals[4]) : null,
    avgDailyTurnover: totals ? parseWords(totals[5]) : null
  };
}

// The listing's timestamp: <time id=u datetime=2026-09-23T15:13:12+00:00>
function parseListingTime(html) {
  const m = html.match(/<time id=u datetime=([^ >]+)>/);
  return m ? m[1] : null;
}

// Every row of the main Ticker | Name | Volume | Price | Change table. Rows with
// class "ss" are suspended counters. Change is blank when a stock didn't trade.
function parseListing(html) {
  const table = html.split('<th>Ticker<th>Name')[1] || '';
  const rowRe = /<tr( class=(\w+))?><td><a href=[^ >]+\/nse\/([\w-]+)\.html title="([^"]*)">([^<]+)<\/a><td>.*?<td>([^<]*)<td>([^<]*)<td(?: class=\w+)?>([^<]*)/g;
  const rows = [];
  for (const m of table.matchAll(rowRe)) {
    const price = parseNumber(m[7]);
    const change = parseNumber(m[8]);
    const prev = price != null && change != null ? price - change : null;
    rows.push({
      symbol: m[5].trim(),
      name: decodeEntities(m[4]),
      suspended: m[2] === 'ss',
      volume: parseNumber(m[6]),
      price,
      change,
      changePercent: prev ? Math.round((change / prev) * 10000) / 100 : null
    });
  }
  return rows;
}

// NASI (NSE All Share Index) summary at the top of the listing
function parseMarketSummary(html) {
  const m = html.match(/NASI Index<th>[\s\S]*?<tbody[^>]*><tr><td>([\d.,]+) <span[^>]*>\(([-+\d.,]+)\)<\/span><td[^>]*>([-+\d.,]+) \(([-+\d.,]+)%\)<td>KES ([\d.]+[KMBT]?)/);
  if (!m) return null;
  const nasi = parseNumber(m[1]);
  const change = parseNumber(m[2]);
  return {
    nasi,
    nasiChange: change,
    nasiChangePercent: nasi != null && change != null ? Math.round((change / (nasi - change)) * 10000) / 100 : null,
    nasiYtdPercent: parseNumber(m[4]),
    marketCap: parseSuffixed(m[5])
  };
}

// [[date, close], ...] oldest → newest from the chart script's d("YYYY-MM-DD"),close pairs
function parseChart(js) {
  const rows = [];
  for (const m of String(js).matchAll(/d\("(\d{4}-\d{2}-\d{2})"\),(-?[\d.]+)\]/g)) {
    rows.push([m[1], Number(m[2])]);
  }
  return rows.sort((a, b) => a[0].localeCompare(b[0]));
}

// Value cell next to a label in the company page's stats tables
function statCell(html, label) {
  const m = html.match(new RegExp(`<td>${label}<td[^>]*>([^<]*)`));
  return m ? m[1].trim() : null;
}

// Factsheet <dt>Label<dd>Value
function factCell(html, label) {
  const m = html.match(new RegExp(`<dt>${label}<dd>([\\s\\S]*?)</div>`));
  return m ? stripTags(m[1]) || null : null;
}

function parseCompany(html) {
  // Business description: paragraph(s) after the "share price on …" heading and before the
  // boilerplate "is listed on the Nairobi Securities Exchange" paragraph
  const intro = (html.split('share price on Nairobi Securities Exchange</span></div>')[1] || '').split(/<p>[^<]*is listed on the Nairobi/)[0];
  const description = [...intro.matchAll(/<p>([\s\S]*?)(?=<p>|<style|<div|$)/g)].map(m => stripTags(m[1])).filter(Boolean).join(' ') || null;

  const listedMatch = html.match(/is listed on the Nairobi Securities Exchange \(NSE\) since ([A-Z][a-z]+ \d{1,2})(?:st|nd|rd|th)?, (\d{4})/);
  const isin = (html.match(/ISIN\)? of NSE:[\w-]+ is (\w+)/) || [])[1] || null;
  const employees = parseNumber((html.match(/estimated total number of ([\d,]+) employees/) || [])[1]);
  const incorporated = (html.match(/was incorporated on ([A-Z][a-z]+ \d{1,2}, \d{4})/) || [])[1] || null;

  return {
    description,
    sector: factCell(html, 'Sector'),
    industry: factCell(html, 'Industry'),
    address: factCell(html, 'Address'),
    website: factCell(html, 'Website'),
    employees,
    incorporated,
    listedSince: listedMatch ? `${listedMatch[1]}, ${listedMatch[2]}` : null,
    isin,
    eps: parseNumber(statCell(html, 'Earnings Per Share')),
    pe: parseNumber(statCell(html, 'Price/Earning Ratio')),
    dps: parseNumber(statCell(html, 'Dividend Per Share')),
    dividendYield: parseNumber(statCell(html, 'Dividend Yield')),
    sharesOutstanding: parseSuffixed(statCell(html, 'Shares Outstanding')),
    marketCap: parseSuffixed(statCell(html, 'Market Capitalization')),
    dayLow: parseNumber(statCell(html, 'Day’s Low Price')),
    dayHigh: parseNumber(statCell(html, 'Day’s High Price')),
    deals: parseNumber(statCell(html, 'Number of Deals')),
    turnover: parseSuffixed(statCell(html, 'Gross Turnover')),
    ...parseLiquidity(html)
  };
}

module.exports = {
  listingUrl, companyUrl, chartUrl, parseListing, parseListingTime, parseMarketSummary,
  parseChart, parseCompany, parseLiquidity, parseNumber, parseSuffixed, parseWords, decodeEntities, stripTags
};
