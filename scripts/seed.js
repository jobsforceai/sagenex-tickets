import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Ticket from '../models/Ticket.js';
import TicketActivity from '../models/TicketActivity.js';
import { createTicket, assignTicket, updateTicketStatus } from '../services/ticketService.js';
import dns from "node:dns/promises";   
dns.setServers(["1.1.1.1", "1.0.0.1"]);   

await connectDB();
await Promise.all([User.deleteMany({}), Ticket.deleteMany({}), TicketActivity.deleteMany({})]);

const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@sgmeta.ai';
const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@sgmeta.ai123';

const admin = await User.create({
  name: process.env.SEED_ADMIN_NAME || 'SGMeta Main Admin',
  email: adminEmail,
  phone: process.env.SEED_ADMIN_PHONE || '9000000000',
  role: 'admin',
  password: adminPassword,
  isActive: true
});

const developer = await User.create({
  name: 'Sagenex Techie One',
  email: 'developer@sagenex.local',
  phone: '9000000001',
  department: 'IT Support',
  role: 'developer',
  password: 'Developer@12345'
});

const ticket = await createTicket({
  name: 'Sample Citizen',
  email: 'citizen@example.com',
  phone: '9999999999',
  platform: 'SGXMeta',
  complainantType: 'public',
  title: 'Printer not working in records room',
  description: 'The records room printer is not responding and pending documents cannot be printed.',
  category: 'Hardware',
  department: 'Records',
  priority: 'High'
}, null, null);

await assignTicket(ticket, developer._id, admin, 'Assigned to IT support for hardware inspection');
await updateTicketStatus(ticket, 'In Progress', developer, 'Inspection started');

console.log('Seed complete');
console.log(`Admin: ${adminEmail} / ${adminPassword}`);
console.log('Developer: developer@sagenex.local / Developer@12345');
await mongoose.disconnect();
