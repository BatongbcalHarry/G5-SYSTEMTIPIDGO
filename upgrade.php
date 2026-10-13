<?php
// ============================================================
// POST /api/upgrade.php   (administrator only)
// Database health check + repair for databases created before the
// reliability constraints existed. Safe to run any number of times.
//   - removes duplicate price rows (keeps the most recent one)
//   - adds UNIQUE (product, store) on prices, so a store can never have two
//     prices for one product again
//   - adds UNIQUE names on products / stores when no duplicates block it
//   - adds CHECK rules (price > 0, base price >= 0)
//   - adds a lookup index on price_history
// Returns a list of what it found and did.
// ============================================================
header('Content-Type: application/json');
session_start();
require 'db.php';
require 'auth.php';
require_role(['admin']);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'Use POST');

$report = [];
$note = function ($ok, $text) use (&$report) { $report[] = ['ok' => $ok, 'text' => $text]; };

function index_exists($conn, $table, $name) {
    $q = $conn->prepare("SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1");
    $q->bind_param('ss', $table, $name);
    $q->execute();
    return (bool)$q->get_result()->fetch_assoc();
}
function constraint_exists($conn, $table, $name) {
    $q = $conn->prepare("SELECT 1 FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = ? AND constraint_name = ? LIMIT 1");
    $q->bind_param('ss', $table, $name);
    $q->execute();
    return (bool)$q->get_result()->fetch_assoc();
}
function attempt($note, $label, callable $fn) {
    try { $fn(); } catch (Throwable $e) { $note(false, "$label: could not apply (" . $e->getMessage() . ')'); }
}

// 1. duplicate prices
attempt($note, 'Duplicate prices', function () use ($conn, $note) {
    $conn->query("DELETE a FROM prices a JOIN prices b
        ON a.product_id = b.product_id AND a.store_id = b.store_id
       AND (a.last_updated < b.last_updated OR (a.last_updated = b.last_updated AND a.id < b.id))");
    $removed = $conn->affected_rows;
    $note(true, $removed > 0 ? "Removed $removed duplicate price row(s), keeping the newest." : 'No duplicate prices.');
});

// 2. unique price per store + product
attempt($note, 'Price uniqueness', function () use ($conn, $note) {
    if (index_exists($conn, 'prices', 'uq_price_product_store')) { $note(true, 'One price per store and product is enforced.'); return; }
    $conn->query("ALTER TABLE prices ADD UNIQUE KEY uq_price_product_store (product_id, store_id)");
    $note(true, 'Added: one price per store and product.');
});

// 3. unique product names / store names
attempt($note, 'Product names', function () use ($conn, $note) {
    if (index_exists($conn, 'products', 'uq_product_name')) { $note(true, 'Product names are unique.'); return; }
    $dups = $conn->query("SELECT name, COUNT(*) c FROM products GROUP BY name HAVING c > 1")->fetch_assoc();
    if ($dups) { $note(false, "Two products are both named \"{$dups['name']}\". Rename or delete one in Products, then run this again."); return; }
    $conn->query("ALTER TABLE products ADD UNIQUE KEY uq_product_name (name)");
    $note(true, 'Added: product names must be unique.');
});
attempt($note, 'Store names', function () use ($conn, $note) {
    if (index_exists($conn, 'stores', 'uq_store_name_location')) { $note(true, 'Store name + location is unique.'); return; }
    $dups = $conn->query("SELECT name, location, COUNT(*) c FROM stores GROUP BY name, location HAVING c > 1")->fetch_assoc();
    if ($dups) { $note(false, "Two stores are both \"{$dups['name']}\" at the same location. Rename or delete one in Stores, then run this again."); return; }
    $conn->query("ALTER TABLE stores ADD UNIQUE KEY uq_store_name_location (name, location)");
    $note(true, 'Added: a store name can only appear once per location.');
});

// 4. value rules
attempt($note, 'Price rule', function () use ($conn, $note) {
    if (constraint_exists($conn, 'prices', 'chk_price_positive')) { $note(true, 'Prices must be above zero (enforced).'); return; }
    $bad = (int)$conn->query("SELECT COUNT(*) c FROM prices WHERE price <= 0")->fetch_assoc()['c'];
    if ($bad) { $note(false, "$bad price row(s) are zero or negative. Fix them in Store prices, then run this again."); return; }
    $conn->query("ALTER TABLE prices ADD CONSTRAINT chk_price_positive CHECK (price > 0)");
    $note(true, 'Added: prices must be above zero.');
});
attempt($note, 'Base price rule', function () use ($conn, $note) {
    if (constraint_exists($conn, 'products', 'chk_base_price')) { $note(true, 'Base prices cannot be negative (enforced).'); return; }
    $conn->query("ALTER TABLE products ADD CONSTRAINT chk_base_price CHECK (base_price >= 0)");
    $note(true, 'Added: base price cannot be negative.');
});

// 5. history index
attempt($note, 'History index', function () use ($conn, $note) {
    if (index_exists($conn, 'price_history', 'idx_history_lookup')) { $note(true, 'Price history is indexed.'); return; }
    $conn->query("ALTER TABLE price_history ADD INDEX idx_history_lookup (product_id, store_id, recorded_date)");
    $note(true, 'Added a lookup index on price history.');
});

// 6. data that looks wrong (report only)
attempt($note, 'Data check', function () use ($conn, $note) {
    $n = (int)$conn->query("SELECT COUNT(*) c FROM products p WHERE NOT EXISTS (SELECT 1 FROM prices x WHERE x.product_id = p.id)")->fetch_assoc()['c'];
    $note(true, $n ? "$n product(s) have no store price yet (they show their base price)." : 'Every product has at least one store price.');
    $m = (int)$conn->query("SELECT COUNT(*) c FROM stores WHERE location IS NULL OR location = ''")->fetch_assoc()['c'];
    $note($m === 0, $m ? "$m store(s) have no location - the map cannot place them." : 'Every store has a location.');
});

echo json_encode(['report' => $report]);
