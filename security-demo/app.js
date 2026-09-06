const startButton = document.getElementById('start');
const phase = document.getElementById('phase');
const timeline = document.getElementById('timeline');
const token = document.body.dataset.demoToken;
let renderedLogs = 0;

function formatTime(isoTime) {
  return new Intl.DateTimeFormat([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(isoTime));
}

function render(state) {
  phase.textContent = state.phase.toUpperCase();
  phase.parentElement.dataset.phase = state.phase;
  startButton.disabled = state.attemptActive;
  if (state.attemptActive) {
    startButton.innerHTML = `ATTEMPT ${state.attemptCount} RUNNING <span>…</span>`;
  } else if (state.attemptCount > 0) {
    startButton.innerHTML = 'START NEXT ATTEMPT <span>→</span>';
  }

  state.logs.slice(renderedLogs).forEach((entry) => {
    const item = document.createElement('li');
    item.className = entry.tone;

    const time = document.createElement('time');
    time.dateTime = entry.at;
    time.textContent = formatTime(entry.at);

    const message = document.createElement('span');
    message.textContent = entry.message;

    item.append(time, message);
    timeline.append(item);
    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  renderedLogs = state.logs.length;
}

async function refresh() {
  try {
    const response = await fetch('/api/state', { cache: 'no-store' });
    if (response.ok) render(await response.json());
  } catch {}
}

startButton.addEventListener('click', async () => {
  const approved = window.confirm('This will open Chrome, click the Turnstile checkbox once if shown, and may send one real security-test email. Start the controlled attempt?');
  if (!approved) return;

  startButton.disabled = true;
  const response = await fetch('/api/start', {
    method: 'POST',
    headers: { 'X-Demo-Token': token }
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    window.alert(result.error === 'attempt_in_progress'
      ? 'An attempt is already running. Wait for it to finish before starting another.'
      : 'The demo could not start.');
  }
  await refresh();
});

refresh();
setInterval(refresh, 500);
