/* ============================= STOCK BOOK DELETE ============================= */
async function deleteStockBookRow(movId, source, refId, itemName, dateStr){
  if(!isAdmin()){ alert('Only an admin can delete stock book rows.'); return; }
  let msg = 'Delete this stock book row?\n\n';
  msg += 'Date: ' + (dateStr || '') + '\n';
  msg += 'Item: ' + (itemName || '') + '\n';
  msg += 'Type: ' + (source || '') + (refId != null ? ' #' + refId : '') + '\n\n';
  if(source === 'sale' || source === 'purchase'){
    msg += 'This will ALSO delete the linked ' + source + ' entry, its payments, and all related stock movements.';
  } else if(source === 'production_in' || source === 'production_out'){
    msg += 'This will ALSO delete the entire production run and all materials consumed/produced in it.';
  } else {
    msg += 'This will remove this manual adjustment only.';
  }
  if(!confirm(msg)) return;
  try{
    const res = await fetch('/api/stock-movements/' + movId, { method:'DELETE' });
    if(!res.ok){ const err = await res.json().catch(()=>({})); alert('Could not delete: ' + (err.error || 'server error')); return; }
  }catch(err){ alert('Could not reach the server: ' + (err&&err.message?err.message:err)); return; }
  await load();
}

/* ============================= S/P BOOK (combined Sale + Purchase) ============================= */
function setSPRange(mode){
  const today = todayStr();
  let from = today, to = today;
  if(mode === 'yesterday'){ from = to = addDays(today, -1); }
  else if(mode === 'week'){ from = addDays(today, -6); }
  else if(mode === 'month'){ from = today.slice(0,8) + '01'; }
  else if(mode === 'all'){ document.getElementById('spFrom').value = ''; document.getElementById('spTo').value = ''; renderSP(); return; }
  document.getElementById('spFrom').value = from;
  document.getElementById('spTo').value = to;
  renderSP();
}
function renderSP(){
  const fromEl = document.getElementById('spFrom');
  const toEl = document.getElementById('spTo');
  if(fromEl && toEl && !fromEl.value && !toEl.value){ fromEl.value = todayStr(); toEl.value = todayStr(); }
  renderSaleBook();
  renderPurchBook();
}
function renderSaleBook(){
  const fromEl = document.getElementById('spFrom');
  const toEl = document.getElementById('spTo');
  if(!fromEl || !toEl) return;
  if(!fromEl.value && !toEl.value){ fromEl.value = todayStr(); toEl.value = todayStr(); }
  const fromStr = fromEl.value || '';
  const toStr = toEl.value || '9999-12-31';
  const q = (document.getElementById('saleBookSearch').value || '').trim().toLowerCase();
  let list = entries.filter(e => e.kind === 'sale');
  if(fromStr) list = list.filter(e => e.date >= fromStr);
  if(toStr) list = list.filter(e => e.date <= toStr);
  if(q) list = list.filter(e =>
    (e.client||'').toLowerCase().includes(q) ||
    (e.itemType||'').toLowerCase().includes(q) ||
    (e.note||'').toLowerCase().includes(q) ||
    (e.challanNo||'').toLowerCase().includes(q)
  );
  list = list.slice().sort((a,b) => a.date === b.date ? a.id - b.id : a.date.localeCompare(b.date));
  let running = 0;
  const body = document.getElementById('saleBookBody');
  if(!list.length){
    body.innerHTML = '<tr><td colspan="9" class="empty">No sales in this range</td></tr>';
    document.getElementById('saleBookCount').textContent = '0';
    document.getElementById('saleBookTotal').textContent = fmt(0);
    return;
  }
  body.innerHTML = list.map(e => {
    const amt = e.amount || 0;
    running += amt;
    const st = saleStatus(e);
    const tag = e.isChallan ? (amt > 0 ? 'Challan' : 'Material') : st;
    const delBtn = isAdmin()
      ? `<button class="del" title="Delete sale" onclick="delEntry(${e.id})">✕</button>`
      : '';
    return `<tr>
      <td>${fmtDateDMY(e.date)}</td>
      <td>${escapeAttr(e.client||'-')}</td>
      <td>${escapeAttr(e.itemType||'-')}${e.challanNo ? ' <span class="badge badge-challan">'+escapeAttr(e.challanNo)+'</span>' : ''}</td>
      <td style="text-align:right;">${e.qty != null ? fmtQty(e.qty) : '-'}</td>
      <td style="text-align:right;">${e.rate != null ? fmt(e.rate) : '-'}</td>
      <td><span class="badge badge-${st}">${tag}</span></td>
      <td style="text-align:right;font-weight:700;">${fmt(amt)}</td>
      <td style="text-align:right;">${fmt(running)}</td>
      <td>${delBtn}</td></tr>`;
  }).join('');
  document.getElementById('saleBookCount').textContent = String(list.length);
  document.getElementById('saleBookTotal').textContent = fmt(running);
}

function renderPurchBook(){
  const fromEl = document.getElementById('spFrom');
  const toEl = document.getElementById('spTo');
  if(!fromEl || !toEl) return;
  if(!fromEl.value && !toEl.value){ fromEl.value = todayStr(); toEl.value = todayStr(); }
  const fromStr = fromEl.value || '';
  const toStr = toEl.value || '9999-12-31';
  const q = (document.getElementById('purchBookSearch').value || '').trim().toLowerCase();
  let list = entries.filter(e => e.kind === 'purchase');
  if(fromStr) list = list.filter(e => e.date >= fromStr);
  if(toStr) list = list.filter(e => e.date <= toStr);
  if(q) list = list.filter(e =>
    (e.vendor||'').toLowerCase().includes(q) ||
    (e.itemType||'').toLowerCase().includes(q) ||
    (e.note||'').toLowerCase().includes(q)
  );
  list = list.slice().sort((a,b) => a.date === b.date ? a.id - b.id : a.date.localeCompare(b.date));
  let running = 0;
  const body = document.getElementById('purchBookBody');
  if(!list.length){
    body.innerHTML = '<tr><td colspan="9" class="empty">No purchases in this range</td></tr>';
    document.getElementById('purchBookCount').textContent = '0';
    document.getElementById('purchBookTotal').textContent = fmt(0);
    return;
  }
  body.innerHTML = list.map(e => {
    const amt = e.amount || 0;
    running += amt;
    const st = purchaseStatus(e);
    const itemLabel = e.itemType || e.note || 'Non-itemized';
    const delBtn = isAdmin()
      ? `<button class="del" title="Delete purchase" onclick="delEntry(${e.id})">✕</button>`
      : '';
    return `<tr>
      <td>${fmtDateDMY(e.date)}</td>
      <td>${escapeAttr(e.vendor||'-')}</td>
      <td>${escapeAttr(itemLabel)}</td>
      <td style="text-align:right;">${e.qty != null ? fmtQty(e.qty) : '-'}</td>
      <td style="text-align:right;">${e.rate != null ? fmt(e.rate) : '-'}</td>
      <td><span class="badge badge-${st}">${st}</span></td>
      <td style="text-align:right;font-weight:700;">${fmt(amt)}</td>
      <td style="text-align:right;">${fmt(running)}</td>
      <td>${delBtn}</td></tr>`;
  }).join('');
  document.getElementById('purchBookCount').textContent = String(list.length);
  document.getElementById('purchBookTotal').textContent = fmt(running);
}

/* ============================= BOOK ROW DELETE ============================= */
async function deleteBookRow(btn){
  if(!isAdmin()){ alert('Only an admin can delete.'); return; }
  const source = btn.getAttribute('data-source');
  const sourceId = parseInt(btn.getAttribute('data-source-id'), 10);
  const label = btn.getAttribute('data-label') || '';
  const amount = btn.getAttribute('data-amount') || '';
  const dateStr = btn.getAttribute('data-date') || '';

  if(source === 'opening'){ alert('Opening balance cannot be deleted. Edit it in the Bank tab config.'); return; }

  let msg = 'Delete this transaction?\n\n';
  if(dateStr) msg += 'Date: ' + dateStr + '\n';
  msg += 'Type: ' + label + '\n';
  if(amount) msg += 'Amount: ₹' + amount + '\n';
  msg += '\n';
  if(source === 'payment'){
    msg += 'This will also:\n• Restore the bill balance\n• Undo any linked loading/unloading expense';
  } else if(source === 'expense'){
    const e = entries.find(x => x.id === sourceId);
    if(e && e.linkedSaleId){
      alert('This is a loading/unloading expense linked to a sale payment.\n\nDelete the sale payment instead — it will automatically remove this expense too.');
      return;
    }
    msg += 'This will remove the expense entry and adjust the cash/bank balance.';
  } else if(source === 'advance'){
    msg += 'This will remove the client advance and update their ledger.';
  } else if(source === 'vendor_advance'){
    msg += 'This will remove the vendor advance and update their ledger.';
  } else if(source === 'bank_txn'){
    msg += 'This will remove the deposit/withdrawal and adjust the bank balance.';
  }

  if(!confirm(msg)) return;

  const map = {
    payment: '/api/payments/',
    expense: '/api/entries/',
    advance: '/api/advances/',
    vendor_advance: '/api/vendor-advances/',
    bank_txn: '/api/bank-transactions/'
  };
  const url = map[source] + sourceId;
  if(!url || url === 'undefined'){ alert('Unknown row type'); return; }

  try{
    const res = await fetch(url, { method:'DELETE' });
    if(!res.ok){ const err = await res.json().catch(()=>({})); alert('Could not delete: ' + (err.error || 'server error')); return; }
  }catch(err){ alert('Could not reach the server: ' + (err&&err.message?err.message:err)); return; }
  await load();
}
