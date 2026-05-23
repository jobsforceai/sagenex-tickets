import logger from '../utils/logger.js';
import { cleanupUploadedFiles } from '../utils/uploadCleanup.js';

export function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

export async function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;
  await cleanupUploadedFiles(req);
  logger.error(error.stack || error.message);
  if (req.originalUrl.startsWith('/api') || req.accepts(['html', 'json']) === 'json') {
    return res.status(statusCode).json({ message: error.message });
  }
  res.status(statusCode).render('error', {
    title: 'Error',
    statusCode,
    message: error.message,
    layout: 'layouts/main'
  });
}
