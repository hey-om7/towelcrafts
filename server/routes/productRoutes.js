const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { protect, admin } = require('../middleware/authMiddleware');

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
    const products = await Product.find({ featured: true, inStock: true })
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
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    next(error);
  }
});

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
router.post('/', protect, admin, async (req, res, next) => {
  try {
    const {
      id,
      title,
      price,
      originalPrice,
      image,
      images,
      category,
      description,
      shortDescription,
      categoryId,
      material,
      weight,
      dimensions,
      color,
      stockQuantity,
      featured,
      tags,
    } = req.body;

    if (!id || !title || !price || !description || !categoryId || !image) {
      return res.status(400).json({
        message: 'Product ID, title, price, description, category ID, and image are required',
      });
    }

    const productExists = await Product.findById(id);
    if (productExists) {
      return res.status(400).json({ message: 'Product ID already exists' });
    }

    const product = await Product.create({
      _id: id,
      title,
      price,
      originalPrice,
      image,
      images,
      category,
      description,
      shortDescription,
      categoryId,
      material,
      weight,
      dimensions,
      color,
      stockQuantity,
      featured,
      tags,
    });

    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
router.put('/:id', protect, admin, async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const allowedFields = [
      'title', 'price', 'originalPrice', 'image', 'images', 'category',
      'description', 'shortDescription', 'categoryId', 'material',
      'weight', 'dimensions', 'color', 'inStock', 'stockQuantity',
      'featured', 'tags',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });

    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } catch (error) {
    next(error);
  }
});

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
router.delete('/:id', protect, admin, async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await product.deleteOne();
    res.json({ message: 'Product removed successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
