/* ============================= AUTH TOKEN HELPERS & INTERCEPTOR ============================= */
window.__trackerToken = '';

function getStoredToken(){
  if(window.__trackerToken) return window.__trackerToken;
  try{
    const t = localStorage.getItem('tracker_token') || sessionStorage.getItem('tracker_token');
    if(t){ window.__trackerToken = t; return t; }
  }catch(e){}
  try{
    const m = document.cookie.match(/(?:^|;\s*)tracker_token=([^;]+)/);
    if(m && m[1]){ window.__trackerToken = decodeURIComponent(m[1]); return window.__trackerToken; }
  }catch(e){}
  return '';
}

function setStoredToken(tok){
  window.__trackerToken = tok || '';
  if(!tok){ clearStoredToken(); return; }
  try{ localStorage.setItem('tracker_token', tok); }catch(e){}
  try{ sessionStorage.setItem('tracker_token', tok); }catch(e){}
  try{ document.cookie = 'tracker_token=' + encodeURIComponent(tok) + '; path=/; max-age=2592000; SameSite=None; Secure'; }catch(e){}
}

function clearStoredToken(){
  window.__trackerToken = '';
  try{ localStorage.removeItem('tracker_token'); }catch(e){}
  try{ sessionStorage.removeItem('tracker_token'); }catch(e){}
  try{ document.cookie = 'tracker_token=; path=/; max-age=0; SameSite=None; Secure'; }catch(e){}
}

(function(){
  const origFetch = window.fetch;
  window.fetch = function(input, init) {
    init = init || {};
    const token = getStoredToken();
    let url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    
    // Always include credentials for cross-origin session cookies
    if(!init.credentials){
      init.credentials = 'include';
    }

    if (token) {
      // Append token to url if relative API call and not present
      if (typeof input === 'string' && input.startsWith('/api/') && !input.includes('token=') && !input.includes('auth_token=')) {
        const sep = input.includes('?') ? '&' : '?';
        input = input + sep + 'auth_token=' + encodeURIComponent(token);
      }

      if (!init.headers) {
        init.headers = {};
      }
      if (init.headers instanceof Headers) {
        if (!init.headers.has('Authorization')) {
          init.headers.set('Authorization', 'Bearer ' + token);
        }
        if (!init.headers.has('x-auth-token')) {
          init.headers.set('x-auth-token', token);
        }
      } else if (typeof init.headers === 'object') {
        if (!init.headers['Authorization']) {
          init.headers['Authorization'] = 'Bearer ' + token;
        }
        if (!init.headers['x-auth-token']) {
          init.headers['x-auth-token'] = token;
        }
      }
    }
    return origFetch.call(this, input, init);
  };
})();

/* ============================= STATE ============================= */
let entries = [];
let payments = [];
let advances = [];
let vendorAdvances = [];
let adjustments = [];
let vendorAdjustments = [];
let bankTransactions = [];
let bankAccounts = [];
let items = [];
let stock = [];
let stockBook = [];
let productionRuns = [];
let unbilledChallans = [];
let materialSupplied = [];

let kind = 'sale';
let saleMode = 'bill';
let rateDecided = true;
let challanRateDecided = false;
let purchaseMode = 'itemized';
let paidChoice = true;
let method = null;
let currentUser = null;
let pollTimer = null;
let currentTab = 'dashboard';
let openClient = null;
let openVendor = null;
let payModalEntryId = null;
let payMethod = null;
let adjModalClient = null;
let vAdjModalVendor = null;
let vAdvModalVendor = null;
let vAdvMethod = 'cash';
let bankAccountFilter = 'all';
let editingAccountId = null;
let editingItemId = null;
let editEntryId = null;
let editPayId = null;
let editPayMethod = null;
let editPaySplitEnabled = false;
let editPayGroupIds = [];
let selectedChallans = new Set();
let splitEnabled = false;
let loadingEnabled = false;
let paySplitEnabled = false;
let payLoadingEnabled = false;
let selectedMaterial = new Set();
let materialRates = {};
let appSettings = { opening_cash_balance: 0, opening_cash_date: null };

let suggestHighlight = { client: -1, vendor: -1, item: -1, expense: -1, adj: -1, vadj: -1, btcat: -1 };
let pendingFuzzySave = null;

/* ============================= HELPERS ============================= */
function fmt(n){ n = Number(n)||0; return n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtQty(n){ n = Number(n)||0; return n.toLocaleString(undefined,{maximumFractionDigits:3}); }
function todayStr(){ return new Date().toISOString().slice(0,10); }
function addDays(dateStr, n){ const d = new Date(dateStr+'T00:00:00'); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
function isAdmin(){ return currentUser && currentUser.role === 'admin'; }
function fmtDateDMY(iso){
  if(!iso) return '';
  const parts = String(iso).split('-');
  if(parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return d + '/' + m + '/' + y.slice(2);
}
function fmtTimeHM(createdAt){
  if(!createdAt) return '';
  const s = String(createdAt).replace('T', ' ');
  const parts = s.split(' ');
  if(parts.length < 2) return '';
  const [hh, mm] = parts[1].split(':');
  if(!hh || !mm) return '';
  return hh + ':' + mm;
}
function fmtDateTime(iso, createdAt){
  const d = fmtDateDMY(iso);
  const t = fmtTimeHM(createdAt);
  return t ? (d + ' ' + t) : d;
}
function paymentsFor(entryId){ return payments.filter(p=>p.entryId===entryId); }
function paidAmount(entryId){ return paymentsFor(entryId).reduce((a,p)=>a+p.amount,0); }
function escapeAttr(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;'); }
function escapeJs(s){ return String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\r/g,'\\r').replace(/</g,'\\x3c').replace(/>/g,'\\x3e'); }

/* ============================= FUZZY MATCH (frontend preview) ============================= */
function similarity(a, b){
  a = String(a||'').toLowerCase(); b = String(b||'').toLowerCase();
  if(a === b) return 1;
  if(!a || !b) return 0;
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if(longer.indexOf(shorter) !== -1) return shorter.length / longer.length;
  const m = a.length, n = b.length;
  const dp = Array.from({length: m+1}, () => new Array(n+1).fill(0));
  for(let i=0;i<=m;i++) dp[i][0] = i;
  for(let j=0;j<=n;j++) dp[0][j] = j;
  for(let i=1;i<=m;i++){
    for(let j=1;j<=n;j++){
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1]);
    }
  }
  const dist = dp[m][n];
  return 1 - dist / Math.max(m, n);
}
function fuzzyPreviewItem(typed){
  typed = String(typed||'').trim();
  if(!typed) return { status: 'empty' };
  const names = items.filter(i => i.is_active !== 0).map(i => i.name);
  if(!names.length) return { status: 'new', canonical: typed };
  const lower = typed.toLowerCase();
  const exact = names.find(n => n === typed);
  if(exact) return { status: 'exact', canonical: exact };
  const ci = names.find(n => n.toLowerCase() === lower);
  if(ci) return { status: 'case', canonical: ci };
  let stripped = typed, changed = false;
  if(stripped.length > 2 && stripped.toLowerCase().endsWith('s') && !stripped.toLowerCase().endsWith('ss')){
    stripped = stripped.slice(0, -1); changed = true;
  }
  if(changed){
    const sp = names.find(n => n === stripped) || names.find(n => n.toLowerCase() === stripped.toLowerCase());
    if(sp) return { status: 'plural', canonical: sp };
  }
  const scored = [];
  names.forEach(n => {
    const s1 = similarity(typed, n);
    const s2 = changed ? similarity(stripped, n) : 0;
    const best = Math.max(s1, s2);
    if(best >= 0.80) scored.push({ name: n, score: best });
  });
  scored.sort((x,y) => y.score - x.score);
  if(!scored.length) return { status: 'new', canonical: typed };
  if(scored.length === 1) return { status: 'close', canonical: scored[0].name };
  if(Math.abs(scored[0].score - scored[1].score) < 0.03) {
    return { status: 'ambiguous', candidates: scored.slice(0,5).map(s => s.name) };
  }
  return { status: 'close', canonical: scored[0].name };
}

/* ============================= CLIENT FIFO LEDGER ============================= */
function paymentsForClient(client){
  const ids = new Set(entries.filter(e => e.kind === 'sale' && e.client === client).map(e => e.id));
  return payments.filter(p => ids.has(p.entryId));
}
function buildClientLedger(client){
  const bills = entries
    .filter(e => e.kind === 'sale' && e.client === client && !e.isChallan && (e.amount || 0) > 0)
    .slice().sort((a,b) => (a.date < b.date ? -1 : (a.date > b.date ? 1 : a.id - b.id)));
  const challans = entries
    .filter(e => e.kind === 'sale' && e.client === client && e.isChallan && !e.billedUnderId && (e.amount || 0) > 0)
    .slice().sort((a,b) => (a.date < b.date ? -1 : (a.date > b.date ? 1 : a.id - b.id)));
  const billMap = new Map();
  const rows = [];
  bills.forEach(e => rows.push({ date: e.date, sortKey: e.id, type: 'bill', entry: e }));
  challans.forEach(e => rows.push({ date: e.date, sortKey: e.id + 0.001, type: 'challan', entry: e }));
  paymentsForClient(client).forEach(p => rows.push({ date: p.date, sortKey: 1000000 + p.id, type: 'payment', payment: p }));
  advances.filter(a => a.client === client).forEach(a => rows.push({ date: a.date, sortKey: 2000000 + a.id, type: 'advance', advance: a }));
  adjustments.filter(a => a.client === client).forEach(a => rows.push({ date: a.date, sortKey: 3000000 + a.id, type: 'adjustment', adjustment: a }));
  rows.sort((a,b) => a.date === b.date ? a.sortKey - b.sortKey : (a.date < b.date ? -1 : 1));
  let creditPool = 0;
  rows.forEach(row => {
    if(row.type === 'bill' || row.type === 'challan'){
      const e = row.entry;
      billMap.set(e.id, { amount: e.amount, paid: 0, balance: e.amount, isChallan: row.type === 'challan' });
    } else if(row.type === 'payment'){
      // Only cash/bank payments bring new money. Advance-method payments apply existing credit — do not re-add.
      if(row.payment.method !== 'advance'){ creditPool += row.payment.amount; }
    }
    else if(row.type === 'advance'){ creditPool += row.advance.amount; }
    else if(row.type === 'adjustment'){ creditPool += row.adjustment.amount; }
    if(creditPool > 0){
      for(const [id, info] of billMap){
        if(creditPool <= 0) break;
        if(info.balance <= 0.005) continue;
        const apply = Math.min(creditPool, info.balance);
        info.paid += apply;
        info.balance = Math.round((info.balance - apply) * 100) / 100;
        creditPool = Math.round((creditPool - apply) * 100) / 100;
      }
    }
  });
  const advanceBalance = Math.round(creditPool * 100) / 100;
  for(const [id, info] of billMap){
    if(info.balance <= 0.005) info.status = 'paid';
    else if(info.paid > 0.005) info.status = 'partial';
    else info.status = 'pending';
  }
  return { bills: billMap, advanceBalance };
}
let __clientLedgerCache = { key: '', data: null };
function ledgerFor(client){
  const key = client + '|' + entries.length + '|' + payments.length + '|' + advances.length + '|' + adjustments.length;
  if(__clientLedgerCache.key === key) return __clientLedgerCache.data;
  const data = buildClientLedger(client);
  __clientLedgerCache = { key, data };
  return data;
}

/* ============================= VENDOR FIFO LEDGER ============================= */
function paymentsForVendor(vendor){
  const ids = new Set(entries.filter(e => e.kind === 'purchase' && e.vendor === vendor).map(e => e.id));
  return payments.filter(p => ids.has(p.entryId));
}
function buildVendorLedger(vendor){
  const bills = entries
    .filter(e => e.kind === 'purchase' && e.vendor === vendor)
    .slice().sort((a,b) => (a.date < b.date ? -1 : (a.date > b.date ? 1 : a.id - b.id)));
  const billMap = new Map();
  const rows = [];
  bills.forEach(e => rows.push({ date: e.date, sortKey: e.id, type: 'bill', entry: e }));
  paymentsForVendor(vendor).forEach(p => rows.push({ date: p.date, sortKey: 1000000 + p.id, type: 'payment', payment: p }));
  vendorAdvances.filter(a => a.vendor === vendor).forEach(a => rows.push({ date: a.date, sortKey: 2000000 + a.id, type: 'advance', advance: a }));
  vendorAdjustments.filter(a => a.vendor === vendor).forEach(a => rows.push({ date: a.date, sortKey: 3000000 + a.id, type: 'adjustment', adjustment: a }));
  rows.sort((a,b) => a.date === b.date ? a.sortKey - b.sortKey : (a.date < b.date ? -1 : 1));
  let creditPool = 0;
  rows.forEach(row => {
    if(row.type === 'bill'){
      const e = row.entry;
      billMap.set(e.id, { amount: e.amount, paid: 0, balance: e.amount });
    } else if(row.type === 'payment'){ creditPool += row.payment.amount; }
    else if(row.type === 'advance'){ creditPool += row.advance.amount; }
    else if(row.type === 'adjustment'){ creditPool += row.adjustment.amount; }
    if(creditPool > 0){
      for(const [id, info] of billMap){
        if(creditPool <= 0) break;
        if(info.balance <= 0.005) continue;
        const apply = Math.min(creditPool, info.balance);
        info.paid += apply;
        info.balance = Math.round((info.balance - apply) * 100) / 100;
        creditPool = Math.round((creditPool - apply) * 100) / 100;
      }
    }
  });
  const advanceBalance = Math.round(creditPool * 100) / 100;
  for(const [id, info] of billMap){
    if(info.balance <= 0.005) info.status = 'paid';
    else if(info.paid > 0.005) info.status = 'partial';
    else info.status = 'pending';
  }
  return { bills: billMap, advanceBalance };
}
let __vendorLedgerCache = { key: '', data: null };
function vendorLedgerFor(vendor){
  const key = vendor + '|' + entries.length + '|' + payments.length + '|' + vendorAdvances.length + '|' + vendorAdjustments.length;
  if(__vendorLedgerCache.key === key) return __vendorLedgerCache.data;
  const data = buildVendorLedger(vendor);
  __vendorLedgerCache = { key, data };
  return data;
}

/* ============================= BALANCE / STATUS HELPERS ============================= */
function billBalance(entry){
  if(entry.kind === 'sale'){
    if((entry.amount || 0) <= 0) return 0;
    const lg = ledgerFor(entry.client);
    const info = lg.bills.get(entry.id);
    return info ? info.balance : 0;
  }
  if(entry.kind === 'purchase'){
    const lg = vendorLedgerFor(entry.vendor);
    const info = lg.bills.get(entry.id);
    return info ? info.balance : 0;
  }
  return Math.round((entry.amount - paidAmount(entry.id))*100)/100;
}
function billStatus(entry){
  if(entry.kind === 'sale'){
    if((entry.amount || 0) <= 0 && entry.isChallan) return 'material';
    const lg = ledgerFor(entry.client);
    const info = lg.bills.get(entry.id);
    if(!info) return 'pending';
    return info.status;
  }
  if(entry.kind === 'purchase'){
    const lg = vendorLedgerFor(entry.vendor);
    const info = lg.bills.get(entry.id);
    if(!info) return 'pending';
    return info.status;
  }
  const bal = billBalance(entry);
  const paid = paidAmount(entry.id);
  if(bal <= 0.005) return 'paid';
  if(paid > 0.005) return 'partial';
  return 'pending';
}
function saleBalance(e){ return billBalance(e); }
function saleStatus(e){ return billStatus(e); }
function purchaseBalance(e){ return billBalance(e); }
function purchaseStatus(e){ return billStatus(e); }
function lastPaymentDate(entryId){
  const ps = paymentsFor(entryId);
  if(ps.length===0) return null;
  return ps.reduce((latest,p)=> (p.date > latest ? p.date : latest), ps[0].date);
}
function clientAdvanceBalance(c){ return Math.max(0, ledgerFor(c).advanceBalance); }
function clientAdjustmentTotal(c){ return adjustments.filter(a=>a.client===c).reduce((s,a)=>s+a.amount,0); }
function clientGrossPending(c){
  const lg = ledgerFor(c);
  let total = 0;
  lg.bills.forEach(info => { total += Math.max(0, info.balance); });
  return Math.round(total * 100) / 100;
}
function clientNetPending(c){ return clientGrossPending(c); }
function allClientsWithActivity(){
  const names = new Set();
  entries.forEach(e=>{ if(e.kind==='sale' && e.client) names.add(e.client); });
  advances.forEach(a=>names.add(a.client));
  adjustments.forEach(a=>names.add(a.client));
  unbilledChallans.forEach(ch => { if(ch.client) names.add(ch.client); });
  return [...names];
}
function totalPendingAllClients(){
  return allClientsWithActivity().reduce((s,c)=> s + Math.max(0, clientNetPending(c)), 0);
}
function totalClientAdvanceCredit(){
  return allClientsWithActivity().reduce((s,c)=> s + Math.max(0, clientAdvanceBalance(c)), 0);
}

function vendorAdvanceBalance(v){ return Math.max(0, vendorLedgerFor(v).advanceBalance); }
function vendorAdjustmentTotal(v){ return vendorAdjustments.filter(a=>a.vendor===v).reduce((s,a)=>s+a.amount,0); }
function vendorGrossPayable(v){
  const lg = vendorLedgerFor(v);
  let total = 0;
  lg.bills.forEach(info => { total += Math.max(0, info.balance); });
  return Math.round(total * 100) / 100;
}
function vendorPayable(v){
  return vendorGrossPayable(v);
}
function allVendorsWithActivity(){
  const names = new Set();
  entries.forEach(e=>{ if(e.kind==='purchase' && e.vendor) names.add(e.vendor); });
  vendorAdjustments.forEach(a=>names.add(a.vendor));
  vendorAdvances.forEach(a=>names.add(a.vendor));
  return [...names];
}
function totalPayableAllVendors(){
  return allVendorsWithActivity().reduce((s,v)=> s + Math.max(0, vendorPayable(v)), 0);
}
function allPendingClientsWithAmounts(){
  return allClientsWithActivity()
    .map(name => ({ name, net: clientNetPending(name) }))
    .filter(c => c.net > 0.005)
    .sort((a,b) => b.net - a.net);
}
function allPayableVendorsWithAmounts(){
  return allVendorsWithActivity()
    .map(name => ({ name, net: vendorPayable(name) }))
    .filter(v => v.net > 0.005)
    .sort((a,b) => b.net - a.net);
}

function activeBankAccounts(){ return bankAccounts.filter(a=>a.is_active); }
function accountName(id){ const a = bankAccounts.find(x=>x.id===id); return a ? a.name : '—'; }
function fillAccountSelect(selectEl, selectedId, includeAll, allLabel){
  if(!selectEl) return;
  let html = '';
  if(includeAll) html += `<option value="all">${allLabel || 'All accounts (combined)'}</option>`;
  activeBankAccounts().forEach(a=>{
    html += `<option value="${a.id}" ${a.id===selectedId?'selected':''}>${escapeAttr(a.name)}</option>`;
  });
  if(!html) html = `<option value="">(no accounts)</option>`;
  selectEl.innerHTML = html;
  if(selectedId !== undefined && selectedId !== null && !includeAll){ selectEl.value = selectedId; }
}
function defaultAccountId(){ const a = activeBankAccounts()[0]; return a ? a.id : null; }

/* ============================= RANGE TOTALS ============================= */
function computeRangeTotals(fromStr, toStr, accountFilter){
  accountFilter = accountFilter || 'all';
  const matchesAcct = row => accountFilter==='all' || row.bankAccountId===accountFilter;
  const inRange = d => d >= fromStr && d <= toStr;
  const saleIds = new Set(entries.filter(e=>e.kind==='sale').map(e=>e.id));
  const purchIds = new Set(entries.filter(e=>e.kind==='purchase').map(e=>e.id));
  const salePayments = payments.filter(p=>inRange(p.date) && saleIds.has(p.entryId));
  const purchPayments = payments.filter(p=>inRange(p.date) && purchIds.has(p.entryId));
  const cashSale = salePayments.filter(p=>p.method==='cash').reduce((s,p)=>s+p.amount,0);
  const bankSale = salePayments.filter(p=>p.method==='bank' && matchesAcct(p)).reduce((s,p)=>s+p.amount,0);
  const cashPurch = purchPayments.filter(p=>p.method==='cash').reduce((s,p)=>s+p.amount,0);
  const bankPurch = purchPayments.filter(p=>p.method==='bank' && matchesAcct(p)).reduce((s,p)=>s+p.amount,0);
  const advInRange = advances.filter(a=>inRange(a.date));
  const advCash = advInRange.filter(a=>a.method==='cash').reduce((s,a)=>s+a.amount,0);
  const advBank = advInRange.filter(a=>a.method==='bank' && matchesAcct(a)).reduce((s,a)=>s+a.amount,0);
  const vAdvInRange = vendorAdvances.filter(a=>inRange(a.date));
  const vAdvCash = vAdvInRange.filter(a=>a.method==='cash').reduce((s,a)=>s+a.amount,0);
  const vAdvBank = vAdvInRange.filter(a=>a.method==='bank' && matchesAcct(a)).reduce((s,a)=>s+a.amount,0);
  const expInRange = entries.filter(e=>e.kind==='expense' && inRange(e.date));
  const cashExp = expInRange.filter(e=>e.method==='cash').reduce((s,e)=>s+e.amount,0);
  const bankExp = expInRange.filter(e=>e.method==='bank' && matchesAcct(e)).reduce((s,e)=>s+e.amount,0);
  const salesInRange = entries.filter(e=>e.kind==='sale' && inRange(e.date));
  const purchasesInRange = entries.filter(e=>e.kind==='purchase' && inRange(e.date));
  const bankTxnInRange = bankTransactions.filter(b=>inRange(b.date) && matchesAcct(b));
  const bankDeposits = bankTxnInRange.filter(b=>b.type==='deposit').reduce((s,b)=>s+b.amount,0);
  const bankWithdrawals = bankTxnInRange.filter(b=>b.type==='withdrawal').reduce((s,b)=>s+b.amount,0);
  const cashToBank = bankTxnInRange.filter(b=>b.type==='cash_to_bank').reduce((s,b)=>s+b.amount,0);
  const bankToCash = bankTxnInRange.filter(b=>b.type==='bank_to_cash').reduce((s,b)=>s+b.amount,0);
  return { cashSale, bankSale, advCash, advBank, vAdvCash, vAdvBank, cashExp, bankExp, cashPurch, bankPurch,
    expInRange, salesInRange, purchasesInRange, salePayments, purchPayments,
    bankTxnInRange, bankDeposits, bankWithdrawals, cashToBank, bankToCash };
}
function computeOpeningCash(fromStr){
  let base = 0;
  const od = appSettings.opening_cash_date || '0000-01-01';
  // Opening balance is as-of start of od; include it when reporting from od or later
  if(od <= fromStr){
    base = Number(appSettings.opening_cash_balance) || 0;
  }
  const saleIds = new Set(entries.filter(e=>e.kind==='sale').map(e=>e.id));
  const purchIds = new Set(entries.filter(e=>e.kind==='purchase').map(e=>e.id));
  // Activity before fromStr and on/after opening date (opening day activity is in-period, not in opening)
  const cashIn = payments.filter(p=>p.method==='cash' && p.date < fromStr && p.date >= od && saleIds.has(p.entryId)).reduce((s,p)=>s+p.amount,0)
    + advances.filter(a=>a.method==='cash' && a.date < fromStr && a.date >= od).reduce((s,a)=>s+a.amount,0)
    + bankTransactions.filter(b=>b.type==='bank_to_cash' && b.date < fromStr && b.date >= od).reduce((s,b)=>s+b.amount,0);
  const cashOut = payments.filter(p=>p.method==='cash' && p.date < fromStr && p.date >= od && purchIds.has(p.entryId)).reduce((s,p)=>s+p.amount,0)
    + vendorAdvances.filter(a=>a.method==='cash' && a.date < fromStr && a.date >= od).reduce((s,a)=>s+a.amount,0)
    + entries.filter(e=>e.kind==='expense' && e.method==='cash' && e.date < fromStr && e.date >= od).reduce((s,e)=>s+e.amount,0)
    + bankTransactions.filter(b=>b.type==='cash_to_bank' && b.date < fromStr && b.date >= od).reduce((s,b)=>s+b.amount,0);
  return Math.round((base + cashIn - cashOut)*100)/100;
}
function computeOpeningBank(fromStr, accountFilter){
  accountFilter = accountFilter || 'all';
  const matchesAcct = row => accountFilter==='all' || row.bankAccountId===accountFilter;
  let ob = 0;
  if(accountFilter === 'all'){
    bankAccounts.forEach(a=>{ const d = a.opening_date || '0000-01-01'; if(d <= fromStr) ob += a.opening_balance || 0; });
  } else {
    const a = bankAccounts.find(x=>x.id===accountFilter);
    if(a){ const d = a.opening_date || '0000-01-01'; if(d <= fromStr) ob = a.opening_balance || 0; }
  }
  const isAfterOpening = (row) => {
    const a = bankAccounts.find(x=>x.id===row.bankAccountId);
    const d = (a && a.opening_date) || '0000-01-01';
    return d <= fromStr && row.date >= d;
  };
  const inWindow = row => row.date < fromStr && isAfterOpening(row);
  const saleIds = new Set(entries.filter(e=>e.kind==='sale').map(e=>e.id));
  const purchIds = new Set(entries.filter(e=>e.kind==='purchase').map(e=>e.id));
  const credit = payments.filter(p=>p.method==='bank' && matchesAcct(p) && inWindow(p) && saleIds.has(p.entryId)).reduce((s,p)=>s+p.amount,0)
    + advances.filter(a=>a.method==='bank' && matchesAcct(a) && inWindow(a)).reduce((s,a)=>s+a.amount,0)
    + bankTransactions.filter(b=>(b.type==='deposit'||b.type==='cash_to_bank') && matchesAcct(b) && inWindow(b)).reduce((s,b)=>s+b.amount,0);
  const debit = payments.filter(p=>p.method==='bank' && matchesAcct(p) && inWindow(p) && purchIds.has(p.entryId)).reduce((s,p)=>s+p.amount,0)
    + vendorAdvances.filter(a=>a.method==='bank' && matchesAcct(a) && inWindow(a)).reduce((s,a)=>s+a.amount,0)
    + entries.filter(e=>e.kind==='expense' && e.method==='bank' && matchesAcct(e) && inWindow(e)).reduce((s,e)=>s+e.amount,0)
    + bankTransactions.filter(b=>(b.type==='withdrawal'||b.type==='bank_to_cash') && matchesAcct(b) && inWindow(b)).reduce((s,b)=>s+b.amount,0);
  return Math.round((ob + credit - debit)*100)/100;
}
function currentBankBalance(accountFilter){ return computeOpeningBank(addDays(todayStr(), 1), accountFilter||'all'); }

function perAccountBalances(fromStr, toStr){
  const results = [];
  const allAccts = bankAccounts.slice().sort((a,b) => {
    if(a.is_active !== b.is_active) return b.is_active - a.is_active;
    return a.id - b.id;
  });
  for(const a of allAccts){
    const ledger = buildBankLedger(a.id);
    let opening = 0, lastBefore = null;
    for(const r of ledger){ if(r.date < fromStr) lastBefore = r; else break; }
    if(lastBefore) opening = lastBefore.balance;
    else if((a.opening_date || '9999-12-31') < fromStr) opening = a.opening_balance || 0;
    let closing = opening, lastUpto = null;
    for(const r of ledger){ if(r.date > toStr) break; lastUpto = r; }
    if(lastUpto) closing = lastUpto.balance;
    results.push({
      id: a.id, name: a.name, is_active: !!a.is_active,
      opening: Math.round(opening*100)/100,
      closing: Math.round(closing*100)/100
    });
  }
  return results;
}

/* ============================= LEDGERS FOR BANK/CASH BOOK ============================= */
function buildBankLedger(accountFilter){
  accountFilter = accountFilter || 'all';
  const wants = row => accountFilter==='all' || row.bankAccountId===accountFilter;
  const rows = [];
  if(accountFilter === 'all'){
    bankAccounts.forEach(a=>{
      const d = a.opening_date; if(!d) return;
      const ob = a.opening_balance || 0;
      rows.push({ date:d, sortKey:-1, label:`Opening — ${a.name}`, credit: ob>=0?ob:0, debit: ob<0?-ob:0, source:'opening', sourceId:a.id });
    });
  } else {
    const a = bankAccounts.find(x=>x.id===accountFilter);
    if(a && a.opening_date){
      const ob = a.opening_balance || 0;
      rows.push({ date:a.opening_date, sortKey:-1, label:'Opening Balance', credit: ob>=0?ob:0, debit: ob<0?-ob:0, source:'opening', sourceId:a.id });
    }
  }
  payments.filter(p=>p.method==='bank' && wants(p)).forEach(p=>{
    const e = entries.find(x=>x.id===p.entryId);
    const isSale = e && e.kind==='sale';
    const isPurch = e && e.kind==='purchase';
    let label;
    if(isSale) label = 'Sale Receipt' + (e.client?' — '+e.client:'');
    else if(isPurch) label = 'Purchase Paid' + (e.vendor?' — '+e.vendor:'');
    else label = 'Payment';
    rows.push({ date:p.date, sortKey:p.id,
      label: label + (accountFilter==='all' ? ` [${accountName(p.bankAccountId)}]` : ''),
      credit: isPurch ? 0 : p.amount, debit: isPurch ? p.amount : 0,
      source:'payment', sourceId:p.id });
  });
  advances.filter(a=>a.method==='bank' && wants(a)).forEach(a=>{
    rows.push({ date:a.date, sortKey:a.id+0.1,
      label:'Advance from ' + a.client + (accountFilter==='all' ? ` [${accountName(a.bankAccountId)}]` : ''),
      credit:a.amount, debit:0, source:'advance', sourceId:a.id });
  });
  vendorAdvances.filter(a=>a.method==='bank' && wants(a)).forEach(a=>{
    rows.push({ date:a.date, sortKey:a.id+0.15,
      label:'Advance paid — ' + a.vendor + (accountFilter==='all' ? ` [${accountName(a.bankAccountId)}]` : ''),
      credit:0, debit:a.amount, source:'vendor_advance', sourceId:a.id });
  });
  entries.filter(e=>e.kind==='expense' && e.method==='bank' && wants(e)).forEach(e=>{
    rows.push({ date:e.date, sortKey:e.id+0.2,
      label:'Expense — '+(e.expenseType||'') + (accountFilter==='all' ? ` [${accountName(e.bankAccountId)}]` : ''),
      credit:0, debit:e.amount, source:'expense', sourceId:e.id, linkedSaleId: e.linkedSaleId || null });
  });
  bankTransactions.filter(wants).forEach(b=>{
    const labels = { deposit:'Deposit', withdrawal:'Withdrawal', cash_to_bank:'Cash → Bank', bank_to_cash:'Bank → Cash' };
    const isCredit = b.type==='deposit' || b.type==='cash_to_bank';
    rows.push({ date:b.date, sortKey:b.id+0.3,
      label: labels[b.type] + (b.category?' — '+b.category:'') + (accountFilter==='all' ? ` [${accountName(b.bankAccountId)}]` : ''),
      credit: isCredit ? b.amount : 0, debit: isCredit ? 0 : b.amount,
      source:'bank_txn', sourceId:b.id });
  });
  rows.sort((a,b)=> a.date===b.date ? a.sortKey-b.sortKey : (a.date<b.date?-1:1));
  let running = 0;
  rows.forEach(r=>{ running += r.credit - r.debit; r.balance = Math.round(running*100)/100; });
  return rows;
}

function buildCashBook(fromStr, toStr){
  const inRange = d => (!fromStr || d >= fromStr) && (!toStr || d <= toStr);
  const rows = [];
  const saleIds = new Set(entries.filter(e=>e.kind==='sale').map(e=>e.id));
  payments.filter(p=>p.method==='cash' && saleIds.has(p.entryId) && inRange(p.date)).forEach(p=>{
    const e = entries.find(x=>x.id===p.entryId);
    rows.push({ date:p.date, sortKey:p.id,
      label: 'Sale Receipt' + (e && e.client ? ' — '+e.client : ''),
      inAmt: p.amount, outAmt: 0, source:'payment', sourceId:p.id });
  });
  advances.filter(a=>a.method==='cash' && inRange(a.date)).forEach(a=>{
    rows.push({ date:a.date, sortKey:a.id+0.1, label: 'Advance from ' + a.client,
      inAmt: a.amount, outAmt: 0, source:'advance', sourceId:a.id });
  });
  const purchIds = new Set(entries.filter(e=>e.kind==='purchase').map(e=>e.id));
  payments.filter(p=>p.method==='cash' && purchIds.has(p.entryId) && inRange(p.date)).forEach(p=>{
    const e = entries.find(x=>x.id===p.entryId);
    rows.push({ date:p.date, sortKey:p.id+0.2,
      label: 'Purchase Paid' + (e && e.vendor ? ' — '+e.vendor : ''),
      inAmt: 0, outAmt: p.amount, source:'payment', sourceId:p.id });
  });
  vendorAdvances.filter(a=>a.method==='cash' && inRange(a.date)).forEach(a=>{
    rows.push({ date:a.date, sortKey:a.id+0.25, label: 'Advance paid — ' + a.vendor,
      inAmt: 0, outAmt: a.amount, source:'vendor_advance', sourceId:a.id });
  });
  entries.filter(e=>e.kind==='expense' && e.method==='cash' && inRange(e.date)).forEach(e=>{
    rows.push({ date:e.date, sortKey:e.id+0.3, label: 'Expense — ' + (e.expenseType || 'Expense'),
      inAmt: 0, outAmt: e.amount, source:'expense', sourceId:e.id, linkedSaleId: e.linkedSaleId || null });
  });
  bankTransactions.filter(b=>inRange(b.date)).forEach(b=>{
    if(b.type === 'cash_to_bank'){
      rows.push({ date:b.date, sortKey:b.id+0.4, label: 'Cash deposited to bank' + (b.note ? ' — '+b.note : ''),
        inAmt: 0, outAmt: b.amount, source:'bank_txn', sourceId:b.id });
    } else if(b.type === 'bank_to_cash'){
      rows.push({ date:b.date, sortKey:b.id+0.5, label: 'Cash withdrawn from bank' + (b.note ? ' — '+b.note : ''),
        inAmt: b.amount, outAmt: 0, source:'bank_txn', sourceId:b.id });
    }
  });
  rows.sort((a,b)=> a.date === b.date ? a.sortKey - b.sortKey : (a.date < b.date ? -1 : 1));
  let running = 0;
  rows.forEach(r=>{ running += r.inAmt - r.outAmt; r.balance = Math.round(running * 100) / 100; });
  return rows;
}
