const { chromium } = require('playwright');
const fs = require('fs');
const B = 'http://127.0.0.1:8300';
const results = []; let failures = 0;
const ok = (name, cond, extra='') => { results.push((cond?'PASS ':'FAIL ')+name+(cond?'':' -> '+extra)); if(!cond) failures++; };
const api = async (page, path, opts) => page.evaluate(async ([p,o]) => { const r = await fetch('/api/'+p, o); let j=null; try{ j=await r.json(); }catch(e){} return {status:r.status, body:j}; }, [path, opts]);
const post = (page, p, body) => api(page, p, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const errors = [];
  const newPage = async () => { const c = await browser.newContext({ viewport:{width:1200,height:850} }); const p = await c.newPage(); p.on('pageerror', e => errors.push(String(e))); p.on('dialog', d => d.accept()); return p; };

  // ---------- visitor ----------
  const v = await newPage();
  await v.goto(B + '/HTML/index.html'); await v.waitForTimeout(1500);
  // guest lands on home? go product screen
  await v.evaluate(() => showScreen('product')); await v.waitForSelector('#productGrid .product-item');
  ok('products load', (await v.$$('#productGrid .product-item')).length === 13);
  await v.click('.cat-btn:has-text("Dairy")');
  const dairyVisible = await v.$$eval('#productGrid .product-item', els => els.filter(e => !e.classList.contains('search-hidden') && e.offsetParent).length);
  ok('category filter (dairy)', dairyVisible === 2, 'visible=' + dairyVisible);
  await v.click('.cat-btn:has-text("All")');
  await v.fill('#product .search[placeholder="Search Product"]', 'rice');
  await v.waitForTimeout(200);
  const riceVisible = await v.$$eval('#productGrid .product-item', els => els.filter(e => !e.classList.contains('search-hidden') && e.offsetParent).map(e=>e.textContent.trim().slice(0,12)));
  ok('product search', riceVisible.length === 1 && /Rice/.test(riceVisible[0]), JSON.stringify(riceVisible));
  await v.fill('#product .search[placeholder="Search Product"]', '');
  // comparison
  await v.evaluate(() => viewProduct(1)); await v.waitForSelector('#detailPriceRows tr');
  const rows = await v.$$eval('#detailPriceRows tr', r => r.map(x => x.textContent.replace(/\s+/g,' ').trim()));
  ok('comparison lists 2 stores cheapest first', rows.length === 2 && /Puregold/.test(rows[0]) && /54/.test(rows[0]) && /SNR/.test(rows[1]), JSON.stringify(rows));
  ok('detail name', /Rice/.test(await v.textContent('#detailName')));
  // stores
  await v.evaluate(() => showScreen('stores')); await v.waitForTimeout(800);
  ok('stores list', /Puregold/.test(await v.textContent('#storeList')) && /Robinson/.test(await v.textContent('#storeList')));
  // budget
  await v.evaluate(() => showScreen('budget')); await v.waitForTimeout(300);
  await v.fill('#budgetInput', '1000'); await v.click('#budget button:has-text("Set Budget"), #budget button:has-text("Set budget"), #budget button[onclick="setBudget()"]');
  ok('budget set', (await v.textContent('#budgetTotal')).includes('1,000') || (await v.textContent('#budgetTotal')).includes('1000'), await v.textContent('#budgetTotal'));
  await v.fill('#expenseName', 'Rice'); await v.fill('#expenseAmount', '120.50'); await v.click('#budget button[onclick="addExpense()"]').catch(()=>{});
  const spent = await v.textContent('#budgetSpent'); ok('expense recorded', spent.includes('120.50'), spent);
  // suggestions
  await v.fill('#suggestBudget', '500');
  await v.click('#suggestNeeds .need-chip:has-text("Food")'); 
  await v.click('#suggest button:has-text("Build my combination"), #budget button:has-text("Build my combination")');
  await v.waitForSelector('#suggestResults .suggest-card, #suggestResults > *', {timeout:5000});
  const sug = await v.textContent('#suggestResults');
  ok('suggestions rendered', /₱/.test(sug) && sug.length > 40, sug.slice(0,120));
  const sugMsg = await v.textContent('#suggestMessage'); 
  const total = (sug.match(/Total[^₱]*₱\s*([\d,]+\.\d\d)/)||[])[1];
  if(total) ok('suggestion within budget', parseFloat(total.replace(',','')) <= 500, total);
  // shopping list
  await v.waitForFunction(() => document.querySelectorAll('#slProduct option').length > 2);
  await v.selectOption('#slProduct', '1'); await v.fill('#slQty','2'); await v.click('button:has-text("Add to list")');
  await v.selectOption('#slProduct', {index: 3}); await v.click('button:has-text("Add to list")');
  ok('shopping list rows', (await v.$$('#slRows tr')).length === 2);
  await v.click('button:has-text("Find cheapest")'); await v.waitForTimeout(800);
  const sl = await v.textContent('#slResults'); ok('shopping list compare', /Puregold|SNR/.test(sl) && /₱/.test(sl), sl.slice(0,150));
  // feedback + request
  const fb = await post(v, 'feedback.php', {type:'Comments', message:'Great app'}); ok('feedback submit', fb.status===200, JSON.stringify(fb));
  const fb2 = await post(v, 'feedback.php', {type:'Comments', message:'Great app'}); ok('duplicate feedback rejected (409)', fb2.status===409);
  const rq = await post(v, 'requests.php', {type:'Price Update', details:'Rice at SNR is 58'}); ok('request submit', rq.status===200);
  const rqBad = await post(v, 'requests.php', {type:'Hack', details:'x'}); ok('bad request type rejected', rqBad.status===400);
  ok('visitor cannot read feedback list', (await api(v,'feedback.php')).status===401);
  ok('visitor cannot read requests list', (await api(v,'requests.php')).status===401);
  ok('visitor cannot call admin API', (await api(v,'admin_summary.php')).status===401);

  // ---------- owner applies (UI) ----------
  const o = await newPage();
  await o.goto(B + '/HTML/index.html'); await o.waitForTimeout(1200);
  await o.evaluate(() => showOwnerSignup());
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64'); fs.writeFileSync('/tmp/store.png', png);
  await o.fill('#ownerName','Nena Reyes'); await o.fill('#ownerStoreName','Aling Nena Store'); await o.fill('#ownerStoreLocation','Sumacab, Cabanatuan');
  await o.setInputFiles('#ownerStorePhoto','/tmp/store.png'); await o.fill('#ownerEmail','Nena@Example.com'); await o.fill('#ownerPassword','Nena1234!'); await o.fill('#ownerPasswordConfirm','Nena1234!');
  await o.click('#ownerRegisterSubmit'); await o.waitForTimeout(1200);
  const notice = await o.textContent('#ownerRegistrationNotice'); ok('owner application submitted', /review|approval|submitted|pending/i.test(notice), notice + '|' + await o.textContent('#ownerRegisterError'));
  // pending owner cannot sign in
  let r = await post(o, 'login.php', {email:'nena@example.com', password:'Nena1234!'}); ok('pending owner cannot sign in', r.status===403, JSON.stringify(r));

  // ---------- moderator approves ----------
  const m = await newPage();
  await m.goto(B + '/HTML/index.html'); await m.waitForTimeout(800);
  r = await post(m, 'login.php', {email:'moderator@tipidgo.com', password:'moderator123!'}); ok('moderator login', r.status===200, JSON.stringify(r));
  await m.goto(B + '/HTML/dashboard.html'); await m.waitForSelector('.staff-nav button');
  ok('moderator nav has 5 items', (await m.$$('.staff-nav button')).length===5);
  await m.click('[data-view="applications"]'); await m.waitForSelector('#view .staff-table tbody tr');
  ok('application listed', /Aling Nena Store/.test(await m.textContent('#view')));
  ok('photo shown', (await m.$$('#view img.staff-store-photo')).length===1);
  const img = await m.$eval('img.staff-store-photo', i => i.complete && i.naturalWidth); ok('photo bytes served', img>0, String(img));
  await m.click('#view button:has-text("Approve")'); await m.waitForTimeout(800);
  const afterApprove = (await api(m,'owner_applications.php')).body; ok('moderator list shows pending only (none left)', afterApprove.length===0, JSON.stringify(afterApprove));
  ok('moderator cannot delete product', (await api(m,'manage_products.php?id=1',{method:'DELETE'})).status===403);
  ok('moderator can add product', (await post(m,'manage_products.php',{name:'Salt (500g)', category:'cooking', base_price:18})).status===200);
  ok('duplicate product name rejected', (await post(m,'manage_products.php',{name:'salt (500g)', category:'cooking', base_price:18})).status===409);
  ok('negative base price rejected', (await post(m,'manage_products.php',{name:'Bad', category:'x', base_price:-5})).status===400);
  const inbox = await api(m,'inbox.php'); ok('moderator inbox has feedback+request', inbox.body.feedback.length===1 && inbox.body.requests.length===1);
  ok('update request status', (await post(m,'inbox.php',{id:inbox.body.requests[0].id, status:'Resolved'})).status===200);

  // ---------- owner signs in, sets price ----------
  const ow = await newPage();
  await ow.goto(B + '/HTML/index.html'); await ow.waitForTimeout(800);
  await ow.evaluate(() => showOwnerLogin());
  await ow.fill('#loginEmail','nena@example.com'); await ow.fill('#loginPassword','Nena1234!');
  await Promise.all([ow.waitForURL('**/dashboard.html'), ow.click('#loginForm button.btn, #loginForm .btn')]);
  await ow.waitForSelector('.staff-nav button');
  ok('owner nav has 2 items', (await ow.$$('.staff-nav button')).length===2);
  ok('owner sees own store', (await ow.inputValue('#view input')) === 'Aling Nena Store');
  await ow.click('[data-view="prices"]'); await ow.waitForSelector('#view select');
  await ow.selectOption('#view select', {label:'Rice (1kg)'}); await ow.fill('#view input[type=number]','49.50'); await ow.click('#view button:has-text("Save price")'); await ow.waitForTimeout(800);
  ok('owner price saved', /added|updated/i.test(await ow.textContent('#staffMessage')), await ow.textContent('#staffMessage'));
  ok('price row shown', /49\.50/.test(await ow.textContent('#view')));
  await ow.fill('#view input[type=number]','47.00'); await ow.click('#view button:has-text("Save price")'); await ow.waitForTimeout(800);
  ok('price update', /updated/i.test(await ow.textContent('#staffMessage')), await ow.textContent('#staffMessage'));
  await ow.fill('#view input[type=number]','47.00'); await ow.click('#view button:has-text("Save price")'); await ow.waitForTimeout(500);
  ok('same price is unchanged', /already current/i.test(await ow.textContent('#staffMessage')));
  const bad = await post(ow,'owner_prices.php',{product_id:1, price:-3}); ok('negative price rejected', bad.status===400);
  ok('owner cannot choose another store', (await post(ow,'owner_prices.php',{product_id:2, price:10, store_id:1})).status===200 && (await api(ow,'owner_dashboard.php')).body.prices.length===2);
  ok('owner blocked from admin APIs', (await api(ow,'manage_users.php')).status===403 && (await api(ow,'inbox.php')).status===403);
  // store edit
  ok('owner edits own store', (await post(ow,'owner_store.php',{name:'Aling Nena Mini Mart', location:'Sumacab'})).body.name==='Aling Nena Mini Mart');

  // ---------- public sees the new price ----------
  const pd = (await api(v,'product_detail.php?id=1')).body;
  ok('public comparison now cheapest = new store', pd.prices[0].price===47 && pd.prices[0].storeName==='Aling Nena Mini Mart', JSON.stringify(pd.prices));
  ok('only 1 row per store in comparison', pd.prices.length===3);
  ok('history is per store, one per day', pd.history.length===1 && pd.history[0].store==='Aling Nena Mini Mart' && pd.history[0].price===47, JSON.stringify(pd.history));
  const pl = (await api(v,'products.php')).body.find(p=>p.id===1); ok('products.php lowest updated', pl.lowestPrice===47 && pl.lowestStore==='Aling Nena Mini Mart' && pl.highestPrice===56.5, JSON.stringify(pl));
  const plist = (await api(v,'price_list.php')).body; ok('price_list includes new store prices', plist.products.find(p=>p.id===1).prices.length===3);

  // ---------- admin ----------
  const a = await newPage();
  await a.goto(B + '/HTML/index.html'); await a.waitForTimeout(800);
  r = await post(a,'login.php',{email:'admin@tipidgo.com', password:'admin123!'}); ok('admin login', r.status===200);
  const sum = (await api(a,'admin_summary.php')).body; ok('admin summary counts', sum.products===14 && sum.stores===5 && sum.users===3, JSON.stringify(sum));
  ok('admin adds store', (await post(a,'manage_stores.php',{name:'Savemore', location:'Cabanatuan City', verified:true})).status===200);
  ok('duplicate store rejected', (await post(a,'manage_stores.php',{name:'Savemore', location:'Cabanatuan City'})).status===409);
  ok('admin sets any store price', (await post(a,'owner_prices.php',{product_id:1, store_id:2, price:55})).status===200);
  const mod = await post(a,'manage_users.php',{action:'create_moderator', full_name:'Mod Two', email:'mod2@tipidgo.com', password:'Moderator2!'}); ok('admin creates moderator', mod.status===200);
  ok('weak moderator password rejected', (await post(a,'manage_users.php',{action:'create_moderator', full_name:'X', email:'x@x.com', password:'abc'})).status===400);
  ok('cannot delete admin', (await post(a,'manage_users.php',{action:'delete', id:1})).status>=400);
  ok('settings: close owner applications', (await post(a,'settings.php',{owner_registration:false, announcement:'Maintenance Sunday'})).body.ownerRegistrationOpen===false);
  const closed = await v.evaluate(async () => { const fd = new FormData(); fd.append('full_name','A'); const r = await fetch('/api/register_owner.php',{method:'POST',body:fd}); return r.status; }); ok('closed registration refuses applications', closed===403, String(closed));
  ok('admin deletes product', (await api(a,'manage_products.php?id=14',{method:'DELETE'})).status===200);
  // role/session invalidation: removed moderator loses access
  const m2 = await newPage(); await m2.goto(B+'/HTML/index.html');
  await post(m2,'login.php',{email:'mod2@tipidgo.com', password:'Moderator2!'});
  ok('new moderator can use inbox', (await api(m2,'inbox.php')).status===200);
  const modList = (await api(a,'manage_users.php?group=moderators')).body; const mod2 = modList.find(x=>x.email==='mod2@tipidgo.com');
  await post(a,'manage_users.php',{action:'delete', id: mod2.id});
  ok('removed moderator locked out immediately (401)', (await api(m2,'inbox.php')).status===401);
  // cross-site
  const xs = await v.evaluate(async () => { const r = await fetch('/api/feedback.php',{method:'POST',headers:{'Content-Type':'application/json','Origin':'http://evil.example'},body:'{}'}); return r.status; }); 

  // ---------- UI renders for admin each view without error ----------
  await a.goto(B+'/HTML/dashboard.html'); await a.waitForSelector('.staff-nav button');
  const navN = (await a.$$('.staff-nav button')).length; ok('admin nav 9 items', navN===9);
  for (const b of await a.$$('.staff-nav button')) { await b.click(); await a.waitForTimeout(250); const msg = await a.textContent('#staffMessage'); if (msg) ok('admin view ok: '+await b.textContent(), false, msg); }
  console.log(results.join('\n'));
  console.log('page errors:', errors.length ? errors : 'none');
  console.log(`\n${results.length - failures} passed, ${failures} failed`);
  await browser.close();
})().catch(e => { console.log(results.join('\n')); console.error('CRASH', e.message.split('\n').slice(0,4).join(' | ')); process.exit(1); });
