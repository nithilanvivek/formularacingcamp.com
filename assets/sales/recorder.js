(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const model = window.CampSales;
  let ledger = null, action = null, busy = false, pending = null;
  let siteKey = '', challengeToken = '', widgetId = null, scriptLoading = false;
  const titles = { batch: 'New batch', 'batch-sale': 'New batch sale', 'online-sale': 'New online stall sale', cancel: 'Cancel order' };
  const descriptions = {
    batch: ['A fresh starting line.', 'Record the total cost of the books you ordered. A batch number is assigned when you save.'],
    'batch-sale': ['One book. One happy reader.', 'Choose the batch, book format, and selling price. Each record is a sale of one book.'],
    'online-sale': ['Your online stall, recorded.', 'Choose the book format and selling price. Each record is a sale of one book, without a batch.'],
    cancel: ['Keep the history. Update the totals.', 'Cancelled orders stay in your records and are removed from sales and profit totals. Batch costs stay the same.']
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
  function updateSaveButton() {
    const noChoices = action === 'batch-sale' && !ledger?.batches.length || action === 'cancel' && !ledger?.sales.some(sale => sale.status === 'active');
    $('save-entry').disabled = busy || !ledger || !challengeToken || Boolean(noChoices);
  }
  function ensureChallenge() {
    if (!action || widgetId !== null) return;
    if (!siteKey) { $('challenge-status').textContent = 'Bot verification is not configured. Saving is unavailable.'; return; }
    if (!window.turnstile) {
      if (scriptLoading) return;
      scriptLoading = true;
      $('challenge-status').textContent = 'Loading bot verification…';
      window.campSalesChallengeReady = ensureChallenge;
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=campSalesChallengeReady';
      script.async = true;
      script.onerror = () => { scriptLoading = false; $('challenge-status').textContent = 'Bot verification could not load. Check your connection and refresh.'; };
      document.head.append(script);
      return;
    }
    widgetId = window.turnstile.render('#sales-challenge', {
      sitekey: siteKey, action: 'sales', size: 'flexible',
      callback: token => { challengeToken = token; $('challenge-status').textContent = 'Bot verification complete.'; updateSaveButton(); },
      'expired-callback': () => { challengeToken = ''; $('challenge-status').textContent = 'Verification expired. Please verify again.'; updateSaveButton(); },
      'error-callback': () => { challengeToken = ''; $('challenge-status').textContent = 'Bot verification failed. Please try again.'; updateSaveButton(); }
    });
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
    button.classList.toggle('danger', action === 'cancel');
    if (action === 'batch') {
      fields.innerHTML = '<p class="field-note">Record the total cost of your book order. Your batch number is created automatically.</p>' + moneyField('cost', 'Cost of books ordered');
      button.textContent = 'Save batch ↗';
    } else if (action === 'batch-sale' || action === 'online-sale') {
      fields.innerHTML = (action === 'batch-sale' ? '<label for="batch-id">Batch number</label><select id="batch-id" required></select><p id="batch-hint" class="hint"></p>' : '') +
        '<label for="format">Paperback / Hardcover</label><select id="format" required><option value="">Choose a format</option><option>Paperback</option><option>Hardcover</option></select>' + moneyField('price', 'Price sold at') +
        '<label for="payment-name">Payment name <span>Optional</span></label><input id="payment-name" type="text" maxlength="80" autocomplete="off" placeholder="e.g. Payment reference name"><p class="field-note">One sale records one book. Date and time are saved automatically.</p>';
      if (action === 'batch-sale') {
        option($('batch-id'), '', 'Choose a batch');
        for (const batch of ledger?.batches || []) option($('batch-id'), batch.id, `${batchName(batch)} · ${model.money(batch.costPaise)} cost`);
        $('batch-hint').textContent = ledger?.batches.length ? '' : 'Add a new batch first to record a batch sale.';
      }
      button.textContent = 'Save sale ↗';
    } else {
      fields.innerHTML = '<label for="order-id">Order to cancel</label><select id="order-id" required></select><p id="cancel-hint" class="hint"></p><label class="confirm-row" for="confirm-cancel"><input id="confirm-cancel" type="checkbox" required><span>I confirm this order should be cancelled.</span></label>';
      option($('order-id'), '', 'Choose an active order');
      for (const sale of ledger?.sales.filter(item => item.status === 'active') || []) {
        option($('order-id'), sale.id, `${orderName(sale)} · ${channelName(sale)} · ${sale.format} · ${model.money(sale.pricePaise)}${sale.paymentName ? ' · ' + sale.paymentName : ''} · ${dateLabel(sale.createdAt)}`);
      }
      $('cancel-hint').textContent = ledger?.sales.some(sale => sale.status === 'active') ? 'The cancellation is saved when you confirm below.' : 'There are no active orders to cancel.';
      button.textContent = 'Cancel selected order ↶';
    }
    updateSaveButton();
    ensureChallenge();
  }
  function renderStats() {
    const summary = model.summary(ledger);
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
    for (const title of ['Batch', 'Cost', 'Sales', 'Profit']) {
      const th = element('th', title); th.scope = 'col'; head.append(th);
    }
    thead.append(head);
    const tbody = element('tbody');
    for (const batch of summary.batchProfits) {
      const row = element('tr');
      row.append(element('td', batchName(batch)), element('td', model.money(batch.costPaise)), element('td', model.money(batch.revenuePaise)), element('td', model.money(batch.profitPaise), batch.profitPaise < 0 ? 'negative' : 'positive'));
      tbody.append(row);
    }
    table.append(thead, tbody); scroll.append(table); container.append(scroll);
  }
  function renderRecords() {
    $('storage-label').textContent = 'Saved on the server · IST';
    renderStats();
    const container = $('records');
    container.replaceChildren();
    const entries = [...ledger.batches.map(batch => ({ ...batch, kind: 'batch' })), ...ledger.sales.map(sale => ({ ...sale, kind: 'sale' }))].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!entries.length) container.append(element('p', 'Your first record starts here. Choose an action above.', 'empty-records'));
    else {
      const list = element('ul', undefined, 'record-list');
      for (const entry of entries) {
        const row = element('li', undefined, 'record-row' + (entry.status === 'cancelled' ? ' cancelled' : ''));
        const detail = element('div');
        detail.append(element('strong', entry.kind === 'batch' ? batchName(entry) : `${orderName(entry)} · ${entry.status === 'cancelled' ? 'Cancelled' : 'Sale'}`));
        detail.append(element('small', entry.kind === 'batch' ? `Books ordered · ${dateLabel(entry.createdAt)}` : `${channelName(entry)} · ${entry.format} · ${dateLabel(entry.createdAt)}`));
        if (entry.paymentName) detail.append(element('small', `Payment name: ${entry.paymentName}`));
        if (entry.cancelledAt) detail.append(element('small', `Cancelled ${dateLabel(entry.cancelledAt)}`));
        row.append(detail, element('span', model.money(entry.kind === 'batch' ? entry.costPaise : entry.pricePaise), 'record-amount'));
        list.append(row);
      }
      container.append(list);
    }
    $('export').disabled = busy;
  }
  async function api(options) {
    const response = await fetch('/api/sales-data', { cache: 'no-store', ...options });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not save your record. Please try again.');
    if (data.version !== 1 || !Array.isArray(data.batches) || !Array.isArray(data.sales)) throw new Error('The server returned an invalid record. Try refreshing.');
    if (typeof data.turnstileSiteKey === 'string') siteKey = data.turnstileSiteKey;
    return { version: data.version, revision: data.revision, batches: data.batches, sales: data.sales };
  }
  function setBusy(value) {
    busy = value;
    for (const button of document.querySelectorAll('[data-action], #refresh, #export')) button.disabled = value;
    for (const field of $('entry-fields').querySelectorAll('input, select')) field.disabled = value;
    $('entry-form').setAttribute('aria-busy', String(value));
    updateSaveButton();
    if (!ledger) $('export').disabled = true;
  }
  async function load() {
    setBusy(true);
    $('feedback').textContent = 'Loading records…';
    try {
      ledger = await api();
      renderRecords(); renderForm();
      $('feedback').textContent = 'Records are up to date.';
    } catch (error) {
      $('feedback').textContent = error.message;
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
  });
  $('entry-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !ledger || $('save-entry').disabled) return;
    $('entry-error').textContent = '';
    for (const field of $('entry-fields').querySelectorAll('[required]')) {
      if (!field.checkValidity()) {
        field.setAttribute('aria-invalid', 'true');
        $('entry-error').textContent = field.type === 'checkbox' ? 'Confirm the cancellation before continuing.' : 'Complete the highlighted field.';
        field.focus(); return;
      }
      field.removeAttribute('aria-invalid');
    }
    const data = { action };
    const amountField = action === 'batch' ? $('cost') : action === 'cancel' ? null : $('price');
    if (amountField) {
      try { model.parseMoney(amountField.value); }
      catch (error) { amountField.setAttribute('aria-invalid', 'true'); $('entry-error').textContent = error.message; amountField.focus(); return; }
    }
    if (action === 'batch') data.cost = $('cost').value.trim();
    else if (action === 'cancel') data.orderId = $('order-id').value;
    else {
      data.format = $('format').value; data.price = $('price').value.trim(); data.paymentName = $('payment-name').value.trim();
      if (action === 'batch-sale') data.batchId = $('batch-id').value;
    }
    const signature = JSON.stringify(data);
    if (!pending || pending.signature !== signature) pending = { signature, requestId: crypto.randomUUID() };
    data.requestId = pending.requestId;
    data.turnstileToken = challengeToken;
    setBusy(true); $('feedback').textContent = 'Saving…';
    try {
      ledger = await api({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      pending = null;
      renderRecords(); renderForm();
      $('feedback').textContent = action === 'batch' ? 'Batch saved. You can now select it for a batch sale.' : action === 'cancel' ? 'Order cancelled. Your totals have been updated.' : 'Sale saved. Your totals have been updated.';
    } catch (error) {
      $('feedback').textContent = ''; $('entry-error').textContent = error.message + ' Your form is still here; try again.';
    } finally {
      challengeToken = '';
      if (widgetId !== null) window.turnstile.reset(widgetId);
      setBusy(false);
    }
  });
  $('refresh').addEventListener('click', load);
  $('export').addEventListener('click', () => {
    if (!ledger) return;
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...ledger }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = `formula-racing-camp-sales-${new Date().toISOString().slice(0, 10)}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  load();
})();
