const rateLimit = require('express-rate-limit');

/**
 * Auth Rate Limiter — 10 attempts per 15 minutes per IP
 * Prevents brute-force attacks on login/signup
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many attempts from this IP. Please try again after 15 minutes.'
  },
  skipSuccessfulRequests: true // Only count failed requests
});

/**
 * API General Limiter — 100 requests per minute per IP
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 429, message: 'Too many requests. Please slow down.' }
});

module.exports = { authLimiter, apiLimiter };
