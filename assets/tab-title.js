(() => {
  const originalTitle = document.title;

  function updateTabTitle() {
    document.title = document.hidden ? '🏎️ Race Back!' : originalTitle;
  }

  document.addEventListener('visibilitychange', updateTabTitle);
  updateTabTitle();
})();
