const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const Product = require('../models/Product');

// NOTE: Admin write operations (create/update/delete) live in the separated
// admin namespace: server/routes/admin/adminCategoryRoutes.js (mounted at
// /api/admin/categories). This router serves only public storefront reads.

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

module.exports = router;
