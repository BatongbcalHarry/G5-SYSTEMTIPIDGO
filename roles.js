const { chromium } = require('playwright');
const assert = require('assert');
const J = o => ({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
const users = { admin: { id: 1, full_name: 'Admin Ana', email: 'a@x', role: 'admin' }, moderator: { id: 2, full_name: 'Mod Mark', email: 'm@x', role: 'moderator' }, store_owner: { id: 3, full_name: 'Owner Olga', email: 'o@x', role: 'store_owner' } };
const calls = [];
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const results = {};
  for (const role of ['admin', 'moderator', 'store_owner']) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    page.on('pageerror', e => { throw e; });
    await page.route('**/api/*.php*', route => {
      const u = new URL(route.request().url()); const f = u.pathname.split('/').pop(); calls.push(role + ' ' + route.request().method() + ' ' + f);
      const map = {
        'session.php': { loggedIn: true, user: users[role] },
        'admin_summary.php': { products: 13, stores: 4, prices: 26, users: 5, feedback: 3, requests: 2, pendingOwnerApplications: 1 },
        'owner_applications.php': [{ id: 1, fullName: 'New Owner', email: 'n@x', storeName: 'Aling Nena', storeLocation: 'Cabanatuan', photoAvailable: false, status: 'pending', submittedAt: '2026-10-01 10:00' }],
        'inbox.php': { requests: [{ id: 1, type: 'Price Update', details: 'Rice is now 58', status: 'Pending', date: '2026-10-02' }], feedback: [{ id: 1, user: 'Guest', type: 'Comments', message: 'Great app', date: '2026-10-02' }] },
        'manage_products.php': [{ id: 1, name: 'Rice (1kg)', category: 'grains', basePrice: 55, image: null }],
        'manage_stores.php': [{ id: 1, name: 'Puregold', location: 'Cabanatuan', verified: true }],
        'owner_dashboard.php': { store: { id: 1, name: 'Puregold', location: 'Cabanatuan' }, products: [{ id: 1, name: 'Rice (1kg)', category: 'grains', basePrice: 55 }], prices: [{ productId: 1, name: 'Rice (1kg)', category: 'grains', price: 54, lastUpdated: '2026-10-01' }] },
        'owner_store.php': { id: 1, name: 'Puregold', location: 'Cabanatuan', verified: false },
        'manage_users.php': [{ id: 9, fullName: 'Juan Dela Cruz', email: 'j@x', role: 'user', created: '2026-09-01' }],
        'settings.php': { ownerRegistrationOpen: true, announcement: 'Prices updated weekly' }
      };
      route.fulfill(J(map[f] ?? { ok: true }));
    });
    await page.goto('http://localhost:8123/HTML/dashboard.html');
    await page.waitForSelector('.staff-nav button');
    const nav = await page.$$eval('.staff-nav button', b => b.map(x => x.textContent.replace(/\d+$/, '').trim()));
    results[role] = nav;
    await page.screenshot({ path: `shot-${role}.png` });
    for (const b of await page.$$('.staff-nav button')) {
      await b.click(); await page.waitForTimeout(150);
      const msg = await page.textContent('#staffMessage'); assert(!msg, `${role} view error: ${msg}`);
    }
    if (role !== 'store_owner') {
      await page.click('[data-view="products"]'); await page.waitForSelector('.staff-table td');
      const del = await page.$$eval('#view .staff-action.reject', b => b.filter(x => x.textContent === 'Delete').length);
      results[role + '_productDelete'] = del;
      await page.screenshot({ path: `shot-${role}-products.png` });
      await page.click('[data-view="stores"]'); await page.waitForSelector('.staff-table td');
      results[role + '_storeAdd'] = (await page.textContent('#view')).includes('Add store');
    }
    await page.close();
  }
  // public site nav
  const pub = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await pub.route('**/api/*.php*', r => r.fulfill(J(r.request().url().includes('session') ? { loggedIn: false } : r.request().url().includes('settings') ? { ownerRegistrationOpen: true, announcement: 'Prices updated weekly' } : [])));
  await pub.goto('http://localhost:8123/HTML/index.html'); await pub.waitForTimeout(1200);
  results.publicNav = await pub.$$eval('#home .sidebar .navitem', a => a.filter(x => !x.hidden && x.offsetParent).map(x => x.textContent.trim()));
  results.banner = await pub.textContent('#siteAnnouncement').catch(() => null);
  await pub.screenshot({ path: 'shot-public.png' });
  console.log(JSON.stringify(results, null, 1));
  assert.deepStrictEqual(results.admin.length, 9); assert.strictEqual(results.moderator.length, 5); assert.strictEqual(results.store_owner.length, 2);
  assert.strictEqual(results.admin_productDelete, 1); assert.strictEqual(results.moderator_productDelete, 0);
  assert(results.admin_storeAdd && !results.moderator_storeAdd);
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
