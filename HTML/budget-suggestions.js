/* ============================================================
   BUDGET-BASED SUGGESTIONS
   The user enters a budget and TipidGo builds four suggestions
   from the LIVE lowest prices in the database (api/products.php):

     🍚 Basic Needs   🍳 Breakfast Set   🍝 Meal Set   🛒 Best Value

   Each suggestion shows its items, the total, and how much money
   is left. Nothing is saved - it is recalculated every time.

   To change what goes into a set, edit SUGGESTION_SETS below.
   Each "slot" is one item in the set. A slot lists words that
   are matched against product names (e.g. /rice/ matches
   "Rice (1kg)"). The cheapest matching product is used.
     required: true  -> the set is only shown if this slot fits
     required: false -> added only while there is still money left
   Slots are filled in the order listed, so put the most
   important ones first.
   ============================================================ */

const SUGGESTION_SETS = [
  {
    key: 'basic',
    icon: '🍚',
    title: 'Basic Needs',
    blurb: 'Everyday staples, cooking and cleaning essentials.',
    slots: [
      { label: 'Rice',          match: /\brice\b|\bbigas\b/i,                    required: true  },
      { label: 'Cooking oil',   match: /\boil\b/i,                               required: true  },
      { label: 'Soap',          match: /\bsoap\b/i,                              required: true  },
      { label: 'Detergent',     match: /detergent|laundry/i,                     required: false },
      { label: 'Salt',          match: /\bsalt\b|\basin\b/i,                     required: false },
      { label: 'Canned food',   match: /sardine|corned|tuna|canned|meat ?loaf/i, required: false }
    ]
  },
  {
    key: 'breakfast',
    icon: '🍳',
    title: 'Breakfast Set',
    blurb: 'Rice or grits with egg, plus a drink or something extra.',
    slots: [
      { label: 'Rice / grits',  match: /\brice\b|\bbigas\b|corn ?grits/i,        required: true  },
      { label: 'Egg',           match: /\beggs?\b|\bitlog\b/i,                   required: true  },
      { label: 'Coffee / milk', match: /coffee|\bkape\b|\bmilk\b|\bgatas\b/i,    required: false },
      { label: 'Bread',         match: /\bbread\b|pandesal/i,                    required: false },
      { label: 'Canned meat',   match: /corned|hotdog|sardine|meat ?loaf/i,      required: false },
      { label: 'Cooking oil',   match: /\boil\b/i,                               required: false }
    ]
  },
  {
    key: 'meal',
    icon: '🍝',
    title: 'Meal Set',
    blurb: 'A complete lunch or dinner: rice, ulam and seasoning.',
    slots: [
      { label: 'Rice',          match: /\brice\b|\bbigas\b/i,                    required: true  },
      { label: 'Ulam',          match: /sardine|corned|tuna|canned|meat ?loaf|noodle|pancit/i, required: true },
      { label: 'Cooking oil',   match: /\boil\b/i,                               required: false },
      { label: 'Seasoning',     match: /vinegar|\bsuka\b|soy ?sauce|\btoyo\b|\bsalt\b|\basin\b/i, required: false },
      { label: 'Egg',           match: /\beggs?\b|\bitlog\b/i,                   required: false }
    ]
  }
];

/* ---------- helpers (money is handled in centavos to avoid float errors) ---------- */
function toCentavos(n){ return Math.round(Number(n) * 100); }

function peso(centavos){
  return '₱' + (centavos / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function priced(products){
  return (products || [])
    .map(p => ({
      id: p.id,
      name: String(p.name || ''),
      category: String(p.category || ''),
      store: p.lowestStore || '',
      cents: toCentavos(p.lowestPrice)
    }))
    .filter(p => p.name && isFinite(p.cents) && p.cents > 0);
}

/* ---------- builds one themed set (Basic Needs / Breakfast / Meal) ---------- */
function buildThemedSet(def, products, budgetCents){
  const used = new Set();
  const picked = [];   // { slot, product }
  let missingRequired = false;

  // For each slot, find the cheapest product that matches and isn't already used.
  def.slots.forEach(slot => {
    const candidates = products
      .filter(p => !used.has(p.id) && slot.match.test(p.name))
      .sort((a, b) => a.cents - b.cents);
    if(candidates.length === 0){
      if(slot.required) missingRequired = true;
      return;
    }
    const choice = candidates[0];
    used.add(choice.id);
    picked.push({ slot, product: choice });
  });

  const base = { key: def.key, icon: def.icon, title: def.title, blurb: def.blurb };

  if(missingRequired){
    return { ...base, status: 'unavailable', items: [], total: 0, left: budgetCents,
             note: 'Not enough product data yet to build this set.' };
  }

  // Required items first - if even those don't fit, the budget is too small.
  const required = picked.filter(x => x.slot.required);
  const requiredTotal = required.reduce((s, x) => s + x.product.cents, 0);
  if(requiredTotal > budgetCents){
    return { ...base, status: 'too-low', items: [], total: 0, left: budgetCents,
             needed: requiredTotal,
             note: 'You need at least ' + peso(requiredTotal) + ' for this set (' + peso(requiredTotal - budgetCents) + ' more).' };
  }

  // Then add optional items in order, as long as they still fit.
  const chosen = new Set(required);
  let total = requiredTotal;
  picked.forEach(x => {
    if(x.slot.required) return;
    if(total + x.product.cents <= budgetCents){
      chosen.add(x);
      total += x.product.cents;
    }
  });

  const items = picked.filter(x => chosen.has(x)).map(x => x.product);
  return { ...base, status: 'ok', items, total, left: budgetCents - total, note: '' };
}

/* ---------- Best Value: the most different items your money can buy ----------
   Goes round-robin through the categories (so you don't end up with only
   one kind of thing), always taking the cheapest item left in each. */
function buildBestValue(products, budgetCents){
  const base = { key: 'best', icon: '🛒', title: 'Best Value',
                 blurb: 'The most items your money can buy, mixed across categories.' };

  const queues = {};
  products.forEach(p => { (queues[p.category] = queues[p.category] || []).push(p); });
  Object.values(queues).forEach(q => q.sort((a, b) => a.cents - b.cents));

  const items = [];
  let total = 0;
  let active = Object.values(queues).filter(q => q.length);

  while(active.length){
    const stillActive = [];
    active.forEach(q => {
      const next = q[0];
      if(total + next.cents <= budgetCents){
        items.push(next);
        total += next.cents;
        q.shift();
        if(q.length) stillActive.push(q);
      }
      // If the cheapest item left in a category doesn't fit, nothing else in it will.
    });
    active = stillActive;
  }

  if(items.length === 0){
    const cheapest = products.length ? Math.min(...products.map(p => p.cents)) : 0;
    return { ...base, status: cheapest ? 'too-low' : 'unavailable', items: [], total: 0, left: budgetCents,
             needed: cheapest,
             note: cheapest ? 'The cheapest item costs ' + peso(cheapest) + '.' : 'No priced products yet.' };
  }

  items.sort((a, b) => a.cents - b.cents);
  return { ...base, status: 'ok', items, total, left: budgetCents - total, note: '' };
}

/* ---------- public: all four suggestions for a budget (in pesos) ---------- */
function buildBudgetSuggestions(rawProducts, budgetPesos){
  const budgetCents = toCentavos(budgetPesos);
  const products = priced(rawProducts);
  const results = SUGGESTION_SETS.map(def => buildThemedSet(def, products, budgetCents));
  results.push(buildBestValue(products, budgetCents));
  return results;
}

/* ============================================================
   UI
   ============================================================ */
function suggestionMessage(text, kind){
  const box = document.getElementById('suggestMessage');
  if(!box) return;
  box.textContent = text || '';
  if(kind) box.dataset.kind = kind; else delete box.dataset.kind;
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

  const blurb = document.createElement('div');
  blurb.className = 'suggest-blurb';
  blurb.textContent = s.blurb;
  card.appendChild(blurb);

  if(s.status !== 'ok'){
    const note = document.createElement('div');
    note.className = 'suggest-note';
    note.textContent = s.note;
    card.appendChild(note);
    return card;
  }

  const list = document.createElement('ul');
  list.className = 'suggest-items';
  s.items.forEach(p => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'suggest-name';
    name.textContent = p.name;
    if(p.store){
      const store = document.createElement('small');
      store.textContent = p.store;
      name.appendChild(store);
    }
    const price = document.createElement('b');
    price.textContent = peso(p.cents);
    li.append(name, price);
    list.appendChild(li);
  });
  card.appendChild(list);

  const totals = document.createElement('div');
  totals.className = 'suggest-totals';
  [['Total', peso(s.total), ''], ['Money left', peso(s.left), 'left']].forEach(([label, value, cls]) => {
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

  suggestionMessage('Finding the best picks for ' + peso(toCentavos(budget)) + '...');
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

  const suggestions = buildBudgetSuggestions(products, budget);
  suggestionMessage('Suggestions use the lowest price found for each product.');
  suggestions.forEach(s => results.appendChild(renderSuggestionCard(s)));
}

if(typeof document !== 'undefined'){
  document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('suggestBudget');
    if(!input) return;
    input.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); suggestForBudget(); } });
  });
}

// Lets the logic be tested in Node without a browser (ignored in the browser).
if(typeof module !== 'undefined' && module.exports){
  module.exports = { buildBudgetSuggestions, peso };
}
