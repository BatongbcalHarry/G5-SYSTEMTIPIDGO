const path = process.argv[2];
const { buildBudgetSuggestions, peso } = require(path);
const assert = require('assert');

const P = (id,name,category,low,high,store) => ({ id,name,category,lowestPrice:low,highestPrice:high,lowestStore:store,basePrice:high });
const products = [
  P(1,'Rice (1kg)','grains',54,56.5,'Puregold'), P(2,'Corn Grits (1kg)','grains',38,42,'Puregold'),
  P(3,'Eggs (tray of 30)','dairy',205,215,'Puregold'), P(4,'Fresh Milk (1L)','dairy',92,99,'SNR'),
  P(5,'Cooking Oil (1L)','cooking',92,97.5,'Puregold'), P(6,'Vinegar (1L)','cooking',26,30,'SNR'),
  P(7,'Sardines (155g)','canned',22.5,25,'Puregold'), P(8,'Corned Beef (150g)','canned',46,51,'SNR'),
  P(9,'Dishwashing Soap','hygiene',14.5,16,'SNR'), P(10,'Laundry Detergent (1kg)','hygiene',83,88,'Puregold'),
  P(11,'Bath Soap','hygiene',20,23.5,'Puregold'), P(12,'Shampoo (180ml)','hygiene',62,68,'SNR'),
  P(13,'Toothpaste (100g)','hygiene',43,47,'Puregold'),
];
const total = r => r.items.reduce((s,x)=>s+x.cents,0);
let n = 0; const ok = (c,m)=>{ assert(c,m); n++; };

for (const needs of [['any'],['food'],['household'],['personal'],['food','household'],[]]) {
  for (const budget of [10, 50, 100, 250, 500, 1000, 5000]) {
    const out = buildBudgetSuggestions(products, budget, needs);
    out.forEach(r => {
      if (r.status === 'ok') {
        ok(total(r) === r.total, 'total matches items');
        ok(r.total <= budget*100, `within budget: ${needs} ${budget} ${r.title} ${r.total}`);
        ok(r.left === budget*100 - r.total, 'left correct');
        ok(new Set(r.items.map(i=>i.id)).size === r.items.length, 'no duplicate products');
      }
    });
  }
}
// need filtering
const names = (needs,b) => buildBudgetSuggestions(products,b,needs)[0].items.map(i=>i.name);
ok(names(['food'],500).every(x=>!/Soap|Detergent|Shampoo|Toothpaste/.test(x)), 'food only has food');
ok(names(['household'],500).every(x=>/Dishwashing|Detergent/.test(x)), 'household only cleaning');
ok(names(['personal'],500).every(x=>/Bath Soap|Shampoo|Toothpaste/.test(x)), 'personal only personal care');
// 'any' with 500 covers every group (balance)
const any500 = buildBudgetSuggestions(products,500,['any'])[0];
ok(any500.covered === any500.available && any500.available === 6, 'any/500 covers all 6 groups');
// balance: with 500 on food, not all rice-type items
const f = buildBudgetSuggestions(products,500,['food'])[0];
ok(f.covered === 4, 'food/500 covers 4 groups');
// savings
ok(any500.saved > 0, 'savings computed');
// too low
const low = buildBudgetSuggestions(products,10,['any'])[0];
ok(low.status === 'too-low' && /14\.50/.test(low.note), 'too low message: ' + low.note);
// tiny but enough for one
ok(buildBudgetSuggestions(products,20,['any'])[0].items.length >= 1, 'one item for 20');
// "Most items" has at least as many items as balanced
const both = buildBudgetSuggestions(products,300,['any']);
if (both[1]) ok(both[1].items.length >= both[0].items.length, 'most items >= balanced');
// no products for a need
const none = buildBudgetSuggestions(products.filter(p=>p.category!=='hygiene'),500,['household']);
ok(none[0].status === 'unavailable', 'unavailable when no products');
// legacy category 'staples' still counted as food; missing highestPrice ok
const legacy = buildBudgetSuggestions([{id:1,name:'Rice',category:'staples',lowestPrice:50,lowestStore:'X'}],100,['food'])[0];
ok(legacy.status==='ok' && legacy.items.length===1 && legacy.saved===0, 'legacy category + no highestPrice');
// 5000 buys everything once, leftover shown
const big = buildBudgetSuggestions(products,5000,['any'])[0];
ok(big.items.length === 13 && big.left > 0, 'big budget buys all 13 once');
// determinism
ok(JSON.stringify(buildBudgetSuggestions(products,500,['any'])) === JSON.stringify(buildBudgetSuggestions(products,500,['any'])), 'deterministic');
console.log(n + ' assertions passed');
for (const [b,needs] of [[500,['any']],[500,['food']],[200,['household','personal']]]) {
  const r = buildBudgetSuggestions(products,b,needs);
  r.forEach(x => console.log(`\n${x.title} (budget ${b}, ${needs}) — ${x.items.length} items, total ${peso(x.total)}, left ${peso(x.left)}, saved ${peso(x.saved||0)}, covers ${x.covered}/${x.available}\n  ` + x.items.map(i=>`${i.name} ${peso(i.cents)}`).join('\n  ')));
}
