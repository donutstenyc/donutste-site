import re,sys,os
L=sys.argv[1]
NAV=[('Menu','/menu'),('Donutste Fit','/fit'),('Doughssant','/doughssant'),('Coffee','/coffee'),('Gift Cards','/gift-cards'),('Press','/press'),('Our Story','/our-story')]
PAGES={'menu':'Menu','fit':'Donutste Fit','doughssant':'Doughssant','coffee':'Coffee','gift-cards':'Gift Cards','press':'Press','our-story':'Our Story','':None}
def nav(cur,cls):
    return ''.join('<a%s href="%s">%s</a>'%(' class="%s"'%cls if n==cur else '',u,n) for n,u in NAV)
for d,cur in PAGES.items():
    p=os.path.join(L,d,'index.html');s=open(p).read()
    cls='cur' if d=='fit' else 'on'
    # header nav (first <nav ...> that contains Coffee)
    m=re.search(r'(<nav(?: aria-label="Main")?>)(.*?)(</nav>)',s,re.S)
    assert m and 'Coffee' in m.group(2),(d,'nav')
    s=s[:m.start(2)]+nav(cur,cls)+s[m.end(2):]
    # logo -> home
    s=s.replace('<a href="#top" aria-label="Donutste">','<a href="/" aria-label="Donutste">',1)
    s=s.replace('<a href="#top" aria-label="Donutste home">','<a href="/" aria-label="Donutste home">',1) if d else s
    if d=='fit': s=s.replace('<header><div class="bar"><a href="#">','<header><div class="bar"><a href="/">',1)
    # pre-order buttons
    for t in ['Pre-order now','Pre-order a bottle','Pre-order Doughssants']:
        s=re.sub(r'<a class="pill"([^>]*?) href="#"([^>]*)>'+t, lambda m:'<a class="pill"'+m.group(1)+' href="/menu"'+m.group(2)+'>'+t, s)
    s=s.replace('<a class="ghost" href="#">See the flavors','<a class="ghost" href="/menu">See the flavors')
    s=s.replace('<a class="ghost" href="#">Read the press','<a class="ghost" href="/press">Read the press')
    if d=='':
        for a,b in [('#order','/menu'),('#flavors','/menu'),('#fit','/fit'),('#doughssant','/doughssant'),('#coffee','/coffee'),('#press','/press'),('#story','/our-story')]:
            s=s.replace('href="%s"'%a,'href="%s"'%b)
    open(p,'w').write(s)
    left=re.findall(r'<a [^>]*href="#"[^>]*>[^<]{0,30}',re.sub(r'data:[^"\')]*','D',s))
    print(d or 'home',left)
