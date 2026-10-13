// ============================================================
// One dashboard page, three different dashboards.
// The signed-in role decides which navigation and views appear.
// This only controls what is SHOWN - the PHP endpoints enforce
// the same rules, so a hidden button can never be a way in.
// ============================================================
const API = '../api';
let me = null;

const ROLE_LABEL = { admin: 'ADMIN', moderator: 'MODERATOR', store_owner: 'STORE OWNER' };

// Access matrix, as shown on each Overview page.
const CAN = {
  store_owner: [
    ['Browse, compare, budget, shopping list', 'yes'], ['Submit feedback and requests', 'yes'],
    ['Manage my own store', 'yes'], ['Manage my own prices', 'yes'],
    ['Review owner applications', 'no'], ['Review reports', 'no'], ['Manage products', 'no'],
    ['Manage stores', 'yes', 'own store only'], ['Manage users and moderators', 'no'], ['System settings', 'no']
  ],
  moderator: [
    ['Browse, compare, budget, shopping list', 'yes'], ['Submit feedback and requests', 'yes'],
    ['Manage own store / prices', 'no'], ['Review owner applications', 'yes'], ['Review reports', 'yes'],
    ['Manage products', 'yes', 'limited: add and edit, no delete'], ['Manage stores', 'yes', 'limited: location and verified badge'],
    ['Manage users and moderators', 'no'], ['System settings', 'no']
  ],
  admin: [
    ['Browse, compare, budget, shopping list', 'yes'], ['Submit feedback and requests', 'yes'],
    ['Manage store prices', 'yes', 'any store'], ['Review owner applications', 'yes'], ['Review reports', 'yes'],
    ['Manage products', 'yes', 'full'], ['Manage stores', 'yes', 'full'],
    ['Manage users and moderators', 'yes'], ['System settings', 'yes']
  ]
};

const NAV = {
  store_owner: [['store', 'My store'], ['prices', 'My prices']],
  moderator: [['overview', 'Overview'], ['applications', 'Owner applications'], ['reports', 'Reports'], ['products', 'Products'], ['stores', 'Stores']],
  admin: [['overview', 'Overview'], ['applications', 'Owner applications'], ['reports', 'Reports'], ['products', 'Products'], ['stores', 'Stores'],
          ['prices', 'Store prices'], ['users', 'Users'], ['moderators', 'Moderators'], ['settings', 'System settings']]
};

// ---------- helpers ----------
function el(tag, props = {}, ...kids){
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if(k === 'class') node.className = v;
    else if(k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if(v !== undefined && v !== null) node[k] = v;
  });
  kids.flat().forEach(kid => { if(kid !== null && kid !== undefined) node.append(kid); });
  return node;
}

async function api(path, options){
  const response = await fetch(`${API}/${path}`, options);
  const data = await response.json().catch(() => ({}));
  if(response.status === 401){ window.location.replace('index.html'); throw new Error(data.error || 'Please sign in.'); }
  if(!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
const post = (path, body) => api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const del = path => api(path, { method: 'DELETE' });

function say(message, kind = ''){
  const box = document.getElementById('staffMessage');
  box.textContent = message;
  box.dataset.kind = kind;
}
async function guard(fn){
  try{ await fn(); } catch(error){ say(error.message, 'error'); }
}

function heading(title, text){
  return el('div', { class: 'staff-heading' }, el('div', {}, el('h1', {}, title), el('p', {}, text)));
}
function panel(title, subtitle, ...body){
  return el('section', { class: 'staff-panel' },
    el('div', { class: 'staff-panel-header' }, el('div', {}, el('h2', {}, title), subtitle ? el('p', {}, subtitle) : null)),
    ...body);
}
function table(headers, rows, emptyText){
  const body = el('tbody');
  if(!rows.length) body.append(el('tr', {}, el('td', { colSpan: headers.length, class: 'staff-empty' }, emptyText)));
  rows.forEach(cells => body.append(el('tr', {}, cells.map(cell => cell instanceof Node ? el('td', {}, cell) : el('td', {}, cell === '' || cell == null ? '—' : String(cell))))));
  return el('div', { class: 'staff-table-wrap' }, el('table', { class: 'staff-table' }, el('thead', {}, el('tr', {}, headers.map(h => el('th', {}, h)))), body));
}
function btn(label, onclick, kind = ''){
  return el('button', { class: `staff-action ${kind}`, type: 'button', onclick }, label);
}
function field(label, input){ return el('label', {}, label, input); }
function confirmThen(text, fn){ if(window.confirm(text)) guard(fn); }

// ---------- views ----------
const views = {};

views.overview = async root => {
  root.append(heading(me.role === 'admin' ? 'Administrator dashboard' : 'Moderator dashboard',
    me.role === 'admin' ? 'System overview and everything you are allowed to manage.' : 'Review owner applications and visitor reports, and keep product and store details correct.'));
  const stats = el('div', { class: 'staff-stats' });
  root.append(stats);
  const add = (label, value) => stats.append(el('div', { class: 'staff-stat' }, el('span', { class: 'staff-stat-label' }, label), el('strong', { class: 'staff-stat-value' }, String(value ?? 0))));
  if(me.role === 'admin'){
    const s = await api('admin_summary.php');
    add('Products', s.products); add('Stores', s.stores); add('Prices', s.prices); add('Users', s.users);
    add('Feedback', s.feedback); add('Requests', s.requests); add('Pending owners', s.pendingOwnerApplications);
    setBadge(s.pendingOwnerApplications);
  } else {
    const [apps, inbox] = await Promise.all([api('owner_applications.php'), api('inbox.php')]);
    add('Pending owner applications', apps.length);
    add('Pending requests', inbox.requests.filter(r => r.status === 'Pending').length);
    add('Feedback messages', inbox.feedback.length);
    setBadge(apps.length);
  }
  root.append(panel('What your role can do', 'Same rules the server enforces.',
    el('ul', { class: 'staff-can' }, CAN[me.role].map(([label, state, note]) =>
      el('li', {}, el('span', { class: state }, state === 'yes' ? '✔' : '✖'), el('span', {}, label, note ? el('span', { class: 'note' }, ` (${note})`) : null))))));
};

function setBadge(count){
  const badge = document.querySelector('[data-view="applications"] .badge');
  if(badge) badge.textContent = count || '';
}

views.applications = async root => {
  root.append(heading('Owner applications', 'Review submitted store details and approve or reject access.'));
  const filter = el('select', {}, ['pending', 'approved', 'rejected', 'all'].map(v => el('option', { value: v }, v === 'all' ? 'All' : v[0].toUpperCase() + v.slice(1))));
  const holder = el('div');
  root.append(panel('Applications', null, el('div', { class: 'staff-form' }, field('Show', filter)), holder));
  let apps = await api('owner_applications.php');
  const draw = () => {
    const shown = apps.filter(a => filter.value === 'all' || a.status === filter.value);
    holder.replaceChildren(table(['Applicant', 'Store', 'Location', 'Photo', 'Submitted', 'Status', 'Decision'], shown.map(a => {
      const photo = a.photoAvailable
        ? el('a', { href: `${API}/owner_store_photo.php?id=${a.id}`, target: '_blank', rel: 'noopener noreferrer' }, el('img', { class: 'staff-store-photo', src: `${API}/owner_store_photo.php?id=${a.id}`, alt: `Store photo for ${a.storeName}` }))
        : 'No photo';
      const actions = el('div', { class: 'staff-actions' });
      const decide = (decision, label, kind) => actions.append(btn(label, () => confirmThen(`Are you sure you want to ${decision === 'approved' ? 'approve' : 'reject'} this application?`, async () => {
        await post('owner_applications.php', { id: a.id, decision });
        say(`Application ${decision}.`, 'success');
        apps = await api('owner_applications.php'); draw(); setBadge(apps.filter(x => x.status === 'pending').length);
      }), kind));
      if(a.status === 'pending'){ decide('approved', 'Approve', 'approve'); decide('rejected', 'Reject', 'reject'); }
      else if(me.role === 'admin') a.status === 'approved' ? decide('rejected', 'Revoke approval', 'reject') : decide('approved', 'Reapprove', 'approve');
      return [`${a.fullName} (${a.email})`, a.storeName, a.storeLocation, photo, (a.submittedAt || '').slice(0, 10),
        el('span', { class: `staff-status ${a.status}` }, a.status), actions];
    }), 'No applications in this view.'));
  };
  filter.addEventListener('change', draw);
  draw();
};

views.reports = async root => {
  root.append(heading('Reports', 'Requests and feedback sent in by visitors.'));
  const data = await api('inbox.php');
  const reqHolder = el('div');
  const drawRequests = () => reqHolder.replaceChildren(table(['Date', 'Type', 'Details', 'Status', 'Update'], data.requests.map(r => {
    const select = el('select', { class: 'staff-input-inline' }, ['Pending', 'Reviewed', 'Resolved'].map(s => el('option', { value: s, selected: s === r.status }, s)));
    select.addEventListener('change', () => guard(async () => { await post('inbox.php', { id: r.id, status: select.value }); r.status = select.value; say('Request updated.', 'success'); }));
    return [r.date, r.type, r.details, el('span', { class: `staff-status ${r.status === 'Pending' ? 'pending' : 'approved'}` }, r.status), select];
  }), 'No requests yet.'));
  drawRequests();
  root.append(panel('Price and product requests', `${data.requests.length} total`, reqHolder));
  root.append(panel('Feedback', `${data.feedback.length} total`,
    data.feedback.length ? data.feedback.map(f => el('div', { class: 'staff-quote' }, f.message, el('small', {}, `${f.user} · ${f.type} · ${f.date}`)))
                         : el('p', { class: 'staff-empty' }, 'No feedback yet.')));
};

views.products = async root => {
  const isAdmin = me.role === 'admin';
  root.append(heading('Products', isAdmin ? 'Add, edit and delete products.' : 'Add and edit products. Only an administrator can delete one.'));
  const name = el('input', { required: true, maxLength: 150 });
  const category = el('input', { required: true, maxLength: 50, placeholder: 'e.g. grains, dairy' });
  const base = el('input', { type: 'number', min: 0, step: '0.01', required: true });
  let editing = 0;
  const submit = el('button', { class: 'btn', type: 'submit' }, 'Add product');
  const form = el('form', { class: 'staff-form' }, field('Name', name), field('Category', category), field('Base price (PHP)', base), submit);
  const holder = el('div');
  root.append(panel('Product details', null, form), panel('All products', null, holder));
  const load = async () => {
    const list = await api('manage_products.php');
    holder.replaceChildren(table(['Name', 'Category', 'Base price', 'Actions'], list.map(p => {
      const actions = el('div', { class: 'staff-actions' }, btn('Edit', () => {
        editing = p.id; name.value = p.name; category.value = p.category; base.value = p.basePrice.toFixed(2);
        submit.textContent = 'Save changes'; name.focus();
      }));
      if(isAdmin) actions.append(btn('Delete', () => confirmThen(`Delete "${p.name}" and all its prices?`, async () => { await del(`manage_products.php?id=${p.id}`); say('Product deleted.', 'success'); await load(); }), 'reject'));
      return [p.name, p.category, `PHP ${p.basePrice.toFixed(2)}`, actions];
    }), 'No products yet.'));
  };
  form.addEventListener('submit', event => { event.preventDefault(); guard(async () => {
    await post('manage_products.php', { id: editing, name: name.value, category: category.value, base_price: base.value });
    say(editing ? 'Product updated.' : 'Product added.', 'success');
    editing = 0; form.reset(); submit.textContent = 'Add product'; await load();
  }); });
  await load();
};

views.stores = async root => {
  const isAdmin = me.role === 'admin';
  root.append(heading('Stores', isAdmin ? 'Add, edit and delete stores.' : 'Update store locations and the verified badge. Adding, renaming and deleting stores is for administrators.'));
  const name = el('input', { required: isAdmin, maxLength: 150 });
  const location = el('input', { maxLength: 200 });
  const verified = el('input', { type: 'checkbox' });
  let editing = 0;
  const submit = el('button', { class: 'btn', type: 'submit' }, isAdmin ? 'Add store' : 'Save changes');
  const form = el('form', { class: 'staff-form' }, field('Store name', name), field('Location', location), el('label', { class: 'check' }, verified, 'Verified'), submit);
  const holder = el('div');
  const hint = el('p', { class: 'staff-empty' }, 'Choose a store with Edit first.');
  root.append(panel('Store details', null, isAdmin ? null : hint, form), panel('All stores', null, holder));
  if(!isAdmin){ submit.disabled = true; name.disabled = true; }
  const load = async () => {
    const list = await api('manage_stores.php');
    holder.replaceChildren(table(['Name', 'Location', 'Verified', 'Actions'], list.map(s => {
      const actions = el('div', { class: 'staff-actions' }, btn('Edit', () => {
        editing = s.id; name.value = s.name; location.value = s.location || ''; verified.checked = s.verified;
        submit.disabled = false; submit.textContent = 'Save changes'; (isAdmin ? name : location).focus();
      }));
      if(isAdmin) actions.append(btn('Delete', () => confirmThen(`Delete "${s.name}" and its prices?`, async () => { await del(`manage_stores.php?id=${s.id}`); say('Store deleted.', 'success'); await load(); }), 'reject'));
      return [s.name, s.location, s.verified ? 'Yes' : 'No', actions];
    }), 'No stores yet.'));
  };
  form.addEventListener('submit', event => { event.preventDefault(); guard(async () => {
    await post('manage_stores.php', { id: editing, name: name.value, location: location.value, verified: verified.checked });
    say('Store saved.', 'success');
    editing = 0; form.reset(); submit.textContent = isAdmin ? 'Add store' : 'Save changes'; if(!isAdmin) submit.disabled = true; await load();
  }); });
  await load();
};

// Shared by "My prices" (owner, own store) and "Store prices" (admin, any store).
views.prices = async root => {
  const isAdmin = me.role === 'admin';
  root.append(heading(isAdmin ? 'Store prices' : 'My prices', isAdmin ? 'Choose a store, then add or update its prices.' : 'Add or update prices for your own store.'));
  let storeId = 0;
  const storeSelect = el('select');
  const product = el('select');
  const price = el('input', { type: 'number', min: '0.01', step: '0.01', required: true });
  const form = el('form', { class: 'staff-form' }, isAdmin ? field('Store', storeSelect) : null, field('Product', product), field('Price (PHP)', price), el('button', { class: 'btn', type: 'submit' }, 'Save price'));
  const holder = el('div');
  const title = el('span');
  root.append(panel('Set a price', null, form), panel('Current prices', null, holder));
  let data;
  const load = async () => {
    data = await api(`owner_dashboard.php${isAdmin && storeId ? `?store_id=${storeId}` : ''}`);
    storeId = data.store.id;
    const keep = product.value;   // keep the chosen product after saving
    product.replaceChildren(el('option', { value: '' }, 'Choose a product'), ...data.products.map(p => el('option', { value: p.id }, p.name)));
    product.value = keep;
    holder.replaceChildren(table(['Product', 'Category', 'Price', 'Updated'], data.prices.map(p => [p.name, p.category, `PHP ${p.price.toFixed(2)}`, p.lastUpdated]), `No prices for ${data.store.name} yet.`));
  };
  if(isAdmin){
    const stores = await api('manage_stores.php');
    storeSelect.append(...stores.map(s => el('option', { value: s.id }, s.name)));
    storeId = stores[0] ? stores[0].id : 0;
    storeSelect.addEventListener('change', () => guard(async () => { storeId = Number(storeSelect.value); await load(); }));
  }
  product.addEventListener('change', () => { const c = data.prices.find(p => p.productId === Number(product.value)); price.value = c ? c.price.toFixed(2) : ''; });
  form.addEventListener('submit', event => { event.preventDefault(); guard(async () => {
    const result = await post('owner_prices.php', { product_id: Number(product.value), price: Number(price.value), store_id: storeId });
    say(result.status === 'added' ? 'Price added.' : result.status === 'updated' ? 'Price updated.' : 'That price is already current.', 'success');
    await load();
    price.value = result.price.toFixed(2);
  }); });
  await load();
};

views.store = async root => {
  root.append(heading('My store', 'Your store details, as shoppers see them.'));
  const s = await api('owner_store.php');
  const name = el('input', { value: s.name, required: true, maxLength: 150 });
  const location = el('input', { value: s.location || '', required: true, maxLength: 200 });
  const form = el('form', { class: 'staff-form' }, field('Store name', name), field('Location', location),
    el('p', { class: 'wide staff-empty' }, s.verified ? '✔ Verified store' : 'Not verified yet - a moderator or administrator can verify your store.'),
    el('button', { class: 'btn', type: 'submit' }, 'Save store'));
  form.addEventListener('submit', event => { event.preventDefault(); guard(async () => { await post('owner_store.php', { name: name.value, location: location.value }); say('Store saved.', 'success'); }); });
  root.append(panel('Store details', null, form));
  root.append(panel('What your role can do', null, el('ul', { class: 'staff-can' }, CAN.store_owner.map(([label, state, note]) =>
    el('li', {}, el('span', { class: state }, state === 'yes' ? '✔' : '✖'), el('span', {}, label, note ? el('span', { class: 'note' }, ` (${note})`) : null))))));
};

views.users = async root => {
  root.append(heading('Users', 'Registered users and store owners. Administrator and moderator accounts are not listed here.'));
  const holder = el('div');
  root.append(panel('Accounts', null, holder));
  const load = async () => {
    const list = await api('manage_users.php?group=users');
    holder.replaceChildren(table(['Name', 'Email', 'Role', 'Joined', 'Actions'], list.map(u => [u.fullName, u.email, u.role.replace('_', ' '), u.created,
      btn('Delete', () => confirmThen(`Delete the account of ${u.fullName}?`, async () => { await post('manage_users.php', { action: 'delete', id: u.id }); say('Account deleted.', 'success'); await load(); }), 'reject')]), 'No accounts yet.'));
  };
  await load();
};

views.moderators = async root => {
  root.append(heading('Moderators', 'Create moderator accounts or remove them.'));
  const name = el('input', { required: true, maxLength: 100 });
  const email = el('input', { type: 'email', required: true });
  const password = el('input', { type: 'password', required: true, minLength: 8, placeholder: '8+ characters, 1 special' });
  const form = el('form', { class: 'staff-form' }, field('Full name', name), field('Email', email), field('Password', password), el('button', { class: 'btn', type: 'submit' }, 'Add moderator'));
  const holder = el('div');
  root.append(panel('New moderator', null, form), panel('Moderator accounts', null, holder));
  const load = async () => {
    const list = await api('manage_users.php?group=moderators');
    holder.replaceChildren(table(['Name', 'Email', 'Added', 'Actions'], list.map(u => [u.fullName, u.email, u.created,
      btn('Remove', () => confirmThen(`Remove moderator ${u.fullName}?`, async () => { await post('manage_users.php', { action: 'delete', id: u.id }); say('Moderator removed.', 'success'); await load(); }), 'reject')]), 'No moderators yet.'));
  };
  form.addEventListener('submit', event => { event.preventDefault(); guard(async () => {
    await post('manage_users.php', { action: 'create_moderator', full_name: name.value, email: email.value, password: password.value });
    say('Moderator added.', 'success'); form.reset(); await load();
  }); });
  await load();
};

views.settings = async root => {
  root.append(heading('System settings', 'Switches that change how the whole site behaves.'));
  const s = await api('settings.php');
  const open = el('input', { type: 'checkbox', checked: s.ownerRegistrationOpen });
  const note = el('textarea', { rows: 3, maxLength: 300, value: s.announcement, placeholder: 'Shown as a banner on the public site (leave empty for none)' });
  const form = el('form', { class: 'staff-form' },
    el('label', { class: 'check wide' }, open, 'Accept new store-owner applications'),
    el('label', { class: 'wide' }, 'Site announcement', note),
    el('button', { class: 'btn', type: 'submit' }, 'Save settings'));
  form.addEventListener('submit', event => { event.preventDefault(); guard(async () => { await post('settings.php', { owner_registration: open.checked, announcement: note.value }); say('Settings saved.', 'success'); }); });
  root.append(panel('Settings', null, form));

  const out = el('div');
  const run = el('button', { class: 'btn', type: 'button' }, 'Check and repair database');
  run.addEventListener('click', () => guard(async () => {
    const result = await post('upgrade.php', {});
    out.replaceChildren(...result.report.map(r => el('div', { class: 'staff-quote' }, `${r.ok ? '✔' : '⚠'}  ${r.text}`)));
    say('Database check finished.', 'success');
  }));
  root.append(panel('Database health', 'Removes duplicate prices and turns on the rules that stop them coming back. Safe to run any time.',
    el('div', { class: 'staff-form' }, run), out));
};

// ---------- shell ----------
async function show(view){
  const root = document.getElementById('view');
  say('');
  document.querySelectorAll('.staff-nav [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  root.replaceChildren();
  try{ await views[view](root); } catch(error){ say(error.message, 'error'); }
}

async function start(){
  try{
    const session = await api('session.php');
    if(!session.loggedIn || !NAV[session.user.role]){ window.location.replace('index.html'); return; }
    me = session.user;
    document.title = `${ROLE_LABEL[me.role][0]}${ROLE_LABEL[me.role].slice(1).toLowerCase()} dashboard | TipidGo`;
    document.getElementById('roleTag').textContent = ROLE_LABEL[me.role];
    document.getElementById('staffName').textContent = me.full_name;
    const nav = document.getElementById('staffNav');
    nav.append(el('p', { class: 'staff-nav-label' }, ME_LABEL(me.role)));
    NAV[me.role].forEach(([key, label]) => nav.append(el('button', { type: 'button', 'data-view': key, onclick: () => show(key) }, label, key === 'applications' ? el('span', { class: 'badge' }) : null)));
    nav.append(el('div', { class: 'staff-nav-sep' }), el('a', { href: 'index.html' }, 'View public site'));
    // buttons built with el() need the data attribute set explicitly
    nav.querySelectorAll('button').forEach((b, i) => { b.dataset.view = NAV[me.role][i][0]; });
    show(NAV[me.role][0][0]);
  } catch(error){ say(error.message, 'error'); }
}
function ME_LABEL(role){ return role === 'admin' ? 'Administration' : role === 'moderator' ? 'Moderation' : 'My business'; }

document.getElementById('logoutButton').addEventListener('click', async () => {
  await fetch(`${API}/logout.php`, { method: 'POST' });
  window.location.href = 'index.html';
});
start();
