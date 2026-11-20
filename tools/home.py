import sys,re
p=sys.argv[1];s=open(p).read()
def rep(a,b):
    global s
    assert s.count(a)==1,a[:70]; s=s.replace(a,b)
a=s.index('    <div class="po-days" role="tablist" aria-label="Pickup day">');b=s.index('    <div class="po-info">')
s=s[:a]+'''    <div class="po-days po4" aria-label="Pickup days">
      <a class="po-day" href="/menu#d-Wed"><span class="po-label">Wednesday pickup</span><span class="po-date" id="wed">&mdash;</span><span class="po-cta">See the menu <i></i></span></a>
      <a class="po-day" href="/menu#d-Thu"><span class="po-label">Thursday pickup</span><span class="po-date" id="thu">&mdash;</span><span class="po-cta">See the menu <i></i></span></a>
      <a class="po-day" href="/menu#d-Sat"><span class="po-label">Saturday pickup</span><span class="po-date" id="sat">&mdash;</span><span class="po-cta">See the menu <i></i></span></a>
      <a class="po-day" href="/menu#d-Pop"><span class="po-label">Pop-up</span><span class="po-date">Varies</span><span class="po-cta">Where next <i></i></span></a>
    </div>
'''+s[b:]
a=s.index('  <section class="flavors" id="flavors">');b=s.index('</section>',a)+len('</section>')
s=s[:a]+s[b:].lstrip('\n')
rep('.po-day:hover .po-date{color:var(--pink)}','''.po-day:hover .po-date{color:var(--pink)}
.po-days.po4{grid-column:1/-1;grid-template-columns:repeat(4,1fr)}
.po4 .po-day{padding:28px 22px 32px 0;color:var(--paper)}.po4 .po-day+.po-day{padding-left:22px;border-left:1px solid #3A3433}
.po4 .po-date{font-size:clamp(40px,4.4vw,72px)}
@media (max-width:820px){.po-days.po4{grid-template-columns:1fr 1fr}.po4 .po-day:nth-child(3){padding-left:0;border-left:0}}''')
s=re.sub(r"document\.getElementById\('wed'\)\.textContent=next\(3\);","document.getElementById('wed').textContent=next(3);var _s=document.getElementById('sat');if(_s)_s.textContent=next(6);",s,1)
open(p,'w').write(s)
