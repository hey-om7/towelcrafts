/**
 * Admin order management — mounted at /api/admin/orders.
 * Admin authorization is enforced by the parent admin router.
 */
const express = require('express');
const router = express.Router();
const Order = require('../../models/Order');
const Address = require('../../models/Address');
const { sendMail } = require('../../utils/mailer');
const { orderStatusEmail, EMAILABLE_STATUSES } = require('../../utils/emailTemplates');

// @desc    Get all orders
// @route   GET /api/admin/orders
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const paymentStatus = req.query.paymentStatus;

    const filter = {};
    if (status) filter.orderStatus = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    const total = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .populate('user', 'name email phone')
      .populate('productId', 'title price image')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Attach address info for backward compatibility
    const ordersWithAddress = await Promise.all(
      orders.map(async (order) => {
        const orderObj = order.toObject();
        if (!orderObj.shippingAddress || !orderObj.shippingAddress.addressLine) {
          const address = order.user
            ? await Address.findOne({ user: order.user._id })
            : null;
          if (address) {
            orderObj.shippingAddress = {
              addressLine: address.addressLine,
              city: address.city,
              state: address.state,
              pincode: address.pincode,
              country: address.country,
            };
          }
        }
        // Legacy field mapping
        orderObj.userId = orderObj.user;
        return orderObj;
      })
    );

    res.json({
      orders: ordersWithAddress,
      page,
      pages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Update order status
// @route   PUT /api/admin/orders/:id/status
router.put('/:id/status', async (req, res, next) => {
  try {
    const { orderStatus, trackingNumber, paymentStatus } = req.body;
    // When the admin toggles "skip email", the client sends sendEmail:false.
    // Default is to send an email on an emailable status change.
    const sendEmail = req.body.sendEmail !== false;

    const order = await Order.findById(req.params.id).populate('user', 'name email');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Remember the previous status so we only email on an actual change.
    const previousStatus = order.orderStatus;

    if (orderStatus) {
      order.orderStatus = orderStatus;
      if (orderStatus === 'shipped') order.shippedAt = new Date();
      if (orderStatus === 'delivered') order.deliveredAt = new Date();
      if (orderStatus === 'cancelled') order.cancelledAt = new Date();
    }

    if (trackingNumber !== undefined) order.trackingNumber = trackingNumber;
    if (paymentStatus) {
      order.paymentStatus = paymentStatus;
      if (paymentStatus === 'completed') {
        order.paidAt = new Date();
        if (!order.paidAmount) order.paidAmount = order.totalPrice;
      }
    }
    if (req.body.paidAmount !== undefined) order.paidAmount = req.body.paidAmount;
    if (req.body.notes !== undefined) order.notes = req.body.notes;

    const updatedOrder = await order.save();

    // Fire the status-change email (fire-and-forget) when:
    //  - the order status actually changed,
    //  - the new status is one we email customers about,
    //  - the admin did not opt to skip the email,
    //  - and we have a recipient address.
    const statusChanged = orderStatus && orderStatus !== previousStatus;
    const recipient = order.user && order.user.email;
    let emailQueued = false;

    if (statusChanged && sendEmail && EMAILABLE_STATUSES.includes(orderStatus) && recipient) {
      const built = orderStatusEmail({
        customerName: order.user.name,
        status: orderStatus,
        order: updatedOrder.toObject(),
      });
      if (built) {
        const result = await sendMail({
          to: recipient,
          subject: built.subject,
          html: built.html,
          text: built.text,
          attachments: built.attachments,
        });
        emailQueued = Boolean(result && result.sent);
        if (!emailQueued) {
          console.error(
            '[orders] status email not sent:',
            result && (result.error || (result.skipped ? 'email disabled/not configured' : 'unknown'))
          );
        }
      }
    }

    const responseObj = updatedOrder.toObject();
    responseObj.emailQueued = emailQueued;
    res.json(responseObj);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
