const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// NOTE: Admin write operations (create/update/delete) live in the separated
// admin namespace: server/routes/admin/adminProductRoutes.js (mounted at
// /api/admin/products). This router serves only public storefront reads.

// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
router.get('/', async (req, res, next) => {
  try {
    const {
      category,
      categoryId,
      featured,
      inStock,
      minPrice,
      maxPrice,
      search,
      sort,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = {};

    // Never expose hidden products on the storefront. `$ne: false` also
    // includes legacy documents that predate the `visible` field.
    filter.visible = { $ne: false };

    if (categoryId) filter.categoryId = Number(categoryId);
    if (category) filter.category = { $regex: category, $options: 'i' };
    if (featured === 'true') filter.featured = true;
    if (inStock === 'true') filter.inStock = true;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Sort options
    let sortObj = { createdAt: -1 };
    if (sort === 'price_asc') sortObj = { price: 1 };
    if (sort === 'price_desc') sortObj = { price: -1 };
    if (sort === 'rating') sortObj = { rating: -1 };
    if (sort === 'newest') sortObj = { createdAt: -1 };

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit));

    res.json({
      products,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      total,
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Fetch featured products
// @route   GET /api/products/featured
// @access  Public
router.get('/featured', async (req, res, next) => {
  try {
    const products = await Product.find({ featured: true, inStock: true, visible: { $ne: false } })
      .sort({ rating: -1 })
      .limit(8);
    res.json(products);
  } catch (error) {
    next(error);
  }
});

// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Public
router.get('/:id', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (product && product.visible !== false) {
      res.json(product);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
