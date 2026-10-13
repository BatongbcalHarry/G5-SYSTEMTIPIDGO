/* ============================================================
   SMART SHOPPING LIST  (Budget screen)

   Flow:  enter budget -> build a shopping list -> TipidGo
          1) finds the cheapest combination (each item at the store
             that sells it cheapest),
          2) compares the TOTAL of the whole list store by store,
          3) suggests cheaper alternatives, and if you are over
             budget, shows which swaps would bring you back under it.

   The list is saved in this browser (localStorage), like the budget.
   Prices come live from api/price_list.php.

   To change which products count as "alternatives" for each other,
   edit ALTERNATIVE_GROUPS below. Products are grouped by words in
   their name (first matching group wins).
   ============================================================ */

const SHOPPING_LIST_KEY = 'tipidgo.shoppinglist.v1';

const ALTERNATIVE_GROUPS = [
  { name: 'Dishwashing',      match: /dish/i },
  { name: 'Rice & grains',    match: /\brice\b|\bbigas\b|corn ?grits|\boats?\b/i },
  { name: 'Canned ulam',      match: /sardine|corned|tuna|meat ?loaf|\bcanned\b/i },
  { name: 'Noodles',          match: /noodle|pancit|instant/i },
  { name: 'Cooking oil',      match: /\boil\b/i },
  { name: 'Milk',             match: /\bmilk\b|\bgatas\b/i },
  { name: 'Coffee',           match: /coffee|\bkape\b/i },
  { name: 'Bread',            match: /\bbread\b|pandesal/i },
  { name: 'Condiments',       match: /vinegar|\bsuka\b|soy ?sauce|\btoyo\b|\bpatis\b/i },
  { name: 'Laundry',          match: /detergent|laundry|fabric/i },
  { name: 'Bath soap',        match: /\bsoap\b/i }
];

/* ---------- pure logic (also tested in Node) ---------- */
function slCents(n){ return Math.round(Number(n) * 100); }
function slPeso(c){
  return '₱' + (c / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function slGroupOf(name){
  const g = ALTERNATIVE_GROUPS.find(group => group.match.test(name));
  return g ? g.name : null;
}

// Turns the API response into a clean catalog. Products with no price anywhere are dropped.
function slBuildCatalog(raw){
  const stores = ((raw && raw.stores) || []).map(s => ({
    id: s.id, name: String(s.name || ''), verified: !!s.verified
  }));
  const products = ((raw && raw.products) || []).map(p => {
    const prices = (p.prices || [])
      .map(x => ({ storeId: x.storeId, storeName: x.storeName, cents: slCents(x.price) }))
      .filter(x => isFinite(x.cents) && x.cents > 0)
      .sort((a, b) => a.cents - b.cents);
    return {
      id: p.id, name: String(p.name || ''), category: String(p.category || ''),
      prices, lowest: prices.length ? prices[0].cents : 0,
      lowestStore: prices.length ? prices[0].storeName : '',
      group: slGroupOf(String(p.name || ''))
    };
  }).filter(p => p.name && p.prices.length);
  return { stores, products };
}

// Cheaper products in the same group, cheapest first.
function slAlternatives(catalog, product){
  if(!product.group) return [];
  return catalog.products
    .filter(p => p.id !== product.id && p.group === product.group && p.lowest < product.lowest)
    .sort((a, b) => a.lowest - b.lowest);
}

/* items: [{ id, qty }]   budgetCents: 0 means "no budget set" */
function slAnalyze(catalog, items, budgetCents){
  const byId = new Map(catalog.products.map(p => [p.id, p]));
  const lines = items
    .map(it => ({ product: byId.get(it.id), qty: Math.max(1, Math.floor(it.qty) || 1) }))
    .filter(l => l.product);

  // 1) Cheapest combination: every item at the store that sells it cheapest.
  const mixedTotal = lines.reduce((s, l) => s + l.product.lowest * l.qty, 0);

  // 2) Whole-list total for each single store.
  const storeRows = catalog.stores.map(store => {
    let total = 0;
    const missing = [];
    lines.forEach(l => {
      const hit = l.product.prices.find(x => x.storeId === store.id);
      if(hit) total += hit.cents * l.qty; else missing.push(l.product.name);
    });
    return { store, total, missing, complete: lines.length > 0 && missing.length === 0 };
  }).filter(r => r.total > 0);   // hide stores that sell none of the items
  storeRows.sort((a, b) =>
    (b.complete - a.complete) || (a.missing.length - b.missing.length) || (a.total - b.total));
  const bestStore = storeRows.find(r => r.complete) || null;

  // 3) Cheaper alternatives for each line.
  const alternatives = lines.map(l => {
    const alts = slAlternatives(catalog, l.product).slice(0, 2).map(a => ({
      product: a, saving: (l.product.lowest - a.lowest) * l.qty
    }));
    return { line: l, alts };
  }).filter(x => x.alts.length);

  // 4) If over budget, which swaps (biggest saving first) bring it back under?
  let plan = null;
  if(budgetCents > 0 && lines.length){
    let total = mixedTotal;
    const swaps = [];
    if(total > budgetCents){
      const ranked = alternatives
        .map(x => ({ line: x.line, alt: x.alts[0] }))   // cheapest alternative (alts are sorted cheapest first)
        .sort((a, b) => b.alt.saving - a.alt.saving);
      for(const r of ranked){
        if(total <= budgetCents) break;
        swaps.push(r);
        total -= r.alt.saving;
      }
    }
    plan = { swaps, total, left: budgetCents - total, fits: total <= budgetCents };
  }

  return { lines, mixedTotal, storeRows, bestStore, alternatives, plan, budgetCents };
}

/* ---------- saved list ---------- */
function slLoadList(){
  try{
    const saved = JSON.parse(localStorage.getItem(SHOPPING_LIST_KEY));
    if(Array.isArray(saved)){
      return saved.filter(x => x && Number.isFinite(x.id) && Number.isFinite(x.qty) && x.qty > 0)
                  .map(x => ({ id: x.id, qty: Math.min(99, Math.floor(x.qty)) }));
    }
  } catch(err){ /* blocked or corrupted: start empty */ }
  return [];
}
function slSaveList(items){
  try{ localStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify(items)); } catch(err){ /* ignore */ }
}

/* ============================================================
   UI (browser only)
   ============================================================ */
let slCatalog = { stores: [], products: [] };
let slItems = [];

function slEl(tag, cls, text){
  const e = document.createElement(tag);
  if(cls) e.className = cls;
  if(text !== undefined) e.textContent = text;
  return e;
}

function slMessage(text, kind){
  const box = document.getElementById('slMessage');
  if(!box) return;
  box.textContent = text || '';
  if(kind) box.dataset.kind = kind; else delete box.dataset.kind;
}

async function slLoadCatalog(){
  const res = await fetch(`${API_BASE}/price_list.php`);
  if(!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  if(!data || !Array.isArray(data.products)) throw new Error('Unexpected response');
  slCatalog = slBuildCatalog(data);

  const select = document.getElementById('slProduct');
  if(select){
    const keep = select.value;
    select.textContent = '';
    const first = slEl('option', '', 'Choose a product...');
    first.value = '';
    select.appendChild(first);
    slCatalog.products.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(p => {
      const o = slEl('option', '', p.name + ' - from ' + slPeso(p.lowest));
      o.value = String(p.id);
      select.appendChild(o);
    });
    if(keep) select.value = keep;
  }
}

function slProductName(id){
  const p = slCatalog.products.find(x => x.id === id);
  if(p) return p.name;
  return slCatalog.products.length ? 'Unavailable product' : 'Loading...';
}

function slRenderList(){
  const body = document.getElementById('slRows');
  if(!body) return;
  body.textContent = '';
  if(slItems.length === 0){
    const tr = slEl('tr'); const td = slEl('td', '', 'Your list is empty. Pick a product above to start.');
    td.colSpan = 3; tr.appendChild(td); body.appendChild(tr);
    return;
  }
  slItems.forEach((it, index) => {
    const tr = slEl('tr');
    tr.appendChild(slEl('td', '', slProductName(it.id)));
    tr.appendChild(slEl('td', '', '× ' + it.qty));
    const act = slEl('td');
    const del = slEl('button', 'btn', 'Remove');
    del.type = 'button';
    del.addEventListener('click', () => {
      slItems.splice(index, 1);
      slSaveList(slItems);
      slRenderList();
      slClearResults();
    });
    act.appendChild(del);
    tr.appendChild(act);
    body.appendChild(tr);
  });
}

function slClearResults(){
  const r = document.getElementById('slResults');
  if(r) r.textContent = '';
}

function slAddItem(){
  const select = document.getElementById('slProduct');
  const qtyInput = document.getElementById('slQty');
  const id = parseInt(select.value, 10);
  const qty = Math.floor(parseFloat(qtyInput.value));
  if(!Number.isFinite(id)){ slMessage('Choose a product first.', 'error'); return; }
  if(!Number.isFinite(qty) || qty < 1 || qty > 99){ slMessage('Quantity must be from 1 to 99.', 'error'); return; }

  const existing = slItems.find(x => x.id === id);
  if(existing) existing.qty = Math.min(99, existing.qty + qty);
  else slItems.push({ id, qty });
  slSaveList(slItems);

  select.value = '';
  qtyInput.value = '1';
  slMessage('');
  slRenderList();
  slClearResults();
}

function slClearList(){
  if(slItems.length === 0) return;
  if(!confirm('Remove everything from your shopping list?')) return;
  slItems = [];
  slSaveList(slItems);
  slRenderList();
  slClearResults();
  slMessage('');
}

function slSwap(fromId, toId){
  const from = slItems.find(x => x.id === fromId);
  if(!from) return;
  const to = slItems.find(x => x.id === toId);
  if(to){ to.qty = Math.min(99, to.qty + from.qty); slItems = slItems.filter(x => x !== from); }
  else from.id = toId;
  slSaveList(slItems);
  slRenderList();
  slCompare();
}

function slTable(headers, rows){
  const table = slEl('table', 'budget-table sl-table');
  const thead = slEl('thead'); const hr = slEl('tr');
  headers.forEach(h => hr.appendChild(slEl('th', '', h)));
  thead.appendChild(hr); table.appendChild(thead);
  const tbody = slEl('tbody');
  rows.forEach(r => tbody.appendChild(r));
  table.appendChild(tbody);
  return table;
}

function slRow(cells, cls){
  const tr = slEl('tr', cls || '');
  cells.forEach(c => {
    const td = slEl('td');
    if(c instanceof Node) td.appendChild(c); else td.textContent = c;
    tr.appendChild(td);
  });
  return tr;
}

function slSection(title, hint){
  const s = slEl('div', 'sl-section');
  s.appendChild(slEl('div', 'sl-section-title', title));
  if(hint) s.appendChild(slEl('div', 'sl-hint', hint));
  return s;
}

function slRenderResults(a){
  const out = document.getElementById('slResults');
  out.textContent = '';

  /* --- summary --- */
  const sum = slEl('div', 'sl-summary');
  const total = slEl('div');
  total.append('Cheapest combination: ', slEl('b', '', slPeso(a.mixedTotal)));
  sum.appendChild(total);
  if(a.plan){
    const status = slEl('div', 'sl-status ' + (a.mixedTotal <= a.budgetCents ? 'ok' : 'over'));
    if(a.mixedTotal <= a.budgetCents){
      status.textContent = '✅ Within your ' + slPeso(a.budgetCents) + ' budget — ' + slPeso(a.budgetCents - a.mixedTotal) + ' left.';
    } else {
      status.textContent = '⚠️ Over your ' + slPeso(a.budgetCents) + ' budget by ' + slPeso(a.mixedTotal - a.budgetCents) + '.';
    }
    sum.appendChild(status);
  } else {
    sum.appendChild(slEl('div', 'sl-hint', 'Enter a budget above to see how much is left.'));
  }
  out.appendChild(sum);

  /* --- over budget: swap plan --- */
  if(a.plan && a.mixedTotal > a.budgetCents){
    const sec = slSection('🔄 How to fit your budget');
    if(a.plan.swaps.length === 0){
      sec.appendChild(slEl('div', 'sl-note', 'No cheaper alternatives found for these items. Try removing an item or raising the budget.'));
    } else {
      const ul = slEl('ul', 'sl-plan');
      a.plan.swaps.forEach(s => {
        ul.appendChild(slEl('li', '', 'Swap ' + s.line.product.name + ' → ' + s.alt.product.name + ' (save ' + slPeso(s.alt.saving) + ')'));
      });
      sec.appendChild(ul);
      const result = slEl('div', 'sl-status ' + (a.plan.fits ? 'ok' : 'over'));
      result.textContent = a.plan.fits
        ? 'With these swaps: ' + slPeso(a.plan.total) + ' — ' + slPeso(a.plan.left) + ' left.'
        : 'Even with every swap you are still ' + slPeso(a.plan.total - a.budgetCents) + ' over (' + slPeso(a.plan.total) + '). Try removing an item.';
      sec.appendChild(result);
    }
    out.appendChild(sec);
  }

  /* --- store comparison --- */
  const storeSec = slSection('🏬 Store comparison', 'Total cost of your whole list at each store.');
  if(a.storeRows.length === 0){
    storeSec.appendChild(slEl('div', 'sl-note', 'No store has prices for these items yet.'));
  } else {
    const rows = a.storeRows.map(r => {
      const nameCell = slEl('span');
      nameCell.textContent = r.store.name + (r.store.verified ? ' ✔' : '');
      if(a.bestStore && r === a.bestStore) nameCell.appendChild(slEl('span', 'sl-badge', 'Cheapest store'));
      const status = r.complete ? 'Has all items' : 'Missing ' + r.missing.length + ': ' + r.missing.join(', ');
      const totalText = r.complete ? slPeso(r.total) : slPeso(r.total) + '*';
      return slRow([nameCell, totalText, status], a.bestStore && r === a.bestStore ? 'sl-best' : (r.complete ? '' : 'sl-partial'));
    });
    storeSec.appendChild(slTable(['Store', 'Total', 'Availability'], rows));
    if(a.storeRows.some(r => !r.complete)){
      storeSec.appendChild(slEl('div', 'sl-hint', '* Total only counts the items that store sells.'));
    }
    if(a.bestStore && a.mixedTotal < a.bestStore.total){
      storeSec.appendChild(slEl('div', 'sl-note ok',
        'Buying each item where it is cheapest saves ' + slPeso(a.bestStore.total - a.mixedTotal) +
        ' compared with shopping only at ' + a.bestStore.store.name + '.'));
    }
  }
  out.appendChild(storeSec);

  /* --- cheapest combination --- */
  const comboSec = slSection('🛒 Cheapest combination', 'Where to buy each item.');
  comboSec.appendChild(slTable(['Item', 'Qty', 'Buy at', 'Price', 'Subtotal'],
    a.lines.map(l => slRow([
      l.product.name, '× ' + l.qty, l.product.lowestStore,
      slPeso(l.product.lowest), slPeso(l.product.lowest * l.qty)
    ]))));
  out.appendChild(comboSec);

  /* --- alternatives --- */
  const altSec = slSection('💡 Cheaper alternatives', 'Similar products that cost less. Check the size or brand before swapping.');
  if(a.alternatives.length === 0){
    altSec.appendChild(slEl('div', 'sl-note', 'You already have the cheapest option for each item.'));
  } else {
    const rows = [];
    a.alternatives.forEach(x => {
      x.alts.forEach(alt => {
        const btn = slEl('button', 'btn sl-swap', 'Swap');
        btn.type = 'button';
        btn.addEventListener('click', () => slSwap(x.line.product.id, alt.product.id));
        rows.push(slRow([
          x.line.product.name + ' (' + slPeso(x.line.product.lowest) + ')',
          alt.product.name + ' (' + slPeso(alt.product.lowest) + ')',
          'Save ' + slPeso(alt.saving),
          btn
        ]));
      });
    });
    altSec.appendChild(slTable(['Instead of', 'Try', 'You save', ''], rows));
  }
  out.appendChild(altSec);
}

async function slCompare(){
  if(slItems.length === 0){ slMessage('Add at least one product to your list first.', 'error'); return; }

  const budgetValue = parseFloat(document.getElementById('slBudget').value);
  if(document.getElementById('slBudget').value !== '' && (!isFinite(budgetValue) || budgetValue <= 0)){
    slMessage('Budget must be greater than 0 (or leave it empty).', 'error');
    return;
  }

  slMessage('Comparing prices...');
  try{
    await slLoadCatalog();   // always fresh prices
  } catch(err){
    console.error(err);
    slMessage('Could not load prices. Check that Apache and MySQL are running.', 'error');
    return;
  }
  slMessage('');

  const budgetCents = isFinite(budgetValue) && budgetValue > 0 ? slCents(budgetValue) : 0;
  const analysis = slAnalyze(slCatalog, slItems, budgetCents);
  if(analysis.lines.length === 0){
    slMessage('The products on your list are no longer available. Remove them and add new ones.', 'error');
    return;
  }
  slRenderResults(analysis);
}

function slInit(){
  if(!document.getElementById('slProduct')) return;
  slItems = slLoadList();
  slRenderList();

  // start the budget field from the budget already saved on the Budget screen
  const budgetField = document.getElementById('slBudget');
  try{
    const saved = JSON.parse(localStorage.getItem('tipidgo.budget.v1'));
    if(saved && saved.budget > 0 && !budgetField.value) budgetField.value = saved.budget;
  } catch(err){ /* ignore */ }

  slLoadCatalog().then(slRenderList).catch(err => {
    console.error(err);
    slMessage('Could not load products. Check that Apache and MySQL are running.', 'error');
  });
}

if(typeof document !== 'undefined'){
  document.addEventListener('DOMContentLoaded', slInit);
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = { slBuildCatalog, slAnalyze, slAlternatives, slPeso };
}
