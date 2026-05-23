import dotenv from 'dotenv';
dotenv.config();

import { setupGoogleSheets } from '../services/googleSheetsService.js';

const ok = await setupGoogleSheets();
if (!ok) {
  console.error('Google Sheets setup failed. Check GOOGLE_SHEETS_ID, GOOGLE_SERVICE_ACCOUNT_FILE, and spreadsheet sharing.');
  process.exit(1);
}

console.log('Google Sheets tabs and headers configured.');
