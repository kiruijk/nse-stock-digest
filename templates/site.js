// Shared site chrome: top navigation bar and footer links, used by every generated page
// and injected into index.html by update-stocks.js. `base` is the path back to the site
// root: '' for pages at the root, '../' for pages in stocks/ and sectors/.

const { sectorSlug } = require('../lib/sectors');

const NAV_CSS = `
.site-nav {
  background: #0d3b2e;
  color: white;
  font-size: 0.88rem;
}

.site-nav-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0.55rem 1rem;
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.site-nav a {
  color: #bfe8d4;
  text-decoration: none;
  font-weight: 600;
  white-space: nowrap;
}

.site-nav a:hover,
.site-nav a.current {
  color: white;
}

.site-nav .brand {
  color: white;
  font-weight: 800;
  margin-right: auto;
  letter-spacing: -0.01em;
}

.site-nav details {
  position: relative;
}

.site-nav summary {
  white-space: nowrap;
  cursor: pointer;
  color: #bfe8d4;
  font-weight: 600;
  list-style: none;
}

.site-nav summary::-webkit-details-marker {
  display: none;
}

.site-nav summary::after {
  content: ' ▾';
  font-size: 0.75rem;
}

.site-nav details[open] summary,
.site-nav summary:hover {
  color: white;
}

.site-nav .menu {
  position: absolute;
  right: 0;
  top: 1.9rem;
  z-index: 20;
  min-width: 230px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  padding: 0.4rem 0;
}

.site-nav .menu a {
  display: block;
  padding: 0.45rem 1rem;
  color: #1a1a1a;
  font-weight: 500;
}

.site-nav .menu a:hover {
  background: #f3f4f6;
  color: #0052cc;
}

.site-footer {
  border-top: 1px solid #e5e7eb;
  margin-top: 1rem;
  padding: 1.25rem 1rem 0.5rem;
  font-size: 0.82rem;
  line-height: 1.9;
}

.site-footer a {
  color: #4b5563;
  text-decoration: none;
  margin-right: 1rem;
  white-space: nowrap;
}

.site-footer a:hover {
  color: #0052cc;
}

.site-footer .source-note {
  color: #6b7280;
  margin-top: 0.4rem;
}

.site-footer .source-note a {
  margin-right: 0;
  text-decoration: underline;
}

.site-footer strong {
  color: #374151;
  margin-right: 0.75rem;
}

@media (max-width: 600px) {
  .site-nav-inner {
    gap: 0.9rem;
    padding: 0.5rem 0.75rem;
  }

  .site-nav .brand {
    font-size: 0.85rem;
  }

  /* The brand already links home */
  .site-nav .nav-home {
    display: none;
  }
}
`;

// current: 'dashboard' | 'sectors' | null
function renderNav(base, sectors, siteName, current = null) {
  return `  <nav class="site-nav" aria-label="Site">
    <div class="site-nav-inner">
      <a class="brand" href="${base}index.html">${siteName}</a>
      <a class="nav-home${current === 'dashboard' ? ' current' : ''}" href="${base}index.html">Dashboard</a>
      <details>
        <summary${current === 'sectors' ? ' class="current"' : ''}>Sectors</summary>
        <div class="menu">
${sectors.map(s => `          <a href="${base}sectors/${sectorSlug(s)}.html">${s.replace(/&/g, '&amp;')}</a>`).join('\n')}
        </div>
      </details>
    </div>
  </nav>`;
}

function renderFooterLinks(base, sectors, siteName) {
  return `    <nav class="site-footer" aria-label="Site links">
      <div><strong>${siteName}</strong><a href="${base}index.html">Dashboard</a></div>
      <div><strong>Sectors</strong>${sectors.map(s => `<a href="${base}sectors/${sectorSlug(s)}.html">${s.replace(/&/g, '&amp;')}</a>`).join('')}</div>
      <div class="source-note">Prices from <a href="https://afx.kwayisi.org/nse/" rel="noopener">AFX (afx.kwayisi.org)</a>. Not affiliated with the Nairobi Securities Exchange. Not investment advice.</div>
    </nav>`;
}

// Canonical URL and Open Graph URL/site name for a page at `path` (relative to the site root)
function seoTags(site, path) {
  if (!site?.url) return '';
  const url = site.url + path;
  return `  <link rel="canonical" href="${url}">
  <meta property="og:url" content="${url}">
  <meta property="og:site_name" content="${site.name}">`;
}

module.exports = { NAV_CSS, renderNav, renderFooterLinks, seoTags };
