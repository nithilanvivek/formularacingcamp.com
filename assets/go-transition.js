(function initializeTransition(windowObject) {
  const bookDestinations = {
    amazon_print: { name: 'Amazon paperback', url: 'https://www.amazon.in/dp/B0H8ZYFV7Q' },
    amazon_kindle: { name: 'Amazon Kindle', url: 'https://www.amazon.in/dp/B0H7TH9QW6' },
    flipkart: { name: 'Flipkart', url: 'https://www.flipkart.com/search?q=Formula%20Racing%20Camp%20book' },
    notion_press: { name: 'Notion Press', url: 'https://notionpress.com/in/read/formula-racing-camp' }
  };
  const transition = document.body.dataset.transition;
  const destinations = {
    puzzles: { name: 'F1 puzzles', url: '/puzzles' },
    youtube: { name: 'YouTube channel', url: 'https://youtube.com/@WhereF1RulesTheWorld' }
  };
  const selectedStore = document.documentElement.dataset.store;
  const destination = transition === 'book'
    ? (bookDestinations[selectedStore] || bookDestinations.notion_press)
    : destinations[transition];
  const name = document.getElementById('destination-name');
  const link = document.getElementById('continue-link');

  if (!destination || !name || !link) return;
  name.textContent = destination.name;
  link.href = destination.url;
  link.setAttribute('aria-label', `Continue to ${destination.name}`);

  if (transition === 'book') {
    const store = bookDestinations[selectedStore] ? selectedStore : 'notion_press';
    windowObject.frcTrackAction?.('book_store_selected', { store });
  } else if (transition === 'puzzles') {
    windowObject.frcTrackAction?.('puzzles_opened');
  } else if (transition === 'youtube') {
    windowObject.frcTrackAction?.('youtube_opened');
  }

  const localPreview = document.documentElement.dataset.preview === 'true';
  if (localPreview) {
    document.getElementById('countdown').textContent = 'Local preview — automatic continuation is paused.';
    return;
  }

  windowObject.setTimeout(() => windowObject.location.assign(destination.url), 1800);
}(window));
