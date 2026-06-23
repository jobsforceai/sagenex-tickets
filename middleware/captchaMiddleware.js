import { randomInt } from 'crypto';
import { cleanupUploadedFiles } from '../utils/uploadCleanup.js';

export function createComplaintCaptcha(req) {
  const left = randomInt(2, 10);
  const right = randomInt(1, 9);
  req.session.complaintCaptcha = {
    question: `${left} + ${right}`,
    answer: String(left + right)
  };
  return { question: req.session.complaintCaptcha.question };
}

export function ensureComplaintCaptcha(req) {
  if (!req.session.complaintCaptcha) return createComplaintCaptcha(req);
  return { question: req.session.complaintCaptcha.question };
}

export async function validateComplaintCaptcha(req, res, next) {
  const expected = req.session.complaintCaptcha?.answer;
  const actual = String(req.body.captchaAnswer || '').trim();
  if (expected && actual === expected) return next();

  await cleanupUploadedFiles(req);
  const captcha = createComplaintCaptcha(req);
  const message = 'Human check failed. Please answer the new question and submit again.';
  if (req.accepts(['html', 'json']) === 'json') {
    return res.status(400).json({ success: false, message, captcha });
  }
  req.session.flash = { type: 'danger', message };
  return res.redirect('back');
}
