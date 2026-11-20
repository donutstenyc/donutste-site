// Quick live check that each Square connection works. Returns only yes/no and counts, never card numbers.
const { sq, LOCATION_ID, send } = require('./_lib/square');
module.exports = async (req, res) => {
  const out = {};
  const t = async (k, f) => { try { out[k] = await f(); } catch (e) { out[k] = 'ERROR: ' + e.message; } };
  await t('location', async () => (await sq('/v2/locations/' + LOCATION_ID())).location.name);
  await t('catalog', async () => ((await sq('/v2/catalog/list?types=CATEGORY')).objects || []).length + ' categories');
  await t('giftCards', async () => { const j = await sq('/v2/gift-cards?limit=50'); const c = j.gift_cards || []; return c.length + (j.cursor ? '+' : '') + ' gift cards found (' + c.filter((g) => g.state === 'ACTIVE').length + ' active)'; });
  await t('giftCardLookup', async () => { try { await sq('/v2/gift-cards/from-gan', { method: 'POST', body: { gan: '7783320000000000' } }); return 'ok'; } catch (e) { return e.status === 404 ? 'ok (test number not found, as expected)' : 'ERROR: ' + e.message; } });
  await t('discounts', async () => ((await sq('/v2/catalog/list?types=DISCOUNT')).objects || []).filter((o) => !o.is_deleted).map((o) => o.discount_data.name + ' (' + o.discount_data.discount_type + ')'));
  send(res, 200, out);
};
