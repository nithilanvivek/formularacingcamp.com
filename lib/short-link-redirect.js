const counters = require('./analytics-counters');

const DESTINATIONS = {
  amazon: 'https://www.amazon.in/dp/B0H8ZYFV7Q',
  kindle: 'https://www.amazon.in/dp/B0H7TH9QW6',
  flipkart: 'https://www.flipkart.com/search?q=Formula%20Racing%20Camp%20book',
  np: 'https://notionpress.com/in/read/formula-racing-camp',
  youtube: 'https://youtube.com/@FormulaRacingCamp'
};

module.exports = function shortLinkRedirect(link) {
  const destination = DESTINATIONS[link];
  if (!destination) throw new Error('Unknown short link');

  return async function handler(req, res) {
    // Every visit must reach the function, including repeat visits.
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');

    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return res.status(405).end();
    }

    if (req.method === 'GET' && counters.redisConfig().configured) {
      try {
        await counters.incrementAction('short_link_opened', { link }, new Date(), {
          signal: AbortSignal.timeout(1500)
        });
      } catch {
        // A failed counter must never prevent a visitor reaching the destination.
        console.error(`Short-link counter unavailable: /${link}`);
      }
    }

    res.setHeader('Location', destination);
    return res.status(302).end();
  };
};
