const mongoose = require('mongoose');

/**
 * Support ticket raised from the contact page's "Raise a ticket" form.
 *
 * Tickets may be submitted by a logged-in customer (in which case `user` is
 * populated) or by a guest — so the contact details (name/email) are always
 * stored on the ticket itself rather than relying on the linked account.
 */
const ticketSchema = mongoose.Schema(
  {
    // Human-friendly reference, e.g. TKT-2609-0042. Generated pre-save.
    ticketNumber: {
      type: String,
      unique: true,
    },
    // Optional link to the submitting account (null for guests).
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [120, 'Name cannot exceed 120 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      maxlength: [200, 'Email cannot exceed 200 characters'],
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone cannot exceed 20 characters'],
    },
    // Optional related order number the customer references.
    orderNumber: {
      type: String,
      trim: true,
      maxlength: [40, 'Order reference cannot exceed 40 characters'],
    },
    category: {
      type: String,
      enum: ['order', 'product', 'delivery', 'payment', 'return', 'other'],
      default: 'other',
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: [150, 'Subject cannot exceed 150 characters'],
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      maxlength: [4000, 'Message cannot exceed 4000 characters'],
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'closed'],
      default: 'open',
    },
    // Resolution note written by staff; emailed to the customer when set.
    resolution: {
      type: String,
      trim: true,
      maxlength: [4000, 'Resolution cannot exceed 4000 characters'],
      default: '',
    },
    resolvedAt: {
      type: Date,
    },
    // Staff member who last updated the ticket (for an audit trail).
    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for the admin inbox and lookups.
ticketSchema.index({ status: 1, createdAt: -1 });
ticketSchema.index({ user: 1, createdAt: -1 });
ticketSchema.index({ email: 1 });

// Generate a readable ticket number before the first save.
ticketSchema.pre('save', function () {
  if (!this.ticketNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    this.ticketNumber = `TKT-${year}${month}-${random}`;
  }
});

const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;
