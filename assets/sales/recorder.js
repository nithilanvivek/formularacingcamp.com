(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const model = window.CampSales;
  let ledger = null, action = null, busy = false, pending = null;
  let siteKey = '', widgetId = null, scriptLoading = false, pageVerified = false, verifying = false;
  const newFilters = type => ({ type, channel: 'all', format: 'all', batchId: 'all', dateEnabled: false, date: model.localDay() });
  const recordFilters = newFilters('all'), editorFilters = newFilters('all');
  let editorSelection = '', editing = null;
  const titles = { batch: 'New batch', 'batch-sale': 'New batch sale', 'online-sale': 'New online stall sale', 'extra-cost': 'Add Extra Costs', editor: 'Record Editor' };
  const descriptions = {
    batch: ['A fresh starting line.', 'Record the total cost of the books you ordered. A batch number is assigned when you save.'],
    'batch-sale': ['Every book counts.', 'Choose the batch, format, quantity, and price per book. Your batch stock updates when the sale is saved.'],
    'online-sale': ['Your online stall, recorded.', 'Choose the format, quantity, and price per book. Online stall sales do not use batch stock.'],
    'extra-cost': ['Keep every expense counted.', 'Record stall taxes, delivery, or other costs paid by us. These reduce total profit without changing batch profits.'],
    editor: ['Keep your records in shape.', 'Find a batch, sale, or extra cost with the filters, then edit its details. Sales can also be deleted. Batch records stay in your ledger.']
  };

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function option(select, value, text) {
    const node = element('option', text);
    node.value = value;
    select.append(node);
  }
  function batchName(batch) { return batch ? `Batch ${String(batch.number).padStart(3, '0')}` : 'Unknown batch'; }
  function orderName(sale) { return `Order ${String(sale.number).padStart(4, '0')}`; }
  function channelName(sale) { return sale.channel === 'online' ? 'Online stall' : batchName(ledger.batches.find(batch => batch.id === sale.batchId)); }
  function dateLabel(date) { return new Date(date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) + ' IST'; }
  function moneyField(id, label) {
    return `<label for="${id}">${label} (INR)</label><div class="money"><span aria-hidden="true">₹</span><input id="${id}" type="text" inputmode="decimal" maxlength="10" autocomplete="off" placeholder="0.00" required aria-describedby="money-hint"></div><small id="money-hint" class="hint">Enter an amount greater than zero, with up to two decimal places.</small>`;
  }
  function quantityField(id, label, value = '') {
    return `<label for="${id}">${label}</label><input id="${id}" type="text" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="e.g. 40" value="${value}" required><small class="hint">Whole books only.</small>`;
  }
  function updateSaleDetails() {
    if (!$('quantity')) return;
    try { $('sale-total').textContent = 'Sale total: ' + model.money(model.parseMoney($('price').value) * model.parseQuantity($('quantity').value)); }
    catch { $('sale-total').textContent = 'Sale total: —'; }
    if ($('stock-hint')) {
      const batch = model.summary(ledger).batchProfits.find(batch => batch.id === $('batch-id').value);
      let available = batch?.booksLeft;
      if (batch && action === 'editor' && editing?.batchId === batch.id && editing.status === 'active') available += model.quantity(editing);
      $('stock-hint').textContent = !batch ? 'Choose a batch to see available stock.' : batch.booksOrdered === null ? 'Set this batch’s books ordered in Record Editor first.' : `${available} books available for this sale (${batch.booksOrdered} ordered).`;
    }
  }
  function updateSaveButton() {
    const noChoices = action === 'batch-sale' && !ledger?.batches.length || action === 'editor' && !editing;
    $('save-entry').disabled = busy || !ledger || !pageVerified || Boolean(noChoices);
  }
  function ensureChallenge() {
    if (pageVerified || widgetId !== null) return;
    if (!siteKey) { $('challenge-status').textContent = 'Bot verification is not configured. Please try again later.'; return; }
    if (!window.turnstile) {
      if (scriptLoading) return;
      scriptLoading = true;
      $('challenge-status').textContent = 'Loading bot verification…';
      window.campSalesChallengeReady = ensureChallenge;
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=campSalesChallengeReady';
      script.async = true;
      script.onerror = () => { scriptLoading = false; $('challenge-status').textContent = 'Bot verification could not load. Check your connection and try again.'; $('retry-verification').hidden = false; };
      document.head.append(script);
      return;
    }
    $('challenge-status').textContent = 'Complete this check to open the sales recorder.';
    widgetId = window.turnstile.render('#sales-challenge', {
      sitekey: siteKey, action: 'sales', size: 'normal',
      callback: verifyPage,
      'expired-callback': () => { if (!pageVerified) $('challenge-status').textContent = 'Verification expired. Please complete the check.'; },
      'error-callback': () => { if (!pageVerified) { $('challenge-status').textContent = 'Bot verification failed. Please try again.'; $('retry-verification').hidden = false; } }
    });
  }
  function showGate(data) {
    pageVerified = false;
    if (typeof data.turnstileSiteKey === 'string') siteKey = data.turnstileSiteKey;
    $('verification-gate').hidden = false;
    $('recorder-content').hidden = true;
    ensureChallenge();
  }
  function openRecorder() {
    pageVerified = true;
    $('verification-gate').hidden = true;
    $('recorder-content').hidden = false;
    if (widgetId !== null) { window.turnstile.remove(widgetId); widgetId = null; }
    renderRecords();
    // Keep an unfinished form when a session expires during a save.
    if (!$('entry-fields').childElementCount) renderForm();
    updateSaveButton();
  }
  async function verifyPage(token) {
    if (pageVerified || verifying) return;
    verifying = true;
    $('retry-verification').hidden = true;
    $('challenge-status').textContent = 'Opening your sales recorder…';
    try {
      ledger = await api({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify-page', turnstileToken: token }) });
      openRecorder();
      $('feedback').textContent = 'Records are up to date.';
    } catch (error) {
      $('challenge-status').textContent = error.message;
      $('retry-verification').hidden = false;
    } finally { verifying = false; }
  }
  function renderFilters(container, prefix, filters, allowType, onChange) {
    container.innerHTML = (allowType ? `<div><label for="${prefix}-type">Record type</label><select id="${prefix}-type"><option value="all">All records</option><option value="sale">Sales</option><option value="batch">Batches</option><option value="extra-cost">Extra costs</option></select></div>` : '') +
      (!['batch', 'extra-cost'].includes(filters.type) ? `<div><label for="${prefix}-channel">Sale channel</label><select id="${prefix}-channel"><option value="all">All channels</option><option value="online">Online stall</option><option value="batch">Batch sales</option></select></div><div><label for="${prefix}-format">Book format</label><select id="${prefix}-format"><option value="all">All formats</option><option>Paperback</option><option>Hardcover</option></select></div>` : '') +
      (filters.type === 'batch' || filters.channel === 'batch' ? `<div><label for="${prefix}-batch">Batch number</label><select id="${prefix}-batch"></select></div>` : '') +
      `<div class="date-filter"><label class="filter-toggle" for="${prefix}-date-enabled"><input type="checkbox" id="${prefix}-date-enabled">Filter by date</label><input type="date" id="${prefix}-date" aria-label="Recorded on, India time"><small class="hint">Recorded date · India time</small></div>`;
    if (allowType) $(prefix + '-type').value = filters.type;
    if ($(prefix + '-channel')) $(prefix + '-channel').value = filters.channel;
    if ($(prefix + '-format')) $(prefix + '-format').value = filters.format;
    if ($(prefix + '-batch')) {
      option($(prefix + '-batch'), 'all', 'All batches');
      for (const batch of ledger.batches) option($(prefix + '-batch'), batch.id, batchName(batch));
      $(prefix + '-batch').value = filters.batchId;
    }
    $(prefix + '-date-enabled').checked = filters.dateEnabled;
    $(prefix + '-date').value = filters.date;
    $(prefix + '-date').disabled = !filters.dateEnabled;
    container.onchange = event => {
      if (allowType) filters.type = $(prefix + '-type').value;
      filters.channel = $(prefix + '-channel')?.value || 'all';
      filters.format = $(prefix + '-format')?.value || 'all';
      filters.batchId = $(prefix + '-batch')?.value || 'all';
      filters.dateEnabled = $(prefix + '-date-enabled').checked;
      filters.date = $(prefix + '-date').value;
      if (allowType && event.target.id === prefix + '-type' && ['batch', 'extra-cost'].includes(filters.type)) { filters.channel = 'all'; filters.format = 'all'; }
      if (allowType && (event.target.id === prefix + '-channel' && filters.channel !== 'all' || event.target.id === prefix + '-format' && filters.format !== 'all')) filters.type = 'sale';
      if (filters.type !== 'batch' && filters.channel !== 'batch') filters.batchId = 'all';
      renderFilters(container, prefix, filters, allowType, onChange);
      onChange();
    };
  }
  function editorCandidates() {
    return [...ledger.batches.map(batch => ({ ...batch, kind: 'batch' })), ...ledger.sales.map(sale => ({ ...sale, kind: 'sale' })), ...ledger.extraCosts.map(cost => ({ ...cost, kind: 'extra-cost' }))].filter(record => model.matchesFilters(record, editorFilters));
  }
  function renderEditorOptions() {
    const select = $('editor-record');
    select.replaceChildren();
    option(select, '', 'Choose a record');
    const candidates = editorCandidates();
    for (const record of candidates) {
      const label = record.kind === 'extra-cost' ? `Extra cost · ${record.description} · ${model.money(record.costPaise)}` : record.kind === 'batch' ? `${batchName(record)} · ${model.money(record.costPaise)} cost` : `${orderName(record)} · ${channelName(record)} · ${record.format} · ${model.quantity(record)} books · ${model.money(model.saleTotal(record))}${record.paymentName ? ' · ' + record.paymentName : ''}${record.status === 'cancelled' ? ' · Cancelled' : ''}`;
      option(select, `${record.kind}:${record.id}`, label + ' · ' + dateLabel(record.createdAt));
    }
    if (candidates.some(record => `${record.kind}:${record.id}` === editorSelection)) select.value = editorSelection;
    else editorSelection = '';
    $('editor-hint').textContent = `${candidates.length} record${candidates.length === 1 ? '' : 's'} match your filters.`;
    renderEditorFields();
  }
  function renderEditorFields() {
    editorSelection = $('editor-record').value;
    editing = editorCandidates().find(record => `${record.kind}:${record.id}` === editorSelection) || null;
    const fields = $('edit-fields');
    fields.replaceChildren();
    if (!editing) { updateSaveButton(); return; }
    fields.append(element('p', `${editing.kind === 'extra-cost' ? 'Extra cost' : editing.kind === 'batch' ? batchName(editing) : orderName(editing)} · Recorded ${dateLabel(editing.createdAt)}`, 'field-note'));
    const controls = element('div');
    if (editing.kind === 'batch') {
      controls.innerHTML = quantityField('books-ordered', 'Books ordered') + moneyField('cost', 'Total cost of books ordered');
      fields.append(controls);
      $('cost').value = (editing.costPaise / 100).toFixed(2);
      $('books-ordered').value = editing.booksOrdered ?? '';
    } else if (editing.kind === 'extra-cost') {
      controls.innerHTML = extraCostFields();
      fields.append(controls);
      $('description').value = editing.description;
      $('cost').value = (editing.costPaise / 100).toFixed(2);
    } else {
      controls.innerHTML = '<label for="edit-channel">Sale channel</label><select id="edit-channel" required><option value="batch">Batch sale</option><option value="online">Online stall</option></select><div id="edit-batch-field"><label for="batch-id">Batch number</label><select id="batch-id"></select></div><label for="format">Paperback / Hardcover</label><select id="format" required><option>Paperback</option><option>Hardcover</option></select>' + quantityField('quantity', 'Quantity', 1) + moneyField('price', 'Price per book') + '<p id="sale-total" class="field-note">Sale total: —</p>' + '<label for="payment-name">Payment name <span>Optional</span></label><input id="payment-name" type="text" maxlength="80" autocomplete="off"><div class="editor-delete-row"><span>Remove this sale from your records.</span><button id="delete-sale" type="button" class="delete-icon" aria-label="Delete sale" title="Delete sale"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg></button></div><div id="delete-confirmation" class="notice" hidden><p>Delete this sale permanently? This cannot be undone.</p><div class="delete-confirm-buttons"><button id="keep-sale" type="button" class="secondary">Keep sale</button><button id="confirm-delete-sale" type="button" class="secondary delete-confirm">Delete sale</button></div></div>';
      fields.append(controls);
      $('edit-batch-field').append(element('small', '', 'hint'));
      $('edit-batch-field').lastChild.id = 'stock-hint';
      $('edit-channel').value = editing.channel;
      option($('batch-id'), '', 'Choose a batch');
      for (const batch of ledger.batches) option($('batch-id'), batch.id, batchName(batch));
      $('batch-id').value = editing.batchId || '';
      $('format').value = editing.format;
      $('price').value = (editing.pricePaise / 100).toFixed(2);
      $('quantity').value = model.quantity(editing);
      $('payment-name').value = editing.paymentName || '';
      if (editing.status === 'cancelled') fields.append(element('p', 'This is a previously cancelled sale. Editing its details keeps it excluded from sales totals.', 'field-note'));
      updateEditChannel();
      updateSaleDetails();
    }
    updateSaveButton();
  }
  function updateEditChannel() {
    const batchSale = $('edit-channel').value === 'batch';
    $('edit-batch-field').hidden = !batchSale;
    $('batch-id').required = batchSale;
  }
  function extraCostFields() {
    return '<label for="description">What is this cost for?</label><input id="description" type="text" maxlength="120" required autocomplete="off" placeholder="e.g. Delivery or taxes">' + moneyField('cost', 'Extra cost') + '<p class="field-note">For stall sales only. Record costs paid by us that buyers do not pay. Date and time are saved automatically.</p>';
  }
  function renderForm() {
    if (!action) return;
    $('entry-panel').hidden = false;
    $('entry-title').textContent = titles[action];
    $('entry-kind').textContent = titles[action].toUpperCase();
    $('preview-title').textContent = descriptions[action][0];
    $('preview-description').textContent = descriptions[action][1];
    $('entry-error').textContent = '';
    const fields = $('entry-fields'), button = $('save-entry');
    if (action === 'batch') {
      fields.innerHTML = '<p class="field-note">Record the books ordered and the total cost. Your batch number is created automatically.</p>' + quantityField('books-ordered', 'Books ordered') + moneyField('cost', 'Total cost of books ordered');
      button.textContent = 'Save batch ↗';
    } else if (action === 'extra-cost') {
      fields.innerHTML = extraCostFields();
      button.textContent = 'Save extra cost ↗';
    } else if (action === 'batch-sale' || action === 'online-sale') {
      fields.innerHTML = (action === 'batch-sale' ? '<label for="batch-id">Batch number</label><select id="batch-id" required></select><p id="batch-hint" class="hint"></p>' : '') +
        '<label for="format">Paperback / Hardcover</label><select id="format" required><option value="">Choose a format</option><option>Paperback</option><option>Hardcover</option></select>' + quantityField('quantity', 'Quantity', 1) + moneyField('price', 'Price per book') + '<p id="sale-total" class="field-note">Sale total: —</p>' +
        '<label for="payment-name">Payment name <span>Optional</span></label><input id="payment-name" type="text" maxlength="80" autocomplete="off" placeholder="e.g. Payment reference name"><p class="field-note">Date and time are saved automatically.</p>';
      if (action === 'batch-sale') {
        option($('batch-id'), '', 'Choose a batch');
        for (const batch of ledger?.batches || []) option($('batch-id'), batch.id, `${batchName(batch)} · ${model.money(batch.costPaise)} cost`);
        $('batch-hint').textContent = ledger?.batches.length ? '' : 'Add a new batch first to record a batch sale.';
        $('batch-hint').id = 'stock-hint';
      }
      button.textContent = 'Save sale ↗';
    } else {
      fields.innerHTML = '<div id="editor-filters" class="filter-controls" aria-label="Filter records to edit"></div><label for="editor-record">Record to edit</label><select id="editor-record" required></select><p id="editor-hint" class="hint"></p><div id="edit-fields"></div>';
      renderFilters($('editor-filters'), 'editor', editorFilters, true, renderEditorOptions);
      renderEditorOptions();
      button.textContent = 'Save changes ↗';
    }
    updateSaveButton();
  }
  function renderStats() {
    const summary = model.summary(ledger);
    $('extra-costs-total').textContent = 'Stall extra costs: ' + model.money(summary.extraCostsPaise);
    $('total-sales').textContent = model.money(summary.salesPaise);
    $('total-books').textContent = `${summary.booksSold.toLocaleString('en-IN')} ${summary.booksSold === 1 ? 'book' : 'books'} sold`;
    $('total-profit').textContent = model.money(summary.profitPaise);
    $('author-profit').textContent = model.money(summary.profitPaise / 6);
    for (const id of ['total-profit', 'author-profit']) $(id).classList.toggle('negative', summary.profitPaise < 0);
    const container = $('batch-profits');
    container.replaceChildren();
    if (!summary.batchProfits.length) {
      container.append(element('p', 'No batches yet. Add your first batch below.', 'empty-records'));
      return;
    }
    const scroll = element('div', undefined, 'table-scroll');
    const table = element('table', undefined, 'profit-table');
    const thead = element('thead'), head = element('tr');
    for (const title of ['Batch', 'Cost', 'Sales', 'Profit', 'Ordered', 'Sold', 'Left']) {
      const th = element('th', title); th.scope = 'col'; head.append(th);
    }
    thead.append(head);
    const tbody = element('tbody');
    for (const batch of summary.batchProfits) {
      const row = element('tr');
      row.append(element('td', batchName(batch)), element('td', model.money(batch.costPaise)), element('td', model.money(batch.revenuePaise)), element('td', model.money(batch.profitPaise), batch.profitPaise < 0 ? 'negative' : 'positive'));
      row.append(element('td', batch.booksOrdered ?? 'Not set'), element('td', batch.booksSold), element('td', batch.booksLeft ?? 'Not set', 'books-left'));
      tbody.append(row);
    }
    table.append(thead, tbody); scroll.append(table); container.append(scroll);
  }
  function renderRecords() {
    $('storage-label').textContent = 'Saved on the server · IST';
    renderStats();
    const container = $('records');
    container.replaceChildren();
    renderFilters($('record-filters'), 'record', recordFilters, true, renderRecords);
    const all = [...ledger.batches.map(batch => ({ ...batch, kind: 'batch' })), ...ledger.sales.map(sale => ({ ...sale, kind: 'sale' })), ...ledger.extraCosts.map(cost => ({ ...cost, kind: 'extra-cost' }))];
    const entries = all.filter(entry => model.matchesFilters(entry, recordFilters)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    $('records-filter-status').textContent = `Showing ${entries.length} of ${all.length} records. Overview and Excel export include all records.`;
    if (!entries.length) container.append(element('p', all.length ? 'No records match these filters.' : 'Your first record starts here. Choose an action above.', 'empty-records'));
    else {
      const list = element('ul', undefined, 'record-list');
      for (const entry of entries) {
        const row = element('li', undefined, 'record-row' + (entry.status === 'cancelled' ? ' cancelled' : ''));
        const detail = element('div');
        detail.append(element('strong', entry.kind === 'extra-cost' ? 'Extra cost · ' + entry.description : entry.kind === 'batch' ? batchName(entry) : `${orderName(entry)} · ${entry.status === 'cancelled' ? 'Cancelled' : 'Sale'}`));
        detail.append(element('small', entry.kind === 'extra-cost' ? `Online stall expense · ${dateLabel(entry.createdAt)}` : entry.kind === 'batch' ? `${entry.booksOrdered ?? 'Quantity not set'} books ordered · ${dateLabel(entry.createdAt)}` : `${channelName(entry)} · ${entry.format} · ${model.quantity(entry)} books × ${model.money(entry.pricePaise)} · ${dateLabel(entry.createdAt)}`));
        if (entry.paymentName) detail.append(element('small', `Payment name: ${entry.paymentName}`));
        if (entry.cancelledAt) detail.append(element('small', `Cancelled ${dateLabel(entry.cancelledAt)}`));
        if (entry.updatedAt) detail.append(element('small', `Edited ${dateLabel(entry.updatedAt)}`));
        row.append(detail, element('span', model.money(entry.kind !== 'sale' ? entry.costPaise : model.saleTotal(entry)), 'record-amount'));
        list.append(row);
      }
      container.append(list);
    }
    $('export').disabled = busy;
  }
  async function api(options) {
    const response = await fetch('/api/sales-data', { cache: 'no-store', ...options });
    const data = await response.json();
    if (response.status === 401 && data.verificationRequired) {
      showGate(data);
      throw Object.assign(new Error(data.error), { verificationRequired: true });
    }
    if (!response.ok) throw new Error(data.error || 'Could not save your record. Please try again.');
    if (data.version !== 1 || !Array.isArray(data.batches) || !Array.isArray(data.sales) || (data.extraCosts !== undefined && !Array.isArray(data.extraCosts))) throw new Error('The server returned an invalid record. Try refreshing.');
    return { version: data.version, revision: data.revision, batches: data.batches, sales: data.sales, extraCosts: data.extraCosts || [] };
  }
  function setBusy(value) {
    busy = value;
    for (const button of document.querySelectorAll('[data-action], #refresh, #export')) button.disabled = value;
    for (const field of $('entry-fields').querySelectorAll('input, select, button')) field.disabled = value;
    if ($('editor-date')) $('editor-date').disabled = value || !editorFilters.dateEnabled;
    $('entry-form').setAttribute('aria-busy', String(value));
    updateSaveButton();
    if (!ledger) $('export').disabled = true;
  }
  async function load() {
    setBusy(true);
    $('feedback').textContent = 'Loading records…';
    try {
      ledger = await api();
      openRecorder();
      renderForm();
      $('feedback').textContent = 'Records are up to date.';
    } catch (error) {
      if (error.verificationRequired) return;
      $('feedback').textContent = error.message;
      if (!pageVerified) { $('challenge-status').textContent = error.message; $('retry-verification').hidden = false; }
      if (!ledger) {
        $('storage-label').textContent = 'Unable to connect';
        $('records').textContent = 'Records could not be loaded. Use Refresh records to try again.';
        $('batch-profits').textContent = 'Batch profits are unavailable until records load.';
        $('total-books').textContent = 'Unable to load';
      }
    } finally { setBusy(false); }
  }
  for (const button of document.querySelectorAll('[data-action]')) {
    button.addEventListener('click', () => {
      if (busy) return;
      action = button.dataset.action;
      for (const item of document.querySelectorAll('[data-action]')) item.setAttribute('aria-pressed', String(item === button));
      renderForm(); $('entry-title').focus();
    });
  }
  $('entry-form').addEventListener('input', event => {
    event.target.removeAttribute('aria-invalid'); $('entry-error').textContent = '';
    updateSaleDetails();
  });
  $('entry-form').addEventListener('change', event => {
    if (event.target.id === 'editor-record') renderEditorFields();
    if (event.target.id === 'edit-channel') updateEditChannel();
    if (['edit-channel', 'batch-id'].includes(event.target.id)) updateSaleDetails();
  });
  $('entry-form').addEventListener('click', async event => {
    if (busy || !pageVerified || action !== 'editor' || editing?.kind !== 'sale') return;
    const button = event.target.closest('button');
    if (button?.id === 'delete-sale') {
      $('delete-confirmation').hidden = false;
      $('confirm-delete-sale').focus();
    } else if (button?.id === 'keep-sale') {
      $('delete-confirmation').hidden = true;
      $('delete-sale').focus();
    } else if (button?.id === 'confirm-delete-sale') {
      await persist({ action: 'delete-sale', recordId: editing.id, expectedVersion: editing.recordVersion || 0 });
    }
  });
  $('entry-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !ledger || $('save-entry').disabled) return;
    $('entry-error').textContent = '';
    for (const field of $('entry-fields').querySelectorAll('[required]')) {
      if (!field.checkValidity()) {
        field.setAttribute('aria-invalid', 'true');
        $('entry-error').textContent = 'Complete the highlighted field.';
        field.focus(); return;
      }
      field.removeAttribute('aria-invalid');
    }
    const data = { action };
    const isBatch = action === 'batch' || action === 'editor' && editing?.kind === 'batch';
    const isExtraCost = action === 'extra-cost' || action === 'editor' && editing?.kind === 'extra-cost';
    const amountField = isBatch || isExtraCost ? $('cost') : $('price');
    if (amountField) {
      try { model.parseMoney(amountField.value); }
      catch (error) { amountField.setAttribute('aria-invalid', 'true'); $('entry-error').textContent = error.message; amountField.focus(); return; }
    }
    if (action === 'editor') {
      data.action = editing.kind === 'extra-cost' ? 'edit-extra-cost' : editing.kind === 'batch' ? 'edit-batch' : 'edit-sale';
      data.recordId = editing.id;
      data.expectedVersion = editing.recordVersion || 0;
    }
    const count = $(isBatch ? 'books-ordered' : 'quantity');
    if (!isExtraCost) {
      try { model.parseQuantity(count.value); }
      catch (error) { count.setAttribute('aria-invalid', 'true'); $('entry-error').textContent = error.message; count.focus(); return; }
    }
    if (isExtraCost) { data.cost = $('cost').value.trim(); data.description = $('description').value.trim(); }
    else if (isBatch) { data.cost = $('cost').value.trim(); data.booksOrdered = count.value.trim(); }
    else {
      data.quantity = count.value.trim();
      data.format = $('format').value; data.price = $('price').value.trim(); data.paymentName = $('payment-name').value.trim();
      if (action === 'editor') data.channel = $('edit-channel').value;
      if (action === 'batch-sale' || data.channel === 'batch') data.batchId = $('batch-id').value;
    }
    await persist(data);
  });
  async function persist(data) {
    const signature = JSON.stringify(data);
    if (!pending || pending.signature !== signature) pending = { signature, requestId: crypto.randomUUID() };
    data.requestId = pending.requestId;
    setBusy(true); $('feedback').textContent = 'Saving…';
    try {
      ledger = await api({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      pending = null;
      if (data.action === 'delete-sale') { editorSelection = ''; editing = null; }
      renderRecords(); renderForm();
      $('feedback').textContent = data.action === 'batch' ? 'Batch saved. You can now select it for a batch sale.' : data.action === 'delete-sale' ? 'Sale deleted. Your totals have been updated.' : data.action.startsWith('edit-') ? 'Changes saved. Your totals have been updated.' : data.action === 'extra-cost' ? 'Extra cost saved. Your totals have been updated.' : 'Sale saved. Your totals have been updated.';
    } catch (error) {
      $('feedback').textContent = ''; $('entry-error').textContent = error.message + ' Your form is still here; try again.';
    } finally {
      setBusy(false);
    }
  }
  $('refresh').addEventListener('click', load);
  $('retry-verification').addEventListener('click', async () => {
    if (verifying) return;
    if (widgetId !== null) { window.turnstile.remove(widgetId); widgetId = null; }
    await load();
  });
  $('export').addEventListener('click', () => {
    if (!ledger) return;
    try {
      const url = URL.createObjectURL(window.CampSalesWorkbook.create(ledger)), anchor = document.createElement('a');
      anchor.href = url; anchor.download = `formula-racing-camp-sales-${new Date().toISOString().slice(0, 10)}.xlsx`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      $('feedback').textContent = 'Excel workbook exported.';
    } catch (error) { $('feedback').textContent = 'Export failed: ' + error.message; }
  });
  load();
})();
