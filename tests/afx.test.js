const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const afx = require('../lib/afx');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

test('parseListing reads every row, with suspended flags and untraded stocks', () => {
  const rows = afx.parseListing(fixture('listing.html'));
  assert.strictEqual(rows.length, 71);
  assert.deepStrictEqual(rows.find(r => r.symbol === 'SCOM'), {
    symbol: 'SCOM', name: 'Safaricom Plc', suspended: false, volume: 2501236, price: 36.2, change: -0.4, changePercent: -1.09
  });
  const arm = rows.find(r => r.symbol === 'ARM');
  assert.strictEqual(arm.suspended, true);
  assert.strictEqual(arm.change, null);
  // Entities decoded, hyphenated tickers kept, thousands separators handled
  assert.strictEqual(rows.find(r => r.symbol === 'IMH').name, 'I&M Holdings Plc');
  assert.ok(rows.some(r => r.symbol === 'KPLC-P4'));
  assert.strictEqual(rows.find(r => r.symbol === 'GLD').price, 5350);
});

test('parseListingTime and parseMarketSummary read the header', () => {
  const html = fixture('listing.html');
  assert.strictEqual(afx.parseListingTime(html), '2026-09-23T15:13:12+00:00');
  const m = afx.parseMarketSummary(html);
  assert.strictEqual(m.nasi, 247.21);
  assert.strictEqual(m.nasiChange, -0.54);
  assert.strictEqual(m.nasiYtdPercent, 32.5);
  assert.ok(Math.abs(m.marketCap - 4.19e12) < 1e6);
});

test('parseCompany reads description, factsheet and valuation stats', () => {
  const c = afx.parseCompany(fixture('scom.html'));
  assert.match(c.description, /^Safaricom Plc is a Kenyan telecommunications company/);
  assert.doesNotMatch(c.description, /is listed on the Nairobi/);
  assert.strictEqual(c.sector, 'Telecommunications');
  assert.strictEqual(c.industry, 'Mobile Telecommunications');
  assert.strictEqual(c.website, 'www.safaricom.co.ke');
  assert.strictEqual(c.listedSince, 'June 9, 2008');
  assert.strictEqual(c.isin, 'KE1000001402');
  assert.strictEqual(c.employees, 5500);
  assert.strictEqual(c.eps, 2.3863);
  assert.strictEqual(c.dps, 2.3);
  assert.strictEqual(c.sharesOutstanding, 40.1e9);
});

test('parseChart returns sorted [date, close] rows', () => {
  const rows = afx.parseChart(fixture('chart.js'));
  assert.deepStrictEqual(rows[0], ['2016-09-26', 19.5]);
  assert.deepStrictEqual(rows[rows.length - 1], ['2026-09-23', 36.2]);
});

test('parseNumber and parseSuffixed', () => {
  assert.strictEqual(afx.parseNumber('1,234.50'), 1234.5);
  assert.strictEqual(afx.parseNumber('+0.00'), 0);
  assert.strictEqual(afx.parseNumber(''), null);
  assert.strictEqual(afx.parseNumber('—'), null);
  assert.strictEqual(afx.parseSuffixed('2.5M'), 2.5e6);
  assert.strictEqual(afx.parseSuffixed('850K'), 850e3);
  assert.strictEqual(afx.parseSuffixed('n/a'), null);
});

test('parseLiquidity reads the 3-month trading summary, liquid and thin', () => {
  assert.deepStrictEqual(afx.parseLiquidity(fixture('scom.html')), {
    liquidityRank: 1, volume3m: 449e6, deals3m: 78824, turnover3m: 16.2e9, avgDailyVolume: 7.13e6, avgDailyTurnover: 257e6
  });
  const limt = afx.parseLiquidity(fixture('limt.html'));
  assert.strictEqual(limt.liquidityRank, 59);
  assert.strictEqual(limt.avgDailyTurnover, 21676);
  assert.strictEqual(afx.parseLiquidity('<p>No trades</p>').avgDailyTurnover, null);
  assert.strictEqual(afx.parseCompany(fixture('scom.html')).avgDailyTurnover, 257e6);
});
