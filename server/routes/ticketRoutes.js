const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { STAFF_ROLES } = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { sendMail } = require('../utils/mailer');
const { ticketCreatedEmail } = require('../utils/emailTemplates');

// NOTE: Admin ticket management (list all, update status/resolution, delete)
// lives in the separated admin namespace: server/routes/admin/adminTicketRoutes.js
// (mounted at /api/admin/tickets). This router serves public ticket creation
// and a logged-in customer's own ticket history.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CATEGORIES = ['order', 'product', 'delivery', 'payment', 'return', 'other'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

/**
 * Best-effort optional auth: if a valid Bearer token is present, attach the
 * user so the ticket is linked to their account and their details prefilled.
 * Never rejects — the contact form is usable by guests too.
 */
async function optionalUser(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET || 'secret123');
    const user = await User.findById(decoded.id).select('-password');
    return user && user.isActive ? user : null;
  } catch {
    return null;
  }
}

/**
 * Email every active staff member (admin/manager) that a ticket was raised.
 * Fire-and-forget — failures are logged, never block the customer response.
 */
async function notifyStaffOfTicket(ticket) {
  try {
    const staff = await User.find({
      roles: { $in: STAFF_ROLES },
      isActive: { $ne: false },
    }).select('email');
    const recipients = [...new Set(staff.map((s) => s.email).filter(Boolean))];
    if (recipients.length === 0) return;

    const { subject, html, text, attachments } = ticketCreatedEmail({ ticket });
    // Send individually so one bad address doesn't drop the rest.
    await Promise.all(
      recipients.map((to) =>
        sendMail({ to, subject, html, text, attachments }).catch((err) =>
          console.error('[tickets] staff notify error:', to, err.message)
        )
      )
    );
  } catch (err) {
    console.error('[tickets] notifyStaffOfTicket failed:', err.message);
  }
}

// @desc    Raise a support ticket
// @route   POST /api/tickets
// @access  Public (optionally authenticated)
router.post('/', async (req, res, next) => {
  try {
    const user = await optionalUser(req);

    const {
      name,
      email,
      phone,
      orderNumber,
      category,
      priority,
      subject,
      message,
    } = req.body;

    // Fall back to the account's details when logged in and fields are blank.
    const finalName = (name || user?.name || '').trim();
    const finalEmail = (email || user?.email || '').trim().toLowerCase();
    const finalSubject = (subject || '').trim();
    const finalMessage = (message || '').trim();

    if (!finalName) return res.status(400).json({ message: 'Please enter your name' });
    if (!EMAIL_RE.test(finalEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }
    if (!finalSubject) return res.status(400).json({ message: 'Please enter a subject' });
    if (!finalMessage) {
      return res.status(400).json({ message: 'Please describe how we can help' });
    }

    const ticket = await Ticket.create({
      user: user ? user._id : undefined,
      name: finalName,
      email: finalEmail,
      phone: (phone || user?.phone || '').trim(),
      orderNumber: (orderNumber || '').trim(),
      category: CATEGORIES.includes(category) ? category : 'other',
      priority: PRIORITIES.includes(priority) ? priority : 'normal',
      subject: finalSubject,
      message: finalMessage,
      status: 'open',
    });

    // Notify staff (do not block the response on email delivery).
    notifyStaffOfTicket(ticket);

    res.status(201).json({
      message: 'Your ticket has been raised. Our team will be in touch soon.',
      ticketNumber: ticket.ticketNumber,
      _id: ticket._id,
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get the logged-in customer's own tickets
// @route   GET /api/tickets/mine
// @access  Private
router.get('/mine', protect, async (req, res, next) => {
  try {
    const tickets = await Ticket.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
