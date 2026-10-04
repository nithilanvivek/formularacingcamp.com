(function initializeDashboard() {
  const state = { days: 30 };
  const dashboardStatus = document.getElementById('dashboard-status');
  const sampleBadge = document.getElementById('sample-badge');

  function formatNumber(value) {
    return new Intl.NumberFormat('en-IN').format(Number(value || 0));
  }

  function valueOf(row, keys) {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
    }
    return 'Unknown';
  }

  async function loadDashboard() {
    dashboardStatus.textContent = 'Loading analytics…';
    try {
      const response = await fetch(`/api/analytics-data?days=${state.days}`, { cache: 'no-store', credentials: 'same-origin' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Analytics could not be loaded.');
      render(payload);
      sampleBadge.hidden = !payload.sample;
      dashboardStatus.textContent = payload.sample
        ? `Showing clearly labeled localhost sample data for the last ${payload.range.days} days`
        : !payload.actionsAvailable
          ? 'Traffic loaded; interaction counters are temporarily unavailable'
        : payload.waitingForVisitorData
          ? 'Waiting for more visitor data'
          : payload.range.limited
            ? `Showing the latest ${payload.range.availableDays} days available on Vercel Hobby (the ${payload.range.days}-day filter is selected)`
          : `Showing real production data for the last ${payload.range.days} days`;
    } catch (error) {
      dashboardStatus.textContent = error.message;
    }
  }

  function render(payload) {
    document.getElementById('visitors-total').textContent = formatNumber(payload.summary.visitors);
    document.getElementById('pageviews-total').textContent = formatNumber(payload.summary.pageviews);
    document.getElementById('preview-readers-total').textContent = formatNumber(payload.preview?.visitors);
    document.getElementById('interactions-total').textContent = formatNumber(payload.summary.interactions);
    document.getElementById('action-types-total').textContent = formatNumber(payload.summary.actionTypes);

    renderChart(payload.trend || []);
    renderRankedList('top-pages', payload.topPages, {
      label: (row) => valueOf(row, ['requestPath', 'route']),
      detail: (row) => `${formatNumber(row.visitors)} visitors`,
      metric: 'pageviews'
    });
    renderRankedList('referrer-list', payload.referrers, {
      label: (row) => valueOf(row, ['referrerHostname', 'referrer']),
      detail: (row) => `${formatNumber(row.pageviews)} page views`,
      metric: 'visitors'
    });
    renderRankedList('device-list', payload.devices, {
      label: (row) => valueOf(row, ['deviceType']),
      detail: (row) => `${formatNumber(row.pageviews)} page views`,
      metric: 'visitors'
    });
    renderRankedList('browser-list', payload.browsers, {
      label: (row) => valueOf(row, ['browserName', 'clientName']),
      detail: (row) => `${formatNumber(row.pageviews)} page views`,
      metric: 'visitors'
    });
    renderActions(payload.actions || []);

    document.getElementById('updated-at').textContent = `Updated ${new Date(payload.generatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`;
  }

  function renderRankedList(elementId, rows = [], options) {
    const container = document.getElementById(elementId);
    container.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-row';
      empty.textContent = 'Waiting for more visitor data';
      container.append(empty);
      return;
    }

    const maximum = Math.max(...rows.map((row) => Number(row[options.metric] || 0)), 1);
    rows.forEach((row) => {
      const item = document.createElement('div');
      item.className = 'rank-row';
      const label = document.createElement('div');
      label.className = 'rank-label';
      const title = document.createElement('strong');
      title.textContent = options.label(row);
      label.append(title);
      if (options.detail) {
        const detail = document.createElement('span');
        detail.textContent = options.detail(row);
        label.append(detail);
      }
      const value = document.createElement('span');
      value.className = 'rank-value';
      value.textContent = formatNumber(row[options.metric]);
      const bar = document.createElement('div');
      bar.className = 'rank-bar';
      const fill = document.createElement('span');
      fill.style.width = `${Math.max(3, Number(row[options.metric] || 0) / maximum * 100)}%`;
      bar.append(fill);
      item.append(label, value, bar);
      container.append(item);
    });
  }

  function renderActions(actions) {
    const container = document.getElementById('action-list');
    container.replaceChildren();
    if (!actions.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-row';
      empty.textContent = 'Waiting for more visitor data';
      container.append(empty);
      return;
    }

    actions.forEach((action) => {
      const card = document.createElement('article');
      card.className = 'event-card';
      const top = document.createElement('div');
      top.className = 'event-card__top';
      const title = document.createElement('h3');
      title.textContent = valueOf(action, ['name']);
      const count = document.createElement('span');
      count.className = 'event-count';
      count.textContent = formatNumber(action.count);
      top.append(title, count);
      const meta = document.createElement('p');
      meta.className = 'event-meta';
      meta.textContent = action.detail || 'Tracked interaction';
      card.append(top, meta);
      const route = document.createElement('p');
      route.className = 'action-route';
      route.textContent = action.metricLabel || 'actions';
      card.append(route);
      container.append(card);
    });
  }

  function svgElement(name, attributes = {}) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    return element;
  }

  function renderChart(rows) {
    const container = document.getElementById('traffic-chart');
    container.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-row';
      empty.textContent = 'Waiting for more visitor data';
      container.append(empty);
      return;
    }

    const width = 1000;
    const height = 240;
    const padding = { top: 14, right: 10, bottom: 28, left: 10 };
    const max = Math.max(...rows.flatMap((row) => [Number(row.pageviews || 0), Number(row.visitors || 0)]), 1);
    const x = (index) => padding.left + index * ((width - padding.left - padding.right) / Math.max(rows.length - 1, 1));
    const y = (value) => height - padding.bottom - Number(value) / max * (height - padding.top - padding.bottom);
    const points = (field) => rows.map((row, index) => `${x(index)},${y(row[field])}`).join(' ');

    const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Daily page views and visitors chart' });
    const defs = svgElement('defs');
    const gradient = svgElement('linearGradient', { id: 'views-gradient', x1: 0, y1: 0, x2: 0, y2: 1 });
    gradient.append(svgElement('stop', { offset: 0, 'stop-color': '#159ff3', 'stop-opacity': '.24' }), svgElement('stop', { offset: 1, 'stop-color': '#159ff3', 'stop-opacity': '0' }));
    defs.append(gradient);
    svg.append(defs);

    [max, max / 2, 0].forEach((value) => svg.append(svgElement('line', { class: 'chart-grid', x1: padding.left, y1: y(value), x2: width - padding.right, y2: y(value) })));
    const areaPoints = `${padding.left},${height - padding.bottom} ${points('pageviews')} ${x(rows.length - 1)},${height - padding.bottom}`;
    svg.append(svgElement('polygon', { class: 'chart-area', points: areaPoints }));
    svg.append(svgElement('polyline', { class: 'chart-line chart-line--views', points: points('pageviews') }));
    svg.append(svgElement('polyline', { class: 'chart-line chart-line--visitors', points: points('visitors') }));

    const labelIndexes = [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])];
    labelIndexes.forEach((index) => {
      const label = svgElement('text', { class: 'chart-label', x: x(index), y: height - 4, 'text-anchor': index === 0 ? 'start' : index === rows.length - 1 ? 'end' : 'middle' });
      label.textContent = new Date(rows[index].timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      svg.append(label);
    });

    rows.forEach((row, index) => {
      ['pageviews', 'visitors'].forEach((field) => {
        const dot = svgElement('circle', { class: `chart-dot chart-dot--${field === 'pageviews' ? 'views' : 'visitors'}`, cx: x(index), cy: y(row[field]), r: rows.length > 35 ? 1.4 : 2.5 });
        const title = svgElement('title');
        title.textContent = `${new Date(row.timestamp).toLocaleDateString('en-IN')}: ${formatNumber(row[field])} ${field === 'pageviews' ? 'page views' : 'visitors'}`;
        dot.append(title);
        svg.append(dot);
      });
    });
    container.append(svg);
  }

  document.querySelectorAll('[data-range]').forEach((button) => {
    button.addEventListener('click', () => {
      state.days = Number(button.dataset.range);
      document.querySelectorAll('[data-range]').forEach((item) => {
        const active = item === button;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      loadDashboard();
    });
  });
  document.getElementById('refresh-button').addEventListener('click', loadDashboard);
  loadDashboard();
}());
