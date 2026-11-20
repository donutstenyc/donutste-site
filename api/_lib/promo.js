// Gift card bonus promos (promo.json). Dates are inclusive, in the shop's time zone.
const { todayIn } = require('./square');
let P = {}; try { P = require('../../promo.json'); } catch (_) {}
function giftBonus(cents, tz) {
  const g = P.giftBonus; if (!g) return 0;
  const today = todayIn(tz || 'America/New_York');
  if (today < g.start || today > g.end) return 0;
  return Math.floor(cents / (g.every * 100)) * g.bonus * 100;
}
module.exports = { giftBonus };
