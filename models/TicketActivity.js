import mongoose from 'mongoose';

const ticketActivitySchema = new mongoose.Schema(
  {
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    ticketId: { type: String, required: true, index: true },
    actionType: {
      type: String,
      enum: ['created', 'updated', 'escalated', 'assigned', 'reassigned', 'status_changed', 'priority_changed', 'resolved', 'closed', 'reopened', 'note_added'],
      required: true
    },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedByName: String,
    fromStatus: String,
    toStatus: String,
    remarks: String,
    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

export default mongoose.model('TicketActivity', ticketActivitySchema);
