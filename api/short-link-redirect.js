const shortLinkRedirect = require('../lib/short-link-redirect');

const handlers = Object.fromEntries(
  ['amazon', 'kindle', 'flipkart', 'np', 'youtube'].map(link => [link, shortLinkRedirect(link)])
);

module.exports = function handler(req, res) {
  const link = req.query?.shortLink;
  if (typeof link !== 'string' || !Object.hasOwn(handlers, link)) {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return res.status(404).end();
  }
  return handlers[link](req, res);
};
