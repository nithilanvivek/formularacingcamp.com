(function initializeInteractionCounter(windowObject) {
  function trackAction(action, properties = {}) {
    const body = JSON.stringify({ action, ...properties });
    if (navigator.sendBeacon) {
      return navigator.sendBeacon('/api/track-action', new Blob([body], { type: 'application/json' }));
    }
    fetch('/api/track-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      keepalive: true,
      body
    }).catch(() => {});
    return true;
  }

  windowObject.frcTrackAction = trackAction;
}(window));
