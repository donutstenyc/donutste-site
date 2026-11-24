// Creates a Square order for the EXACT pickup date the customer chose, then charges it.
// Prices always come from Square (catalog ids), never from the browser.
const { sq, LOCATION_ID, POPUP_LOCATION_ID, uid, getMenu, zonedISO, todayIn, nowIn, endOfHours, send, readBody } = require('./_lib/square');
const manualPopup = require('../popup.json');
const { findDiscount } = require('./_lib/discount');
const { sendMail, orderEmail } = require('./_lib/mail');
const MAX_DAYS_AHEAD = 45;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const b = await readBody(req);
    const { day, date, lines, name, email, phone, sourceId, verificationToken, code } = b;
    if (!sourceId && !code) return send(res, 400, { error: 'Payment details missing.' });
    if (!name || !email || !phone) return send(res, 400, { error: 'Please add your name, email and phone.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return send(res, 400, { error: 'Pickup date missing.' });

    const menu = await getMenu();
    const popup = (manualPopup && manualPopup.date ? manualPopup : menu.popup) || {};
    const tz = menu.timezone;
    const D = menu.days.find((d) => d.key === day);
    if (!D) return send(res, 400, { error: 'Unknown pickup day.' });

    // The date must be a real upcoming pickup day (matching the weekday, or the pop-up date).
    // Today still counts until that day's pickup hours have ended.
    const today = todayIn(tz), nowHM = nowIn(tz);
    const endToday = D.popup ? popup.end || endOfHours(popup.hours) : endOfHours(menu.hours[day]);
    if (date < today || (date === today && !(endToday && nowHM < endToday))) return send(res, 400, { error: 'That pickup day has closed for orders. Please choose the next one.' });
    const [y, m, d] = date.split('-').map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (D.popup) { if (!popup.date || popup.date !== date) return send(res, 400, { error: 'This pop-up is not taking orders.' }); }
    else if (D.special) { if (D.date !== date) return send(res, 400, { error: 'Pickup date does not match the day.' }); }
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
    // Same-day order after the start time: pick up as soon as possible (now + 15 min), still within the hours.
    if (date === today && start <= nowHM) { const t = new Date(Date.now() + 15 * 60e3); start = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(t); }
    const pickupAt = zonedISO(date, start, tz);
    const LOC = D.popup ? POPUP_LOCATION_ID() : LOCATION_ID();

    let disc = null;
    if (code) { disc = await findDiscount(code, LOC); if (!disc) return send(res, 400, { error: 'That discount code isn’t valid.' }); }
    const order = await sq('/v2/orders', { method: 'POST', body: {
      idempotency_key: uid(),
      order: {
        location_id: LOC,
        reference_id: 'web-' + date,
        source: { name: 'donutste.com' },
        line_items: items.map((l) => ({ catalog_object_id: l.varId, quantity: String(Math.floor(l.qty)) })),
        discounts: disc ? [{ catalog_object_id: disc.id, scope: 'ORDER' }] : undefined,
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

    const confirm = async (receiptUrl) => {
      try {
        const [yy, mo, dd] = date.split('-').map(Number);
        const dateLabel = new Date(Date.UTC(yy, mo - 1, dd)).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
        const disc0 = (o.discounts || [])[0];
        await sendMail(email, 'Your Donutste order · pickup ' + dateLabel, orderEmail({
          name, dayName: D.popup ? 'at the pop-up' : D.name, dateLabel,
          hours: D.popup ? (popup.hours || '') : (menu.hours[day] || ''),
          addr: D.popup ? (popup.addr || '') : (menu.address || ''),
          lines: (o.line_items || []).map((l) => ({ qty: l.quantity, name: l.name, amount: Number(l.gross_sales_money.amount) / 100 })),
          total: Number(o.total_money.amount) / 100,
          discountName: disc0 && disc0.name, discountOff: Number((o.total_discount_money || {}).amount || 0) / 100, receiptUrl,
        }));
      } catch (e) { console.error('mail', e.message); }
    };
    if (Number(o.total_money.amount) === 0) {
      // Fully discounted: close the order with no charge.
      await sq('/v2/orders/' + o.id + '/pay', { method: 'POST', body: { idempotency_key: uid(), order_version: o.version, payment_ids: [] } });
      await confirm('');
      return send(res, 200, { ok: true, orderId: o.id, total: 0, receiptUrl: '', pickupAt });
    }
    if (!sourceId) {
      try { await sq('/v2/orders/' + o.id, { method: 'PUT', body: { idempotency_key: uid(), order: { location_id: LOC, version: o.version, state: 'CANCELED' } } }); } catch (_) {}
      return send(res, 400, { error: 'Please add a card to pay the rest.' });
    }
    const pay = await sq('/v2/payments', { method: 'POST', body: {
      idempotency_key: uid(), source_id: sourceId, verification_token: verificationToken || undefined,
      amount_money: o.total_money, order_id: o.id, location_id: LOC,
      buyer_email_address: email, note: 'Donutste pre-order, pickup ' + date, autocomplete: true,
    } }).catch(async (e) => {
      // Payment failed: cancel the open order so it never shows as a real pickup.
      try { await sq('/v2/orders/' + o.id, { method: 'PUT', body: { idempotency_key: uid(), order: { location_id: LOC, version: o.version, state: 'CANCELED' } } }); } catch (_) {}
      throw e;
    });

    await confirm(pay.payment && pay.payment.receipt_url);
    send(res, 200, { ok: true, orderId: o.id, total: Number(o.total_money.amount) / 100, receiptUrl: pay.payment && pay.payment.receipt_url, pickupAt });
  } catch (e) {
    console.error('checkout', e.message, JSON.stringify(e.square || ''));
    const card = e.square && e.square.find((x) => x.category === 'PAYMENT_METHOD_ERROR');
    const low = e.square && e.square.find((x) => x.code === 'INSUFFICIENT_FUNDS');
    send(res, card ? 402 : 500, { error: low ? 'There isn’t enough on that card to cover this order.' : card ? 'Your card was declined. Please try another card.' : 'We couldn’t place the order. Please try again.' });
  }
};
