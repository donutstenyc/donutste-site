import sys
p=sys.argv[1];s=open(p).read()
def rep(a,b):
    global s
    assert s.count(a)==1,a[:70]; s=s.replace(a,b)
rep('<a class="pill big" id="buybtn" href="#" target="_blank" rel="noopener">','<a class="pill big" id="buybtn" href="#buy">')
rep("var BALANCE_API='';","var LIVE=!/claude|^$|localhost/.test(location.hostname)&&location.protocol!=='file:';\nvar BALANCE_API=LIVE?'/api/gift-balance':'';")
rep("function setUrl(){bb.href=SQUARE_GIFT_URL}setUrl();","bb.addEventListener('click',function(e){e.preventDefault();openBuy()});")
rep('</style>','''.gd{position:fixed;inset:0;z-index:60;display:none}.gd.show{display:block}
.gd .sh{position:absolute;inset:0;background:rgba(34,19,11,.4)}
.gd .pn{position:absolute;right:0;top:0;bottom:0;width:min(480px,100%);background:var(--cream,#FBF3EA);padding:34px clamp(20px,3vw,40px);overflow:auto;display:flex;flex-direction:column;gap:14px;color:var(--ink,#22130B)}
.gd h3{font-family:var(--display);font-weight:400;text-transform:uppercase;font-size:44px;line-height:.9;margin:0}
.gd .x{position:absolute;right:18px;top:18px;width:38px;height:38px;border-radius:50%;border:1px solid #E8DACB;background:none;cursor:pointer;font-size:18px}
.gd label{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#7A665A;display:grid;gap:6px}
.gd input,.gd textarea{font:400 15px var(--body);border:1px solid #E8DACB;border-radius:12px;padding:12px 14px;background:#fff;color:#22130B}
.gd .sub{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#7A665A;margin-top:8px}
.gd .cardf{border:1px dashed #D8C6B4;border-radius:12px;padding:16px;font-size:13px;color:#7A665A;text-align:center}
.gd .err{color:#B3261E;font-size:13px;margin:0;min-height:1em}
.gd .pay{justify-content:center;width:100%;margin:0}
.gd .gan{font-family:var(--display);font-size:30px;letter-spacing:.06em;text-align:center;border:1px solid #E8DACB;border-radius:14px;padding:16px;background:#fff}
</style>''')
rep('<footer class="wrap">','''<div class="gd" id="gd" role="dialog" aria-modal="true" aria-label="Buy a gift card"><div class="sh" data-close></div><div class="pn" id="gpn"></div></div>
<footer class="wrap">''')
rep("// balance checker",r'''// buy (Square payment -> gift card created + activated for the exact amount)
var gd=document.getElementById('gd'),gpn=document.getElementById('gpn'),SQ=null,gcard=null;
gd.addEventListener('click',function(e){if(e.target.hasAttribute('data-close'))gd.classList.remove('show')});
function loadSquare(){if(SQ)return SQ;SQ=fetch('/api/config').then(function(r){return r.json()}).then(function(c){if(!c.applicationId)throw 0;return new Promise(function(ok,no){var sc=document.createElement('script');sc.src=c.env==='sandbox'?'https://sandbox.web.squarecdn.com/v1/square.js':'https://web.squarecdn.com/v1/square.js';sc.onload=function(){ok(window.Square.payments(c.applicationId,c.locationId))};sc.onerror=no;document.head.appendChild(sc)})});SQ.catch(function(){SQ=null});return SQ}
function esc(t){return String(t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function openBuy(){var v=Math.max(10,Math.min(500,amt));
  gpn.innerHTML='<button class="x" type="button" data-close aria-label="Close">&times;</button><div class="kicker">Gift card</div><h3>$'+v+' gift card</h3>'+
  '<div class="sub">From</div><label>Your name<input id="bn" autocomplete="name"></label><label>Your email<input id="be" type="email" autocomplete="email"></label>'+
  '<div class="sub">To</div><label>Their name<input id="tn"></label><label>Their email (we send the card here)<input id="te" type="email"></label><label>Message (optional)<textarea id="tm" rows="2" maxlength="300"></textarea></label>'+
  '<div class="cardf" id="gcardbox">'+(LIVE?'Loading secure card form&hellip;':'Square secure card form appears here on donutste.com')+'</div><p class="err" id="gerr"></p>'+
  '<button class="pill big pay" type="button" id="gpay">Pay $'+v.toFixed(2)+' <i></i></button><p style="font-size:11px;color:#7A665A;margin:0;text-align:center">Payments are processed securely by Square.</p>';
  gpn.querySelector('.x').addEventListener('click',function(){gd.classList.remove('show')});gd.classList.add('show');gcard=null;
  if(LIVE)loadSquare().then(function(pay){return pay.card().then(function(c){var cb=document.getElementById('gcardbox');cb.innerHTML='';cb.style.border='0';cb.style.padding='0';return c.attach('#gcardbox').then(function(){gcard=c})})}).catch(function(){document.getElementById('gcardbox').textContent='Card form could not load. Please refresh and try again.'});
  var btn=document.getElementById('gpay'),err=document.getElementById('gerr');
  btn.addEventListener('click',function(){var bn=document.getElementById('bn').value.trim(),be=document.getElementById('be').value.trim(),tn=document.getElementById('tn').value.trim(),te=document.getElementById('te').value.trim(),tm=document.getElementById('tm').value.trim();
    if(!bn||!/.+@.+\..+/.test(be)){err.textContent='Please add your name and email.';return}
    if(te&&!/.+@.+\..+/.test(te)){err.textContent='Check their email address.';return}
    function done(g){gpn.innerHTML='<button class="x" type="button" aria-label="Close">&times;</button><div class="kicker">Sent with love</div><h3>Gift card<br><em style="font-style:italic;text-transform:none;color:var(--pink)">ready.</em></h3><p style="color:#7A665A">$'+v.toFixed(2)+(tn?' for '+esc(tn):'')+'. '+(te?'We emailed the card to '+esc(te)+' and a copy to you.':'We emailed the card to you.')+'</p><div class="sub">Card number</div><div class="gan">'+g.replace(/(\d{4})/g,'$1 ').trim()+'</div><p style="font-size:12px;color:#7A665A">Save this number. It works at checkout on donutste.com and at the counter.</p>';
      gpn.querySelector('.x').addEventListener('click',function(){gd.classList.remove('show')})}
    if(!LIVE){done('7783320000000000');return}
    if(!gcard){err.textContent='The card form is still loading.';return}
    err.textContent='';btn.disabled=true;btn.style.opacity=.6;
    gcard.tokenize().then(function(t){if(t.status!=='OK')throw {m:'Please check your card details.'};
      return fetch('/api/gift-card',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cents:v*100,sourceId:t.token,buyerName:bn,buyerEmail:be,toName:tn,toEmail:te,message:tm})})})
    .then(function(r){return r.json().then(function(j){if(!r.ok||!j.ok)throw {m:j.error};done(j.gan)})})
    .catch(function(x){err.textContent=(x&&x.m)||'Something went wrong. Please try again.';btn.disabled=false;btn.style.opacity=1})})}
// balance checker''')
open(p,'w').write(s)
