// Shared Square helpers. Secrets live ONLY in Vercel environment variables, never in the page.
// SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, SQUARE_APPLICATION_ID, SQUARE_ENV ("production" | "sandbox")
const ENV = process.env.SQUARE_ENV === 'sandbox' ? 'sandbox' : 'production';
const BASE = ENV === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';
const VERSION = '2025-01-23';

async function sq(path, { method = 'GET', body } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + process.env.SQUARE_ACCESS_TOKEN,
      'Square-Version': VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error((j.errors && j.errors.map((x) => x.detail || x.code).join('; ')) || 'Square error ' + r.status);
    e.status = r.status; e.square = j.errors; throw e;
  }
  return j;
}

const LOCATION_ID = () => process.env.SQUARE_LOCATION_ID;
// Pop-up orders can go to a separate Square location (falls back to the main one).
const POPUP_LOCATION_ID = () => process.env.SQUARE_POPUP_LOCATION_ID || process.env.SQUARE_LOCATION_ID;
const uid = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

// Day sections on the Menu page. A Square category whose name matches one of these fills that section.
const DAYS = [
  { key: 'Wed', name: 'Wednesday', dow: 3, match: /^wed(nesday)?\b/i, sq: 'WED' },
  { key: 'Thu', name: 'Thursday', dow: 4, match: /^thu(rs(day)?)?\b/i, sq: 'THU' },
  { key: 'Sat', name: 'Saturday', dow: 6, match: /^sat(urday)?\b/i, sq: 'SAT' },
  { key: 'Pop', name: 'Pop-up', popup: true, match: /^pop[\s-]?ups?\b/i },
];

async function listAll(types) {
  let cursor, out = [];
  do {
    const j = await sq('/v2/catalog/list?types=' + types + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
    out = out.concat(j.objects || []); cursor = j.cursor;
  } while (cursor);
  return out;
}

function fmtTime(t) { // "11:30:00" -> "11:30 AM"
  const [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; const hh = h % 12 || 12;
  return hh + (m ? ':' + String(m).padStart(2, '0') : '') + ' ' + ap;
}

// Builds the live menu: items per day + pickup hours from the location's business hours.
async function getMenu() {
  const [objs, loc] = await Promise.all([
    listAll('ITEM,CATEGORY,IMAGE'),
    sq('/v2/locations/' + LOCATION_ID()),
  ]);
  const L = loc.location;
  const cats = {}, imgs = {};
  objs.forEach((o) => {
    if (o.type === 'CATEGORY' && !o.is_deleted) cats[o.id] = o.category_data.name || '';
    if (o.type === 'IMAGE') imgs[o.id] = o.image_data && o.image_data.url;
  });
  const dayOfCat = {};
  Object.keys(cats).forEach((id) => { const d = DAYS.find((d) => d.match.test(cats[id].trim())); if (d) dayOfCat[id] = d.key; });

  const atLoc = (o, id) => (o.present_at_all_locations !== false || (o.present_at_location_ids || []).includes(id)) && !(o.absent_at_location_ids || []).includes(id);
  const PID = POPUP_LOCATION_ID();
  const here = (o) => atLoc(o, L.id) || atLoc(o, PID);
  const items = [];
  objs.filter((o) => o.type === 'ITEM' && !o.is_deleted && here(o)).forEach((o) => {
    const d = o.item_data || {};
    if (d.is_archived) return;
    const catIds = (d.categories || []).map((c) => c.id).concat(d.category_id ? [d.category_id] : []);
    const days = [...new Set(catIds.map((c) => dayOfCat[c]).filter(Boolean))];
    if (!days.length) return;
    const vars = (d.variations || []).filter((v) => !v.is_deleted && here(v)).map((v) => {
      const vd = v.item_variation_data || {};
      const ov = (vd.location_overrides || []).find((x) => x.location_id === L.id) || {};
      return { id: v.id, name: vd.name || '', cents: vd.price_money ? Number(vd.price_money.amount) : null, soldOut: !!ov.sold_out };
    }).filter((v) => v.cents != null);
    if (!vars.length) return;
    const v = vars.find((x) => !x.soldOut) || vars[0];
    const imgId = (d.image_ids || [])[0];
    items.push({
      id: o.id, varId: v.id, name: (d.name || '').trim(), desc: (d.description_plaintext || d.description || '').trim(),
      price: v.cents / 100, soldOut: vars.every((x) => x.soldOut), img: imgId ? imgs[imgId] || null : null, days,
      ord: (d.categories || [])[0] && (d.categories || [])[0].ordinal || 0,
    });
  });

  const hours = {};
  ((L.business_hours && L.business_hours.periods) || []).forEach((p) => {
    const d = DAYS.find((d) => d.sq === p.day_of_week); if (!d) return;
    hours[d.key] = (hours[d.key] ? hours[d.key] + ', ' : '') + fmtTime(p.start_local_time) + ' – ' + fmtTime(p.end_local_time);
  });
  const a = L.address || {};
  return {
    items,
    hours,
    timezone: L.timezone || 'America/New_York',
    address: [a.address_line_1, a.address_line_2, a.locality].filter(Boolean).join(', '),
    days: DAYS.map(({ key, name, dow, popup }) => ({ key, name, dow, popup: !!popup })),
  };
}

// Local date "YYYY-MM-DD" + "HH:MM" in a time zone -> RFC 3339 with the right offset.
function zonedISO(dateStr, timeStr, tz) {
  const [y, m, d] = dateStr.split('-').map(Number); const [hh, mm] = timeStr.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(guess));
  const g = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const asLocal = Date.UTC(+g.year, +g.month - 1, +g.day, +g.hour % 24, +g.minute);
  return new Date(guess - (asLocal - guess)).toISOString();
}
function todayIn(tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function send(res, status, obj, cache) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', cache || 'no-store');
  res.end(JSON.stringify(obj));
}
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let s = ''; for await (const c of req) s += c; try { return JSON.parse(s || '{}'); } catch { return {}; }
}

module.exports = { sq, ENV, LOCATION_ID, POPUP_LOCATION_ID, uid, DAYS, getMenu, zonedISO, todayIn, send, readBody };
