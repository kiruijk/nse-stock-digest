#!/usr/bin/env node

// Used by the workflow when the bot's push is rejected because someone pushed during the
// run. The workflow saves the bot's data/ to a temp dir, resets to the remote, then runs
//   node merge-bot-data.js <saved data dir>
// to merge the bot's data into the checked-out data/ file by file, rather than as text
// (a line-level git merge can mix two market.json files, e.g. keep stale flags next to
// fresh prices). Afterwards the workflow re-renders the pages and commits again.

const fs = require('fs');
const path = require('path');

// market.json: the copy with the newer prices wins. On a tie (same prices), the one with
// fewer stale stocks: a run whose fetch failed keeps the old prices but flags them stale.
// Then the bot's.
function pickMarket(ours, bots) {
  const asOf = (d) => d?.market?.asOf || '';
  const stale = (d) => Object.values(d?.stocks || {}).filter(s => s.stale).length;
  if (asOf(bots) !== asOf(ours)) return asOf(bots) > asOf(ours) ? bots : ours;
  return stale(bots) <= stale(ours) ? bots : ours;
}

// History: union by date, the bot's close winning on the same date
function mergeHistoryRows(ours, bots) {
  const byDate = new Map(ours.map(r => [r[0], r]));
  for (const r of bots) byDate.set(r[0], r);
  return [...byDate.values()].sort((a, b) => a[0].localeCompare(b[0]));
}

// Details: the more recently fetched copy wins; the bot's on a tie
function pickDetails(ours, bots) {
  return (bots?.fetchedAt || '') >= (ours?.fetchedAt || '') ? bots : ours;
}

const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);

function mergeDir(botData, data = 'data') {
  const market = pickMarket(readJson(path.join(data, 'market.json')), readJson(path.join(botData, 'market.json')));
  fs.writeFileSync(path.join(data, 'market.json'), JSON.stringify(market, null, 2) + '\n');

  for (const file of fs.readdirSync(path.join(botData, 'history'))) {
    const rows = mergeHistoryRows(readJson(path.join(data, 'history', file)) || [], readJson(path.join(botData, 'history', file)));
    fs.writeFileSync(path.join(data, 'history', file), `[\n${rows.map(r => JSON.stringify(r)).join(',\n')}\n]\n`);
  }

  for (const file of fs.readdirSync(path.join(botData, 'details'))) {
    const details = pickDetails(readJson(path.join(data, 'details', file)), readJson(path.join(botData, 'details', file)));
    fs.writeFileSync(path.join(data, 'details', file), JSON.stringify(details, null, 2) + '\n');
  }
  console.log(`Merged the bot's data from ${botData} (market.json prices as of ${market?.market?.asOf || 'unknown'})`);
}

if (require.main === module) {
  if (!process.argv[2]) {
    console.error('Usage: node merge-bot-data.js <saved data dir>');
    process.exit(1);
  }
  mergeDir(process.argv[2]);
}

module.exports = { pickMarket, mergeHistoryRows, pickDetails, mergeDir };
