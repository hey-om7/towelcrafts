/**
 * Razorpay payments client.
 *
 * Credentials are read from environment variables (see server/.env):
 *   RAZORPAY_KEY_ID       Public key id (safe to send to the browser)
 *   RAZORPAY_KEY_SECRET   Private secret (server-only; used to sign/verify)
 *
 * If the keys are not configured, Razorpay is treated as disabled and callers
 * fall back gracefully (online payment is simply unavailable; COD still works)
 * — mirroring how config/r2.js and utils/mailer.js behave.
 */
const crypto = require('crypto');
const Razorpay = require('razorpay');

let client = null;

function isConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

/** The public key id, exposed to the frontend so it can open Checkout. */
function keyId() {
  return process.env.RAZORPAY_KEY_ID || '';
}

/** Lazily-created singleton Razorpay client, or null when not configured. */
function getClient() {
  if (!isConfigured()) return null;
  if (client) return client;
  client = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  return client;
}

/**
 * Create a Razorpay order.
 *
 * @param {Object} opts
 * @param {number} opts.amount    Amount in the major unit (e.g. rupees). It is
 *                                converted to the smallest unit (paise) here.
 * @param {string} [opts.currency='INR']
 * @param {string} [opts.receipt] Your internal reference (e.g. order number)
 * @param {Object} [opts.notes]   Arbitrary key/value metadata
 * @returns {Promise<Object>} the created Razorpay order
 */
async function createOrder({ amount, currency = 'INR', receipt, notes }) {
  const rzp = getClient();
  if (!rzp) {
    const err = new Error('Razorpay is not configured');
    err.code = 'RAZORPAY_NOT_CONFIGURED';
    throw err;
  }
  // Razorpay expects an integer amount in paise. Round to avoid float drift.
  const amountPaise = Math.round(Number(amount) * 100);
  return rzp.orders.create({
    amount: amountPaise,
    currency,
    receipt: receipt ? String(receipt) : undefined,
    notes: notes || {},
  });
}

/**
 * Verify the checkout signature returned by Razorpay after a successful
 * payment. The signature is an HMAC-SHA256 of "<order_id>|<payment_id>" keyed
 * by the account secret. A constant-time compare guards against timing attacks.
 *
 * @param {Object} p
 * @param {string} p.orderId    razorpay_order_id
 * @param {string} p.paymentId  razorpay_payment_id
 * @param {string} p.signature  razorpay_signature
 * @returns {boolean} true when the signature is authentic
 */
function verifyPaymentSignature({ orderId, paymentId, signature }) {
  if (!isConfigured() || !orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  // Constant-time comparison; guard against length mismatch which would throw.
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  isConfigured,
  keyId,
  getClient,
  createOrder,
  verifyPaymentSignature,
};
