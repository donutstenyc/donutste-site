// Mobile menu for every page: adds a "Menu" button to the header on small screens
// and opens a full-screen list of the same links as the desktop nav.
(function () {
  var h = document.querySelector('header'), bar = h && h.querySelector('.bar'), nav = h && h.querySelector('nav');
  if (!bar || !nav) return;
  var st = document.createElement('style');
  st.textContent =
    '.mnav-btn{display:none;align-items:center;justify-content:center;gap:8px;height:44px;min-width:44px;padding:0 16px;border-radius:999px;border:0;background:#FB5588;color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.18);font:600 12px/1 var(--body,system-ui);letter-spacing:.18em;text-transform:uppercase;cursor:pointer;margin-left:10px;flex:none}' +
    '.mnav-btn i{display:grid;gap:4px}.mnav-btn i b{display:block;width:16px;height:1.5px;background:currentColor}' +
    '@media (max-width:900px){.mnav-btn{display:inline-flex}header .bar{display:flex;align-items:center}header .bar .pill{margin-left:auto;font-size:13px;padding:10px 10px 10px 16px}header .bar > a:first-child img{max-height:52px;width:auto}}' +
    '@media (max-width:420px){header .bar .pill{display:none}.mnav-btn{margin-left:auto}}' +
    '.mnav{position:fixed;inset:0;z-index:200;background:#F8F1EA;color:#22130B;display:flex;flex-direction:column;justify-content:center;padding:96px 28px 48px;gap:4px;transform:translateY(-102%);transition:transform .45s cubic-bezier(.7,0,.2,1);overflow:auto}' +
    '.mnav.open{transform:none}' +
    '.mnav a{font-family:var(--display,"Instrument Serif",serif);text-transform:uppercase;font-size:clamp(40px,12vw,64px);line-height:1.02;color:#22130B;text-decoration:none;padding:4px 0}' +
    '.mnav a.on,.mnav a.cur{color:#E8608A}' +
    '.mnav .mx{position:absolute;top:22px;right:20px;width:48px;height:48px;border-radius:50%;border:1px solid #22130B;background:none;font-size:22px;color:#22130B;cursor:pointer}' +
    '.mnav .mpo{margin-top:28px;align-self:flex-start;background:#E8608A;color:#22130B;border-radius:999px;padding:16px 26px;font:500 13px/1 var(--body,system-ui);letter-spacing:.18em;text-transform:uppercase}';
  document.head.appendChild(st);
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'mnav-btn'; btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'mnav');
  btn.innerHTML = 'Menu <i><b></b><b></b></i>';
  bar.appendChild(btn);
  var m = document.createElement('div');
  m.className = 'mnav'; m.id = 'mnav'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Site menu');
  m.innerHTML = '<button type="button" class="mx" aria-label="Close menu">&times;</button><a href="/">Home</a>' +
    nav.innerHTML + '<a class="mpo" href="/menu/">Pre-order now</a>';
  document.body.appendChild(m);
  function set(o) { m.classList.toggle('open', o); btn.setAttribute('aria-expanded', o); document.documentElement.style.overflow = o ? 'hidden' : ''; }
  btn.addEventListener('click', function () { set(true); });
  m.querySelector('.mx').addEventListener('click', function () { set(false); });
  m.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
})();

// Phones: lift any text that is too small to read. Body text to at least 16px,
// small uppercase labels to at least 12px. Runs again when pages add content (menu, crate).
(function () {
  if (!matchMedia('(max-width:700px)').matches) return;
  var SKIP = '#ctl, svg, canvas, .mnav-btn, .pads, .meter';
  function lift(root) {
    var els = (root || document.body).querySelectorAll('p,li,span,a,label,small,cite,b,strong,em,i,div,dd,dt,td,th,figcaption,blockquote,h4,h5,h6,input,select,textarea,button');
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      if (e.dataset.fz || e.closest(SKIP)) continue;
      var own = false;
      for (var n = e.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.nodeValue.trim().length > 1) { own = true; break; }
      if (!own && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName)) continue;
      var cs = getComputedStyle(e), fs = parseFloat(cs.fontSize);
      var label = cs.textTransform === 'uppercase' || parseFloat(cs.letterSpacing) > 1;
      var min = label ? 12 : 16;
      if (fs < min) { e.style.fontSize = min + 'px'; if (!label) e.style.lineHeight = '1.55'; }
      e.dataset.fz = '1';
    }
  }
  function run() { lift(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  var t; new MutationObserver(function () { clearTimeout(t); t = setTimeout(run, 120); }).observe(document.body, { childList: true, subtree: true });
})();
