import Ticket from '../models/Ticket.js';
import TicketActivity from '../models/TicketActivity.js';
import asyncHandler from '../utils/asyncHandler.js';
import { addAttachment, addNote, updateTicketStatus } from '../services/ticketService.js';

export const dashboard = asyncHandler(async (req, res) => {
  const assignedFilter = { assignedTo: req.user._id };
  const [assigned, progress, resolved, recent, byStatus, byPriority] = await Promise.all([
    Ticket.countDocuments({ assignedTo: req.user._id }),
    Ticket.countDocuments({ assignedTo: req.user._id, status: 'In Progress' }),
    Ticket.countDocuments({ assignedTo: req.user._id, status: { $in: ['Pending Approval', 'Resolved'] } }),
    Ticket.find({ assignedTo: req.user._id }).sort('-updatedAt').limit(10),
    Ticket.aggregate([{ $match: assignedFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }]),
    Ticket.aggregate([{ $match: assignedFilter }, { $group: { _id: '$priority', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }])
  ]);
  res.render('developer/dashboard', { title: 'Developer Dashboard', stats: { assigned, progress, resolved }, recent, charts: { byStatus, byPriority } });
});

export const assignedTickets = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const filter = { assignedTo: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.q) filter.$or = [{ ticketId: new RegExp(req.query.q, 'i') }, { title: new RegExp(req.query.q, 'i') }];
  const result = await Ticket.paginate(filter, { page, limit: 25, sort: req.query.sort || '-updatedAt', lean: true });
  res.render('developer/tickets', { title: 'Assigned Tickets', result, query: req.query });
});

export const ticketDetail = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findOne({ _id: req.params.id, assignedTo: req.user._id }).populate('attachments.uploadedBy', 'name role email');
  if (!ticket) {
    const error = new Error('Ticket not found');
    error.statusCode = 404;
    throw error;
  }
  const activities = await TicketActivity.find({ ticket: ticket._id }).sort('-createdAt').populate('performedBy', 'name role');
  res.render('developer/ticket-detail', { title: ticket.ticketId, ticket, activities });
});

export const updateTicket = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findOne({ _id: req.params.id, assignedTo: req.user._id });
  if (req.body.status) {
    const nextStatus = req.body.status === 'Resolved' ? 'Pending Approval' : req.body.status;
    const remarks = req.body.status === 'Resolved'
      ? req.body.remarks || 'Developer submitted resolution for admin approval'
      : req.body.remarks;
    await updateTicketStatus(ticket, nextStatus, req.user, remarks);
  }
  if (req.body.progressNote) await addNote(ticket, 'internal', req.body.progressNote, req.user);
  if (req.body.resolutionNote) await addNote(ticket, 'resolution', req.body.resolutionNote, req.user);
  if (req.file) {
    await addAttachment(ticket, req.file, req.user, 'developer');
  }
  req.session.flash = { type: 'success', message: 'Ticket progress updated.' };
  res.redirect(`/developer/tickets/${ticket._id}`);
});
