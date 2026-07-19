module.exports = function handler(req, res) {
  res.status(404).json({ ok: false, error: 'not_found' });
};
