'use strict';

const rateLimit = require('express-rate-limit');

const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ ok: false, error: 'Too many login attempts' });
  },
});

module.exports = loginRateLimiter;
