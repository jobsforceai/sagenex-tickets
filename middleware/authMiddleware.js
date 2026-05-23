import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function attachUser(req, res, next) {
  try {
    res.locals.currentPath = req.path;
    let userId = req.session?.userId;
    const token = req.cookies?.token;
    if (!userId && token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change-this-jwt-secret');
      userId = decoded.id;
    }
    if (userId) {
      req.user = await User.findById(userId).select('-password');
    }
    res.locals.currentUser = req.user || null;
    res.locals.currentPath = req.path;
    res.locals.flash = req.session?.flash || null;
    if (req.session) delete req.session.flash;
    next();
  } catch {
    res.clearCookie('token');
    res.locals.currentUser = null;
    res.locals.flash = req.session?.flash || null;
    if (req.session) delete req.session.flash;
    next();
  }
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    req.session.returnTo = req.originalUrl;
    req.session.flash = { type: 'warning', message: 'Please login to continue.' };
    return res.redirect('/login');
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      const error = new Error('Access denied');
      error.statusCode = 403;
      return next(error);
    }
    next();
  };
}
