const { chromium } = require('playwright');
const B='http://127.0.0.1:8300'; const R=[]; let bad=0;
const T=(n,c,x='')=>{R.push((c?'PASS ':'FAIL ')+n+(c?'':' <= '+x)); if(!c) bad++;};
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
const c=await b.newContext({viewport:{width:1200,height:850}}); const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e))); p.on('dialog',d=>d.accept());
const imgBad=[]; p.on('response',r=>{ if(r.status()===404 && /images\//.test(r.url())) imgBad.push(r.url()); });
await p.goto(B+'/HTML/index.html'); await p.waitForTimeout(1200);
// images
await p.evaluate(()=>showScreen('product')); await p.waitForSelector('#productGrid .product-item'); await p.waitForTimeout(800);
const loaded=await p.$$eval('#productGrid img',i=>i.filter(x=>x.complete&&x.naturalWidth>0&&!x.src.startsWith('data:')).length);
T('all 13 product pictures load from HTML/images', loaded===13 && imgBad.length===0, `loaded=${loaded} 404s=${imgBad}`);
await p.evaluate(()=>viewProduct(1)); await p.waitForTimeout(600);
T('detail picture loads', await p.$eval('#detailImage',i=>i.complete&&i.naturalWidth>0&&!i.src.startsWith('data:')));
// login UI
await p.evaluate(()=>showOwnerLogin());
await p.fill('#loginEmail','admin@tipidgo.com'); await p.fill('#loginPassword','wrongpass!'); await p.click('#loginForm .btn'); await p.waitForTimeout(700);
T('wrong password shows an error', /invalid|incorrect|wrong/i.test(await p.textContent('#loginError')), await p.textContent('#loginError'));
await p.fill('#loginEmail',''); await p.fill('#loginPassword',''); await p.click('#loginForm .btn');
T('empty login asks for details', /enter/i.test(await p.textContent('#loginError')));
// rate limit: 5 failures lock
for(let i=0;i<6;i++){ await p.fill('#loginEmail','lock@x.com'); await p.fill('#loginPassword','bad'+i); await p.click('#loginForm .btn'); await p.waitForTimeout(250); }
const locked=await p.textContent('#loginError'); T('too many failed sign-ins are rate limited', /too many|try again|later/i.test(locked), locked);
// good login (moderator) -> dashboard, then back to public site stays public
await p.fill('#loginEmail','moderator@tipidgo.com'); await p.fill('#loginPassword','moderator123!');
await Promise.all([p.waitForURL('**/dashboard.html'), p.click('#loginForm .btn')]); T('login redirects to dashboard', true);
await p.click('.staff-nav a:has-text("View public site")'); await p.waitForTimeout(1500);
T('"View public site" stays on public site', /index\.html$/.test(p.url()));
const badge=await p.textContent('#accountName'); T('badge shows signed-in name', /Mod/.test(badge), badge);
T('Dashboard link visible', await p.$eval('#home .sidebar .navitem:has-text("Dashboard")', e=>!e.hidden));
// profile
await p.evaluate(()=>showScreen('profile')); await p.waitForTimeout(800);
const prof=await p.textContent('#profile'); T('profile shows email', /moderator@tipidgo.com/.test(prof), prof.slice(0,200));
const editBtn=await p.$('#profile button:has-text("Edit")'); if(editBtn){ await editBtn.click(); await p.waitForTimeout(400); }
await p.fill('#editName','Mod Renamed'); 
const save=await p.$('#editProfile button:has-text("Save")'); await save.click(); await p.waitForTimeout(900);
const me=await p.evaluate(async()=> (await (await fetch('/api/profile.php')).json())); T('name change saved', me.full_name==='Mod Renamed', JSON.stringify(me));
// password change wrong current / weak new / ok
const pw=async(cur,nw)=>p.evaluate(async([cur,nw])=>{const r=await fetch('/api/profile.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({full_name:'Mod Renamed',current_password:cur,new_password:nw})});return [r.status,(await r.json())]},[cur,nw]);
T('password change: wrong current refused', (await pw('nope','Newpass12!'))[0]>=400);
T('password change: weak new refused', (await pw('moderator123!','abc'))[0]===400);
T('password change: ok', (await pw('moderator123!','Newpass12!'))[0]===200);
// logout via UI
await p.evaluate(()=>showScreen('home')); await p.click('#accountLogout'); await p.waitForTimeout(1200);
T('logout works (guest again)', (await p.evaluate(async()=>(await (await fetch('/api/session.php')).json()).loggedIn))===false);
// sign in with the new password
const ok=await p.evaluate(async()=> (await fetch('/api/login.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'moderator@tipidgo.com',password:'Newpass12!'})})).status); T('can sign in with the new password', ok===200, ok);
// feedback + request UI
await p.goto(B+'/HTML/index.html'); await p.waitForTimeout(1200);
await p.evaluate(()=>showScreen('feedback')); await p.fill('#feedbackText','Very helpful comparison!'); await p.click('#feedback button:has-text("Submit")'); await p.waitForTimeout(900);
T('feedback list visible to staff after submit', /Very helpful/.test(await p.textContent('#feedbackList')), (await p.textContent('#feedbackList')).slice(0,100));
await p.evaluate(()=>showScreen('request')); await p.click('#request button:has-text("Request") >> nth=0'); await p.fill('#requestDetails','Rice at SNR is now 58'); await p.click('#requestFormBox button:has-text("Submit")'); await p.waitForTimeout(900);
T('request listed for staff after submit', /Rice at SNR/.test(await p.textContent('#requestList')), (await p.textContent('#requestList')).slice(0,100));
// budget: delete expense, reset
await p.evaluate(()=>showScreen('budget')); await p.waitForTimeout(400);
await p.fill('#budgetInput','500'); await p.click('#budget button[onclick="setBudget()"]');
await p.fill('#expenseName','Milk'); await p.fill('#expenseAmount','95'); await p.click('#budget button[onclick="addExpense()"]'); await p.fill('#expenseName','Eggs'); await p.fill('#expenseAmount','210'); await p.click('#budget button[onclick="addExpense()"]');
T('remaining = 500-95-210', /195/.test(await p.textContent('#budgetRemaining')), await p.textContent('#budgetRemaining'));
await p.fill('#expenseAmount','900'); await p.fill('#expenseName','Big'); await p.click('#budget button[onclick="addExpense()"]'); await p.waitForTimeout(200);
T('overspend is flagged (not silently accepted as normal)', /over|exceed|negative|-/i.test((await p.textContent('#budgetMessage'))+(await p.textContent('#budgetRemaining'))), (await p.textContent('#budgetMessage'))+(await p.textContent('#budgetRemaining')));
await p.fill('#expenseName',''); await p.fill('#expenseAmount','-5'); await p.click('#budget button[onclick="addExpense()"]'); await p.waitForTimeout(200);
T('negative expense rejected', !/-5/.test(await p.textContent('#budget .budget-table, #expenseRows').catch(()=>'')) );
await p.reload(); await p.waitForTimeout(1200); await p.evaluate(()=>showScreen('budget')); await p.waitForTimeout(300);
T('budget persists after reload', /500/.test(await p.textContent('#budgetTotal')), await p.textContent('#budgetTotal'));
// stores screen
await p.evaluate(()=>showScreen('stores')); await p.waitForTimeout(800);
const sl=await p.textContent('#storeList'); T('stores listed with verified marker', /Puregold/.test(sl) && /SNR/.test(sl));
await p.fill('#stores .search[placeholder^="Search"]','robin'); await p.waitForTimeout(300);
const vis=await p.$$eval('#storeList .store-item',e=>e.filter(x=>x.offsetParent&&!x.classList.contains('search-hidden')).length); T('store search filters', vis===1, vis);
// shopping list clear + persistence
await p.evaluate(()=>showScreen('budget')); await p.waitForFunction(()=>document.querySelectorAll('#slProduct option').length>2); await p.selectOption('#slProduct','1'); await p.click('button:has-text("Add to list")'); await p.reload(); await p.waitForTimeout(1500); await p.evaluate(()=>showScreen('budget')); await p.waitForTimeout(600);
T('shopping list persists after reload', (await p.$$('#slRows tr')).length===1);
await p.click('button:has-text("Clear list")'); await p.waitForTimeout(300); T('clear list empties it', (await p.$$('#slRows tr td.sl-empty, #slRows tr')).length<=1 && !/Rice/.test(await p.textContent('#slRows')));
T('no JavaScript errors during all of this', errs.length===0, errs.join(' | '));
console.log(R.join('\n')+`\n\n${R.length-bad} passed, ${bad} failed`); await b.close();})().catch(e=>{console.log(R.join('\n'));console.error('CRASH',e.message.split('\n').slice(0,3).join(' | '));process.exit(2)});
