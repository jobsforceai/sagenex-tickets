import Ticket from '../models/Ticket.js';
import TicketActivity from '../models/TicketActivity.js';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import { addNote, assignTicket, updateTicketPriority, updateTicketStatus } from '../services/ticketService.js';
import { platforms } from '../utils/platforms.js';
import crypto from 'crypto';
import { sendMail } from '../services/emailService.js';

function buildTicketFilter(query) {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.category) filter.category = new RegExp(query.category, 'i');
  if (query.assignedTo) filter.assignedTo = query.assignedTo;
  if (query.platform) filter.platform = query.platform;
  if (query.complainantType) filter.complainantType = query.complainantType;
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }
  if (query.q) {
    filter.$or = [
      { ticketId: new RegExp(query.q, 'i') },
      { title: new RegExp(query.q, 'i') },
      { name: new RegExp(query.q, 'i') },
      { email: new RegExp(query.q, 'i') }
    ];
  }
  return filter;
}

async function countBy(field, filter = {}) {
  return Ticket.aggregate([
    { $match: filter },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } }
  ]);
}

export const dashboard = asyncHandler(async (req, res) => {
  const [total, pending, assigned, resolved, critical, byStatus, byPriority, byPlatform] = await Promise.all([
    Ticket.countDocuments(),
    Ticket.countDocuments({ status: 'Pending' }),
    Ticket.countDocuments({ assignedTo: { $exists: true, $ne: null } }),
    Ticket.countDocuments({ status: 'Resolved' }),
    Ticket.countDocuments({ priority: 'Critical' }),
    countBy('status'),
    countBy('priority'),
    countBy('platform')
  ]);
  const recent = await Ticket.find().sort('-createdAt').limit(10).populate('assignedTo', 'name');
  res.render('admin/dashboard', { title: 'Admin Dashboard', stats: { total, pending, assigned, resolved, critical }, recent, charts: { byStatus, byPriority, byPlatform } });
});

export const tickets = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const sort = req.query.sort || '-createdAt';
  const developers = await User.find({ role: 'developer', isActive: true }).sort('name');
  const result = await Ticket.paginate(buildTicketFilter(req.query), {
    page,
    limit: 25,
    sort,
    populate: { path: 'assignedTo', select: 'name' },
    lean: true
  });
  res.render('admin/tickets', { title: 'Ticket List', result, query: req.query, developers, platforms });
});

export const ticketDetail = asyncHandler(async (req, res) => {
  const [ticket, developers] = await Promise.all([
    Ticket.findById(req.params.id).populate('assignedTo createdBy attachments.uploadedBy', 'name email role department'),
    User.find({ role: 'developer', isActive: true }).sort('name')
  ]);
  const activities = await TicketActivity.find({ ticket: ticket._id }).sort('-createdAt').populate('performedBy', 'name role');
  res.render('admin/ticket-detail', { title: ticket.ticketId, ticket, developers, activities });
});

export const updateTicket = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (req.body.assignedTo) await assignTicket(ticket, req.body.assignedTo, req.user, req.body.remarks);
  if (req.body.status) await updateTicketStatus(ticket, req.body.status, req.user, req.body.remarks);
  if (req.body.priority) await updateTicketPriority(ticket, req.body.priority, req.user, req.body.remarks);
  if (req.body.internalNote) await addNote(ticket, 'internal', req.body.internalNote, req.user);
  if (req.body.resolutionNote) await addNote(ticket, 'resolution', req.body.resolutionNote, req.user);
  req.session.flash = { type: 'success', message: 'Ticket updated.' };
  res.redirect(`/admin/tickets/${ticket._id}`);
});

export const developers = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = 25;
  const [users, totalDocs] = await Promise.all([
    User.find({ role: 'developer' }).sort('name').skip((page - 1) * limit).limit(limit),
    User.countDocuments({ role: 'developer' })
  ]);
  const result = {
    page,
    totalPages: Math.max(1, Math.ceil(totalDocs / limit)),
    totalDocs
  };
  res.render('admin/developers', { title: 'Developer Management', users, result, query: req.query });
});

export const createDeveloper = asyncHandler(async (req, res) => {
  const developer = await User.create({
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    department: req.body.department,
    role: 'developer',
    password: crypto.randomBytes(24).toString('hex'),
    isActive: false
  });
  const emailSent = await sendDeveloperInvite(req, developer);
  req.session.flash = {
    type: emailSent ? 'success' : 'warning',
    message: emailSent ? 'Developer invited. Invite email sent.' : 'Developer created, but email service is not configured or failed. No invite link was exposed.'
  };
  res.redirect('/admin/developers');
});

async function sendDeveloperInvite(req, developer) {
  const token = crypto.randomBytes(32).toString('hex');
  developer.inviteTokenHash = crypto.createHash('sha256').update(token).digest('hex');
  developer.inviteExpires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3);
  developer.isActive = false;
  developer.isBlocked = false;
  developer.disabledAt = undefined;
  developer.blockedAt = undefined;
  await developer.save();
  const inviteLink = `${req.protocol}://${req.get('host')}/accept-invite/${token}`;
  const emailSent = await sendMail({
    to: developer.email,
    subject: 'Sagenex developer invite',
    text: `You have been invited as a Sagenex developer. Set your password here: ${inviteLink}`
  });
  if (!emailSent) {
    developer.inviteTokenHash = undefined;
    developer.inviteExpires = undefined;
    await developer.save();
  }
  return emailSent;
}

export const reinviteDeveloper = asyncHandler(async (req, res) => {
  const developer = await User.findOne({ _id: req.params.id, role: 'developer' }).select('+inviteTokenHash');
  if (!developer) {
    req.session.flash = { type: 'danger', message: 'Developer not found.' };
    return res.redirect('/admin/developers');
  }
  const emailSent = await sendDeveloperInvite(req, developer);
  req.session.flash = {
    type: emailSent ? 'success' : 'warning',
    message: emailSent ? 'Developer reinvited. Invite email sent.' : 'Reinvite created, but email service is not configured or failed. No invite link was exposed.'
  };
  res.redirect('/admin/developers');
});

export const setDeveloperState = asyncHandler(async (req, res) => {
  const developer = await User.findOne({ _id: req.params.id, role: 'developer' });
  if (!developer) {
    req.session.flash = { type: 'danger', message: 'Developer not found.' };
    return res.redirect('/admin/developers');
  }
  const action = req.body.action;
  if (action === 'disable') {
    developer.isActive = false;
    developer.disabledAt = new Date();
  } else if (action === 'enable') {
    developer.isActive = true;
    developer.disabledAt = undefined;
  } else if (action === 'block') {
    developer.isBlocked = true;
    developer.isActive = false;
    developer.blockedAt = new Date();
  } else if (action === 'unblock') {
    developer.isBlocked = false;
    developer.blockedAt = undefined;
  }
  await developer.save();
  req.session.flash = { type: 'success', message: 'Developer account updated.' };
  res.redirect('/admin/developers');
});

export const resetDeveloperPassword = asyncHandler(async (req, res) => {
  const developer = await User.findById(req.params.id);
  developer.password = req.body.password;
  await developer.save();
  req.session.flash = { type: 'success', message: 'Password reset and stored as a hash.' };
  res.redirect('/admin/developers');
});

export const reports = asyncHandler(async (req, res) => {
  const [byStatus, byPriority, byPlatform, byUserType, byDeveloper] = await Promise.all([
    countBy('status'),
    countBy('priority'),
    countBy('platform'),
    countBy('complainantType'),
    Ticket.aggregate([
      { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'developer' } },
      { $unwind: { path: '$developer', preserveNullAndEmptyArrays: true } },
      { $project: { _id: { $ifNull: ['$developer.name', 'Unassigned'] }, count: 1 } },
      { $sort: { count: -1, _id: 1 } }
    ])
  ]);
  res.render('admin/reports', { title: 'Reports', charts: { byStatus, byPriority, byPlatform, byUserType, byDeveloper } });
});

export const exportTickets = asyncHandler(async (req, res) => {
  const tickets = await Ticket.find(buildTicketFilter(req.query)).populate('assignedTo', 'name').lean();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="sagenex-tickets.csv"');
  res.write('Ticket ID,User Name,Title,Category,Priority,Status,Assigned Developer,Created,Updated\n');
  tickets.forEach((t) => {
    res.write([t.ticketId, t.name, t.title, t.category, t.priority, t.status, t.assignedTo?.name || '', t.createdAt, t.updatedAt].map((v) => `"${String(v || '').replace(/"/g, '""')}"`).join(',') + '\n');
  });
  res.end();
});
