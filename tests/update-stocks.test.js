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
  const v = u.valuation({ eps: 2.5, dps: 1.5, sharesOutstanding: 1e9 }, 30);
  assert.deepStrictEqual(v, { pe: 12, dividendYield: 5, marketCap: 30e9 });
  // Loss-makers have no meaningful P/E
  assert.strictEqual(u.valuation({ eps: -1, dps: null, sharesOutstanding: null }, 10).pe, null);
  assert.deepStrictEqual(u.valuation(null, 10), { pe: null, dividendYield: null, marketCap: null });
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
