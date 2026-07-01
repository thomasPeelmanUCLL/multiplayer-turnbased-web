/**
 * Rate limiters for sensitive endpoints.
 *
 * Auth endpoints get a strict limiter to mitigate brute-force attacks.
 * Add additional limiters here as the API grows.
 */
import rateLimit from 'express-rate-limit';

export const rateLimiters = {
  /** 10 auth requests per IP per 15-minute window */
  auth: rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  }),

  /** 20 match-creation requests per IP per minute */
  matchCreate: rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  }),
};
