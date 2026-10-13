import sqlite3, re, subprocess, os, sys
db = sys.argv[1]
if os.path.exists(db): os.remove(db)
c = sqlite3.connect(db)
c.executescript("""
CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT, full_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', created_at TEXT NOT NULL);
CREATE TABLE stores(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, location TEXT, verified INTEGER NOT NULL DEFAULT 0, UNIQUE(name, location));
CREATE TABLE products(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE COLLATE NOCASE, category TEXT NOT NULL, base_price REAL NOT NULL DEFAULT 0 CHECK(base_price>=0), image TEXT);
CREATE TABLE prices(id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE, price REAL NOT NULL CHECK(price>0), last_updated TEXT NOT NULL, UNIQUE(product_id, store_id));
CREATE TABLE price_history(id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE, price REAL NOT NULL, recorded_date TEXT NOT NULL);
CREATE TABLE feedback(id INTEGER PRIMARY KEY AUTOINCREMENT, user_name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'Comments', message TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE requests(id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, details TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Pending', created_at TEXT NOT NULL);
CREATE TABLE store_owner_applications(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL, store_name TEXT NOT NULL, store_location TEXT NOT NULL, store_photo_mime TEXT, store_photo BLOB, status TEXT NOT NULL DEFAULT 'pending', submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT, reviewed_by INTEGER);
CREATE TABLE login_attempts(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, ip TEXT NOT NULL, attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE settings(name TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '');
""")
sql = open('/home/claude/v6/database.sql').read().replace('CURDATE()', "date('now')")
for m in re.finditer(r"INSERT INTO (stores|products|prices)[^;]*;", sql, re.S):
    c.executescript(m.group(0))
for name,email,pw,role in [('Admin','admin@tipidgo.com','admin123!','admin'),('Mod','moderator@tipidgo.com','moderator123!','moderator')]:
    h = subprocess.check_output(['php','-r','echo password_hash($argv[1],PASSWORD_DEFAULT);','--',pw]).decode()
    c.execute("INSERT INTO users(full_name,email,password_hash,role,created_at) VALUES(?,?,?,?,date('now'))",(name,email,h,role))
c.commit(); print(c.execute('select count(*) from products').fetchone(), c.execute('select count(*) from prices').fetchone())
