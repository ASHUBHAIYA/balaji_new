import fs from 'fs';
import path from 'path';
import nodeCrypto from 'node:crypto';
import initSqlJs, { Database, SqlValue } from 'sql.js';

export const BASE_DIR = process.cwd();
export const DATA_DIR = path.join(BASE_DIR, 'data');
export const LEGACY_DB_PATH = path.join(BASE_DIR, 'tracker.db');
export const FUZZY_CUTOFF = 0.80;

export const COMPANY = {
  name: 'SHREE BALAJI ASSOCIATES',
  address: 'Near Om Sai Biofuels Bargawan Odgadi Distt. Singrauli',
  gstin: '23AEPFS7841N1Z9',
};

export const DEFAULT_BANK_NAME = 'Main Bank';

export function indianFyLabel(d: Date = new Date()): string {
  const month = d.getMonth() + 1; // 1-12
  const year = d.getFullYear();
  if (month >= 4) {
    return `${year}-${String(year + 1).slice(2)}`;
  }
  return `${year - 1}-${String(year).slice(2)}`;
}

export function fyDateRange(label: string): { start: string; end: string } {
  let startY: number;
  try {
    startY = parseInt(label.split('-')[0], 10);
    if (isNaN(startY)) throw new Error('invalid year');
  } catch {
    const today = new Date();
    startY = today.getMonth() + 1 >= 4 ? today.getFullYear() : today.getFullYear() - 1;
    label = `${startY}-${String(startY + 1).slice(2)}`;
  }
  return {
    start: `${startY}-04-01`,
    end: `${startY + 1}-03-31`,
  };
}

export function fyDbPath(label?: string): string {
  const safe = (label || '').replace(/[^a-zA-Z0-9-_]/g, '') || indianFyLabel();
  return path.join(DATA_DIR, `FY${safe}.db`);
}

export function yearsRegistryPath(): string {
  return path.join(DATA_DIR, 'years.json');
}

export function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

interface YearsRegistry {
  years: string[];
  default: string | null;
}

export function readRegistry(): YearsRegistry {
  ensureDataDir();
  const regPath = yearsRegistryPath();
  if (!fs.existsSync(regPath)) {
    return { years: [], default: null };
  }
  try {
    const content = fs.readFileSync(regPath, 'utf-8');
    const data = JSON.parse(content);
    return {
      years: Array.isArray(data.years) ? data.years : [],
      default: data.default || null,
    };
  } catch {
    return { years: [], default: null };
  }
}

export function writeRegistry(data: YearsRegistry) {
  ensureDataDir();
  fs.writeFileSync(yearsRegistryPath(), JSON.stringify(data, null, 2), 'utf-8');
}

export function listYears(): string[] {
  const reg = readRegistry();
  const years = [...(reg.years || [])].sort().reverse();
  return years;
}

export function getDefaultYear(): string {
  const reg = readRegistry();
  if (reg.default && reg.years.includes(reg.default)) {
    return reg.default;
  }
  if (reg.years.length > 0) {
    return [...reg.years].sort().reverse()[0];
  }
  return indianFyLabel();
}

export function setDefaultYear(label: string) {
  const reg = readRegistry();
  if (!reg.years.includes(label)) {
    throw new Error('year not registered');
  }
  reg.default = label;
  writeRegistry(reg);
}

export function registerYear(label: string, makeDefault = false) {
  const reg = readRegistry();
  if (!reg.years.includes(label)) {
    reg.years.push(label);
  }
  if (makeDefault || !reg.default) {
    reg.default = label;
  }
  writeRegistry(reg);
}

export function yearInfo(label: string) {
  const { start, end } = fyDateRange(label);
  return {
    label,
    start,
    end,
    path: path.basename(fyDbPath(label)),
    is_current_calendar_fy: label === indianFyLabel(),
  };
}

let SQLPromise: Promise<import('sql.js').SqlJsStatic> | null = null;
export async function getSqlStatic() {
  if (!SQLPromise) {
    SQLPromise = initSqlJs();
  }
  return SQLPromise;
}

export function hashPassword(password: string): string {
  const salt = nodeCrypto.randomBytes(16).toString('hex');
  const N = 32768;
  const r = 8;
  const p = 1;
  const keylen = 64;
  const hash = nodeCrypto.scryptSync(password, salt, keylen, { N, r, p, maxmem: 64 * 1024 * 1024 }).toString('hex');
  return `scrypt:${N}:${r}:${p}$${salt}$${hash}`;
}

export function verifyPassword(storedHash: string, candidate: string): boolean {
  if (!storedHash || !candidate) return false;
  if (storedHash.startsWith('scrypt:')) {
    const parts = storedHash.split('$');
    if (parts.length === 3) {
      const header = parts[0].split(':');
      const N = parseInt(header[1], 10) || 32768;
      const r = parseInt(header[2], 10) || 8;
      const p = parseInt(header[3], 10) || 1;
      const salt = parts[1];
      const expected = parts[2];
      try {
        const derived = nodeCrypto.scryptSync(candidate, salt, expected.length / 2, { N, r, p, maxmem: 64 * 1024 * 1024 }).toString('hex');
        return nodeCrypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(expected, 'hex'));
      } catch {
        return false;
      }
    }
  }
  // Plaintext fallback for testing if hash matches directly
  if (storedHash === candidate) return true;
  return false;
}

export class DbConn {
  db: Database;
  filePath: string;
  private dirty = false;

  constructor(db: Database, filePath: string) {
    this.db = db;
    this.filePath = filePath;
  }

  query<T = any>(sql: string, params: SqlValue[] = []): T[] {
    const stmt = this.db.prepare(sql);
    try {
      if (params && params.length > 0) {
        stmt.bind(params);
      }
      const results: T[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject() as unknown as T);
      }
      return results;
    } finally {
      stmt.free();
    }
  }

  queryOne<T = any>(sql: string, params: SqlValue[] = []): T | null {
    const rows = this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  execute(sql: string, params: SqlValue[] = []): { lastInsertRowId: number; changes: number } {
    if (params && params.length > 0) {
      const stmt = this.db.prepare(sql);
      try {
        stmt.run(params);
      } finally {
        stmt.free();
      }
    } else {
      this.db.run(sql);
    }
    this.dirty = true;
    const lastIdRes = this.db.exec('SELECT last_insert_rowid() AS id, changes() AS ch');
    const lastInsertRowId = (lastIdRes[0]?.values[0]?.[0] as number) || 0;
    const changes = (lastIdRes[0]?.values[0]?.[1] as number) || 0;
    this.save();
    return { lastInsertRowId, changes };
  }

  execRaw(sql: string) {
    this.db.run(sql);
    this.dirty = true;
    this.save();
  }

  save() {
    if (this.filePath && this.dirty) {
      try {
        ensureDataDir();
        const data = this.db.export();
        fs.writeFileSync(this.filePath, Buffer.from(data));
        this.dirty = false;
      } catch (err) {
        console.error(`Failed to persist database to ${this.filePath}:`, err);
      }
    }
  }

  close() {
    this.save();
    // Do not close sql.js instance immediately if in memory cache, or close if ephemeral
  }
}

const dbCache = new Map<string, DbConn>();

export async function openDb(filePath: string): Promise<DbConn> {
  const absPath = path.resolve(filePath);
  if (dbCache.has(absPath)) {
    return dbCache.get(absPath)!;
  }

  const SQL = await getSqlStatic();
  let db: Database;
  if (fs.existsSync(absPath) && fs.statSync(absPath).size > 0) {
    const fileBuffer = fs.readFileSync(absPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  const conn = new DbConn(db, absPath);
  dbCache.set(absPath, conn);
  return conn;
}

export function _hasCol(conn: DbConn, table: string, col: string): boolean {
  const rows = conn.query<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some(r => r.name === col);
}

export async function initDb(dbPath?: string): Promise<DbConn> {
  let targetPath = dbPath;
  if (!targetPath) {
    await migrateLegacyAndBootstrap();
    targetPath = fyDbPath(getDefaultYear());
  }

  ensureDataDir();
  const firstTime = !fs.existsSync(targetPath) || fs.statSync(targetPath).size === 0;
  const conn = await openDb(targetPath);

  conn.execRaw(`CREATE TABLE IF NOT EXISTS users(
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    label TEXT NOT NULL
  )`);

  conn.execRaw(`CREATE TABLE IF NOT EXISTS entries(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  conn.execRaw(`CREATE TABLE IF NOT EXISTS payments(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    method TEXT NOT NULL,
    amount REAL NOT NULL,
    loading_unloading REAL NOT NULL DEFAULT 0,
    loading_unloading_expense_id INTEGER,
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(entry_id) REFERENCES entries(id) ON DELETE CASCADE
  )`);

  conn.execRaw(`CREATE TABLE IF NOT EXISTS advances(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL, client TEXT NOT NULL, amount REAL NOT NULL,
    method TEXT NOT NULL, note TEXT, created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  conn.execRaw(`CREATE TABLE IF NOT EXISTS vendor_advances(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL, vendor TEXT NOT NULL, amount REAL NOT NULL,
    method TEXT NOT NULL, note TEXT, created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  conn.execRaw(`CREATE TABLE IF NOT EXISTS client_adjustments(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL, client TEXT NOT NULL, adj_type TEXT NOT NULL,
    amount REAL NOT NULL, note TEXT, created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  conn.execRaw(`CREATE TABLE IF NOT EXISTS vendor_adjustments(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL, vendor TEXT NOT NULL, adj_type TEXT NOT NULL,
    amount REAL NOT NULL, note TEXT, created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  conn.execRaw(`CREATE TABLE IF NOT EXISTS bank_transactions(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL, type TEXT NOT NULL, amount REAL NOT NULL,
    category TEXT, note TEXT, created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  conn.execRaw(`CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT)`);

  conn.execRaw(`CREATE TABLE IF NOT EXISTS bank_accounts(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    opening_balance REAL NOT NULL DEFAULT 0,
    opening_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  conn.execRaw(`CREATE TABLE IF NOT EXISTS items(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    unit TEXT NOT NULL DEFAULT 'pcs',
    kind TEXT NOT NULL DEFAULT 'raw',
    opening_qty REAL NOT NULL DEFAULT 0,
    opening_value REAL NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  conn.execRaw(`CREATE TABLE IF NOT EXISTS stock_movements(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL, item_id INTEGER NOT NULL, qty REAL NOT NULL,
    source TEXT NOT NULL, ref_id INTEGER, note TEXT, created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(item_id) REFERENCES items(id)
  )`);

  conn.execRaw(`CREATE TABLE IF NOT EXISTS production_runs(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL, produced_item_id INTEGER NOT NULL,
    produced_qty REAL NOT NULL, note TEXT, created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(produced_item_id) REFERENCES items(id)
  )`);

  conn.execRaw(`CREATE TABLE IF NOT EXISTS production_materials(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL, item_id INTEGER NOT NULL, qty REAL NOT NULL,
    FOREIGN KEY(run_id) REFERENCES production_runs(id) ON DELETE CASCADE,
    FOREIGN KEY(item_id) REFERENCES items(id)
  )`);

  conn.execRaw(`CREATE TABLE IF NOT EXISTS challan_sequence(
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_number INTEGER NOT NULL DEFAULT 0
  )`);

  const seqRow = conn.queryOne<{ id: number }>('SELECT id FROM challan_sequence WHERE id=1');
  if (!seqRow) {
    conn.execute('INSERT INTO challan_sequence(id, last_number) VALUES (1, 0)');
  }

  const colsToAdd: [string, string][] = [
    ['item_type', 'TEXT'],
    ['qty', 'REAL'],
    ['rate', 'REAL'],
    ['expense_type', 'TEXT'],
    ['linked_sale_id', 'INTEGER'],
    ['extra_json', 'TEXT'],
    ['vendor', 'TEXT'],
    ['is_challan', 'INTEGER NOT NULL DEFAULT 0'],
    ['billed_under_id', 'INTEGER'],
    ['challan_no', 'TEXT'],
  ];

  for (const [col, coltype] of colsToAdd) {
    if (!_hasCol(conn, 'entries', col)) {
      conn.execRaw(`ALTER TABLE entries ADD COLUMN ${col} ${coltype}`);
    }
  }

  if (!_hasCol(conn, 'users', 'entry_window_days')) {
    conn.execRaw('ALTER TABLE users ADD COLUMN entry_window_days INTEGER');
    conn.execRaw("UPDATE users SET entry_window_days = CASE WHEN role='admin' THEN NULL ELSE 1 END");
  }

  for (const table of ['entries', 'payments', 'advances', 'vendor_advances', 'bank_transactions']) {
    if (!_hasCol(conn, table, 'bank_account_id')) {
      conn.execRaw(`ALTER TABLE ${table} ADD COLUMN bank_account_id INTEGER`);
    }
  }

  const defaultRow = conn.queryOne<{ id: number }>('SELECT id FROM bank_accounts ORDER BY id LIMIT 1');
  let defaultAccountId: number;
  if (!defaultRow) {
    const ob = conn.queryOne<{ value: string }>("SELECT value FROM settings WHERE key='opening_bank_balance'");
    const od = conn.queryOne<{ value: string }>("SELECT value FROM settings WHERE key='opening_bank_date'");
    const res = conn.execute(
      'INSERT INTO bank_accounts(name, opening_balance, opening_date) VALUES (?,?,?)',
      [
        DEFAULT_BANK_NAME,
        ob && ob.value != null ? parseFloat(ob.value) : 0,
        od ? od.value : null,
      ]
    );
    defaultAccountId = res.lastInsertRowId;
  } else {
    defaultAccountId = defaultRow.id;
  }

  const updateStmts = [
    "UPDATE payments SET bank_account_id=? WHERE method='bank' AND bank_account_id IS NULL",
    "UPDATE advances SET bank_account_id=? WHERE method='bank' AND bank_account_id IS NULL",
    "UPDATE vendor_advances SET bank_account_id=? WHERE method='bank' AND bank_account_id IS NULL",
    "UPDATE entries SET bank_account_id=? WHERE kind='expense' AND method='bank' AND bank_account_id IS NULL",
    'UPDATE bank_transactions SET bank_account_id=? WHERE bank_account_id IS NULL',
  ];
  for (const stmt of updateStmts) {
    conn.execute(stmt, [defaultAccountId]);
  }

  const defaultItems: [string, string, string][] = [
    ['Brick', 'pcs', 'finished'],
    ['Coal', 'tonne', 'raw'],
    ['Clay', 'tonne', 'raw'],
  ];
  for (const [name, unit, kind_] of defaultItems) {
    const existing = conn.queryOne('SELECT id FROM items WHERE name=?', [name]);
    if (!existing) {
      conn.execute(
        'INSERT INTO items(name, unit, kind, opening_qty, opening_value) VALUES (?,?,?,?,?)',
        [name, unit, kind_, 0, 0]
      );
    }
  }

  const missing = conn.query<{ item_type: string }>(`
    SELECT DISTINCT item_type FROM entries
    WHERE item_type IS NOT NULL AND item_type != ''
    AND item_type NOT IN (SELECT name FROM items)
  `);
  for (const r of missing) {
    conn.execute(
      'INSERT OR IGNORE INTO items(name, unit, kind, opening_qty, opening_value) VALUES (?,?,?,?,?)',
      [r.item_type, 'pcs', 'raw', 0, 0]
    );
  }

  const oldPaidSales = conn.query<any>(`
    SELECT e.* FROM entries e
    WHERE e.kind='sale' AND e.received=1
    AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.entry_id = e.id)
  `);
  for (const e of oldPaidSales) {
    conn.execute(
      `INSERT INTO payments(entry_id, date, method, amount, created_by, bank_account_id)
       VALUES (?,?,?,?,?,?)`,
      [
        e.id,
        e.received_date || e.date,
        e.method || 'cash',
        e.amount,
        e.created_by || 'migration',
        e.method === 'bank' ? defaultAccountId : null,
      ]
    );
  }

  // Seed or ensure default users exist
  const adminRow = conn.queryOne<{ username: string; password_hash: string }>('SELECT username, password_hash FROM users WHERE username=?', ['admin']);
  const adminHash = 'scrypt:32768:8:1$wqiw5SJgV5fUP6xH$7ca92e8c714051162b34960490834cc78b80742ac4753d20385e2e33de210adda765cfb54d3ef87d069cb8381b7a9d1fad1c1b832dea56b56ef331fde65ba035'; // 12346
  const userHash = 'scrypt:32768:8:1$JD4LBoTcPLuPquCs$46a338618557c17e323cd45f025022b4757c1756061c02aa37cf67803442bc68ca0879f13847d6ac84970f30bf3dcd216defa79279efa6a3b462c7595fa51394'; // 1234

  if (!adminRow) {
    conn.execute(
      'INSERT INTO users(username, password_hash, role, label, entry_window_days) VALUES (?,?,?,?,?)',
      ['admin', adminHash, 'admin', 'Admin', null]
    );
  } else if (!adminRow.password_hash || !verifyPassword(adminRow.password_hash, '12346')) {
    conn.execute('UPDATE users SET password_hash=? WHERE username=?', [adminHash, 'admin']);
  }

  const userRow = conn.queryOne<{ username: string; password_hash: string }>('SELECT username, password_hash FROM users WHERE username=?', ['user']);
  if (!userRow) {
    conn.execute(
      'INSERT INTO users(username, password_hash, role, label, entry_window_days) VALUES (?,?,?,?,?)',
      ['user', userHash, 'operator', 'Data Entry Operator', 1]
    );
  } else if (!userRow.password_hash || !verifyPassword(userRow.password_hash, '1234')) {
    conn.execute('UPDATE users SET password_hash=? WHERE username=?', [userHash, 'user']);
  }

  // Indexes
  const indexStmts = [
    'CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date)',
    'CREATE INDEX IF NOT EXISTS idx_entries_kind ON entries(kind)',
    'CREATE INDEX IF NOT EXISTS idx_entries_client ON entries(client)',
    'CREATE INDEX IF NOT EXISTS idx_entries_vendor ON entries(vendor)',
    'CREATE INDEX IF NOT EXISTS idx_entries_kind_date ON entries(kind, date)',
    'CREATE INDEX IF NOT EXISTS idx_entries_item_type ON entries(item_type)',
    'CREATE INDEX IF NOT EXISTS idx_payments_entry ON payments(entry_id)',
    'CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date)',
    'CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(method)',
    'CREATE INDEX IF NOT EXISTS idx_advances_client ON advances(client)',
    'CREATE INDEX IF NOT EXISTS idx_advances_date ON advances(date)',
    'CREATE INDEX IF NOT EXISTS idx_vendor_advances_vendor ON vendor_advances(vendor)',
    'CREATE INDEX IF NOT EXISTS idx_client_adj_client ON client_adjustments(client)',
    'CREATE INDEX IF NOT EXISTS idx_vendor_adj_vendor ON vendor_adjustments(vendor)',
    'CREATE INDEX IF NOT EXISTS idx_stock_item ON stock_movements(item_id)',
    'CREATE INDEX IF NOT EXISTS idx_stock_date ON stock_movements(date)',
    'CREATE INDEX IF NOT EXISTS idx_stock_ref ON stock_movements(ref_id, source)',
    'CREATE INDEX IF NOT EXISTS idx_bank_txn_date ON bank_transactions(date)',
    'CREATE INDEX IF NOT EXISTS idx_bank_txn_account ON bank_transactions(bank_account_id)',
    'CREATE INDEX IF NOT EXISTS idx_prod_date ON production_runs(date)',
    'CREATE INDEX IF NOT EXISTS idx_prod_mats_run ON production_materials(run_id)',
  ];

  for (const stmt of indexStmts) {
    conn.execRaw(stmt);
  }

  conn.save();
  return conn;
}

export async function migrateLegacyAndBootstrap() {
  ensureDataDir();
  let years = listYears();
  const current = indianFyLabel();

  const legacy = LEGACY_DB_PATH;
  const target = fyDbPath(current);
  if (fs.existsSync(legacy) && !fs.existsSync(target)) {
    fs.copyFileSync(legacy, target);
    registerYear(current, true);
    years = listYears();
  }

  if (years.length === 0) {
    registerYear(current, true);
  }

  for (const y of listYears()) {
    const p = fyDbPath(y);
    if (!fs.existsSync(p)) {
      fs.writeFileSync(p, Buffer.alloc(0));
    }
  }

  return getDefaultYear();
}

export async function initAllYearDbs() {
  await migrateLegacyAndBootstrap();
  for (const label of listYears()) {
    await initDb(fyDbPath(label));
  }
}
