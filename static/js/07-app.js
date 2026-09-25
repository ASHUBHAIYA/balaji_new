/* ============================= TABS & LAYOUT ============================= */
function toggleEntryCard(){
  const body = document.getElementById('entryCardBody');
  const btn = document.getElementById('entryCollapseBtn');
  if(!body || !btn) return;
  const isHidden = body.style.display === 'none';
  body.style.display = isHidden ? 'block' : 'none';
  btn.textContent = isHidden ? 'Hide Form' : 'Show Form';
}

function switchTab(tab){
  currentTab = tab;
  if(tab === 'all'){
    allEntriesShown = ALL_ENTRIES_PAGE_SIZE;
    if(!document.getElementById('allFrom').value && !document.getElementById('allTo').value){
      document.getElementById('allFrom').value = todayStr();
      document.getElementById('allTo').value = todayStr();
    }
  }
  const tabsList = ['dashboard','all','challans','material','stock','sp','production','cb','ledger','vendor','pending','users'];
  const tabIdMap = {
    dashboard:'tabDashboard', all:'tabAll', challans:'tabChallans', material:'tabMaterial',
    stock:'tabStock', sp:'tabSP', production:'tabProduction',
    cb:'tabCB', ledger:'tabLedger', vendor:'tabVendor', pending:'tabPending', users:'tabUsers'
  };
  const viewIdMap = {
    dashboard:'viewDashboard', all:'viewAll', challans:'viewChallans', material:'viewMaterial',
    stock:'viewStock', sp:'viewSP', production:'viewProduction',
    cb:'viewCB', ledger:'viewLedger', vendor:'viewVendor', pending:'viewPending', users:'viewUsers'
  };
  tabsList.forEach(t=>{
    const el = document.getElementById(tabIdMap[t] || ('tab' + t.charAt(0).toUpperCase() + t.slice(1)));
    if(el) el.classList.toggle('active', tab===t);
    const view = document.getElementById(viewIdMap[t] || ('view' + t.charAt(0).toUpperCase() + t.slice(1)));
    if(view) view.style.display = (tab===t) ? 'block' : 'none';
  });
  renderCurrentTab();
}
function renderCurrentTab(){
  if(currentTab==='dashboard') renderDashboard();
  else if(currentTab==='all') renderAllEntries();
  else if(currentTab==='challans') renderChallans();
  else if(currentTab==='material') renderMaterialSupplied();
  else if(currentTab==='stock') renderStock();
  else if(currentTab==='sp') renderSP();
  else if(currentTab==='production') renderProduction();
  else if(currentTab==='cb') renderCB();
  else if(currentTab==='ledger') renderLedger();
  else if(currentTab==='vendor') renderVendorLedger();
  else if(currentTab==='pending') renderPending();
  else if(currentTab==='users') renderUsers();
}

/* ============================= BACKUP / RESTORE ============================= */
function openDataModal(){ document.getElementById('clearConfirmText').value=''; document.getElementById('dataModal').style.display='flex'; }
function closeDataModal(){ document.getElementById('dataModal').style.display='none'; }
async function backupData(){
  try{
    const res = await fetch('/api/export');
    if(!res.ok){ alert('Only an admin can back up.'); return; }
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    await saveOrDownload(blob, 'tracker-backup-' + todayStr() + '.json');
  }catch(err){ alert('Backup failed: ' + (err&&err.message?err.message:err)); }
}
function restoreData(event){
  if(!isAdmin()){ alert('Only an admin can restore.'); event.target.value=''; return; }
  const file = event.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try{
      let parsed;
      try{ parsed = JSON.parse(reader.result); } catch(err){ alert('Invalid backup file.'); event.target.value=''; return; }
      if(!confirm('This will replace ALL current data. Continue?')){ event.target.value=''; return; }
      const res = await fetch('/api/import', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(parsed) });
      if(!res.ok){ const err = await res.json().catch(()=>({})); alert('Restore failed: ' + (err.error||'server error')); event.target.value=''; return; }
      const result = await res.json();
      await load(); await loadTypeOptions();
      alert('Restore complete: ' + JSON.stringify(result.counts));
      event.target.value = ''; closeDataModal();
    }catch(err){ alert('Restore failed: ' + (err&&err.message?err.message:err)); event.target.value = ''; }
  };
  reader.readAsText(file);
}
async function clearAllData(){
  const text = document.getElementById('clearConfirmText').value;
  if(text !== 'DELETE'){ alert('Type DELETE exactly to confirm.'); return; }
  if(!confirm('This will permanently erase ALL entries, payments, production runs, and stock movements. Items and bank accounts stay. Cannot be undone. Sure?')) return;
  try{
    const res = await fetch('/api/clear-all', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({confirm:'DELETE'}) });
    if(!res.ok){ const err = await res.json().catch(()=>({})); alert('Could not clear: ' + (err.error||'server error')); return; }
  }catch(err){ alert('Could not reach the server: ' + (err&&err.message?err.message:err)); return; }
  await load(); closeDataModal();
  alert('All data cleared.');
}

/* ============================= REPORTS ============================= */
function openReportModal(){ refreshAllAccountSelects(); document.getElementById('reportModal').style.display='flex'; }
function closeReportModal(){ document.getElementById('reportModal').style.display='none'; }
function buildReportDataset(fromStr, toStr, accountFilter){
  accountFilter = accountFilter || 'all';
  const t = computeRangeTotals(fromStr, toStr, accountFilter);
  const advInRange = advances.filter(a=>a.date>=fromStr && a.date<=toStr && (accountFilter==='all' || a.method!=='bank' || a.bankAccountId===accountFilter));
  const adjInRange = adjustments.filter(a=>a.date>=fromStr && a.date<=toStr);
  const prodInRange = productionRuns.filter(r=>r.date>=fromStr && r.date<=toStr);
  const openingCash = computeOpeningCash(fromStr);
  const closingCash = Math.round((openingCash + t.cashSale + t.advCash + t.bankToCash - t.cashPurch - t.vAdvCash - t.cashExp - t.cashToBank)*100)/100;
  const openingBank = computeOpeningBank(fromStr, accountFilter);
  const closingBank = Math.round((openingBank + t.bankSale + t.advBank + t.bankDeposits + t.cashToBank - t.bankPurch - t.vAdvBank - t.bankExp - t.bankWithdrawals - t.bankToCash)*100)/100;
  const fullLedger = buildBankLedger(accountFilter);
  const bankLedgerInRange = fullLedger.filter(r=>r.date>=fromStr && r.date<=toStr);
  return { ...t, advInRange, adjInRange, prodInRange, opening: openingCash, closingCash, openingBank, closingBank, bankLedgerInRange };
}

async function buildReportPdfBlob(){
  const { fromStr, toStr } = readRange();
  const accountFilter = document.getElementById('reportBankAccount').value || 'all';
  const d = buildReportDataset(fromStr, toStr, accountFilter);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pw - margin * 2;
  doc.setFillColor(37,99,235);
  doc.rect(0,0,pw,34,'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(16); doc.setFont(undefined,'bold');
  doc.text('SHREE BALAJI ASSOCIATES', margin, 13);
  doc.setFontSize(8); doc.setFont(undefined,'normal');
  doc.text('Near Om Sai Biofuels Bargawan Odgadi Distt. Singrauli', margin, 19);
  doc.text('GSTIN/UIN: 23AEPFS7841N1Z9', margin, 24);
  doc.setFontSize(11); doc.setFont(undefined,'bold');
  doc.text('Sales, Purchase, Stock & Production Report', margin, 30);
  doc.setTextColor(60,60,60);
  doc.setFontSize(9); doc.setFont(undefined,'normal');
  const periodText = (fromStr===toStr) ? fmtDateDMY(fromStr) : (fmtDateDMY(fromStr)+'  to  '+fmtDateDMY(toStr));
  doc.text(periodText, margin, 42);
  const acctText = accountFilter === 'all' ? 'Bank account: All accounts (combined)' : 'Bank account: ' + accountName(accountFilter);
  doc.text(acctText, pw - margin - doc.getTextWidth(acctText), 42);
  let y = 50;
  const billedSales = d.salesInRange.reduce((s,e)=>s+(e.amount || 0), 0);
  const moneyReceived = d.cashSale + d.bankSale;
  const billedPurch = d.purchasesInRange.reduce((s,e)=>s+e.amount, 0);
  const moneyPaidOut = d.cashPurch + d.bankPurch + d.vAdvCash + d.vAdvBank + d.cashExp + d.bankExp;
  const receivable = totalPendingAllClients();
  const payable = totalPayableAllVendors();
  const acctBalForGlance = perAccountBalances(fromStr, toStr);
  const activeBal = acctBalForGlance.filter(a => a.is_active);
  const totalBankClosing = Math.round(activeBal.reduce((s,a)=>s+a.closing,0)*100)/100;
  const cashPlusBank = Math.round((d.closingCash + totalBankClosing)*100)/100;
  const stockValue = stock.filter(s=>s.is_active).reduce((s,it)=>s+(it.on_hand_value||0),0);
  doc.setFontSize(11); doc.setFont(undefined,'bold'); doc.setTextColor(30,30,30);
  doc.text('AT A GLANCE', margin, y); y += 6;
  doc.setFontSize(8); doc.setFont(undefined,'bold'); doc.setTextColor(120,120,120);
  doc.text('FOR THE PERIOD   ' + periodText, margin, y); y += 5;
  const periodRows = [
    ['Sales billed', fmt(billedSales)],
    ['Money received (sales)', fmt(moneyReceived)],
    ['Purchases billed', fmt(billedPurch)],
    ['Money paid out (purchases + expenses + advances)', fmt(moneyPaidOut)],
  ];
  periodRows.forEach(r=>{
    doc.setFontSize(9); doc.setFont(undefined,'normal'); doc.setTextColor(40,40,40);
    doc.text(r[0], margin + 4, y);
    doc.setFont(undefined,'bold'); doc.text(r[1], pw - margin, y, {align:'right'}); doc.setFont(undefined,'normal');
    y += 5;
  });
  y += 4;
  doc.setFontSize(8); doc.setFont(undefined,'bold'); doc.setTextColor(120,120,120);
  doc.text('RIGHT NOW   (as of ' + fmtDateDMY(todayStr()) + ')', margin, y); y += 5;
  const liveRows = [
    ['Receivable from clients', fmt(receivable)],
    ['Payable to vendors', fmt(payable)],
    ['Cash + Bank on hand', fmt(cashPlusBank)],
    ['Stock value on hand', fmt(stockValue)],
  ];
  liveRows.forEach(r=>{
    doc.setFontSize(9); doc.setFont(undefined,'normal'); doc.setTextColor(40,40,40);
    doc.text(r[0], margin + 4, y);
    doc.setFont(undefined,'bold'); doc.text(r[1], pw - margin, y, {align:'right'}); doc.setFont(undefined,'normal');
    y += 5;
  });
  y += 8;
  function sectionHeading(title){
    if(y > ph - 50){ doc.addPage(); y = 20; }
    doc.setFillColor(37,99,235); doc.rect(margin, y, 3, 8, 'F');
    doc.setFontSize(12); doc.setFont(undefined,'bold'); doc.setTextColor(30,30,30);
    doc.text(title, margin + 7, y + 6); y += 14;
  }
  function smallNote(text){
    doc.setFontSize(8); doc.setFont(undefined,'italic'); doc.setTextColor(140,140,140);
    doc.text(text, margin, y); doc.setFont(undefined,'normal'); y += 12;
  }
  sectionHeading('FLOW — ' + (fromStr===toStr ? fmtDateDMY(fromStr) : fmtDateDMY(fromStr)+' to '+fmtDateDMY(toStr)));
  const netMovement = Math.round((moneyReceived - moneyPaidOut)*100)/100;
  doc.autoTable({
    startY:y, margin:{left:margin, right:margin}, theme:'plain',
    styles:{fontSize:9, cellPadding:{top:2,bottom:2,left:0,right:0}, textColor:[40,40,40]},
    body:[
      [{content:'MONEY IN', styles:{fontStyle:'bold', textColor:[22,163,74]}}, ''],
      ['  Sales — cash received', fmt(d.cashSale)],
      ['  Sales — bank received', fmt(d.bankSale)],
      [{content:'  Total Money In', styles:{fontStyle:'bold'}}, {content:fmt(moneyReceived), styles:{fontStyle:'bold', textColor:[22,163,74]}}],
      ['', ''],
      [{content:'MONEY OUT', styles:{fontStyle:'bold', textColor:[220,38,38]}}, ''],
      ['  Purchases — cash paid', fmt(d.cashPurch)],
      ['  Purchases — bank paid', fmt(d.bankPurch)],
      ['  Vendor advances — cash', fmt(d.vAdvCash)],
      ['  Vendor advances — bank', fmt(d.vAdvBank)],
      ['  Expenses — cash', fmt(d.cashExp)],
      ['  Expenses — bank', fmt(d.bankExp)],
      [{content:'  Total Money Out', styles:{fontStyle:'bold'}}, {content:fmt(moneyPaidOut), styles:{fontStyle:'bold', textColor:[220,38,38]}}],
      ['', ''],
      [{content:'NET MOVEMENT (In − Out)', styles:{fontStyle:'bold'}}, {content:fmt(netMovement), styles:{fontStyle:'bold', textColor: netMovement>=0?[22,163,74]:[220,38,38]}}],
    ],
    columnStyles:{0:{cellWidth:contentW-40}, 1:{halign:'right', cellWidth:40}}
  });
  y = doc.lastAutoTable.finalY + 14;
  sectionHeading('BALANCES — as of ' + fmtDateDMY(todayStr()));
  const acctBalances = perAccountBalances(fromStr, toStr);
  const balanceRows = [
    [{content:'OWED TO YOU', styles:{fontStyle:'bold', textColor:[217,119,6]}}, ''],
    ['  Receivable from clients (net of advances)', fmt(receivable)],
    ['', ''],
    [{content:'OWED BY YOU', styles:{fontStyle:'bold', textColor:[220,38,38]}}, ''],
    ['  Payable to vendors (net of adjustments & advances)', fmt(payable)],
    ['', ''],
    [{content:'CASH', styles:{fontStyle:'bold'}}, ''],
    ['  Cash on hand', fmt(d.closingCash)],
    ['', ''],
    [{content:'BANK ACCOUNTS', styles:{fontStyle:'bold'}}, ''],
  ];
  if(acctBalances.length === 0){ balanceRows.push(['  (no accounts)', '']); }
  else {
    acctBalances.forEach(a => {
      const tag = a.is_active ? '' : ' (closed)';
      balanceRows.push(['  ' + a.name + tag + ' — Opening', fmt(a.opening)]);
      balanceRows.push(['  ' + a.name + tag + ' — Closing', fmt(a.closing)]);
    });
    balanceRows.push([{content:'  Total Bank (closing)', styles:{fontStyle:'bold'}}, {content:fmt(totalBankClosing), styles:{fontStyle:'bold'}}]);
  }
  balanceRows.push(['', '']);
  balanceRows.push([{content:'CASH + BANK (closing)', styles:{fontStyle:'bold', fontSize:11}}, {content:fmt(cashPlusBank), styles:{fontStyle:'bold', fontSize:11, textColor:[37,99,235]}}]);
  balanceRows.push(['', '']);
  balanceRows.push([{content:'STOCK', styles:{fontStyle:'bold'}}, '']);
  balanceRows.push(['  Stock value on hand', fmt(stockValue)]);
  doc.autoTable({
    startY:y, margin:{left:margin, right:margin}, theme:'plain',
    styles:{fontSize:9, cellPadding:{top:2,bottom:2,left:0,right:0}, textColor:[40,40,40]},
    body: balanceRows,
    columnStyles:{0:{cellWidth:contentW-40}, 1:{halign:'right', cellWidth:40}}
  });
  y = doc.lastAutoTable.finalY + 14;
  sectionHeading('PENDING CLIENTS (as of ' + fmtDateDMY(todayStr()) + ')');
  const pendingList = allPendingClientsWithAmounts();
  if(pendingList.length){
    doc.autoTable({
      startY:y, margin:{left:margin, right:margin}, theme:'striped',
      styles:{fontSize:9, cellPadding:3},
      headStyles:{fillColor:[217,119,6], textColor:255},
      alternateRowStyles:{fillColor:[255,251,235]},
      head:[['Client','Amount Pending']],
      body:pendingList.map(c => [c.name, fmt(c.net)]),
      foot:[[{content:'Total Pending', styles:{fontStyle:'bold'}}, {content:fmt(totalPendingAllClients()), styles:{fontStyle:'bold'}}]],
      footStyles:{fillColor:[217,119,6], textColor:255, fontStyle:'bold'},
      columnStyles:{1:{halign:'right'}}
    });
    y = doc.lastAutoTable.finalY + 14;
  } else { smallNote('No pending amounts from clients.'); }
  sectionHeading('PAYABLE TO VENDORS (as of ' + fmtDateDMY(todayStr()) + ')');
  const payableList = allPayableVendorsWithAmounts();
  if(payableList.length){
    doc.autoTable({
      startY:y, margin:{left:margin, right:margin}, theme:'striped',
      styles:{fontSize:9, cellPadding:3},
      headStyles:{fillColor:[220,38,38], textColor:255},
      alternateRowStyles:{fillColor:[254,242,242]},
      head:[['Vendor','Amount Payable']],
      body:payableList.map(v => [v.name, fmt(v.net)]),
      foot:[[{content:'Total Payable', styles:{fontStyle:'bold'}}, {content:fmt(totalPayableAllVendors()), styles:{fontStyle:'bold'}}]],
      footStyles:{fillColor:[220,38,38], textColor:255, fontStyle:'bold'},
      columnStyles:{1:{halign:'right'}}
    });
    y = doc.lastAutoTable.finalY + 14;
  } else { smallNote('No amounts payable to vendors.'); }
  sectionHeading('STOCK ON HAND (live)');
  if(stock.length){
    doc.autoTable({
      startY:y, margin:{left:margin, right:margin}, theme:'striped',
      styles:{fontSize:9, cellPadding:3},
      headStyles:{fillColor:[55,65,81], textColor:255},
      head:[['Item','Qty','Unit','Avg Rate','Value']],
      body:stock.filter(s=>s.is_active).map(s=>[s.name, fmtQty(s.on_hand_qty), s.unit, fmt(s.avg_rate), fmt(s.on_hand_value)]),
      foot:[[{content:'Total Stock Value', colSpan:4, styles:{halign:'right', fontStyle:'bold'}}, {content:fmt(stockValue), styles:{fontStyle:'bold'}}]],
      footStyles:{fillColor:[240,240,240], textColor:[40,40,40], fontStyle:'bold'},
      columnStyles:{1:{halign:'right'},3:{halign:'right'},4:{halign:'right'}}
    });
    y = doc.lastAutoTable.finalY + 14;
  } else { smallNote('No items yet.'); }
  sectionHeading('PRODUCTION IN PERIOD');
  if(d.prodInRange.length){
    doc.autoTable({
      startY:y, margin:{left:margin, right:margin}, theme:'striped',
      styles:{fontSize:8, cellPadding:3},
      headStyles:{fillColor:[55,65,81], textColor:255},
      head:[['Date','Produced','Qty','Consumed']],
      body:d.prodInRange.map(r=>{
        const consumed = (r.materials||[]).map(m=>`${m.item_name}: ${fmtQty(m.qty)} ${m.item_unit}`).join('; ');
        return [fmtDateDMY(r.date), r.produced_item_name, fmtQty(r.produced_qty)+' '+r.produced_item_unit, consumed || '-'];
      })
    });
    y = doc.lastAutoTable.finalY + 14;
  } else { smallNote('No production in this period.'); }
  sectionHeading('SALES — bills raised in period');
  const salesInRange = d.salesInRange.filter(e => (e.amount || 0) > 0);
  if(salesInRange.length){
    doc.autoTable({
      startY:y, margin:{left:margin, right:margin}, theme:'striped',
      styles:{fontSize:8, cellPadding:3},
      headStyles:{fillColor:[55,65,81], textColor:255},
      alternateRowStyles:{fillColor:[248,250,252]},
      head:[['Date','Client','Item','Qty','Rate','Status','Amount']],
      body:salesInRange.map(e=>{
        const s = saleStatus(e);
        const tag = e.isChallan ? ' (CH)' : '';
        return [fmtDateDMY(e.date), e.client||'-', (e.itemType||'-')+tag, e.qty?fmtQty(e.qty):'-', e.rate?fmt(e.rate):'-', s.toUpperCase(), fmt(e.amount)];
      }),
      columnStyles:{6:{halign:'right'}}
    });
    y = doc.lastAutoTable.finalY + 14;
  } else { smallNote('No sales in this period.'); }
  sectionHeading('MATERIAL SUPPLIED IN PERIOD (rate not yet decided)');
  const msInRange = materialSupplied.filter(e => e.date >= fromStr && e.date <= toStr);
  if(msInRange.length){
    doc.autoTable({
      startY:y, margin:{left:margin, right:margin}, theme:'striped',
      styles:{fontSize:8, cellPadding:3},
      headStyles:{fillColor:[8,145,178], textColor:255},
      alternateRowStyles:{fillColor:[236,254,255]},
      head:[['Date','Client','Item','Qty','Challan']],
      body:msInRange.map(e=>[fmtDateDMY(e.date), e.client||'-', e.itemType||'-', fmtQty(e.qty||0), e.challanNo||'-']),
      columnStyles:{3:{halign:'right'}}
    });
    y = doc.lastAutoTable.finalY + 14;
  } else { smallNote('No material-supplied entries in this period.'); }
  sectionHeading('PURCHASES — bills received in period');
  if(d.purchasesInRange.length){
    doc.autoTable({
      startY:y, margin:{left:margin, right:margin}, theme:'striped',
      styles:{fontSize:8, cellPadding:3},
      headStyles:{fillColor:[55,65,81], textColor:255},
      alternateRowStyles:{fillColor:[248,250,252]},
      head:[['Date','Vendor','Item','Qty','Rate','Status','Amount']],
      body:d.purchasesInRange.map(e=>{
        const s = purchaseStatus(e);
        const itemLabel = e.itemType || (e.note || 'Non-itemized');
        return [fmtDateDMY(e.date), e.vendor||'-', itemLabel, e.qty?fmtQty(e.qty):'-', e.rate?fmt(e.rate):'-', s.toUpperCase(), fmt(e.amount)];
      }),
      columnStyles:{6:{halign:'right'}}
    });
    y = doc.lastAutoTable.finalY + 14;
  } else { smallNote('No purchases in this period.'); }
  sectionHeading('PAYMENTS RECEIVED (from clients)');
  const saleIds = new Set(entries.filter(e=>e.kind==='sale').map(e=>e.id));
  const paymentsInRange = d.salePayments.filter(p => saleIds.has(p.entryId) && (accountFilter==='all' || p.method!=='bank' || p.bankAccountId===accountFilter));
  if(paymentsInRange.length){
    doc.autoTable({
      startY:y, margin:{left:margin, right:margin}, theme:'striped',
      styles:{fontSize:8, cellPadding:3},
      headStyles:{fillColor:[55,65,81], textColor:255},
      alternateRowStyles:{fillColor:[248,250,252]},
      head:[['Date','Client','Method','Bank account','Amount']],
      body:paymentsInRange.map(p=>{
        const e = entries.find(x=>x.id===p.entryId);
        return [fmtDateDMY(p.date), e?e.client:'-', p.method, (p.method==='bank'? accountName(p.bankAccountId) : '-'), fmt(p.amount)];
      }),
      columnStyles:{4:{halign:'right'}}
    });
    y = doc.lastAutoTable.finalY + 14;
  } else { smallNote('No client payments in this period.'); }
  sectionHeading('PAYMENTS MADE (to vendors)');
  const purchIds = new Set(entries.filter(e=>e.kind==='purchase').map(e=>e.id));
  const purchPaysInRange = d.purchPayments.filter(p => purchIds.has(p.entryId) && (accountFilter==='all' || p.method!=='bank' || p.bankAccountId===accountFilter));
  if(purchPaysInRange.length){
    doc.autoTable({
      startY:y, margin:{left:margin, right:margin}, theme:'striped',
      styles:{fontSize:8, cellPadding:3},
      headStyles:{fillColor:[55,65,81], textColor:255},
      alternateRowStyles:{fillColor:[248,250,252]},
      head:[['Date','Vendor','Method','Bank account','Amount']],
      body:purchPaysInRange.map(p=>{
        const e = entries.find(x=>x.id===p.entryId);
        return [fmtDateDMY(p.date), e?e.vendor:'-', p.method, (p.method==='bank'? accountName(p.bankAccountId) : '-'), fmt(p.amount)];
      }),
      columnStyles:{4:{halign:'right'}}
    });
    y = doc.lastAutoTable.finalY + 14;
  } else { smallNote('No vendor payments in this period.'); }
  sectionHeading('EXPENSES');
  const expensesInRange = d.expInRange.filter(e => accountFilter==='all' || e.method!=='bank' || e.bankAccountId===accountFilter);
  if(expensesInRange.length){
    doc.autoTable({
      startY:y, margin:{left:margin, right:margin}, theme:'striped',
      styles:{fontSize:8, cellPadding:3},
      headStyles:{fillColor:[55,65,81], textColor:255},
      alternateRowStyles:{fillColor:[248,250,252]},
      head:[['Date','Type','Method','Bank account','Note','Amount']],
      body:expensesInRange.map(e=>[fmtDateDMY(e.date), e.expenseType||'-', e.method==='cash'?'Cash':'Bank',
                 (e.method==='bank'? accountName(e.bankAccountId) : '-'),
                 (e.note||'-')+(e.linkedSaleId?' (from sale #'+e.linkedSaleId+')':''),
                 fmt(e.amount)]),
      columnStyles:{5:{halign:'right'}}
    });
    y = doc.lastAutoTable.finalY + 14;
  } else { smallNote('No expenses in this period.'); }
  if(d.bankLedgerInRange.length){
    sectionHeading('BANK BOOK');
    const showBal = (accountFilter !== 'all');
    doc.autoTable({
      startY:y, margin:{left:margin, right:margin}, theme:'striped',
      styles:{fontSize:8, cellPadding:3},
      headStyles:{fillColor:[55,65,81], textColor:255},
      alternateRowStyles:{fillColor:[248,250,252]},
      head:[['Date','Description','Credit','Debit', ...(showBal?['Balance']:[])]],
      body:d.bankLedgerInRange.map(r=>{
        const base = [fmtDateDMY(r.date), r.label, r.credit>0?fmt(r.credit):'-', r.debit>0?fmt(r.debit):'-'];
        if(showBal) base.push(fmt(r.balance));
        return base;
      }),
      columnStyles: showBal ? {2:{halign:'right'},3:{halign:'right'},4:{halign:'right', fontStyle:'bold'}} : {2:{halign:'right'},3:{halign:'right'}}
    });
  }
  const pageCount = doc.internal.getNumberOfPages();
  for(let i=1;i<=pageCount;i++){
    doc.setPage(i);
    doc.setDrawColor(230,232,236); doc.line(margin, ph-12, pw-margin, ph-12);
    doc.setFontSize(7); doc.setTextColor(150,150,150); doc.setFont(undefined,'normal');
    doc.text('Generated ' + new Date().toLocaleString(), margin, ph-7);
    doc.text('Page ' + i + ' of ' + pageCount, pw - margin, ph-7, {align:'right'});
  }
  const blob = doc.output('blob');
  return { blob: blob, filename: 'Business-Report-' + fromStr + (toStr!==fromStr?'_to_'+toStr:'') + '.pdf' };
}
async function downloadReport(){
  const result = await buildReportPdfBlob();
  await saveOrDownload(result.blob, result.filename);
}
async function viewReport(){
  const result = await buildReportPdfBlob();
  const url = URL.createObjectURL(result.blob);
  const win = window.open(url, '_blank');
  if(!win){ alert('Pop-up was blocked. Please allow pop-ups for this site, or use the Download PDF button.'); }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function downloadExcel(){
  const { fromStr, toStr } = readRange();
  const accountFilter = document.getElementById('reportBankAccount').value || 'all';
  const d = buildReportDataset(fromStr, toStr, accountFilter);
  const acctLabel = accountFilter==='all' ? 'All accounts (combined)' : accountName(accountFilter);
  const billedSales = d.salesInRange.reduce((s,e)=>s+(e.amount || 0), 0);
  const moneyReceived = d.cashSale + d.bankSale;
  const billedPurch = d.purchasesInRange.reduce((s,e)=>s+e.amount, 0);
  const moneyPaidOut = d.cashPurch + d.bankPurch + d.vAdvCash + d.vAdvBank + d.cashExp + d.bankExp;
  const netMovement = Math.round((moneyReceived - moneyPaidOut)*100)/100;
  const receivable = totalPendingAllClients();
  const payable = totalPayableAllVendors();
  const acctBalancesX = perAccountBalances(fromStr, toStr);
  const activeAccts = acctBalancesX.filter(a=>a.is_active);
  const totalBankClosing = Math.round(activeAccts.reduce((s,a)=>s+a.closing,0)*100)/100;
  const totalBankOpening = Math.round(activeAccts.reduce((s,a)=>s+a.opening,0)*100)/100;
  const cashPlusBank = Math.round((d.closingCash + totalBankClosing)*100)/100;
  const stockValue = stock.filter(s=>s.is_active).reduce((s,it)=>s+(it.on_hand_value||0),0);
  const summaryRows = [
    ['SHREE BALAJI ASSOCIATES'],
    ['Near Om Sai Biofuels Bargawan Odgadi Distt. Singrauli'],
    ['GSTIN/UIN: 23AEPFS7841N1Z9'],
    [],
    ['Report', fromStr===toStr ? fmtDateDMY(fromStr) : fmtDateDMY(fromStr)+' to '+fmtDateDMY(toStr)],
    ['Bank account', acctLabel],
    [],
    ['FOR THE PERIOD'],
    ['Sales billed', billedSales],
    ['Money received (sales)', moneyReceived],
    ['Purchases billed', billedPurch],
    ['Money paid out (purchases + expenses + advances)', moneyPaidOut],
    ['Net Movement (In − Out)', netMovement],
    [],
    ['RIGHT NOW (as of ' + fmtDateDMY(todayStr()) + ')'],
    ['Receivable from clients', receivable],
    ['Payable to vendors', payable],
    ['Cash on hand', d.closingCash],
  ];
  acctBalancesX.forEach(a => { const tag = a.is_active ? '' : ' (closed)'; summaryRows.push([a.name + tag, a.closing]); });
  summaryRows.push(['Total Bank (closing)', totalBankClosing]);
  summaryRows.push(['Cash + Bank (closing)', cashPlusBank]);
  summaryRows.push(['Stock value on hand', stockValue]);
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [{wch:36},{wch:18}];
  const flowSheet = XLSX.utils.aoa_to_sheet([
    ['FLOW'],
    [fromStr===toStr ? fmtDateDMY(fromStr) : fmtDateDMY(fromStr)+' to '+fmtDateDMY(toStr)],
    [],
    ['Group','Item','Amount'],
    ['MONEY IN','Sales — cash received', d.cashSale],
    ['MONEY IN','Sales — bank received', d.bankSale],
    ['','Total Money In', moneyReceived],
    [],
    ['MONEY OUT','Purchases — cash paid', d.cashPurch],
    ['MONEY OUT','Purchases — bank paid', d.bankPurch],
    ['MONEY OUT','Vendor advances — cash', d.vAdvCash],
    ['MONEY OUT','Vendor advances — bank', d.vAdvBank],
    ['MONEY OUT','Expenses — cash', d.cashExp],
    ['MONEY OUT','Expenses — bank', d.bankExp],
    ['','Total Money Out', moneyPaidOut],
    [],
    ['','Net Movement', netMovement],
  ]);
  flowSheet['!cols'] = [{wch:14},{wch:36},{wch:16}];
  const balanceRows2 = [
    ['BALANCES'],
    ['as of ' + fmtDateDMY(todayStr())],
    [],
    ['Group','Item','Amount'],
    ['Owed to you','Receivable from clients', receivable],
    ['Owed by you','Payable to vendors', payable],
    ['Cash','Cash on hand', d.closingCash],
  ];
  acctBalancesX.forEach(a => { const tag = a.is_active ? '' : ' (closed)'; balanceRows2.push(['Bank', a.name + tag, a.closing]); });
  balanceRows2.push(['Bank','Total Bank (closing)', totalBankClosing]);
  balanceRows2.push(['','Cash + Bank (closing)', cashPlusBank]);
  balanceRows2.push(['Stock','Stock value on hand', stockValue]);
  const balancesSheet = XLSX.utils.aoa_to_sheet(balanceRows2);
  balancesSheet['!cols'] = [{wch:14},{wch:36},{wch:16}];
  const pendingClients = allPendingClientsWithAmounts();
  const pendingSheet = XLSX.utils.aoa_to_sheet([
    ['Pending Clients (as of ' + fmtDateDMY(todayStr()) + ')'], [],
    ['Client', 'Amount Pending'],
    ...pendingClients.map(c => [c.name, c.net]),
    [],
    ['Total Pending', totalPendingAllClients()]
  ]);
  pendingSheet['!cols'] = [{wch:28},{wch:16}];
  const payableVendors = allPayableVendorsWithAmounts();
  const payableSheet = XLSX.utils.aoa_to_sheet([
    ['Payable to Vendors (as of ' + fmtDateDMY(todayStr()) + ')'], [],
    ['Vendor', 'Amount Payable'],
    ...payableVendors.map(v => [v.name, v.net]),
    [],
    ['Total Payable', totalPayableAllVendors()]
  ]);
  payableSheet['!cols'] = [{wch:28},{wch:16}];
  const stockSheet = XLSX.utils.aoa_to_sheet([
    ['Stock on Hand (live)'], [],
    ['Item','Kind','On hand','Unit','Avg Rate','Value'],
    ...stock.filter(s=>s.is_active).map(s=>[s.name, s.kind, s.on_hand_qty, s.unit, s.avg_rate, s.on_hand_value])
  ]);
  stockSheet['!cols'] = [{wch:20},{wch:12},{wch:14},{wch:10},{wch:12},{wch:14}];
  const msInRange = materialSupplied.filter(e => e.date >= fromStr && e.date <= toStr);
  const msSheet = XLSX.utils.aoa_to_sheet([
    ['Material Supplied (rate not yet decided)'], [],
    ['Date','Client','Item','Qty','Challan','Note'],
    ...msInRange.map(e=>[fmtDateDMY(e.date), e.client||'', e.itemType||'', e.qty||0, e.challanNo||'', e.note||''])
  ]);
  msSheet['!cols'] = [{wch:12},{wch:20},{wch:18},{wch:10},{wch:14},{wch:24}];
  const prodSheet = XLSX.utils.aoa_to_sheet([
    ['Production in Period'], [],
    ['Date','Produced item','Qty','Unit','Consumed'],
    ...d.prodInRange.map(r=>{
      const consumed = (r.materials||[]).map(m=>`${m.item_name}: ${m.qty} ${m.item_unit}`).join('; ');
      return [fmtDateDMY(r.date), r.produced_item_name, r.produced_qty, r.produced_item_unit, consumed];
    })
  ]);
  prodSheet['!cols'] = [{wch:12},{wch:18},{wch:12},{wch:10},{wch:40}];
  const salesSheet = XLSX.utils.aoa_to_sheet([
    ['Sales'], [],
    ['Date','Client','Item','Qty','Rate','Challan?','Status','Amount'],
    ...d.salesInRange.filter(e=>(e.amount||0)>0).map(e=>[fmtDateDMY(e.date), e.client||'', e.itemType||'', e.qty||'', e.rate||'', e.isChallan?'Yes':'', saleStatus(e), e.amount])
  ]);
  salesSheet['!cols'] = [{wch:12},{wch:20},{wch:18},{wch:10},{wch:10},{wch:10},{wch:10},{wch:14}];
  const purchSheet = XLSX.utils.aoa_to_sheet([
    ['Purchases'], [],
    ['Date','Vendor','Item','Qty','Rate','Status','Amount'],
    ...d.purchasesInRange.map(e=>[fmtDateDMY(e.date), e.vendor||'', e.itemType||(e.note||''), e.qty||'', e.rate||'', purchaseStatus(e), e.amount])
  ]);
  purchSheet['!cols'] = [{wch:12},{wch:20},{wch:18},{wch:10},{wch:10},{wch:10},{wch:14}];
  const saleIds = new Set(entries.filter(e=>e.kind==='sale').map(e=>e.id));
  const paymentsInRange = d.salePayments.filter(p => saleIds.has(p.entryId) && (accountFilter==='all' || p.method!=='bank' || p.bankAccountId===accountFilter));
  const paymentsSheet = XLSX.utils.aoa_to_sheet([
    ['Client Payments Received'], [],
    ['Date','Client','Method','Bank account','Amount'],
    ...paymentsInRange.map(p=>{
      const e = entries.find(x=>x.id===p.entryId);
      return [fmtDateDMY(p.date), e?e.client:'', p.method, p.method==='bank'?accountName(p.bankAccountId):'', p.amount];
    })
  ]);
  paymentsSheet['!cols'] = [{wch:12},{wch:20},{wch:12},{wch:18},{wch:14}];
  const purchIds = new Set(entries.filter(e=>e.kind==='purchase').map(e=>e.id));
  const purchPaysInRange = d.purchPayments.filter(p => purchIds.has(p.entryId) && (accountFilter==='all' || p.method!=='bank' || p.bankAccountId===accountFilter));
  const purchPaysSheet = XLSX.utils.aoa_to_sheet([
    ['Vendor Payments Made'], [],
    ['Date','Vendor','Method','Bank account','Amount'],
    ...purchPaysInRange.map(p=>{
      const e = entries.find(x=>x.id===p.entryId);
      return [fmtDateDMY(p.date), e?e.vendor:'', p.method, p.method==='bank'?accountName(p.bankAccountId):'', p.amount];
    })
  ]);
  purchPaysSheet['!cols'] = [{wch:12},{wch:20},{wch:12},{wch:18},{wch:14}];
  const expensesInRange = d.expInRange.filter(e => accountFilter==='all' || e.method!=='bank' || e.bankAccountId===accountFilter);
  const expSheet = XLSX.utils.aoa_to_sheet([
    ['Expenses'], [],
    ['Date','Type','Method','Bank account','Note','Amount'],
    ...expensesInRange.map(e=>[fmtDateDMY(e.date), e.expenseType||'', e.method, e.method==='bank'?accountName(e.bankAccountId):'', e.note||'', e.amount])
  ]);
  expSheet['!cols'] = [{wch:12},{wch:20},{wch:10},{wch:18},{wch:24},{wch:14}];
  const bankSheet = XLSX.utils.aoa_to_sheet([
    ['Bank Book'], [],
    ['Date','Description','Credit','Debit','Balance'],
    ...d.bankLedgerInRange.map(r=>[fmtDateDMY(r.date), r.label, r.credit||0, r.debit||0, r.balance])
  ]);
  bankSheet['!cols'] = [{wch:12},{wch:36},{wch:14},{wch:14},{wch:14}];
  const bankBalRows = [
    ['Bank Account Balances'],
    [fromStr===toStr ? fmtDateDMY(fromStr) : fmtDateDMY(fromStr)+' to '+fmtDateDMY(toStr)],
    [],
    ['Account','Opening','Closing','Net Change'],
  ];
  acctBalancesX.forEach(a => { const tag = a.is_active ? '' : ' (closed)'; bankBalRows.push([a.name + tag, a.opening, a.closing, Math.round((a.closing - a.opening)*100)/100]); });
  bankBalRows.push(['Total', totalBankOpening, totalBankClosing, Math.round((totalBankClosing - totalBankOpening)*100)/100]);
  bankBalRows.push([]);
  bankBalRows.push(['Cash on hand', '', d.closingCash, '']);
  bankBalRows.push(['Cash + Bank (closing)', '', cashPlusBank, '']);
  const bankBalSheet = XLSX.utils.aoa_to_sheet(bankBalRows);
  bankBalSheet['!cols'] = [{wch:24},{wch:14},{wch:14},{wch:14}];
  const vendAdjSheet = XLSX.utils.aoa_to_sheet([
    ['Vendor Adjustments (all)'], [],
    ['Date','Vendor','Type','Amount','Note'],
    ...vendorAdjustments.map(a => [fmtDateDMY(a.date), a.vendor, a.adjType, a.amount, a.note||''])
  ]);
  vendAdjSheet['!cols'] = [{wch:12},{wch:24},{wch:18},{wch:14},{wch:30}];
  const vendAdvSheet = XLSX.utils.aoa_to_sheet([
    ['Vendor Advances (all)'], [],
    ['Date','Vendor','Method','Amount','Note'],
    ...vendorAdvances.map(a => [fmtDateDMY(a.date), a.vendor, a.method, a.amount, a.note||''])
  ]);
  vendAdvSheet['!cols'] = [{wch:12},{wch:24},{wch:12},{wch:14},{wch:30}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');
  XLSX.utils.book_append_sheet(wb, flowSheet, 'Flow');
  XLSX.utils.book_append_sheet(wb, balancesSheet, 'Balances');
  XLSX.utils.book_append_sheet(wb, pendingSheet, 'Pending Clients');
  XLSX.utils.book_append_sheet(wb, payableSheet, 'Payable Vendors');
  XLSX.utils.book_append_sheet(wb, stockSheet, 'Stock');
  XLSX.utils.book_append_sheet(wb, msSheet, 'Material Supplied');
  XLSX.utils.book_append_sheet(wb, prodSheet, 'Production');
  XLSX.utils.book_append_sheet(wb, salesSheet, 'Sales');
  XLSX.utils.book_append_sheet(wb, purchSheet, 'Purchases');
  XLSX.utils.book_append_sheet(wb, paymentsSheet, 'Client Payments');
  XLSX.utils.book_append_sheet(wb, purchPaysSheet, 'Vendor Payments');
  XLSX.utils.book_append_sheet(wb, expSheet, 'Expenses');
  XLSX.utils.book_append_sheet(wb, bankSheet, 'Bank Book');
  XLSX.utils.book_append_sheet(wb, bankBalSheet, 'Bank Balances');
  XLSX.utils.book_append_sheet(wb, vendAdjSheet, 'Vendor Adjustments');
  XLSX.utils.book_append_sheet(wb, vendAdvSheet, 'Vendor Advances');
  const wbArray = XLSX.write(wb, { type:'array', bookType:'xlsx' });
  const blob = new Blob([wbArray], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await saveOrDownload(blob, 'Business-Report-' + fromStr + (toStr!==fromStr?'_to_'+toStr:'') + '.xlsx');
}

/* ============================= TALLY ============================= */
function xmlEscape(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function tallyDate(iso){ return (iso||'').replace(/-/g,''); }
function ledgerXml(name, parent){ return `<LEDGER NAME="${xmlEscape(name)}" ACTION="Create"><NAME>${xmlEscape(name)}</NAME><PARENT>${xmlEscape(parent)}</PARENT><OPENINGBALANCE>0</OPENINGBALANCE></LEDGER>`; }
function entryXml(ledgerName, amount, isDebit){ const amt = isDebit ? -Math.abs(amount) : Math.abs(amount); return `<ALLLEDGERENTRIES.LIST><LEDGERNAME>${xmlEscape(ledgerName)}</LEDGERNAME><ISDEEMEDPOSITIVE>${isDebit?'Yes':'No'}</ISDEEMEDPOSITIVE><AMOUNT>${amt.toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>`; }
function voucherXml(vchType, date, narration, drLedger, drAmount, crLedger, crAmount){ return `<VOUCHER VCHTYPE="${xmlEscape(vchType)}" ACTION="Create"><DATE>${tallyDate(date)}</DATE><EFFECTIVEDATE>${tallyDate(date)}</EFFECTIVEDATE><VOUCHERTYPENAME>${xmlEscape(vchType)}</VOUCHERTYPENAME><NARRATION>${xmlEscape(narration)}</NARRATION>${entryXml(drLedger, drAmount, true)}${entryXml(crLedger, crAmount, false)}</VOUCHER>`; }
async function downloadTally(){
  const { fromStr, toStr } = readRange();
  const accountFilter = document.getElementById('reportBankAccount').value || 'all';
  const singleBankLedger = document.getElementById('tallyBankLedger').value.trim() || 'Bank Account';
  const salesLedger = document.getElementById('tallySalesLedger').value.trim() || 'Sales Account';
  const purchaseLedger = document.getElementById('tallyPurchaseLedger').value.trim() || 'Purchase Account';
  const inRange = d => d >= fromStr && d <= toStr;
  const bankLedgerFor = () => accountFilter==='all' ? singleBankLedger : accountName(accountFilter);
  const clients = new Set(); entries.forEach(e=>{ if(e.kind==='sale' && e.client) clients.add(e.client); });
  advances.forEach(a=>clients.add(a.client)); adjustments.forEach(a=>clients.add(a.client));
  const vendors = new Set(); entries.forEach(e=>{ if(e.kind==='purchase' && e.vendor) vendors.add(e.vendor); });
  vendorAdjustments.forEach(a=>vendors.add(a.vendor));
  vendorAdvances.forEach(a=>vendors.add(a.vendor));
  const expenseTypesUsed = new Set(entries.filter(e=>e.kind==='expense' && inRange(e.date)).map(e=>e.expenseType||'Expense'));
  let masters = ledgerXml(salesLedger, 'Sales Accounts') + ledgerXml(purchaseLedger, 'Purchase Accounts') + ledgerXml(singleBankLedger, 'Bank Accounts') + ledgerXml('Advances from Customers', 'Current Liabilities') + ledgerXml('Advances to Vendors', 'Current Assets');
  clients.forEach(c => masters += ledgerXml(c, 'Sundry Debtors'));
  vendors.forEach(v => masters += ledgerXml(v, 'Sundry Creditors'));
  expenseTypesUsed.forEach(t => masters += ledgerXml(t, 'Indirect Expenses'));
  let vouchers = '';
  entries.filter(e=>e.kind==='sale' && inRange(e.date) && !e.isChallan && (e.amount||0) > 0).forEach(e=>{ vouchers += voucherXml('Sales', e.date, `Sale #${e.id}`, e.client, e.amount, salesLedger, e.amount); });
  entries.filter(e=>e.kind==='sale' && inRange(e.date) && e.isChallan && (e.amount||0) > 0).forEach(e=>{ vouchers += voucherXml('Sales', e.date, `Challan ${e.challanNo||e.id}`, e.client, e.amount, salesLedger, e.amount); });
  entries.filter(e=>e.kind==='purchase' && inRange(e.date)).forEach(e=>{ vouchers += voucherXml('Purchase', e.date, `Purchase #${e.id}`, purchaseLedger, e.amount, e.vendor, e.amount); });
  const saleIds = new Set(entries.filter(e=>e.kind==='sale').map(e=>e.id));
  payments.filter(p=>inRange(p.date) && saleIds.has(p.entryId) && (p.method==='cash'||p.method==='bank')).forEach(p=>{ const e = entries.find(x=>x.id===p.entryId); const dr = p.method==='cash' ? 'Cash' : bankLedgerFor(); vouchers += voucherXml('Receipt', p.date, `Receipt #${p.entryId}`, dr, p.amount, e?e.client:'Sundry Debtors', p.amount); });
  const purchIds = new Set(entries.filter(e=>e.kind==='purchase').map(e=>e.id));
  payments.filter(p=>inRange(p.date) && purchIds.has(p.entryId) && (p.method==='cash'||p.method==='bank')).forEach(p=>{ const e = entries.find(x=>x.id===p.entryId); const cr = p.method==='cash' ? 'Cash' : bankLedgerFor(); vouchers += voucherXml('Payment', p.date, `Vendor Payment #${p.entryId}`, e?e.vendor:'Sundry Creditors', p.amount, cr, p.amount); });
  entries.filter(e=>e.kind==='expense' && inRange(e.date)).forEach(e=>{ const cr = e.method==='cash' ? 'Cash' : bankLedgerFor(); vouchers += voucherXml('Payment', e.date, `Expense #${e.id}`, e.expenseType||'Expense', e.amount, cr, e.amount); });
  const xml = `<?xml version="1.0" encoding="UTF-8"?><ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC><REQUESTDATA><TALLYMESSAGE xmlns:UDF="TallyUDF">${masters}</TALLYMESSAGE><TALLYMESSAGE xmlns:UDF="TallyUDF">${vouchers}</TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
  const blob = new Blob([xml], { type: 'text/xml' });
  await saveOrDownload(blob, 'Tally-Import-' + fromStr + (toStr!==fromStr?'_to_'+toStr:'') + '.xml');
}

async function saveOrDownload(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
