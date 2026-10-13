# TipidGo test suite (for developers / defense)

These scripts are **not needed to run the system**. They test it automatically.

- `suggest.test.js` - unit tests for the budget-suggestion algorithm: `node suggest.test.js ../HTML/budget-suggestions.js`
- `e2e.js` - end-to-end test (62 checks) of the real pages + real PHP: product comparison, category filter, search, budget, suggestions, shopping list, feedback/requests, store-owner apply -> moderator approve -> owner sets prices -> public sees the new price, admin management, role permissions.
- `roles.js` - dashboard navigation per role (mocked API).
- `shim_db.php` + `seed.py` - a test-only SQLite stand-in for MySQL so `e2e.js` can run without XAMPP. Needs PHP, Python, Node and `playwright`.

Normal manual testing: follow the access matrix in the main README with accounts for each role.
