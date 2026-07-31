/**
 * Lightweight NoSQL-injection sanitizer compatible with Express 5.
 *
 * express-mongo-sanitize mutates req.query, which is a read-only getter in
 * Express 5 and throws. This middleware instead recursively strips any keys
 * that begin with '$' or contain '.' from mutable request payloads
 * (body and params), neutralizing MongoDB operator-injection attempts.
 */
function sanitizeValue(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object') {
    const clean = {};
    for (const key of Object.keys(value)) {
      // Drop dangerous keys entirely
      if (key.startsWith('$') || key.includes('.')) {
        continue;
      }
      clean[key] = sanitizeValue(value[key]);
    }
    return clean;
  }
  return value;
}

const mongoSanitize = (req, res, next) => {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.params) req.params = sanitizeValue(req.params);
  next();
};

module.exports = mongoSanitize;
