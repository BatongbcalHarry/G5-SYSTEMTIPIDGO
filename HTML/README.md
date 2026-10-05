# TipidGo - PHP + MySQL (XAMPP) Version

## What's inside

```
tipidgo-xampp/
├── database.sql          <- import this into phpMyAdmin first
├── index.html
├── admin.html              <- separate administrator dashboard
├── admin.js
├── moderator.html          <- separate owner-application review dashboard
├── moderator.js
├── owner.html              <- approved store-owner price dashboard
├── owner.js
├── style.css
├── staff.css               <- shared staff dashboard styles
├── script.js               <- screen-switching / search / category filter logic
├── api.js                  <- connects the front-end to the PHP backend (login, products, etc.)
├── images/                 <- product pictures (simple icon-style SVGs, one per product)
│   ├── rice.svg
│   ├── eggs.svg
│   └── ... (one per product)
└── api/
    ├── db.php               <- MySQL connection settings
    ├── setup.php             <- creates the starter admin/moderator accounts and approval table
    ├── register.php          <- creates a new user account
    ├── register_owner.php    <- submits a pending store-owner application
    ├── login.php              <- logs a user in (checks password, starts session)
    ├── logout.php             <- logs the user out
    ├── session.php            <- checks if someone is already logged in
    ├── owner_applications.php <- moderator/admin approval decisions
    ├── admin_summary.php      <- admin-only system counts
    ├── owner_dashboard.php    <- approved owner's store and current prices
    ├── owner_prices.php       <- add/update prices for that owner's store only
    ├── products.php           <- product list (with images + lowest price)
    ├── product_detail.php     <- one product's full price comparison + history
    ├── stores.php             <- store list
    ├── feedback.php           <- feedback list / submit feedback
    └── requests.php           <- price/product request list / submit request
```

## Setup Steps

### 1. Copy the project into XAMPP's htdocs folder
Copy the whole `tipidgo-xampp` folder into:
```
C:\xampp\htdocs\tipidgo
```

### 2. Start Apache and MySQL
Open the **XAMPP Control Panel** and click **Start** next to both **Apache** and **MySQL**.

### 3. Import the database
1. Go to `http://localhost/phpmyadmin`.
2. Click **Import** → choose `database.sql` → **Go**.

This creates `tipidgo_db` with 8 tables, including **users** and **store_owner_applications** for moderator review.

### 4. Create the starter login accounts
In your browser, open:
```
http://localhost/tipidgo/api/setup.php
```
This creates the starter staff accounts (safe to run more than once — it skips ones that already exist):

| Email | Password | Role |
|---|---|---|
| admin@tipidgo.com | admin123 | admin |
| moderator@tipidgo.com | moderator123 | moderator |

### 5. Open your site
```
http://localhost/tipidgo/HTML/
```
Shoppers can browse without an account. Store owners can choose **Staff sign in** → **Apply for a store-owner account** and submit their store details. A moderator or administrator must approve the application before that owner can sign in.

**Important:** Always open it through `http://localhost/...`. PHP will not run if you just double-click `index.html`.

Store-owner signup requires a clear JPEG, PNG, or WebP photo of the store (maximum 5 MB). On supported mobile devices, the photo field prompts for the rear camera. Moderators and administrators can view the submitted photo in the application review table; photo access requires a staff session. If the database was set up before this feature, open `http://localhost/tipidgo/api/setup.php` again to add the photo columns.

## Login / Logout — how it works

- Passwords are **hashed** with PHP's `password_hash()` — never stored as plain text.
- Logging in starts a **PHP session** (`$_SESSION`), which is what keeps you logged in as you click around.
- The account badge provides **Staff sign in** for administrators, moderators, and approved store owners. Logging out returns to public Home.
- Admins sign in to a separate system overview; moderators sign in to a separate owner-application review page.
- Approved store owners sign in to a separate dashboard to add or update prices for their linked store only.
- Refreshing the page keeps you logged in — `api/session.php` is checked automatically on page load.
- Shoppers can submit feedback without an account; unsigned feedback is saved as **Guest**.

## Product Pictures

Each product now has a picture (the `images/` folder), shown on both the Product list and Product Detail screen. These are simple generated icon-style images (not real photos, since this project has no internet access to download real product photos) — **you can swap any of them for a real photo** by replacing the file with the same filename, e.g. replace `images/rice.svg` with your own `images/rice.jpg` and update that one row's `image` column in the `products` table (via phpMyAdmin) to `images/rice.jpg`.

## What's connected to the real database right now

- **Store owner applications** — store details and a required store photo are saved for moderator review; only approved accounts can sign in with the `store_owner` role
- **Admin / Moderator dashboards** — separate role-protected pages; moderators can only review pending owner applications
- **Store owner dashboard** — approved owners can add/update their store prices; price edits are recorded in price history and cannot target another store
- **Product screen** — loads from `products` + `prices` tables, shows each product's picture and lowest price
- **Product Detail** — real price comparison across stores (cheapest first) + price history + picture
- **Stores screen** — store list loads from the `stores` table
- **Feedback** — loads real feedback, and Submit saves it under the signed-in name or **Guest**
- **Request screen** — "Request Price Update" / "Request Product" buttons open a form that saves into the `requests` table, and your submitted requests are listed below

## Screens still using placeholder/static content

Budget, Review Store Info, Check Reports, Verify Information, Take a Photo, Verify Store/Admin, Verification Result, Profile, Edit Profile, Settings.

These still display correctly, just without a live database behind them yet. They follow the exact same pattern as the screens above, so you (or your backend teammate) can connect any of them:
1. Add a new `.php` file in `/api` (copy `stores.php` as a simple starting template)
2. Add a matching table in MySQL if needed
3. Add a function in `api.js` that `fetch()`s it and fills in the HTML
4. Give the HTML elements you want to fill in an `id` so `api.js` can target them

## Editing your data

Open **phpMyAdmin** (`http://localhost/phpmyadmin` → `tipidgo_db`) to view or edit any table directly — products, prices, stores, feedback, users, requests — no code changes needed.

## A note on testing

I don't have PHP, MySQL, or internet access available in the environment where I wrote this, so I was not able to run it against a live Apache/MySQL server end-to-end. Every PHP, JS, and SQL file was checked carefully for syntax and I traced the logic by hand (field names matching between PHP and JavaScript, correct table joins, etc.), but if something doesn't work on your first try, check:
1. Apache and MySQL are both running (green in XAMPP Control Panel)
2. `database.sql` imported successfully (7 tables visible in phpMyAdmin)
3. You ran `api/setup.php` once to create the login accounts
4. Open the site through `http://localhost/tipidgo/HTML/` instead of opening the file directly.
