# TipidGo — Basic Goods Price Comparison System

A school capstone project (PHP + MySQL, built for XAMPP) that lets users compare
basic goods prices across stores, submit feedback and requests, and lets store
owners, moderators, and admins manage the system through separate dashboards.

## Project structure

```
G5-SYSTEMTIPIDGO/
├── database.sql            <- import this into phpMyAdmin first
├── HTML/
│   ├── index.html           <- main public site (login, products, stores, etc.)
│   ├── dashboard.html/.js    <- role dashboards (admin / moderator / store owner)
│   ├── admin.html, moderator.html, owner.html  <- old links, redirect to dashboard.html
│   ├── script.js             <- screen-switching / search / category filter logic
│   ├── api.js                <- connects the front-end to the PHP backend
│   ├── shopping-list.js      <- Budget screen: shopping list, store comparison, cheaper alternatives
│   ├── budget-suggestions.js <- Budget screen: "what can I afford?" suggestions
│   ├── style.css
│   ├── staff.css             <- shared staff dashboard styles
│   ├── tipidgo backround.png
│   └── images/                <- product pictures (demo ones included)
└── api/
    ├── auth.php               <- shared role check used by every staff endpoint
    ├── manage_products.php / manage_stores.php / manage_users.php
    ├── inbox.php              <- requests + feedback for staff
    ├── owner_store.php        <- owner edits their own store
    ├── upgrade.php            <- admin-only database check and repair
    ├── settings.php           <- public banner / admin settings
    ├── db.php                 <- MySQL connection settings
    ├── setup.php              <- ONE-TIME: creates staff accounts (needs ?key=, see below)
    ├── register.php           <- creates a new regular user account
    ├── register_owner.php     <- submits a pending store-owner application
    ├── login.php               <- staff/owner sign-in
    ├── logout.php
    ├── session.php             <- checks if someone is already logged in
    ├── owner_applications.php  <- moderator/admin approval decisions
    ├── owner_store_photo.php   <- serves a submitted store photo (staff only)
    ├── admin_summary.php       <- admin-only system counts
    ├── owner_dashboard.php     <- approved owner's store and current prices
    ├── owner_prices.php        <- add/update prices for that owner's store only
    ├── products.php            <- product list (with images + lowest price)
    ├── product_detail.php      <- one product's full price comparison + history
    ├── stores.php              <- store list
    ├── feedback.php            <- feedback list / submit feedback (guests and staff)
    ├── profile.php             <- signed-in account: view details, change name/password
    └── requests.php            <- price/product request list / submit request
```

## Setup steps

### 1. Copy the project into XAMPP's `htdocs` folder
Copy this whole project folder into:
```
C:\xampp\htdocs\tipidgo
```

### 2. Start Apache and MySQL
Open the **XAMPP Control Panel** and click **Start** next to both **Apache** and **MySQL**.

### 3. Import the database
1. Go to `http://localhost/phpmyadmin`.
2. Click **Import** → choose `database.sql` → **Go**.

This creates `tipidgo_db` with all the tables the system needs, plus a few sample products/stores so the site isn't empty.

### 4. Set a setup key and create staff accounts
Open `api/setup.php` and change this line near the top to your own secret value:
```php
define('SETUP_KEY', 'change-this-before-running');
```
Then, in your browser, open:
```
http://localhost/tipidgo/api/setup.php?key=YOUR_SETUP_KEY
```
This creates two staff accounts (safe to run more than once — it skips accounts that already exist):

| Email | Password | Role |
|---|---|---|
| admin@tipidgo.com | admin123 | admin |
| moderator@tipidgo.com | moderator123 | moderator |

**Change these default passwords (or delete the accounts and make your own) before showing this to anyone outside your group.** Once your accounts exist, it's safest to delete `api/setup.php` entirely so it isn't sitting on the server.

### 5. Open your site
```
http://localhost/tipidgo/HTML/
```
Register a normal account from here, or sign in with a staff account above.

## Budget-based suggestions

On the **Budget** screen, type an amount (e.g. ₱500), choose **what you need**, and press
**Build my combination**:

- 🍚 **Food** - rice and grains, canned goods, eggs and dairy, cooking essentials
- 🧼 **Household** - laundry and dishwashing
- 🧴 **Personal care** - bath soap, shampoo, toothpaste
- 🛒 **Any** - a balanced mix of everything

You can pick more than one (for example Food + Household). TipidGo builds the **best combination**
from the lowest current price of each product:

1. It first takes the cheapest item from every group you chose, so the basket covers each kind of need.
2. It then spends the remaining money evenly across the groups, instead of filling up with one kind of item.
3. It shows the **total**, the **money left**, and **how much you save** compared with buying the same
   products at the most expensive store.

A second card, **Most items**, buys the cheapest products first to get the largest number of items.
It only appears when it gives a different basket. **Use as my shopping list** sends a basket to the
Smart shopping list below, which then compares the total store by store.

How it works: products are grouped by their **category** in the database (`grains`, `dairy`, `cooking`,
`canned`, `hygiene`). Products in `hygiene` are split into household or personal care by words in their
name (detergent, dish, laundry... count as household). To change the groups or how much money each
group gets, edit `GROUPS` at the top of `HTML/budget-suggestions.js`.

## Smart shopping list (Budget screen)

Enter a budget (optional), add products and quantities to your list, then press
**Find cheapest & compare stores**. TipidGo shows:

- **Cheapest combination** - each item at the store that sells it cheapest, with the total and money left
- **Store comparison** - the total of the whole list at each store, with the cheapest store marked
  (stores that don't sell every item are flagged, and their total only counts what they sell)
- **Cheaper alternatives** - similar products that cost less, each with a **Swap** button
- **How to fit your budget** - if you are over budget, the swaps that bring you back under it

The list is saved in the browser (like the budget). Prices come from `api/price_list.php`.
Products count as alternatives when they share a group in `ALTERNATIVE_GROUPS`
(top of `HTML/shopping-list.js`), e.g. rice and corn grits. Sizes aren't compared, so check size/brand before swapping.

## Roles and dashboards

Everyone sees the same public site (browse, compare, budget suggestions, shopping list, feedback, requests). After signing in, each staff role is sent to **its own dashboard** (`HTML/dashboard.html`) with its own navigation. The server checks the role on every action (`api/auth.php`), so hiding a menu item is never the only protection.

| Feature | Visitor | Store Owner | Moderator | Admin |
|---|:-:|:-:|:-:|:-:|
| Browse, compare, budget, shopping list, feedback, requests | ✅ | ✅ | ✅ | ✅ |
| Manage own store | ❌ | ✅ | ❌ | ✅ (any store) |
| Manage own prices | ❌ | ✅ | ❌ | ✅ (any store) |
| Review owner applications | ❌ | ❌ | ✅ (pending only) | ✅ (all, can revoke) |
| Review reports (requests + feedback) | ❌ | ❌ | ✅ | ✅ |
| Manage products | ❌ | ❌ | Limited: add/edit, no delete | ✅ |
| Manage stores | ❌ | Own only | Limited: location + verified badge | ✅ |
| Manage users | ❌ | ❌ | ❌ | ✅ |
| Manage moderators | ❌ | ❌ | ❌ | ✅ |
| System settings | ❌ | ❌ | ❌ | ✅ |

Dashboard navigation: **Store owner** - My store, My prices. **Moderator** - Overview, Owner applications, Reports, Products, Stores. **Admin** - all of those plus Store prices, Users, Moderators, System settings.

Visitors do not need an account. A store owner applies via "New store owner?" and must be approved by a moderator/admin before signing in. Admins can close owner applications and post a site announcement from System settings.

## Security notes

- Passwords are hashed with PHP's `password_hash()` — never stored as plain text.
- All database queries use prepared statements (protects against SQL injection).
- Store-owner photo uploads are validated by real file content (not just the filename), size-capped at 5 MB, and stored privately in the database — only admins/moderators can view them, via `owner_store_photo.php`.
- `api/setup.php` requires a `?key=` matching `SETUP_KEY` in the file — change that key, and delete the file once you no longer need it.
- Sign-in is rate-limited (5 failed tries per email and device in 15 minutes), and text from users is escaped before it is shown on the page (prevents script injection through feedback or requests).
- Every POST is checked against its Origin header (in `api/db.php`), so another website cannot make a signed-in admin, moderator or owner submit actions from the browser. There is no per-form CSRF token; the Origin check is a lighter protection that needs no changes to the forms.

- **Backend access control:** every staff endpoint calls `require_role()` in `api/auth.php`. No session returns **401**, a signed-in user with the wrong role returns **403**. The role is re-checked against the `users` table on each call, so a deleted or changed account loses access immediately. Reading submitted feedback and requests is staff-only (visitors can only submit). Store owners' store ids always come from their approved application on the server, never from the browser.

## Database reliability

- **One price per store and product** is enforced by the database (`UNIQUE (product_id, store_id)`), and price updates use a single upsert, so two rows can never appear for the same item.
- **Price history** keeps one entry per store, product and day, and the product page now shows which store each history price belongs to.
- Prices must be above zero and base prices cannot be negative (`CHECK` rules); product names are unique; a store name can appear once per location.
- Duplicate or invalid submissions get a clear message (HTTP 409/400) instead of a server error: duplicate product/store names, the same feedback or request sent twice in one day, bad request types, over-long text, invalid emails.
- Database errors are turned into safe JSON messages (details are only written to the server log).
- **Already have data from an earlier version?** Sign in as admin, open **System settings → Database health → Check and repair database**. It removes duplicate prices (keeping the newest), adds the rules above, and lists anything you need to fix by hand. Fresh installs get everything from `database.sql`.

## Known limitations / next steps

- The Budget screen saves in the visitor's own browser (not the database), so it is per device.
- No image upload for products yet — `image` is a plain text column pointing to a file inside `HTML/images/` (demo pictures for the sample products are included, e.g. `images/rice.svg`). Add your own files there and update that column via phpMyAdmin or Products in the dashboard's database.
- No automated tests.
