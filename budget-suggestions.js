/* ============================================================
   NEED-BASED BUDGET SUGGESTIONS
   The user enters a budget and chooses what they need:

        🍚 Food    🧼 Household    🧴 Personal care    🛒 Any

   TipidGo then builds the best combination from the LIVE lowest
   prices in the database (api/products.php) - it does not look
   for particular product names, it works from product categories.

   HOW THE COMBINATION IS BUILT
   1. Every product belongs to a GROUP (Rice & grains, Eggs & dairy,
      Cooking essentials, Canned goods, Household cleaning, Personal
      care). The groups used depend on what the user picked.
   2. Essentials first: the cheapest product from each group, biggest
      groups first, so the basket covers every kind of need.
   3. Then the rest of the money is spent evenly: each step adds the
      cheapest unused product from whichever group has received the
      least money compared with its weight. This stops the basket
      from filling up with only one kind of item.
   4. A second option, "Most items", simply buys the cheapest products
      first so the user can see the largest number of items.
   Nothing is saved - it is recalculated every time.

   To change how products are grouped or how much each group matters,
   edit GROUPS below (weight = how big a share of the money it gets).
   ============================================================ */

const NEEDS = [
  { key: 'food',      icon: '🍚', label: 'Food',          hint: 'Rice, eggs, cooking and canned goods' },
  { key: 'household', icon: '🧼', label: 'Household',     hint: 'Laundry and dishwashing' },
  { key: 'personal',  icon: '🧴', label: 'Personal care', hint: 'Bath soap, shampoo, toothpaste' },
  { key: 'any',       icon: '🛒', label: 'Any',           hint: 'A balanced mix of everything' }
];

// Products in the "hygiene" category are split into household vs personal care by name.
const HOUSEHOLD_WORDS = /detergent|laundry|\bdish|bleach|cleaner|fabric|floor|toilet|zonrox|\bmop\b|sponge|\bbasura\b|garbage/i;

const KNOWN_CATEGORIES = ['grains', 'dairy', 'cooking', 'canned', 'hygiene'];

const GROUPS = [
  { key: 'grains',    need: 'food',      label: 'Rice & grains',       weight: 3, test: p => p.category === 'grains' },
  { key: 'canned',    need: 'food',      label: 'Canned goods',        weight: 3, test: p => p.category === 'canned' },
  { key: 'dairy',     need: 'food',      label: 'Eggs & dairy',        weight: 2, test: p => p.category === 'dairy' },
  { key: 'cooking',   need: 'food',      label: 'Cooking essentials',  weight: 2, test: p => p.category === 'cooking' },
  { key: 'household', need: 'household', label: 'Household cleaning',  weight: 2, test: p => p.category === 'hygiene' && HOUSEHOLD_WORDS.test(p.name) },
  { key: 'personal',  need: 'personal',  label: 'Personal care',       weight: 2, test: p => p.category === 'hygiene' && !HOUSEHOLD_WORDS.test(p.name) },
  // products whose category is not one of the known ones still count as food
  { key: 'otherfood', need: 'food',      label: 'Other food items',    weight: 1, test: p => !KNOWN_CATEGORIES.includes(p.category) }
];

/* ---------- helpers (money is handled in centavos to avoid float errors) ---------- */
function toCentavos(n){ return Math.round(Number(n) * 100); }

function peso(centavos){
  return '₱' + (centavos / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function priced(products){
  return (products || [])
    .map(p => {
      const cents = toCentavos(p.lowestPrice);
      const high = p.highestPrice === null || p.highestPrice === undefined ? cents : toCentavos(p.highestPrice);
      return {
        id: p.id,
        name: String(p.name || ''),
        category: String(p.category || '').trim().toLowerCase(),
        store: p.lowestStore === undefined ? '' : p.lowestStore,
        cents,
        highCents: Math.max(cents, high)
      };
    })
    // a product no store has priced yet only has its base price - never suggest it
    .filter(p => p.name && isFinite(p.cents) && p.cents > 0 && p.store !== null);
}

// which needs are active: nothing selected, or "any", means everything
function activeNeeds(selected){
  const list = (selected || []).filter(k => NEEDS.some(n => n.key === k));
  if(list.length === 0 || list.includes('any')) return ['food', 'household', 'personal'];
  return list;
}

function groupsWithProducts(products, needKeys){
  return GROUPS
    .filter(g => needKeys.includes(g.need))
    .map(g => ({
      ...g,
      pool: products.filter(g.test).sort((a, b) => a.cents - b.cents || a.name.localeCompare(b.name))
    }))
    .filter(g => g.pool.length > 0);
}

function summarize(base, items, total, budgetCents, groups){
  const saved = items.reduce((s, x) => s + (x.highCents - x.cents), 0);
  const covered = new Set(items.map(x => x.groupKey)).size;
  return { ...base, status: 'ok', items, total, left: budgetCents - total, saved,
           covered, available: groups.length, note: '' };
}

/* ---------- Recommended: a balanced basket ---------- */
function buildBalanced(groups, budgetCents){
  const base = { key: 'best', icon: '✨', title: 'Best combination',
                 blurb: 'Balanced across what you need, using the lowest prices.' };
  const used = new Set();
  const items = [];
  const spentBy = {};
  groups.forEach(g => { spentBy[g.key] = 0; });
  let total = 0;

  const add = (g, product) => {
    used.add(product.id);
    items.push({ ...product, groupKey: g.key, groupLabel: g.label });
    spentBy[g.key] += product.cents;
    total += product.cents;
  };

  // 1) essentials: the cheapest product of each group, biggest groups first
  groups.slice().sort((a, b) => b.weight - a.weight).forEach(g => {
    const cheapest = g.pool[0];
    if(total + cheapest.cents <= budgetCents) add(g, cheapest);
  });

  // 2) spend the rest evenly: the group that has had the least money for its weight goes next
  for(;;){
    let best = null;
    groups.forEach(g => {
      const next = g.pool.find(p => !used.has(p.id) && total + p.cents <= budgetCents);
      if(!next) return;
      const ratio = spentBy[g.key] / g.weight;
      if(!best || ratio < best.ratio || (ratio === best.ratio && g.weight > best.group.weight)){
        best = { group: g, product: next, ratio };
      }
    });
    if(!best) break;
    add(best.group, best.product);
  }

  if(items.length === 0){
    const cheapest = Math.min(...groups.map(g => g.pool[0].cents));
    return { ...base, status: 'too-low', items: [], total: 0, left: budgetCents, needed: cheapest,
             note: 'The cheapest item here costs ' + peso(cheapest) + ', so this budget is too low.' };
  }

  // show items grouped together, cheapest first inside each group
  const order = groups.map(g => g.key);
  items.sort((a, b) => order.indexOf(a.groupKey) - order.indexOf(b.groupKey) || a.cents - b.cents);
  return summarize(base, items, total, budgetCents, groups);
}

/* ---------- Alternative: the largest number of items ---------- */
function buildMostItems(groups, budgetCents){
  const base = { key: 'most', icon: '🧺', title: 'Most items',
                 blurb: 'Cheapest products first: the most items, with the most money left over.' };
  const all = [];
  groups.forEach(g => g.pool.forEach(p => all.push({ ...p, groupKey: g.key, groupLabel: g.label })));
  all.sort((a, b) => a.cents - b.cents || a.name.localeCompare(b.name));

  const items = [];
  let total = 0;
  all.forEach(p => {
    if(total + p.cents <= budgetCents){ items.push(p); total += p.cents; }
  });
  if(items.length === 0) return { ...base, status: 'too-low', items: [], total: 0, left: budgetCents, note: '' };
  return summarize(base, items, total, budgetCents, groups);
}

/* ---------- public: suggestions for a budget (in pesos) and chosen needs ---------- */
function buildBudgetSuggestions(rawProducts, budgetPesos, selectedNeeds){
  const budgetCents = toCentavos(budgetPesos);
  const needs = activeNeeds(selectedNeeds);
  const groups = groupsWithProducts(priced(rawProducts), needs);

  if(groups.length === 0){
    return [{ key: 'best', icon: '✨', title: 'Best combination', blurb: '', status: 'unavailable',
              items: [], total: 0, left: budgetCents,
              note: 'There are no priced products for this need yet. Try "Any" or ask a store owner to add prices.' }];
  }

  const best = buildBalanced(groups, budgetCents);
  const results = [best];
  if(best.status === 'ok'){
    const most = buildMostItems(groups, budgetCents);
    const sameBasket = most.items.length === best.items.length &&
                       most.items.every(m => best.items.some(b => b.id === m.id));
    if(most.status === 'ok' && !sameBasket) results.push(most);
  }
  return results;
}

/* ============================================================
   UI
   ============================================================ */
let suggestNeeds = ['any'];

function suggestionMessage(text, kind){
  const box = document.getElementById('suggestMessage');
  if(!box) return;
  box.textContent = text || '';
  if(kind) box.dataset.kind = kind; else delete box.dataset.kind;
}

// "Any" excludes the others; picking a specific need un-picks "Any"; picking nothing falls back to "Any".
function toggleNeed(key){
  if(key === 'any'){
    suggestNeeds = ['any'];
  } else {
    const without = suggestNeeds.filter(k => k !== 'any');
    suggestNeeds = without.includes(key) ? without.filter(k => k !== key) : without.concat(key);
    if(suggestNeeds.length === 0) suggestNeeds = ['any'];
  }
  document.querySelectorAll('#suggestNeeds .need-chip').forEach(chip => {
    const on = suggestNeeds.includes(chip.dataset.need);
    chip.classList.toggle('active', on);
    chip.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  if(document.getElementById('suggestResults') && document.getElementById('suggestResults').children.length){
    suggestForBudget();   // refresh the result for the new choice
  }
}

function renderNeedChips(){
  const box = document.getElementById('suggestNeeds');
  if(!box || box.children.length) return;
  NEEDS.forEach(n => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'need-chip' + (suggestNeeds.includes(n.key) ? ' active' : '');
    chip.dataset.need = n.key;
    chip.title = n.hint;
    chip.setAttribute('aria-pressed', suggestNeeds.includes(n.key) ? 'true' : 'false');
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = n.icon;
    chip.append(icon, document.createTextNode(' ' + n.label));
    chip.addEventListener('click', () => toggleNeed(n.key));
    box.appendChild(chip);
  });
}

function renderSuggestionCard(s){
  const card = document.createElement('div');
  card.className = 'suggest-card' + (s.key === 'best' ? ' best' : '') + (s.status !== 'ok' ? ' muted' : '');

  const head = document.createElement('div');
  head.className = 'suggest-head';
  const icon = document.createElement('span');
  icon.className = 'suggest-icon';
  icon.textContent = s.icon;
  icon.setAttribute('aria-hidden', 'true');
  const title = document.createElement('span');
  title.textContent = s.title;
  head.append(icon, title);
  card.appendChild(head);

  if(s.blurb){
    const blurb = document.createElement('div');
    blurb.className = 'suggest-blurb';
    blurb.textContent = s.blurb;
    card.appendChild(blurb);
  }

  if(s.status !== 'ok'){
    const note = document.createElement('div');
    note.className = 'suggest-note';
    note.textContent = s.note;
    card.appendChild(note);
    return card;
  }

  const cover = document.createElement('div');
  cover.className = 'suggest-cover';
  cover.textContent = s.items.length + (s.items.length === 1 ? ' item' : ' items') +
                      ' · covers ' + s.covered + ' of ' + s.available + (s.available === 1 ? ' group' : ' groups');
  card.appendChild(cover);

  const list = document.createElement('ul');
  list.className = 'suggest-items';
  s.items.forEach(p => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'suggest-name';
    name.textContent = p.name;
    const small = document.createElement('small');
    small.textContent = p.groupLabel + (p.store ? ' · ' + p.store : '');
    name.appendChild(small);
    const price = document.createElement('b');
    price.textContent = peso(p.cents);
    li.append(name, price);
    list.appendChild(li);
  });
  card.appendChild(list);

  const totals = document.createElement('div');
  totals.className = 'suggest-totals';
  const rows = [['Total', peso(s.total), ''], ['Money left', peso(s.left), 'left']];
  if(s.saved > 0) rows.push(['You save', peso(s.saved), 'left']);
  rows.forEach(([label, value, cls]) => {
    const row = document.createElement('div');
    const l = document.createElement('span');
    l.textContent = label;
    const v = document.createElement('b');
    v.textContent = value;
    if(cls) v.className = cls;
    row.append(l, v);
    totals.appendChild(row);
  });
  card.appendChild(totals);

  if(s.saved > 0){
    const hint = document.createElement('div');
    hint.className = 'suggest-hint';
    hint.textContent = '"You save" compares the lowest price with the highest price for the same products.';
    card.appendChild(hint);
  }

  // hand the basket to the Smart shopping list below (it compares stores for you)
  if(typeof slSaveList === 'function'){
    const use = document.createElement('button');
    use.type = 'button';
    use.className = 'btn suggest-use';
    use.textContent = 'Use as my shopping list';
    use.addEventListener('click', () => {
      const items = s.items.map(p => ({ id: p.id, qty: 1 }));
      slItems = items;
      slSaveList(items);
      if(typeof slRenderList === 'function') slRenderList();
      if(typeof slClearResults === 'function') slClearResults();
      suggestionMessage('Added ' + items.length + ' items to your Smart shopping list below.');
      const target = document.getElementById('slRows');
      if(target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    card.appendChild(use);
  }
  return card;
}

async function suggestForBudget(){
  const input = document.getElementById('suggestBudget');
  const results = document.getElementById('suggestResults');
  if(!input || !results) return;

  const budget = parseFloat(input.value);
  if(!isFinite(budget) || budget <= 0){
    suggestionMessage('Enter a budget greater than 0.', 'error');
    results.textContent = '';
    return;
  }

  suggestionMessage('Finding the best combination for ' + peso(toCentavos(budget)) + '...');
  results.textContent = '';

  let products;
  try{
    const res = await fetch(`${API_BASE}/products.php`);
    if(!res.ok) throw new Error('HTTP ' + res.status);
    products = await res.json();
    if(!Array.isArray(products)) throw new Error('Unexpected response');
  } catch(err){
    console.error(err);
    suggestionMessage('Could not load product prices. Check that Apache and MySQL are running.', 'error');
    return;
  }

  const suggestions = buildBudgetSuggestions(products, budget, suggestNeeds);
  const buildable = suggestions.some(s => s.items && s.items.length);
  suggestionMessage(buildable ? 'Built from the lowest price found for each product.' : '');
  suggestions.forEach(s => results.appendChild(renderSuggestionCard(s)));
}

if(typeof document !== 'undefined'){
  document.addEventListener('DOMContentLoaded', () => {
    renderNeedChips();
    const input = document.getElementById('suggestBudget');
    if(!input) return;
    input.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); suggestForBudget(); } });
  });
}

// Lets the logic be tested in Node without a browser (ignored in the browser).
if(typeof module !== 'undefined' && module.exports){
  module.exports = { buildBudgetSuggestions, peso, activeNeeds };
}
