import { validationResult } from 'express-validator';
import { cleanupUploadedFiles } from '../utils/uploadCleanup.js';

export async function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  await cleanupUploadedFiles(req);
  const message = errors.array()[0].msg;
  if (req.accepts(['html', 'json']) === 'json') {
    return res.status(400).json({ success: false, message });
  }
  req.session.flash = { type: 'danger', message };
  return res.redirect('back');
}
