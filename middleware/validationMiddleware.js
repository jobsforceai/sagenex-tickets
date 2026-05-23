import { validationResult } from 'express-validator';
import { cleanupUploadedFiles } from '../utils/uploadCleanup.js';

export async function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  await cleanupUploadedFiles(req);
  req.session.flash = { type: 'danger', message: errors.array()[0].msg };
  return res.redirect('back');
}
