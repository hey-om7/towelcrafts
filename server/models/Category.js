const mongoose = require('mongoose');

const categorySchema = mongoose.Schema(
  {
    _id: {
      type: Number,
      required: [true, 'Category ID is required'],
    },
    title: {
      type: String,
      required: [true, 'Category title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    subtitle: {
      type: String,
      trim: true,
      maxlength: [100, 'Subtitle cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    image: {
      type: String,
      required: [true, 'Category image is required'],
    },
    // Responsive size variants of `image`, generated on upload. `image` stays
    // the default display URL (medium); consumers may pick icon/thumb for
    // small tiles and fast-loading spots.
    imageSizes: {
      icon: String,
      thumb: String,
      small: String,
      medium: String,
      large: String,
      original: String,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

categorySchema.index({ active: 1 });
categorySchema.index({ displayOrder: 1 });
categorySchema.index({ slug: 1 });

categorySchema.pre('save', async function () {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
});

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
