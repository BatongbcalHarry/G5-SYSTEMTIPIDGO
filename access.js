// Full role / access test against the real pages + real PHP (test DB stand-in).
const { chromium } = require('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8300';
const out = []; let bad = 0;
const T = (name, cond, extra='') => { out.push([cond?'PASS':'FAIL', name, cond?'':String(extra)]); if(!cond) bad++; };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');

(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
  const actor = async () => { const c = await browser.newContext(); const p = await c.newPage(); await p.goto(B+'/HTML/index.html'); return p; };
  const call = (p, path, method='GET', body) => p.evaluate(async ([path, method, body]) => {
    const o = { method, headers: {'Content-Type':'application/json'} }; if (body !== undefined) o.body = JSON.stringify(body);
    const r = await fetch('/api/'+path, o); let j=null; try { j = await r.json(); } catch(e){} return { s:r.status, b:j };
  }, [path, method, body]);
  const login = (p, email, password) => call(p, 'login.php', 'POST', { email, password });
  const applyOwner = (p, email, store) => p.evaluate(async ([email, store, b64]) => {
    const fd = new FormData(); fd.append('full_name','Owner '+store); fd.append('store_name',store); fd.append('store_location','Cabanatuan'); fd.append('email',email); fd.append('password','Owner123!');
    const bin = atob(b64); const arr = new Uint8Array(bin.length); for (let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
    fd.append('store_photo', new Blob([arr], {type:'image/png'}), 's.png'); const r = await fetch('/api/register_owner.php',{method:'POST',body:fd}); return r.status; }, [email, store, png.toString('base64')]);

  const anon = await actor(), user = await actor(), mod = await actor(), admin = await actor(), oA = await actor(), oB = await actor(), oC = await actor(), oD = await actor();
  T('admin login', (await login(admin,'admin@tipidgo.com','admin123!')).s===200);
  T('moderator login', (await login(mod,'moderator@tipidgo.com','moderator123!')).s===200);

  // regular user (self-registered) - gets a session with role "user"
  const reg = await call(user,'register.php','POST',{full_name:'Juan Visitor', email:'juan@example.com', password:'Juan1234!'});
  T('visitor can self-register (role user)', reg.s===200 && reg.b.role==='user', JSON.stringify(reg));
  const fresh = await actor(); T('registered user cannot use staff sign-in', (await login(fresh,'juan@example.com','Juan1234!')).s>=400);

  // owners: A, B approved; C pending; D rejected
  for (const [e,s] of [['a@x.com','Store A'],['b@x.com','Store B'],['c@x.com','Store C'],['d@x.com','Store D']]) { const st = await applyOwner(anon,e,s); T('owner applies '+s, st>=200 && st<300, st); }
  const apps = (await call(admin,'owner_applications.php')).b;
  const idOf = n => apps.find(a=>a.storeName===n).id;
  for (const n of ['Store A','Store B']) T('moderator approves '+n, (await call(mod,'owner_applications.php','POST',{id:idOf(n),decision:'approved'})).s===200);
  T('moderator rejects Store D', (await call(mod,'owner_applications.php','POST',{id:idOf('Store D'),decision:'rejected'})).s===200);
  T('owner A signs in', (await login(oA,'a@x.com','Owner123!')).s===200);
  T('owner B signs in', (await login(oB,'b@x.com','Owner123!')).s===200);
  T('pending owner C cannot sign in', (await login(oC,'c@x.com','Owner123!')).s===403);
  T('rejected owner D cannot sign in', (await login(oD,'d@x.com','Owner123!')).s===403);

  // ----- endpoint x role matrix. "Y" = allowed, "N" = must be refused (401 anon / 403 other) -----
  const actors = { anon, user, ownerA:oA, ownerC:oC, moderator:mod, admin };
  const body = { product_id:1, price:50 };
  const spec = [
    // path, method, body, anon, user, ownerA, ownerC(pending, no session), moderator, admin
    ['admin_summary.php','GET',undefined, 'N','N','N','N','N','Y'],
    ['owner_applications.php','GET',undefined, 'N','N','N','N','Y','Y'],
    ['owner_store_photo.php?id=1','GET',undefined, 'N','N','N','N','Y','Y'],
    ['inbox.php','GET',undefined, 'N','N','N','N','Y','Y'],
    ['feedback.php','GET',undefined, 'N','N','N','N','Y','Y'],
    ['requests.php','GET',undefined, 'N','N','N','N','Y','Y'],
    ['manage_products.php','GET',undefined, 'N','N','N','N','Y','Y'],
    ['manage_stores.php','GET',undefined, 'N','N','N','N','Y','Y'],
    ['manage_users.php?group=users','GET',undefined, 'N','N','N','N','N','Y'],
    ['manage_users.php?group=moderators','GET',undefined, 'N','N','N','N','N','Y'],
    ['owner_store.php','GET',undefined, 'N','N','Y','N','N','N'],
    ['owner_dashboard.php','GET',undefined, 'N','N','Y','N','N','Y'],
    ['owner_prices.php','POST',{product_id:1,price:51,store_id:1}, 'N','N','Y','N','N','Y'],
    ['upgrade.php','POST',{}, 'N','N','N','N','N','Y'],
    ['settings.php','POST',{owner_registration:true,announcement:''}, 'N','N','N','N','N','Y'],
    ['profile.php','GET',undefined, 'N','Y','Y','N','Y','Y'],
  ];
  for (const [path, m, b, ...exp] of spec) {
    ['anon','user','ownerA','ownerC','moderator','admin'].forEach((who, i) => { /* evaluated below */ });
    const names = ['anon','user','ownerA','ownerC','moderator','admin'];
    for (let i=0;i<names.length;i++) {
      const r = await call(actors[names[i]], path, m, b);
      const refused = r.s===401 || r.s===403;
      const want = exp[i]==='Y';
      T(`${path} [${m}] as ${names[i]} -> ${want?'allowed':'refused'}`, want ? !refused : refused, `got ${r.s}`);
    }
  }
  // refusal codes: 401 not signed in, 403 wrong role
  T('anonymous gets 401', (await call(anon,'admin_summary.php')).s===401);
  T('user (wrong role) gets 403', (await call(user,'admin_summary.php')).s===403);
  T('moderator gets 403 on admin-only', (await call(mod,'manage_users.php')).s===403);

  // role-specific write rules
  T('moderator: add product allowed', (await call(mod,'manage_products.php','POST',{name:'Rule Item',category:'canned',base_price:20})).s===200);
  const pid = (await call(admin,'manage_products.php')).b.find(p=>p.name==='Rule Item').id;
  T('moderator: edit product allowed', (await call(mod,'manage_products.php','POST',{id:pid,name:'Rule Item 2',category:'canned',base_price:22})).s===200);
  T('moderator: DELETE product refused', (await call(mod,'manage_products.php?id='+pid,'DELETE')).s===403);
  T('owner: DELETE/add product refused', (await call(oA,'manage_products.php?id='+pid,'DELETE')).s===403 && (await call(oA,'manage_products.php','POST',{name:'x',category:'y',base_price:1})).s===403);
  T('admin: DELETE product allowed', (await call(admin,'manage_products.php?id='+pid,'DELETE')).s===200);
  T('moderator: cannot add store', (await call(mod,'manage_stores.php','POST',{name:'New',location:'X'})).s===403);
  T('moderator: cannot delete store', (await call(mod,'manage_stores.php?id=4','DELETE')).s===403);
  const before = (await call(admin,'manage_stores.php')).b.find(s=>s.id===1);
  await call(mod,'manage_stores.php','POST',{id:1,name:'HACKED NAME',location:'Mod Edit Loc',verified:false});
  const after = (await call(admin,'manage_stores.php')).b.find(s=>s.id===1);
  T('moderator edit: location/verified change, NAME cannot', after.name===before.name && after.location==='Mod Edit Loc' && after.verified===false, JSON.stringify(after));
  T('admin: add + rename + delete store', (await call(admin,'manage_stores.php','POST',{name:'Admin Store',location:'Z'})).s===200);
  const asid = (await call(admin,'manage_stores.php')).b.find(s=>s.name==='Admin Store').id;
  T('admin renames store', (await call(admin,'manage_stores.php','POST',{id:asid,name:'Admin Store 2',location:'Z'})).s===200 && (await call(admin,'manage_stores.php?id='+asid,'DELETE')).s===200);

  // owner isolation
  const aStore = (await call(oA,'owner_store.php')).b, bStore = (await call(oB,'owner_store.php')).b;
  T('owners have different stores', aStore.id!==bStore.id);
  await call(oA,'owner_prices.php','POST',{product_id:2,price:44.4,store_id:bStore.id});   // tries to target B's store
  const aPrices = (await call(oA,'owner_dashboard.php')).b.prices, bPrices = (await call(oB,'owner_dashboard.php')).b.prices;
  T("owner A cannot write prices into owner B's store (store_id ignored)", aPrices.some(p=>p.productId===2&&p.price===44.4) && !bPrices.some(p=>p.productId===2));
  T("owner A's dashboard only shows their own store", (await call(oA,'owner_dashboard.php')).b.store.id===aStore.id);
  await call(oA,'owner_store.php','POST',{name:'Store A Renamed',location:'Loc A', id:bStore.id});
  T("owner A's edit changes only A's store", (await call(oB,'owner_store.php')).b.name==='Store B' && (await call(oA,'owner_store.php')).b.name==='Store A Renamed');
  T('owner cannot self-verify store (verified flag ignored)', (await call(oA,'owner_store.php','POST',{name:'Store A Renamed',location:'Loc A',verified:true})).b.verified===false);

  // approvals
  const modView = (await call(mod,'owner_applications.php')).b;
  T('moderator only sees PENDING applications', modView.every(a=>a.status==='pending') && modView.length===1 && modView[0].storeName==='Store C', JSON.stringify(modView.map(a=>a.status)));
  T('moderator cannot revoke an approved application', (await call(mod,'owner_applications.php','POST',{id:idOf('Store A'),decision:'rejected'})).s===409);
  T('admin sees all applications', (await call(admin,'owner_applications.php')).b.length===4);
  T('admin revokes owner A', (await call(admin,'owner_applications.php','POST',{id:idOf('Store A'),decision:'rejected'})).s===200);
  T('revoked owner A immediately loses owner API access', (await call(oA,'owner_dashboard.php')).s===403 && (await call(oA,'owner_prices.php','POST',body)).s===403);
  T('revoked owner A cannot sign in again', (await login(await actor(),'a@x.com','Owner123!')).s===403);
  T('admin re-approves owner A', (await call(admin,'owner_applications.php','POST',{id:idOf('Store A'),decision:'approved'})).s===200 && (await call(oA,'owner_dashboard.php')).s===200);

  // users / moderators
  T('admin cannot delete own account', (await call(admin,'manage_users.php','POST',{action:'delete',id:1})).s>=400);
  const users = (await call(admin,'manage_users.php?group=users')).b;
  T('users list excludes admin/moderator accounts', users.every(u=>['user','store_owner'].includes(u.role)));
  const juan = users.find(u=>u.email==='juan@example.com');
  T('admin deletes a user; their session dies', (await call(admin,'manage_users.php','POST',{action:'delete',id:juan.id})).s===200 && (await call(user,'profile.php')).s===401);
  const m3 = await call(admin,'manage_users.php','POST',{action:'create_moderator',full_name:'Temp Mod',email:'tmp@x.com',password:'Tempmod1!'});
  const tm = await actor(); T('new moderator signs in and works', (await login(tm,'tmp@x.com','Tempmod1!')).s===200 && (await call(tm,'inbox.php')).s===200);
  const tmId = (await call(admin,'manage_users.php?group=moderators')).b.find(u=>u.email==='tmp@x.com').id;
  T('admin removes moderator -> locked out at once', (await call(admin,'manage_users.php','POST',{action:'delete',id:tmId})).s===200 && (await call(tm,'inbox.php')).s===401);

  // spoofing / tampering
  const forged = await browser.newContext(); await forged.addCookies([{name:'PHPSESSID',value:'forgedsession1234567890abcdef12',url:B}]); const fp = await forged.newPage(); await fp.goto(B+'/HTML/index.html');
  T('forged session cookie gets nothing', (await call(fp,'admin_summary.php')).s===401);
  const sp = await call(user,'admin_summary.php'); 
  const regB = await actor(); await call(regB,'register.php','POST',{full_name:'Sneaky', email:'sneaky@example.com', password:'Sneaky12!', role:'admin'});
  T('registering with role=admin in the body does not create an admin', (await call(regB,'admin_summary.php')).s===403 && (await call(regB,'session.php')).b.loggedIn===true ? true : (await call(regB,'admin_summary.php')).s!==200);
  const evil = await admin.context().request.post(B+'/api/manage_products.php',{headers:{'Origin':'http://evil.example','Content-Type':'application/json'},data:{name:'CSRF',category:'x',base_price:1}});
  T('cross-site POST carrying an admin session is blocked', evil.status()===403, evil.status());
  const evilDel = await admin.context().request.delete(B+'/api/manage_products.php?id=1',{headers:{'Origin':'http://evil.example'}});
  T('cross-site DELETE carrying an admin session is blocked', evilDel.status()===403, evilDel.status());
  const same = await admin.context().request.post(B+'/api/manage_products.php',{headers:{'Origin':B,'Content-Type':'application/json'},data:{name:'Same Origin OK',category:'x',base_price:1}});
  T('same-site POST still works', same.status()===200, same.status());
  // forged Origin header can't be set by fetch in browsers, so also test DELETE via curl-like
  // public pages
  T('public: visitors can still read products/stores/prices', (await call(anon,'products.php')).s===200 && (await call(anon,'stores.php')).s===200 && (await call(anon,'price_list.php')).s===200 && (await call(anon,'product_detail.php?id=1')).s===200);
  T('public: visitors can submit feedback and requests', (await call(anon,'feedback.php','POST',{type:'Comments',message:'hello there'})).s===200 && (await call(anon,'requests.php','POST',{type:'New Product',details:'Add suka please'})).s===200);
  T('public: banner endpoint readable by everyone; only admin can change it', (await call(anon,'settings.php')).s===200 && (await call(mod,'settings.php','POST',{owner_registration:false,announcement:'x'})).s===403);

  // ----- UI per role -----
  const ui = async (p, url) => { await p.goto(B+url); await p.waitForTimeout(1200); return p; };
  await ui(anon,'/HTML/dashboard.html'); T('UI: guest opening dashboard.html is sent to the public site', /index\.html$/.test(anon.url()), anon.url());
  const u2 = await actor(); await call(u2,'register.php','POST',{full_name:'Ana User',email:'ana@example.com',password:'Ana12345!'}); await ui(u2,'/HTML/dashboard.html');
  T('UI: plain user opening dashboard.html is sent to the public site', /index\.html$/.test(u2.url()), u2.url());
  const navOf = async (p) => { await p.goto(B+'/HTML/dashboard.html'); await p.waitForSelector('.staff-nav button'); return p.$$eval('.staff-nav button', b=>b.map(x=>x.textContent.replace(/\d+$/,'').trim())); };
  const nm = await navOf(mod), na = await navOf(admin), no = await navOf(oB);
  T('UI: moderator navigation', JSON.stringify(nm)===JSON.stringify(['Overview','Owner applications','Reports','Products','Stores']), nm);
  T('UI: admin navigation', na.length===9 && na.includes('Users') && na.includes('Moderators') && na.includes('System settings'), na);
  T('UI: owner navigation', JSON.stringify(no)===JSON.stringify(['My store','My prices']), no);
  for (const [who,p] of [['moderator',mod],['admin',admin],['owner',oB]]) { const items = await p.$$('.staff-nav button'); let err=''; for (const b of items) { await b.click(); await p.waitForTimeout(250); err = await p.textContent('#staffMessage'); if (err) break; } T(`UI: every ${who} menu item opens without error`, !err, err); }
  await mod.click('[data-view="products"]'); await mod.waitForSelector('#view .staff-table tbody tr');
  T('UI: moderator sees no Delete button on products', (await mod.$$eval('#view button', b=>b.filter(x=>x.textContent==='Delete').length))===0);
  await admin.click('[data-view="products"]'); await admin.waitForSelector('#view .staff-table tbody tr');
  T('UI: admin sees Delete buttons on products', (await admin.$$eval('#view button', b=>b.filter(x=>x.textContent==='Delete').length))>0);
  await mod.click('[data-view="stores"]'); await mod.waitForTimeout(500);
  T('UI: moderator store view has no Delete and no add form', (await mod.$$eval('#view button', b=>b.filter(x=>x.textContent==='Delete').length))===0 && !(await mod.textContent('#view')).includes('Add store'));
  const pubNav = async (p) => { await p.goto(B+'/HTML/index.html'); await p.waitForTimeout(1500); return p.$$eval('#home .sidebar .navitem', a=>a.filter(x=>!x.hidden && x.offsetParent).map(x=>x.textContent.trim())); };
  const g = await pubNav(await actor()), s = await pubNav(admin);
  T('UI: guest public sidebar has no Dashboard/Administrator/Moderator', !g.includes('Dashboard') && !g.includes('Administrator') && !g.includes('Moderator'), g);
  T('UI: signed-in staff get a Dashboard link on the public site', s.includes('Dashboard'), s);

  const w = Math.max(...out.map(o=>o[1].length));
  console.log(out.map(o=>`${o[0]}  ${o[1]}${o[2]?'   <= '+o[2]:''}`).join('\n'));
  console.log(`\n${out.length-bad} passed, ${bad} failed`);
  await browser.close(); process.exit(bad?1:0);
})().catch(e=>{ console.log(out.map(o=>`${o[0]}  ${o[1]}${o[2]?'   <= '+o[2]:''}`).join('\n')); console.error('CRASH', e.message.split('\n').slice(0,3).join(' | ')); process.exit(2); });
