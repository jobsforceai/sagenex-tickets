import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin', 'developer'], default: 'user', index: true },
    phone: { type: String, trim: true },
    department: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false, index: true },
    blockedAt: Date,
    disabledAt: Date,
    inviteTokenHash: { type: String, select: false },
    inviteExpires: Date,
    resetTokenHash: { type: String, select: false },
    resetExpires: Date
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.matchPassword = function matchPassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model('User', userSchema);
