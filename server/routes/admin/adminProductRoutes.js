/**
 * Admin product management — mounted at /api/admin/products.
 * Admin authorization is enforced by the parent admin router.
 */
const express = require('express');
const router = express.Router();
const Product = require('../../models/Product');

// @desc    List all products (admin view — includes hidden/invisible ones)
// @route   GET /api/admin/products
router.get('/', async (req, res, next) => {
  try {
    const products = await Product.find({}).sort({ createdAt: -1 });
    res.json({ products, total: products.length });
  } catch (error) {
    next(error);
  }
});

// @desc    Create a product
// @route   POST /api/admin/products
router.post('/', async (req, res, next) => {
  try {
    const {
      id,
      title,
      price,
      originalPrice,
      image,
      imageSizes,
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
      visible,
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
      imageSizes,
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
      visible,
    });

    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

// @desc    Update a product
// @route   PUT /api/admin/products/:id
router.put('/:id', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const allowedFields = [
      'title', 'price', 'originalPrice', 'image', 'imageSizes', 'images', 'category',
      'description', 'shortDescription', 'categoryId', 'material',
      'weight', 'dimensions', 'color', 'inStock', 'stockQuantity',
      'featured', 'tags', 'visible',
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
// @route   DELETE /api/admin/products/:id
router.delete('/:id', async (req, res, next) => {
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
