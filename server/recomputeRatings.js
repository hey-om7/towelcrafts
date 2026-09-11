/**
 * One-time maintenance script.
 *
 * Recomputes every product's `rating` and `numReviews` from the actual
 * Feedback documents (approved, rated product reviews). Products with no
 * qualifying reviews are reset to rating 0 / numReviews 0.
 *
 * This corrects stale values — e.g. seeded ratings, or products whose reviews
 * were deleted before the delete route recomputed ratings.
 *
 * Usage:  node server/recomputeRatings.js
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const Product = require('./models/Product');
const Feedback = require('./models/Feedback');

dotenv.config();

async function run() {
  await connectDB();

  const products = await Product.find({}, '_id title rating numReviews');
  let changed = 0;

  for (const product of products) {
    const reviews = await Feedback.find({
      product: product._id,
      rating: { $exists: true, $ne: null },
      status: { $ne: 'rejected' },
    });

    const numReviews = reviews.length;
    const avgRating =
      numReviews > 0
        ? Math.round(
            (reviews.reduce((acc, r) => acc + r.rating, 0) / numReviews) * 10
          ) / 10
        : 0;

    if (product.rating !== avgRating || product.numReviews !== numReviews) {
      await Product.findByIdAndUpdate(product._id, {
        rating: avgRating,
        numReviews,
      });
      console.log(
        `Updated "${product.title}" (#${product._id}): ` +
          `${product.rating}/${product.numReviews} → ${avgRating}/${numReviews}`
      );
      changed += 1;
    }
  }

  console.log(
    `\nDone. ${changed} product(s) updated out of ${products.length}.`
  );
  await mongoose.connection.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('Error recomputing ratings:', err);
  process.exit(1);
});
