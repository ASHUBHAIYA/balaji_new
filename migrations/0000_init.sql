-- Migration: 0000_init.sql
-- Cloudflare D1 Migration File for Balaji Tracker

CREATE TABLE IF NOT EXISTS financial_years (
  label TEXT PRIMARY KEY,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  label TEXT NOT NULL,
  entry_window_days INTEGER
);

CREATE TABLE IF NOT EXISTS settings (
  fy TEXT NOT NULL DEFAULT '2026-27',
  key TEXT NOT NULL,
  value TEXT,
  PRIMARY KEY (fy, key)
);

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

CREATE TABLE IF NOT EXISTS production_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fy TEXT NOT NULL DEFAULT '2026-27',
  run_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  qty REAL NOT NULL,
  FOREIGN KEY(run_id) REFERENCES production_runs(id) ON DELETE CASCADE,
  FOREIGN KEY(item_id) REFERENCES items(id)
);

CREATE TABLE IF NOT EXISTS challan_sequence (
  fy TEXT PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_entries_fy_date ON entries(fy, date);
CREATE INDEX IF NOT EXISTS idx_entries_fy_kind ON entries(fy, kind);
CREATE INDEX IF NOT EXISTS idx_entries_fy_client ON entries(fy, client);
CREATE INDEX IF NOT EXISTS idx_entries_fy_vendor ON entries(fy, vendor);
CREATE INDEX IF NOT EXISTS idx_payments_fy_entry ON payments(fy, entry_id);
CREATE INDEX IF NOT EXISTS idx_advances_fy_client ON advances(fy, client);
CREATE INDEX IF NOT EXISTS idx_vadvances_fy_vendor ON vendor_advances(fy, vendor);
CREATE INDEX IF NOT EXISTS idx_stock_movements_fy_item ON stock_movements(fy, item_id);
CREATE INDEX IF NOT EXISTS idx_bank_tx_fy_date ON bank_transactions(fy, date);
