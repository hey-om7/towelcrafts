/**
 * Admin support-ticket management — mounted at /api/admin/tickets.
 * Admin authorization is enforced by the parent admin router (protect + admin).
 */
const express = require('express');
const router = express.Router();
const Ticket = require('../../models/Ticket');
const { sendMail } = require('../../utils/mailer');
const { ticketResolutionEmail } = require('../../utils/emailTemplates');

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

// @desc    List all tickets (paginated, optional status filter)
// @route   GET /api/admin/tickets
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const { status } = req.query;

    const filter = {};
    if (status && STATUSES.includes(status)) filter.status = status;

    const total = await Ticket.countDocuments(filter);
    const tickets = await Ticket.find(filter)
      .populate('user', 'name email')
      .populate('handledBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      tickets,
      page,
      pages: Math.ceil(total / limit),
      total,
      open: await Ticket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get a single ticket
// @route   GET /api/admin/tickets/:id
router.get('/:id', async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('user', 'name email')
      .populate('handledBy', 'name email');
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    res.json(ticket);
  } catch (error) {
    next(error);
  }
});

// @desc    Update a ticket (status and/or resolution).
//          When a resolution note is provided (or newly set), the customer is
//          emailed the resolution. Setting status to resolved/closed stamps
//          resolvedAt.
// @route   PUT /api/admin/tickets/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { status, resolution, priority } = req.body;

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    if (status !== undefined) {
      if (!STATUSES.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      ticket.status = status;
    }

    if (priority !== undefined && ['low', 'normal', 'high', 'urgent'].includes(priority)) {
      ticket.priority = priority;
    }

    // Detect a newly-entered / changed resolution to decide whether to email.
    const trimmedResolution = typeof resolution === 'string' ? resolution.trim() : undefined;
    const resolutionChanged =
      trimmedResolution !== undefined && trimmedResolution !== '' && trimmedResolution !== ticket.resolution;

    if (trimmedResolution !== undefined) {
      ticket.resolution = trimmedResolution;
    }

    if (['resolved', 'closed'].includes(ticket.status) && !ticket.resolvedAt) {
      ticket.resolvedAt = new Date();
    }

    ticket.handledBy = req.user._id;

    const updated = await ticket.save();

    // Email the customer their resolution when one was entered/changed.
    let emailQueued = false;
    if (resolutionChanged && updated.email) {
      const { subject, html, text, attachments } = ticketResolutionEmail({
        ticket: updated.toObject(),
        resolution: updated.resolution,
      });
      const result = await sendMail({ to: updated.email, subject, html, text, attachments });
      emailQueued = Boolean(result && result.sent);
      if (!emailQueued) {
        console.error(
          '[tickets] resolution email not sent:',
          result && (result.error || (result.skipped ? 'email disabled/not configured' : 'unknown'))
        );
      }
    }

    const responseObj = updated.toObject();
    responseObj.emailQueued = emailQueued;
    res.json(responseObj);
  } catch (error) {
    next(error);
  }
});

// @desc    Delete a ticket
// @route   DELETE /api/admin/tickets/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    await ticket.deleteOne();
    res.json({ message: 'Ticket removed successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
