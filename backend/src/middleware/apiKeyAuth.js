// Minimal auth for a solo project: a single shared API key, checked
// against a header on every /api request. Not user accounts — just
// enough to stop a random person from finding your Render URL and
// burning your Gemini/Notion quota.

function apiKeyAuth(req, res, next) {
  const expectedKey = process.env.APP_API_KEY;

  // If no key is configured (e.g. local dev before you've set one),
  // skip the check entirely rather than locking yourself out.
  if (!expectedKey) {
    return next();
  }

  const providedKey = req.header('x-api-key');

  if (providedKey !== expectedKey) {
    return res.status(401).json({ error: 'Missing or invalid API key.' });
  }

  next();
}

module.exports = apiKeyAuth;
