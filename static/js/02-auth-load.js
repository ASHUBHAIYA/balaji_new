
/* ============================= FINANCIAL YEAR ============================= */
let currentFy = null;
let availableYears = [];

function openFyModal(){
  const m = document.getElementById('fyModal');
  if(!m) return;
  m.style.display = 'flex';
  const adm = document.getElementById('fyAdminSection');
  if(adm) adm.style.display = isAdmin() ? 'block' : 'none';
  loadYearOptions();
}
function closeFyModal(){
  const m = document.getElementById('fyModal');
  if(m) m.style.display = 'none';
}
function updateFyBadge(){
  const b = document.getElementById('fyIconBadge');
  if(b) b.textContent = currentFy || '';
  const btn = document.getElementById('fyIconBtn');
  if(btn && currentFy) btn.title = 'Financial year: ' + currentFy;
}

async function loadYearOptions(){
  const fallbackYears = [
    { label: '2026-27', start: '2026-04-01', end: '2027-03-31' },
    { label: '2025-26', start: '2025-04-01', end: '2026-03-31' },
    { label: '2024-25', start: '2024-04-01', end: '2025-03-31' }
  ];

  let rawYears = [];
  let active = '2026-27';

  try{
    const res = await fetch('/api/years');
    if(res.ok){
      const data = await res.json();
      if(data && Array.isArray(data.years) && data.years.length > 0){
        rawYears = data.years;
      }
      active = data.active || data.default || (rawYears[0] && (rawYears[0].label || rawYears[0])) || '2026-27';
    }
  }catch(e){
    console.warn('Using fallback financial years:', e);
  }

  if(rawYears.length === 0){
    rawYears = fallbackYears;
  }

  // Normalize into array of objects { label, start, end }
  const normalized = rawYears.map(y => {
    if(typeof y === 'object' && y && y.label){
      const s = y.start || y.start_date || (y.label.split('-')[0] + '-04-01');
      const e = y.end || y.end_date || ((parseInt(y.label.split('-')[0], 10) + 1) + '-03-31');
      return { label: y.label, start: s, end: e };
    }
    const lbl = String(y || '2026-27');
    const startY = parseInt(lbl.split('-')[0], 10) || 2026;
    return { label: lbl, start: `${startY}-04-01`, end: `${startY + 1}-03-31` };
  });

  availableYears = normalized.map(x => x.label);

  const loginSel = document.getElementById('loginFy');
  const activeSel = document.getElementById('activeFySelect');
  const copySel = document.getElementById('newFyCopyFrom');

  if(loginSel){
    const previousChoice = loginSel.value;
    loginSel.innerHTML = normalized.map(y =>
      `<option value="${y.label}" ${y.label===active?'selected':''}>${y.label} (${y.start} → ${y.end})</option>`
    ).join('');
    if(previousChoice && normalized.some(x => x.label === previousChoice)){
      loginSel.value = previousChoice;
    } else if(loginSel.value !== active && active){
      loginSel.value = active;
    }
  }

  if(activeSel){
    activeSel.innerHTML = normalized.map(y =>
      `<option value="${y.label}" ${y.label===active?'selected':''}>${y.label}</option>`
    ).join('');
  }

  if(copySel){
    copySel.innerHTML = normalized.map(y => `<option value="${y.label}">${y.label}</option>`).join('');
  }

  currentFy = active;
  const info = normalized.find(x => x.label === active);
  const hint = document.getElementById('fyRangeHint');
  if(hint && info) hint.textContent = info.start + ' to ' + info.end;
}

function fillFyUI(data){
  if(!data) return;
  currentFy = data.fy || currentFy;
  if(data.years) availableYears = data.years;
  const years = data.years || availableYears || [];
  const activeSel = document.getElementById('activeFySelect');
  if(activeSel && years.length){
    activeSel.innerHTML = years.map(y =>
      `<option value="${y}" ${y===currentFy?'selected':''}>${y}</option>`
    ).join('');
  }
  if(data.yearInfo){
    const hint = document.getElementById('fyRangeHint');
    if(hint) hint.textContent = data.yearInfo.start + ' to ' + data.yearInfo.end;
  }
  const copySel = document.getElementById('newFyCopyFrom');
  if(copySel && years.length){
    copySel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
  }
}

async function switchFinancialYear(label){
  if(!label || label === currentFy) return;
  if(!confirm('Switch to financial year ' + label + '?\n\nUnsaved form data on this screen will be reloaded from that year\'s database.')){
    const activeSel = document.getElementById('activeFySelect');
    if(activeSel) activeSel.value = currentFy || '';
    return;
  }
  try{
    const res = await fetch('/api/years/select', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ fy: label })
    });
    const data = await res.json().catch(()=>({}));
    if(!res.ok){ alert(data.error || 'Could not switch year'); return; }
    currentFy = label;
    if(data.role) currentUser.role = data.role;
    fillFyUI({ fy: label, yearInfo: data.yearInfo, years: availableYears });
    document.body.classList.toggle('is-operator', !isAdmin());
    await load();
    closeFyModal();
    updateFyBadge();
    alert('Working in FY ' + label);
  }catch(err){ alert('Could not switch year'); }
}

async function createFinancialYear(){
  if(!isAdmin()){ alert('Admin only'); return; }
  const label = (document.getElementById('newFyLabel').value || '').trim();
  const copyFrom = document.getElementById('newFyCopyFrom').value;
  if(!label){ alert('Enter FY like 2026-27'); return; }
  try{
    const res = await fetch('/api/years', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ fy: label, copyFrom })
    });
    const data = await res.json().catch(()=>({}));
    if(!res.ok){ alert(data.error || 'Could not create'); return; }
    availableYears = data.years || availableYears;
    fillFyUI({ fy: currentFy, years: availableYears });
    await loadYearOptions();
    document.getElementById('fyAdminMsg').textContent = 'Created FY ' + label + (data.copiedFrom ? ' (masters from ' + data.copiedFrom + ')' : '');
    document.getElementById('newFyLabel').value = '';
  }catch(e){ alert('Could not create year'); }
}

loadYearOptions();

/* ============================= AUTH ============================= */
async function attemptLogin(){
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const errBox = document.getElementById('loginError');
  if(!username || !password){
    errBox.textContent = 'Enter both User ID and Password.';
    errBox.style.display = 'block';
    return;
  }
  try{
    const fy = (document.getElementById('loginFy') && document.getElementById('loginFy').value) || '';
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username, password, fy })
    });
    if(!res.ok){
      let msg = 'Wrong User ID or Password.';
      try {
        const j = await res.json();
        if(j && j.error === 'invalid credentials') msg = 'Wrong User ID or Password.';
      } catch(e){}
      errBox.textContent = msg;
      errBox.style.display = 'block';
      return;
    }
    const respData = await res.json();
    currentUser = {
      username: respData.username || (respData.user && respData.user.username) || username,
      role: respData.role || (respData.user && respData.user.role) || (username === 'admin' ? 'admin' : 'operator'),
      label: respData.label || (respData.user && respData.user.label) || (username === 'admin' ? 'Administrator' : 'Data Entry Operator'),
      fy: respData.fy || (respData.user && respData.user.fy) || fy || '2026-27',
      token: respData.token || (respData.user && respData.user.token) || '',
      years: respData.years || ['2026-27', '2025-26', '2024-25'],
      yearInfo: respData.yearInfo || { label: fy || '2026-27', start: '2026-04-01', end: '2027-03-31' }
    };
    if(currentUser.token){
      setStoredToken(currentUser.token);
    }
    errBox.style.display = 'none';
    fillFyUI(currentUser);
    enterApp();
  }catch(err){
    errBox.textContent = 'Cannot reach server. Please check your connection.';
    errBox.style.display = 'block';
  }
}
async function logout(){
  try{ await fetch('/api/logout', {method:'POST'}); }catch(e){}
  clearStoredToken();
  currentUser = null;
  if(pollTimer) clearInterval(pollTimer);
  document.getElementById('appContent').style.display = 'none';
  document.getElementById('loginOverlay').style.display = 'flex';
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  document.getElementById('loginError').style.display = 'none';
}
function applyDateBounds(){
  const today = todayStr();
  const ids = ['date','payDate','adjDate','vAdjDate','vAdvDate','fromDate','toDate','btDate','btVendorDate','btClientDate','acctOpeningDate','adjItemDate','prodFrom','prodTo','cbFrom','cbTo','spFrom','spTo','challanBillDate','materialBillDate','edit_pay_date'];
  ids.forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    if(isAdmin()){ el.removeAttribute('min'); el.removeAttribute('max'); }
    else if(['fromDate','toDate','prodFrom','prodTo','cbFrom','cbTo','spFrom','spTo'].includes(id)){ el.removeAttribute('min'); el.removeAttribute('max'); }
    else { el.min = addDays(today, -1); el.max = today; }
  });
}
function enterApp(){
  if(!currentUser) return;
  document.getElementById('loginOverlay').style.display = 'none';
  document.getElementById('appContent').style.display = 'block';
  const displayLabel = currentUser.label || (currentUser.role === 'admin' ? 'Administrator' : 'User');
  const displayUser = currentUser.username || 'admin';
  document.getElementById('whoAmI').textContent = displayLabel + ' (' + displayUser + ')';
  document.body.classList.toggle('is-operator', !isAdmin());
  fillFyUI(currentUser);
  updateFyBadge();
  document.getElementById('date').value = todayStr();
  document.getElementById('fromDate').value = todayStr();
  document.getElementById('toDate').value = todayStr();
  document.getElementById('adjItemDate').value = todayStr();
  document.getElementById('challanBillDate').value = todayStr();
  document.getElementById('materialBillDate').value = todayStr();
  document.getElementById('btVendorDate').value = todayStr();
  document.getElementById('btClientDate').value = todayStr();
  initDashRange();
  applyDateBounds();
  setKind('sale');
  load();
  loadTypeOptions();
  if(pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(load, 15000);
}
(async function tryAutoLogin(){
  try{
    const tok = getStoredToken();
    const res = await fetch('/api/me');
    if(res.ok){
      const respData = await res.json();
      currentUser = {
        username: respData.username || (respData.user && respData.user.username) || 'admin',
        role: respData.role || (respData.user && respData.user.role) || 'admin',
        label: respData.label || (respData.user && respData.user.label) || 'Administrator',
        fy: respData.fy || (respData.user && respData.user.fy) || '2026-27',
        token: tok || '',
        years: respData.years || ['2026-27', '2025-26', '2024-25'],
        yearInfo: respData.yearInfo || { label: '2026-27', start: '2026-04-01', end: '2027-03-31' }
      };
      fillFyUI(currentUser);
      enterApp();
    } else if(!tok) {
      clearStoredToken();
    }
  }catch(e){}
})();

/* ============================= DATA LOAD ============================= */
async function load(){
  try{
    const [eRes, pRes, aRes, vaRes, jRes, vjRes, bRes, accRes, itRes, stRes, prRes, chRes, sbRes, msRes, setRes] = await Promise.all([
      fetch('/api/entries'), fetch('/api/payments'), fetch('/api/advances'), fetch('/api/vendor-advances'),
      fetch('/api/client-adjustments'), fetch('/api/vendor-adjustments'),
      fetch('/api/bank-transactions'),
      fetch('/api/bank-accounts'), fetch('/api/items'), fetch('/api/stock'),
      fetch('/api/production'), fetch('/api/challans/unbilled'), fetch('/api/stock-book'),
      fetch('/api/material-supplied'), fetch('/api/settings')
    ]);
    if(eRes.status === 401){
      const checkMe = await fetch('/api/me').catch(()=>null);
      if(!checkMe || !checkMe.ok){
        logout();
        return;
      }
    }
    const eRows = await eRes.json();
    const pRows = await pRes.json();
    const aRows = await aRes.json();
    const vaRows = vaRes.ok ? await vaRes.json() : [];
    const jRows = await jRes.json();
    const vjRows = vjRes.ok ? await vjRes.json() : [];
    const bRows = await bRes.json();
    const accRows = accRes.ok ? await accRes.json() : [];
    const itRows = itRes.ok ? await itRes.json() : [];
    const stRows = stRes.ok ? await stRes.json() : [];
    const prRows = prRes.ok ? await prRes.json() : [];
    const chRows = chRes.ok ? await chRes.json() : [];
    const sbRows = sbRes.ok ? await sbRes.json() : [];
    const msRows = msRes.ok ? await msRes.json() : [];
    if(setRes && setRes.ok){
      const s = await setRes.json();
      appSettings = {
        opening_cash_balance: Number(s.opening_cash_balance) || 0,
        opening_cash_date: s.opening_cash_date || null
      };
    }

    entries = eRows.map(r => ({
      id: r.id, date: r.date, kind: r.kind, client: r.client || '', vendor: r.vendor || '',
      itemType: r.item_type || '', qty: r.qty, rate: r.rate,
      expenseType: r.expense_type || '', amount: r.amount, note: r.note || '',
      method: r.method, linkedSaleId: r.linked_sale_id, createdBy: r.created_by,
      createdAt: r.created_at || null,
      bankAccountId: r.bank_account_id || null,
      isChallan: !!(r.is_challan),
      challanNo: r.challan_no || null,
      billedUnderId: r.billed_under_id || null
    }));
    payments = pRows.map(r => ({
      id: r.id, entryId: r.entry_id, date: r.date, method: r.method,
      amount: r.amount, loadingUnloading: r.loading_unloading,
      loadingUnloadingExpenseId: r.loading_unloading_expense_id || null,
      bankAccountId: r.bank_account_id || null,
      createdBy: r.created_by || null, createdAt: r.created_at || null
    }));
    advances = aRows.map(r => ({
      id: r.id, date: r.date, client: r.client, amount: r.amount, method: r.method, note: r.note || '',
      bankAccountId: r.bank_account_id || null
    }));
    vendorAdvances = vaRows.map(r => ({
      id: r.id, date: r.date, vendor: r.vendor, amount: r.amount, method: r.method, note: r.note || '',
      bankAccountId: r.bank_account_id || null
    }));
    adjustments = jRows.map(r => ({ id: r.id, date: r.date, client: r.client, adjType: r.adj_type, amount: r.amount, note: r.note || '' }));
    vendorAdjustments = vjRows.map(r => ({ id: r.id, date: r.date, vendor: r.vendor, adjType: r.adj_type, amount: r.amount, note: r.note || '' }));
    bankTransactions = bRows.map(r => ({
      id: r.id, date: r.date, type: r.type, amount: r.amount, category: r.category || '', note: r.note || '',
      bankAccountId: r.bank_account_id || null
    }));
    bankAccounts = accRows.map(r => ({ id: r.id, name: r.name, opening_balance: r.opening_balance, opening_date: r.opening_date, is_active: r.is_active }));
    items = itRows.map(r => ({ id: r.id, name: r.name, unit: r.unit, kind: r.kind, opening_qty: r.opening_qty, opening_value: r.opening_value, is_active: r.is_active }));
    stock = stRows;
    stockBook = sbRows;
    productionRuns = prRows;
    unbilledChallans = chRows.map(r => ({
      id: r.id, date: r.date, client: r.client, itemType: r.item_type || '',
      qty: r.qty, rate: r.rate, amount: r.amount,
      challanNo: r.challan_no || null, balance: r.balance || 0
    }));
    materialSupplied = msRows.map(r => ({
      id: r.id, date: r.date, client: r.client || '', itemType: r.item_type || '',
      qty: r.qty, challanNo: r.challan_no || null, note: r.note || ''
    }));
    __clientLedgerCache = { key: '', data: null };
    __vendorLedgerCache = { key: '', data: null };
  }catch(e){ console.error('load failed', e); }

  if(bankAccountFilter !== 'all'){
    const stillThere = bankAccounts.find(a=>a.id===bankAccountFilter && a.is_active);
    if(!stillThere) bankAccountFilter = 'all';
  }
  refreshBankAccountFilter();
  refreshAllAccountSelects();
  refreshBtVendorDropdown();
  refreshBtClientDropdown();
  refreshItemSelect();
  refreshProductionItemSelects();
  renderCurrentTab();
}
function refreshAllAccountSelects(){
  const def = defaultAccountId();
  fillAccountSelect(document.getElementById('bankAccountSelect'), def, false);
  fillAccountSelect(document.getElementById('splitBankAccountSelect'), def, false);
  fillAccountSelect(document.getElementById('loadingBankAccountSelect'), def, false);
  fillAccountSelect(document.getElementById('btBankAccountSelect'), def, false);
  fillAccountSelect(document.getElementById('payBankAccountSelect'), def, false);
  fillAccountSelect(document.getElementById('paySplitBankAccountSelect'), def, false);
  fillAccountSelect(document.getElementById('payLoadingBankAccountSelect'), def, false);
  fillAccountSelect(document.getElementById('editPayBankSelect'), def, false);
  fillAccountSelect(document.getElementById('editPaySplitBankAccountSelect'), def, false);
  fillAccountSelect(document.getElementById('btVendorBankSelect'), def, false);
  fillAccountSelect(document.getElementById('btClientBankSelect'), def, false);
  fillAccountSelect(document.getElementById('vAdvBankSelect'), def, false);
  fillAccountSelect(document.getElementById('reportBankAccount'), bankAccountFilter, true);
  const btSelect = document.getElementById('btBankAccountSelect');
  if(btSelect && bankAccountFilter !== 'all' && bankAccounts.find(a=>a.id===bankAccountFilter && a.is_active)){ btSelect.value = bankAccountFilter; }
}
function refreshBankAccountFilter(){ fillAccountSelect(document.getElementById('bankAccountFilter'), bankAccountFilter, true); }
function onBankFilterChange(){
  const v = document.getElementById('bankAccountFilter').value;
  bankAccountFilter = (v === 'all') ? 'all' : parseInt(v,10);
  renderBank();
}
function refreshItemSelect(){
  const sel = document.getElementById('adjItemSelect');
  if(!sel) return;
  sel.innerHTML = items.filter(i=>i.is_active).map(i => `<option value="${i.id}">${escapeAttr(i.name)} (${escapeAttr(i.unit)})</option>`).join('');
}
function refreshProductionItemSelects(){
  const producedSel = document.getElementById('prodProducedItem');
  if(!producedSel) return;
  const opts = items.filter(i=>i.is_active).map(i => `<option value="${i.id}">${escapeAttr(i.name)} (${escapeAttr(i.unit)})</option>`).join('');
  producedSel.innerHTML = opts;
  document.querySelectorAll('#prodConsumedList select').forEach(sel=>{
    const keepVal = sel.value;
    sel.innerHTML = opts;
    if(keepVal) sel.value = keepVal;
  });
}

let itemTypesCache = [];
let expenseTypesCache = [];
let adjTypesCache = ['Discount','Round Off','Bad Debt','TDS'];
let vAdjTypesCache = ['Discount Received','Round Off','Quality Claim','TDS','Rate Difference'];
let clientsCache = [];
let vendorsCache = [];
let bankTxnTypesCache = ['Bank Charges','Interest Earned','Owner Capital','Cheque Bounce Reversal'];

async function loadTypeOptions(){
  try{
    const [itemRes, expRes, adjRes, vadjRes, cliRes, venRes, bankRes] = await Promise.all([
      fetch('/api/item-types'), fetch('/api/expense-types'),
      fetch('/api/adjustment-types'), fetch('/api/vendor-adjustment-types'),
      fetch('/api/clients'), fetch('/api/vendors'), fetch('/api/bank-transaction-types')
    ]);
    if(itemRes.ok) itemTypesCache = await itemRes.json();
    if(expRes.ok) expenseTypesCache = await expRes.json();
    if(adjRes.ok) adjTypesCache = await adjRes.json();
    if(vadjRes.ok) vAdjTypesCache = await vadjRes.json();
    if(cliRes.ok) clientsCache = await cliRes.json();
    if(venRes.ok) vendorsCache = await venRes.json();
    if(bankRes.ok) bankTxnTypesCache = await bankRes.json();
  }catch(e){}
}
