const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Address = require('../models/Address');
const Product = require('../models/Product');
const { protect, admin } = require('../middleware/authMiddleware');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
router.post('/', protect, async (req, res, next) => {
  try {
    const { productId, quantity, totalPrice, paymentMethod, addressId } = req.body;

    if (!productId || !quantity || !totalPrice) {
      return res.status(400).json({ message: 'Product ID, quantity, and total price are required' });
    }

    // Fetch the product details
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (!product.inStock || product.stockQuantity < quantity) {
      return res.status(400).json({ message: 'Product is out of stock' });
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

    const order = new Order({
      user: req.user._id,
      productId: product._id,
      quantity,
      orderItems: [
        {
          product: product._id,
          title: product.title,
          image: product.image,
          price: product.price,
          quantity,
        },
      ],
      shippingAddress: {
        addressLine: address.addressLine,
        city: address.city,
        state: address.state || '',
        pincode: address.pincode,
        country: address.country,
      },
      paymentMethod: paymentMethod || 'cod',
      subtotal: product.price * quantity,
      totalPrice,
      orderStatus: 'placed',
      paymentStatus: 'pending',
    });

    const createdOrder = await order.save();

    // Decrease stock
    product.stockQuantity -= quantity;
    if (product.stockQuantity <= 0) {
      product.inStock = false;
    }
    await product.save();

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

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

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
    res.json(updatedOrder);
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
