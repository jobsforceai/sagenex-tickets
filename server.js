import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import connectDB from './config/db.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 5000;

await connectDB();

app.listen(PORT, () => {
  logger.info(`Sagenex Ticketing System running on http://localhost:${PORT}`);
});
