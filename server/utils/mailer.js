const nodemailer = require('nodemailer');

/**
 * Lazily-created singleton transporter.
 *
 * Credentials are read from environment variables (see server/.env):
 *   EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE, EMAIL_USER, EMAIL_PASS
 *
 * If EMAIL_USER / EMAIL_PASS are not configured, email is treated as
 * disabled and send calls resolve to a no-op instead of throwing — this
 * keeps order placement working in local/dev environments without SMTP.
 */
let transporter = null;
let verified = false;

function isConfigured() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

function getTransporter() {
  if (!isConfigured()) return null;
  if (transporter) return transporter;

  const port = Number(process.env.EMAIL_PORT) || 587;
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port,
    // secure=true for port 465, false for 587 (STARTTLS)
    secure: String(process.env.EMAIL_SECURE).toLowerCase() === 'true' || port === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  return transporter;
}

/**
 * Send an email. Never throws — returns { sent, skipped?, error? } so callers
 * can safely fire-and-forget without breaking the request flow.
 *
 * @param {Object} opts
 * @param {string} opts.to      Recipient email address
 * @param {string} opts.subject Email subject
 * @param {string} opts.html    HTML body
 * @param {string} [opts.text]  Optional plain-text fallback
 * @param {Array}  [opts.attachments] Optional nodemailer attachments (e.g. the
 *                                    inline CID logo shipped by the templates)
 */
async function sendMail({ to, subject, html, text, attachments }) {
  const tx = getTransporter();

  if (!tx) {
    console.warn('[mailer] EMAIL_USER/EMAIL_PASS not configured — skipping email to', to);
    return { sent: false, skipped: true };
  }

  if (!to) {
    return { sent: false, skipped: true, error: 'No recipient' };
  }

  const fromName = process.env.EMAIL_FROM_NAME || 'TowelCrafts';
  const fromAddress = process.env.EMAIL_USER;

  try {
    // Verify connection config once per process (helps surface bad creds early).
    if (!verified) {
      await tx.verify();
      verified = true;
    }

    const info = await tx.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to,
      subject,
      text,
      html,
      ...(attachments && attachments.length ? { attachments } : {}),
    });

    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error('[mailer] Failed to send email:', error.message);
    return { sent: false, error: error.message };
  }
}

module.exports = { sendMail, isConfigured };
