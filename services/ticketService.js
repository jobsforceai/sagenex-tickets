import Ticket from '../models/Ticket.js';
import TicketActivity from '../models/TicketActivity.js';
import { generateTicketId } from '../utils/ticketId.js';
import { syncActivity, syncTicket } from './googleSheetsService.js';
import { validateExternalUser } from './externalUserService.js';
import { notifyDeveloperAssigned, notifyTicketAssignedToUser, notifyTicketCreated, notifyTicketStatusChanged } from './notificationService.js';
import User from '../models/User.js';

export async function recordActivity(ticket, actionType, actor, remarks = '', metadata = {}) {
  const activity = await TicketActivity.create({
    ticket: ticket._id,
    ticketId: ticket.ticketId,
    actionType,
    performedBy: actor?._id,
    performedByName: actor?.name || 'Public User',
    fromStatus: metadata.fromStatus,
    toStatus: metadata.toStatus || ticket.status,
    remarks,
    metadata
  });
  await syncActivity(activity);
  await syncTicket(await Ticket.findById(ticket._id).populate('assignedTo', 'name email'));
  return activity;
}

function mapAttachment(file, actor, source = 'complainant') {
  return {
    filename: file.filename || file.key,
    originalName: file.originalname,
    path: file.path || file.key,
    url: file.location || (file.path ? `/${file.path.replace(/\\/g, '/')}` : ''),
    storage: file.location ? 's3' : 'local',
    mimetype: file.mimetype,
    uploadedBy: actor?._id,
    uploadedByName: actor?.name || (source === 'complainant' ? 'Complainant' : 'System'),
    uploadedByRole: actor?.role || 'public',
    source
  };
}

export async function createTicket(payload, files = [], actor) {
  let ticketId = generateTicketId();
  while (await Ticket.exists({ ticketId })) ticketId = generateTicketId();

  const fileList = Array.isArray(files) ? files : files ? [files] : [];
  const attachments = fileList.map((file) => mapAttachment(file, actor, 'complainant'));
  const complainantType = payload.complainantType === 'sgx_member' && payload.memberConfirmed === 'yes' ? 'sgx_member' : 'public';
  const externalUser = complainantType === 'sgx_member' ? await validateExternalUser(payload.externalUserId) : null;

  const ticket = await Ticket.create({
    ticketId,
    name: externalUser?.fullName || payload.name,
    email: externalUser?.email || payload.email,
    phone: externalUser?.phone || payload.phone,
    complainantType,
    externalUserId: externalUser?.userId || payload.externalUserId,
    externalUserSnapshot: externalUser
      ? {
          fullName: externalUser.fullName,
          email: externalUser.email,
          phone: externalUser.phone,
          country: externalUser.country,
          rank: externalUser.rank,
          sponsorId: externalUser.sponsorId,
          packageUSD: externalUser.packageUSD,
          isPackageActive: externalUser.isPackageActive,
          kycStatus: externalUser.kycStatus,
          status: externalUser.status,
          profilePicture: externalUser.profilePicture
        }
      : undefined,
    platform: payload.platform,
    title: payload.title,
    description: payload.description,
    category: payload.category || 'Platform Complaint',
    department: payload.department,
    priority: payload.priority || 'Medium',
    createdBy: actor?._id,
    attachments
  });

  await recordActivity(ticket, 'created', actor, 'Ticket created');
  await notifyTicketCreated(ticket);
  return ticket;
}

export async function updateTicketStatus(ticket, status, actor, remarks = '') {
  const fromStatus = ticket.status;
  ticket.status = status;
  if (status === 'Resolved') ticket.resolvedAt = new Date();
  if (status === 'Closed') ticket.closedAt = new Date();
  await ticket.save();
  const actionType = status === 'Resolved' ? 'resolved' : status === 'Closed' ? 'closed' : status === 'Reopened' ? 'reopened' : 'status_changed';
  await recordActivity(ticket, actionType, actor, remarks || `Status changed to ${status}`, { fromStatus, toStatus: status });
  await notifyTicketStatusChanged(ticket, fromStatus, remarks);
  return ticket;
}

export async function updateTicketPriority(ticket, priority, actor, remarks = '') {
  const fromPriority = ticket.priority;
  ticket.priority = priority;
  await ticket.save();
  await recordActivity(ticket, 'priority_changed', actor, remarks || `Priority changed to ${priority}`, {
    fromPriority,
    toPriority: priority
  });
  return ticket;
}

export async function assignTicket(ticket, developerId, actor, remarks = '') {
  const wasAssigned = Boolean(ticket.assignedTo);
  ticket.assignedTo = developerId;
  ticket.status = wasAssigned ? 'Assigned' : 'Escalated';
  await ticket.save();
  await recordActivity(ticket, wasAssigned ? 'reassigned' : 'assigned', actor, remarks || 'Ticket assigned to developer', {
    toStatus: ticket.status,
    developerId
  });
  const developer = await User.findById(developerId);
  await notifyDeveloperAssigned(ticket, developerId, actor, wasAssigned);
  if (developer) await notifyTicketAssignedToUser(ticket, developer, wasAssigned);
  return ticket;
}

export async function addNote(ticket, type, text, actor) {
  const collection = type === 'resolution' ? ticket.resolutionNotes : ticket.internalNotes;
  collection.push({ text, createdBy: actor?._id });
  await ticket.save();
  await recordActivity(ticket, 'note_added', actor, text, { noteType: type });
  return ticket;
}

export async function addAttachment(ticket, file, actor, source = actor?.role === 'admin' ? 'admin' : 'developer') {
  const attachment = mapAttachment(file, actor, source);
  ticket.attachments.push(attachment);
  await ticket.save();
  await recordActivity(ticket, 'updated', actor, `${attachment.originalName || 'Attachment'} uploaded by ${attachment.uploadedByName}`, {
    attachmentName: attachment.originalName,
    attachmentSource: source
  });
  return ticket;
}

export function mapUploadedAttachment(file, actor, source) {
  return mapAttachment(file, actor, source);
}
