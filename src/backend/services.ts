import { DbConn, fyDbPath, registerYear, fyDateRange, listYears, initDb, openDb } from './db.js';
import fs from 'fs';

export function splitKnownExtra(d: Record<string, any>, known: Set<string>): string | null {
  const extra: Record<string, any> = {};
  for (const [k, v] of Object.entries(d)) {
    if (!known.has(k)) {
      extra[k] = v;
    }
  }
  return Object.keys(extra).length > 0 ? JSON.stringify(extra) : null;
}

export function mergeExtra(rowDict: Record<string, any>): Record<string, any> {
  const extra = rowDict.extra_json;
  delete rowDict.extra_json;
  if (extra) {
    try {
      const parsed = JSON.parse(extra);
      for (const [k, v] of Object.entries(parsed)) {
        if (!(k in rowDict)) {
          rowDict[k] = v;
        }
      }
    } catch {}
  }
  return rowDict;
}

export function resolveBankAccountId(conn: DbConn, requestedId: any): number | null {
  let numId: number | null = null;
  if (requestedId !== undefined && requestedId !== null && requestedId !== '') {
    const parsed = parseInt(String(requestedId), 10);
    if (!isNaN(parsed)) numId = parsed;
  }
  if (numId !== null) {
    const row = conn.queryOne<{ id: number }>('SELECT id FROM bank_accounts WHERE id=? AND is_active=1', [numId]);
    if (row) return row.id;
  }
  const row = conn.queryOne<{ id: number }>('SELECT id FROM bank_accounts WHERE is_active=1 ORDER BY id LIMIT 1');
  return row ? row.id : null;
}

export function itemIdByName(conn: DbConn, name: string): number | null {
  if (!name) return null;
  const row = conn.queryOne<{ id: number }>('SELECT id FROM items WHERE name=?', [name.trim()]);
  return row ? row.id : null;
}

export function normalizeName(s: any): string {
  if (s === undefined || s === null) return '';
  return String(s).trim().split(/\s+/).join(' ');
}

export function similarity(a: string, b: string): number {
  a = a.toLowerCase();
  b = b.toLowerCase();
  if (a === b) return 1.0;
  if (!a || !b) return 0.0;

  // Levenshtein distance ratio
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  const dist = dp[m][n];
  const maxLen = Math.max(m, n);
  return (maxLen - dist) / maxLen;
}

export function stripPlural(s: string): [string, boolean] {
  s = s.trim();
  if (s.length > 2 && s.toLowerCase().endsWith('s') && !s.toLowerCase().endsWith('ss')) {
    return [s.slice(0, -1), true];
  }
  return [s, false];
}

export function createItem(conn: DbConn, name: string, unit = 'pcs', kind = 'raw') {
  conn.execute(
    'INSERT OR IGNORE INTO items(name, unit, kind, opening_qty, opening_value) VALUES (?,?,?,?,?)',
    [name, unit, kind, 0, 0]
  );
}

export function fuzzyResolveItem(conn: DbConn, typed: string, autoCreate = false) {
  typed = normalizeName(typed);
  if (!typed) {
    return { status: 'new', canonical: typed, original: typed, candidates: [] };
  }

  const rows = conn.query<{ name: string; is_active: number }>('SELECT name, is_active FROM items ORDER BY id');
  const active = rows.filter(r => r.is_active).map(r => r.name);
  const existing = active.length > 0 ? active : rows.map(r => r.name);

  if (existing.length === 0) {
    if (autoCreate) {
      createItem(conn, typed);
      return { status: 'created', canonical: typed, original: typed, candidates: [] };
    }
    return { status: 'new', canonical: typed, original: typed, candidates: [] };
  }

  if (existing.includes(typed)) {
    return { status: 'exact', canonical: typed, original: typed, candidates: [] };
  }

  const typedL = typed.toLowerCase();
  const ci = existing.filter(n => n.toLowerCase() === typedL);
  if (ci.length > 0) {
    return { status: 'case', canonical: ci[0], original: typed, candidates: [] };
  }

  const [stripped, changed] = stripPlural(typed);
  if (changed) {
    if (existing.includes(stripped)) {
      return { status: 'plural', canonical: stripped, original: typed, candidates: [] };
    }
    const ci2 = existing.filter(n => n.toLowerCase() === stripped.toLowerCase());
    if (ci2.length > 0) {
      return { status: 'plural', canonical: ci2[0], original: typed, candidates: [] };
    }
  }

  const scored: [string, number][] = [];
  const cutoff = 0.80;
  for (const n of existing) {
    const sim = similarity(typed, n);
    const sim2 = changed ? similarity(stripped, n) : 0;
    const best = Math.max(sim, sim2);
    if (best >= cutoff) {
      scored.push([n, best]);
    }
  }

  scored.sort((a, b) => b[1] - a[1]);

  if (scored.length === 0) {
    if (autoCreate) {
      createItem(conn, typed);
      return { status: 'created', canonical: typed, original: typed, candidates: [] };
    }
    return { status: 'new', canonical: typed, original: typed, candidates: [] };
  }

  if (scored.length === 1) {
    return { status: 'close', canonical: scored[0][0], original: typed, candidates: [] };
  }

  const top = scored[0];
  const second = scored[1];
  if (Math.abs(top[1] - second[1]) < 0.03) {
    return {
      status: 'ambiguous',
      canonical: '',
      original: typed,
      candidates: scored.slice(0, 5).map(s => s[0]),
    };
  }

  return { status: 'close', canonical: top[0], original: typed, candidates: [] };
}

export function resolveEntryItem(conn: DbConn, typed: string, autoCreate: boolean, source = 'entry') {
  const res = fuzzyResolveItem(conn, typed, autoCreate);
  const status = res.status;
  if (['exact', 'case', 'plural', 'close', 'created'].includes(status)) {
    return { ok: true, canonical: res.canonical, source, status, original: typed };
  }
  if (status === 'new') {
    return { ok: false, reason: 'new', original: res.original, candidates: [] };
  }
  if (status === 'ambiguous') {
    return { ok: false, reason: 'ambiguous', original: res.original, candidates: res.candidates };
  }
  return { ok: true, canonical: res.canonical, source, status, original: typed };
}

export function computeStockWac(conn: DbConn) {
  const items = conn.query<any>('SELECT id, name, unit, kind, opening_qty, opening_value, is_active FROM items ORDER BY id');
  const state: Record<number, { qty: number; value: number; meta: any }> = {};

  for (const it of items) {
    let q = parseFloat(it.opening_qty || 0);
    let v = parseFloat(it.opening_value || 0);
    if (q < 0) q = 0.0;
    if (v < 0) v = 0.0;
    if (q <= 1e-12) {
      q = 0.0;
      v = 0.0;
    }
    state[it.id] = { qty: q, value: v, meta: it };
  }

  const purchAmount: Record<number, number> = {};
  for (const r of conn.query<any>("SELECT id, amount FROM entries WHERE kind='purchase' AND item_type IS NOT NULL AND item_type != ''")) {
    purchAmount[r.id] = parseFloat(r.amount || 0);
  }

  const runMaterialCost: Record<number, number> = {};

  const movements = conn.query<any>(`
    SELECT id, date, item_id, qty, source, ref_id
    FROM stock_movements
    ORDER BY date ASC, id ASC
  `);

  for (const mov of movements) {
    const itemId = mov.item_id;
    if (!(itemId in state)) continue;
    const st = state[itemId];
    const qty = parseFloat(mov.qty || 0);
    if (Math.abs(qty) < 1e-12) continue;
    const source = mov.source || '';
    const refId = mov.ref_id;

    if (qty > 0) {
      let addVal = 0;
      if (source === 'purchase') {
        addVal = parseFloat(purchAmount[refId] as any || 0);
      } else if (source === 'production_out') {
        addVal = parseFloat(runMaterialCost[refId] as any || 0);
      } else {
        const avg = st.qty > 1e-12 ? st.value / st.qty : 0.0;
        addVal = qty * avg;
      }
      st.qty += qty;
      st.value += addVal;
    } else {
      const outQty = Math.abs(qty);
      const avg = st.qty > 1e-12 ? st.value / st.qty : 0.0;
      const outVal = outQty * avg;
      st.qty -= outQty;
      st.value -= outVal;
      if (source === 'production_in' && refId != null) {
        runMaterialCost[refId] = (runMaterialCost[refId] || 0.0) + outVal;
      }
      if (Math.abs(st.value) < 0.005 && Math.abs(st.qty) < 1e-9) {
        st.qty = 0.0;
        st.value = 0.0;
      }
    }
  }

  const result: Record<number, any> = {};
  for (const [iidStr, st] of Object.entries(state)) {
    const iid = parseInt(iidStr, 10);
    let q = Math.round(st.qty * 1e6) / 1e6;
    let v = Math.round(st.value * 100) / 100;
    if (q < 0) {
      v = 0.0;
    } else if (q <= 1e-12) {
      q = 0.0;
      v = Math.max(v, 0.0);
    } else {
      v = Math.max(v, 0.0);
    }
    const avg = q > 1e-12 ? Math.round((v / q) * 1e4) / 1e4 : 0.0;
    const meta = st.meta;
    result[iid] = {
      id: iid,
      name: meta.name,
      unit: meta.unit,
      kind: meta.kind,
      opening_qty: meta.opening_qty,
      opening_value: meta.opening_value,
      is_active: meta.is_active,
      on_hand_qty: Math.round(q * 1000) / 1000,
      on_hand_value: v,
      avg_rate: avg,
    };
  }
  return result;
}

export function recordStockMovement(
  conn: DbConn,
  movDate: string,
  itemId: number | null,
  qty: number,
  source: string,
  refId: number | null,
  note: string,
  username: string
) {
  if (!itemId || qty === 0) return;
  conn.execute(
    `INSERT INTO stock_movements(date, item_id, qty, source, ref_id, note, created_by)
     VALUES (?,?,?,?,?,?,?)`,
    [movDate, itemId, qty, source, refId, note || '', username]
  );
}

export function nextChallanNo(conn: DbConn): string {
  const row = conn.queryOne<{ last_number: number }>('SELECT last_number FROM challan_sequence WHERE id=1');
  const nextNum = (row ? row.last_number : 0) + 1;
  conn.execute('UPDATE challan_sequence SET last_number=? WHERE id=1', [nextNum]);
  return 'CH-' + String(nextNum).padStart(4, '0');
}

export function clientAdvanceBalance(conn: DbConn, client: string): number {
  const received = conn.queryOne<{ s: number }>('SELECT COALESCE(SUM(amount),0) AS s FROM advances WHERE client=?', [client])?.s || 0;
  const used = conn.queryOne<{ s: number }>(`
    SELECT COALESCE(SUM(p.amount),0) AS s FROM payments p
    JOIN entries e ON e.id = p.entry_id
    WHERE e.client=? AND p.method='advance'
  `, [client])?.s || 0;
  return received - used;
}

export function clientSurplus(conn: DbConn, client: string): number {
  const billed = conn.queryOne<{ s: number }>(`
    SELECT COALESCE(SUM(amount),0) AS s FROM entries
    WHERE kind='sale' AND client=? AND (is_challan=0 OR is_challan IS NULL)
  `, [client])?.s || 0;
  const adj = conn.queryOne<{ s: number }>('SELECT COALESCE(SUM(amount),0) AS s FROM client_adjustments WHERE client=?', [client])?.s || 0;
  const received = conn.queryOne<{ s: number }>(`
    SELECT COALESCE(SUM(p.amount),0) AS s FROM payments p
    JOIN entries e ON e.id = p.entry_id
    WHERE e.client=? AND p.method IN ('cash','bank')
  `, [client])?.s || 0;
  const surplus = received - (billed - adj);
  return Math.max(0.0, surplus);
}

export function recordPayment(
  conn: DbConn,
  entryId: number,
  payDate: string,
  method: string,
  amount: number,
  loadingAmt: any,
  loadingMethod: any,
  username: string,
  bankAccountId: any = null
): [string | null, number | null] {
  const entry = conn.queryOne<any>('SELECT * FROM entries WHERE id=?', [entryId]);
  if (!entry || entry.kind !== 'sale') {
    return ['sale not found', null];
  }
  if (!amount || amount <= 0) {
    return ['amount must be positive', null];
  }
  if (!['cash', 'bank', 'advance'].includes(method)) {
    return ['method must be cash, bank, or advance', null];
  }
  const entryAmount = parseFloat(entry.amount || 0);
  const isChallan = Boolean(entry.is_challan);
  const rate = entry.rate;
  if (isChallan && (!rate || parseFloat(rate) <= 0 || entryAmount <= 0)) {
    return ['cannot record payment on unbilled/material challan (set rate and bill first)', null];
  }
  if (entryAmount <= 0) {
    return ['cannot record payment on a zero-amount entry', null];
  }
  if (method === 'advance') {
    const balance = clientAdvanceBalance(conn, entry.client) + clientSurplus(conn, entry.client);
    if (amount > balance + 0.005) {
      return [`insufficient advance balance (${balance.toFixed(2)} available)`, null];
    }
  }

  let resolvedBankId: number | null = null;
  if (method === 'bank') {
    resolvedBankId = resolveBankAccountId(conn, bankAccountId);
    if (!resolvedBankId) {
      return ['no active bank account; add one first', null];
    }
  }

  let loadingExpenseId: number | null = null;
  const numLoadingAmt = loadingAmt !== undefined && loadingAmt !== null && loadingAmt !== '' ? parseFloat(loadingAmt) : 0;
  if (numLoadingAmt < 0) {
    return ['loading/unloading amount cannot be negative', null];
  }
  if (numLoadingAmt > 0) {
    if (!['cash', 'bank'].includes(loadingMethod)) {
      return ['loading/unloading method must be cash or bank', null];
    }
    let loadingBankId: number | null = null;
    if (loadingMethod === 'bank') {
      loadingBankId = resolvedBankId || resolveBankAccountId(conn, bankAccountId);
      if (!loadingBankId) {
        return ['no active bank account for loading/unloading', null];
      }
    }
    const expRes = conn.execute(
      `INSERT INTO entries(date, kind, client, expense_type, amount, note, method, linked_sale_id, created_by, bank_account_id)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        payDate,
        'expense',
        entry.client,
        'Loading/Unloading',
        numLoadingAmt,
        `Loading/unloading for sale #${entryId} (${entry.item_type || ''} to ${entry.client})`.trim(),
        loadingMethod,
        entryId,
        username,
        loadingBankId,
      ]
    );
    loadingExpenseId = expRes.lastInsertRowId;
  }

  const payRes = conn.execute(
    `INSERT INTO payments(entry_id, date, method, amount, loading_unloading, loading_unloading_expense_id, created_by, bank_account_id)
     VALUES (?,?,?,?,?,?,?,?)`,
    [entryId, payDate, method, amount, numLoadingAmt, loadingExpenseId, username, resolvedBankId]
  );
  return [null, payRes.lastInsertRowId];
}

export function recordPurchasePayment(
  conn: DbConn,
  entryId: number,
  payDate: string,
  method: string,
  amount: number,
  username: string,
  bankAccountId: any = null
): [string | null, number | null] {
  const entry = conn.queryOne<any>('SELECT * FROM entries WHERE id=?', [entryId]);
  if (!entry || entry.kind !== 'purchase') {
    return ['purchase not found', null];
  }
  if (!amount || amount <= 0) {
    return ['amount must be positive', null];
  }
  if (!['cash', 'bank'].includes(method)) {
    return ['method must be cash or bank', null];
  }
  let resolvedBankId: number | null = null;
  if (method === 'bank') {
    resolvedBankId = resolveBankAccountId(conn, bankAccountId);
    if (!resolvedBankId) {
      return ['no active bank account; add one first', null];
    }
  }
  const payRes = conn.execute(
    `INSERT INTO payments(entry_id, date, method, amount, loading_unloading, created_by, bank_account_id)
     VALUES (?,?,?,?,?,?,?)`,
    [entryId, payDate, method, amount, 0, username, resolvedBankId]
  );
  return [null, payRes.lastInsertRowId];
}

export function computeClosingCash(conn: DbConn): number {
  const settings = conn.query<{ key: string; value: string }>('SELECT key, value FROM settings');
  const sMap = Object.fromEntries(settings.map(s => [s.key, s.value]));
  const base = parseFloat(sMap.opening_cash_balance != null ? String(sMap.opening_cash_balance) : '0');
  const od = sMap.opening_cash_date || '0000-01-01';

  const saleIds = new Set(conn.query<{ id: number }>("SELECT id FROM entries WHERE kind='sale'").map(r => r.id));
  const purchIds = new Set(conn.query<{ id: number }>("SELECT id FROM entries WHERE kind='purchase'").map(r => r.id));

  let cashIn = 0.0;
  let cashOut = 0.0;

  for (const p of conn.query<any>("SELECT entry_id, date, method, amount FROM payments WHERE method='cash'")) {
    if (p.date < od) continue;
    if (saleIds.has(p.entry_id)) {
      cashIn += parseFloat(p.amount || 0);
    } else if (purchIds.has(p.entry_id)) {
      cashOut += parseFloat(p.amount || 0);
    }
  }

  for (const a of conn.query<any>("SELECT date, method, amount FROM advances WHERE method='cash'")) {
    if (a.date >= od) {
      cashIn += parseFloat(a.amount || 0);
    }
  }

  for (const a of conn.query<any>("SELECT date, method, amount FROM vendor_advances WHERE method='cash'")) {
    if (a.date >= od) {
      cashOut += parseFloat(a.amount || 0);
    }
  }

  for (const e of conn.query<any>("SELECT date, amount FROM entries WHERE kind='expense' AND method='cash'")) {
    if (e.date >= od) {
      cashOut += parseFloat(e.amount || 0);
    }
  }

  for (const b of conn.query<any>('SELECT date, type, amount FROM bank_transactions')) {
    if (b.date < od) continue;
    if (b.type === 'bank_to_cash') {
      cashIn += parseFloat(b.amount || 0);
    } else if (b.type === 'cash_to_bank') {
      cashOut += parseFloat(b.amount || 0);
    }
  }

  return Math.round((base + cashIn - cashOut) * 100) / 100;
}

export function computeClosingBanks(conn: DbConn) {
  const accounts = conn.query<any>('SELECT id, name, opening_balance, opening_date, is_active FROM bank_accounts ORDER BY id');
  const saleIds = new Set(conn.query<{ id: number }>("SELECT id FROM entries WHERE kind='sale'").map(r => r.id));
  const purchIds = new Set(conn.query<{ id: number }>("SELECT id FROM entries WHERE kind='purchase'").map(r => r.id));

  const result: any[] = [];
  for (const a of accounts) {
    const od = a.opening_date || '0000-01-01';
    let bal = parseFloat(a.opening_balance || 0);
    const aid = a.id;

    for (const p of conn.query<any>("SELECT entry_id, date, amount FROM payments WHERE method='bank' AND bank_account_id=?", [aid])) {
      if (p.date < od) continue;
      if (saleIds.has(p.entry_id)) {
        bal += parseFloat(p.amount || 0);
      } else if (purchIds.has(p.entry_id)) {
        bal -= parseFloat(p.amount || 0);
      }
    }

    for (const adv of conn.query<any>("SELECT date, amount FROM advances WHERE method='bank' AND bank_account_id=?", [aid])) {
      if (adv.date >= od) bal += parseFloat(adv.amount || 0);
    }

    for (const va of conn.query<any>("SELECT date, amount FROM vendor_advances WHERE method='bank' AND bank_account_id=?", [aid])) {
      if (va.date >= od) bal -= parseFloat(va.amount || 0);
    }

    for (const e of conn.query<any>("SELECT date, amount FROM entries WHERE kind='expense' AND method='bank' AND bank_account_id=?", [aid])) {
      if (e.date >= od) bal -= parseFloat(e.amount || 0);
    }

    for (const b of conn.query<any>('SELECT date, type, amount FROM bank_transactions WHERE bank_account_id=?', [aid])) {
      if (b.date < od) continue;
      if (['deposit', 'cash_to_bank'].includes(b.type)) {
        bal += parseFloat(b.amount || 0);
      } else if (['withdrawal', 'bank_to_cash'].includes(b.type)) {
        bal -= parseFloat(b.amount || 0);
      }
    }

    result.push({
      name: a.name,
      opening_balance: Math.round(bal * 100) / 100,
      is_active: a.is_active,
    });
  }
  return result;
}

export function computeClosingStock(conn: DbConn) {
  const wac = computeStockWac(conn);
  const out: any[] = [];
  for (const it of Object.values(wac).sort((a, b) => a.id - b.id)) {
    out.push({
      name: it.name,
      unit: it.unit,
      kind: it.kind,
      opening_qty: it.on_hand_qty,
      opening_value: it.on_hand_qty > 0 ? it.on_hand_value : 0.0,
      is_active: it.is_active,
    });
  }
  return out;
}

export function computeAllClosings(conn: DbConn, sourceFyLabel?: string) {
  const cash = computeClosingCash(conn);
  const banks = computeClosingBanks(conn);
  const stock = computeClosingStock(conn);
  let openingDate: string | null = null;
  if (sourceFyLabel) {
    const { end } = fyDateRange(sourceFyLabel);
    openingDate = end;
  }
  return {
    opening_cash_balance: cash,
    opening_cash_date: openingDate,
    banks,
    items: stock,
    opening_date: openingDate,
  };
}

export function computePartyOpenings(conn: DbConn) {
  const clientAdvances: any[] = [];
  const clients = new Set<string>();
  for (const r of conn.query<{ client: string }>("SELECT DISTINCT client FROM advances WHERE client IS NOT NULL AND client != ''")) {
    clients.add(r.client);
  }
  for (const r of conn.query<{ client: string }>("SELECT DISTINCT client FROM entries WHERE kind='sale' AND client IS NOT NULL AND client != ''")) {
    clients.add(r.client);
  }
  for (const client of Array.from(clients).sort()) {
    const received = conn.queryOne<{ s: number }>('SELECT COALESCE(SUM(amount),0) AS s FROM advances WHERE client=?', [client])?.s || 0;
    const used = conn.queryOne<{ s: number }>(`
      SELECT COALESCE(SUM(p.amount),0) AS s FROM payments p
      JOIN entries e ON e.id = p.entry_id
      WHERE e.client=? AND p.method='advance'
    `, [client])?.s || 0;
    const bal = received - used;
    if (bal > 0.005) {
      clientAdvances.push({ client, amount: Math.round(bal * 100) / 100 });
    }
  }

  const vendorAdvances: any[] = [];
  const vendors = new Set<string>();
  for (const r of conn.query<{ vendor: string }>("SELECT DISTINCT vendor FROM vendor_advances WHERE vendor IS NOT NULL AND vendor != ''")) {
    vendors.add(r.vendor);
  }
  for (const r of conn.query<{ vendor: string }>("SELECT DISTINCT vendor FROM entries WHERE kind='purchase' AND vendor IS NOT NULL AND vendor != ''")) {
    vendors.add(r.vendor);
  }
  for (const vendor of Array.from(vendors).sort()) {
    const paid = conn.queryOne<{ s: number }>('SELECT COALESCE(SUM(amount),0) AS s FROM vendor_advances WHERE vendor=?', [vendor])?.s || 0;
    const used = conn.queryOne<{ s: number }>(`
      SELECT COALESCE(SUM(p.amount),0) AS s FROM payments p
      JOIN entries e ON e.id = p.entry_id
      WHERE e.vendor=? AND e.kind='purchase' AND p.method='advance'
    `, [vendor])?.s || 0;
    const bal = paid - used;
    if (bal > 0.005) {
      vendorAdvances.push({ vendor, amount: Math.round(bal * 100) / 100 });
    }
  }

  const receivables: any[] = [];
  const sales = conn.query<any>(`
    SELECT id, client, amount FROM entries
    WHERE kind='sale' AND (is_challan=0 OR is_challan IS NULL)
      AND amount IS NOT NULL AND amount > 0
      AND client IS NOT NULL AND client != ''
  `);
  const byClient: Record<string, number> = {};
  for (const s of sales) {
    const paid = conn.queryOne<{ s: number }>('SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE entry_id=?', [s.id])?.s || 0;
    const bal = (parseFloat(s.amount) || 0) - paid;
    if (bal > 0.005) {
      byClient[s.client] = (byClient[s.client] || 0) + bal;
    }
  }
  for (const [client, amt] of Object.entries(byClient).sort((a, b) => a[0].localeCompare(b[0]))) {
    receivables.push({ client, amount: Math.round(amt * 100) / 100 });
  }

  const payables: any[] = [];
  const purch = conn.query<any>(`
    SELECT id, vendor, amount FROM entries
    WHERE kind='purchase' AND amount IS NOT NULL AND amount > 0
      AND vendor IS NOT NULL AND vendor != ''
  `);
  const byVendor: Record<string, number> = {};
  for (const p of purch) {
    const paid = conn.queryOne<{ s: number }>('SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE entry_id=?', [p.id])?.s || 0;
    const bal = (parseFloat(p.amount) || 0) - paid;
    if (bal > 0.005) {
      byVendor[p.vendor] = (byVendor[p.vendor] || 0) + bal;
    }
  }
  for (const [vendor, amt] of Object.entries(byVendor).sort((a, b) => a[0].localeCompare(b[0]))) {
    payables.push({ vendor, amount: Math.round(amt * 100) / 100 });
  }

  const unbilled = conn.query<any>(`
    SELECT * FROM entries
    WHERE kind='sale' AND is_challan=1
      AND (billed_under_id IS NULL OR billed_under_id=0)
      AND rate IS NOT NULL AND rate > 0
  `);

  return {
    client_advances: clientAdvances,
    vendor_advances: vendorAdvances,
    receivables,
    payables,
    unbilled_challans: unbilled,
  };
}

export async function createYearDatabase(label: string, copyMastersFrom?: string | null, carryClosings = true) {
  const p = fyDbPath(label);
  const years = listYears();
  if (years.includes(label)) {
    throw new Error(`financial year ${label} already exists`);
  }
  if (fs.existsSync(p) && fs.statSync(p).size > 0) {
    throw new Error(`database file for ${label} already exists; refuse to overwrite`);
  }

  const dconn = await initDb(p);
  if (!copyMastersFrom) {
    registerYear(label);
    return p;
  }

  const src = fyDbPath(copyMastersFrom);
  if (!fs.existsSync(src)) {
    registerYear(label);
    return p;
  }

  const sconn = await openDb(src);
  try {
    const userRows = sconn.query<any>('SELECT * FROM users');
    if (userRows.length > 0) {
      dconn.execRaw('DELETE FROM users');
      for (const u of userRows) {
        dconn.execute(
          'INSERT OR REPLACE INTO users(username, password_hash, role, label, entry_window_days) VALUES (?,?,?,?,?)',
          [u.username, u.password_hash, u.role, u.label, u.entry_window_days]
        );
      }
    }

    let closings: any = null;
    if (carryClosings) {
      try {
        closings = computeAllClosings(sconn, copyMastersFrom);
      } catch (err) {
        console.error('compute closings error', err);
      }
    }

    let openDate: string | null = null;
    if (closings) {
      openDate = closings.opening_date;
      if (openDate) {
        try {
          const d = new Date(openDate + 'T00:00:00');
          d.setDate(d.getDate() + 1);
          openDate = d.toISOString().slice(0, 10);
        } catch {}
      }
    }

    if (closings) {
      dconn.execRaw('DELETE FROM settings');
      dconn.execute("INSERT INTO settings(key,value) VALUES ('opening_cash_balance',?)", [String(closings.opening_cash_balance)]);
      if (openDate) {
        dconn.execute("INSERT INTO settings(key,value) VALUES ('opening_cash_date',?)", [openDate]);
      }

      dconn.execRaw('DELETE FROM bank_accounts');
      for (const b of closings.banks) {
        dconn.execute(
          'INSERT INTO bank_accounts(name, opening_balance, opening_date, is_active) VALUES (?,?,?,?)',
          [b.name, b.opening_balance, openDate, b.is_active ?? 1]
        );
      }

      dconn.execRaw('DELETE FROM items');
      for (const it of closings.items) {
        dconn.execute(
          'INSERT INTO items(name, unit, kind, opening_qty, opening_value, is_active) VALUES (?,?,?,?,?,?)',
          [it.name, it.unit || 'pcs', it.kind || 'raw', it.opening_qty, it.opening_value, it.is_active ?? 1]
        );
      }
    }

    if (carryClosings && openDate) {
      try {
        const parties = computePartyOpenings(sconn);
        for (const a of parties.client_advances || []) {
          dconn.execute(
            `INSERT INTO advances(date, client, amount, method, note, created_by)
             VALUES (?,?,?,?,?,?)`,
            [openDate, a.client, a.amount, 'cash', 'Opening advance carried from prior year', 'year_close']
          );
        }
        for (const a of parties.vendor_advances || []) {
          dconn.execute(
            `INSERT INTO vendor_advances(date, vendor, amount, method, note, created_by)
             VALUES (?,?,?,?,?,?)`,
            [openDate, a.vendor, a.amount, 'cash', 'Opening vendor advance carried from prior year', 'year_close']
          );
        }
        for (const r of parties.receivables || []) {
          dconn.execute(
            `INSERT INTO entries(date, kind, client, amount, note, received, is_challan, created_by)
             VALUES (?,?,?,?,?,?,?,?)`,
            [openDate, 'sale', r.client, r.amount, 'Opening receivable carried from prior year', 0, 0, 'year_close']
          );
        }
        for (const r of parties.payables || []) {
          dconn.execute(
            `INSERT INTO entries(date, kind, vendor, amount, note, received, created_by)
             VALUES (?,?,?,?,?,?,?)`,
            [openDate, 'purchase', r.vendor, r.amount, 'Opening payable carried from prior year', 0, 'year_close']
          );
        }
        for (const ch of parties.unbilled_challans || []) {
          dconn.execute(
            `INSERT INTO entries(date, kind, client, item_type, qty, rate, amount, note,
                   is_challan, challan_no, billed_under_id, created_by)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
              openDate,
              'sale',
              ch.client,
              ch.item_type,
              ch.qty,
              ch.rate,
              ch.amount,
              (ch.note || '') + ' [carried unbilled challan]',
              1,
              ch.challan_no,
              null,
              'year_close',
            ]
          );
        }
      } catch (err) {
        console.error('carry party openings error', err);
      }
    }

    dconn.save();
  } catch (err: any) {
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {}
    throw new Error(`failed to create year ${label}: ${err.message}`);
  }

  registerYear(label);
  return p;
}
