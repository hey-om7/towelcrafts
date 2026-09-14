const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Address = require('../models/Address');
const Product = require('../models/Product');
const { protect } = require('../middleware/authMiddleware');
const { sendMail } = require('../utils/mailer');
const { orderConfirmationEmail } = require('../utils/emailTemplates');
const razorpay = require('../config/razorpay');

// NOTE: Admin order operations (list all orders, update status) live in the
// separated admin namespace: server/routes/admin/adminOrderRoutes.js (mounted
// at /api/admin/orders). This router serves only customer-facing order routes.

// ─────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────

/**
 * Normalize a request body into a list of { productId, quantity } lines.
 * Supports a multi-item cart ({ items: [...] }) or a legacy single product
 * ({ productId, quantity }). Returns [] when nothing valid is provided.
 */
function normalizeLines({ items, productId, quantity }) {
  if (Array.isArray(items) && items.length > 0) {
    return items
      .map((it) => ({
        productId: it.productId ?? it.product,
        quantity: Math.max(1, parseInt(it.quantity, 10) || 1),
      }))
      .filter((it) => it.productId != null);
  }
  if (productId) {
    return [{ productId, quantity: Math.max(1, parseInt(quantity, 10) || 1) }];
  }
  return [];
}

/**
 * Validate the requested lines against the catalog: existence, visibility and
 * stock. Builds the priced orderItems and computes the subtotal.
 *
 * @returns {Promise<{ error?: {status:number,message:string}, orderItems?, subtotal?, perProductQty?, productMap? }>}
 */
async function buildOrderItems(requestedLines) {
  const productIds = [...new Set(requestedLines.map((l) => l.productId))];
  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((p) => [String(p._id), p]));

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
    if (!product || product.visible === false) {
      return { error: { status: 404, message: `Product not found (${line.productId})` } };
    }
    const totalWanted = perProductQty.get(String(product._id));
    if (!product.inStock || product.stockQuantity < totalWanted) {
      return { error: { status: 400, message: `"${product.title}" is out of stock` } };
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

  return { orderItems, subtotal, perProductQty, productMap };
}

/** Resolve the shipping address for a user, honoring an explicit addressId. */
async function resolveAddress(userId, addressId) {
  if (addressId) {
    const address = await Address.findOne({ _id: addressId, user: userId });
    if (!address) return { error: { status: 404, message: 'Selected address not found' } };
    return { address };
  }
  const address =
    (await Address.findOne({ user: userId, isDefault: true })) ||
    (await Address.findOne({ user: userId }));
  if (!address) {
    return { error: { status: 400, message: 'Please add a shipping address before placing an order' } };
  }
  return { address };
}

function snapshotAddress(address) {
  return {
    addressLine: address.addressLine,
    city: address.city,
    state: address.state || '',
    pincode: address.pincode,
    country: address.country,
  };
}

/** Decrement stock for each distinct product by its aggregate quantity. */
async function decrementStock(perProductQty, productMap) {
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
}

/** Fire-and-forget order-confirmation email (never blocks the response). */
function sendOrderConfirmation(user, orderDoc) {
  if (!user.email) return;
  const { subject, html, text, attachments } = orderConfirmationEmail({
    customerName: user.name,
    order: orderDoc.toObject(),
  });
  sendMail({ to: user.email, subject, html, text, attachments }).catch((err) =>
    console.error('[orders] confirmation email error:', err.message)
  );
}

// @desc    Create new order (Cash on Delivery / non-online methods)
// @route   POST /api/orders
// @access  Private
router.post('/', protect, async (req, res, next) => {
  try {
    const { totalPrice, paymentMethod, addressId } = req.body;

    const requestedLines = normalizeLines(req.body);
    if (requestedLines.length === 0) {
      return res.status(400).json({ message: 'No valid items provided for the order' });
    }

    const built = await buildOrderItems(requestedLines);
    if (built.error) return res.status(built.error.status).json({ message: built.error.message });
    const { orderItems, subtotal, perProductQty, productMap } = built;

    const resolved = await resolveAddress(req.user._id, addressId);
    if (resolved.error) return res.status(resolved.error.status).json({ message: resolved.error.message });
    const { address } = resolved;

    // Trust the server-computed subtotal; use client total only if it is
    // consistent, otherwise fall back to the computed value.
    const finalTotal = Number.isFinite(totalPrice) && totalPrice >= subtotal ? totalPrice : subtotal;

    const order = new Order({
      user: req.user._id,
      // Keep legacy single-product fields populated for single-item orders.
      productId: orderItems.length === 1 ? orderItems[0].product : undefined,
      quantity: orderItems.length === 1 ? orderItems[0].quantity : undefined,
      orderItems,
      shippingAddress: snapshotAddress(address),
      paymentMethod: paymentMethod || 'cod',
      subtotal,
      totalPrice: finalTotal,
      orderStatus: 'placed',
      paymentStatus: 'pending',
    });

    const createdOrder = await order.save();

    await decrementStock(perProductQty, productMap);
    sendOrderConfirmation(req.user, createdOrder);

    res.status(201).json(createdOrder);
  } catch (error) {
    next(error);
  }
});

// @desc    Public payment config (is online payment available + public key id)
// @route   GET /api/orders/payment/config
// @access  Private
router.get('/payment/config', protect, (req, res) => {
  res.json({ enabled: razorpay.isConfigured(), keyId: razorpay.keyId() });
});

// @desc    Create a pending order + a Razorpay order for online payment
// @route   POST /api/orders/razorpay
// @access  Private
router.post('/razorpay', protect, async (req, res, next) => {
  try {
    if (!razorpay.isConfigured()) {
      return res.status(503).json({ message: 'Online payment is not available right now.' });
    }

    const { totalPrice, addressId } = req.body;

    const requestedLines = normalizeLines(req.body);
    if (requestedLines.length === 0) {
      return res.status(400).json({ message: 'No valid items provided for the order' });
    }

    const built = await buildOrderItems(requestedLines);
    if (built.error) return res.status(built.error.status).json({ message: built.error.message });
    const { orderItems, subtotal } = built;

    const resolved = await resolveAddress(req.user._id, addressId);
    if (resolved.error) return res.status(resolved.error.status).json({ message: resolved.error.message });
    const { address } = resolved;

    const finalTotal = Number.isFinite(totalPrice) && totalPrice >= subtotal ? totalPrice : subtotal;

    // Persist the order up-front in a pending state. Stock is NOT decremented
    // until payment is verified, so an abandoned payment never holds inventory.
    const order = new Order({
      user: req.user._id,
      productId: orderItems.length === 1 ? orderItems[0].product : undefined,
      quantity: orderItems.length === 1 ? orderItems[0].quantity : undefined,
      orderItems,
      shippingAddress: snapshotAddress(address),
      paymentMethod: 'razorpay',
      subtotal,
      totalPrice: finalTotal,
      orderStatus: 'placed',
      paymentStatus: 'pending',
    });
    const createdOrder = await order.save();

    // Create the matching Razorpay order for the same amount.
    let rzpOrder;
    try {
      rzpOrder = await razorpay.createOrder({
        amount: finalTotal,
        currency: 'INR',
        receipt: createdOrder.orderNumber || String(createdOrder._id),
        notes: { orderId: String(createdOrder._id), userId: String(req.user._id) },
      });
    } catch (err) {
      // Roll back the pending order so we don't leave orphans on gateway failure.
      await Order.deleteOne({ _id: createdOrder._id });
      console.error('[orders] razorpay createOrder failed:', err.message);
      return res.status(502).json({ message: 'Could not initiate payment. Please try again.' });
    }

    createdOrder.razorpayOrderId = rzpOrder.id;
    await createdOrder.save();

    res.status(201).json({
      orderId: createdOrder._id,
      orderNumber: createdOrder.orderNumber,
      amount: rzpOrder.amount, // paise
      currency: rzpOrder.currency,
      razorpayOrderId: rzpOrder.id,
      keyId: razorpay.keyId(),
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Verify a Razorpay payment and confirm the order
// @route   POST /api/orders/razorpay/verify
// @access  Private
router.post('/razorpay/verify', protect, async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing payment confirmation details' });
    }

    const valid = razorpay.verifyPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    // Locate the pending order (prefer the explicit id, else the razorpay id).
    const order = orderId
      ? await Order.findById(orderId)
      : await Order.findOne({ razorpayOrderId: razorpay_order_id });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    // The order must match the Razorpay order we created for it.
    if (order.razorpayOrderId && order.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ message: 'Payment does not match this order' });
    }

    if (!valid) {
      order.paymentStatus = 'failed';
      await order.save();
      return res.status(400).json({ message: 'Payment verification failed' });
    }

    // Idempotency: if this order was already paid, just return it.
    if (order.paymentStatus === 'completed') {
      return res.json(order);
    }

    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;
    order.paymentStatus = 'completed';
    order.paidAmount = order.totalPrice;
    order.paidAt = new Date();
    order.orderStatus = 'confirmed';
    const updatedOrder = await order.save();

    // Decrement stock now that payment is confirmed.
    const perProductQty = new Map();
    for (const it of updatedOrder.orderItems) {
      perProductQty.set(String(it.product), (perProductQty.get(String(it.product)) || 0) + it.quantity);
    }
    const products = await Product.find({ _id: { $in: [...perProductQty.keys()].map(Number) } });
    const productMap = new Map(products.map((p) => [String(p._id), p]));
    await decrementStock(perProductQty, productMap);

    sendOrderConfirmation(req.user, updatedOrder);

    res.json(updatedOrder);
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

    // Check if user owns this order or is staff
    if (order.user._id.toString() !== req.user._id.toString() && !req.user.isStaff()) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    const orderObj = order.toObject();
    orderObj.userId = orderObj.user;
    res.json(orderObj);
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

    if (order.user.toString() !== req.user._id.toString() && !req.user.isStaff()) {
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
