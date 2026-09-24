const test = require('node:test');
const assert = require('node:assert');

const u = require('../update-stocks');

const NOW = new Date('2026-09-23T15:00:00Z');

test('returnsFromHistory measures from the last close on or before each start date', () => {
  const history = [['2025-09-22', 50], ['2025-12-31', 80], ['2026-08-21', 90], ['2026-09-15', 95], ['2026-09-22', 99]];
  const r = u.returnsFromHistory(history, 100, NOW);
  assert.strictEqual(r.fiveDay, 5.26);   // from 2026-09-15 (95)
  assert.strictEqual(r.oneMonth, 11.11); // from 2026-08-21 (90)
  assert.strictEqual(r.ytd, 25);         // from 2025-12-31 (80)
  assert.strictEqual(r.oneYear, 100);    // from 2025-09-22 (50)
  assert.strictEqual(r.threeYear, null); // history doesn't reach back
});

test('mergeHistory unions by date with the newer series winning', () => {
  const merged = u.mergeHistory([['2026-01-01', 1], ['2026-01-02', 2]], [['2026-01-02', 2.5], ['2026-01-03', 3]]);
  assert.deepStrictEqual(merged, [['2026-01-01', 1], ['2026-01-02', 2.5], ['2026-01-03', 3]]);
});

test('valuation uses the current price', () => {
  const v = u.valuation({ eps: 2.5, dps: 1.5, sharesOutstanding: 1e9 }, 30, { equity: 20e9 });
  assert.deepStrictEqual(v, { pe: 12, pb: 1.5, roe: 12.5, payoutRatio: 60, dividendYield: 5, marketCap: 30e9 });
  // No book value entered → no P/B
  assert.strictEqual(u.valuation({ eps: 2.5, dps: 1.5, sharesOutstanding: 1e9 }, 30).pb, null);
  // Loss-makers have no meaningful P/E
  assert.strictEqual(u.valuation({ eps: -1, dps: null, sharesOutstanding: null }, 10).pe, null);
  assert.deepStrictEqual(u.valuation(null, 10), { pe: null, pb: null, roe: null, payoutRatio: null, dividendYield: null, marketCap: null });
  // Loss-maker: negative ROE, no payout ratio
  const loss = u.valuation({ eps: -1, dps: 0.5, sharesOutstanding: 1e9 }, 10, { equity: 10e9 });
  assert.strictEqual(loss.roe, -10);
  assert.strictEqual(loss.payoutRatio, null);
});

test('pickDetailTickers refreshes missing then oldest first', () => {
  const picked = u.pickDetailTickers(['A', 'B', 'C', 'D'], { A: '2026-09-20', B: '2026-09-01', D: '2026-09-22' }, 2);
  assert.deepStrictEqual(picked, ['C', 'B']);
});

test('parseGoogleNews reads items and strips the source suffix', () => {
  const xml = `<rss><channel>
    <item><title>Safaricom profit rises - Business Daily</title><link>https://example.com/a</link><pubDate>Tue, 22 Sep 2026 08:00:00 GMT</pubDate><source url="x">Business Daily</source></item>
    <item><title>No date</title><link>https://example.com/b</link></item>
  </channel></rss>`;
  assert.deepStrictEqual(u.parseGoogleNews(xml), [
    { title: 'Safaricom profit rises', source: 'Business Daily', date: '2026-09-22T08:00:00.000Z', url: 'https://example.com/a' }
  ]);
});

test('newsQuery drops Ltd/Plc and honours overrides', () => {
  assert.strictEqual(u.newsQuery({ name: 'Kenya Airways Ltd' }), 'Kenya Airways');
  assert.strictEqual(u.newsQuery({ name: 'Safaricom Plc' }), 'Safaricom');
  assert.strictEqual(u.newsQuery({ name: 'Total Kenya Ltd', news: 'TotalEnergies Marketing Kenya' }), 'TotalEnergies Marketing Kenya');
});

test('nairobiDate converts to the trading date in EAT', () => {
  assert.strictEqual(u.nairobiDate('2026-09-23T22:30:00Z'), '2026-09-24');
  assert.strictEqual(u.nairobiDate('2026-09-23T15:13:12+00:00'), '2026-09-23');
});

test('sparklines skip periods the history does not cover and end at the price', () => {
  const history = [['2026-06-01', 10], ['2026-09-01', 12], ['2026-09-20', 11]];
  const s = u.sparklines(history, 13, NOW);
  assert.deepStrictEqual(s.oneMonth, [12, 11, 13]);
  assert.strictEqual(s.oneYear, undefined);
});

test('range52w covers the last year plus the current price, null when history is short', () => {
  const history = [['2025-09-01', 5], ['2025-10-01', 8], ['2026-03-01', 12], ['2026-09-20', 10]];
  assert.deepStrictEqual(u.range52w(history, 7, NOW), { low: 7, high: 12 });
  assert.strictEqual(u.range52w([['2026-01-05', 10]], 11, NOW), null);
});

test('rangePosition measures distance from the 52-week high and low', () => {
  assert.deepStrictEqual(u.rangePosition({ low: 50, high: 200 }, 100), { fromHigh52w: -50, fromLow52w: 100 });
  assert.deepStrictEqual(u.rangePosition(null, 100), { fromHigh52w: null, fromLow52w: null });
});

test('valuation leaves out KES-price ratios for companies reporting in another currency', () => {
  const v = u.valuation({ eps: 120, dps: 53, sharesOutstanding: 1e9 }, 58.75, { equity: 1e11 }, 'RWF');
  assert.deepStrictEqual(v, { pe: null, pb: null, roe: null, payoutRatio: 44.17, dividendYield: null, marketCap: 58.75e9 });
});

test('riskStats: volatility needs a year of history; drawdown is peak to trough', () => {
  const history = [];
  const d = new Date('2025-09-01T00:00:00Z');
  for (let i = 0; i < 300; i++) {
    history.push([d.toISOString().slice(0, 10), i < 150 ? 100 : 60]);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  const r = u.riskStats(history, 80, NOW);
  assert.strictEqual(r.maxDrawdown5y, -40);
  assert.strictEqual(r.maxDrawdownSince, '2025-09-01');
  assert.ok(r.volatility1y > 0);
  assert.deepStrictEqual(u.riskStats([['2026-06-01', 10]], 10, NOW), { volatility1y: null, maxDrawdown5y: null, maxDrawdownSince: null });
  // Suspended for years: no recent trades at all
  assert.deepStrictEqual(u.riskStats([['2018-01-02', 5], ['2019-03-01', 4]], 4, NOW), { volatility1y: null, maxDrawdown5y: null, maxDrawdownSince: null });
});
