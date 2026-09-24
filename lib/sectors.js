// URL slug for a sector name: "Construction & Allied" → "construction-and-allied"
const sectorSlug = (sector) => sector.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

module.exports = { sectorSlug };
