(function initializeInteractionRoutes(windowObject) {
  const retailerStores = {
    'retailer-amazon': 'amazon_print',
    'retailer-kindle': 'amazon_kindle',
    'retailer-flipkart': 'flipkart',
    'retailer-notion': 'notion_press'
  };

  function retailerFor(link) {
    return Object.keys(retailerStores).find((className) => link.classList.contains(className));
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;

    const retailerClass = retailerFor(link);
    if (retailerClass) {
      event.preventDefault();
      windowObject.location.assign(`/go/book?store=${retailerStores[retailerClass]}`);
      return;
    }

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

    if (url.hostname.includes('youtube.com') || url.hostname === 'youtu.be' || url.hostname === 'tinyurl.com') {
      event.preventDefault();
      windowObject.location.assign('/go/youtube');
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('button').forEach((button) => {
      if (button.textContent.trim() !== 'Order Your Copy') return;
      button.addEventListener('click', () => windowObject.location.assign('/go/book?store=notion_press'));
    });
  }, { once: true });
}(window));
