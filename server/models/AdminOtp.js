const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Short-lived one-time password used to approve promoting a user to an admin
 * role. The code is emailed to a fixed approver address; the plaintext is never
 * stored — only a SHA-256 hash. A TTL index expires documents automatically at
 * `expiresAt`, and a small attempt counter guards against brute force.
 *
 * Flow:
 *   1. An admin requests to promote `targetUser` to `requestedRole`.
 *   2. A code is generated, hashed here, and emailed to the approver.
 *   3. The admin enters the code; on a correct, unexpired, unconsumed match
 *      the role change is committed and the doc is marked `consumed`.
 */
const adminOtpSchema = mongoose.Schema(
  {
    // The user being promoted.
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    // The privileged role being granted ('admin' | 'superadmin').
    requestedRole: {
      type: String,
      enum: ['admin', 'superadmin'],
      required: true,
    },
    // SHA-256 hash of the numeric code (plaintext is never persisted).
    codeHash: {
      type: String,
      required: true,
    },
    // Admin who initiated the request (for audit).
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Verification attempts used, capped to prevent brute force.
    attempts: {
      type: Number,
      default: 0,
    },
    // Set once the code is successfully used, so it can't be replayed.
    consumed: {
      type: Boolean,
      default: false,
    },
    // TTL anchor — MongoDB removes the document at this time.
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// Automatically delete expired OTPs (TTL index; expireAfterSeconds: 0 means
// "remove once `expiresAt` is in the past").
adminOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
adminOtpSchema.index({ targetUser: 1, consumed: 1 });

/** Hash a plaintext code the same way it's stored, for constant-time compare. */
adminOtpSchema.statics.hashCode = function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
};

/** Generate a random numeric code of the given length (default 6 digits). */
adminOtpSchema.statics.generateCode = function generateCode(length = 6) {
  const max = 10 ** length;
  const n = crypto.randomInt(0, max);
  return String(n).padStart(length, '0');
};

const AdminOtp = mongoose.model('AdminOtp', adminOtpSchema);

module.exports = AdminOtp;
