import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendMail } from '../services/emailService.js';

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'change-this-jwt-secret', {
    expiresIn: '8h'
  });
}

export const showLogin = (req, res) => res.render('public/login', { title: 'Login' });

export const showForgotPassword = (req, res) => res.render('public/forgot-password', { title: 'Forgot Password' });

export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email, role: { $in: ['admin', 'developer'] } });
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    user.resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    user.resetExpires = new Date(Date.now() + 1000 * 60 * 30);
    await user.save();
    const resetLink = `${req.protocol}://${req.get('host')}/reset-password/${token}`;
    const emailSent = await sendMail({ to: user.email, subject: 'Sagenex password reset', text: `Reset your password here: ${resetLink}` });
    if (!emailSent) {
      user.resetTokenHash = undefined;
      user.resetExpires = undefined;
      await user.save();
    }
  }
  req.session.flash = { type: 'success', message: 'If the staff account exists, password reset instructions have been sent by email.' };
  res.redirect('/forgot-password');
});

export const showResetPassword = asyncHandler(async (req, res) => {
  res.render('public/reset-password', { title: 'Reset Password', token: req.params.token, mode: 'reset' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({ resetTokenHash: tokenHash, resetExpires: { $gt: new Date() } }).select('+resetTokenHash');
  if (!user) {
    req.session.flash = { type: 'danger', message: 'Reset link is invalid or expired.' };
    return res.redirect('/forgot-password');
  }
  user.password = req.body.password;
  user.resetTokenHash = undefined;
  user.resetExpires = undefined;
  user.isActive = true;
  await user.save();
  req.session.flash = { type: 'success', message: 'Password updated. Please login.' };
  res.redirect('/login');
});

export const showAcceptInvite = asyncHandler(async (req, res) => {
  res.render('public/reset-password', { title: 'Accept Developer Invite', token: req.params.token, mode: 'invite' });
});

export const acceptInvite = asyncHandler(async (req, res) => {
  const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({ inviteTokenHash: tokenHash, inviteExpires: { $gt: new Date() }, role: 'developer' }).select('+inviteTokenHash');
  if (!user) {
    req.session.flash = { type: 'danger', message: 'Invite link is invalid or expired.' };
    return res.redirect('/login');
  }
  user.password = req.body.password;
  user.inviteTokenHash = undefined;
  user.inviteExpires = undefined;
  user.isActive = true;
  await user.save();
  req.session.flash = { type: 'success', message: 'Developer account activated. Please login.' };
  res.redirect('/login');
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    req.session.flash = { type: 'danger', message: 'Invalid email or password.' };
    return res.redirect('/login');
  }
  if (user.isBlocked) {
    req.session.flash = { type: 'danger', message: 'This account is blocked. Contact admin.' };
    return res.redirect('/login');
  }
  if (!user.isActive) {
    req.session.flash = { type: 'warning', message: 'This account is disabled or invite is pending.' };
    return res.redirect('/login');
  }
  req.session.userId = user._id;
  res.cookie('token', signToken(user), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  const redirectTo = req.session.returnTo || (user.role === 'admin' ? '/admin/dashboard' : user.role === 'developer' ? '/developer/dashboard' : '/');
  delete req.session.returnTo;
  res.redirect(redirectTo);
});

export const logout = (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('token');
    res.clearCookie('sagenex.sid');
    res.redirect('/login');
  });
};
