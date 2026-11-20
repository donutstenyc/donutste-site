// Checks a discount code and returns the new total, priced by Square.
const { sq, LOCATION_ID, POPUP_LOCATION_ID, send, readBody } = require('./_lib/square');
const { findDiscount } = require('./_lib/discount');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const { code, day, lines } = await readBody(req);
    const LOC = day === 'Pop' ? POPUP_LOCATION_ID() : LOCATION_ID();
    const d = await findDiscount(code, LOC);
    if (!d) return send(res, 404, { error: 'That code isn’t valid.' });
    const items = (Array.isArray(lines) ? lines : []).filter((l) => l && l.varId && Number(l.qty) > 0).slice(0, 40);
    const j = await sq('/v2/orders/calculate', { method: 'POST', body: { order: {
      location_id: LOC,
      line_items: items.map((l) => ({ catalog_object_id: String(l.varId), quantity: String(Math.floor(Math.min(50, l.qty))) })),
      discounts: [{ catalog_object_id: d.id, scope: 'ORDER' }],
    } } });
    const o = j.order;
    send(res, 200, { ok: true, name: d.name, total: Number(o.total_money.amount) / 100, off: Number((o.total_discount_money || {}).amount || 0) / 100 });
  } catch (e) { console.error('discount', e.message); send(res, 500, { error: 'Couldn’t check that code. Please try again.' }); }
};
