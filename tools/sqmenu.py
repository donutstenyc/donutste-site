import sys
p=sys.argv[1];s=open(p).read()
def rep(a,b):
    global s
    assert s.count(a)==1,a[:70]; s=s.replace(a,b)
rep("var ITEMS=PREVIEW;","var LIVE=!/claude|^$|localhost/.test(location.hostname)&&location.protocol!=='file:';\nvar ITEMS=LIVE?[]:PREVIEW;var LOADING=LIVE;")
# render: loading state + sold out
rep("'<div class=\"empty\">'+(D.popup?","(LOADING?'<div class=\"empty\">Loading this week&rsquo;s menu&hellip;</div>':'<div class=\"empty\">'+(D.popup?")
rep("'Loads live from Square')+'</small></div>';","'Loads live from Square')+'</small></div>');")
rep("(d==='Wed'?'<p class=\"src\">Preview: this week&rsquo;s Wednesday flyer. Every day loads live from Square at launch.</p>':'')","(d==='Wed'&&!LIVE?'<p class=\"src\">Preview: this week&rsquo;s Wednesday flyer. Every day loads live from Square at launch.</p>':'')")
rep("function ctl(it,d){var q=","function ctl(it,d){if(it.soldOut)return '<span class=\"add\" style=\"opacity:.45;cursor:default\">Sold out</span>';var q=")
rep("+'<button type=\"button\" class=\"pill big add2\" data-d=\"'+d+'\" data-n=\"'+it.name+'\">Add to box <i></i></button>","+(it.soldOut?'':'<button type=\"button\" class=\"pill big add2\" data-d=\"'+d+'\" data-n=\"'+it.name+'\">Add to box <i></i></button>')")
# checkout
a=s.index("document.getElementById('cobtn').addEventListener");b=s.index("var io=new IntersectionObserver")
s=s[:a]+r'''function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
var SQ=null,card=null;
function loadSquare(){if(SQ)return SQ;SQ=fetch('/api/config').then(function(r){return r.json()}).then(function(c){if(!c.applicationId)throw new Error('cfg');return new Promise(function(ok,no){var sc=document.createElement('script');sc.src=c.env==='sandbox'?'https://sandbox.web.squarecdn.com/v1/square.js':'https://web.squarecdn.com/v1/square.js';sc.onload=function(){ok(window.Square.payments(c.applicationId,c.locationId))};sc.onerror=no;document.head.appendChild(sc)})});SQ.catch(function(){SQ=null});return SQ}
document.getElementById('cobtn').addEventListener('click',function(e){e.preventDefault();var D=DAYS[box.day],dt=dateFor(D);
  pn.innerHTML='<button class="x" type="button" data-close aria-label="Close">&times;</button><div class="kicker">Checkout</div><h3>Your box</h3>'+
  '<div class="pick"><b>Pickup '+fmt(dt)+'</b><span>'+hoursFor(D)+' &middot; '+addrFor(D)+'</span></div>'+
  '<ul class="lines">'+ITEMS.filter(function(it){return box.q[it.name]}).map(function(it){return '<li><span>'+box.q[it.name]+' &times; '+it.name+'</span><span>'+money(box.q[it.name]*it.price)+'</span></li>'}).join('')+'<li class="t"><span>Total</span><span>'+money(boxTotal())+'</span></li></ul>'+
  '<label>Name<input autocomplete="name" id="cn"></label><label>Email<input type="email" autocomplete="email" id="ce"></label><label>Phone<input type="tel" autocomplete="tel" id="cp"></label>'+
  '<div class="card" id="cardbox">'+(LIVE?'Loading secure card form&hellip;':'Square secure card form appears here on donutste.com')+'</div><p class="err" id="cerr" style="color:#B3261E;font-size:13px;margin:0;min-height:1em"></p>'+
  '<button class="pill pay" type="button" id="pay">Pay '+money(boxTotal())+' <i></i></button><p style="font-size:11px;color:var(--soft);margin:0;text-align:center">Payments are processed securely by Square.</p>';
  pn.querySelector('.x').addEventListener('click',closeD);
  dr.classList.add('show');
  card=null;
  if(LIVE)loadSquare().then(function(pay){return pay.card().then(function(c){var cb=document.getElementById('cardbox');if(!cb)return;cb.innerHTML='';cb.style.border='0';cb.style.padding='0';return c.attach('#cardbox').then(function(){card=c})})}).catch(function(){var cb=document.getElementById('cardbox');if(cb)cb.textContent='Card form could not load. Please refresh and try again.'});
  var payBtn=document.getElementById('pay'),err=document.getElementById('cerr');
  payBtn.addEventListener('click',function(){
    var nm=document.getElementById('cn').value.trim(),em=document.getElementById('ce').value.trim(),ph=document.getElementById('cp').value.trim();
    if(!nm||!/.+@.+\..+/.test(em)||ph.replace(/\D/g,'').length<10){err.textContent='Please add your name, email and phone number.';return}
    function done(rec){pn.innerHTML='<button class="x" type="button" aria-label="Close">&times;</button><div class="done"><div class="kicker" style="justify-content:center">Order placed</div><h3>See you<br><em style="font-style:italic;text-transform:none;color:var(--pink)">'+D.name+'.</em></h3><p>Pickup '+fmt(dt)+'<br>'+hoursFor(D)+'<br>'+addrFor(D)+'</p><p style="font-size:12px">'+(rec?'A receipt is on its way to your email. <a href="'+rec+'" target="_blank" rel="noopener" style="text-decoration:underline">View receipt</a>':'(Preview: no real order was placed.)')+'</p></div>';
      pn.querySelector('.x').addEventListener('click',function(){box={day:null,q:{}};closeD();render()})}
    if(!LIVE){done('');return}
    if(!card){err.textContent='The card form is still loading.';return}
    err.textContent='';payBtn.disabled=true;payBtn.style.opacity=.6;
    card.tokenize().then(function(t){if(t.status!=='OK')throw {msg:'Please check your card details.'};
      return fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({day:box.day,date:ymd(dt),name:nm,email:em,phone:ph,sourceId:t.token,
        lines:ITEMS.filter(function(it){return box.q[it.name]}).map(function(it){return {varId:it.varId,qty:box.q[it.name]}})})})})
    .then(function(r){return r.json().then(function(j){if(!r.ok||!j.ok)throw {msg:j.error};done(j.receiptUrl||' ')})})
    .catch(function(x){err.textContent=(x&&x.msg)||'Something went wrong. Please try again.';payBtn.disabled=false;payBtn.style.opacity=1})});
});
if(LIVE)fetch('/api/menu').then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(m){
  ITEMS=m.items||[];Object.keys(m.hours||{}).forEach(function(k){if(DAYS[k])DAYS[k].hours=m.hours[k]});
  ['Wed','Thu','Sat'].forEach(function(k){if(!m.hours||!m.hours[k])DAYS[k].hours='Pickup hours posted soon'});
  if(m.address)['Wed','Thu','Sat'].forEach(function(k){DAYS[k].addr=m.address});
  POPUP=m.popup||null;LOADING=false;render()}).catch(function(){LOADING=false;render()});
'''+s[b:]
open(p,'w').write(s)
