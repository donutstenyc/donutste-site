// Sells a Donutste digital gift card for the exact amount chosen ($10–$500).
// 1) charge the card  2) create a DIGITAL gift card  3) ACTIVATE it for that amount.
const { sq, LOCATION_ID, uid, send, readBody } = require('./_lib/square');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const { cents, sourceId, verificationToken, buyerName, buyerEmail, toName, toEmail, message } = await readBody(req);
    const amt = Math.round(Number(cents));
    if (!(amt >= 1000 && amt <= 50000)) return send(res, 400, { error: 'Choose an amount from $10 to $500.' });
    if (!sourceId || !buyerEmail) return send(res, 400, { error: 'Please add your email and card.' });
    const money = { amount: amt, currency: 'USD' };
    const pay = await sq('/v2/payments', { method: 'POST', body: {
      idempotency_key: uid(), source_id: sourceId, verification_token: verificationToken || undefined,
      amount_money: money, location_id: LOCATION_ID(), buyer_email_address: buyerEmail,
      note: 'Donutste gift card' + (toName ? ' for ' + String(toName).slice(0, 60) : ''), autocomplete: true,
    } });
    const gc = await sq('/v2/gift-cards', { method: 'POST', body: { idempotency_key: uid(), location_id: LOCATION_ID(), gift_card: { type: 'DIGITAL' } } });
    await sq('/v2/gift-cards/activities', { method: 'POST', body: { idempotency_key: uid(), gift_card_activity: {
      type: 'ACTIVATE', location_id: LOCATION_ID(), gift_card_id: gc.gift_card.id,
      activate_activity_details: { amount_money: money, buyer_payment_instrument_ids: [pay.payment.id] },
    } } });
    const gan = gc.gift_card.gan;
    // Optional email to the recipient/buyer through Resend (only if RESEND_API_KEY is set).
    if (process.env.RESEND_API_KEY) {
      const to = [toEmail || buyerEmail].filter(Boolean);
      const html = '<div style="font-family:Georgia,serif;color:#22130B"><h1 style="font-weight:400">A Donutste gift card' + (toName ? ' for ' + esc(toName) : '') + '</h1>' +
        '<p style="font-size:28px">$' + (amt / 100).toFixed(2) + '</p><p>Card number<br><b style="font-size:20px;letter-spacing:2px">' + gan.replace(/(\d{4})/g, '$1 ').trim() + '</b></p>' +
        (message ? '<p><i>' + esc(message) + '</i>' + (buyerName ? '<br>— ' + esc(buyerName) : '') + '</p>' : '') +
        '<p>Use it at checkout on donutste.com or show it at the counter.<br>Welcome home.</p></div>';
      await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: process.env.MAIL_FROM || 'Donutste <orders@donutste.com>', to, cc: toEmail && buyerEmail !== toEmail ? [buyerEmail] : undefined, subject: 'Your Donutste gift card', html }) }).catch(() => {});
    }
    send(res, 200, { ok: true, gan, cents: amt, receiptUrl: pay.payment.receipt_url });
  } catch (e) {
    console.error('gift-card', e.message, JSON.stringify(e.square || ''));
    const card = e.square && e.square.find((x) => x.category === 'PAYMENT_METHOD_ERROR');
    send(res, card ? 402 : 500, { error: card ? 'Your card was declined. Please try another card.' : 'We couldn’t create the gift card. You were not charged twice; please contact us if you see a charge.' });
  }
};
function esc(s) { return String(s).slice(0, 400).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
