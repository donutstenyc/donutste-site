// Live menu from Square: items in the Wednesday / Thursday / Saturday / Pop-up categories,
// pickup hours from the location's business hours, plus the current pop-up (popup.json).
const { getMenu, send } = require('./_lib/square');
const popup = require('../popup.json');
module.exports = async (req, res) => {
  try {
    const m = await getMenu();
    m.popup = popup && popup.date ? popup : null;
    send(res, 200, m, 'public, s-maxage=60, stale-while-revalidate=300');
  } catch (e) {
    console.error('menu', e.message);
    send(res, 502, { error: 'Menu unavailable' });
  }
};
