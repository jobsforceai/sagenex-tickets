import mongoose from 'mongoose';
import { platformKeys } from '../utils/platforms.js';

const chatbotConfigSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      required: true,
      unique: true,
      enum: platformKeys(),
      index: true
    },
    title: {
      type: String,
      required: true,
      default: 'Support Desk Chatbot'
    },
    welcomeMessage: {
      type: String,
      required: true,
      default: 'Hello! How can we assist you with our platform today?'
    },
    themeColor: {
      type: String,
      required: true,
      default: '#0f766e' // Emerald-teal accent color
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

export default mongoose.model('ChatbotConfig', chatbotConfigSchema);
