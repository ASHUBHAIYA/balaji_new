-- =========================================================================
-- Cloudflare D1 SQLite Schema for SHREE BALAJI ASSOCIATES Tracker
-- Run with: wrangler d1 execute <YOUR_D1_DATABASE_NAME> --file=./schema.sql
-- =========================================================================

-- Financial Years Registry
CREATE TABLE IF NOT EXISTS financial_years (
  label TEXT PRIMARY KEY,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Users & Permissions
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  label TEXT NOT NULL,
  entry_window_days INTEGER
);

-- Global / Per-Year Settings
CREATE TABLE IF NOT EXISTS settings (
  fy TEXT NOT NULL DEFAULT '2026-27',
  key TEXT NOT NULL,
  value TEXT,
  PRIMARY KEY (fy, key)
);

-- Bank Accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fy TEXT NOT NULL DEFAULT '2026-27',
  name TEXT NOT NULL,
  opening_balance REAL NOT NULL DEFAULT 0,
  opening_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(fy, name)
);

-- Items & Stock Master
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fy TEXT NOT NULL DEFAULT '2026-27',
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pcs',
  kind TEXT NOT NULL DEFAULT 'raw',
  opening_qty REAL NOT NULL DEFAULT 0,
  opening_value REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(fy, name)
);

-- Main Transaction Entries (Sales, Purchases, Production, Expenses, Advances)
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fy TEXT NOT NULL DEFAULT '2026-27',
  date TEXT NOT NULL,
  kind TEXT NOT NULL,
  client TEXT,
  vendor TEXT,
  item_type TEXT,
  qty REAL,
  rate REAL,
  expense_type TEXT,
  amount REAL NOT NULL,
  note TEXT,
  received INTEGER NOT NULL DEFAULT 0,
  method TEXT,
  received_date TEXT,
  linked_sale_id INTEGER,
  extra_json TEXT,
  is_challan INTEGER NOT NULL DEFAULT 0,
  billed_under_id INTEGER,
  challan_no TEXT,
  bank_account_id INTEGER,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Payment Ledger
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fy TEXT NOT NULL DEFAULT '2026-27',
  entry_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  method TEXT NOT NULL,
  amount REAL NOT NULL,
  loading_unloading REAL NOT NULL DEFAULT 0,
  loading_unloading_expense_id INTEGER,
  bank_account_id INTEGER,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(entry_id) REFERENCES entries(id) ON DELETE CASCADE
);

-- Client Advances
CREATE TABLE IF NOT EXISTS advances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fy TEXT NOT NULL DEFAULT '2026-27',
  date TEXT NOT NULL,
  client TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT NOT NULL,
  note TEXT,
  bank_account_id INTEGER,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Vendor Advances
CREATE TABLE IF NOT EXISTS vendor_advances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fy TEXT NOT NULL DEFAULT '2026-27',
  date TEXT NOT NULL,
  vendor TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT NOT NULL,
  note TEXT,
  bank_account_id INTEGER,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Client Adjustments
CREATE TABLE IF NOT EXISTS client_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fy TEXT NOT NULL DEFAULT '2026-27',
  date TEXT NOT NULL,
  client TEXT NOT NULL,
  adj_type TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Vendor Adjustments
CREATE TABLE IF NOT EXISTS vendor_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fy TEXT NOT NULL DEFAULT '2026-27',
  date TEXT NOT NULL,
  vendor TEXT NOT NULL,
  adj_type TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Bank & Cash Ledger Transactions
CREATE TABLE IF NOT EXISTS bank_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fy TEXT NOT NULL DEFAULT '2026-27',
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT,
  note TEXT,
  bank_account_id INTEGER,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Stock Movements (Tracking batches, sales, purchases, production)
CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fy TEXT NOT NULL DEFAULT '2026-27',
  date TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  qty REAL NOT NULL,
  source TEXT NOT NULL,
  ref_id INTEGER,
  note TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(item_id) REFERENCES items(id)
);

-- Production Batches
CREATE TABLE IF NOT EXISTS production_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fy TEXT NOT NULL DEFAULT '2026-27',
  date TEXT NOT NULL,
  produced_item_id INTEGER NOT NULL,
  produced_qty REAL NOT NULL,
  note TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(produced_item_id) REFERENCES items(id)
);

-- Production Raw Material Consumption
CREATE TABLE IF NOT EXISTS production_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fy TEXT NOT NULL DEFAULT '2026-27',
  run_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  qty REAL NOT NULL,
  FOREIGN KEY(run_id) REFERENCES production_runs(id) ON DELETE CASCADE,
  FOREIGN KEY(item_id) REFERENCES items(id)
);

-- Sequence Tracker for Automatic Challan Numbering
CREATE TABLE IF NOT EXISTS challan_sequence (
  fy TEXT PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

-- Fast Indexes for High Performance Querying on Cloudflare D1
CREATE INDEX IF NOT EXISTS idx_entries_fy_date ON entries(fy, date);
CREATE INDEX IF NOT EXISTS idx_entries_fy_kind ON entries(fy, kind);
CREATE INDEX IF NOT EXISTS idx_entries_fy_client ON entries(fy, client);
CREATE INDEX IF NOT EXISTS idx_entries_fy_vendor ON entries(fy, vendor);
CREATE INDEX IF NOT EXISTS idx_payments_fy_entry ON payments(fy, entry_id);
CREATE INDEX IF NOT EXISTS idx_advances_fy_client ON advances(fy, client);
CREATE INDEX IF NOT EXISTS idx_vadvances_fy_vendor ON vendor_advances(fy, vendor);
CREATE INDEX IF NOT EXISTS idx_stock_movements_fy_item ON stock_movements(fy, item_id);
CREATE INDEX IF NOT EXISTS idx_bank_tx_fy_date ON bank_transactions(fy, date);

-- Seed Initial FYs
INSERT OR IGNORE INTO financial_years (label, start_date, end_date, is_default) VALUES
  ('2025-26', '2025-04-01', '2026-03-31', 0),
  ('2026-27', '2026-04-01', '2027-03-31', 1);

-- Seed Default Admin & Operator Users
-- Password for admin: 12346 (scrypt hash + fallback compatibility)
-- Password for user: 1234 (scrypt hash + fallback compatibility)
INSERT OR IGNORE INTO users (username, password_hash, role, label, entry_window_days) VALUES
  ('admin', 'scrypt:32768:8:1$9f1d044ab06e7dc6016e78ba7a6ce5b1$e41b960a5e848efdb758e5a60a72ad41c46399c279a6d96a1aebdb81062bce717ae3bca5860714fc2a76f2f98e72c8428236d8d6d2a450ce43309a4d8c6d48a8', 'admin', 'Administrator', NULL),
  ('user', 'scrypt:32768:8:1$743cb5e896478959955725ae5bf8eef0$55ef73c7924e54e48b8c543aa8ee4234563a6dc74ef117ba2e098a855909fb58137ba3135b1bf26e2e519c28ae9f2f84b6f849ef90664d9b1395fc0ba4b8ec3f', 'user', 'Data Operator', 1);

-- Seed Default Bank Accounts & Items
INSERT OR IGNORE INTO bank_accounts (fy, name, opening_balance, is_active) VALUES
  ('2026-27', 'Main Bank', 0, 1),
  ('2025-26', 'Main Bank', 0, 1);

INSERT OR IGNORE INTO challan_sequence (fy, last_number) VALUES
  ('2026-27', 0),
  ('2025-26', 0);
