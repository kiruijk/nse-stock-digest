#!/usr/bin/env node

// Fails (exit 1) when the latest update left tickers missing, prices stale, or the
// source's timestamp too old, so the GitHub Actions run goes red and GitHub emails the
// repo owner. Run after update-stocks.js.

const fs = require('fs');

// The listing's timestamp can lag over weekends and public holidays; beyond this it
// means the source stopped updating (or its page layout changed)
const MAX_AGE_DAYS = 5;

const data = JSON.parse(fs.readFileSync('data/market.json', 'utf8'));
const symbols = JSON.parse(fs.readFileSync('data/universe.json', 'utf8')).stocks.map(s => s.symbol);

const missing = symbols.filter(s => !data.stocks[s]);
const stale = symbols.filter(s => data.stocks[s]?.stale);
const asOf = data.market?.asOf;
const ageDays = asOf ? (Date.now() - new Date(asOf)) / 864e5 : Infinity;
const noHistory = symbols.filter(s => !fs.existsSync(`data/history/${s.toLowerCase()}.json`));

console.log(`Tickers: ${symbols.length} | missing: ${missing.length} | stale: ${stale.length} | prices as of: ${asOf || 'unknown'}`);
if (missing.length) console.log(`  Missing: ${missing.join(', ')}`);
if (stale.length) console.log(`  Stale: ${stale.join(', ')}`);
if (noHistory.length) console.log(`  No price history yet (filled in by later runs): ${noHistory.join(', ')}`);

if (missing.length || stale.length || ageDays > MAX_AGE_DAYS) {
  console.error(`❌ Data freshness check failed (allowed: 0 missing, 0 stale, prices ≤${MAX_AGE_DAYS} days old)`);
  process.exit(1);
}
console.log('✅ Data freshness check passed');
