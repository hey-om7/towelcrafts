const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Feedback = require('../models/Feedback');
const { protect, admin } = require('../middleware/authMiddleware');

// @desc    Aggregate dashboard analytics
// @route   GET /api/stats/overview
// @access  Private/Admin
router.get('/overview', protect, admin, async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // A "paid/valid" order is anything not cancelled
    const validFilter = { orderStatus: { $ne: 'cancelled' } };

    const [
      totalOrders,
      totalCustomers,
      totalProducts,
      totalFeedback,
      revenueAgg,
      monthRevenueAgg,
      statusBreakdown,
      paymentBreakdown,
      revenueByDayAgg,
      topProductsAgg,
      categoryDistAgg,
      lowStockProducts,
      recentOrders,
      ratingAgg,
    ] = await Promise.all([
      Order.countDocuments(),
      User.countDocuments({ roles: { $nin: ['admin', 'manager'] } }),
      Product.countDocuments(),
      Feedback.countDocuments(),
      // Total revenue (non-cancelled)
      Order.aggregate([
        { $match: validFilter },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } },
      ]),
      // This month's revenue
      Order.aggregate([
        { $match: { ...validFilter, createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$totalPrice' }, count: { $sum: 1 } } },
      ]),
      // Orders by status
      Order.aggregate([
        { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
      ]),
      // Orders by payment status
      Order.aggregate([
        { $group: { _id: '$paymentStatus', count: { $sum: 1 } } },
      ]),
      // Revenue + orders per day (last 30 days)
      Order.aggregate([
        { $match: { ...validFilter, createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$totalPrice' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // Top products by units sold (from orderItems)
      Order.aggregate([
        { $match: validFilter },
        { $unwind: '$orderItems' },
        {
          $group: {
            _id: '$orderItems.title',
            units: { $sum: '$orderItems.quantity' },
            revenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } },
          },
        },
        { $sort: { units: -1 } },
        { $limit: 5 },
      ]),
      // Product distribution by category
      Product.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      // Low stock (<= 20)
      Product.find({ stockQuantity: { $lte: 20 } })
        .select('title stockQuantity category')
        .sort({ stockQuantity: 1 })
        .limit(10),
      // Recent orders
      Order.find()
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .limit(5),
      // Average rating
      Feedback.aggregate([
        { $match: { rating: { $exists: true, $ne: null } } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]),
    ]);

    const totalRevenue = revenueAgg[0]?.total || 0;
    const monthRevenue = monthRevenueAgg[0]?.total || 0;
    const monthOrders = monthRevenueAgg[0]?.count || 0;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // Build a continuous 30-day series (fill gaps with zero)
    const revenueMap = revenueByDayAgg.reduce((acc, d) => {
      acc[d._id] = d;
      return acc;
    }, {});
    const salesSeries = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      salesSeries.push({
        date: key,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: revenueMap[key]?.revenue || 0,
        orders: revenueMap[key]?.orders || 0,
      });
    }

    res.json({
      kpis: {
        totalRevenue,
        monthRevenue,
        monthOrders,
        totalOrders,
        totalCustomers,
        totalProducts,
        totalFeedback,
        avgOrderValue,
        avgRating: ratingAgg[0] ? Math.round(ratingAgg[0].avg * 10) / 10 : 0,
        ratingCount: ratingAgg[0]?.count || 0,
      },
      salesSeries,
      statusBreakdown: statusBreakdown.map((s) => ({ name: s._id || 'unknown', value: s.count })),
      paymentBreakdown: paymentBreakdown.map((s) => ({ name: s._id || 'unknown', value: s.count })),
      topProducts: topProductsAgg.map((p) => ({ name: p._id, units: p.units, revenue: p.revenue })),
      categoryDistribution: categoryDistAgg.map((c) => ({ name: c._id || 'Uncategorized', value: c.count })),
      lowStock: lowStockProducts,
      recentOrders,
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Monthly report for a given month (admin)
// @route   GET /api/stats/monthly?month=YYYY-MM
// @access  Private/Admin
router.get('/monthly', protect, admin, async (req, res, next) => {
  try {
    const monthParam = req.query.month; // e.g. "2026-08"
    const base = monthParam ? new Date(`${monthParam}-01T00:00:00`) : new Date();
    if (isNaN(base.getTime())) {
      return res.status(400).json({ message: 'Invalid month' });
    }
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    const range = { createdAt: { $gte: start, $lt: end } };
    const validRange = { ...range, orderStatus: { $ne: 'cancelled' } };

    const [
      revenueAgg,
      orderCount,
      cancelledCount,
      statusBreakdown,
      paymentBreakdown,
      topProductsAgg,
      newCustomers,
      dailyAgg,
    ] = await Promise.all([
      Order.aggregate([
        { $match: validRange },
        { $group: { _id: null, revenue: { $sum: '$totalPrice' }, paid: { $sum: '$paidAmount' } } },
      ]),
      Order.countDocuments(range),
      Order.countDocuments({ ...range, orderStatus: 'cancelled' }),
      Order.aggregate([
        { $match: range },
        { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: range },
        { $group: { _id: '$paymentStatus', count: { $sum: 1 }, amount: { $sum: '$totalPrice' } } },
      ]),
      Order.aggregate([
        { $match: validRange },
        { $unwind: '$orderItems' },
        {
          $group: {
            _id: '$orderItems.title',
            units: { $sum: '$orderItems.quantity' },
            revenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ]),
      User.countDocuments({ roles: { $nin: ['admin', 'manager'] }, createdAt: { $gte: start, $lt: end } }),
      Order.aggregate([
        { $match: validRange },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$totalPrice' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const revenue = revenueAgg[0]?.revenue || 0;
    const collected = revenueAgg[0]?.paid || 0;
    const validOrders = orderCount - cancelledCount;

    res.json({
      month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      monthLabel: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      kpis: {
        revenue,
        collected,
        outstanding: Math.max(revenue - collected, 0),
        orderCount,
        cancelledCount,
        validOrders,
        avgOrderValue: validOrders > 0 ? Math.round(revenue / validOrders) : 0,
        newCustomers,
      },
      statusBreakdown: statusBreakdown.map((s) => ({ name: s._id || 'unknown', value: s.count })),
      paymentBreakdown: paymentBreakdown.map((s) => ({ name: s._id || 'unknown', value: s.count, amount: s.amount })),
      topProducts: topProductsAgg.map((p) => ({ name: p._id, units: p.units, revenue: p.revenue })),
      daily: dailyAgg.map((d) => ({ date: d._id, revenue: d.revenue, orders: d.orders })),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;