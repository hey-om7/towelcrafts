/**
 * Admin feedback moderation — mounted at /api/admin/feedbacks.
 * Admin authorization is enforced by the parent admin router.
 */
const express = require('express');
const router = express.Router();
const Feedback = require('../../models/Feedback');
const Product = require('../../models/Product');

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

// @desc    Get all feedbacks
// @route   GET /api/admin/feedbacks
router.get('/', async (req, res, next) => {
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

// @desc    Update feedback status
// @route   PUT /api/admin/feedbacks/:id/status
router.put('/:id/status', async (req, res, next) => {
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
// @route   DELETE /api/admin/feedbacks/:id
router.delete('/:id', async (req, res, next) => {
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
