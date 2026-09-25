const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { pickMarket, mergeHistoryRows, pickDetails, mergeDir } = require('../merge-bot-data');

test('pickMarket keeps the copy with newer prices, so a stale bot run never overwrites fresh data', () => {
  const fresh = { market: { asOf: '2026-09-25T14:28:12+00:00' }, stocks: { A: { stale: false } } };
  const stale = { market: { asOf: '2026-09-24T12:32:13+00:00' }, stocks: { A: { stale: true } } };
  assert.strictEqual(pickMarket(fresh, stale), fresh);
  assert.strictEqual(pickMarket(stale, fresh), fresh);
  assert.strictEqual(pickMarket(fresh, { ...fresh }).market, fresh.market); // tie: bot's copy
});

test('mergeHistoryRows unions by date with the bot winning ties', () => {
  assert.deepStrictEqual(
    mergeHistoryRows([['2026-09-23', 1], ['2026-09-24', 2]], [['2026-09-24', 2.5], ['2026-09-25', 3]]),
    [['2026-09-23', 1], ['2026-09-24', 2.5], ['2026-09-25', 3]]
  );
});

test('pickDetails keeps the more recently fetched copy', () => {
  const older = { fetchedAt: '2026-09-20T00:00:00Z' };
  const newer = { fetchedAt: '2026-09-25T00:00:00Z' };
  assert.strictEqual(pickDetails(newer, older), newer);
  assert.strictEqual(pickDetails(older, newer), newer);
  assert.strictEqual(pickDetails(null, older), older);
});

test('mergeDir merges a saved bot data dir into data/', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-'));
  const mk = (dir, market, hist, det) => {
    fs.mkdirSync(path.join(dir, 'history'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'details'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'market.json'), JSON.stringify(market));
    fs.writeFileSync(path.join(dir, 'history', 'a.json'), JSON.stringify(hist));
    fs.writeFileSync(path.join(dir, 'details', 'a.json'), JSON.stringify(det));
  };
  const ours = path.join(tmp, 'data');
  const bots = path.join(tmp, 'bot');
  mk(ours, { market: { asOf: '2026-09-25' } }, [['2026-09-24', 1]], { fetchedAt: '2026-09-25' });
  mk(bots, { market: { asOf: '2026-09-24' } }, [['2026-09-25', 2]], { fetchedAt: '2026-09-24' });
  mergeDir(bots, ours);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(ours, 'market.json'))).market.asOf, '2026-09-25');
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(ours, 'history', 'a.json'))), [['2026-09-24', 1], ['2026-09-25', 2]]);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(ours, 'details', 'a.json'))).fetchedAt, '2026-09-25');
});
