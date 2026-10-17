CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash CHAR(60) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS menu_items (
  id VARCHAR(80) NOT NULL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  price_cents INT UNSIGNED NOT NULL,
  category VARCHAR(80) NOT NULL,
  image_id VARCHAR(120) NOT NULL,
  is_meal BOOLEAN NOT NULL DEFAULT FALSE,
  available BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT password_reset_tokens_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX password_reset_expiry_idx (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  order_number VARCHAR(40) NOT NULL UNIQUE,
  fulfillment ENUM('delivery', 'collection') NOT NULL,
  customer_name VARCHAR(80) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  delivery_address VARCHAR(300),
  distance_km DECIMAL(8, 2) NOT NULL DEFAULT 0,
  subtotal_cents INT UNSIGNED NOT NULL,
  delivery_fee_cents INT UNSIGNED NOT NULL,
  total_cents INT UNSIGNED NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'received',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT orders_user_fk FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX orders_user_created_idx (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  menu_item_id VARCHAR(80) NOT NULL,
  item_name VARCHAR(160) NOT NULL,
  unit_price_cents INT UNSIGNED NOT NULL,
  quantity TINYINT UNSIGNED NOT NULL,
  drink_choice ENUM('Coke', 'Sprite', 'Pepsi'),
  CONSTRAINT order_items_order_fk
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT order_items_quantity_check CHECK (quantity BETWEEN 1 AND 20)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
