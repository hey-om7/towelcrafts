const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const Product = require('../models/Product');
const { protect, admin } = require('../middleware/authMiddleware');

// @desc    Create a new feedback
// @route   POST /api/feedbacks
// @access  Private
router.post('/', protect, async (req, res, next) => {
  try {
    const { review, rating, title, type, product, order } = req.body;

    if (!review || review.trim() === '') {
      return res.status(400).json({ message: 'Review text is required' });
    }

    const feedbackData = {
      user: req.user._id,
      review: review.trim(),
      type: type || 'general',
    };

    if (rating) feedbackData.rating = rating;
    if (title) feedbackData.title = title;
    if (product) feedbackData.product = product;
    if (order) feedbackData.order = order;

    const feedback = await Feedback.create(feedbackData);

    // Update product rating if it's a product review
    if (product && rating) {
      const allReviews = await Feedback.find({
        product,
        rating: { $exists: true, $ne: null },
        status: { $ne: 'rejected' },
      });

      const avgRating =
        allReviews.reduce((acc, r) => acc + r.rating, 0) / allReviews.length;

      await Product.findByIdAndUpdate(product, {
        rating: Math.round(avgRating * 10) / 10,
        numReviews: allReviews.length,
      });
    }

    res.status(201).json(feedback);
  } catch (error) {
    next(error);
  }
});

// @desc    Get all feedbacks
// @route   GET /api/feedbacks
// @access  Private/Admin
router.get('/', protect, admin, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    const filter = {};
    if (status) filter.status = status;

    const total = await Feedback.countDocuments(filter);
    const feedbacks = await Feedback.find(filter)
      .populate('user', 'name email')
      .populate('product', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      feedbacks,
      page,
      pages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get product reviews
// @route   GET /api/feedbacks/product/:productId
// @access  Public
router.get('/product/:productId', async (req, res, next) => {
  try {
    const reviews = await Feedback.find({
      product: req.params.productId,
      status: 'approved',
      type: 'product_review',
    })
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    next(error);
  }
});

// @desc    Update feedback status
// @route   PUT /api/feedbacks/:id/status
// @access  Private/Admin
router.put('/:id/status', protect, admin, async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const feedback = await Feedback.findById(req.params.id);

    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    feedback.status = status;
    const updatedFeedback = await feedback.save();

    res.json(updatedFeedback);
  } catch (error) {
    next(error);
  }
});

// @desc    Delete feedback
// @route   DELETE /api/feedbacks/:id
// @access  Private/Admin
router.delete('/:id', protect, admin, async (req, res, next) => {
  try {
    const feedback = await Feedback.findById(req.params.id);

    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    await feedback.deleteOne();
    res.json({ message: 'Feedback removed successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
