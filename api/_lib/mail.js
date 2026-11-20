// Order confirmation email through Resend (only when RESEND_API_KEY is set in Vercel).
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
async function sendMail(to, subject, html) {
  if (!process.env.RESEND_API_KEY || !to) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM || 'Donutste <orders@donutste.com>', to: [to], reply_to: process.env.REPLY_TO || undefined, bcc: process.env.ORDER_BCC ? [process.env.ORDER_BCC] : undefined, subject, html }),
  }).catch(() => null);
  return !!(r && r.ok);
}
function orderEmail({ name, dayName, dateLabel, hours, addr, lines, total, discountName, discountOff, receiptUrl }) {
  const row = (a, b) => '<tr><td style="padding:10px 0;border-bottom:1px solid #E8DACB">' + a + '</td><td style="padding:10px 0;border-bottom:1px solid #E8DACB;text-align:right">' + b + '</td></tr>';
  return '<div style="background:#FBF3EA;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;color:#22130B"><div style="max-width:520px;margin:0 auto">' +
    '<p style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#7A665A;margin:0">Order confirmed</p>' +
    '<h1 style="font-family:Georgia,serif;font-weight:400;font-size:40px;line-height:1;margin:14px 0 6px;text-transform:uppercase">See you ' + esc(dayName) + '<span style="color:#FB5588">.</span></h1>' +
    '<p style="color:#7A665A;margin:0 0 24px">Thank you, ' + esc(String(name).split(' ')[0]) + '. Your box is reserved.</p>' +
    '<div style="background:#fff;border:1px solid #E8DACB;border-radius:14px;padding:18px 20px;margin-bottom:22px"><b style="font-family:Georgia,serif;font-weight:400;font-size:22px">Pickup ' + esc(dateLabel) + '</b><br><span style="color:#7A665A;font-size:14px">' + esc(hours) + '<br>' + esc(addr) + '</span></div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:14px">' + lines.map((l) => row(esc(l.qty) + ' &times; ' + esc(l.name), '$' + l.amount.toFixed(2))).join('') +
    (discountName ? row('<span style="color:#FB5588">' + esc(discountName) + '</span>', '<span style="color:#FB5588">&minus;$' + discountOff.toFixed(2) + '</span>') : '') +
    '<tr><td style="padding:14px 0;font-family:Georgia,serif;font-size:20px">Total</td><td style="padding:14px 0;text-align:right;font-family:Georgia,serif;font-size:20px">$' + total.toFixed(2) + '</td></tr></table>' +
    (receiptUrl ? '<p style="font-size:13px"><a href="' + esc(receiptUrl) + '" style="color:#22130B">View your Square receipt</a></p>' : '') +
    '<p style="font-size:13px;color:#7A665A;margin-top:22px">Please come to the counter and let us know your name and phone number. Please note: on busy days like Saturday, even with a preorder, there may be a wait for your order. But your items will be secure. We appreciate your order and support. Please know we are always doing our best, please be kind.</p>' +
    '<p style="font-size:13px;color:#22130B;margin-top:18px"><b>REFUND POLICY FOR PRE-ORDERS</b><br>Prepaid orders are non-refundable.</p>' +
    '<p style="font-size:12px;color:#7A665A;margin-top:18px"><b style="color:#22130B">DONUT CARE INSTRUCTIONS</b><br>These are all yeast based donuts and pastries, most fresh if eaten the same day. For maximum freshness beyond your order pickup day, we recommend storing in an airtight container. All donuts and items with any custard inside should be refrigerated if not eaten the same day. Some individuals do freeze the donuts they cannot eat, but we cannot guarantee same made-to-eat quality upon defrost. For best freezing outcome, freeze the same day in an airtight container or ziplock bag. Allow to defrost naturally. After storing in the refrigerator or freezer, you can let the item come to room temp naturally and, if preferred, gently heat in the microwave for 10-30 seconds.</p>' +
    '<p style="font-size:13px;color:#7A665A;margin-top:26px">Pull around to the back of Primera Towers; the entrance is just past the orange “food truck loading” sign.</p>' +
    '<p style="font-family:Georgia,serif;font-size:22px;color:#FB5588;margin-top:26px">Welcome home.</p><p style="font-size:12px;color:#7A665A">Donutste Doughnuts &amp; Coffee · Lake Mary, Florida</p></div></div>';
}
module.exports = { sendMail, orderEmail, esc };
