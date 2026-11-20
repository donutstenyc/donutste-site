// Balance check from the 16-digit gift card number (GAN).
const { sq, send, readBody } = require('./_lib/square');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const { gan } = await readBody(req);
  const g = String(gan || '').replace(/\D/g, '');
  if (g.length < 10 || g.length > 20) return send(res, 400, { error: 'Check the card number.' });
  try {
    const j = await sq('/v2/gift-cards/from-gan', { method: 'POST', body: { gan: g } });
    const c = j.gift_card;
    send(res, 200, { cents: Number(c.balance_money.amount), state: c.state, last4: g.slice(-4) });
  } catch (e) { send(res, 404, { error: 'not found' }); }
};
