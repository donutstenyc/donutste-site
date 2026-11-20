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

// Day sections on the Menu page. A Square category whose name starts with a weekday (e.g. "Friday Cinnamon Rolls")
// fills that day's section. A weekday shows on the site when the main location has hours that day OR items in its category.
const DAYS = [
  { key: 'Mon', name: 'Monday', dow: 1, match: /^mon(day)?\b/i, sq: 'MON' },
  { key: 'Tue', name: 'Tuesday', dow: 2, match: /^tue(s(day)?)?\b/i, sq: 'TUE' },
  { key: 'Wed', name: 'Wednesday', dow: 3, match: /^wed(nesday)?\b/i, sq: 'WED' },
  { key: 'Thu', name: 'Thursday', dow: 4, match: /^thu(rs(day)?)?\b/i, sq: 'THU' },
  { key: 'Fri', name: 'Friday', dow: 5, match: /^fri(day)?\b/i, sq: 'FRI' },
  { key: 'Sat', name: 'Saturday', dow: 6, match: /^sat(urday)?\b/i, sq: 'SAT' },
  { key: 'Sun', name: 'Sunday', dow: 0, match: /^sun(day)?\b/i, sq: 'SUN' },
  { key: 'Pop', name: 'Pop-up', popup: true, match: /^(rotating\s+)?pop[\s-]?ups?$/i },
  // Holiday pre-order: Square category "Thanksgiving Pre-Order". Pickup on Thanksgiving Day (4th Thursday of November),
  // 7:30-9:30 AM. Shows only until Thanksgiving, then disappears on its own.
  { key: 'Tgv', name: 'Thanksgiving', special: true, match: /thanksgiving\s*pre-?order/i, hours: '7:30 AM – 9:30 AM',
    dateFor: (y) => { const d = new Date(Date.UTC(y, 10, 1)); const first = (4 - d.getUTCDay() + 7) % 7; return y + '-11-' + String(1 + first + 21).padStart(2, '0'); } },
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

// "Classic Cinnamon Roll - Saturday Preorder 11/14 (contains dairy & meat)" ->
// { name: "Classic Cinnamon Roll", tag: "Contains dairy & meat", date: "2026-11-14" }
function cleanName(raw) {
  let name = raw, tag = '', date = null;
  const p = name.match(/\((contains[^)]*)\)/i);
  if (p) { tag = p[1].charAt(0).toUpperCase() + p[1].slice(1); name = name.replace(p[0], ''); }
  const md = name.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (md) {
    const now = new Date(); let y = md[3] ? +(md[3].length === 2 ? '20' + md[3] : md[3]) : now.getFullYear();
    // a December date seen in January belongs to last year
    if (!md[3] && +md[1] === 12 && now.getMonth() === 0) y -= 1;
    date = y + '-' + String(md[1]).padStart(2, '0') + '-' + String(md[2]).padStart(2, '0');
  }
  name = name.replace(/\s*[-–]\s*(mon|tues|wednes|thurs|fri|satur|sun)day\b.*$/i, '')
    .replace(/\s*[-–]\s*(pop[\s-]?up|pre-?order|pickup|pick up)\b.*$/i, '')
    .replace(/\s{2,}/g, ' ').trim();
  return { name, tag, date };
}

// Builds the live menu: items per day + pickup hours from the location's business hours.
async function getMenu(debug) {
  const PID0 = POPUP_LOCATION_ID();
  const [objs, loc, ploc] = await Promise.all([
    listAll('ITEM,CATEGORY,IMAGE'),
    sq('/v2/locations/' + LOCATION_ID()),
    PID0 !== LOCATION_ID() ? sq('/v2/locations/' + PID0).catch(() => null) : Promise.resolve(null),
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
    // Only what is switched on for Square Online right now (Square: Item > Online visibility).
    if (!debug && d.ecom_visibility !== 'VISIBLE') return;
    const catIds = (d.categories || []).map((c) => c.id).concat(d.category_id ? [d.category_id] : []);
    const days = [...new Set(catIds.map((c) => dayOfCat[c]).filter(Boolean))];
    // Bottled drinks: Square categories starting with "Bottled" (Bottled Coffee / Matcha / Refresher / Drinks).
    // They are not tied to one day: switched on for Square Online, they show as add-ons on every regular pickup day.
    const isBottle = catIds.some((c) => /^bottled\b/i.test((cats[c] || '').trim()));
    if (isBottle && !days.length) days.push('*B');
    if (!days.length) { if (debug && d.ecom_visibility === 'VISIBLE') (globalThis.__nod = globalThis.__nod || []).push(d.name + ' [' + catIds.map((c) => cats[c]).join(', ') + ']'); return; }
    const vars = (d.variations || []).filter((v) => !v.is_deleted && here(v)).map((v) => {
      const vd = v.item_variation_data || {};
      const ov = (vd.location_overrides || []).find((x) => x.location_id === L.id) || {};
      return { id: v.id, name: vd.name || '', cents: vd.price_money ? Number(vd.price_money.amount) : null, soldOut: !!ov.sold_out };
    }).filter((v) => v.cents != null);
    if (!vars.length) return;
    const special = days.filter((k) => (DAYS.find((x) => x.key === k) || {}).special);
    if (special.length) {
      const raw0 = cleanName((d.name || '').trim()).name.replace(/thanks\s+giving/ig, 'Thanksgiving');
      const imgId0 = (d.image_ids || [])[0];
      vars.forEach((vv) => items.push({
        id: o.id, varId: vv.id, group: raw0, opt: vv.name.replace(/^quantity:\s*/i, ''), name: raw0 + (vars.length > 1 ? ' · ' + vv.name.replace(/^quantity:\s*/i, '') : ''),
        desc: (d.description_plaintext || d.description || '').trim(), price: vv.cents / 100, soldOut: vv.soldOut,
        img: imgId0 ? imgs[imgId0] || null : null, days: special, ord: 0,
      }));
      return;
    }
    const v = vars.find((x) => !x.soldOut) || vars[0];
    const imgId = (d.image_ids || [])[0];
    const raw = (d.name || '').trim();
    const nm = cleanName(raw);
    items.push({
      id: o.id, varId: v.id, name: nm.name, tag: nm.tag || undefined, desc: (d.description_plaintext || d.description || '').trim(),
      price: v.cents / 100, soldOut: vars.every((x) => x.soldOut), img: imgId ? imgs[imgId] || null : null, days, bottle: isBottle || undefined,
      ord: (d.categories || [])[0] && (d.categories || [])[0].ordinal || 0,
      _dbg: { ev: d.ecom_visibility, ea: d.ecom_available, vis: d.visibility, ao: d.available_online, ap: d.available_for_pickup, ch: d.channels, ap_ids: d.availability_period_ids, pt: d.product_type, upd: o.updated_at, vtrack: (d.variations||[]).map(v=>{const vd=v.item_variation_data||{};return [vd.track_inventory, vd.sellable, vd.stockable, (vd.location_overrides||[]).map(x=>x.location_id.slice(0,4)+':'+(x.sold_out?'SO':'')+(x.track_inventory?'T':''))]}) },
    });
  });

  const hours = {};
  ((L.business_hours && L.business_hours.periods) || []).forEach((p) => {
    const d = DAYS.find((d) => d.sq === p.day_of_week); if (!d) return;
    hours[d.key] = (hours[d.key] ? hours[d.key] + ', ' : '') + fmtTime(p.start_local_time) + ' – ' + fmtTime(p.end_local_time);
  });
  // Manual pickup hours (hours.json) win over the location's business hours, e.g. "11:30 AM – 1:30 PM".
  try { const H = require('../../hours.json'); Object.keys(H).forEach((k) => { if (H[k]) hours[k] = H[k]; }); } catch (_) {}
  const tz0 = L.timezone || 'America/New_York', today0 = todayIn(tz0), special = {};
  DAYS.filter((x) => x.special).forEach((x) => {
    const dt = x.dateFor(+today0.slice(0, 4)); if (today0 > dt) return;
    special[x.key] = dt;
    // Pickup window comes from the item description in Square, e.g. "Pick-Up on Thanks Giving from 9am -10am".
    const it = items.find((i) => i.days.includes(x.key) && /\d\s*(am|pm)\s*[-–]/i.test(i.desc || ''));
    const mm = it && it.desc.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[-–to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    const f = (h, m, ap) => h + (m ? ':' + m : '') + ' ' + ap.toUpperCase();
    hours[x.key] = mm ? f(mm[1], mm[2], mm[3]) + ' – ' + f(mm[4], mm[5], mm[6]) : x.hours;
  });
  const a = L.address || {};
  // Pop-up: date, hours and place come from the pop-up location's business hours + address in Square.
  let popup = null;
  const P = ploc && ploc.location;
  if (P) {
    const tz = P.timezone || L.timezone || 'America/New_York';
    const per = (P.business_hours && P.business_hours.periods) || [];
    const today = todayIn(tz);
    const codes = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    for (let k = 1; k <= 14 && !popup; k++) {
      const [y, m, d] = today.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d + k));
      const ps = per.filter((p) => p.day_of_week === codes[dt.getUTCDay()]);
      if (ps.length) {
        const pa = P.address || {};
        popup = {
          date: dt.toISOString().slice(0, 10),
          hours: ps.map((p) => fmtTime(p.start_local_time) + ' – ' + fmtTime(p.end_local_time)).join(', '),
          start: ps[0].start_local_time.slice(0, 5),
          place: '',
          addr: [pa.address_line_1, pa.locality].filter(Boolean).join(', '),
        };
      }
    }
  }
  if (!debug) items.forEach((i) => delete i._dbg);
  // Bottles go on every regular (not holiday, not pop-up) day that is open or has items.
  const regDays = DAYS.filter((d) => !d.special && !d.popup && (hours[d.key] || items.some((i) => !i.bottle && i.days.includes(d.key)))).map((d) => d.key);
  const bottles = [];
  items.forEach((i) => { if (i.days.includes('*B')) { i.days = regDays.slice(); bottles.push({ name: i.name, desc: i.desc, price: i.price, img: i.img, soldOut: i.soldOut }); } });
  for (let k = items.length - 1; k >= 0; k--) if (!items[k].days.length) items.splice(k, 1);
  // Each flavor once per day: keep the in-stock version if there are duplicates.
  const seen = {};
  const uniq = [];
  items.forEach((it) => it.days.forEach((dk) => {
    const k = dk + '|' + it.name.toLowerCase();
    if (seen[k] && (!seen[k].soldOut || it.soldOut)) return;
    const copy = Object.assign({}, it, { days: [dk] });
    if (seen[k]) uniq.splice(uniq.indexOf(seen[k]), 1, copy); else uniq.push(copy);
    seen[k] = copy;
  }));
  items.length = 0; uniq.forEach((x) => { const sd = DAYS.find((d) => d.key === x.days[0]); if (sd && sd.special && !special[sd.key]) return; items.push(x); });
  const noDay = debug ? (globalThis.__nod || []) : undefined; globalThis.__nod = [];
  return {
    popup,
    noDay, cats: debug ? Object.values(cats) : undefined,
    items,
    bottles,
    hours,
    timezone: L.timezone || 'America/New_York',
    address: [a.address_line_1, a.address_line_2, a.locality].filter(Boolean).join(', '),
    days: DAYS.filter((d) => d.special ? (special[d.key] && items.some((i) => i.days.includes(d.key))) : (d.popup || hours[d.key] || items.some((i) => i.days.includes(d.key))))
      .map(({ key, name, dow, popup, special: sp }) => ({ key, name, dow, popup: !!popup, special: !!sp, date: sp ? special[key] : undefined }))
      .sort((a, b) => b.special - a.special),
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
