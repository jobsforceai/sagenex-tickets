import Ticket from '../models/Ticket.js';
import TicketActivity from '../models/TicketActivity.js';
import asyncHandler from '../utils/asyncHandler.js';
import { createTicket, updateTicketStatus } from '../services/ticketService.js';
import { validateExternalUser } from '../services/externalUserService.js';
import { platforms } from '../utils/platforms.js';

export const home = (req, res) => res.render('public/home', { title: 'Sagenex Ticketing System' });
export const showComplaint = (req, res) => res.render('public/complaint', { title: 'Raise Complaint', platforms });

export const submitComplaint = asyncHandler(async (req, res) => {
  const ticket = await createTicket(req.body, req.files, req.user);
  if (req.accepts(['html', 'json']) === 'json') {
    return res.status(201).json({
      success: true,
      ticketId: ticket.ticketId,
      redirectUrl: `/track?ticketId=${ticket.ticketId}&email=${encodeURIComponent(ticket.email)}`
    });
  }
  req.session.flash = { type: 'success', message: `Ticket created: ${ticket.ticketId}` };
  res.redirect(`/track?ticketId=${ticket.ticketId}&email=${encodeURIComponent(ticket.email)}`);
});

export const verifySgxUser = asyncHandler(async (req, res) => {
  const user = await validateExternalUser(req.body.externalUserId);
  res.json({
    success: true,
    data: {
      userId: user.userId,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      country: user.country,
      rank: user.rank,
      sponsorId: user.sponsorId,
      packageUSD: user.packageUSD,
      isPackageActive: user.isPackageActive,
      kycStatus: user.kycStatus,
      status: user.status,
      profilePicture: user.profilePicture
    }
  });
});

export const trackTicket = asyncHandler(async (req, res) => {
  const { ticketId, email } = req.query;
  let ticket = null;
  let activities = [];
  if (ticketId && email) {
    ticket = await Ticket.findOne({ ticketId, email: email.toLowerCase() }).populate('assignedTo attachments.uploadedBy', 'name email role department');
    if (ticket) activities = await TicketActivity.find({ ticket: ticket._id }).sort('-createdAt').populate('performedBy', 'name role');
  }
  res.render('public/track', { title: 'Track Ticket', ticket, activities, query: req.query });
});

export const printTicket = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findOne({ ticketId: req.params.ticketId }).populate('assignedTo', 'name email department');
  if (!ticket) {
    const error = new Error('Ticket not found');
    error.statusCode = 404;
    throw error;
  }
  res.render('public/print', { title: `Print ${ticket.ticketId}`, ticket, layout: false });
});

export const reopenTicket = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findOne({ ticketId: req.params.ticketId, email: req.body.email?.toLowerCase() });
  if (!ticket || !['Resolved', 'Closed'].includes(ticket.status)) {
    req.session.flash = { type: 'danger', message: 'Ticket cannot be reopened.' };
    return res.redirect('/track');
  }
  await updateTicketStatus(ticket, 'Reopened', req.user, req.body.remarks || 'Reopened by complainant');
  req.session.flash = { type: 'success', message: 'Ticket reopened.' };
  res.redirect(`/track?ticketId=${ticket.ticketId}&email=${encodeURIComponent(ticket.email)}`);
});
