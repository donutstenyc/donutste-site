// Finds a Square catalog Discount whose NAME matches the code a customer typed (case-insensitive).
const { sq } = require('./square');
async function findDiscount(code, locationId) {
  const c = String(code || '').trim().toLowerCase();
  if (!c || c.length > 60) return null;
  let cursor, found = null;
  do {
    const j = await sq('/v2/catalog/list?types=DISCOUNT' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
    (j.objects || []).forEach((o) => {
      if (found || o.is_deleted) return;
      const d = o.discount_data || {};
      const here = (o.present_at_all_locations !== false || (o.present_at_location_ids || []).includes(locationId)) && !(o.absent_at_location_ids || []).includes(locationId);
      const nm = (d.name || '').trim().toLowerCase(); const tail = nm.split(/\s[—–-]\s/).pop().trim();
      if (here && (nm === c || tail === c) && /^FIXED_/.test(d.discount_type || '')) found = { id: o.id, name: d.name };
    });
    cursor = j.cursor;
  } while (cursor && !found);
  return found;
}
module.exports = { findDiscount };
