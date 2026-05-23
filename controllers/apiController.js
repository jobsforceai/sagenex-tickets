import ChatbotConfig from '../models/ChatbotConfig.js';
import Ticket from '../models/Ticket.js';
import TicketActivity from '../models/TicketActivity.js';
import { createTicket } from '../services/ticketService.js';
import { validateExternalUser } from '../services/externalUserService.js';
import asyncHandler from '../utils/asyncHandler.js';

// Get config for a platform
export const getConfig = asyncHandler(async (req, res) => {
  const { platform } = req.query;
  if (!platform) {
    return res.status(400).json({ success: false, message: 'Platform query parameter is required' });
  }

  const config = await ChatbotConfig.findOne({ platform, isActive: true });
  if (!config) {
    return res.status(404).json({ success: false, message: `No active chatbot config found for platform: ${platform}` });
  }

  res.json({
    success: true,
    data: {
      platform: config.platform,
      title: config.title,
      welcomeMessage: config.welcomeMessage,
      themeColor: config.themeColor
    }
  });
});

// Verify external SGX user
export const verifyUser = asyncHandler(async (req, res) => {
  const { externalUserId } = req.body;
  if (!externalUserId) {
    return res.status(400).json({ success: false, message: 'externalUserId is required' });
  }

  try {
    const user = await validateExternalUser(externalUserId.trim());
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
  } catch (error) {
    res.status(404).json({ success: false, message: error.message || 'User not found or invalid' });
  }
});

// Submit complaint ticket via API
export const submitComplaint = asyncHandler(async (req, res) => {
  // Validate request fields
  const { complainantType, externalUserId, name, email, phone, platform, title, description } = req.body;

  if (!complainantType || !platform || !title || !description) {
    return res.status(400).json({ success: false, message: 'Missing required complaint fields' });
  }

  if (complainantType === 'sgx_member' && !externalUserId) {
    return res.status(400).json({ success: false, message: 'externalUserId is required for SGX members' });
  }

  if (complainantType === 'public' && (!name || !email || !phone)) {
    return res.status(400).json({ success: false, message: 'Name, email, and phone are required for guest complaints' });
  }

  // Create complaint ticket with uploaded attachments if any
  const ticket = await createTicket(req.body, req.files || [], null);


  res.status(201).json({
    success: true,
    data: {
      ticketId: ticket.ticketId,
      name: ticket.name,
      email: ticket.email,
      status: ticket.status,
      trackingUrl: `/track?ticketId=${ticket.ticketId}&email=${encodeURIComponent(ticket.email)}`
    }
  });
});

// Track ticket status and activities
export const trackTicket = asyncHandler(async (req, res) => {
  const { ticketId, email } = req.query;

  if (!ticketId || !email) {
    return res.status(400).json({ success: false, message: 'ticketId and email query parameters are required' });
  }

  const ticket = await Ticket.findOne({
    ticketId: ticketId.trim().toUpperCase(),
    email: email.trim().toLowerCase()
  }).populate('assignedTo', 'name email role department');

  if (!ticket) {
    return res.status(404).json({ success: false, message: 'Ticket not found with provided credentials' });
  }

  const activities = await TicketActivity.find({ ticket: ticket._id })
    .sort('-createdAt')
    .populate('performedBy', 'name role')
    .lean();

  res.json({
    success: true,
    data: {
      ticketId: ticket.ticketId,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      assignedDeveloper: ticket.assignedTo ? ticket.assignedTo.name : 'Unassigned',
      activities: activities.map(act => ({
        actionType: act.actionType,
        performedByName: act.performedByName || act.performedBy?.name || 'System',
        remarks: act.remarks,
        createdAt: act.createdAt
      }))
    }
  });
});
