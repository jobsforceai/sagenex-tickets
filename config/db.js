import mongoose from 'mongoose';
import logger from '../utils/logger.js';

export default async function connectDB() {
  const uri = process.env.MONGO_URI;
  mongoose.set('strictQuery', true);
  try {
    const connection = await mongoose.connect(uri);
    logger.info('MongoDB connected');
  } catch (error) {
    logger.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
}
