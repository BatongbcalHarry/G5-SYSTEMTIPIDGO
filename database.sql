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
    verified TINYINT(1) NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------
-- products: the basic goods being price-compared
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    image VARCHAR(255) NULL
);

-- ------------------------------------------------------------
-- prices: current price of a product at a specific store
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    store_id INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    last_updated DATE NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- price_history: a log of price changes over time, per product+store
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS price_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    store_id INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    recorded_date DATE NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

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
-- Sample data so the site isn't empty on first run.
-- Replace/add to this with your own real products and stores.
-- ------------------------------------------------------------
INSERT INTO stores (name, location, verified) VALUES
    ('Puregold', 'Cabanatuan City', 1),
    ('SNR', 'Cabanatuan City', 1),
    ('Robinson', 'Cabanatuan City', 0),
    ('TipidGo Demo Store', 'Cabanatuan City', 0);

-- image is left NULL here because this repo doesn't currently
-- include an images/ folder. Add your own images under
-- HTML/images/ and update each row's image column to match
-- (e.g. 'images/rice.svg'), or leave it NULL to show no picture.
INSERT INTO products (name, category, base_price, image) VALUES
    ('Rice (1kg)', 'staples', 55.00, NULL),
    ('Eggs (tray of 30)', 'staples', 210.00, NULL),
    ('Cooking Oil (1L)', 'staples', 95.00, NULL),
    ('Dishwashing Soap', 'hygiene', 15.00, NULL),
    ('Laundry Detergent (1kg)', 'hygiene', 85.00, NULL);

INSERT INTO prices (product_id, store_id, price, last_updated) VALUES
    (1, 1, 54.00, CURDATE()),
    (1, 2, 56.50, CURDATE()),
    (2, 1, 205.00, CURDATE()),
    (2, 3, 215.00, CURDATE()),
    (3, 1, 92.00, CURDATE()),
    (4, 2, 14.50, CURDATE()),
    (5, 1, 83.00, CURDATE());
