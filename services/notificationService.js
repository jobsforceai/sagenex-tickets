import User from '../models/User.js';
import { sendMail } from './emailService.js';

function appUrl(path = '/') {
  const base = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  return `${base.replace(/\/$/, '')}${path}`;
}

function ticketUrl(ticket) {
  return appUrl(`/track?ticketId=${encodeURIComponent(ticket.ticketId)}&email=${encodeURIComponent(ticket.email)}`);
}

function shell(title, body) {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#eef2f6;padding:18px;color:#17202a">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #cfd6df">
        <div style="background:#1f3a5f;color:#fff;padding:12px 14px;font-weight:700">Sagenex Ticketing System</div>
        <div style="padding:16px">
          <h2 style="margin:0 0 10px;font-size:18px">${title}</h2>
          ${body}
        </div>
        <div style="border-top:1px solid #e5e7eb;padding:10px 14px;color:#667085;font-size:12px">Made with love for the Sagenex family.</div>
      </div>
    </div>
  `;
}

function ticketSummary(ticket) {
  return `
    <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px">
      <tr><td style="border:1px solid #d6dde6;padding:7px;background:#f8fafc">Ticket ID</td><td style="border:1px solid #d6dde6;padding:7px"><b>${ticket.ticketId}</b></td></tr>
      <tr><td style="border:1px solid #d6dde6;padding:7px;background:#f8fafc">Platform</td><td style="border:1px solid #d6dde6;padding:7px">${ticket.platform}</td></tr>
      <tr><td style="border:1px solid #d6dde6;padding:7px;background:#f8fafc">Title</td><td style="border:1px solid #d6dde6;padding:7px">${ticket.title}</td></tr>
      <tr><td style="border:1px solid #d6dde6;padding:7px;background:#f8fafc">Status</td><td style="border:1px solid #d6dde6;padding:7px">${ticket.status}</td></tr>
      <tr><td style="border:1px solid #d6dde6;padding:7px;background:#f8fafc">Priority</td><td style="border:1px solid #d6dde6;padding:7px">${ticket.priority}</td></tr>
    </table>
  `;
}

function cta(label, href) {
  return `<a href="${href}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:8px 12px;font-weight:700">${label}</a>`;
}

export async function notifyTicketCreated(ticket) {
  return sendMail({
    to: ticket.email,
    subject: `Ticket registered: ${ticket.ticketId}`,
    text: `Your ticket ${ticket.ticketId} has been registered. Current status: ${ticket.status}.`,
    html: shell('Ticket registered', `<p>Your complaint has been registered successfully.</p>${ticketSummary(ticket)}${cta('Track ticket', ticketUrl(ticket))}`)
  });
}

export async function notifyTicketStatusChanged(ticket, fromStatus, remarks = '') {
  return sendMail({
    to: ticket.email,
    subject: `Ticket ${ticket.ticketId} status updated: ${ticket.status}`,
    text: `Your ticket moved from ${fromStatus} to ${ticket.status}. ${remarks || ''}`,
    html: shell('Ticket status updated', `<p>Your ticket status changed from <b>${fromStatus}</b> to <b>${ticket.status}</b>.</p>${remarks ? `<p>${remarks}</p>` : ''}${ticketSummary(ticket)}${cta('Track ticket', ticketUrl(ticket))}`)
  });
}

export async function notifyTicketAssignedToUser(ticket, developer, isReassignment) {
  return sendMail({
    to: ticket.email,
    subject: `Ticket ${ticket.ticketId} ${isReassignment ? 'reassigned' : 'assigned'}`,
    text: `Your ticket ${ticket.ticketId} has been ${isReassignment ? 'reassigned' : 'assigned'} to ${developer.name}.`,
    html: shell(`Ticket ${isReassignment ? 'reassigned' : 'assigned'}`, `<p>Your ticket is now with <b>${developer.name}</b>.</p>${ticketSummary(ticket)}${cta('Track ticket', ticketUrl(ticket))}`)
  });
}

export async function notifyDeveloperAssigned(ticket, developerId, actor, isReassignment) {
  const developer = await User.findById(developerId);
  if (!developer?.email || developer.isBlocked || !developer.isActive) return false;
  const adminName = actor?.name || 'Admin';
  const href = appUrl(`/developer/tickets/${ticket._id}`);
  return sendMail({
    to: developer.email,
    subject: `${isReassignment ? 'Reassigned' : 'Assigned'} ticket ${ticket.ticketId}`,
    text: `${adminName} ${isReassignment ? 'reassigned' : 'assigned'} ticket ${ticket.ticketId} to you.`,
    html: shell(`${isReassignment ? 'Reassigned' : 'Assigned'} ticket`, `<p><b>${adminName}</b> ${isReassignment ? 'reassigned' : 'assigned'} this ticket to you.</p>${ticketSummary(ticket)}${cta('Open assigned ticket', href)}`)
  });
}
