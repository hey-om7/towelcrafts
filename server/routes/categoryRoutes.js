const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const Product = require('../models/Product');
const { protect, admin } = require('../middleware/authMiddleware');

// @desc    Get all categories (with live product counts)
// @route   GET /api/categories
// @access  Public
router.get('/', async (req, res, next) => {
  try {
    const includeInactive = req.query.all === 'true';
    const filter = includeInactive ? {} : { active: true };

    const categories = await Category.find(filter).sort({ displayOrder: 1, _id: 1 });

    // Attach live product counts
    const counts = await Product.aggregate([
      { $group: { _id: '$categoryId', count: { $sum: 1 } } },
    ]);
    const countMap = counts.reduce((acc, c) => {
      acc[c._id] = c.count;
      return acc;
    }, {});

    const withCounts = categories.map((c) => ({
      ...c.toObject(),
      productCount: countMap[c._id] || 0,
    }));

    res.json(withCounts);
  } catch (error) {
    next(error);
  }
});

// @desc    Get single category
// @route   GET /api/categories/:id
// @access  Public
router.get('/:id', async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    next(error);
  }
});

// @desc    Create a category
// @route   POST /api/categories
// @access  Private/Admin
router.post('/', protect, admin, async (req, res, next) => {
  try {
    const { id, title, subtitle, description, image, displayOrder, active } = req.body;

    if (!id || !title || !image) {
      return res.status(400).json({ message: 'Category ID, title, and image are required' });
    }

    const exists = await Category.findById(id);
    if (exists) {
      return res.status(400).json({ message: 'Category ID already exists' });
    }

    const category = await Category.create({
      _id: id,
      title,
      subtitle,
      description,
      image,
      displayOrder: displayOrder || 0,
      active: active !== undefined ? active : true,
    });

    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
});

// @desc    Update a category
// @route   PUT /api/categories/:id
// @access  Private/Admin
router.put('/:id', protect, admin, async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const fields = ['title', 'subtitle', 'description', 'image', 'displayOrder', 'active'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) category[f] = req.body[f];
    });

    const updated = await category.save();
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// @desc    Delete a category
// @route   DELETE /api/categories/:id
// @access  Private/Admin
router.delete('/:id', protect, admin, async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Guard: prevent deleting a category that still has products
    const productCount = await Product.countDocuments({ categoryId: category._id });
    if (productCount > 0) {
      return res.status(400).json({
        message: `Cannot delete — ${productCount} product(s) still belong to this category. Reassign or remove them first.`,
      });
    }

    await category.deleteOne();
    res.json({ message: 'Category removed successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
