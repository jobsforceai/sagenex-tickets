import rateLimit from 'express-rate-limit';

function rateLimitHandler(req, res, next, options) {
  const message = typeof options.message === 'string' ? options.message : 'Too many requests. Please try again later.';
  if (req.accepts(['html', 'json']) === 'json') {
    return res.status(options.statusCode).json({ success: false, message });
  }
  if (req.session) req.session.flash = { type: 'danger', message };
  return res.status(options.statusCode).send(message);
}

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many authentication attempts. Please try again later.',
  handler: rateLimitHandler
});

export const complaintViewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many complaint page requests. Please try again later.',
  handler: rateLimitHandler
});

export const complaintVerifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many SGX verification attempts. Please wait before trying again.',
  handler: rateLimitHandler
});

export const complaintSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Complaint submission limit reached. Please try again later.',
  handler: rateLimitHandler
});

export const trackingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many tracking requests. Please try again later.',
  handler: rateLimitHandler
});
