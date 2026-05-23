import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import dns from "node:dns/promises";   
dns.setServers(["1.1.1.1", "1.0.0.1"]);   
const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@sgmeta.ai';
const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@sgmeta.ai123';

await connectDB();


const existingAdmin = await User.findOne({ email: adminEmail });

if (existingAdmin) {
  console.log(`Admin already exists: ${adminEmail}`);
} else {
  await User.create({
    name: process.env.SEED_ADMIN_NAME || 'SGMeta Main Admin',
    email: adminEmail,
    phone: process.env.SEED_ADMIN_PHONE || '9000000000',
    role: 'admin',
    password: adminPassword,
    isActive: true
  });
  console.log(`Admin created: ${adminEmail}`);
  console.log('Temporary password configured from environment. It is not printed for security.');
}

await mongoose.disconnect();
