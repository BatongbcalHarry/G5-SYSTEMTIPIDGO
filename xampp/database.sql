-- ============================================================
-- TipidGo Database
-- Import this file in phpMyAdmin (or run via MySQL CLI) to
-- create the database, tables, and starting sample data.
-- ============================================================

CREATE DATABASE IF NOT EXISTS tipidgo_db;
USE tipidgo_db;

-- ------------------------------------------------------------
-- PRODUCTS
-- ------------------------------------------------------------
CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  image VARCHAR(150) DEFAULT NULL
);

INSERT INTO products (name, category, base_price, image) VALUES
('Rice (1kg)',       'grains',  45.00, 'images/rice.svg'),
('Corn Grits (1kg)', 'grains',  38.00, 'images/corn-grits.svg'),
('Eggs (per piece)', 'dairy',    9.00, 'images/eggs.svg'),
('Milk (1L)',        'dairy',   52.00, 'images/milk.svg'),
('Cooking Oil (1L)', 'cooking', 80.00, 'images/cooking-oil.svg'),
('Vinegar (1L)',     'cooking', 28.00, 'images/vinegar.svg'),
('Soap (100g)',      'hygiene', 25.00, 'images/soap.svg'),
('Detergent (1kg)',  'hygiene', 65.00, 'images/detergent.svg'),
('Canned Sardines',  'canned',  25.00, 'images/canned-sardines.svg'),
('Corned Beef',      'canned',  45.00, 'images/corned-beef.svg');

-- ------------------------------------------------------------
-- STORES
-- ------------------------------------------------------------
CREATE TABLE stores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  location VARCHAR(150),
  verified TINYINT(1) DEFAULT 0
);

INSERT INTO stores (name, location, verified) VALUES
('Puregold', 'Cabanatuan City', 1),
('SNR',      'Cabanatuan City', 1),
('Robinson', 'Cabanatuan City', 0);

-- ------------------------------------------------------------
-- PRICES (each store's price for each product)
-- ------------------------------------------------------------
CREATE TABLE prices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  store_id INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  last_updated DATE NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

INSERT INTO prices (product_id, store_id, price, last_updated) VALUES
(1, 1, 45.00, '2026-08-30'),
(1, 2, 52.00, '2026-08-30'),
(1, 3, 60.00, '2026-08-29'),

(2, 1, 38.00, '2026-08-30'),
(2, 2, 41.00, '2026-08-28'),

(3, 1, 9.00,  '2026-08-30'),
(3, 3, 10.50, '2026-08-29'),

(4, 1, 52.00, '2026-08-30'),
(4, 2, 55.00, '2026-08-27'),

(5, 1, 80.00, '2026-08-30'),
(5, 2, 85.00, '2026-08-30'),
(5, 3, 78.00, '2026-08-29'),

(6, 1, 28.00, '2026-08-29'),

(7, 1, 25.00, '2026-08-30'),
(7, 2, 27.00, '2026-08-28'),

(8, 1, 65.00, '2026-08-30'),
(8, 3, 70.00, '2026-08-27'),

(9, 1, 25.00, '2026-08-30'),
(9, 2, 26.50, '2026-08-29'),

(10, 1, 45.00, '2026-08-30'),
(10, 3, 48.00, '2026-08-28');

-- ------------------------------------------------------------
-- PRICE HISTORY (for the Product Detail "price history" section)
-- ------------------------------------------------------------
CREATE TABLE price_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  store_id INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  recorded_date DATE NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

INSERT INTO price_history (product_id, store_id, price, recorded_date) VALUES
(1, 1, 43.00, '2026-07-30'),
(1, 1, 44.50, '2026-08-15'),
(1, 1, 45.00, '2026-08-30');

-- ------------------------------------------------------------
-- FEEDBACK
-- ------------------------------------------------------------
CREATE TABLE feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_name VARCHAR(100) NOT NULL,
  type VARCHAR(30) NOT NULL,
  message TEXT NOT NULL,
  created_at DATE NOT NULL
);

INSERT INTO feedback (user_name, type, message, created_at) VALUES
('User123', 'Comments',   'Prices were accurate, thanks!',    '2026-09-15'),
('itsme2',  'Rating',     '5 stars for Puregold.',             '2026-09-15'),
('lover',   'Suggestion', 'Please add more stores nearby.',    '2026-09-13');

-- ------------------------------------------------------------
-- REQUESTS (Request Price Update / Request Product)
-- ------------------------------------------------------------
CREATE TABLE requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  details TEXT NOT NULL,
  status VARCHAR(30) DEFAULT 'Pending',
  created_at DATE NOT NULL
);

-- ------------------------------------------------------------
-- USERS (for Login / Logout)
-- Passwords are hashed with PHP's password_hash() - never store
-- plain text passwords. Accounts are created by opening
-- api/setup.php once in your browser (see README).
-- ------------------------------------------------------------
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  created_at DATE NOT NULL
);

-- ------------------------------------------------------------
-- STORE OWNER APPLICATIONS
-- ------------------------------------------------------------
CREATE TABLE store_owner_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  store_id INT DEFAULT NULL,
  store_name VARCHAR(100) NOT NULL,
  store_location VARCHAR(150) NOT NULL,
  store_photo_mime VARCHAR(30) DEFAULT NULL,
  store_photo MEDIUMBLOB DEFAULT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME DEFAULT NULL,
  reviewed_by INT DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);
