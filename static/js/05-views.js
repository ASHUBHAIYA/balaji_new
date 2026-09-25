/* ============================= DASHBOARD ============================= */
function setDashRange(mode){
  const today = todayStr();
  let from = today, to = today;
  if(mode === 'yesterday'){ from = to = addDays(today, -1); }
  else if(mode === 'week'){ from = addDays(today, -6); }
  else if(mode === 'month'){ const d = new Date(today + 'T00:00:00'); from = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-01'; }
  else if(mode === 'all'){
    const dates = [...entries.map(e=>e.date), ...payments.map(p=>p.date), ...advances.map(a=>a.date), ...bankTransactions.map(b=>b.date)].filter(Boolean).sort();
    from = dates.length ? dates[0] : today;
  }
  document.getElementById('dashFrom').value = from;
  document.getElementById('dashTo').value = to;
  renderDashboard();
}
function initDashRange(){
  if(!document.getElementById('dashFrom').value){ document.getElementById('dashFrom').value = todayStr(); document.getElementById('dashTo').value = todayStr(); }
}
function readRange(){
  const fromStr = document.getElementById('fromDate').value || todayStr();
  let toStr = document.getElementById('toDate').value || fromStr;
  if(toStr < fromStr) toStr = fromStr;
  return { fromStr, toStr };
}
function renderDashboard(){
  const fromStr = document.getElementById('dashFrom').value || todayStr();
  let toStr = document.getElementById('dashTo').value || fromStr;
  if(toStr < fromStr) toStr = fromStr;
  const t = computeRangeTotals(fromStr, toStr, 'all');
  const openingCash = computeOpeningCash(fromStr);
  const closingCash = Math.round((openingCash + t.cashSale + t.advCash + t.bankToCash - t.cashPurch - t.vAdvCash - t.cashExp - t.cashToBank)*100)/100;
  document.getElementById('openCash').textContent = fmt(openingCash);
  document.getElementById('closeCash').textContent = fmt(closingCash);
  const acctBal = perAccountBalances(fromStr, toStr);
  const activeAccts = acctBal.filter(a => a.is_active);
  const totalBankOpening = Math.round(activeAccts.reduce((s,a)=>s+a.opening,0)*100)/100;
  const totalBankClosing = Math.round(activeAccts.reduce((s,a)=>s+a.closing,0)*100)/100;
  document.getElementById('openBank').textContent = fmt(totalBankOpening);
  document.getElementById('closeBank').textContent = fmt(totalBankClosing);
  const acctBox = document.getElementById('perAccountBankCards');
  if(acctBox){
    if(acctBal.length === 0){ acctBox.innerHTML = '<div class="empty" style="font-size:12px;">No bank accounts</div>'; }
    else {
      acctBox.innerHTML = acctBal.map(a => `
        <div class="acct-bal-card ${a.is_active?'':'closed'}">
          <div class="acct-name">${escapeAttr(a.name)}${a.is_active?'':' <span class="badge badge-closed">(closed)</span>'}</div>
          <div class="row"><span class="k">Opening</span><span class="v">${fmt(a.opening)}</span></div>
          <div class="row"><span class="k">Closing</span><span class="v closing">${fmt(a.closing)}</span></div>
        </div>`).join('');
    }
  }
  const cashPlusBank = Math.round((closingCash + totalBankClosing)*100)/100;
  document.getElementById('cashPlusBankClosing').textContent = fmt(cashPlusBank);
  const billedSales = t.salesInRange.reduce((s,e)=>s+(e.amount || 0), 0);
  const moneyReceived = t.cashSale + t.bankSale + t.advCash + t.advBank;
  const billedPurch = t.purchasesInRange.reduce((s,e)=>s+(e.amount || 0), 0);
  const moneyPaidOut = t.cashPurch + t.bankPurch + t.vAdvCash + t.vAdvBank + t.cashExp + t.bankExp;
  const receivable = totalPendingAllClients();
  const payable = totalPayableAllVendors();
  const stockValue = stock.filter(s=>s.is_active).reduce((s,it)=>s+(it.on_hand_value||0),0);
  document.getElementById('heroSalesBilled').textContent = fmt(billedSales);
  document.getElementById('heroMoneyIn').textContent = fmt(moneyReceived);
  document.getElementById('heroPurchBilled').textContent = fmt(billedPurch);
  document.getElementById('heroMoneyOut').textContent = fmt(moneyPaidOut);
  document.getElementById('heroReceivable').textContent = fmt(receivable);
  document.getElementById('heroPayable').textContent = fmt(payable);
  document.getElementById('heroCashBank').textContent = fmt(cashPlusBank);
  document.getElementById('heroStock').textContent = fmt(stockValue);
  document.getElementById('sBilledSales').textContent = fmt(billedSales);
  document.getElementById('sCollectedSales').textContent = fmt(t.cashSale + t.bankSale);
  document.getElementById('sBilledPurch').textContent = fmt(billedPurch);
  document.getElementById('sPaidPurch').textContent = fmt(t.cashPurch + t.bankPurch);
  document.getElementById('sClientCredit').textContent = fmt(totalClientAdvanceCredit());
  document.getElementById('sCashSale').textContent = fmt(t.cashSale);
  document.getElementById('sBankSale').textContent = fmt(t.bankSale);
  document.getElementById('sAdvCash').textContent = fmt(t.advCash);
  document.getElementById('sAdvBank').textContent = fmt(t.advBank);
  document.getElementById('sCashPurch').textContent = fmt(t.cashPurch);
  document.getElementById('sBankPurch').textContent = fmt(t.bankPurch);
  document.getElementById('sCashExp').textContent = fmt(t.cashExp);
  document.getElementById('sBankExp').textContent = fmt(t.bankExp);
  document.getElementById('sPending').textContent = fmt(receivable);
  document.getElementById('sPayable').textContent = fmt(payable);
  document.getElementById('salesTableBody').innerHTML = t.salesInRange.length ? t.salesInRange.map(e=>{
    const s = saleStatus(e);
    const chBadge = e.isChallan ? (s === 'material'
      ? '<span class="badge badge-material">MATERIAL</span>'
      : (e.billedUnderId ? '<span class="badge badge-billed">BILLED</span>' : '<span class="badge badge-challan">CHALLAN</span>')) : '';
    const editBtn = isAdmin() ? `<button class="mini-btn" style="background:var(--accent);" onclick="openEditModal(${e.id})">Edit</button>` : '';
    const delBtn = isAdmin() ? `<button class="del" onclick="delEntry(${e.id})">✕</button>` : '';
    const rateShow = (e.rate != null && e.rate > 0) ? fmt(e.rate) : '—';
    const amtShow = (e.amount != null) ? fmt(e.amount) : '—';
    return `<tr><td>${fmtDateTime(e.date, e.createdAt)}</td><td>${escapeAttr(e.client||'-')}</td><td>${escapeAttr(e.itemType||'-')} ${chBadge}</td><td>${e.qty?fmtQty(e.qty):'-'}</td><td>${rateShow}</td><td>${s}</td><td style="text-align:right;">${amtShow}</td><td>${editBtn}${delBtn}</td></tr>`;
  }).join('') : `<tr><td colspan="8" class="empty">No sales in range</td></tr>`;
  document.getElementById('purchTableBody').innerHTML = t.purchasesInRange.length ? t.purchasesInRange.map(e=>{
    const s = purchaseStatus(e);
    const itemLabel = e.itemType ? e.itemType : (e.note || 'Non-itemized');
    const editBtn = isAdmin() ? `<button class="mini-btn" style="background:var(--accent);" onclick="openEditModal(${e.id})">Edit</button>` : '';
    const delBtn = isAdmin() ? `<button class="del" onclick="delEntry(${e.id})">✕</button>` : '';
    return `<tr><td>${fmtDateTime(e.date, e.createdAt)}</td><td>${escapeAttr(e.vendor||'-')}</td><td>${escapeAttr(itemLabel)}</td><td>${e.qty?fmtQty(e.qty):'-'}</td><td>${e.rate?fmt(e.rate):'-'}</td><td>${s}</td><td style="text-align:right;">${fmt(e.amount)}</td><td>${editBtn}${delBtn}</td></tr>`;
  }).join('') : `<tr><td colspan="8" class="empty">No purchases in range</td></tr>`;
  document.getElementById('expTableBody').innerHTML = t.expInRange.length ? t.expInRange.map(e=>{
    const acctNote = (e.method==='bank' && e.bankAccountId) ? ' · '+accountName(e.bankAccountId) : '';
    const editBtn = isAdmin() ? `<button class="mini-btn" style="background:var(--accent);" onclick="openEditModal(${e.id})">Edit</button>` : '';
    const delBtn = isAdmin() ? `<button class="del" onclick="delEntry(${e.id})">✕</button>` : '';
    return `<tr><td>${fmtDateTime(e.date, e.createdAt)}</td><td>${escapeAttr(e.expenseType||'-')}</td><td>${e.method==='cash'?'Cash':'Bank'}${acctNote}</td><td>${escapeAttr(e.note||'-')}</td><td style="text-align:right;">${fmt(e.amount)}</td><td>${editBtn}${delBtn}</td></tr>`;
  }).join('') : `<tr><td colspan="6" class="empty">No expenses in range</td></tr>`;
}

/* ============================= ALL ENTRIES ============================= */
function setAllRange(mode){
  const today = todayStr();
  let from = today, to = today;
  if(mode === 'week'){ from = addDays(today, -6); }
  else if(mode === 'month'){ const d = new Date(today + 'T00:00:00'); from = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-01'; }
  else if(mode === 'all'){ document.getElementById('allFrom').value = ''; document.getElementById('allTo').value = ''; resetAllEntriesPage(); return; }
  document.getElementById('allFrom').value = from;
  document.getElementById('allTo').value = to;
  resetAllEntriesPage();
}
function resetAllEntriesPage(){ allEntriesShown = ALL_ENTRIES_PAGE_SIZE; renderAllEntries(); }
const ALL_ENTRIES_PAGE_SIZE = 50;
let allEntriesShown = ALL_ENTRIES_PAGE_SIZE;
function matchesAllFilters(row){
  const q = (document.getElementById('allSearch').value || '').trim().toLowerCase();
  const from = document.getElementById('allFrom').value;
  const to = document.getElementById('allTo').value;
  if(from && row.date < from) return false;
  if(to && row.date > to) return false;
  if(q){
    const hay = ((row.client||'') + ' ' + (row.vendor||'') + ' ' + (row.label||'') + ' ' + (row.note||'')).toLowerCase();
    if(hay.indexOf(q) === -1) return false;
  }
  return true;
}
function renderAllEntries(){
  const list = document.getElementById('list');
  const rows = [];
  entries.forEach(e=>{
    if(e.kind==='sale'){
      const status = saleStatus(e);
      const badgeClass = status==='paid'?'badge-paid':(status==='partial'?'badge-partial':(status==='material'?'badge-material':'badge-pending'));
      const badgeText = status.toUpperCase();
      const chBadge = e.isChallan ? `<span class="badge ${status==='material'?'badge-material':'badge-challan'}">${escapeAttr(e.challanNo||'CHALLAN')}</span>` : '';
      const itemLine = e.itemType ? `${e.itemType} · ${fmtQty(e.qty||0)}${e.rate>0?' @ '+fmt(e.rate):''}` : '';
      const lastPay = lastPaymentDate(e.id);
      const editBtn = isAdmin() ? `<button class="mini-btn" style="background:var(--accent);" onclick="openEditModal(${e.id})">Edit</button>` : '';
      const amtShow = (e.amount != null) ? fmt(e.amount) : '—';
      rows.push({ sortKey: e.id, date:e.date, client:e.client, vendor:'', note:e.note, label:'Sale',
        html: `<div class="entry"><div><div>Sale${e.client?' · '+escapeAttr(e.client):''} ${chBadge} <span class="badge ${badgeClass}">${badgeText}</span></div>
          <div class="meta">${fmtDateTime(e.date, e.createdAt)}${itemLine?' · '+escapeAttr(itemLine):''}${e.note?' · '+escapeAttr(e.note):''}${lastPay?' · last pay '+fmtDateDMY(lastPay):''}</div></div>
          <div style="display:flex;align-items:center;gap:6px;"><span class="amt-in">+${amtShow}</span>
          ${(status!=='paid' && status!=='material' && !e.billedUnderId) ? `<button class="mini-btn" style="background:var(--amber);" onclick="openPayModal(${e.id})">Pay</button>` : ''}
          ${editBtn}${isAdmin() ? `<button class="del" onclick="delEntry(${e.id})">✕</button>` : ''}</div></div>` });
    } else if(e.kind==='purchase'){
      const status = purchaseStatus(e);
      const badgeClass = status==='paid'?'badge-paid':(status==='partial'?'badge-partial':'badge-pending');
      const badgeText = status.toUpperCase();
      const itemLine = e.itemType ? `${e.itemType} · ${fmtQty(e.qty||0)} @ ${fmt(e.rate||0)}` : (e.note || 'Non-itemized');
      const lastPay = lastPaymentDate(e.id);
      const editBtn = isAdmin() ? `<button class="mini-btn" style="background:var(--accent);" onclick="openEditModal(${e.id})">Edit</button>` : '';
      rows.push({ sortKey: e.id, date:e.date, client:'', vendor:e.vendor, note:e.note, label:'Purchase',
        html: `<div class="entry"><div><div>Purchase <span class="badge badge-purchase">PURCHASE</span>${e.vendor?' · '+escapeAttr(e.vendor):''} <span class="badge ${badgeClass}">${badgeText}</span></div>
          <div class="meta">${fmtDateTime(e.date, e.createdAt)} · ${escapeAttr(itemLine)}${lastPay?' · last pay '+fmtDateDMY(lastPay):''}</div></div>
          <div style="display:flex;align-items:center;gap:6px;"><span class="amt-out">-${fmt(e.amount)}</span>
          ${status!=='paid' ? `<button class="mini-btn" style="background:var(--amber);" onclick="openPayModal(${e.id})">Pay</button>` : ''}
          ${editBtn}${isAdmin() ? `<button class="del" onclick="delEntry(${e.id})">✕</button>` : ''}</div></div>` });
    } else {
      const acctNote = (e.method==='bank' && e.bankAccountId) ? ` · ${accountName(e.bankAccountId)}` : '';
      const editBtn = isAdmin() ? `<button class="mini-btn" style="background:var(--accent);" onclick="openEditModal(${e.id})">Edit</button>` : '';
      rows.push({ sortKey: e.id, date:e.date, client:'', vendor:'', note:e.note, label:'Expense ' + (e.expenseType||''),
        html: `<div class="entry"><div><div>${e.method==='cash'?'Cash':'Bank'} Expense${e.expenseType?' · '+escapeAttr(e.expenseType):''}${acctNote}</div>
          <div class="meta">${fmtDateTime(e.date, e.createdAt)}${e.note?' · '+escapeAttr(e.note):''}</div></div>
          <div style="display:flex;align-items:center;gap:6px;"><span class="amt-out">-${fmt(e.amount)}</span>
          ${editBtn}${isAdmin() ? `<button class="del" onclick="delEntry(${e.id})">✕</button>` : ''}</div></div>` });
    }
  });
  advances.forEach(a=>{
    const acctNote = (a.method==='bank' && a.bankAccountId) ? ` · ${accountName(a.bankAccountId)}` : '';
    rows.push({ sortKey: a.id + 0.5, date:a.date, client:a.client, vendor:'', note:a.note, label:'Advance',
      html: `<div class="entry"><div><div>Advance <span class="badge badge-advance">ADVANCE</span> · ${escapeAttr(a.client)}</div>
        <div class="meta">${fmtDateDMY(a.date)}${a.note?' · '+escapeAttr(a.note):''} · via ${a.method}${acctNote}</div></div>
        <div style="display:flex;align-items:center;gap:6px;"><span class="amt-in">+${fmt(a.amount)}</span>
        ${isAdmin() ? `<button class="del" onclick="delAdvance(${a.id})">✕</button>` : ''}</div></div>` });
  });
  vendorAdvances.forEach(a=>{
    const acctNote = (a.method==='bank' && a.bankAccountId) ? ` · ${accountName(a.bankAccountId)}` : '';
    rows.push({ sortKey: a.id + 0.55, date:a.date, client:'', vendor:a.vendor, note:a.note, label:'Vendor Advance',
      html: `<div class="entry"><div><div>Advance paid <span class="badge badge-advance">VENDOR ADV</span> · ${escapeAttr(a.vendor)}</div>
        <div class="meta">${fmtDateDMY(a.date)}${a.note?' · '+escapeAttr(a.note):''} · via ${a.method}${acctNote}</div></div>
        <div style="display:flex;align-items:center;gap:6px;"><span class="amt-out">-${fmt(a.amount)}</span>
        ${isAdmin() ? `<button class="del" onclick="delVendorAdvance(${a.id})">✕</button>` : ''}</div></div>` });
  });
  adjustments.forEach(a=>{
    rows.push({ sortKey: a.id + 0.7, date:a.date, client:a.client, vendor:'', note:a.note, label:'Adjustment ' + a.adjType,
      html: `<div class="entry"><div><div>Client adjustment: ${escapeAttr(a.adjType)} · ${escapeAttr(a.client)}</div>
        <div class="meta">${fmtDateDMY(a.date)}${a.note?' · '+escapeAttr(a.note):''}</div></div>
        <div style="display:flex;align-items:center;gap:6px;"><span class="amt-out">-${fmt(a.amount)}</span>
        ${isAdmin() ? `<button class="del" onclick="delAdjustment(${a.id})">✕</button>` : ''}</div></div>` });
  });
  vendorAdjustments.forEach(a=>{
    rows.push({ sortKey: a.id + 0.75, date:a.date, client:'', vendor:a.vendor, note:a.note, label:'Vendor adjustment ' + a.adjType,
      html: `<div class="entry"><div><div>Vendor adjustment <span class="badge badge-vendor-adj">VENDOR ADJ</span> · ${escapeAttr(a.adjType)} · ${escapeAttr(a.vendor)}</div>
        <div class="meta">${fmtDateDMY(a.date)}${a.note?' · '+escapeAttr(a.note):''}</div></div>
        <div style="display:flex;align-items:center;gap:6px;"><span class="amt-in">-${fmt(a.amount)}</span>
        ${isAdmin() ? `<button class="del" onclick="delVendorAdjustment(${a.id})">✕</button>` : ''}</div></div>` });
  });
  productionRuns.forEach(r=>{
    const consumedLine = (r.materials||[]).map(m => `${m.item_name}: ${fmtQty(m.qty)} ${m.item_unit}`).join(' · ');
    rows.push({ sortKey: r.id + 0.9, date:r.date, client:'', vendor:'', note:r.note, label:'Production',
      html: `<div class="entry"><div><div>Production <span class="badge badge-production">PRODUCTION</span> · ${fmtQty(r.produced_qty)} ${escapeAttr(r.produced_item_unit)} of ${escapeAttr(r.produced_item_name)}</div>
        <div class="meta">${fmtDateDMY(r.date)} · Consumed: ${escapeAttr(consumedLine || '—')}</div></div>
        <div style="display:flex;align-items:center;gap:6px;">${isAdmin() ? `<button class="del" onclick="deleteProduction(${r.id})">✕</button>` : ''}</div></div>` });
  });
  const filtered = rows.filter(matchesAllFilters).sort((a,b)=>b.sortKey-a.sortKey);
  const total = filtered.length;
  document.getElementById('allCountHint').textContent = total === 0 ? '' : ('Showing ' + Math.min(allEntriesShown, total) + ' of ' + total + ' entries');
  if(total === 0){ list.innerHTML = '<div class="empty">No matching entries</div>'; return; }
  const visible = filtered.slice(0, allEntriesShown);
  let html = visible.map(r=>r.html).join('');
  if(total > allEntriesShown){
    const remaining = total - allEntriesShown;
    html += `<div style="text-align:center;padding:12px 0;"><button class="mini-btn" style="background:var(--accent);padding:8px 16px;font-size:12px;" onclick="showMoreAllEntries()">Show ${Math.min(ALL_ENTRIES_PAGE_SIZE, remaining)} more (${remaining} older)</button></div>`;
  }
  list.innerHTML = html;
}
function showMoreAllEntries(){ allEntriesShown += ALL_ENTRIES_PAGE_SIZE; renderAllEntries(); }

/* ============================= CHALLANS ============================= */
function renderChallans(){
  const box = document.getElementById('challansList');
  if(unbilledChallans.length === 0){ box.innerHTML = '<div class="empty">No pending challans 🎉</div>'; updateChallanSelectedTotal(); return; }
  const byClient = {};
  unbilledChallans.forEach(ch => { const key = (ch.client || '(no client)').trim(); if(!byClient[key]) byClient[key] = []; byClient[key].push(ch); });
  const clients = Object.keys(byClient).sort((a,b)=> a.localeCompare(b));
  const grandTotal = unbilledChallans.reduce((s,ch)=>s + (ch.balance || 0), 0);
  let html = `<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;font-size:13px;"><span style="color:var(--muted);">Total pending challans (rate decided)</span><span style="font-weight:700;">${unbilledChallans.length}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:4px;"><span style="color:var(--muted);">Total value</span><span style="font-weight:700;color:var(--amber);">${fmt(grandTotal)}</span></div></div>`;
  clients.forEach((c, idx) => {
    const items_ = byClient[c];
    const clientTotal = items_.reduce((s,ch)=>s + (ch.balance || 0), 0);
    const allSelected = items_.every(ch => selectedChallans.has(ch.id));
    html += `<div style="border:1px solid var(--border);border-radius:10px;margin-bottom:10px;overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:var(--bg);">
          <div style="display:flex;align-items:center;gap:8px;">
            <input type="checkbox" class="challan-check" style="width:auto;padding:0;" ${allSelected?'checked':''} onclick="toggleSelectAllChallans('${escapeJs(c)}', this.checked)">
            <div><div style="font-weight:700;">${escapeAttr(c)}</div>
              <div style="font-size:11px;color:var(--muted);">${items_.length} challan${items_.length===1?'':'s'} · Pending ${fmt(clientTotal)}</div></div>
          </div>
          <div style="font-weight:700;color:var(--amber);">${fmt(clientTotal)}</div>
        </div>
        <div id="challanGroup_${idx}" style="padding:0 12px;display:block;">
          ${items_.map(ch => {
            const checked = selectedChallans.has(ch.id) ? 'checked' : '';
            return `<div class="challan-row">
                <input type="checkbox" class="challan-check" data-id="${ch.id}" data-client="${escapeAttr(c)}" data-balance="${ch.balance}" ${checked} onchange="onChallanSelect(this)">
                <div class="info"><div>${escapeAttr(ch.challanNo || '—')} · ${escapeAttr(ch.itemType||'')} · ${fmtQty(ch.qty)} @ ${fmt(ch.rate)}</div>
                  <div class="meta">${fmtDateDMY(ch.date)} · Amount ${fmt(ch.amount)}${ch.balance !== ch.amount ? ' · Balance '+fmt(ch.balance) : ''}</div></div>
                <div style="font-weight:700;">${fmt(ch.balance)}</div></div>`;
          }).join('')}
        </div></div>`;
  });
  box.innerHTML = html;
  updateChallanSelectedTotal();
}
function toggleSelectAllChallans(clientName, checked){
  unbilledChallans.forEach(ch => {
    if((ch.client || '(no client)').trim() !== clientName) return;
    if(checked){
      const existingClient = [...selectedChallans].map(id => unbilledChallans.find(x=>x.id===id)?.client).filter(Boolean)[0];
      if(existingClient && existingClient !== clientName){ selectedChallans.clear(); }
      selectedChallans.add(ch.id);
    } else { selectedChallans.delete(ch.id); }
  });
  renderChallans();
}
function onChallanSelect(el){
  const id = parseInt(el.dataset.id);
  const client = el.dataset.client;
  if(el.checked){
    const existingClient = [...selectedChallans].map(id => unbilledChallans.find(x=>x.id===id)?.client).filter(Boolean)[0];
    if(existingClient && existingClient !== client){ alert('Please select challans for a single client at a time.'); el.checked = false; return; }
    selectedChallans.add(id);
  } else { selectedChallans.delete(id); }
  updateChallanSelectedTotal();
}
function updateChallanSelectedTotal(){
  let total = 0;
  selectedChallans.forEach(id => { const ch = unbilledChallans.find(x=>x.id===id); if(ch) total += ch.balance; });
  document.getElementById('challanSelectedTotal').value = fmt(total);
}
async function createBillFromChallans(){
  if(selectedChallans.size === 0){ alert('Select at least one challan.'); return; }
  const ids = [...selectedChallans];
  const first = unbilledChallans.find(x=>x.id===ids[0]);
  if(!first){ alert('Selected challans not found.'); return; }
  const client = first.client;
  const billDate = document.getElementById('challanBillDate').value || todayStr();
  if(!confirm('Create one bill for ' + client + ' covering ' + ids.length + ' challan(s)?')) return;
  try{
    const res = await fetch('/api/bills/from-challans', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ client, challanIds: ids, date: billDate }) });
    if(!res.ok){ const err = await res.json().catch(()=>({})); alert(err.error || 'Could not create bill'); return; }
  }catch(err){ alert('Could not reach the server: ' + (err&&err.message?err.message:err)); return; }
  selectedChallans.clear();
  await load();
  alert('Bill created.');
}

/* ============================= MATERIAL SUPPLIED ============================= */
function renderMaterialSupplied(){
  const box = document.getElementById('materialList');
  if(!box) return;
  if(materialSupplied.length === 0){ box.innerHTML = '<div class="empty">No pending material-supplied entries 🎉</div>'; updateMaterialSelectedTotal(); return; }
  const byClient = {};
  materialSupplied.forEach(e => { const key = (e.client || '(no client)').trim(); if(!byClient[key]) byClient[key] = []; byClient[key].push(e); });
  const clients = Object.keys(byClient).sort((a,b) => a.localeCompare(b));
  let html = '';
  clients.forEach((c) => {
    const items_ = byClient[c].slice().sort((a,b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
    const byItem = {};
    items_.forEach(it => { const k = it.itemType || '—'; byItem[k] = (byItem[k] || 0) + (it.qty || 0); });
    const allSelected = items_.every(e => selectedMaterial.has(e.id));
    html += `<div style="border:1px solid var(--border);border-radius:10px;margin-bottom:12px;padding:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">
          <div><div style="font-weight:700;">${escapeAttr(c)}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px;">${items_.length} entr${items_.length===1?'y':'ies'} pending · ${Object.entries(byItem).map(([k,v]) => `${fmtQty(v)} ${escapeAttr(k)}`).join(' · ')}</div></div>
          <label class="checkbox-row" style="margin-top:0;">
            <input type="checkbox" class="challan-check" ${allSelected?'checked':''} onchange="toggleSelectAllMaterial('${escapeJs(c)}', this.checked)">
            <span style="font-size:11px;">Select all</span></label>
        </div>
        <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead><tr><th style="text-align:left;padding:4px 6px;">Challan</th><th style="text-align:left;padding:4px 6px;">Date</th><th style="text-align:left;padding:4px 6px;">Item</th><th style="text-align:right;padding:4px 6px;">Qty</th><th style="text-align:right;padding:4px 6px;">Rate</th><th style="text-align:right;padding:4px 6px;">Amount</th><th style="text-align:center;padding:4px 6px;"></th></tr></thead>
            <tbody>${items_.map(e => {
                const checked = selectedMaterial.has(e.id) ? 'checked' : '';
                const r = materialRates[e.id];
                const amt = (r && e.qty) ? (r * e.qty) : 0;
                return `<tr><td style="padding:4px 6px;">${escapeAttr(e.challanNo || ('#' + e.id))}</td>
                    <td style="padding:4px 6px;">${fmtDateDMY(e.date)}</td>
                    <td style="padding:4px 6px;">${escapeAttr(e.itemType || '—')}</td>
                    <td style="padding:4px 6px;text-align:right;">${fmtQty(e.qty || 0)}</td>
                    <td style="padding:4px 6px;text-align:right;"><input type="number" step="0.01" min="0" value="${r != null ? r : ''}" placeholder="rate" style="width:80px;padding:4px 6px;text-align:right;" oninput="setMaterialRate(${e.id}, this.value)"></td>
                    <td style="padding:4px 6px;text-align:right;font-weight:600;">${amt > 0 ? fmt(amt) : '—'}</td>
                    <td style="padding:4px 6px;text-align:center;"><input type="checkbox" class="challan-check" data-id="${e.id}" data-client="${escapeAttr(c)}" ${checked} onchange="toggleMaterialSelect(this)"></td></tr>`;
              }).join('')}</tbody></table></div></div>`;
  });
  box.innerHTML = html;
  updateMaterialSelectedTotal();
}
function setMaterialRate(entryId, val){
  const r = parseFloat(val);
  if(isNaN(r) || r <= 0){ delete materialRates[entryId]; } else { materialRates[entryId] = r; }
  updateMaterialSelectedTotal();
}
function toggleSelectAllMaterial(clientName, checked){
  materialSupplied.forEach(e => {
    if((e.client || '(no client)').trim() !== clientName) return;
    if(checked){
      const existingClient = [...selectedMaterial].map(id => materialSupplied.find(x => x.id === id)?.client).filter(Boolean)[0];
      if(existingClient && existingClient !== clientName){ selectedMaterial.clear(); }
      selectedMaterial.add(e.id);
    } else { selectedMaterial.delete(e.id); }
  });
  renderMaterialSupplied();
}
function toggleMaterialSelect(el){
  const entryId = parseInt(el.dataset.id, 10);
  const client = el.dataset.client;
  if(el.checked){
    const existingClient = [...selectedMaterial].map(id => materialSupplied.find(x => x.id === id)?.client).filter(Boolean)[0];
    if(existingClient && existingClient !== client){ alert('Please select material for a single client at a time.'); el.checked = false; return; }
    selectedMaterial.add(entryId);
  } else { selectedMaterial.delete(entryId); }
  updateMaterialSelectedTotal();
}
function updateMaterialSelectedTotal(){
  let total = 0;
  selectedMaterial.forEach(id => { const e = materialSupplied.find(x => x.id === id); const r = materialRates[id]; if(e && r) total += (e.qty || 0) * r; });
  const el = document.getElementById('materialSelectedTotal');
  if(el) el.value = fmt(total);
}
async function createBillFromMaterial(){
  if(selectedMaterial.size === 0){ alert('Select at least one entry.'); return; }
  const items_ = [];
  for(const id of selectedMaterial){
    const r = materialRates[id];
    if(!r || r <= 0){ alert('Enter a rate for every selected entry.'); return; }
    items_.push({ entryId: id, rate: r });
  }
  const ids = [...selectedMaterial];
  const first = materialSupplied.find(e => e.id === ids[0]);
  if(!first) return;
  const client = first.client;
  const sameClient = ids.every(id => { const e = materialSupplied.find(x => x.id === id); return e && e.client === client; });
  if(!sameClient){ alert('Select entries for a single client at a time.'); return; }
  const billDate = document.getElementById('materialBillDate').value || todayStr();
  if(!confirm('Create bill for ' + client + ' covering ' + items_.length + ' entr' + (items_.length===1?'y':'ies') + '?')) return;
  try{
    const res = await fetch('/api/bills/from-material-supplied', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ client, date: billDate, items: items_ }) });
    if(!res.ok){ const err = await res.json().catch(()=>({})); alert(err.error || 'Could not create bill'); return; }
  }catch(err){ alert('Could not reach the server: ' + (err && err.message ? err.message : err)); return; }
  selectedMaterial.clear();
  materialRates = {};
  await load();
  alert('Bill created.');
}

/* ============================= CASH ============================= */
function setCBRange(mode){
  const today = todayStr();
  let from = today, to = today;
  if(mode === 'week'){ from = addDays(today, -6); }
  else if(mode === 'month'){ const d = new Date(today + 'T00:00:00'); from = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-01'; }
  else if(mode === 'all'){
    _cbAllTime = true;
    document.getElementById('cbFrom').value = '';
    document.getElementById('cbTo').value = '';
    renderCB();
    return;
  }
  _cbAllTime = false;
  document.getElementById('cbFrom').value = from;
  document.getElementById('cbTo').value = to;
  renderCB();
}
let _cbAllTime = false;
function renderCB(){
  const fromEl = document.getElementById('cbFrom');
  const toEl = document.getElementById('cbTo');
  // Only default to today when not explicitly viewing All time
  if(fromEl && toEl && !fromEl.value && !toEl.value && !_cbAllTime){
    fromEl.value = todayStr(); toEl.value = todayStr();
  }
  renderCash();
  renderBank();
}
function renderCash(){
  const fromEl = document.getElementById('cbFrom');
  const toEl = document.getElementById('cbTo');
  if(!fromEl || !toEl) return;
  if(!fromEl.value && !toEl.value && !_cbAllTime){
    fromEl.value = todayStr(); toEl.value = todayStr();
  }
  const fromStr = fromEl.value || '';
  const toStr = toEl.value || '';
  const openingCash = fromStr ? computeOpeningCash(fromStr) : 0;
  document.getElementById('cashOpening').textContent = fmt(openingCash);
  const cobAmt = document.getElementById('cashObAmount');
  const cobDate = document.getElementById('cashObDate');
  const cobHint = document.getElementById('cashObHint');
  if(cobAmt && !cobAmt.dataset.touched){
    cobAmt.value = appSettings.opening_cash_balance || 0;
  }
  if(cobDate && !cobDate.dataset.touched){
    cobDate.value = appSettings.opening_cash_date || '';
  }
  if(cobHint){
    cobHint.textContent = appSettings.opening_cash_date
      ? ('Configured: ' + fmt(appSettings.opening_cash_balance) + ' as of ' + fmtDateDMY(appSettings.opening_cash_date))
      : 'No opening cash configured yet.';
  }
  const rows = buildCashBook(fromStr, toStr);
  let html = '';
  if(fromStr){ html += `<tr style="background:var(--bg);"><td>${fmtDateDMY(addDays(fromStr, -1))}</td><td><i>Opening Balance</i></td><td style="text-align:right;">-</td><td style="text-align:right;">-</td><td style="text-align:right;font-weight:700;">${fmt(openingCash)}</td><td></td></tr>`; }
  if(rows.length === 0){ html += `<tr><td colspan="6" class="empty">No cash activity in this range</td></tr>`; }
  else {
    html += rows.map(r=>{
      const delBtn = isAdmin() ? `<button class="del" data-source="${r.source}" data-source-id="${r.sourceId}" data-label="${escapeAttr(r.label)}" data-amount="${fmt(r.inAmt>0?r.inAmt:r.outAmt)}" data-date="${fmtDateDMY(r.date)}" onclick="deleteBookRow(this)">✕</button>` : '';
      return `<tr><td>${fmtDateDMY(r.date)}</td><td>${escapeAttr(r.label)}</td>
        <td style="text-align:right;color:var(--green);">${r.inAmt > 0 ? fmt(r.inAmt) : '-'}</td>
        <td style="text-align:right;color:var(--red);">${r.outAmt > 0 ? fmt(r.outAmt) : '-'}</td>
        <td style="text-align:right;font-weight:700;">${fmt(openingCash + r.balance)}</td>
        <td>${delBtn}</td></tr>`;
    }).join('');
  }
  document.getElementById('cashBookBody').innerHTML = html;
  const closing = rows.length ? (openingCash + rows[rows.length-1].balance) : openingCash;
  document.getElementById('cashClosing').textContent = fmt(closing);
}
/* setBankRange removed — use setCBRange */

/* ============================= STOCK ============================= */
function openAddItemModal(){
  editingItemId = null;
  document.getElementById('itemModalTitle').textContent = 'Add Item';
  document.getElementById('itemName').value = '';
  document.getElementById('itemUnit').value = 'pcs';
  document.getElementById('itemKind').value = 'raw';
  document.getElementById('itemOpeningQty').value = '';
  document.getElementById('itemOpeningValue').value = '';
  document.getElementById('itemModal').style.display = 'flex';
}
function openEditItemModal(id){
  const it = items.find(x=>x.id===id); if(!it) return;
  editingItemId = id;
  document.getElementById('itemModalTitle').textContent = 'Edit Item';
  document.getElementById('itemName').value = it.name;
  document.getElementById('itemUnit').value = it.unit;
  document.getElementById('itemKind').value = it.kind;
  document.getElementById('itemOpeningQty').value = it.opening_qty || 0;
  document.getElementById('itemOpeningValue').value = it.opening_value || 0;
  document.getElementById('itemModal').style.display = 'flex';
}
function closeItemModal(){ editingItemId = null; document.getElementById('itemModal').style.display='none'; }
async function saveItem(){
  const name = document.getElementById('itemName').value.trim();
  const unit = document.getElementById('itemUnit').value.trim() || 'pcs';
  const kind_ = document.getElementById('itemKind').value;
  const oq = parseFloat(document.getElementById('itemOpeningQty').value) || 0;
  const ov = parseFloat(document.getElementById('itemOpeningValue').value) || 0;
  if(!name){ alert('Enter a name'); return; }
  let res;
  if(editingItemId){ res = await fetch('/api/items/' + editingItemId, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, unit, kind: kind_, openingQty: oq, openingValue: ov }) }); }
  else { res = await fetch('/api/items', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, unit, kind: kind_, openingQty: oq, openingValue: ov }) }); }
  if(!res.ok){ const err = await res.json().catch(()=>({})); alert(err.error || 'Could not save item'); return; }
  closeItemModal();
  await load();
}
async function toggleItemActive(id, currentlyActive){
  if(!confirm(currentlyActive ? 'Deactivate this item? Its history stays.' : 'Reactivate this item?')) return;
  const res = await fetch('/api/items/' + id, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ isActive: !currentlyActive }) });
  if(!res.ok){ const err = await res.json().catch(()=>({})); alert(err.error || 'Could not update'); return; }
  await load();
}
async function deleteItem(id){
  const it = items.find(x=>x.id===id);
  if(!confirm('Permanently delete "' + (it?it.name:'item') + '"?\n\nOnly works if it has no stock history.')) return;
  const res = await fetch('/api/items/' + id, { method:'DELETE' });
  if(!res.ok){ const err = await res.json().catch(()=>({})); alert(err.error || 'Could not delete'); return; }
  await load();
}
async function submitStockAdjust(){
  const itemId = document.getElementById('adjItemSelect').value;
  const qty = parseFloat(document.getElementById('adjItemQty').value);
  const adjDate = document.getElementById('adjItemDate').value || todayStr();
  const note = document.getElementById('adjItemNote').value.trim();
  if(!itemId){ alert('Choose an item'); return; }
  if(!qty || qty === 0){ alert('Enter a non-zero quantity'); return; }
  try{
    const res = await fetch('/api/stock/adjust', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ itemId, qty, date: adjDate, note }) });
    if(!res.ok){ const err = await res.json().catch(()=>({})); alert(err.error || 'Could not adjust stock'); return; }
  }catch(err){ alert('Could not reach the server: ' + (err&&err.message?err.message:err)); return; }
  document.getElementById('adjItemQty').value = '';
  document.getElementById('adjItemNote').value = '';
  await load();
}
function renderStock(){
  const box = document.getElementById('stockList');
  const activeStock = stock.filter(s => s.is_active);
  if(activeStock.length === 0){ box.innerHTML = '<div class="empty">No items yet</div>'; }
  else {
    box.innerHTML = activeStock.map(s => {
      const cls = s.kind === 'finished' ? 'badge-paid' : 'badge-purchase';
      return `<div class="item-row"><div><div class="nm">${escapeAttr(s.name)} <span class="badge ${cls}">${escapeAttr(s.kind)}</span></div>
          <div class="meta">Unit: ${escapeAttr(s.unit)} · Avg rate: ₹${fmt(s.avg_rate)}</div></div>
        <div style="text-align:right;"><div class="stock-qty">${fmtQty(s.on_hand_qty)} ${escapeAttr(s.unit)}</div><div class="meta">Value: ₹${fmt(s.on_hand_value)}</div></div></div>`;
    }).join('');
  }
  const warn = document.getElementById('stockDuplicatesWarning');
  if(warn){
    const names = items.filter(i=>i.is_active).map(i=>i.name);
    const pairs = [];
    for(let i=0;i<names.length;i++){
      for(let j=i+1;j<names.length;j++){
        const s = similarity(names[i], names[j]);
        if(s >= 0.85 && names[i].toLowerCase() !== names[j].toLowerCase()){ pairs.push([names[i], names[j]]); }
      }
    }
    if(pairs.length){
      warn.innerHTML = `<div class="notice-amber">⚠️ ${pairs.length} similar item name${pairs.length===1?'':'s'} found: ${pairs.map(p=>`<b>${escapeAttr(p[0])}</b> / <b>${escapeAttr(p[1])}</b>`).join(' · ')}.<br>Consider merging them (rename in Stock tab).</div>`;
    } else { warn.innerHTML = ''; }
  }
  const itemsBox = document.getElementById('itemsList');
  if(items.length === 0){ itemsBox.innerHTML = '<div class="empty">No items yet</div>'; }
  else {
    itemsBox.innerHTML = items.map(it => `
      <div class="item-row"><div><div class="nm">${escapeAttr(it.name)} ${it.is_active?'':'<span class="badge">inactive</span>'}</div>
          <div class="meta">${escapeAttr(it.unit)} · ${escapeAttr(it.kind)}</div></div>
        <div class="actions">
          <button class="mini-btn" style="background:var(--accent);" onclick="openEditItemModal(${it.id})">Edit</button>
          <button class="mini-btn" style="background:${it.is_active?'var(--amber)':'var(--green)'};" onclick="toggleItemActive(${it.id}, ${it.is_active?1:0})">${it.is_active?'Off':'On'}</button>
          <button class="mini-btn" style="background:var(--red);" onclick="deleteItem(${it.id})">✕</button>
        </div></div>`).join('');
  }
  renderStockBook();
}
function renderStockBook(){
  const filterSel = document.getElementById('stockBookItemFilter');
  if(!filterSel) return;
  if(filterSel.options.length <= 1 && items.length){
    const currentVal = filterSel.value;
    filterSel.innerHTML = '<option value="all">All items</option>' + items.map(i => `<option value="${i.id}">${escapeAttr(i.name)}</option>`).join('');
    filterSel.value = currentVal || 'all';
  }
  const filter = filterSel.value;
  const body = document.getElementById('stockBookBody');
  if(!body) return;
  const balances = {};
  const annotated = stockBook.map(r => {
    const key = r.item_id;
    if(!(key in balances)) balances[key] = 0;
    balances[key] += r.qty;
    return { ...r, runningBalance: Math.round(balances[key] * 1000) / 1000 };
  });
  let visible = annotated;
  if(filter !== 'all'){ visible = annotated.filter(r => r.item_id === parseInt(filter, 10)); }
  if(visible.length === 0){ body.innerHTML = '<tr><td colspan="6" class="empty">No stock movements yet</td></tr>'; return; }
  const sourceLabel = (s) => {
    if(s === 'purchase') return 'Purchase';
    if(s === 'sale') return 'Sale';
    if(s === 'adjust') return 'Manual adjustment';
    if(s === 'production_in') return 'Consumed in production';
    if(s === 'production_out') return 'Produced';
    return s;
  };
  body.innerHTML = visible.slice().reverse().map(r => {
    const desc = sourceLabel(r.source) + (r.note ? ' — ' + r.note : '') + (r.ref_id ? ' #' + r.ref_id : '');
    const delBtn = isAdmin()
      ? `<button class="del" title="Delete this stock row and linked entry" onclick="deleteStockBookRow(${r.id}, '${escapeAttr(r.source)}', ${r.ref_id != null ? r.ref_id : 'null'}, '${escapeJs(r.item_name)}', '${fmtDateDMY(r.date)}')">✕</button>`
      : '';
    return `<tr><td>${fmtDateDMY(r.date)}</td><td>${escapeAttr(r.item_name)}</td>
      <td>${escapeAttr(desc)}</td>
      <td style="text-align:right;color:var(--green);">${r.qty > 0 ? fmtQty(r.qty) : '-'}</td>
      <td style="text-align:right;color:var(--red);">${r.qty < 0 ? fmtQty(-r.qty) : '-'}</td>
      <td style="text-align:right;font-weight:700;">${fmtQty(r.runningBalance)}</td>
      <td>${delBtn}</td></tr>`;
  }).join('');
}

/* ============================= PRODUCTION ============================= */
function renderProduction(){
  const box = document.getElementById('prodList');
  const from = document.getElementById('prodFrom').value;
  const to = document.getElementById('prodTo').value;
  let runs = productionRuns.slice().sort((a,b)=> (b.date||'') < (a.date||'') ? -1 : 1);
  if(from) runs = runs.filter(r => r.date >= from);
  if(to) runs = runs.filter(r => r.date <= to);
  if(runs.length === 0){ box.innerHTML = '<div class="empty">No production runs in this range</div>'; return; }
  box.innerHTML = runs.map(r => {
    const consumedLine = (r.materials||[]).map(m => `${m.item_name}: ${fmtQty(m.qty)} ${m.item_unit}`).join(' · ');
    return `<div class="entry"><div><div><b>${fmtDateDMY(r.date)}</b> · Produced ${fmtQty(r.produced_qty)} ${escapeAttr(r.produced_item_unit)} of ${escapeAttr(r.produced_item_name)} <span class="badge badge-production">PRODUCTION</span></div>
        <div class="meta">Consumed: ${escapeAttr(consumedLine || '—')}</div>${r.note?'<div class="meta">'+escapeAttr(r.note)+'</div>':''}</div>
      <div>${isAdmin() ? `<button class="del" onclick="deleteProduction(${r.id})">✕</button>` : ''}</div></div>`;
  }).join('');
}
async function deleteProduction(id){
  if(!isAdmin()){ alert('Only an admin can delete production runs.'); return; }
  if(!confirm('Delete this production run? The stock movements will also be removed.')) return;
  try{ await fetch('/api/production/' + id, { method:'DELETE' }); }catch(e){}
  await load();
}

/* ============================= CLIENT LEDGER ============================= */
function renderLedger(){
  const box = document.getElementById('ledger');
  const title = document.getElementById('ledgerTitle');
  const searchBox = document.getElementById('clientSearch');
  if(openClient){
    searchBox.style.display = 'none';
    const c = openClient;
    title.innerHTML = `<span style="cursor:pointer;color:var(--accent);" onclick="backToClients()">← Clients</span> · ${escapeAttr(c)}`;
    const sales = entries.filter(e=>e.kind==='sale' && e.client===c && !e.isChallan && (e.amount||0) > 0).sort((a,b)=>b.id-a.id);
    const challans = entries.filter(e=>e.kind==='sale' && e.client===c && e.isChallan && (e.amount||0) > 0).sort((a,b)=>b.id-a.id);
    const material = materialSupplied.filter(m => m.client === c);
    const advList = advances.filter(a=>a.client===c).sort((a,b)=>b.id-a.id);
    const adjList = adjustments.filter(a=>a.client===c).sort((a,b)=>b.id-a.id);
    const gross = clientGrossPending(c);
    const adjTotal = clientAdjustmentTotal(c);
    const net = clientNetPending(c);
    const advBal = clientAdvanceBalance(c);
    let html = `<div class="stat"><span>Total Billed</span><span class="v">${fmt(sales.reduce((s,e)=>s+e.amount,0))}</span></div>
      <div class="stat"><span>Gross Pending (bills)</span><span class="v">${fmt(gross)}</span></div>
      <div class="stat"><span>Adjustments (discount/TDS/etc.)</span><span class="v">-${fmt(adjTotal)}</span></div>
      <div class="stat"><span>Advance Available (unapplied credit)</span><span class="v" style="color:var(--purple);">${fmt(Math.max(0, advBal))}</span></div>
      <div class="stat pending"><span><b>Net Pending</b></span><span class="v">${fmt(net)}</span></div>
      <div class="grid2" style="margin-top:10px;">
        <button class="link-btn" style="background:var(--bg);" onclick="openAdjModal('${escapeJs(c)}')">+ Add Adjustment</button>
        <button class="link-btn" style="background:var(--bg);" onclick="quickAddAdvance('${escapeJs(c)}')">+ Add Advance</button>
      </div><b style="font-size:13px;display:block;margin-top:14px;">Bills</b>`;
    html += sales.length ? sales.map(e=>{
      const status = saleStatus(e); const bal = saleBalance(e);
      const bc = status==='paid'?'badge-paid':(status==='partial'?'badge-partial':'badge-pending');
      const bt = status==='paid'?'PAID':(status==='partial'?'PARTIAL ('+fmt(bal)+' due)':'PENDING');
      const pays = paymentsFor(e.id).sort((a,b)=>(a.date>b.date?1:-1));
      const paymentsHtml = pays.length ? pays.map(p=>`<div class="meta">↳ ${fmtDateDMY(p.date)} · ${p.method} · ₹${fmt(p.amount)} ${isAdmin()?`<span style="color:var(--accent);cursor:pointer;" onclick="openEditPayModal(${p.id})">[edit]</span> <span style="color:var(--red);cursor:pointer;" onclick="delPayment(${p.id})">[×]</span>`:''}</div>`).join('') : '';
      const directPaid = pays.reduce((s,p)=>s+p.amount,0);
      const settledFromSurplus = (status === 'paid') && (directPaid < e.amount - 0.005);
      const surplusNote = settledFromSurplus ? `<div class="meta" style="color:var(--purple);">↳ Settled using client advance / surplus</div>` : '';
      return `<div class="entry"><div><div>${escapeAttr(e.itemType||'')} · ${fmtQty(e.qty||0)} @ ${fmt(e.rate||0)} <span class="badge ${bc}">${bt}</span></div><div class="meta">${fmtDateTime(e.date, e.createdAt)}${e.note?' · '+escapeAttr(e.note):''}</div>${paymentsHtml}${surplusNote}</div>
        <div style="display:flex;align-items:center;gap:6px;"><span style="font-weight:700;">${fmt(e.amount)}</span>
        ${status!=='paid' ? `<button class="mini-btn" style="background:var(--amber);" onclick="openPayModal(${e.id})">Pay</button>` : ''}
        ${isAdmin() ? `<button class="mini-btn" style="background:var(--accent);" onclick="openEditModal(${e.id})">Edit</button>` : ''}</div></div>`;
    }).join('') : '<div class="empty">No bills yet</div>';
    if(material.length){
      html += `<b style="font-size:13px;display:block;margin-top:14px;">Material Supplied (rate not yet decided)</b>`;
      const byItem = {};
      material.forEach(m => { byItem[m.itemType||'—'] = (byItem[m.itemType||'—'] || 0) + (m.qty||0); });
      html += `<div class="entry"><div><div style="color:var(--muted);font-size:12px;">${Object.entries(byItem).map(([k,v]) => `${fmtQty(v)} ${escapeAttr(k)}`).join(' · ')}</div></div>
        <div style="display:flex;align-items:center;gap:6px;"><button class="mini-btn" style="background:#0891b2;" onclick="goToMaterialForClient('${escapeJs(c)}')">Go to Material Supplied</button></div></div>`;
    }
    html += `<b style="font-size:13px;display:block;margin-top:14px;">Challans</b>`;
    html += challans.length ? challans.map(e=>{
      const billed = e.billedUnderId ? `<span class="badge badge-billed">BILLED #${e.billedUnderId}</span>` : '<span class="badge badge-challan">UNBILLED</span>';
      return `<div class="entry"><div><div>${escapeAttr(e.challanNo||'')} · ${escapeAttr(e.itemType||'')} · ${fmtQty(e.qty||0)} @ ${fmt(e.rate||0)} ${billed}</div><div class="meta">${fmtDateDMY(e.date)}${e.note?' · '+escapeAttr(e.note):''}</div></div>
        <div style="display:flex;align-items:center;gap:6px;"><span style="font-weight:700;">${fmt(e.amount)}</span>
        ${isAdmin() ? `<button class="mini-btn" style="background:var(--accent);" onclick="openEditModal(${e.id})">Edit</button>` : ''}</div></div>`;
    }).join('') : '<div class="empty">No challans</div>';
    html += `<b style="font-size:13px;display:block;margin-top:14px;">Advances</b>`;
    html += advList.length ? advList.map(a=>`<div class="entry"><div><div>Advance via ${a.method}</div><div class="meta">${fmtDateDMY(a.date)}${a.note?' · '+escapeAttr(a.note):''}</div></div>
      <div style="display:flex;align-items:center;gap:6px;"><span class="amt-in">+${fmt(a.amount)}</span>${isAdmin() ? `<button class="del" onclick="delAdvance(${a.id})">✕</button>` : ''}</div></div>`).join('') : '<div class="empty">No advances</div>';
    html += `<b style="font-size:13px;display:block;margin-top:14px;">Adjustments</b>`;
    html += adjList.length ? adjList.map(a=>`<div class="entry"><div><div>${escapeAttr(a.adjType)}</div><div class="meta">${fmtDateDMY(a.date)}${a.note?' · '+escapeAttr(a.note):''}</div></div>
      <div style="display:flex;align-items:center;gap:6px;"><span class="amt-out">-${fmt(a.amount)}</span>${isAdmin() ? `<button class="del" onclick="delAdjustment(${a.id})">✕</button>` : ''}</div></div>`).join('') : '<div class="empty">No adjustments</div>';
    box.innerHTML = html;
    return;
  }
  searchBox.style.display = 'block';
  title.textContent = 'Client Ledger';
  const q = searchBox.value.trim().toLowerCase();
  let names = allClientsWithActivity(); if(q) names = names.filter(n=>n.toLowerCase().includes(q));
  names.sort();
  if(names.length===0){ box.innerHTML = `<div class="empty">${q?'No matches':'No client activity yet'}</div>`; return; }
  box.innerHTML = names.map(name=>{
    const net = clientNetPending(name); const advBal = clientAdvanceBalance(name);
    return `<div class="entry" style="cursor:pointer;" onclick='openClientView(${JSON.stringify(name)})'>
      <div><b>${escapeAttr(name)}</b>${advBal>0.005 ? `<div class="meta" style="color:var(--purple);">Advance: ${fmt(advBal)}</div>` : ''}</div>
      <div style="${net>0.005?'color:var(--amber);font-weight:700;':'color:var(--green);'}">${net>0.005 ? 'Pending '+fmt(net) : 'Settled'}</div></div>`;
  }).join('');
}
function openClientView(name){ openClient = name; renderLedger(); }
function backToClients(){ openClient = null; renderLedger(); }
function quickAddAdvance(clientName){
  switchTab('ledger'); openClientView(clientName);
  setKind('advance'); document.getElementById('client').value = clientName;
  window.scrollTo({top:0, behavior:'smooth'});
}
function goToMaterialForClient(clientName){
  switchTab('material');
  setTimeout(() => {
    const els = document.querySelectorAll('#materialList > div > div:first-child');
    for(const el of els){ if(el.textContent.trim() === clientName){ el.scrollIntoView({behavior:'smooth', block:'center'}); break; } }
  }, 150);
}

/* ============================= VENDOR LEDGER ============================= */
function renderVendorLedger(){
  const box = document.getElementById('vendorLedger');
  const title = document.getElementById('vendorTitle');
  const searchBox = document.getElementById('vendorSearch');
  if(openVendor){
    searchBox.style.display = 'none';
    const v = openVendor;
    title.innerHTML = `<span style="cursor:pointer;color:var(--accent);" onclick="backToVendors()">← Vendors</span> · ${escapeAttr(v)}`;
    const purchases = entries.filter(e=>e.kind==='purchase' && e.vendor===v).sort((a,b)=>b.id-a.id);
    const vAdjList = vendorAdjustments.filter(a=>a.vendor===v).sort((a,b)=>b.id-a.id);
    const vAdvList = vendorAdvances.filter(a=>a.vendor===v).sort((a,b)=>b.id-a.id);
    const gross = vendorGrossPayable(v);
    const adjTotal = vendorAdjustmentTotal(v);
    const advBal = vendorAdvanceBalance(v);
    const net = vendorPayable(v);
    let html = `<div class="stat"><span>Total Purchased</span><span class="v">${fmt(purchases.reduce((s,e)=>s+e.amount,0))}</span></div>
      <div class="stat"><span>Gross Pending (bills)</span><span class="v">${fmt(gross)}</span></div>
      <div class="stat"><span>Adjustments (discount received/TDS/etc.)</span><span class="v">-${fmt(adjTotal)}</span></div>
      <div class="stat"><span>Advance Paid (unapplied)</span><span class="v" style="color:var(--purple);">${fmt(Math.max(0, advBal))}</span></div>
      <div class="stat payable"><span><b>Net Payable</b></span><span class="v">${fmt(net)}</span></div>
      <div class="grid2" style="margin-top:10px;">
        <button class="link-btn" style="background:var(--bg);" onclick="openVAdjModal('${escapeJs(v)}')">+ Add Adjustment</button>
        <button class="link-btn" style="background:var(--bg);" onclick="openVAdvModal('${escapeJs(v)}')">+ Add Advance</button>
      </div>
      <b style="font-size:13px;display:block;margin-top:14px;">Bills</b>`;
    html += purchases.length ? purchases.map(e=>{
      const status = purchaseStatus(e); const bal = purchaseBalance(e);
      const bc = status==='paid'?'badge-paid':(status==='partial'?'badge-partial':'badge-pending');
      const bt = status==='paid'?'PAID':(status==='partial'?'PARTIAL ('+fmt(bal)+' due)':'PENDING');
      const itemLabel = e.itemType || (e.note || 'Non-itemized');
      const pays = paymentsFor(e.id).sort((a,b)=>(a.date>b.date?1:-1));
      const paymentsHtml = pays.length ? pays.map(p=>`<div class="meta">↳ ${fmtDateDMY(p.date)} · ${p.method} · ₹${fmt(p.amount)} ${isAdmin()?`<span style="color:var(--accent);cursor:pointer;" onclick="openEditPayModal(${p.id})">[edit]</span> <span style="color:var(--red);cursor:pointer;" onclick="delPayment(${p.id})">[×]</span>`:''}</div>`).join('') : '';
      return `<div class="entry"><div><div>${escapeAttr(itemLabel)}${e.qty?' · '+fmtQty(e.qty)+' @ '+fmt(e.rate):''} <span class="badge ${bc}">${bt}</span></div><div class="meta">${fmtDateTime(e.date, e.createdAt)}${e.note?' · '+escapeAttr(e.note):''}</div>${paymentsHtml}</div>
        <div style="display:flex;align-items:center;gap:6px;"><span style="font-weight:700;">${fmt(e.amount)}</span>
        ${status!=='paid' ? `<button class="mini-btn" style="background:var(--amber);" onclick="openPayModal(${e.id})">Pay</button>` : ''}
        ${isAdmin() ? `<button class="mini-btn" style="background:var(--accent);" onclick="openEditModal(${e.id})">Edit</button>` : ''}</div></div>`;
    }).join('') : '<div class="empty">No purchase bills yet</div>';
    html += `<b style="font-size:13px;display:block;margin-top:14px;">Adjustments</b>`;
    html += vAdjList.length ? vAdjList.map(a=>`<div class="entry"><div><div>${escapeAttr(a.adjType)}</div><div class="meta">${fmtDateDMY(a.date)}${a.note?' · '+escapeAttr(a.note):''}</div></div>
      <div style="display:flex;align-items:center;gap:6px;"><span class="amt-out">-${fmt(a.amount)}</span>${isAdmin() ? `<button class="del" onclick="delVendorAdjustment(${a.id})">✕</button>` : ''}</div></div>`).join('') : '<div class="empty">No adjustments</div>';
    html += `<b style="font-size:13px;display:block;margin-top:14px;">Advances Paid</b>`;
    html += vAdvList.length ? vAdvList.map(a=>`<div class="entry"><div><div>Advance paid via ${a.method}</div><div class="meta">${fmtDateDMY(a.date)}${a.note?' · '+escapeAttr(a.note):''}</div></div>
      <div style="display:flex;align-items:center;gap:6px;"><span class="amt-out">-${fmt(a.amount)}</span>${isAdmin() ? `<button class="del" onclick="delVendorAdvance(${a.id})">✕</button>` : ''}</div></div>`).join('') : '<div class="empty">No advances paid</div>';
    box.innerHTML = html;
    return;
  }
  searchBox.style.display = 'block';
  title.textContent = 'Vendor Ledger';
  const q = searchBox.value.trim().toLowerCase();
  let names = allVendorsWithActivity(); if(q) names = names.filter(n=>n.toLowerCase().includes(q));
  names.sort();
  if(names.length===0){ box.innerHTML = `<div class="empty">${q?'No matches':'No vendor activity yet'}</div>`; return; }
  box.innerHTML = names.map(name=>{
    const net = vendorPayable(name);
    const adj = vendorAdjustmentTotal(name);
    const adv = vendorAdvanceBalance(name);
    const extras = [];
    if(adj > 0.005) extras.push(`Adj ${fmt(adj)}`);
    if(adv > 0.005) extras.push(`Advance ${fmt(adv)}`);
    return `<div class="entry" style="cursor:pointer;" onclick='openVendorView(${JSON.stringify(name)})'>
      <div><b>${escapeAttr(name)}</b>${extras.length ? `<div class="meta" style="color:#0891b2;">${extras.join(' · ')}</div>` : ''}</div>
      <div style="${net>0.005?'color:var(--red);font-weight:700;':'color:var(--green);'}">${net>0.005 ? 'Payable '+fmt(net) : 'Settled'}</div></div>`;
  }).join('');
}
function openVendorView(name){ openVendor = name; renderVendorLedger(); }
function backToVendors(){ openVendor = null; renderVendorLedger(); }

/* ============================= PENDING ============================= */
function renderPending(){
  const box = document.getElementById('pendingList');
  const pbox = document.getElementById('payableList');
  document.getElementById('pendingGrandTotal').textContent = fmt(totalPendingAllClients());
  document.getElementById('payableGrandTotal').textContent = fmt(totalPayableAllVendors());
  const clients = allClientsWithActivity().map(n=>({ name:n, net: clientNetPending(n) })).filter(c=>c.net > 0.005).sort((a,b)=>b.net-a.net);
  box.innerHTML = clients.length ? clients.map(c=>`<div class="entry" style="cursor:pointer;" onclick='goToClientLedger(${JSON.stringify(c.name)})'><div><b>${escapeAttr(c.name)}</b></div><div style="color:var(--amber);font-weight:700;">${fmt(c.net)}</div></div>`).join('') : '<div class="empty">No pending amounts</div>';
  const vendors = allVendorsWithActivity().map(n=>({ name:n, net: vendorPayable(n) })).filter(c=>c.net > 0.005).sort((a,b)=>b.net-a.net);
  pbox.innerHTML = vendors.length ? vendors.map(c=>`<div class="entry" style="cursor:pointer;" onclick='goToVendorLedger(${JSON.stringify(c.name)}')"><div><b>${escapeAttr(c.name)}</b></div><div style="color:var(--red);font-weight:700;">${fmt(c.net)}</div></div>`).join('') : '<div class="empty">No payables</div>';
}
function goToClientLedger(name){ switchTab('ledger'); openClientView(name); }
function goToVendorLedger(name){ switchTab('vendor'); openVendorView(name); }

/* ============================= USERS ============================= */
let editingUsername = null;
let usersCache = [];
async function loadUsers(){
  try{
    const res = await fetch('/api/users');
    if(!res.ok){ usersCache = []; return; }
    usersCache = await res.json();
  }catch(e){ usersCache = []; }
}
function renderUsers(){
  const box = document.getElementById('usersList');
  if(!box) return;
  loadUsers().then(() => {
    if(usersCache.length === 0){ box.innerHTML = '<div class="empty">No users</div>'; return; }
    box.innerHTML = usersCache.map(u => {
      const isSelf = currentUser && u.username === currentUser.username;
      const windowText = (u.role === 'admin') ? 'Unlimited'
        : (u.entry_window_days === null || u.entry_window_days === undefined ? '1 day'
          : (u.entry_window_days === 0 ? 'Today only' : u.entry_window_days + ' day' + (u.entry_window_days === 1 ? '' : 's')));
      const roleCls = u.role === 'admin' ? 'badge-paid' : 'badge-partial';
      return `<div class="acct-row"><div><div class="nm">${escapeAttr(u.username)} <span class="badge ${roleCls}">${escapeAttr(u.role)}</span>${isSelf?' <span class="badge">you</span>':''}</div>
          <div class="meta">${escapeAttr(u.label || '')} · Backdating: ${windowText}</div></div>
        <div class="actions">
          <button class="mini-btn" style="background:var(--accent);" onclick="openEditUserModal('${escapeJs(u.username)}')">Edit</button>
          ${isSelf ? '' : `<button class="mini-btn" style="background:var(--red);" onclick="deleteUser('${escapeJs(u.username)}')">Delete</button>`}
        </div></div>`;
    }).join('');
  });
}
function onUserWindowChange(){
  const sel = document.getElementById('userWindowDays');
  const custom = document.getElementById('userWindowDaysCustom');
  if(!sel || !custom) return;
  custom.style.display = (sel.value === 'custom') ? 'block' : 'none';
  if(sel.value !== 'custom') custom.value = '';
}
function openAddUserModal(){
  editingUsername = null;
  document.getElementById('userModalTitle').textContent = 'Add User';
  document.getElementById('userUsername').value = '';
  document.getElementById('userUsername').disabled = false;
  document.getElementById('userLabel').value = '';
  document.getElementById('userRole').value = 'operator';
  document.getElementById('userWindowDays').value = '0';
  document.getElementById('userWindowDaysCustom').value = '';
  document.getElementById('userWindowDaysCustom').style.display = 'none';
  document.getElementById('userPassword').value = '';
  document.getElementById('userPasswordLabel').textContent = 'Password';
  document.getElementById('userPasswordHint').textContent = '';
  onUserRoleChange();
  document.getElementById('userModal').style.display = 'flex';
}
function openEditUserModal(username){
  const u = usersCache.find(x => x.username === username);
  if(!u) return;
  editingUsername = username;
  document.getElementById('userModalTitle').textContent = 'Edit User';
  document.getElementById('userUsername').value = u.username;
  document.getElementById('userUsername').disabled = true;
  document.getElementById('userLabel').value = u.label || '';
  document.getElementById('userRole').value = u.role;
  const sel = document.getElementById('userWindowDays');
  const custom = document.getElementById('userWindowDaysCustom');
  const days = (u.entry_window_days === null || u.entry_window_days === undefined) ? null : Number(u.entry_window_days);
  const presets = ['0', '1', '2', '7', '30'];
  if(days !== null && presets.includes(String(days))){ sel.value = String(days); custom.value = ''; custom.style.display = 'none'; }
  else if(days !== null){ sel.value = 'custom'; custom.value = days; custom.style.display = 'block'; }
  else { sel.value = '0'; custom.value = ''; custom.style.display = 'none'; }
  document.getElementById('userPassword').value = '';
  document.getElementById('userPasswordLabel').textContent = 'New password (leave blank to keep current)';
  document.getElementById('userPasswordHint').textContent = 'Only fill this if you want to change the password.';
  onUserRoleChange();
  document.getElementById('userModal').style.display = 'flex';
}
function closeUserModal(){ editingUsername = null; document.getElementById('userModal').style.display = 'none'; }
function onUserRoleChange(){
  const role = document.getElementById('userRole').value;
  const field = document.getElementById('userWindowField');
  if(role === 'admin'){ field.style.display = 'none'; }
  else { field.style.display = 'block'; }
}
async function saveUser(){
  const username = document.getElementById('userUsername').value.trim().toLowerCase();
  const label = document.getElementById('userLabel').value.trim();
  const role = document.getElementById('userRole').value;
  const sel = document.getElementById('userWindowDays');
  const custom = document.getElementById('userWindowDaysCustom');
  let windowRaw;
  if(sel.value === 'custom'){ windowRaw = custom.value; } else { windowRaw = sel.value; }
  const password = document.getElementById('userPassword').value;
  if(!editingUsername && !username){ alert('Enter a username'); return; }
  if(!editingUsername && !password){ alert('Enter a password'); return; }
  const body = { label, role };
  if(role === 'operator'){
    if(windowRaw === '' || windowRaw === null || windowRaw === undefined){ alert('Choose how far back this user can enter entries.'); return; }
    const n = parseInt(windowRaw, 10);
    if(isNaN(n) || n < 0){ alert('Enter a valid number of days (0 or more)'); return; }
    body.entryWindowDays = n;
  }
  if(password) body.password = password;
  let res;
  if(editingUsername){
    res = await fetch('/api/users/' + encodeURIComponent(editingUsername), { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
  } else {
    body.username = username;
    res = await fetch('/api/users', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
  }
  if(!res.ok){ const err = await res.json().catch(()=>({})); alert(err.error || 'Could not save user'); return; }
  closeUserModal();
  renderUsers();
}
async function deleteUser(username){
  if(!confirm('Delete user "' + username + '"? They will no longer be able to log in.')) return;
  const res = await fetch('/api/users/' + encodeURIComponent(username), { method: 'DELETE' });
  if(!res.ok){ const err = await res.json().catch(()=>({})); alert(err.error || 'Could not delete user'); return; }
  renderUsers();
}

/* ============================= BANK ============================= */
let bankTxnType = 'deposit';
function setBankTxnType(t){
  bankTxnType = t;
  ['deposit','withdrawal','cash_to_bank','bank_to_cash','vendor_payment','client_receipt'].forEach(k => {
    const el = document.getElementById('bt' + k.replace(/(^|_)([a-z])/g, (m,a,b)=>b.toUpperCase()));
    if(el) el.classList.toggle('active', k===t);
  });
  const isGeneral = (t==='deposit'||t==='withdrawal'||t==='cash_to_bank'||t==='bank_to_cash');
  document.getElementById('btGeneralFields').style.display = isGeneral ? 'block' : 'none';
  document.getElementById('btVendorPaymentFields').style.display = (t==='vendor_payment') ? 'block' : 'none';
  document.getElementById('btClientReceiptFields').style.display = (t==='client_receipt') ? 'block' : 'none';
  if(t==='vendor_payment'){
    refreshBtVendorDropdown();
    updateBtVendorHint();
  }
  if(t==='client_receipt'){
    refreshBtClientDropdown();
    updateBtClientHint();
  }
}
async function submitBankTxn(){
  if(bankTxnType === 'vendor_payment'){
    const vendor = document.getElementById('btVendorSelect').value;
    const amount = parseFloat(document.getElementById('btVendorAmount').value);
    const date = document.getElementById('btVendorDate').value || todayStr();
    const bankId = document.getElementById('btVendorBankSelect').value;
    const note = document.getElementById('btVendorNote').value.trim();
    if(!vendor){ alert('Choose a vendor'); return; }
    if(!amount || amount<=0){ alert('Enter a valid amount'); return; }
    if(!bankId){ alert('Choose a bank account'); return; }
    try{
      await applyVendorPayment(vendor, amount, date, bankId, note);
    }catch(err){ alert('Could not save: ' + (err&&err.message?err.message:err)); return; }
    document.getElementById('btVendorAmount').value = '';
    document.getElementById('btVendorNote').value = '';
    await load(); await loadTypeOptions();
    return;
  }
  if(bankTxnType === 'client_receipt'){
    const client = document.getElementById('btClientSelect').value;
    const amount = parseFloat(document.getElementById('btClientAmount').value);
    const date = document.getElementById('btClientDate').value || todayStr();
    const bankId = document.getElementById('btClientBankSelect').value;
    const note = document.getElementById('btClientNote').value.trim();
    if(!client){ alert('Choose a client'); return; }
    if(!amount || amount<=0){ alert('Enter a valid amount'); return; }
    if(!bankId){ alert('Choose a bank account'); return; }
    try{
      await applyClientReceipt(client, amount, date, bankId, note);
    }catch(err){ alert('Could not save: ' + (err&&err.message?err.message:err)); return; }
    document.getElementById('btClientAmount').value = '';
    document.getElementById('btClientNote').value = '';
    await load(); await loadTypeOptions();
    return;
  }
  const amount = parseFloat(document.getElementById('btAmount').value);
  const txnDate = document.getElementById('btDate').value || todayStr();
  const category = document.getElementById('btCategory').value.trim();
  const acctId = document.getElementById('btBankAccountSelect').value;
  if(!amount || amount<=0){ alert('Enter a valid amount'); return; }
  if(!acctId){ alert('Choose a bank account'); return; }
  if((bankTxnType==='deposit'||bankTxnType==='withdrawal') && !category){ alert('Enter a category'); return; }
  try{
    const res = await fetch('/api/bank-transactions', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: txnDate, type: bankTxnType, amount, category, note: document.getElementById('btNote').value.trim(), bankAccountId: acctId }) });
    if(!res.ok){ const err = await res.json().catch(()=>({})); alert(err.error ? ('Could not save: '+err.error) : 'Could not save transaction.'); return; }
  }catch(err){ alert('Could not reach the server: ' + (err&&err.message?err.message:err)); return; }
  document.getElementById('btAmount').value = '';
  document.getElementById('btCategory').value = '';
  document.getElementById('btNote').value = '';
  await load(); await loadTypeOptions();
}

/* ============================= BANK TAB FIFO HELPERS ============================= */
async function applyVendorPayment(vendor, totalAmount, date, bankAccountId, note){
  const bills = entries
    .filter(e => e.kind==='purchase' && e.vendor===vendor)
    .map(e => ({ e, bal: purchaseBalance(e) }))
    .filter(x => x.bal > 0.005)
    .sort((a,b) => (a.e.date < b.e.date ? -1 : 1));
  let totalUnpaid = bills.reduce((s,x)=>s+x.bal, 0);
  let remaining = totalAmount;
  for(const {e, bal} of bills){
    if(remaining <= 0.005) break;
    const apply = Math.min(remaining, bal);
    const body = { date, method:'bank', amount: apply, bankAccountId };
    const res = await fetch('/api/purchases/' + e.id + '/pay', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if(!res.ok){ const err = await res.json().catch(()=>({})); throw new Error(err.error || 'vendor payment failed'); }
    remaining = Math.round((remaining - apply) * 100) / 100;
  }
  if(remaining > 0.005){
    const body = { date, vendor, amount: remaining, method:'bank', note: note || 'Auto-advance from Bank tab payment', bankAccountId };
    const res = await fetch('/api/vendor-advances', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if(!res.ok){ const err = await res.json().catch(()=>({})); throw new Error(err.error || 'vendor advance failed'); }
  }
}
async function applyClientReceipt(client, totalAmount, date, bankAccountId, note){
  const bills = entries
    .filter(e => e.kind==='sale' && e.client===client && !e.isChallan)
    .map(e => ({ e, bal: saleBalance(e) }))
    .filter(x => x.bal > 0.005)
    .sort((a,b) => (a.e.date < b.e.date ? -1 : 1));
  let remaining = totalAmount;
  for(const {e, bal} of bills){
    if(remaining <= 0.005) break;
    const apply = Math.min(remaining, bal);
    const body = { date, method:'bank', amount: apply, bankAccountId };
    const res = await fetch('/api/entries/' + e.id + '/pay', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if(!res.ok){ const err = await res.json().catch(()=>({})); throw new Error(err.error || 'client receipt failed'); }
    remaining = Math.round((remaining - apply) * 100) / 100;
  }
  if(remaining > 0.005){
    const body = { date, client, amount: remaining, method:'bank', note: note || 'Auto-advance from Bank tab receipt', bankAccountId };
    const res = await fetch('/api/advances', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if(!res.ok){ const err = await res.json().catch(()=>({})); throw new Error(err.error || 'client advance failed'); }
  }
}

async function saveOpeningCash(){
  if(!isAdmin()){ alert('Only an admin can set opening cash.'); return; }
  const amount = parseFloat(document.getElementById('cashObAmount').value);
  const od = document.getElementById('cashObDate').value;
  if(isNaN(amount)){ alert('Enter a valid amount'); return; }
  if(!od){ alert('Choose a date'); return; }
  try{
    const res = await fetch('/api/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ openingCashBalance: amount, openingCashDate: od }) });
    if(!res.ok){ const err = await res.json().catch(()=>({})); alert(err.error || 'Could not save'); return; }
  }catch(err){ alert('Could not reach the server: ' + (err&&err.message?err.message:err)); return; }
  await load();
  alert('Opening cash saved: ' + fmt(amount) + ' as of ' + fmtDateDMY(od));
}
async function saveOpeningBank(){
  if(!isAdmin()){ alert('Only an admin can set opening balance.'); return; }
  if(bankAccountFilter === 'all'){ alert('Pick a specific account above.'); return; }
  const amount = parseFloat(document.getElementById('obAmount').value);
  const obDate = document.getElementById('obDate').value;
  if(isNaN(amount)){ alert('Enter a valid amount'); return; }
  if(!obDate){ alert('Choose a date'); return; }
  try{
    const res = await fetch('/api/bank-accounts/' + bankAccountFilter, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ openingBalance: amount, openingDate: obDate }) });
    if(!res.ok){ const err = await res.json().catch(()=>({})); alert(err.error ? ('Could not save: '+err.error) : 'Could not save.'); return; }
  }catch(err){ alert('Could not reach the server: ' + (err&&err.message?err.message:err)); return; }
  await load();
}
async function deleteBankTxn(id){
  if(!isAdmin()){ alert('Only an admin can delete bank transactions.'); return; }
  if(!confirm('Delete this bank transaction?')) return;
  try{ await fetch('/api/bank-transactions/' + id, { method:'DELETE' }); }catch(e){}
  await load();
}
function openAddAccountModal(){
  editingAccountId = null;
  document.getElementById('accountModalTitle').textContent = 'Add Bank Account';
  document.getElementById('acctName').value = '';
  document.getElementById('acctOpening').value = '';
  document.getElementById('acctOpeningDate').value = todayStr();
  document.getElementById('accountModal').style.display = 'flex';
}
function openEditAccountModal(id){
  const a = bankAccounts.find(x=>x.id===id); if(!a) return;
  editingAccountId = id;
  document.getElementById('accountModalTitle').textContent = 'Edit Bank Account';
  document.getElementById('acctName').value = a.name;
  document.getElementById('acctOpening').value = a.opening_balance || 0;
  document.getElementById('acctOpeningDate').value = a.opening_date || todayStr();
  document.getElementById('accountModal').style.display = 'flex';
}
function closeAccountModal(){ editingAccountId = null; document.getElementById('accountModal').style.display='none'; }
async function saveAccount(){
  const name = document.getElementById('acctName').value.trim();
  const ob = parseFloat(document.getElementById('acctOpening').value) || 0;
  const obDate = document.getElementById('acctOpeningDate').value || null;
  if(!name){ alert('Enter a name'); return; }
  let res;
  if(editingAccountId){ res = await fetch('/api/bank-accounts/' + editingAccountId, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, openingBalance: ob, openingDate: obDate }) }); }
  else { res = await fetch('/api/bank-accounts', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, openingBalance: ob, openingDate: obDate }) }); }
  if(!res.ok){ const err = await res.json().catch(()=>({})); alert(err.error || 'Could not save'); return; }
  closeAccountModal();
  await load();
}
async function toggleAccountActive(id, currentlyActive){
  if(!confirm(currentlyActive ? 'Deactivate this account?' : 'Reactivate this account?')) return;
  const res = await fetch('/api/bank-accounts/' + id, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ isActive: !currentlyActive }) });
  if(!res.ok){ const err = await res.json().catch(()=>({})); alert(err.error || 'Could not update'); return; }
  await load();
}
async function deleteAccount(id){
  const a = bankAccounts.find(x=>x.id===id);
  if(!confirm('Permanently delete "' + (a?a.name:'account') + '"?\n\nOnly works if the account has zero transactions.')) return;
  const res = await fetch('/api/bank-accounts/' + id, { method:'DELETE' });
  if(!res.ok){ const err = await res.json().catch(()=>({})); alert(err.error || 'Could not delete'); return; }
  await load();
}
function renderAccountsList(){
  const box = document.getElementById('bankAccountsList');
  if(!box) return;
  if(bankAccounts.length===0){ box.innerHTML = '<div class="empty">No accounts yet</div>'; return; }
  box.innerHTML = bankAccounts.map(a=>`
    <div class="acct-row"><div><div class="nm">${escapeAttr(a.name)} ${a.is_active?'':'<span class="badge badge-closed">inactive</span>'}</div>
        <div class="meta">Opening: ${fmt(a.opening_balance)}${a.opening_date?' · '+fmtDateDMY(a.opening_date):''}</div></div>
      <div class="actions">
        <button class="mini-btn" style="background:var(--accent);" onclick="openEditAccountModal(${a.id})">Edit</button>
        <button class="mini-btn" style="background:${a.is_active?'var(--amber)':'var(--green)'};" onclick="toggleAccountActive(${a.id}, ${a.is_active?1:0})">${a.is_active?'Off':'On'}</button>
        <button class="mini-btn" style="background:var(--red);" onclick="deleteAccount(${a.id})">✕</button>
      </div></div>`).join('');
}
function renderBank(){
  renderAccountsList();
  const fromEl = document.getElementById('cbFrom');
  const toEl = document.getElementById('cbTo');
  if(fromEl && !fromEl.value && toEl && !toEl.value){ fromEl.value = todayStr(); toEl.value = todayStr(); }
  const fromStr = fromEl ? (fromEl.value || '') : '';
  const toStr = toEl ? (toEl.value || '') : '';
  const labelEl = document.getElementById('bankBalanceLabel');
  if(bankAccountFilter === 'all') labelEl.textContent = 'Current Bank Balance (all accounts)';
  else labelEl.textContent = 'Current Bank Balance — ' + accountName(bankAccountFilter);
  document.getElementById('bankCurrentBalance').textContent = fmt(currentBankBalance(bankAccountFilter));
  const obDateEl = document.getElementById('obDate');
  const obAmtEl = document.getElementById('obAmount');
  if(bankAccountFilter === 'all'){ obDateEl.value = ''; obAmtEl.value = ''; }
  else {
    const a = bankAccounts.find(x=>x.id===bankAccountFilter);
    obDateEl.value = (a && a.opening_date) || todayStr();
    obAmtEl.value = (a && a.opening_balance) || 0;
  }
  if(!document.getElementById('btDate').value) document.getElementById('btDate').value = todayStr();
  const showBalance = (bankAccountFilter !== 'all');
  const fullLedger = buildBankLedger(bankAccountFilter);
  let openingBal = 0;
  if(fromStr){
    let lastBefore = null;
    for(const r of fullLedger){ if(r.date < fromStr) lastBefore = r; else break; }
    if(lastBefore){ openingBal = lastBefore.balance; }
    else if(bankAccountFilter === 'all'){ bankAccounts.forEach(a=>{ if((a.opening_date||'9999') < fromStr) openingBal += a.opening_balance || 0; }); }
    else { const a = bankAccounts.find(x=>x.id===bankAccountFilter); if(a && (a.opening_date||'9999') < fromStr) openingBal = a.opening_balance || 0; }
  }
  const ledgerInRange = fullLedger.filter(r => {
    if(fromStr && r.date < fromStr) return false;
    if(toStr && r.date > toStr) return false;
    return true;
  });
  document.getElementById('bankLedgerHead').innerHTML = `<tr><th>Date</th><th>Description</th><th style="text-align:right;">Credit</th><th style="text-align:right;">Debit</th>${showBalance ? '<th style="text-align:right;">Balance</th>' : ''}<th></th></tr>`;
  let html = '';
  if(fromStr && showBalance){
    html += `<tr style="background:var(--bg);"><td>${fmtDateDMY(addDays(fromStr, -1))}</td><td><i>Opening Balance</i></td><td style="text-align:right;">-</td><td style="text-align:right;">-</td><td style="text-align:right;font-weight:700;">${fmt(openingBal)}</td><td></td></tr>`;
  }
  if(ledgerInRange.length === 0){ html += `<tr><td colspan="${showBalance?6:5}" class="empty">No bank activity in this range</td></tr>`; }
  else {
    html += ledgerInRange.map(r=>{
      let delBtn = '';
      if(isAdmin() && r.source && r.source !== 'opening'){
        const amtVal = r.credit > 0 ? r.credit : r.debit;
        delBtn = `<button class="del" data-source="${r.source}" data-source-id="${r.sourceId}" data-label="${escapeAttr(r.label)}" data-amount="${fmt(amtVal)}" data-date="${fmtDateDMY(r.date)}" onclick="deleteBookRow(this)">✕</button>`;
      }
      const balCell = showBalance ? `<td style="text-align:right;font-weight:700;">${fmt(r.balance)}</td>` : '';
      return `<tr><td>${fmtDateDMY(r.date)}</td><td>${escapeAttr(r.label)}</td><td style="text-align:right;color:var(--green);">${r.credit>0?fmt(r.credit):'-'}</td><td style="text-align:right;color:var(--red);">${r.debit>0?fmt(r.debit):'-'}</td>${balCell}<td>${delBtn}</td></tr>`;
    }).join('');
  }
  document.getElementById('bankLedgerBody').innerHTML = html;
}
