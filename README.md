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
│   ├── admin.html            <- administrator dashboard
│   ├── admin.js
│   ├── moderator.html        <- store-owner application review dashboard
│   ├── moderator.js
│   ├── owner.html             <- approved store-owner price dashboard
│   ├── owner.js
│   ├── script.js             <- screen-switching / search / category filter logic
│   ├── api.js                <- connects the front-end to the PHP backend
│   ├── style.css
│   ├── staff.css             <- shared staff dashboard styles
│   ├── tipidgo backround.png
│   └── images/                <- add your own product pictures here (not included)
└── api/
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

## Roles

- **guest (no account)** — browses products, stores and the budget tool, and can submit feedback and requests without signing in.
- **store_owner** — applies via "New store owner?" on the login screen (requires a store photo); needs moderator/admin approval before they can sign in. Once approved, manages their own store's prices from `owner.html`.
- **moderator** — reviews pending store-owner applications from `moderator.html`.
- **admin** — everything a moderator can do, plus system-wide counts from `admin.html`.

## Security notes

- Passwords are hashed with PHP's `password_hash()` — never stored as plain text.
- All database queries use prepared statements (protects against SQL injection).
- Store-owner photo uploads are validated by real file content (not just the filename), size-capped at 5 MB, and stored privately in the database — only admins/moderators can view them, via `owner_store_photo.php`.
- `api/setup.php` requires a `?key=` matching `SETUP_KEY` in the file — change that key, and delete the file once you no longer need it.
- Sign-in is rate-limited (5 failed tries per email and device in 15 minutes), and text from users is escaped before it is shown on the page (prevents script injection through feedback or requests).
- Every POST is checked against its Origin header (in `api/db.php`), so another website cannot make a signed-in admin, moderator or owner submit actions from the browser. There is no per-form CSRF token; the Origin check is a lighter protection that needs no changes to the forms.

## Known limitations / next steps

- The Budget screen saves in the visitor's own browser (not the database), so it is per device.
- No image upload for products yet — `image` is a plain text column pointing to a file path (e.g. `images/rice.svg`); add your own files under `HTML/images/` and update that column via phpMyAdmin.
- No automated tests.
