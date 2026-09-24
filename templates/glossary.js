// Plain-English explanations of the figures on the site, shown as tooltips on hover (or
// tap/focus on phones). One definition per figure, used by every page; update-stocks.js
// also injects GLOSSARY into index.html for the dashboard's script.

const GLOSSARY = {
  marketCap: 'Market capitalization: the total value of all shares, share price × shares outstanding.',
  pe: 'Price-to-earnings: share price ÷ earnings per share. Roughly how many years of current profits the price pays for; lower can mean cheaper.',
  pb: 'Price-to-book: market cap ÷ shareholders\' equity. Below 1× means the market values the company at less than its net assets.',
  dividendYield: 'Dividend yield: dividend per share ÷ share price. The yearly cash return from dividends at today\'s price.',
  eps: 'Earnings per share: net profit ÷ number of shares, from the latest reported results.',
  dps: 'Dividend per share: cash paid out per share, from the latest reported dividends.',
  range52w: '52-week range: the lowest and highest closing price over the past year.',
  payoutRatio: 'Payout ratio: dividend per share ÷ earnings per share. Above 100% means paying out more than it earns, which may not last.',
  roe: 'Return on equity: net profit ÷ shareholders\' equity. How much profit the company makes on shareholders\' money.',
  turnover: 'Average value of shares traded per session over the last 3 months. Under KES 1M is thinly traded: prices can be stale and positions hard to buy or sell.',
  fromHigh52w: 'How far the price is below its highest close of the past year.',
  volatility: 'How much the price typically swings in a year (annualized standard deviation of daily moves). Higher means a bumpier ride.',
  maxDrawdown: 'The largest fall from a peak to a later low over the last 5 years.',
  volume: 'Number of shares traded in the latest session.',
  nasi: 'NSE All Share Index: tracks the value of every stock listed on the Nairobi Securities Exchange.'
};

// Tooltip styles, shared by every page (appended to the nav CSS). `.tip-right` anchors the
// bubble to the label's right edge, for right-aligned labels such as number columns.
const TIP_CSS = `
.tip {
  position: relative;
  cursor: help;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
}

.tip:hover::after,
.tip:focus::after {
  content: attr(data-tip);
  position: absolute;
  left: 0;
  top: calc(100% + 6px);
  z-index: 30;
  width: max-content;
  max-width: 240px;
  padding: 0.45rem 0.6rem;
  border-radius: 6px;
  background: #1f2937;
  color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.4;
  letter-spacing: normal;
  text-align: left;
  text-transform: none;
  white-space: normal;
}

.tip-right:hover::after,
.tip-right:focus::after {
  left: auto;
  right: 0;
}

.tip:focus {
  outline: none;
}

/* Phones: the explanation shows as a bar along the bottom of the screen, so it never runs
   off the edge whichever column the label is in */
@media (max-width: 600px) {
  .tip:hover::after,
  .tip:focus::after {
    position: fixed;
    left: 12px;
    right: 12px;
    top: auto;
    bottom: 12px;
    width: auto;
    max-width: none;
    font-size: 0.85rem;
    padding: 0.7rem 0.85rem;
  }
}
`;

const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Label with its explanation as a tooltip; plain label when there's no definition
function tip(label, key, align = 'left') {
  const text = GLOSSARY[key];
  if (!text) return label;
  return `<span class="tip${align === 'right' ? ' tip-right' : ''}" tabindex="0" data-tip="${escapeAttr(text)}">${label}</span>`;
}

module.exports = { GLOSSARY, TIP_CSS, tip };
