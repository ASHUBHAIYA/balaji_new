/* ============================= ENTRY FORM ============================= */
function setKind(k){
  kind = k;
  document.getElementById('kindSale').classList.toggle('active', k==='sale');
  document.getElementById('kindPurchase').classList.toggle('active', k==='purchase');
  document.getElementById('kindProduction').classList.toggle('active', k==='production');
  document.getElementById('kindExpense').classList.toggle('active', k==='expense');
  document.getElementById('kindAdvance').classList.toggle('active', k==='advance');

  const isBill = (k==='sale' || k==='purchase');
  const isProd = (k==='production');
  const isItemizedPurchase = (k==='purchase' && purchaseMode==='itemized');
  const isNonItemizedPurchase = (k==='purchase' && purchaseMode==='nonitemized');

  document.getElementById('saleModeToggle').style.display = k==='sale' ? 'block' : 'none';
  document.getElementById('rateDecidedToggle').style.display = (k==='sale' && saleMode==='challan') ? 'block' : 'none';
  document.getElementById('purchaseModeToggle').style.display = k==='purchase' ? 'block' : 'none';
  document.getElementById('clientField').style.display = (k==='sale'||k==='advance') ? 'block' : 'none';
  document.getElementById('vendorField').style.display = k==='purchase' ? 'block' : 'none';
  document.getElementById('itemField').style.display = (k==='sale' || isItemizedPurchase) ? 'block' : 'none';
  document.getElementById('qtyRateField').style.display = (k==='sale' || isItemizedPurchase) ? 'grid' : 'none';
  document.getElementById('computedAmountField').style.display = (k==='sale' || isItemizedPurchase) ? 'block' : 'none';
  document.getElementById('prodFields').style.display = isProd ? 'block' : 'none';
  document.getElementById('expenseTypeField').style.display = k==='expense' ? 'block' : 'none';
  document.getElementById('amountField').style.display = (k==='expense'||k==='advance'||isNonItemizedPurchase) ? 'block' : 'none';
  document.getElementById('paidField').style.display = isBill ? 'block' : 'none';
  document.getElementById('methodField').style.display = (isBill || k==='expense' || k==='advance') ? 'block' : 'none';
  document.getElementById('methodAdvance').style.display = k==='sale' ? 'inline-flex' : 'none';
  document.getElementById('loadingField').style.display = k==='sale' ? 'block' : 'none';
  document.getElementById('paidLabel').textContent = (k==='sale') ? 'Paid by client?' : 'Paid to vendor?';
  document.getElementById('paidForcedHint').style.display = 'none';

  document.getElementById('qty').value = '';
  document.getElementById('rate').value = '';
  document.getElementById('itemType').value = '';
  document.getElementById('itemHint').textContent = '';
  document.getElementById('expenseType').value = '';
  document.getElementById('amount').value = '';
  loadingEnabled = false;
  const _loadBtn = document.getElementById('loadingToggleBtn');
  if(_loadBtn){ _loadBtn.classList.remove('on'); _loadBtn.textContent = 'Also paid loading/unloading expense?'; }
  document.getElementById('loadingInputs').style.display = 'none';
  document.getElementById('loadingBankAccountField').style.display = 'none';
  document.getElementById('prodProducedQty').value = '';
  document.getElementById('prodConsumedList').innerHTML = '';
  if(isProd){ addConsumedRow(); addConsumedRow(); }
  recalcAmount();

  method = null;
  document.getElementById('methodCash').classList.remove('active-yes');
  document.getElementById('methodBank').classList.remove('active-yes');
  document.getElementById('methodAdvance').classList.remove('active-adv');
  document.getElementById('bankAccountField').style.display = 'none';
  document.getElementById('advanceBalanceHint').style.display = 'none';

  splitEnabled = false;
  const _splitBtn = document.getElementById('splitToggleBtn');
  if(_splitBtn){ _splitBtn.classList.remove('on'); _splitBtn.textContent = 'Split this payment across cash / bank / advance?'; }
  document.getElementById('splitInputs').style.display = 'none';
  document.getElementById('methodCash').parentElement.style.display = 'flex';
  document.getElementById('splitBankAccountField').style.display = 'none';
  document.getElementById('splitToggleRow').style.display = k==='sale' ? 'block' : 'none';

  if(isProd){
    document.getElementById('methodLabel').textContent = 'Received via';
    document.getElementById('methodField').style.display = 'none';
    paidChoice = true;
  } else if(k==='expense' || k==='advance'){
    document.getElementById('methodLabel').textContent = k==='advance' ? 'Received via' : 'Paid via';
    document.getElementById('methodField').style.display = 'block';
    paidChoice = true;
  } else if(k==='sale'){
    setSaleMode(saleMode);
  } else {
    setPaid(true);
  }
}
function setSaleMode(mode){
  saleMode = mode;
  document.getElementById('saleBillBtn').classList.toggle('active-yes', mode==='bill');
  document.getElementById('saleChallanBtn').classList.toggle('active-adv', mode==='challan');
  document.getElementById('saleChallanBtn').classList.toggle('active-yes', mode==='challan');
  document.getElementById('rateDecidedToggle').style.display = (kind==='sale' && mode==='challan') ? 'block' : 'none';
  if(mode !== 'challan'){ setRateDecided(true); setPaid(true); }
  else { setRateDecided(challanRateDecided); setPaid(false); }
}
function setRateDecided(val){
  rateDecided = val;
  if(saleMode === 'challan' && kind === 'sale'){ challanRateDecided = val; }
  document.getElementById('rateYesBtn').classList.toggle('active-yes', val === true);
  document.getElementById('rateNoBtn').classList.toggle('active-no', val === false);
  const showRate = val === true;
  document.getElementById('rateField').style.display = showRate ? 'block' : 'none';
  document.getElementById('computedAmountField').style.display = showRate ? 'block' : 'none';
  document.getElementById('rateNoHint').style.display = showRate ? 'none' : 'block';
  if(!showRate && kind === 'sale' && saleMode === 'challan'){
    setPaid(false);
    document.getElementById('paidField').style.display = 'none';
    document.getElementById('paidForcedHint').style.display = 'block';
  } else if(kind === 'sale'){
    document.getElementById('paidField').style.display = 'block';
    document.getElementById('paidForcedHint').style.display = 'none';
  }
  recalcAmount();
}
function setPurchaseMode(mode){
  purchaseMode = mode;
  const isItemized = (mode === 'itemized');
  document.getElementById('purchItemizedBtn').classList.toggle('active-yes', isItemized);
  document.getElementById('purchNonItemizedBtn').classList.toggle('active-yes', !isItemized);
  if(kind === 'purchase'){
    document.getElementById('itemField').style.display = isItemized ? 'block' : 'none';
    document.getElementById('qtyRateField').style.display = isItemized ? 'grid' : 'none';
    document.getElementById('computedAmountField').style.display = isItemized ? 'block' : 'none';
    document.getElementById('amountField').style.display = isItemized ? 'none' : 'block';
  }
}
function setPaid(val){
  paidChoice = val;
  document.getElementById('paidYes').classList.toggle('active-yes', val===true);
  document.getElementById('paidNo').classList.toggle('active-no', val===false);
  document.getElementById('methodLabel').textContent = kind==='purchase' ? 'Paid via' : 'Received via';
  document.getElementById('methodField').style.display = val ? 'block' : 'none';
  document.getElementById('loadingField').style.display = (kind==='sale' && val) ? 'block' : 'none';
  if(!val){
    method = null;
    document.getElementById('methodCash').classList.remove('active-yes');
    document.getElementById('methodBank').classList.remove('active-yes');
    document.getElementById('methodAdvance').classList.remove('active-adv');
    document.getElementById('bankAccountField').style.display = 'none';
  }
}
function setMethod(m){
  method = m;
  document.getElementById('methodCash').classList.toggle('active-yes', m==='cash');
  document.getElementById('methodBank').classList.toggle('active-yes', m==='bank');
  document.getElementById('methodAdvance').classList.toggle('active-adv', m==='advance');
  document.getElementById('bankAccountField').style.display = (m==='bank') ? 'block' : 'none';
  const hint = document.getElementById('advanceBalanceHint');
  if(m==='advance'){
    const c = document.getElementById('client').value.trim();
    const bal = c ? clientAdvanceBalance(c) : 0;
    hint.textContent = c ? ('Available advance for ' + c + ': ' + fmt(bal)) : 'Enter a client first.';
    hint.style.display = 'block';
  } else { hint.style.display = 'none'; }
}
function toggleSplitFields(){
  splitEnabled = !splitEnabled;
  const btn = document.getElementById('splitToggleBtn');
  if(btn){ btn.classList.toggle('on', splitEnabled); btn.textContent = splitEnabled ? 'Split enabled — tap to turn off' : 'Split this payment across cash / bank / advance?'; }
  document.getElementById('splitInputs').style.display = splitEnabled ? 'block' : 'none';
  document.getElementById('methodCash').parentElement.style.display = splitEnabled ? 'none' : 'flex';
  if(splitEnabled){
    document.getElementById('splitCash').value = '';
    document.getElementById('splitBank').value = '';
    document.getElementById('splitAdvance').value = '';
    onSplitInput();
  } else {
    document.getElementById('splitBankAccountField').style.display = 'none';
  }
}
function onSplitInput(){
  const cash = parseFloat(document.getElementById('splitCash').value) || 0;
  const bank = parseFloat(document.getElementById('splitBank').value) || 0;
  const adv = parseFloat(document.getElementById('splitAdvance').value) || 0;
  document.getElementById('splitTotalHint').textContent = 'Total: ' + fmt(cash+bank+adv);
  document.getElementById('splitBankAccountField').style.display = bank>0 ? 'block' : 'none';
}
function toggleLoadingFields(){
  loadingEnabled = !loadingEnabled;
  const btn = document.getElementById('loadingToggleBtn');
  if(btn){ btn.classList.toggle('on', loadingEnabled); btn.textContent = loadingEnabled ? 'Loading/unloading enabled — tap to turn off' : 'Also paid loading/unloading expense?'; }
  document.getElementById('loadingInputs').style.display = loadingEnabled ? 'grid' : 'none';
  const lm = document.getElementById('loadingMethod').value;
  document.getElementById('loadingBankAccountField').style.display = (loadingEnabled && lm==='bank') ? 'block' : 'none';
}
document.addEventListener('change', (e)=>{
  if(e.target && e.target.id === 'loadingMethod'){
    const on = loadingEnabled;
    document.getElementById('loadingBankAccountField').style.display = (on && e.target.value==='bank') ? 'block' : 'none';
  }
  if(e.target && e.target.id === 'payLoadingMethod'){
    const on = payLoadingEnabled;
    document.getElementById('payLoadingBankAccountField').style.display = (on && e.target.value==='bank') ? 'block' : 'none';
  }
});
function recalcAmount(){
  const qty = parseFloat(document.getElementById('qty').value) || 0;
  const rate = parseFloat(document.getElementById('rate').value) || 0;
  document.getElementById('computedAmount').value = fmt(qty * rate);
}
function addConsumedRow(){
  const list = document.getElementById('prodConsumedList');
  const row = document.createElement('div');
  row.className = 'consumed-row';
  const opts = items.filter(i=>i.is_active).map(i => `<option value="${i.id}">${escapeAttr(i.name)} (${escapeAttr(i.unit)})</option>`).join('');
  row.innerHTML = `
    <select class="consumed-item">${opts}</select>
    <input type="number" class="consumed-qty" placeholder="0" step="0.001">
    <button class="mini-btn" style="background:var(--red);height:36px;" onclick="this.parentElement.remove()">✕</button>
  `;
  list.appendChild(row);
}

/* ============================= AUTOCOMPLETE + KEYBOARD NAV ============================= */
function suggestKeyFor(kindKey){
  const map = {
    client: { input: 'client', box: 'clientSuggestions', pick: pickClient, hide: hideClientSuggestions },
    vendor: { input: 'vendor', box: 'vendorSuggestions', pick: pickVendor, hide: hideVendorSuggestions },
    item: { input: 'itemType', box: 'itemSuggestions', pick: pickItem, hide: hideItemSuggestions },
    expense: { input: 'expenseType', box: 'expenseSuggestions', pick: pickExpense, hide: hideExpenseSuggestions },
    adj: { input: 'adjType', box: 'adjSuggestions', pick: pickAdjType, hide: hideAdjSuggestions },
    vadj: { input: 'vAdjType', box: 'vAdjSuggestions', pick: pickVAdjType, hide: hideVAdjSuggestions },
    btcat: { input: 'btCategory', box: 'btCategorySuggestions', pick: pickBankTxnCategory, hide: hideBankTxnSuggestions }
  };
  return map[kindKey];
}
function updateHighlight(kindKey){
  const cfg = suggestKeyFor(kindKey);
  if(!cfg) return;
  const box = document.getElementById(cfg.box);
  if(!box) return;
  const children = Array.from(box.querySelectorAll('.suggest-item'));
  children.forEach((el, i) => el.classList.toggle('hi', i === suggestHighlight[kindKey]));
  const hi = children[suggestHighlight[kindKey]];
  if(hi) hi.scrollIntoView({block: 'nearest'});
}
function onSuggestKey(e, kindKey){
  const cfg = suggestKeyFor(kindKey);
  if(!cfg) return;
  const box = document.getElementById(cfg.box);
  const input = document.getElementById(cfg.input);
  if(!box || !input) return;
  const isOpen = box.style.display === 'block';
  if(e.key === 'ArrowDown'){
    e.preventDefault();
    if(!isOpen){ input.dispatchEvent(new Event('input')); if(box.style.display !== 'block') return; }
    const n = box.querySelectorAll('.suggest-item').length;
    if(n === 0) return;
    suggestHighlight[kindKey] = (suggestHighlight[kindKey] + 1) % n;
    if(suggestHighlight[kindKey] < 0) suggestHighlight[kindKey] = 0;
    updateHighlight(kindKey);
  } else if(e.key === 'ArrowUp'){
    e.preventDefault();
    if(!isOpen){ input.dispatchEvent(new Event('input')); if(box.style.display !== 'block') return; }
    const n = box.querySelectorAll('.suggest-item').length;
    if(n === 0) return;
    suggestHighlight[kindKey] = suggestHighlight[kindKey] - 1;
    if(suggestHighlight[kindKey] < 0) suggestHighlight[kindKey] = n - 1;
    updateHighlight(kindKey);
  } else if(e.key === 'Enter'){
    if(isOpen){
      const items_ = box.querySelectorAll('.suggest-item');
      if(items_.length > 0){
        e.preventDefault();
        const idx = suggestHighlight[kindKey] >= 0 ? suggestHighlight[kindKey] : 0;
        items_[idx].dispatchEvent(new MouseEvent('mousedown', {bubbles:true}));
      }
    } else {
      input.blur();
    }
  } else if(e.key === 'Tab'){
    if(isOpen){
      const items_ = box.querySelectorAll('.suggest-item');
      if(items_.length > 0 && suggestHighlight[kindKey] >= 0){
        const idx = suggestHighlight[kindKey];
        items_[idx].dispatchEvent(new MouseEvent('mousedown', {bubbles:true}));
      }
    }
  } else if(e.key === 'Escape'){
    if(isOpen){ e.preventDefault(); cfg.hide(); suggestHighlight[kindKey] = -1; }
  } else if(e.key === 'Home'){
    if(isOpen){ e.preventDefault(); suggestHighlight[kindKey] = 0; updateHighlight(kindKey); }
  } else if(e.key === 'End'){
    if(isOpen){
      e.preventDefault();
      const n = box.querySelectorAll('.suggest-item').length;
      suggestHighlight[kindKey] = n - 1;
      updateHighlight(kindKey);
    }
  }
}
function resetHighlight(kindKey){ suggestHighlight[kindKey] = -1; }

function allClientNames(){
  const fromEntries = entries.filter(e=>e.client).map(e=>e.client);
  return [...new Set([...clientsCache, ...fromEntries])].sort();
}
function onClientInput(){
  const box = document.getElementById('clientSuggestions');
  const val = document.getElementById('client').value.trim().toLowerCase();
  if(method==='advance') setMethod('advance');
  resetHighlight('client');
  if(!val){ box.style.display='none'; box.innerHTML=''; return; }
  const matches = allClientNames().filter(n => n.toLowerCase().startsWith(val));
  if(matches.length===0){ box.style.display='none'; box.innerHTML=''; return; }
  box.innerHTML = matches.map(n => `<div class="suggest-item" onmousedown="pickClient('${escapeAttr(n)}')">${escapeAttr(n)}</div>`).join('');
  box.style.display = 'block';
  suggestHighlight['client'] = 0;
  updateHighlight('client');
}
function pickClient(name){
  document.getElementById('client').value = name;
  hideClientSuggestions();
  resetHighlight('client');
  if(method==='advance') setMethod('advance');
}
function hideClientSuggestions(){ document.getElementById('clientSuggestions').style.display='none'; resetHighlight('client'); }

function allVendorNames(){
  const fromEntries = entries.filter(e=>e.vendor).map(e=>e.vendor);
  return [...new Set([...vendorsCache, ...fromEntries])].sort();
}
function onVendorInput(){
  const box = document.getElementById('vendorSuggestions');
  const val = document.getElementById('vendor').value.trim().toLowerCase();
  resetHighlight('vendor');
  if(!val){ box.style.display='none'; box.innerHTML=''; return; }
  const matches = allVendorNames().filter(n => n.toLowerCase().startsWith(val));
  if(matches.length===0){ box.style.display='none'; box.innerHTML=''; return; }
  box.innerHTML = matches.map(n => `<div class="suggest-item" onmousedown="pickVendor('${escapeAttr(n)}')">${escapeAttr(n)}</div>`).join('');
  box.style.display = 'block';
  suggestHighlight['vendor'] = 0;
  updateHighlight('vendor');
}
function pickVendor(name){ document.getElementById('vendor').value = name; hideVendorSuggestions(); resetHighlight('vendor'); }
function hideVendorSuggestions(){ document.getElementById('vendorSuggestions').style.display='none'; resetHighlight('vendor'); }

function allItemTypes(){
  const fromItems = items.map(i=>i.name);
  return [...new Set([...fromItems])].sort();
}
function onItemInput(){
  const box = document.getElementById('itemSuggestions');
  const hint = document.getElementById('itemHint');
  const val = document.getElementById('itemType').value.trim();
  const lower = val.toLowerCase();
  recalcAmount();
  resetHighlight('item');
  try {
    if(val){
      const fp = fuzzyPreviewItem(val);
      if(fp.status === 'case' || fp.status === 'plural'){
        hint.innerHTML = `<span style="color:var(--green);">Will be saved as <b>${escapeAttr(fp.canonical)}</b></span>`;
      } else if(fp.status === 'close'){
        hint.innerHTML = `<span style="color:var(--green);">Did you mean <b>${escapeAttr(fp.canonical)}</b>? It will auto-match.</span>`;
      } else if(fp.status === 'new'){
        hint.innerHTML = `<span style="color:var(--amber);">New item — you'll be asked to confirm.</span>`;
      } else if(fp.status === 'ambiguous'){
        hint.innerHTML = `<span style="color:var(--amber);">Multiple matches. Pick below.</span>`;
      } else {
        hint.textContent = '';
      }
    } else {
      hint.textContent = '';
    }
  } catch(err) {
    hint.textContent = '';
  }
  if(!lower){ box.style.display='none'; box.innerHTML=''; return; }
  const matches = allItemTypes().filter(n => n.toLowerCase().startsWith(lower));
  if(matches.length===0){ box.style.display='none'; box.innerHTML=''; return; }
  box.innerHTML = matches.map(n => `<div class="suggest-item" onmousedown="pickItem('${escapeAttr(n)}')">${escapeAttr(n)}</div>`).join('');
  box.style.display = 'block';
  suggestHighlight['item'] = 0;
  updateHighlight('item');
}
function pickItem(name){
  document.getElementById('itemType').value = name;
  hideItemSuggestions();
  resetHighlight('item');
  onItemInput();
}
function hideItemSuggestions(){ document.getElementById('itemSuggestions').style.display='none'; resetHighlight('item'); }

function allExpenseTypes(){
  const fromEntries = entries.filter(e=>e.expenseType).map(e=>e.expenseType);
  return [...new Set([...expenseTypesCache, ...fromEntries])].sort();
}
function onExpenseInput(){
  const box = document.getElementById('expenseSuggestions');
  const val = document.getElementById('expenseType').value.trim().toLowerCase();
  resetHighlight('expense');
  if(!val){ box.style.display='none'; box.innerHTML=''; return; }
  const matches = allExpenseTypes().filter(n => n.toLowerCase().startsWith(val));
  if(matches.length===0){ box.style.display='none'; box.innerHTML=''; return; }
  box.innerHTML = matches.map(n => `<div class="suggest-item" onmousedown="pickExpense('${escapeAttr(n)}')">${escapeAttr(n)}</div>`).join('');
  box.style.display = 'block';
  suggestHighlight['expense'] = 0;
  updateHighlight('expense');
}
function pickExpense(name){ document.getElementById('expenseType').value = name; hideExpenseSuggestions(); resetHighlight('expense'); }
function hideExpenseSuggestions(){ document.getElementById('expenseSuggestions').style.display='none'; resetHighlight('expense'); }

function allAdjTypes(){
  const fromData = adjustments.map(a=>a.adjType);
  return [...new Set([...adjTypesCache, ...fromData])];
}
function onAdjTypeInput(){
  const box = document.getElementById('adjSuggestions');
  const val = document.getElementById('adjType').value.trim().toLowerCase();
  const all = allAdjTypes();
  resetHighlight('adj');
  const matches = val ? all.filter(n=>n.toLowerCase().startsWith(val)) : all;
  if(matches.length===0){ box.style.display='none'; box.innerHTML=''; return; }
  box.innerHTML = matches.map(n => `<div class="suggest-item" onmousedown="pickAdjType('${escapeAttr(n)}')">${escapeAttr(n)}</div>`).join('');
  box.style.display = 'block';
  suggestHighlight['adj'] = 0;
  updateHighlight('adj');
}
function pickAdjType(name){ document.getElementById('adjType').value = name; hideAdjSuggestions(); resetHighlight('adj'); }
function hideAdjSuggestions(){ document.getElementById('adjSuggestions').style.display='none'; resetHighlight('adj'); }

function allVAdjTypes(){
  const fromData = vendorAdjustments.map(a=>a.adjType);
  return [...new Set([...vAdjTypesCache, ...fromData])];
}
function onVAdjTypeInput(){
  const box = document.getElementById('vAdjSuggestions');
  const val = document.getElementById('vAdjType').value.trim().toLowerCase();
  const all = allVAdjTypes();
  resetHighlight('vadj');
  const matches = val ? all.filter(n=>n.toLowerCase().startsWith(val)) : all;
  if(matches.length===0){ box.style.display='none'; box.innerHTML=''; return; }
  box.innerHTML = matches.map(n => `<div class="suggest-item" onmousedown="pickVAdjType('${escapeAttr(n)}')">${escapeAttr(n)}</div>`).join('');
  box.style.display = 'block';
  suggestHighlight['vadj'] = 0;
  updateHighlight('vadj');
}
function pickVAdjType(name){ document.getElementById('vAdjType').value = name; hideVAdjSuggestions(); resetHighlight('vadj'); }
function hideVAdjSuggestions(){ document.getElementById('vAdjSuggestions').style.display='none'; resetHighlight('vadj'); }

function allBankTxnCategories(){
  const fromData = bankTransactions.map(b=>b.category).filter(Boolean);
  return [...new Set([...bankTxnTypesCache, ...fromData])];
}
function onBankTxnCategoryInput(){
  const box = document.getElementById('btCategorySuggestions');
  const val = document.getElementById('btCategory').value.trim().toLowerCase();
  const all = allBankTxnCategories();
  resetHighlight('btcat');
  const matches = val ? all.filter(n=>n.toLowerCase().startsWith(val)) : all;
  if(matches.length===0){ box.style.display='none'; box.innerHTML=''; return; }
  box.innerHTML = matches.map(n => `<div class="suggest-item" onmousedown="pickBankTxnCategory('${escapeAttr(n)}')">${escapeAttr(n)}</div>`).join('');
  box.style.display = 'block';
  suggestHighlight['btcat'] = 0;
  updateHighlight('btcat');
}
function pickBankTxnCategory(name){ document.getElementById('btCategory').value = name; hideBankTxnSuggestions(); resetHighlight('btcat'); }
function hideBankTxnSuggestions(){ document.getElementById('btCategorySuggestions').style.display='none'; resetHighlight('btcat'); }

/* ============================= BANK TAB — VENDOR / CLIENT DROPDOWNS ============================= */
function refreshBtVendorDropdown(){
  const sel = document.getElementById('btVendorSelect');
  if(!sel) return;
  const vendors = allVendorNames();
  const keep = sel.value;
  sel.innerHTML = '<option value="">— pick a vendor —</option>' +
    vendors.map(v => `<option value="${escapeAttr(v)}">${escapeAttr(v)}</option>`).join('');
  if(keep && vendors.includes(keep)) sel.value = keep;
  updateBtVendorHint();
}
function updateBtVendorHint(){
  const vendor = (document.getElementById('btVendorSelect') || {}).value || '';
  const hint = document.getElementById('btVendorBalanceHint');
  if(!hint) return;
  if(!vendor){ hint.textContent = ''; hint.style.display = 'none'; return; }
  const unpaid = vendorPayable(vendor);
  const vadv = vendorAdvanceBalance(vendor);
  const parts = [];
  if(unpaid > 0.005) parts.push(`Unpaid: ${fmt(unpaid)}`);
  else parts.push('All bills settled');
  if(vadv > 0.005) parts.push(`Vendor advance held: ${fmt(vadv)}`);
  const amtVal = parseFloat((document.getElementById('btVendorAmount')||{}).value) || 0;
  if(amtVal > unpaid + 0.005){
    const extra = amtVal - unpaid;
    parts.push(`Extra ${fmt(extra)} will become vendor advance`);
  }
  hint.textContent = parts.join(' · ');
  hint.style.display = 'block';
}
function refreshBtClientDropdown(){
  const sel = document.getElementById('btClientSelect');
  if(!sel) return;
  const clients = allClientNames();
  const keep = sel.value;
  sel.innerHTML = '<option value="">— pick a client —</option>' +
    clients.map(c => `<option value="${escapeAttr(c)}">${escapeAttr(c)}</option>`).join('');
  if(keep && clients.includes(keep)) sel.value = keep;
  updateBtClientHint();
}
function updateBtClientHint(){
  const client = (document.getElementById('btClientSelect') || {}).value || '';
  const hint = document.getElementById('btClientBalanceHint');
  if(!hint) return;
  if(!client){ hint.textContent = ''; hint.style.display = 'none'; return; }
  const unpaid = clientNetPending(client);
  const cadv = clientAdvanceBalance(client);
  const parts = [];
  if(unpaid > 0.005) parts.push(`Owes: ${fmt(unpaid)}`);
  else parts.push('All bills settled');
  if(cadv > 0.005) parts.push(`Advance held: ${fmt(cadv)}`);
  const amtVal = parseFloat((document.getElementById('btClientAmount')||{}).value) || 0;
  if(amtVal > unpaid + 0.005){
    const extra = amtVal - unpaid;
    parts.push(`Extra ${fmt(extra)} will become client advance`);
  }
  hint.textContent = parts.join(' · ');
  hint.style.display = 'block';
}

/* ============================= SUBMIT ENTRY ============================= */
async function submitEntry(){
  const entryDate = document.getElementById('date').value || todayStr();
  if(kind === 'production'){
    const producedItemId = document.getElementById('prodProducedItem').value;
    const producedQty = parseFloat(document.getElementById('prodProducedQty').value);
    if(!producedItemId){ alert('Choose what was produced'); return; }
    if(!producedQty || producedQty<=0){ alert('Enter produced quantity'); return; }
    const consumed = [];
    document.querySelectorAll('#prodConsumedList .consumed-row').forEach(row=>{
      const itemSel = row.querySelector('.consumed-item');
      const qtyInput = row.querySelector('.consumed-qty');
      const q = parseFloat(qtyInput.value);
      if(itemSel.value && q && q>0){ consumed.push({ itemId: parseInt(itemSel.value), qty: q }); }
    });
    const body = { date: entryDate, producedItemId: parseInt(producedItemId), producedQty, consumed, note: document.getElementById('note').value.trim() };
    try{
      const res = await fetch('/api/production', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if(!res.ok){ const err = await res.json().catch(()=>({})); alert(err.error ? ('Could not save: '+err.error) : 'Could not save production.'); return; }
    }catch(err){ alert('Could not reach the server: ' + (err&&err.message?err.message:err)); return; }
    resetEntryForm();
    await load(); await loadTypeOptions();
    return;
  }
  if(kind === 'advance'){
    const client = document.getElementById('client').value.trim();
    const amount = parseFloat(document.getElementById('amount').value);
    if(!client){ alert('Enter a client name'); return; }
    if(!amount || amount<=0){ alert('Enter a valid amount'); return; }
    if(!method){ alert('Choose cash or bank'); return; }
    const body = { date: entryDate, client, amount, method, note: document.getElementById('note').value.trim() };
    if(method==='bank') body.bankAccountId = document.getElementById('bankAccountSelect').value;
    try{
      const res = await fetch('/api/advances', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if(!res.ok){ const err = await res.json().catch(()=>({})); alert(err.error ? ('Could not save: '+err.error) : 'Could not save advance.'); return; }
    }catch(err){ alert('Could not reach the server: ' + (err&&err.message?err.message:err)); return; }
    resetEntryForm();
    await load(); await loadTypeOptions();
    return;
  }
  let payload;
  let splitPayments = null;
  if(kind==='sale' || kind==='purchase'){
    const isSale = kind==='sale';
    const party = isSale ? document.getElementById('client').value.trim() : document.getElementById('vendor').value.trim();
    if(!party){ alert(isSale ? 'Enter a client name' : 'Enter a vendor name'); return; }
    const isItemized = isSale || purchaseMode === 'itemized';
    const isRateLessSale = isSale && saleMode === 'challan' && !rateDecided;
    let itemType = '', qty = 0, rate = 0, directAmount = 0;
    if(isItemized){
      itemType = document.getElementById('itemType').value.trim();
      qty = parseFloat(document.getElementById('qty').value);
      if(!itemType){ alert('Enter an item type'); return; }
      if(!qty || qty<=0){ alert('Enter a valid quantity'); return; }
      if(!isRateLessSale){
        rate = parseFloat(document.getElementById('rate').value);
        if(!rate || rate<=0){ alert('Enter a valid rate'); return; }
      }
    } else {
      directAmount = parseFloat(document.getElementById('amount').value);
      if(!directAmount || directAmount<=0){ alert('Enter a valid amount'); return; }
    }
    const effectivePaidChoice = isRateLessSale ? false : paidChoice;
    const splitting = isSale && effectivePaidChoice && splitEnabled && !isRateLessSale;
    let bankAccountId = null;
    if(splitting){
      const sc = parseFloat(document.getElementById('splitCash').value) || 0;
      const sb = parseFloat(document.getElementById('splitBank').value) || 0;
      const sa = parseFloat(document.getElementById('splitAdvance').value) || 0;
      if(sc+sb+sa <= 0){ alert('Enter at least one split amount'); return; }
      if(sa > 0){
        const bal = clientAdvanceBalance(party);
        if(sa > bal + 0.005){ alert('Insufficient advance for ' + party + ' (' + fmt(bal) + ' available)'); return; }
      }
      if(sb > 0){ bankAccountId = document.getElementById('splitBankAccountSelect').value; }
      splitPayments = [];
      if(sc>0) splitPayments.push({method:'cash', amount:sc});
      if(sb>0) splitPayments.push({method:'bank', amount:sb, bankAccountId});
      if(sa>0) splitPayments.push({method:'advance', amount:sa});
    } else if(effectivePaidChoice && !method){
      alert('Choose cash or bank'); return;
    } else if(effectivePaidChoice && isSale && method==='advance'){
      const bal = clientAdvanceBalance(party);
      const amt = Math.round(qty*rate*100)/100;
      if(amt > bal + 0.005){ alert('Insufficient advance for ' + party + ' (' + fmt(bal) + ' available)'); return; }
    } else if(effectivePaidChoice && method==='bank'){
      bankAccountId = document.getElementById('bankAccountSelect').value;
    }
    payload = { date: entryDate, kind, itemType, qty, rate, note: document.getElementById('note').value.trim() };
    if(isSale){
      payload.client = party;
      payload.received = effectivePaidChoice && !splitting;
      payload.method = (effectivePaidChoice && !splitting) ? method : null;
      payload.isChallan = (saleMode === 'challan');
      payload.rateDecided = !isRateLessSale;
    } else {
      payload.vendor = party;
      payload.paid = paidChoice && !splitting;
      payload.method = (paidChoice && !splitting) ? method : null;
      payload.itemized = (purchaseMode === 'itemized');
      if(purchaseMode === 'nonitemized'){ payload.amount = directAmount; }
    }
    if(effectivePaidChoice && !splitting && bankAccountId){ payload.bankAccountId = bankAccountId; }
    if(isSale && effectivePaidChoice && !splitting && loadingEnabled && !isRateLessSale){
      const la = parseFloat(document.getElementById('loadingAmount').value);
      if(la && la>0){
        payload.loadingUnloadingAmount = la;
        payload.loadingUnloadingMethod = document.getElementById('loadingMethod').value;
        if(payload.loadingUnloadingMethod === 'bank'){
          payload.bankAccountId = document.getElementById('loadingBankAccountSelect').value || payload.bankAccountId || document.getElementById('bankAccountSelect').value;
        }
      }
    }
  } else {
    const expenseType = document.getElementById('expenseType').value.trim();
    const amount = parseFloat(document.getElementById('amount').value);
    if(!expenseType){ alert('Enter an expense type'); return; }
    if(!amount || amount<=0){ alert('Enter a valid amount'); return; }
    if(!method){ alert('Choose cash or bank'); return; }
    payload = { date: entryDate, kind, expenseType, amount, method, note: document.getElementById('note').value.trim() };
    if(method==='bank') payload.bankAccountId = document.getElementById('bankAccountSelect').value;
  }
  await postEntryWithFuzzy(payload, splitPayments, entryDate, !!document.getElementById('loadingAmount'));
}
async function postEntryWithFuzzy(payload, splitPayments, entryDate, hasLoading){
  let newEntryId = null;
  try{
    const res = await fetch('/api/entries', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if(res.status === 409){
      const err = await res.json().catch(()=>({}));
      if(err.error === 'duplicate_warning'){
        const dups = err.duplicates || [];
        let msg = 'Possible DOUBLE ENTRY detected!\n\n';
        msg += 'An identical entry already exists:\n';
        dups.slice(0, 5).forEach(d => {
          msg += '  #' + d.id + '  ' + (d.date||'') + '  ' + (d.party||'') + '  ' + (d.item||'') + '  qty ' + (d.qty||'') + ' × ' + (d.rate||'') + ' = ' + (d.amount||'') + '\n';
        });
        msg += '\nSave this entry anyway?';
        if(!confirm(msg)) return;
        payload.confirmDuplicate = true;
        return postEntryWithFuzzy(payload, splitPayments, entryDate, hasLoading);
      }
      if(err.error === 'item_resolution'){
        pendingFuzzySave = { payload, splitPayments, entryDate, hasLoading, reason: err.reason, original: err.original, candidates: err.candidates || [] };
        showFuzzyModal(err.reason, err.original, err.candidates || []);
        return;
      }
    }
    if(!res.ok){ const err = await res.json().catch(()=>({})); alert(err.error ? ('Could not save: '+err.error) : 'Could not save entry.'); return; }
    newEntryId = (await res.json()).id;
  }catch(err){ alert('Could not reach the server: ' + (err&&err.message?err.message:err)); return; }
  if(splitPayments && newEntryId){
    let la = 0, lm = null, laBank = null;
    if(loadingEnabled && hasLoading){
      la = parseFloat(document.getElementById('loadingAmount').value) || 0;
      lm = document.getElementById('loadingMethod').value;
      if(lm === 'bank') laBank = document.getElementById('loadingBankAccountSelect').value;
    }
    for(let i=0; i<splitPayments.length; i++){
      const sp = splitPayments[i];
      const body = { date: entryDate, method: sp.method, amount: sp.amount };
      if(sp.bankAccountId) body.bankAccountId = sp.bankAccountId;
      if(i===0 && la>0){
        body.loadingUnloadingAmount = la;
        body.loadingUnloadingMethod = lm;
        if(lm==='bank' && laBank) body.bankAccountId = laBank;
      }
      try{
        const res = await fetch('/api/entries/' + newEntryId + '/pay', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
        if(!res.ok){ const err = await res.json().catch(()=>({})); alert('Entry saved, but a split payment failed (' + sp.method + '): ' + (err.error||'server error')); break; }
      }catch(err){ alert('Entry saved, but could not reach server for the ' + sp.method + ' portion.'); break; }
    }
  }
  resetEntryForm();
  await load(); await loadTypeOptions();
}
function showFuzzyModal(reason, original, candidates){
  const titleEl = document.getElementById('fuzzyTitle');
  const bodyEl = document.getElementById('fuzzyBody');
  const choicesEl = document.getElementById('fuzzyChoices');
  const confirmBtn = document.getElementById('fuzzyConfirmBtn');
  confirmBtn.style.display = 'none';
  if(reason === 'new'){
    titleEl.textContent = 'Item not found';
    bodyEl.innerHTML = `"<b>${escapeAttr(original)}</b>" is not in the Stock list.<br>Add it as a new item and save?`;
    choicesEl.innerHTML = '';
    confirmBtn.style.display = 'block';
    confirmBtn.textContent = 'Add & Save';
  } else if(reason === 'ambiguous'){
    titleEl.textContent = 'Which item did you mean?';
    bodyEl.innerHTML = `"<b>${escapeAttr(original)}</b>" matches multiple items.`;
    choicesEl.innerHTML = candidates.map(c => `
      <button class="mini-btn" style="background:var(--accent);color:#fff;display:block;width:100%;margin-bottom:6px;padding:8px 10px;font-size:13px;" onclick="fuzzyPickCandidate('${escapeAttr(c)}')">${escapeAttr(c)}</button>
    `).join('') + `<button class="mini-btn" style="background:var(--amber);color:#fff;display:block;width:100%;padding:8px 10px;font-size:13px;" onclick="fuzzyAddAsNew()">Add "${escapeAttr(original)}" as new</button>`;
  }
  document.getElementById('fuzzyModal').style.display = 'flex';
}
function closeFuzzyModal(){ pendingFuzzySave = null; document.getElementById('fuzzyModal').style.display = 'none'; }
function fuzzyConfirm(){
  if(!pendingFuzzySave) return;
  const p = pendingFuzzySave;
  p.payload.newItemConfirmed = true;
  document.getElementById('fuzzyModal').style.display = 'none';
  pendingFuzzySave = null;
  postEntryWithFuzzy(p.payload, p.splitPayments, p.entryDate, p.hasLoading);
}
function fuzzyPickCandidate(name){
  if(!pendingFuzzySave) return;
  const p = pendingFuzzySave;
  p.payload.chosenItemName = name;
  document.getElementById('fuzzyModal').style.display = 'none';
  pendingFuzzySave = null;
  postEntryWithFuzzy(p.payload, p.splitPayments, p.entryDate, p.hasLoading);
}
function fuzzyAddAsNew(){
  if(!pendingFuzzySave) return;
  const p = pendingFuzzySave;
  p.payload.chosenItemName = p.original;
  p.payload.newItemConfirmed = true;
  document.getElementById('fuzzyModal').style.display = 'none';
  pendingFuzzySave = null;
  postEntryWithFuzzy(p.payload, p.splitPayments, p.entryDate, p.hasLoading);
}
function resetEntryForm(){
  document.getElementById('amount').value = '';
  document.getElementById('client').value = '';
  document.getElementById('vendor').value = '';
  document.getElementById('note').value = '';
  document.getElementById('date').value = todayStr();
  document.getElementById('itemHint').textContent = '';
  setKind(kind);
  if(kind === 'sale' && saleMode === 'challan'){ setRateDecided(challanRateDecided); }
  else { setRateDecided(true); }
}
/* ============================= PAYMENT MODAL ============================= */
function openPayModal(id){
  payModalEntryId = id;
  const e = entries.find(x=>x.id===id);
  const isSale = e.kind==='sale';
  const bal = isSale ? saleBalance(e) : purchaseBalance(e);
  document.getElementById('payModalTitle').textContent = isSale ? 'Record Payment from Client' : 'Record Payment to Vendor';
  document.getElementById('payAmountLabel').textContent = isSale ? 'Amount received' : 'Amount paid';
  document.getElementById('payModalBillInfo').textContent =
    (isSale ? (e.client+' — '+e.itemType) : (e.vendor+' — '+e.itemType))
    + ' — Amount: ' + fmt(e.amount) + ' — Balance: ' + fmt(bal);
  document.getElementById('payAmount').value = bal > 0 ? bal.toFixed(2) : e.amount.toFixed(2);
  document.getElementById('paySplitToggleBtn').style.display = isSale ? 'block' : 'none';
  document.getElementById('payMethodAdvance').style.display = isSale ? 'inline-flex' : 'none';
  document.getElementById('payLoadingField').style.display = isSale ? 'block' : 'none';
  payLoadingEnabled = false;
  const _plBtn = document.getElementById('payLoadingToggleBtn');
  if(_plBtn){ _plBtn.classList.remove('on'); _plBtn.textContent = 'Also paid loading/unloading expense?'; }
  document.getElementById('payLoadingInputs').style.display = 'none';
  document.getElementById('payLoadingBankAccountField').style.display = 'none';
  paySplitEnabled = false;
  const _psBtn = document.getElementById('paySplitToggleBtn');
  if(_psBtn){ _psBtn.classList.remove('on'); _psBtn.textContent = 'Split across cash / bank / advance?'; }
  document.getElementById('paySplitCash').value = '';
  document.getElementById('paySplitBank').value = '';
  document.getElementById('paySplitAdvance').value = '';
  document.getElementById('paySplitInputs').style.display = 'none';
  document.getElementById('payMethodField').style.display = 'block';
  document.getElementById('paySplitBankAccountField').style.display = 'none';
  const dateInput = document.getElementById('payDate');
  if(isAdmin()){ dateInput.removeAttribute('min'); dateInput.removeAttribute('max'); }
  else {
    const billDate = e.date;
    const minDate = billDate > addDays(todayStr(),-1) ? billDate : addDays(todayStr(),-1);
    dateInput.min = minDate; dateInput.max = todayStr();
  }
  dateInput.value = todayStr();
  payMethod = null;
  document.getElementById('payMethodCash').classList.remove('active-yes');
  document.getElementById('payMethodBank').classList.remove('active-yes');
  document.getElementById('payMethodAdvance').classList.remove('active-adv');
  document.getElementById('payBankAccountField').style.display = 'none';
  setPayMethod('cash');
  refreshAllAccountSelects();
  document.getElementById('payModal').style.display = 'flex';
}
function closePayModal(){ payModalEntryId = null; document.getElementById('payModal').style.display='none'; }
function setPayMethod(m){
  payMethod = m;
  document.getElementById('payMethodCash').classList.toggle('active-yes', m==='cash');
  document.getElementById('payMethodBank').classList.toggle('active-yes', m==='bank');
  document.getElementById('payMethodAdvance').classList.toggle('active-adv', m==='advance');
  document.getElementById('payBankAccountField').style.display = (m==='bank') ? 'block' : 'none';
  const hint = document.getElementById('payAdvanceHint');
  if(m==='advance' && payModalEntryId){
    const e = entries.find(x=>x.id===payModalEntryId);
    if(e && e.kind==='sale'){ hint.textContent = 'Available advance for ' + e.client + ': ' + fmt(clientAdvanceBalance(e.client)); }
    else { hint.textContent = ''; }
  } else { hint.textContent = ''; }
}
function togglePayLoadingFields(){
  payLoadingEnabled = !payLoadingEnabled;
  const btn = document.getElementById('payLoadingToggleBtn');
  if(btn){ btn.classList.toggle('on', payLoadingEnabled); btn.textContent = payLoadingEnabled ? 'Loading/unloading enabled — tap to turn off' : 'Also paid loading/unloading expense?'; }
  document.getElementById('payLoadingInputs').style.display = payLoadingEnabled ? 'grid' : 'none';
  const m = document.getElementById('payLoadingMethod').value;
  document.getElementById('payLoadingBankAccountField').style.display = (payLoadingEnabled && m==='bank') ? 'block' : 'none';
}
function togglePaySplitFields(){
  paySplitEnabled = !paySplitEnabled;
  const btn = document.getElementById('paySplitToggleBtn');
  if(btn){ btn.classList.toggle('on', paySplitEnabled); btn.textContent = paySplitEnabled ? 'Split enabled — tap to turn off' : 'Split across cash / bank / advance?'; }
  document.getElementById('paySplitInputs').style.display = paySplitEnabled ? 'block' : 'none';
  document.getElementById('payMethodField').style.display = paySplitEnabled ? 'none' : 'block';
  if(paySplitEnabled) onPaySplitInput();
  else document.getElementById('paySplitBankAccountField').style.display = 'none';
}
function onPaySplitInput(){
  const cash = parseFloat(document.getElementById('paySplitCash').value) || 0;
  const bank = parseFloat(document.getElementById('paySplitBank').value) || 0;
  const adv = parseFloat(document.getElementById('paySplitAdvance').value) || 0;
  document.getElementById('paySplitTotalHint').textContent = 'Total: ' + fmt(cash+bank+adv);
  document.getElementById('paySplitBankAccountField').style.display = bank>0 ? 'block' : 'none';
}
async function confirmPay(){
  const dateVal = document.getElementById('payDate').value || todayStr();
  const id = payModalEntryId;
  const e = entries.find(x=>x.id===id);
  const isSale = e.kind==='sale';
  const splitting = isSale && paySplitEnabled;
  if(!isAdmin()){
    const minDate = e.date > addDays(todayStr(),-1) ? e.date : addDays(todayStr(),-1);
    if(dateVal < minDate || dateVal > todayStr()){ alert('Payment date must be between ' + minDate + ' and ' + todayStr() + '.'); return; }
  }
  let paymentsToRecord;
  if(splitting){
    const sc = parseFloat(document.getElementById('paySplitCash').value) || 0;
    const sb = parseFloat(document.getElementById('paySplitBank').value) || 0;
    const sa = parseFloat(document.getElementById('paySplitAdvance').value) || 0;
    if(sc+sb+sa <= 0){ alert('Enter at least one split amount'); return; }
    if(sa > 0){
      const bal = clientAdvanceBalance(e.client);
      if(sa > bal + 0.005){ alert('Insufficient advance for ' + e.client + ' (' + fmt(bal) + ' available)'); return; }
    }
    paymentsToRecord = [];
    if(sc>0) paymentsToRecord.push({method:'cash', amount:sc});
    if(sb>0) paymentsToRecord.push({method:'bank', amount:sb, bankAccountId: document.getElementById('paySplitBankAccountSelect').value});
    if(sa>0) paymentsToRecord.push({method:'advance', amount:sa});
  } else {
    const amount = parseFloat(document.getElementById('payAmount').value);
    if(!amount || amount<=0){ alert('Enter a valid amount'); return; }
    if(!payMethod){ alert('Choose cash or bank'); return; }
    if(payMethod==='advance'){
      if(!isSale){ alert('Advance only applies to client sales.'); return; }
      const bal = clientAdvanceBalance(e.client);
      if(amount > bal + 0.005){ alert('Insufficient advance for ' + e.client + ' (' + fmt(bal) + ' available)'); return; }
    }
    const rec = {method: payMethod, amount};
    if(payMethod==='bank') rec.bankAccountId = document.getElementById('payBankAccountSelect').value;
    paymentsToRecord = [rec];
  }
  let la = 0, lm = null, laBank = null;
  if(isSale && payLoadingEnabled){
    la = parseFloat(document.getElementById('payLoadingAmount').value) || 0;
    lm = document.getElementById('payLoadingMethod').value;
    if(lm === 'bank') laBank = document.getElementById('payLoadingBankAccountSelect').value;
  }
  const endpoint = isSale ? ('/api/entries/' + id + '/pay') : ('/api/purchases/' + id + '/pay');
  for(let i=0; i<paymentsToRecord.length; i++){
    const p = paymentsToRecord[i];
    const body = { date: dateVal, method: p.method, amount: p.amount };
    if(p.bankAccountId) body.bankAccountId = p.bankAccountId;
    if(i===0 && la>0){
      body.loadingUnloadingAmount = la;
      body.loadingUnloadingMethod = lm;
      if(lm==='bank' && laBank) body.bankAccountId = body.bankAccountId || laBank;
    }
    try{
      const res = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if(!res.ok){ const err = await res.json().catch(()=>({})); alert((i>0 ? 'Part saved, but the ' : 'Could not save the ') + p.method + ' portion: ' + (err.error||'server error')); await load(); return; }
    }catch(err){ alert('Could not reach the server: ' + (err&&err.message?err.message:err)); await load(); return; }
  }
  closePayModal();
  await load();
}

/* ============================= EDIT PAYMENT MODAL ============================= */
function openEditPayModal(pid){
  if(!isAdmin()){ alert('Only an admin can edit payments.'); return; }
  const p = payments.find(x=>x.id===pid);
  if(!p) return;
  const e = entries.find(x=>x.id===p.entryId);
  editPayId = pid;
  editPayGroupIds = payments.filter(x => x.entryId === p.entryId && x.date === p.date).map(x => x.id);
  const isSplit = editPayGroupIds.length > 1;
  const isSale = e && e.kind === 'sale';
  document.getElementById('editPayInfo').textContent =
    (e ? (e.client || e.vendor || '') + ' — ' + (e.itemType || '') : '') +
    (isSplit ? ' — split into ' + editPayGroupIds.length + ' parts' : ' — Method: ' + p.method);
  document.getElementById('editPayDate').value = p.date;
  editPaySplitEnabled = false;
  const _esBtn = document.getElementById('editPaySplitToggleBtn');
  if(_esBtn){ _esBtn.classList.remove('on'); _esBtn.textContent = 'Split across cash / bank / advance?'; }
  document.getElementById('editPaySplitInputs').style.display = 'none';
  document.getElementById('editPayMethodField').style.display = 'block';
  document.getElementById('editPaySplitBankAccountField').style.display = 'none';
  document.getElementById('editPaySplitNotice').style.display = 'none';
  if(_esBtn) _esBtn.style.display = isSale ? 'block' : 'none';
  document.getElementById('editPayMethodAdvance').style.display = isSale ? 'inline-flex' : 'none';
  if(isSplit){
    editPaySplitEnabled = true;
    if(_esBtn){ _esBtn.classList.add('on'); _esBtn.textContent = 'Split enabled — tap to turn off'; }
    document.getElementById('editPaySplitInputs').style.display = 'block';
    document.getElementById('editPayMethodField').style.display = 'none';
    document.getElementById('editPaySplitNotice').style.display = 'block';
    const cash = editPayGroupIds.reduce((s,id) => { const x = payments.find(y => y.id === id); return x && x.method === 'cash' ? s + x.amount : s; }, 0);
    const bank = editPayGroupIds.reduce((s,id) => { const x = payments.find(y => y.id === id); return x && x.method === 'bank' ? s + x.amount : s; }, 0);
    const adv = editPayGroupIds.reduce((s,id) => { const x = payments.find(y => y.id === id); return x && x.method === 'advance' ? s + x.amount : s; }, 0);
    document.getElementById('editPaySplitCash').value = cash > 0 ? cash.toFixed(2) : '';
    document.getElementById('editPaySplitBank').value = bank > 0 ? bank.toFixed(2) : '';
    document.getElementById('editPaySplitAdvance').value = adv > 0 ? adv.toFixed(2) : '';
    if(bank > 0) document.getElementById('editPaySplitBankAccountField').style.display = 'block';
    const bankPart = payments.find(x => editPayGroupIds.includes(x.id) && x.method === 'bank');
    refreshAllAccountSelects();
    if(bankPart && bankPart.bankAccountId){
      const sel = document.getElementById('editPaySplitBankAccountSelect');
      if(sel) sel.value = bankPart.bankAccountId;
    }
    onEditPaySplitInput();
  } else {
    document.getElementById('editPayAmount').value = p.amount;
    editPayMethod = p.method;
    setEditPayMethod(p.method);
    refreshAllAccountSelects();
    if(p.bankAccountId){
      const sel = document.getElementById('editPayBankSelect');
      if(sel) sel.value = p.bankAccountId;
    }
  }
  const dateInput = document.getElementById('editPayDate');
  if(isAdmin()){ dateInput.removeAttribute('min'); dateInput.removeAttribute('max'); }
  else {
    const minDate = e && e.date > addDays(todayStr(),-1) ? e.date : addDays(todayStr(),-1);
    dateInput.min = minDate; dateInput.max = todayStr();
  }
  document.getElementById('editPayModal').style.display = 'flex';
}
function closeEditPayModal(){ editPayId = null; editPayGroupIds = []; document.getElementById('editPayModal').style.display='none'; }
function setEditPayMethod(m){
  editPayMethod = m;
  document.getElementById('editPayMethodCash').classList.toggle('active-yes', m==='cash');
  document.getElementById('editPayMethodBank').classList.toggle('active-yes', m==='bank');
  document.getElementById('editPayMethodAdvance').classList.toggle('active-adv', m==='advance');
  document.getElementById('editPayBankField').style.display = m==='bank' ? 'block' : 'none';
  const hint = document.getElementById('editPayAdvanceHint');
  if(m==='advance' && editPayId){
    const p = payments.find(x=>x.id===editPayId);
    const e = p ? entries.find(x=>x.id===p.entryId) : null;
    if(e && e.kind==='sale'){ hint.textContent = 'Available advance for ' + e.client + ': ' + fmt(clientAdvanceBalance(e.client)); }
    else { hint.textContent = ''; }
  } else { hint.textContent = ''; }
}
function toggleEditPaySplitFields(){
  editPaySplitEnabled = !editPaySplitEnabled;
  const btn = document.getElementById('editPaySplitToggleBtn');
  if(btn){ btn.classList.toggle('on', editPaySplitEnabled); btn.textContent = editPaySplitEnabled ? 'Split enabled — tap to turn off' : 'Split across cash / bank / advance?'; }
  document.getElementById('editPaySplitInputs').style.display = editPaySplitEnabled ? 'block' : 'none';
  document.getElementById('editPayMethodField').style.display = editPaySplitEnabled ? 'none' : 'block';
  if(editPaySplitEnabled) onEditPaySplitInput();
  else document.getElementById('editPaySplitBankAccountField').style.display = 'none';
}
function onEditPaySplitInput(){
  const cash = parseFloat(document.getElementById('editPaySplitCash').value) || 0;
  const bank = parseFloat(document.getElementById('editPaySplitBank').value) || 0;
  const adv = parseFloat(document.getElementById('editPaySplitAdvance').value) || 0;
  document.getElementById('editPaySplitTotalHint').textContent = 'Total: ' + fmt(cash+bank+adv);
  document.getElementById('editPaySplitBankAccountField').style.display = bank > 0 ? 'block' : 'none';
}
async function confirmEditPay(){
  const p = payments.find(x=>x.id===editPayId);
  if(!p) return;
  const e = entries.find(x=>x.id===p.entryId);
  if(!e) return;
  const isSale = e.kind === 'sale';
  const newDate = document.getElementById('editPayDate').value || p.date;
  if(!isAdmin()){
    const minDate = e.date > addDays(todayStr(),-1) ? e.date : addDays(todayStr(),-1);
    if(newDate < minDate || newDate > todayStr()){ alert('Payment date must be between ' + minDate + ' and ' + todayStr() + '.'); return; }
  }
  let desired = [];
  if(editPaySplitEnabled){
    const sc = parseFloat(document.getElementById('editPaySplitCash').value) || 0;
    const sb = parseFloat(document.getElementById('editPaySplitBank').value) || 0;
    const sa = parseFloat(document.getElementById('editPaySplitAdvance').value) || 0;
    if(sc+sb+sa <= 0){ alert('Enter at least one split amount'); return; }
    if(sa > 0){
      const bal = clientAdvanceBalance(e.client);
      if(sa > bal + 0.005){ alert('Insufficient advance for ' + e.client + ' (' + fmt(bal) + ' available)'); return; }
    }
    const bankId = sb > 0 ? document.getElementById('editPaySplitBankAccountSelect').value : null;
    if(sc>0) desired.push({method:'cash', amount:sc, bankAccountId:null});
    if(sb>0) desired.push({method:'bank', amount:sb, bankAccountId:bankId});
    if(sa>0) desired.push({method:'advance', amount:sa, bankAccountId:null});
  } else {
    const amount = parseFloat(document.getElementById('editPayAmount').value);
    if(!amount || amount<=0){ alert('Enter a valid amount'); return; }
    if(!editPayMethod){ alert('Choose cash or bank'); return; }
    if(editPayMethod==='advance'){
      if(!isSale){ alert('Advance only applies to client sales.'); return; }
      const bal = clientAdvanceBalance(e.client);
      if(amount > bal + 0.005){ alert('Insufficient advance for ' + e.client + ' (' + fmt(bal) + ' available)'); return; }
    }
    let bankId = null;
    if(editPayMethod==='bank') bankId = document.getElementById('editPayBankSelect').value;
    desired.push({method: editPayMethod, amount, bankAccountId: bankId});
  }
  const groupIds = editPayGroupIds.length ? editPayGroupIds.slice() : [editPayId];
  const first = payments.find(x => groupIds.includes(x.id));
  const la = first ? (first.loadingUnloading || 0) : 0;
  for(const gid of groupIds){
    try{
      const res = await fetch('/api/payments/' + gid, { method:'DELETE' });
      if(!res.ok){ const err = await res.json().catch(()=>({})); alert('Could not delete old payment part: ' + (err.error||'server error')); await load(); return; }
    }catch(err){ alert('Could not reach the server while deleting old payments: ' + (err&&err.message?err.message:err)); await load(); return; }
  }
  const endpoint = isSale ? ('/api/entries/' + e.id + '/pay') : ('/api/purchases/' + e.id + '/pay');
  for(let i=0; i<desired.length; i++){
    const d = desired[i];
    const body = { date: newDate, method: d.method, amount: d.amount };
    if(d.bankAccountId) body.bankAccountId = d.bankAccountId;
    if(i===0 && la > 0){
      body.loadingUnloadingAmount = la;
      body.loadingUnloadingMethod = d.method === 'bank' ? 'bank' : 'cash';
      if(d.method === 'bank' && d.bankAccountId) body.bankAccountId = d.bankAccountId;
    }
    try{
      const res = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if(!res.ok){ const err = await res.json().catch(()=>({})); alert('Could not save new payment part (' + d.method + '): ' + (err.error||'server error')); await load(); return; }
    }catch(err){ alert('Could not reach the server while saving new payments: ' + (err&&err.message?err.message:err)); await load(); return; }
  }
  closeEditPayModal();
  await load();
}

/* ============================= EDIT ENTRY MODAL ============================= */
let editPurchMode = true;
let editExpMethod = 'cash';
function openEditModal(id){
  if(!isAdmin()){ alert('Only an admin can edit.'); return; }
  const e = entries.find(x=>x.id===id);
  if(!e) return;
  editEntryId = id;
  const box = document.getElementById('editModalFields');
  let html = '';
  if(e.kind === 'sale'){
    document.getElementById('editModalTitle').textContent = 'Edit Sale';
    html += `<div class="field"><label>Date</label><input type="date" id="edit_date" value="${e.date}"></div>`;
    html += `<div class="field"><label>Client</label><input type="text" id="edit_client" value="${escapeAttr(e.client||'')}"></div>`;
    html += `<div class="field"><label>Item</label><input type="text" id="edit_itemType" value="${escapeAttr(e.itemType||'')}"></div>`;
    html += `<div class="grid2"><div><label>Qty</label><input type="number" id="edit_qty" step="0.001" value="${e.qty||0}"></div>`;
    if(e.rate != null && e.rate > 0){
      html += `<div><label>Rate</label><input type="number" id="edit_rate" step="0.01" value="${e.rate||0}"></div>`;
    } else {
      html += `<div><label>Rate</label><input type="text" value="(not decided)" disabled style="color:var(--muted);"></div>`;
    }
    html += `</div>`;
    html += `<div class="field"><label>Note</label><input type="text" id="edit_note" value="${escapeAttr(e.note||'')}"></div>`;
  } else if(e.kind === 'purchase'){
    document.getElementById('editModalTitle').textContent = 'Edit Purchase';
    const isItemized = !!e.itemType;
    editPurchMode = isItemized;
    html += `<div class="field"><label>Type</label>
      <div class="paid-toggle">
        <div class="paid-btn ${isItemized?'active-yes':''}" id="edit_purch_itemized" onclick="toggleEditPurchMode(true)">Itemized</div>
        <div class="paid-btn ${!isItemized?'active-yes':''}" id="edit_purch_nonitemized" onclick="toggleEditPurchMode(false)">Non-itemized</div>
      </div></div>`;
    html += `<div class="field"><label>Date</label><input type="date" id="edit_date" value="${e.date}"></div>`;
    html += `<div class="field"><label>Vendor</label><input type="text" id="edit_vendor" value="${escapeAttr(e.vendor||'')}"></div>`;
    html += `<div id="edit_purch_itemized_fields" style="display:${isItemized?'block':'none'};">`;
    html += `<div class="field"><label>Item</label><input type="text" id="edit_itemType" value="${escapeAttr(e.itemType||'')}"></div>`;
    html += `<div class="grid2"><div><label>Qty</label><input type="number" id="edit_qty" step="0.001" value="${e.qty||0}"></div>
             <div><label>Rate</label><input type="number" id="edit_rate" step="0.01" value="${e.rate||0}"></div></div>`;
    html += `</div>`;
    html += `<div id="edit_purch_nonitemized_fields" style="display:${!isItemized?'block':'none'};">`;
    html += `<div class="field"><label>Amount</label><input type="number" id="edit_amount" step="0.01" value="${e.amount||0}"></div>`;
    html += `</div>`;
    html += `<div class="field"><label>Note</label><input type="text" id="edit_note" value="${escapeAttr(e.note||'')}"></div>`;
  } else if(e.kind === 'expense'){
    document.getElementById('editModalTitle').textContent = 'Edit Expense';
    html += `<div class="field"><label>Date</label><input type="date" id="edit_date" value="${e.date}"></div>`;
    html += `<div class="field"><label>Expense Type</label><input type="text" id="edit_expenseType" value="${escapeAttr(e.expenseType||'')}"></div>`;
    html += `<div class="field"><label>Amount</label><input type="number" id="edit_amount" step="0.01" value="${e.amount||0}"></div>`;
    const isBank = e.method === 'bank';
    editExpMethod = isBank ? 'bank' : 'cash';
    html += `<div class="field"><label>Method</label>
      <div class="paid-toggle">
        <div class="paid-btn ${!isBank?'active-yes':''}" id="edit_exp_cash" onclick="toggleEditExpMethod('cash')">Cash</div>
        <div class="paid-btn ${isBank?'active-yes':''}" id="edit_exp_bank" onclick="toggleEditExpMethod('bank')">Bank</div>
      </div></div>`;
    html += `<div id="edit_exp_bank_field" class="field" style="display:${isBank?'block':'none'};"><label>Bank account</label><select id="edit_exp_bank_select"></select></div>`;
    html += `<div class="field"><label>Note</label><input type="text" id="edit_note" value="${escapeAttr(e.note||'')}"></div>`;
  } else {
    alert('Cannot edit this entry kind.');
    return;
  }

  /* ---- Existing payments + optional add-payment (sale / purchase only) ---- */
  if(e.kind === 'sale' || e.kind === 'purchase'){
    const pays = paymentsFor(e.id);
    const bal = e.kind === 'sale' ? saleBalance(e) : purchaseBalance(e);
    const st = e.kind === 'sale' ? saleStatus(e) : purchaseStatus(e);
    const isRateLess = e.kind === 'sale' && (e.rate == null || e.rate <= 0);
    html += `<div style="border-top:1px solid var(--border);margin-top:12px;padding-top:10px;">`;
    html += `<b style="font-size:12px;">Payments</b>`;
    html += `<div class="small" style="margin:4px 0;">Status: <b>${st}</b> · Paid: ${fmt(paidAmount(e.id))} · Balance: ${fmt(bal)}</div>`;
    if(pays.length){
      html += pays.map(p => {
        const acct = (p.method==='bank' && p.bankAccountId) ? ' · '+accountName(p.bankAccountId) : '';
        return `<div class="meta" style="padding:3px 0;">↳ ${fmtDateDMY(p.date)} · ${p.method}${acct} · ₹${fmt(p.amount)}
          <span style="color:var(--accent);cursor:pointer;margin-left:4px;" onclick="closeEditModal();openEditPayModal(${p.id})">[edit]</span>
          <span style="color:var(--red);cursor:pointer;" onclick="closeEditModal();delPayment(${p.id})">[×]</span></div>`;
      }).join('');
    } else {
      html += `<div class="small" style="color:var(--muted);">No payments yet</div>`;
    }

    if(!isRateLess){
      html += `<div style="margin-top:10px;border:1px dashed var(--border);border-radius:8px;padding:8px;">`;
      html += `<b class="small" style="display:block;margin-bottom:6px;">Add payment (optional)</b>`;
      html += `<div class="field"><label>Payment date</label><input type="date" id="edit_pay_date" value="${todayStr()}"></div>`;
      html += `<button type="button" id="editPaySplitToggleBtn" class="toggle-btn" onclick="toggleEditEntryPaySplit()">Split across cash / bank / advance?</button>`;
      html += `<div id="editPayMethodField" class="field" style="margin-top:6px;">
        <label>Via</label>
        <div class="paid-toggle">
          <div class="paid-btn active-yes" id="editPayMethodCash" onclick="setEditEntryPayMethod('cash')">💵 Cash</div>
          <div class="paid-btn" id="editPayMethodBank" onclick="setEditEntryPayMethod('bank')">🏦 Bank</div>
          ${e.kind==='sale' ? `<div class="paid-btn" id="editPayMethodAdvance" onclick="setEditEntryPayMethod('advance')">🪙 Advance</div>` : ''}
        </div>
        <div id="editPayBankAccountField" class="field" style="display:none;">
          <label>Bank account</label><select id="editPayBankAccountSelect"></select>
        </div>
        <div class="field" style="margin-top:6px;"><label>Amount</label><input type="number" id="edit_pay_amount" step="0.01" placeholder="${bal>0?bal.toFixed(2):'0.00'}"></div>
      </div>`;
      html += `<div id="editPaySplitInputs" style="display:none;margin-top:6px;">
        <div class="grid3">
          <div><label>Cash</label><input type="number" id="editPaySplitCash" step="0.01" placeholder="0.00" oninput="onEditEntryPaySplitInput()"></div>
          <div><label>Bank</label><input type="number" id="editPaySplitBank" step="0.01" placeholder="0.00" oninput="onEditEntryPaySplitInput()"></div>
          ${e.kind==='sale' ? `<div><label>Advance</label><input type="number" id="editPaySplitAdvance" step="0.01" placeholder="0.00" oninput="onEditEntryPaySplitInput()"></div>` : `<div></div>`}
        </div>
        <div id="editPaySplitBankAccountField" class="field" style="display:none;">
          <label>Bank account (bank portion)</label><select id="editPaySplitBankAccountSelect"></select>
        </div>
        <div class="small" style="margin-top:4px;" id="editPaySplitTotalHint">Total: 0.00</div>
      </div>`;
      html += `</div>`;
    } else {
      html += `<div class="notice-amber" style="margin-top:8px;">Rate not decided yet — set rate before recording payment.</div>`;
    }
    html += `</div>`;
  }

  box.innerHTML = html;
  if(e.kind === 'expense'){
    fillAccountSelect(document.getElementById('edit_exp_bank_select'), e.bankAccountId || defaultAccountId(), false);
  }
  if(e.kind === 'sale' || e.kind === 'purchase'){
    editEntryPaySplit = false;
    editEntryPayMethod = 'cash';
    const bankSel = document.getElementById('editPayBankAccountSelect');
    const splitBankSel = document.getElementById('editPaySplitBankAccountSelect');
    if(bankSel) fillAccountSelect(bankSel, defaultAccountId(), false);
    if(splitBankSel) fillAccountSelect(splitBankSel, defaultAccountId(), false);
  }
  document.getElementById('editModal').style.display = 'flex';
}
let editEntryPaySplit = false;
let editEntryPayMethod = 'cash';
function toggleEditEntryPaySplit(){
  editEntryPaySplit = !editEntryPaySplit;
  const btn = document.getElementById('editPaySplitToggleBtn');
  if(btn){ btn.classList.toggle('on', editEntryPaySplit); btn.textContent = editEntryPaySplit ? 'Split enabled — tap to turn off' : 'Split across cash / bank / advance?'; }
  const splitBox = document.getElementById('editPaySplitInputs');
  const methodBox = document.getElementById('editPayMethodField');
  if(splitBox) splitBox.style.display = editEntryPaySplit ? 'block' : 'none';
  if(methodBox) methodBox.style.display = editEntryPaySplit ? 'none' : 'block';
  if(editEntryPaySplit) onEditEntryPaySplitInput();
  else {
    const f = document.getElementById('editPaySplitBankAccountField');
    if(f) f.style.display = 'none';
  }
}
function setEditEntryPayMethod(m){
  editEntryPayMethod = m;
  const cash = document.getElementById('editPayMethodCash');
  const bank = document.getElementById('editPayMethodBank');
  const adv = document.getElementById('editPayMethodAdvance');
  if(cash) cash.classList.toggle('active-yes', m==='cash');
  if(bank) bank.classList.toggle('active-yes', m==='bank');
  if(adv) adv.classList.toggle('active-adv', m==='advance');
  const f = document.getElementById('editPayBankAccountField');
  if(f) f.style.display = m==='bank' ? 'block' : 'none';
}
function onEditEntryPaySplitInput(){
  const cash = parseFloat((document.getElementById('editPaySplitCash')||{}).value) || 0;
  const bank = parseFloat((document.getElementById('editPaySplitBank')||{}).value) || 0;
  const adv = parseFloat((document.getElementById('editPaySplitAdvance')||{}).value) || 0;
  const hint = document.getElementById('editPaySplitTotalHint');
  if(hint) hint.textContent = 'Total: ' + fmt(cash+bank+adv);
  const f = document.getElementById('editPaySplitBankAccountField');
  if(f) f.style.display = bank>0 ? 'block' : 'none';
}
function toggleEditPurchMode(itemized){
  editPurchMode = itemized;
  document.getElementById('edit_purch_itemized').classList.toggle('active-yes', itemized);
  document.getElementById('edit_purch_nonitemized').classList.toggle('active-yes', !itemized);
  document.getElementById('edit_purch_itemized_fields').style.display = itemized ? 'block' : 'none';
  document.getElementById('edit_purch_nonitemized_fields').style.display = itemized ? 'none' : 'block';
}
function toggleEditExpMethod(m){
  editExpMethod = m;
  document.getElementById('edit_exp_cash').classList.toggle('active-yes', m==='cash');
  document.getElementById('edit_exp_bank').classList.toggle('active-yes', m==='bank');
  document.getElementById('edit_exp_bank_field').style.display = m==='bank' ? 'block' : 'none';
}
function closeEditModal(){ editEntryId = null; document.getElementById('editModal').style.display='none'; }
async function confirmEdit(){
  const e = entries.find(x=>x.id===editEntryId);
  if(!e) return;
  const body = {};
  if(e.kind === 'sale'){
    body.date = document.getElementById('edit_date').value;
    body.client = document.getElementById('edit_client').value.trim();
    body.itemType = document.getElementById('edit_itemType').value.trim();
    body.qty = parseFloat(document.getElementById('edit_qty').value);
    body.note = document.getElementById('edit_note').value;
    const rateEl = document.getElementById('edit_rate');
    if(rateEl){ body.rate = parseFloat(rateEl.value); body.rateDecided = true; }
    else { body.rateDecided = false; }
  } else if(e.kind === 'purchase'){
    body.date = document.getElementById('edit_date').value;
    body.vendor = document.getElementById('edit_vendor').value.trim();
    body.itemized = editPurchMode;
    if(editPurchMode){
      body.itemType = document.getElementById('edit_itemType').value.trim();
      body.qty = parseFloat(document.getElementById('edit_qty').value);
      body.rate = parseFloat(document.getElementById('edit_rate').value);
    } else {
      body.amount = parseFloat(document.getElementById('edit_amount').value);
    }
    body.note = document.getElementById('edit_note').value;
  } else if(e.kind === 'expense'){
    body.date = document.getElementById('edit_date').value;
    body.expenseType = document.getElementById('edit_expenseType').value.trim();
    body.amount = parseFloat(document.getElementById('edit_amount').value);
    body.method = editExpMethod;
    if(editExpMethod === 'bank'){ body.bankAccountId = document.getElementById('edit_exp_bank_select').value; }
    body.note = document.getElementById('edit_note').value;
  }
  try{
    const res = await fetch('/api/entries/' + editEntryId, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if(res.status === 409){
      const err = await res.json().catch(()=>({}));
      if(err.error === 'item_resolution'){
        pendingFuzzySave = { payload: null, splitPayments: null, entryDate: null, hasLoading: false,
                             reason: err.reason, original: err.original, candidates: err.candidates || [],
                             isEdit: true, editId: editEntryId };
        showFuzzyModal(err.reason, err.original, err.candidates || []);
        return;
      }
    }
    if(!res.ok){ const err = await res.json().catch(()=>({})); alert(err.error || 'Could not save changes'); return; }
  }catch(err){ alert('Could not reach the server: ' + (err&&err.message?err.message:err)); return; }

  /* Optional new payment from edit modal */
  if(e.kind === 'sale' || e.kind === 'purchase'){
    const isSale = e.kind === 'sale';
    const payDate = (document.getElementById('edit_pay_date') || {}).value || todayStr();
    let paymentsToRecord = [];
    if(editEntryPaySplit){
      const sc = parseFloat((document.getElementById('editPaySplitCash')||{}).value) || 0;
      const sb = parseFloat((document.getElementById('editPaySplitBank')||{}).value) || 0;
      const sa = isSale ? (parseFloat((document.getElementById('editPaySplitAdvance')||{}).value) || 0) : 0;
      if(sc+sb+sa > 0){
        if(sc>0) paymentsToRecord.push({method:'cash', amount:sc});
        if(sb>0){
          const bankAccountId = (document.getElementById('editPaySplitBankAccountSelect')||{}).value;
          paymentsToRecord.push({method:'bank', amount:sb, bankAccountId});
        }
        if(sa>0) paymentsToRecord.push({method:'advance', amount:sa});
      }
    } else {
      const amt = parseFloat((document.getElementById('edit_pay_amount')||{}).value) || 0;
      if(amt > 0){
        const rec = { method: editEntryPayMethod || 'cash', amount: amt };
        if(editEntryPayMethod === 'bank'){
          rec.bankAccountId = (document.getElementById('editPayBankAccountSelect')||{}).value;
        }
        paymentsToRecord.push(rec);
      }
    }
    const endpoint = isSale ? ('/api/entries/' + editEntryId + '/pay') : ('/api/purchases/' + editEntryId + '/pay');
    for(let i=0; i<paymentsToRecord.length; i++){
      const sp = paymentsToRecord[i];
      const payload = { date: payDate, method: sp.method, amount: sp.amount };
      if(sp.bankAccountId) payload.bankAccountId = sp.bankAccountId;
      try{
        const res = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        if(!res.ok){
          const err = await res.json().catch(()=>({}));
          alert('Entry saved, but payment failed (' + sp.method + '): ' + (err.error||'server error'));
          break;
        }
      }catch(err){
        alert('Entry saved, but payment failed: ' + (err&&err.message?err.message:err));
        break;
      }
    }
  }

  closeEditModal();
  await load();
}

/* ============================= CLIENT / VENDOR ADJUSTMENT MODALS ============================= */
function openAdjModal(clientName){
  adjModalClient = clientName;
  document.getElementById('adjModalClient').textContent = 'For: ' + clientName;
  document.getElementById('adjType').value = '';
  document.getElementById('adjAmount').value = '';
  document.getElementById('adjNote').value = '';
  const dateInput = document.getElementById('adjDate');
  if(isAdmin()){ dateInput.removeAttribute('min'); dateInput.removeAttribute('max'); }
  else { dateInput.min = addDays(todayStr(),-1); dateInput.max = todayStr(); }
  dateInput.value = todayStr();
  document.getElementById('adjModal').style.display = 'flex';
}
function closeAdjModal(){ adjModalClient = null; document.getElementById('adjModal').style.display='none'; }
async function confirmAdjustment(){
  const adjType = document.getElementById('adjType').value.trim();
  const amount = parseFloat(document.getElementById('adjAmount').value);
  const adjDate = document.getElementById('adjDate').value || todayStr();
  if(!adjType){ alert('Enter an adjustment type'); return; }
  if(!amount || amount<=0){ alert('Enter a valid amount'); return; }
  try{
    const res = await fetch('/api/client-adjustments', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: adjDate, client: adjModalClient, adjType, amount, note: document.getElementById('adjNote').value.trim() }) });
    if(!res.ok){ const err = await res.json().catch(()=>({})); alert(err.error ? ('Could not save: '+err.error) : 'Could not save adjustment.'); return; }
  }catch(err){ alert('Could not reach the server: ' + (err&&err.message?err.message:err)); return; }
  closeAdjModal();
  await load(); await loadTypeOptions();
  if(currentTab==='ledger') renderLedger();
}
function openVAdjModal(vendorName){
  vAdjModalVendor = vendorName;
  document.getElementById('vAdjModalVendor').textContent = 'For: ' + vendorName;
  document.getElementById('vAdjType').value = '';
  document.getElementById('vAdjAmount').value = '';
  document.getElementById('vAdjNote').value = '';
  const dateInput = document.getElementById('vAdjDate');
  if(isAdmin()){ dateInput.removeAttribute('min'); dateInput.removeAttribute('max'); }
  else { dateInput.min = addDays(todayStr(),-1); dateInput.max = todayStr(); }
  dateInput.value = todayStr();
  document.getElementById('vAdjModal').style.display = 'flex';
}
function closeVAdjModal(){ vAdjModalVendor = null; document.getElementById('vAdjModal').style.display='none'; }
async function confirmVendorAdjustment(){
  const adjType = document.getElementById('vAdjType').value.trim();
  const amount = parseFloat(document.getElementById('vAdjAmount').value);
  const adjDate = document.getElementById('vAdjDate').value || todayStr();
  if(!adjType){ alert('Enter an adjustment type'); return; }
  if(!amount || amount<=0){ alert('Enter a valid amount'); return; }
  try{
    const res = await fetch('/api/vendor-adjustments', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: adjDate, vendor: vAdjModalVendor, adjType, amount, note: document.getElementById('vAdjNote').value.trim() }) });
    if(!res.ok){ const err = await res.json().catch(()=>({})); alert(err.error ? ('Could not save: '+err.error) : 'Could not save adjustment.'); return; }
  }catch(err){ alert('Could not reach the server: ' + (err&&err.message?err.message:err)); return; }
  closeVAdjModal();
  await load(); await loadTypeOptions();
  if(currentTab==='vendor') renderVendorLedger();
  if(currentTab==='pending') renderPending();
}

/* ============================= VENDOR ADVANCE MODAL ============================= */
function openVAdvModal(vendorName){
  vAdvModalVendor = vendorName;
  document.getElementById('vAdvModalVendor').textContent = 'For: ' + vendorName;
  document.getElementById('vAdvAmount').value = '';
  document.getElementById('vAdvNote').value = '';
  vAdvMethod = 'cash';
  document.getElementById('vAdvMethodCash').classList.add('active-yes');
  document.getElementById('vAdvMethodBank').classList.remove('active-yes');
  document.getElementById('vAdvBankField').style.display = 'none';
  const dateInput = document.getElementById('vAdvDate');
  if(isAdmin()){ dateInput.removeAttribute('min'); dateInput.removeAttribute('max'); }
  else { dateInput.min = addDays(todayStr(),-1); dateInput.max = todayStr(); }
  dateInput.value = todayStr();
  refreshAllAccountSelects();
  document.getElementById('vAdvModal').style.display = 'flex';
}
function closeVAdvModal(){ vAdvModalVendor = null; document.getElementById('vAdvModal').style.display='none'; }
function setVAdvMethod(m){
  vAdvMethod = m;
  document.getElementById('vAdvMethodCash').classList.toggle('active-yes', m==='cash');
  document.getElementById('vAdvMethodBank').classList.toggle('active-yes', m==='bank');
  document.getElementById('vAdvBankField').style.display = m==='bank' ? 'block' : 'none';
}
async function confirmVendorAdvance(){
  const amount = parseFloat(document.getElementById('vAdvAmount').value);
  const advDate = document.getElementById('vAdvDate').value || todayStr();
  if(!amount || amount<=0){ alert('Enter a valid amount'); return; }
  const body = { date: advDate, vendor: vAdvModalVendor, amount, method: vAdvMethod, note: document.getElementById('vAdvNote').value.trim() };
  if(vAdvMethod === 'bank') body.bankAccountId = document.getElementById('vAdvBankSelect').value;
  try{
    const res = await fetch('/api/vendor-advances', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if(!res.ok){ const err = await res.json().catch(()=>({})); alert(err.error ? ('Could not save: '+err.error) : 'Could not save advance.'); return; }
  }catch(err){ alert('Could not reach the server: ' + (err&&err.message?err.message:err)); return; }
  closeVAdvModal();
  await load(); await loadTypeOptions();
  if(currentTab==='vendor') renderVendorLedger();
  if(currentTab==='pending') renderPending();
}

/* ============================= DELETE ACTIONS ============================= */
async function delEntry(id){
  if(!isAdmin()){ alert('Only an admin can delete entries.'); return; }
  if(!confirm('Delete this entry? This cannot be undone.')) return;
  try{
    const res = await fetch('/api/entries/' + id, { method:'DELETE' });
    if(!res.ok){ alert('Could not delete.'); return; }
  }catch(err){ alert('Could not reach the server: ' + (err&&err.message?err.message:err)); return; }
  await load();
}
async function delPayment(pid){
  if(!isAdmin()){ alert('Only an admin can delete payments.'); return; }
  if(!confirm('Delete this payment?')) return;
  try{ await fetch('/api/payments/' + pid, { method:'DELETE' }); }catch(e){}
  await load();
}
async function delAdvance(id){
  if(!isAdmin()){ alert('Only an admin can delete advances.'); return; }
  if(!confirm('Delete this advance?')) return;
  try{ await fetch('/api/advances/' + id, { method:'DELETE' }); }catch(e){}
  await load();
}
async function delVendorAdvance(id){
  if(!isAdmin()){ alert('Only an admin can delete advances.'); return; }
  if(!confirm('Delete this advance?')) return;
  try{ await fetch('/api/vendor-advances/' + id, { method:'DELETE' }); }catch(e){}
  await load();
  if(currentTab==='vendor') renderVendorLedger();
  if(currentTab==='pending') renderPending();
}
async function delAdjustment(id){
  if(!isAdmin()){ alert('Only an admin can delete adjustments.'); return; }
  if(!confirm('Delete this adjustment?')) return;
  try{ await fetch('/api/client-adjustments/' + id, { method:'DELETE' }); }catch(e){}
  await load();
  if(currentTab==='ledger') renderLedger();
}
async function delVendorAdjustment(id){
  if(!isAdmin()){ alert('Only an admin can delete adjustments.'); return; }
  if(!confirm('Delete this adjustment?')) return;
  try{ await fetch('/api/vendor-adjustments/' + id, { method:'DELETE' }); }catch(e){}
  await load();
  if(currentTab==='vendor') renderVendorLedger();
  if(currentTab==='pending') renderPending();
}
