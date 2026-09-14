/**
 * Admin category management — mounted at /api/admin/categories.
 * Admin authorization is enforced by the parent admin router.
 */
const express = require('express');
const router = express.Router();
const Category = require('../../models/Category');
const Product = require('../../models/Product');

// @desc    Create a category
// @route   POST /api/admin/categories
router.post('/', async (req, res, next) => {
  try {
    const { id, title, subtitle, description, image, imageSizes, displayOrder, active } = req.body;

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
      imageSizes,
      displayOrder: displayOrder || 0,
      active: active !== undefined ? active : true,
    });

    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
});

// @desc    Update a category
// @route   PUT /api/admin/categories/:id
router.put('/:id', async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const fields = ['title', 'subtitle', 'description', 'image', 'imageSizes', 'displayOrder', 'active'];
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
// @route   DELETE /api/admin/categories/:id
router.delete('/:id', async (req, res, next) => {
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
