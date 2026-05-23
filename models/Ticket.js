import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const noteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true, _id: true }
);

const attachmentSchema = new mongoose.Schema(
  {
    filename: String,
    originalName: String,
    path: String,
    url: String,
    storage: { type: String, enum: ['local', 's3'], default: 'local' },
    mimetype: String,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedByName: String,
    uploadedByRole: { type: String, enum: ['user', 'admin', 'developer', 'public'], default: 'public' },
    source: { type: String, enum: ['complainant', 'admin', 'developer'], default: 'complainant' }
  },
  { timestamps: true, _id: true }
);

const ticketSchema = new mongoose.Schema(
  {
    ticketId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    complainantType: { type: String, enum: ['sgx_member', 'public'], default: 'public', index: true },
    externalUserId: { type: String, trim: true, index: true },
    externalUserSnapshot: {
      fullName: String,
      email: String,
      phone: String,
      country: String,
      rank: String,
      sponsorId: String,
      packageUSD: Number,
      isPackageActive: Boolean,
      kycStatus: String,
      status: String,
      profilePicture: String
    },
    platform: {
      type: String,
      enum: ['SGXMeta', 'SGGold', 'SGBN', 'SGSE', 'SGChain', 'SG5Trader'],
      required: true,
      index: true
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, required: true, trim: true, index: true },
    department: { type: String, trim: true },
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium', index: true },
    status: {
      type: String,
      enum: ['Pending', 'Under Review', 'Escalated', 'Assigned', 'In Progress', 'Pending Approval', 'Resolved', 'Closed', 'Reopened'],
      default: 'Pending',
      index: true
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    attachments: [attachmentSchema],
    internalNotes: [noteSchema],
    resolutionNotes: [noteSchema],
    closedAt: Date,
    resolvedAt: Date
  },
  { timestamps: true }
);

ticketSchema.plugin(mongoosePaginate);

export default mongoose.model('Ticket', ticketSchema);
