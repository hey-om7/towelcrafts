const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const Product = require('../models/Product');
const { protect, admin } = require('../middleware/authMiddleware');

// Recompute a product's average rating and review count from its reviews.
async function recomputeProductRating(product) {
  const allReviews = await Feedback.find({
    product,
    rating: { $exists: true, $ne: null },
    status: { $ne: 'rejected' },
  });

  const avgRating =
    allReviews.length > 0
      ? allReviews.reduce((acc, r) => acc + r.rating, 0) / allReviews.length
      : 0;

  await Product.findByIdAndUpdate(product, {
    rating: Math.round(avgRating * 10) / 10,
    numReviews: allReviews.length,
  });
}

// @desc    Create a new feedback, or update the user's existing product review
// @route   POST /api/feedbacks
// @access  Private
router.post('/', protect, async (req, res, next) => {
  try {
    const { review, rating, title, type, product, order } = req.body;

    const hasReview = review && review.trim() !== '';

    // A submission must carry some signal: either written text or a rating.
    if (!hasReview && !rating) {
      return res
        .status(400)
        .json({ message: 'Please provide a rating or a written review' });
    }

    const isProductReview = (type || 'general') === 'product_review' && product;

    // One product review per user per product: if the user already reviewed
    // this product, update the existing review instead of creating a new one.
    if (isProductReview) {
      const existing = await Feedback.findOne({
        user: req.user._id,
        product,
        type: 'product_review',
      });

      if (existing) {
        existing.review = hasReview ? review.trim() : '';
        existing.rating = rating || undefined;
        existing.title = title || undefined;
        if (order) existing.order = order;
        // Edited reviews go back through moderation.
        existing.status = 'pending';
        const updated = await existing.save();

        if (rating) await recomputeProductRating(product);

        return res.status(200).json(updated);
      }
    }

    const feedbackData = {
      user: req.user._id,
      review: hasReview ? review.trim() : '',
      type: type || 'general',
    };

    if (rating) feedbackData.rating = rating;
    if (title) feedbackData.title = title;
    if (product) feedbackData.product = product;
    if (order) feedbackData.order = order;

    const feedback = await Feedback.create(feedbackData);

    // Update product rating if it's a product review
    if (product && rating) {
      await recomputeProductRating(product);
    }

    res.status(201).json(feedback);
  } catch (error) {
    // Duplicate key from the unique index (race condition) → treat as conflict.
    if (error && error.code === 11000) {
      return res
        .status(409)
        .json({ message: 'You have already reviewed this product' });
    }
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

// @desc    Get the current user's own review for a product (any status)
// @route   GET /api/feedbacks/product/:productId/mine
// @access  Private
router.get('/product/:productId/mine', protect, async (req, res, next) => {
  try {
    const review = await Feedback.findOne({
      user: req.user._id,
      product: req.params.productId,
      type: 'product_review',
    });

    res.json(review || null);
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

    // Approving/rejecting changes which reviews count toward the average.
    if (feedback.product != null) {
      await recomputeProductRating(feedback.product);
    }

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

    const productId = feedback.product;

    await feedback.deleteOne();

    // Recompute the product's rating so it reflects the remaining reviews.
    if (productId != null) {
      await recomputeProductRating(productId);
    }

    res.json({ message: 'Feedback removed successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
