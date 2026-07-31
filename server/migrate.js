/**
 * Data migration script — brings previously-stored documents in line with the
 * remodeled schema (v2.0.0). Safe to run multiple times (idempotent).
 *
 * Usage:  node migrate.js
 *
 * What it does:
 *  1. Orders   — maps legacy `userId` → `user`, builds `orderItems` from the
 *                single-product fields, embeds `shippingAddress` from the user's
 *                Address, sets `subtotal`, `orderStatus`, `paymentStatus`, and
 *                generates a unique `orderNumber`.
 *  2. Users    — sets `authProvider` (default 'local'), `isActive` (default true),
 *                and syncs `role` with `isAdmin`.
 *  3. Addresses— ensures exactly one `isDefault` address per user; sets
 *                `country` default and `label` default.
 *  4. Products — backfills `slug`, `inStock`, and `stockQuantity` defaults.
 *  5. Feedback — sets `status` ('approved' for pre-existing) and `type` defaults.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const Order = require('./models/Order');
const User = require('./models/User');
const Address = require('./models/Address');
const Product = require('./models/Product');
const Feedback = require('./models/Feedback');

dotenv.config();

const log = (...args) => console.log('  ', ...args);

async function migrateUsers() {
  console.log('\n👤 Migrating Users...');
  const users = await User.find({}).lean();
  let updated = 0;

  for (const u of users) {
    const set = {};
    if (u.authProvider === undefined) set.authProvider = u.googleId ? 'google' : 'local';
    if (u.isActive === undefined) set.isActive = true;
    if (!u.role) set.role = u.isAdmin ? 'admin' : 'customer';
    // Keep isAdmin and role consistent
    if (u.isAdmin && u.role && u.role === 'customer') set.role = 'admin';

    if (Object.keys(set).length) {
      await User.updateOne({ _id: u._id }, { $set: set });
      updated++;
    }
  }
  log(`${updated} of ${users.length} users updated`);
}

async function migrateAddresses() {
  console.log('\n🏠 Migrating Addresses...');
  const addresses = await Address.find({}).lean();
  let updated = 0;

  // Ensure defaults on fields
  for (const a of addresses) {
    const set = {};
    if (!a.country) set.country = 'India';
    if (!a.label) set.label = 'home';
    if (Object.keys(set).length) {
      await Address.updateOne({ _id: a._id }, { $set: set });
      updated++;
    }
  }

  // Ensure one default address per user
  const userIds = [...new Set(addresses.map((a) => String(a.user)))];
  for (const uid of userIds) {
    const userAddrs = addresses.filter((a) => String(a.user) === uid);
    const hasDefault = userAddrs.some((a) => a.isDefault);
    if (!hasDefault && userAddrs.length > 0) {
      await Address.updateOne({ _id: userAddrs[0]._id }, { $set: { isDefault: true } });
    }
  }

  log(`${updated} of ${addresses.length} addresses normalized`);
}

async function migrateProducts() {
  console.log('\n📦 Migrating Products...');
  const products = await Product.find({}).lean();
  let updated = 0;

  for (const p of products) {
    const set = {};
    if (p.inStock === undefined) set.inStock = true;
    if (p.stockQuantity === undefined) set.stockQuantity = 100;
    if (!p.slug && p.title) {
      set.slug = p.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
    if (Object.keys(set).length) {
      await Product.updateOne({ _id: p._id }, { $set: set });
      updated++;
    }
  }
  log(`${updated} of ${products.length} products backfilled`);
}

async function migrateFeedback() {
  console.log('\n💬 Migrating Feedback...');
  const feedbacks = await Feedback.find({}).lean();
  let updated = 0;

  for (const f of feedbacks) {
    const set = {};
    // Pre-existing feedback is grandfathered in as approved
    if (!f.status) set.status = 'approved';
    if (!f.type) set.type = 'general';
    if (Object.keys(set).length) {
      await Feedback.updateOne({ _id: f._id }, { $set: set });
      updated++;
    }
  }
  log(`${updated} of ${feedbacks.length} feedback records updated`);
}

async function migrateOrders() {
  console.log('\n🛒 Migrating Orders...');
  // Use the raw collection to read legacy fields that are no longer in the schema
  const raw = mongoose.connection.collection('orders');
  const legacyOrders = await raw.find({}).toArray();
  let migrated = 0;

  for (const o of legacyOrders) {
    const set = {};

    // Map legacy userId -> user
    const userId = o.user || o.userId;
    if (o.user === undefined && o.userId) set.user = o.userId;

    // Build orderItems if missing
    if ((!o.orderItems || o.orderItems.length === 0) && o.productId) {
      const product = await Product.findById(o.productId).lean();
      set.orderItems = [
        {
          product: o.productId,
          title: product ? product.title : 'Product',
          image: product ? product.image : '',
          price: product ? product.price : o.totalPrice || 0,
          quantity: o.quantity || 1,
        },
      ];
    }

    // Embed shipping address if missing
    if (!o.shippingAddress || !o.shippingAddress.addressLine) {
      const address = userId ? await Address.findOne({ user: userId }).lean() : null;
      if (address) {
        set.shippingAddress = {
          addressLine: address.addressLine,
          city: address.city,
          state: address.state || '',
          pincode: address.pincode,
          country: address.country || 'India',
        };
      }
    }

    // Financial + status defaults
    if (o.subtotal === undefined) set.subtotal = o.totalPrice || 0;
    if (!o.orderStatus) set.orderStatus = 'placed';
    if (!o.paymentStatus) set.paymentStatus = 'pending';
    if (!o.paymentMethod) set.paymentMethod = 'cod';
    if (!o.orderNumber) {
      const date = o.createdAt ? new Date(o.createdAt) : new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      set.orderNumber = `ORD-${year}${month}-${random}`;
    }

    if (Object.keys(set).length) {
      await raw.updateOne({ _id: o._id }, { $set: set });
      migrated++;
    }
  }
  log(`${migrated} of ${legacyOrders.length} orders migrated`);
}

async function run() {
  try {
    await connectDB();
    console.log('\n🔄 Starting data migration to schema v2.0.0...');

    await migrateUsers();
    await migrateAddresses();
    await migrateProducts();
    await migrateFeedback();
    await migrateOrders();

    console.log('\n✅ Migration complete!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  }
}

run();
