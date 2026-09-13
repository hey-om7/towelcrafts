const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Address = require('../models/Address');
const Product = require('../models/Product');
const { protect, admin } = require('../middleware/authMiddleware');
const { sendMail } = require('../utils/mailer');
const { orderConfirmationEmail, orderStatusEmail, EMAILABLE_STATUSES } = require('../utils/emailTemplates');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
router.post('/', protect, async (req, res, next) => {
  try {
    const { productId, quantity, totalPrice, paymentMethod, addressId, items } = req.body;

    // Normalize the request into a list of { productId, quantity } lines.
    // Supports two shapes:
    //   1. Multi-item cart:  { items: [{ productId, quantity }, ...] }
    //   2. Legacy single:    { productId, quantity }
    let requestedLines;
    if (Array.isArray(items) && items.length > 0) {
      requestedLines = items
        .map((it) => ({
          productId: it.productId ?? it.product,
          quantity: Math.max(1, parseInt(it.quantity, 10) || 1),
        }))
        .filter((it) => it.productId != null);
    } else if (productId) {
      requestedLines = [{ productId, quantity: Math.max(1, parseInt(quantity, 10) || 1) }];
    } else {
      return res.status(400).json({ message: 'No items provided for the order' });
    }

    if (requestedLines.length === 0) {
      return res.status(400).json({ message: 'No valid items provided for the order' });
    }

    // Fetch all referenced products in one query.
    const productIds = [...new Set(requestedLines.map((l) => l.productId))];
    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    // Validate every line: existence + stock. Aggregate quantities per product
    // so a product added twice is checked against total requested stock.
    const perProductQty = new Map();
    for (const line of requestedLines) {
      perProductQty.set(
        String(line.productId),
        (perProductQty.get(String(line.productId)) || 0) + line.quantity
      );
    }

    const orderItems = [];
    let subtotal = 0;
    for (const line of requestedLines) {
      const product = productMap.get(String(line.productId));
      if (!product) {
        return res.status(404).json({ message: `Product not found (${line.productId})` });
      }
      const totalWanted = perProductQty.get(String(product._id));
      if (!product.inStock || product.stockQuantity < totalWanted) {
        return res.status(400).json({ message: `"${product.title}" is out of stock` });
      }
      orderItems.push({
        product: product._id,
        title: product.title,
        image: product.image,
        price: product.price,
        quantity: line.quantity,
      });
      subtotal += product.price * line.quantity;
    }

    // Resolve the shipping address: use the one chosen at checkout if provided
    // (verifying ownership), otherwise fall back to the user's default.
    let address;
    if (addressId) {
      address = await Address.findOne({ _id: addressId, user: req.user._id });
      if (!address) {
        return res.status(404).json({ message: 'Selected address not found' });
      }
    } else {
      address =
        (await Address.findOne({ user: req.user._id, isDefault: true })) ||
        (await Address.findOne({ user: req.user._id }));
    }

    if (!address) {
      return res.status(400).json({ message: 'Please add a shipping address before placing an order' });
    }

    // Trust the server-computed subtotal; use client total only if it is
    // consistent, otherwise fall back to the computed value.
    const finalTotal = Number.isFinite(totalPrice) && totalPrice >= subtotal ? totalPrice : subtotal;

    const order = new Order({
      user: req.user._id,
      // Keep legacy single-product fields populated for single-item orders.
      productId: orderItems.length === 1 ? orderItems[0].product : undefined,
      quantity: orderItems.length === 1 ? orderItems[0].quantity : undefined,
      orderItems,
      shippingAddress: {
        addressLine: address.addressLine,
        city: address.city,
        state: address.state || '',
        pincode: address.pincode,
        country: address.country,
      },
      paymentMethod: paymentMethod || 'cod',
      subtotal,
      totalPrice: finalTotal,
      orderStatus: 'placed',
      paymentStatus: 'pending',
    });

    const createdOrder = await order.save();

    // Decrease stock for each distinct product by its aggregate quantity.
    await Promise.all(
      [...perProductQty.entries()].map(async ([pid, qty]) => {
        const product = productMap.get(pid);
        if (!product) return;
        product.stockQuantity -= qty;
        if (product.stockQuantity <= 0) {
          product.stockQuantity = 0;
          product.inStock = false;
        }
        await product.save();
      })
    );

    // Send order-confirmation email (fire-and-forget — never blocks or
    // fails the order response if email is unconfigured or SMTP errors).
    if (req.user.email) {
      const { subject, html, text } = orderConfirmationEmail({
        customerName: req.user.name,
        order: createdOrder.toObject(),
      });
      sendMail({ to: req.user.email, subject, html, text }).catch((err) =>
        console.error('[orders] confirmation email error:', err.message)
      );
    }

    res.status(201).json(createdOrder);
  } catch (error) {
    next(error);
  }
});

// @desc    Get logged-in user's orders
// @route   GET /api/orders/myorders
// @access  Private
router.get('/myorders', protect, async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('productId', 'title price image')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    next(error);
  }
});

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
router.get('/', protect, admin, async (req, res, next) => {
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

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
router.get('/:id', protect, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('productId', 'title price image category');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if user owns this order or is admin
    if (order.user._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    const orderObj = order.toObject();
    orderObj.userId = orderObj.user;
    res.json(orderObj);
  } catch (error) {
    next(error);
  }
});

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
router.put('/:id/status', protect, admin, async (req, res, next) => {
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
        // Await the send so we can report the true outcome to the admin UI.
        // sendMail never throws — it resolves to { sent, skipped?, error? }.
        const result = await sendMail({
          to: recipient,
          subject: built.subject,
          html: built.html,
          text: built.text,
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

    // Return the updated order plus whether an email was actually sent, so the
    // admin UI can reflect the true result instead of assuming success.
    const responseObj = updatedOrder.toObject();
    responseObj.emailQueued = emailQueued;
    res.json(responseObj);
  } catch (error) {
    next(error);
  }
});

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
router.put('/:id/cancel', protect, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (['shipped', 'delivered'].includes(order.orderStatus)) {
      return res.status(400).json({ message: 'Cannot cancel order that has been shipped or delivered' });
    }

    order.orderStatus = 'cancelled';
    order.cancelledAt = new Date();
    order.cancellationReason = req.body.reason || 'Cancelled by user';

    // Restore stock
    if (order.productId) {
      const product = await Product.findById(order.productId);
      if (product) {
        product.stockQuantity += order.quantity || 1;
        product.inStock = true;
        await product.save();
      }
    }

    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
