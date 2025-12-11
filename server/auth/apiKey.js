// server/auth/apiKey.js

/**
 * Simple API key middleware.
 *
 * Set API_KEY in your environment (e.g. .env):
 *   API_KEY=some-long-random-string
 *
 * All /api requests must then include:
 *   x-api-key: some-long-random-string
 *
 * If API_KEY is not set, the middleware logs a warning and allows all requests.
 */
function requireApiKey(req, res, next) {
  const configuredKey = process.env.API_KEY;

  // If no API key is configured, don't block requests, but log a warning.
  if (!configuredKey) {
    console.warn(
      "[WARN] API_KEY is not set. API key auth is effectively disabled."
    );
    return next();
  }

  const providedKey = req.header("x-api-key");

  if (!providedKey || providedKey !== configuredKey) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized",
    });
  }

  return next();
}

module.exports = requireApiKey;