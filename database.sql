-- ============================================================
-- TipidGo database schema
--
-- NOTE: this file was reconstructed from the PHP code in /api
-- (the columns and tables each file actually queries), because
-- the live database was never exported/committed to this repo.
-- It gives anyone cloning this project a working starting
-- schema with a few sample rows.
--
-- If your own MySQL database already has real product/store/
-- price data you care about, export THAT instead from
-- phpMyAdmin (Export tab -> SQL) and use it in place of this
-- file, so you don't lose your actual data.
-- ============================================================

CREATE DATABASE IF NOT EXISTS tipidgo_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tipidgo_db;

-- ------------------------------------------------------------
-- users: everyone who can sign in (admin, moderator, store_owner)
-- plain "user" accounts are created via register.php and are not
-- staff accounts.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at DATE NOT NULL
);

-- ------------------------------------------------------------
-- stores: a physical/verified store that sells products
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    location VARCHAR(200) NULL,
    verified TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE KEY uq_store_name_location (name, location)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- products: the basic goods being price-compared
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    image VARCHAR(255) NULL,
    UNIQUE KEY uq_product_name (name),
    CONSTRAINT chk_base_price CHECK (base_price >= 0)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- prices: current price of a product at a specific store
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    store_id INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    last_updated DATE NOT NULL,
    UNIQUE KEY uq_price_product_store (product_id, store_id),   -- one price per store and product
    CONSTRAINT chk_price_positive CHECK (price > 0),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- price_history: a log of price changes over time, per product+store
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS price_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    store_id INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    recorded_date DATE NOT NULL,
    INDEX idx_history_lookup (product_id, store_id, recorded_date),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- feedback: user-submitted comments/suggestions/complaints
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'Comments',
    message TEXT NOT NULL,
    created_at DATE NOT NULL
);

-- ------------------------------------------------------------
-- requests: "request a price update" / "request a new product"
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    details TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Pending',
    created_at DATE NOT NULL
);

-- ------------------------------------------------------------
-- store_owner_applications: pending/approved/rejected requests
-- from a user to become a store owner, with a required store
-- photo for moderator/admin review. Also created by setup.php
-- if missing, but defined here so a fresh import has it too.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_owner_applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    store_id INT NULL,
    store_name VARCHAR(100) NOT NULL,
    store_location VARCHAR(150) NOT NULL,
    store_photo_mime VARCHAR(30) NULL,
    store_photo MEDIUMBLOB NULL,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME NULL,
    reviewed_by INT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- login_attempts: failed sign-ins, used to lock out brute-force
-- guessing (5 failures per email + device in 15 minutes).
-- login.php also creates it automatically if missing.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(150) NOT NULL,
    ip VARCHAR(45) NOT NULL,
    attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_lookup (email, ip, attempted_at)
);

-- ------------------------------------------------------------
-- settings: admin-controlled switches (owner applications open/closed,
-- site announcement). settings.php also creates it automatically.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
    name VARCHAR(50) PRIMARY KEY,
    value VARCHAR(500) NOT NULL DEFAULT ''
);

-- ------------------------------------------------------------
-- Sample data so the site isn't empty on first run.
-- Replace/add to this with your own real products and stores.
-- ------------------------------------------------------------
INSERT INTO stores (name, location, verified) VALUES
    ('Puregold', 'Cabanatuan City', 1),
    ('SNR', 'Cabanatuan City', 1),
    ('Robinson', 'Cabanatuan City', 0),
    ('TipidGo Demo Store', 'Cabanatuan City', 0);

-- image points to a file inside HTML/images/ (the demo pictures are included).
-- Use your own photos by replacing the files or editing the image column.
INSERT INTO products (name, category, base_price, image) VALUES
    ('Rice (1kg)', 'grains', 55.00, 'images/rice.svg'),
    ('Corn Grits (1kg)', 'grains', 40.00, 'images/corn-grits.svg'),
    ('Eggs (tray of 30)', 'dairy', 210.00, 'images/eggs.svg'),
    ('Fresh Milk (1L)', 'dairy', 95.00, 'images/milk.svg'),
    ('Cooking Oil (1L)', 'cooking', 95.00, 'images/cooking-oil.svg'),
    ('Vinegar (1L)', 'cooking', 28.00, 'images/vinegar.svg'),
    ('Sardines (155g)', 'canned', 24.00, 'images/sardines.svg'),
    ('Corned Beef (150g)', 'canned', 48.00, 'images/corned-beef.svg'),
    ('Dishwashing Soap', 'hygiene', 15.00, 'images/dishwashing-soap.svg'),
    ('Laundry Detergent (1kg)', 'hygiene', 85.00, 'images/laundry-detergent.svg'),
    ('Bath Soap', 'hygiene', 22.00, 'images/bath-soap.svg'),
    ('Shampoo (180ml)', 'hygiene', 65.00, 'images/shampoo.svg'),
    ('Toothpaste (100g)', 'hygiene', 45.00, 'images/toothpaste.svg');

INSERT INTO prices (product_id, store_id, price, last_updated) VALUES
    (1, 1, 54.00, CURDATE()), (1, 2, 56.50, CURDATE()),
    (2, 1, 38.00, CURDATE()), (2, 3, 42.00, CURDATE()),
    (3, 1, 205.00, CURDATE()), (3, 3, 215.00, CURDATE()),
    (4, 2, 92.00, CURDATE()), (4, 1, 99.00, CURDATE()),
    (5, 1, 92.00, CURDATE()), (5, 2, 97.50, CURDATE()),
    (6, 2, 26.00, CURDATE()), (6, 3, 30.00, CURDATE()),
    (7, 1, 22.50, CURDATE()), (7, 2, 25.00, CURDATE()),
    (8, 2, 46.00, CURDATE()), (8, 3, 51.00, CURDATE()),
    (9, 2, 14.50, CURDATE()), (9, 1, 16.00, CURDATE()),
    (10, 1, 83.00, CURDATE()), (10, 3, 88.00, CURDATE()),
    (11, 1, 20.00, CURDATE()), (11, 2, 23.50, CURDATE()),
    (12, 2, 62.00, CURDATE()), (12, 3, 68.00, CURDATE()),
    (13, 1, 43.00, CURDATE()), (13, 2, 47.00, CURDATE());
