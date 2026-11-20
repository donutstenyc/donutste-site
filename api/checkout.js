// Creates a Square order for the EXACT pickup date the customer chose, then charges it.
// Prices always come from Square (catalog ids), never from the browser.
const { sq, LOCATION_ID, POPUP_LOCATION_ID, uid, getMenu, zonedISO, todayIn, send, readBody } = require('./_lib/square');
const manualPopup = require('../popup.json');
const MAX_DAYS_AHEAD = 21;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const b = await readBody(req);
    const { day, date, lines, name, email, phone, sourceId, verificationToken } = b;
    if (!sourceId) return send(res, 400, { error: 'Payment details missing.' });
    if (!name || !email || !phone) return send(res, 400, { error: 'Please add your name, email and phone.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return send(res, 400, { error: 'Pickup date missing.' });

    const menu = await getMenu();
    const popup = (manualPopup && manualPopup.date ? manualPopup : menu.popup) || {};
    const tz = menu.timezone;
    const D = menu.days.find((d) => d.key === day);
    if (!D) return send(res, 400, { error: 'Unknown pickup day.' });

    // The date must be a real upcoming pickup day (strictly after today, matching the weekday, or the pop-up date).
    const today = todayIn(tz);
    if (date <= today) return send(res, 400, { error: 'That pickup day has closed for orders. Please choose the next one.' });
    const [y, m, d] = date.split('-').map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (D.popup) { if (!popup.date || popup.date !== date) return send(res, 400, { error: 'This pop-up is not taking orders.' }); }
    else if (wd !== D.dow) return send(res, 400, { error: 'Pickup date does not match the day.' });
    if ((Date.UTC(y, m - 1, d) - Date.parse(today)) / 864e5 > MAX_DAYS_AHEAD) return send(res, 400, { error: 'That date is too far ahead.' });

    const byVar = {}; menu.items.forEach((it) => { if (it.days.includes(day) && !it.soldOut) byVar[it.varId] = it; });
    const items = (Array.isArray(lines) ? lines : []).filter((l) => byVar[l.varId] && Number(l.qty) > 0 && Number(l.qty) <= 50);
    if (!items.length || items.length !== (lines || []).length) return send(res, 400, { error: 'Something in your box is no longer available for this day. Please refresh the menu.' });

    // Pickup time = the start of that day's hours (from Square), or the pop-up start.
    let start = '09:00';
    const h = D.popup ? popup.start : null;
    if (h) start = h;
    else if (menu.hours[day]) { const mm = menu.hours[day].match(/(\d+)(?::(\d+))?\s*(AM|PM)/); if (mm) { let H = +mm[1] % 12 + (mm[3] === 'PM' ? 12 : 0); start = String(H).padStart(2, '0') + ':' + (mm[2] || '00'); } }
    const pickupAt = zonedISO(date, start, tz);
    const LOC = D.popup ? POPUP_LOCATION_ID() : LOCATION_ID();

    const order = await sq('/v2/orders', { method: 'POST', body: {
      idempotency_key: uid(),
      order: {
        location_id: LOC,
        reference_id: 'web-' + date,
        source: { name: 'donutste.com' },
        line_items: items.map((l) => ({ catalog_object_id: l.varId, quantity: String(Math.floor(l.qty)) })),
        fulfillments: [{
          type: 'PICKUP', state: 'PROPOSED',
          pickup_details: {
            schedule_type: 'SCHEDULED', pickup_at: pickupAt,
            note: 'Pickup ' + D.name + ' ' + date + (D.popup && popup.place ? ' at ' + popup.place : ''),
            recipient: { display_name: String(name).slice(0, 255), email_address: String(email).slice(0, 255), phone_number: String(phone).slice(0, 32) },
          },
        }],
      },
    } });
    const o = order.order;

    const pay = await sq('/v2/payments', { method: 'POST', body: {
      idempotency_key: uid(), source_id: sourceId, verification_token: verificationToken || undefined,
      amount_money: o.total_money, order_id: o.id, location_id: LOC,
      buyer_email_address: email, note: 'Donutste pre-order, pickup ' + date, autocomplete: true,
    } }).catch(async (e) => {
      // Payment failed: cancel the open order so it never shows as a real pickup.
      try { await sq('/v2/orders/' + o.id, { method: 'PUT', body: { idempotency_key: uid(), order: { location_id: LOC, version: o.version, state: 'CANCELED' } } }); } catch (_) {}
      throw e;
    });

    send(res, 200, { ok: true, orderId: o.id, total: Number(o.total_money.amount) / 100, receiptUrl: pay.payment && pay.payment.receipt_url, pickupAt });
  } catch (e) {
    console.error('checkout', e.message, JSON.stringify(e.square || ''));
    const card = e.square && e.square.find((x) => x.category === 'PAYMENT_METHOD_ERROR');
    send(res, card ? 402 : 500, { error: card ? 'Your card was declined. Please try another card.' : 'We couldn’t place the order. Please try again.' });
  }
};
