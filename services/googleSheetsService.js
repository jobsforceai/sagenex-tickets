import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

let sheetsReady = false;

function hasSheetsConfig() {
  return Boolean(process.env.GOOGLE_SHEETS_ID && (
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE ||
    (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY)
  ));
}

async function getSheets() {
  if (!hasSheetsConfig()) return null;
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  if (process.env.GOOGLE_SERVICE_ACCOUNT_FILE) {
    const keyFile = path.resolve(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE);
    if (!fs.existsSync(keyFile)) {
      logger.error(`Google service account file not found: ${keyFile}`);
      return null;
    }
    const auth = new google.auth.GoogleAuth({ keyFile, scopes });
    return google.sheets({ version: 'v4', auth: await auth.getClient() });
  }
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes
  });
  return google.sheets({ version: 'v4', auth });
}

async function ensureSheets(sheets) {
  if (sheetsReady) return;
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const ticketSheet = process.env.GOOGLE_TICKET_SHEET || 'Tickets';
  const activitySheet = process.env.GOOGLE_ACTIVITY_SHEET || 'Activity Logs';
  const ticketHeaders = ['Ticket ID', 'User Name', 'Platform', 'User Type', 'Complaint Title', 'Category', 'Priority', 'Status', 'Assigned Developer', 'Created Date', 'Updated Date', 'Internal Notes', 'Resolution Notes'];
  const activityHeaders = ['Ticket ID', 'Action Type', 'Performed By', 'From Status', 'To Status', 'Remarks', 'Timestamp'];

  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const titles = new Set(spreadsheet.data.sheets.map((sheet) => sheet.properties.title));
    const requests = [];
    if (!titles.has(ticketSheet)) requests.push({ addSheet: { properties: { title: ticketSheet } } });
    if (!titles.has(activitySheet)) requests.push({ addSheet: { properties: { title: activitySheet } } });
    if (requests.length) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
    }
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${ticketSheet}!A1:M1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [ticketHeaders] }
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${activitySheet}!A1:G1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [activityHeaders] }
    });
    sheetsReady = true;
  } catch (error) {
    logger.error(`Google Sheets setup failed: ${error.message}`);
  }
}

export async function setupGoogleSheets() {
  const sheets = await getSheets();
  if (!sheets) return false;
  await ensureSheets(sheets);
  return sheetsReady;
}

export async function syncTicket(ticket) {
  const sheets = await getSheets();
  if (!sheets) return;
  await ensureSheets(sheets);
  const assigned = ticket.assignedTo?.name || '';
  const internalNotes = ticket.internalNotes?.map((n) => n.text).join(' | ') || '';
  const resolutionNotes = ticket.resolutionNotes?.map((n) => n.text).join(' | ') || '';
  const values = [[
    ticket.ticketId,
    ticket.name,
    ticket.platform,
    ticket.complainantType,
    ticket.title,
    ticket.category,
    ticket.priority,
    ticket.status,
    assigned,
    ticket.createdAt?.toISOString() || '',
    ticket.updatedAt?.toISOString() || '',
    internalNotes,
    resolutionNotes
  ]];

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `${process.env.GOOGLE_TICKET_SHEET || 'Tickets'}!A:M`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values }
    });
  } catch (error) {
    logger.error(`Google ticket sync failed: ${error.message}`);
  }
}

export async function syncActivity(activity) {
  const sheets = await getSheets();
  if (!sheets) return;
  await ensureSheets(sheets);
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `${process.env.GOOGLE_ACTIVITY_SHEET || 'Activity Logs'}!A:G`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          activity.ticketId,
          activity.actionType,
          activity.performedByName || 'System',
          activity.fromStatus || '',
          activity.toStatus || '',
          activity.remarks || '',
          activity.createdAt?.toISOString() || new Date().toISOString()
        ]]
      }
    });
  } catch (error) {
    logger.error(`Google activity sync failed: ${error.message}`);
  }
}
