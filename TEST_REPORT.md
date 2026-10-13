# TipidGo - System and role test report

Run with the real pages and real PHP code (database replaced by a test stand-in, see `shim_db.php`). Result: **162 access checks + 62 feature checks + 27 screen/UI checks (`ui_sweep.js`), all passing.**

## Who can call what (server-enforced)

| Endpoint | Visitor | Store owner | Moderator | Admin |
|---|:-:|:-:|:-:|:-:|
| products / stores / price_list / product_detail (read) | ✅ | ✅ | ✅ | ✅ |
| feedback / requests (submit) | ✅ | ✅ | ✅ | ✅ |
| feedback / requests (read lists), inbox | ❌ | ❌ | ✅ | ✅ |
| owner_applications (review) | ❌ | ❌ | ✅ pending only | ✅ all, can revoke |
| owner_store_photo | ❌ | ❌ | ✅ | ✅ |
| owner_store, owner_prices, owner_dashboard | ❌ | ✅ own store | ❌ | ✅ prices, any store |
| manage_products | ❌ | ❌ | add/edit | add/edit/delete |
| manage_stores | ❌ | ❌ | location + verified only | full |
| manage_users, moderators | ❌ | ❌ | ❌ | ✅ |
| settings (change), upgrade | ❌ | ❌ | ❌ | ✅ |

Refusals: **401** = not signed in, **403** = signed in but the role is not allowed.

## Cases checked in `access.js`
- Every endpoint above x anonymous / registered user / approved owner / pending owner / moderator / admin.
- Pending and rejected owners cannot sign in; registered plain users cannot use staff sign-in.
- Owner A cannot write prices into, edit, or see owner B's store (a store id sent by the browser is ignored); an owner cannot mark their own store verified.
- Moderator sees only pending applications, cannot revoke approvals, cannot delete products, cannot add/delete stores, cannot rename a store.
- Admin revoking an owner removes that owner's access immediately; re-approving restores it.
- Deleting a user or removing a moderator ends their open session at once.
- Forged session cookie, role injected in the registration body, cross-site POST and DELETE carrying an admin session: all refused; same-site requests still work.
- Navigation per role (guest, moderator, admin, owner) and every menu item opens without error; no Delete buttons for moderators; direct visits to `dashboard.html` by guests/plain users go back to the public site.

## Bugs this round found and fixed
1. A user deleted while signed in could still read their profile and stay "logged in" on the public site (`profile.php`, `session.php`).
2. Opening the public site while signed in bounced staff straight back to their dashboard, so "View public site" never worked. Only a fresh sign-in redirects now.
3. Product pictures were looked up one folder too high (`/images/...` instead of `HTML/images/...`), so every product showed the fallback icon. Pictures now resolve next to the page, with the project-root folder as a second try; demo pictures for all 13 sample products are included in `HTML/images/` and set in `database.sql`.
4. Visitors triggered a 401 error on every page load from the feedback/requests lists. They now see a short note and no request is made.
5. Added a favicon (the browser was asking for one and getting a 404).

## Optimization pass (behaviour unchanged, all suites re-run and passing)
- Removed 6 unreachable mock screens (old Moderator/Verification pages) and their script entries: `index.html` 37.3 KB -> 23.8 KB, 897 -> 606 lines.
- Ten copy-pasted side menus replaced by one shared template built by `script.js`.
- `products.php`: 1 + 2 queries per product (27 for the demo data) -> 1 query for any number of products.
- `admin_summary.php`: 7 queries -> 1.
- Product pictures load lazily; `.htaccess` adds compression and stops the browser caching API answers (prices stay fresh).

## v15 UI polish
- Prices now formatted consistently as ₱1,234.56 (grid, detail, comparison table, history).
- Product SVGs made transparent so they match card backgrounds.
- Content area gets top padding so the account badge no longer overlaps content.
- Re-ran e2e 62/62, access 162/162, sweep2 27/27.
