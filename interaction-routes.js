(function initializeInteractionRoutes(windowObject) {
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;

    let url;
    try {
      url = new URL(link.href, windowObject.location.href);
    } catch (_error) {
      return;
    }

    if (url.origin === windowObject.location.origin && url.pathname === '/puzzles') {
      event.preventDefault();
      windowObject.location.assign('/go/puzzles');
      return;
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('button').forEach((button) => {
      if (button.textContent.trim() !== 'Order Your Copy') return;
      button.addEventListener('click', () => windowObject.location.assign('/np'));
    });
  }, { once: true });
}(window));
