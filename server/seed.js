const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const connectDB = require('./config/db');
const Product = require('./models/Product');
const User = require('./models/User');
const Order = require('./models/Order');
const Address = require('./models/Address');
const Feedback = require('./models/Feedback');
const Category = require('./models/Category');

// Load env vars
dotenv.config();

connectDB();

// If images have been migrated to R2 (via migrateImagesToR2.js), a manifest
// maps each local /public path to its R2 public URL. When present, seed data
// is rewritten to use those URLs so a re-seed stays consistent with the bucket.
// Without the manifest, the original /public paths are kept (still valid via
// the frontend imageUrl() helper).
const R2_MAP = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(__dirname, 'r2-migration-map.json'), 'utf8'));
  } catch {
    return {};
  }
})();

const img = (p) => R2_MAP[p] || p;

const categories = [
  {
    _id: 1,
    title: 'Bath Robes',
    subtitle: 'Wrap & Unwind',
    image: img('/category_cotton_1770900530532.png'),
    description: 'Plush, absorbent bath robes that turn every morning into a spa ritual.',
    displayOrder: 1,
  },
  {
    _id: 2,
    title: 'Hair Towels',
    subtitle: 'Gentle Drying',
    image: img('/category_filament_1770900548571.png'),
    description: 'Ultra-absorbent, frizz-free hair towels and wraps for healthier hair.',
    displayOrder: 2,
  },
  {
    _id: 3,
    title: 'Bath Towels',
    subtitle: 'Everyday Luxury',
    image: img('/category_mixed_1770900596346.png'),
    description: 'Soft, quick-drying bath towels crafted for daily indulgence.',
    displayOrder: 3,
  },
  {
    _id: 4,
    title: 'Adult Towels',
    subtitle: 'Premium & Durable',
    image: img('/category_carbon_1770900631300.png'),
    description: 'Generously sized premium towels built for lasting comfort and durability.',
    displayOrder: 4,
  },
  {
    _id: 5,
    title: 'Kids & Infant Care',
    subtitle: 'Soft & Safe',
    image: img('/emerald_cotton_towel_1770901516592.png'),
    description: 'Hypoallergenic, chemical-free towels designed for delicate young skin.',
    displayOrder: 5,
  },
];

const products = [
  // ─────────── Bath Robes (Category 1) ───────────
  {
    _id: 101,
    categoryId: 1,
    title: 'Classic Cotton Bath Robe',
    price: 2499,
    originalPrice: 2999,
    description:
      'A plush, full-length bath robe crafted from premium 100% cotton terry. Wrap yourself in spa-like comfort with its generous cut, shawl collar, and deep pockets.',
    shortDescription: 'Plush full-length cotton terry robe',
    image: img('/ruby_cotton_towel_1770901499695.png'),
    category: 'Bath Robes',
    material: '100% Egyptian Cotton Terry',
    weight: '450 GSM',
    dimensions: 'One Size (fits M–XL)',
    color: 'Ruby',
    featured: true,
    stockQuantity: 40,
    tags: ['bath robe', 'cotton', 'plush', 'unisex'],
  },
  {
    _id: 102,
    categoryId: 1,
    title: 'Waffle Weave Robe',
    price: 2199,
    originalPrice: 2699,
    description:
      'A lightweight waffle-weave robe that is breathable yet absorbent — perfect for warm climates and quick post-shower comfort.',
    shortDescription: 'Lightweight, breathable waffle-weave robe',
    image: img('/emerald_cotton_towel_1770901516592.png'),
    category: 'Bath Robes',
    material: 'Cotton-Modal Waffle Weave',
    weight: '350 GSM',
    dimensions: 'One Size (fits S–L)',
    color: 'Emerald',
    featured: true,
    stockQuantity: 45,
    tags: ['bath robe', 'waffle', 'lightweight'],
  },
  {
    _id: 103,
    categoryId: 1,
    title: 'Luxury Hooded Robe',
    price: 2999,
    originalPrice: 3599,
    description:
      'Our flagship hooded bath robe in ultra-soft double-loop cotton. Indulgent warmth, superior absorbency, and hotel-grade luxury for your home.',
    shortDescription: 'Ultra-soft hooded double-loop cotton robe',
    image: img('/category_cotton_1770900530532.png'),
    category: 'Bath Robes',
    material: '100% Pima Cotton',
    weight: '500 GSM',
    dimensions: 'One Size (fits M–XXL)',
    color: 'Royal White',
    featured: false,
    stockQuantity: 30,
    tags: ['bath robe', 'hooded', 'luxury', 'premium'],
  },

  // ─────────── Hair Towels (Category 2) ───────────
  {
    _id: 201,
    categoryId: 2,
    title: 'Quick-Dry Hair Wrap',
    price: 899,
    originalPrice: 1199,
    description:
      'An ultra-absorbent microfiber hair wrap with a button-loop fastening. Dries hair faster, reduces frizz, and is gentle on delicate strands.',
    shortDescription: 'Frizz-free microfiber hair wrap',
    image: img('/azure_filament_towel_1772994066528.png'),
    category: 'Hair Towels',
    material: 'Microfiber',
    weight: '300 GSM',
    dimensions: '65 x 25 cm',
    color: 'Azure',
    featured: true,
    stockQuantity: 90,
    tags: ['hair towel', 'quick-dry', 'anti-frizz'],
  },
  {
    _id: 202,
    categoryId: 2,
    title: 'Soft Turban Hair Towel',
    price: 799,
    originalPrice: 999,
    description:
      'A soft, lightweight turban-style hair towel that stays securely in place. Perfect for everyday drying and pampering routines.',
    shortDescription: 'Secure, lightweight turban hair towel',
    image: img('/powder_filament_towel_1772994082480.png'),
    category: 'Hair Towels',
    material: 'Bamboo-Cotton Blend',
    weight: '280 GSM',
    dimensions: '68 x 26 cm',
    color: 'Powder Blue',
    featured: false,
    stockQuantity: 100,
    tags: ['hair towel', 'turban', 'everyday'],
  },
  {
    _id: 203,
    categoryId: 2,
    title: 'Premium Curls Hair Towel',
    price: 999,
    originalPrice: 1299,
    description:
      'Specially designed for curly and textured hair, this ultra-plush hair towel preserves curl definition while gently absorbing moisture.',
    shortDescription: 'Plush towel for curly & textured hair',
    image: img('/sky_filament_towel_1772994099377.png'),
    category: 'Hair Towels',
    material: 'Premium Microfiber',
    weight: '320 GSM',
    dimensions: '70 x 28 cm',
    color: 'Sky Blue',
    featured: true,
    stockQuantity: 65,
    tags: ['hair towel', 'curls', 'premium'],
  },

  // ─────────── Bath Towels (Category 3) ───────────
  {
    _id: 301,
    categoryId: 3,
    title: 'Textured Bath Towel',
    price: 999,
    originalPrice: 1399,
    description:
      'A soft, quick-drying bath towel with a subtle texture. The cotton-bamboo blend offers the perfect balance of plushness and durability.',
    shortDescription: 'Soft quick-drying everyday bath towel',
    image: img('/texture_blend_towel_1772993685886.png'),
    category: 'Bath Towels',
    material: 'Cotton-Bamboo Blend',
    weight: '450 GSM',
    dimensions: '140 x 70 cm',
    color: 'Natural Beige',
    featured: false,
    stockQuantity: 80,
    tags: ['bath towel', 'textured', 'eco-friendly'],
  },
  {
    _id: 302,
    categoryId: 3,
    title: 'Waffle Bath Towel',
    price: 899,
    originalPrice: 1199,
    description:
      'A luxurious bath towel with a distinctive waffle pattern that enhances drying and adds a designer touch to your bathroom.',
    shortDescription: 'Designer waffle-pattern bath towel',
    image: img('/waffle_weave_towel_1772993702203.png'),
    category: 'Bath Towels',
    material: 'Cotton-Modal Blend',
    weight: '420 GSM',
    dimensions: '135 x 68 cm',
    color: 'Ivory',
    featured: false,
    stockQuantity: 85,
    tags: ['bath towel', 'waffle', 'quick-dry'],
  },
  {
    _id: 303,
    categoryId: 3,
    title: 'Herringbone Bath Towel',
    price: 1499,
    originalPrice: 1899,
    description:
      'A premium bath towel with a classic herringbone weave. Supremely soft, highly absorbent, and a statement piece in any bathroom.',
    shortDescription: 'Classic herringbone statement towel',
    image: img('/herringbone_towel_1772993722425.png'),
    category: 'Bath Towels',
    material: 'Cotton-Tencel Blend',
    weight: '500 GSM',
    dimensions: '140 x 70 cm',
    color: 'Charcoal Grey',
    featured: true,
    stockQuantity: 50,
    tags: ['bath towel', 'herringbone', 'designer'],
  },

  // ─────────── Adult Towels (Category 4) ───────────
  {
    _id: 401,
    categoryId: 4,
    title: 'Grand Adult Towel',
    price: 1899,
    originalPrice: 2399,
    description:
      'A generously sized adult bath towel infused with activated carbon for natural antibacterial protection and lasting freshness.',
    shortDescription: 'Oversized carbon-infused adult towel',
    image: img('/millionaire_towel_1772993750517.png'),
    category: 'Adult Towels',
    material: 'Carbon-Infused Cotton',
    weight: '550 GSM',
    dimensions: '150 x 80 cm',
    color: 'Obsidian Black',
    featured: false,
    stockQuantity: 40,
    tags: ['adult towel', 'oversized', 'antibacterial'],
  },
  {
    _id: 402,
    categoryId: 4,
    title: 'Executive Adult Towel',
    price: 1999,
    originalPrice: 2599,
    description:
      'A luxurious full-size adult towel with odor-resistant carbon fiber technology and enhanced durability for years of use.',
    shortDescription: 'Odor-resistant premium adult towel',
    image: img('/billionaire_towel_1772993769293.png'),
    category: 'Adult Towels',
    material: 'Activated Carbon Cotton',
    weight: '600 GSM',
    dimensions: '150 x 80 cm',
    color: 'Graphite',
    featured: true,
    stockQuantity: 35,
    tags: ['adult towel', 'premium', 'odor-resistant'],
  },
  {
    _id: 403,
    categoryId: 4,
    title: 'Signature Adult Towel',
    price: 2999,
    originalPrice: 3999,
    description:
      'Our flagship adult towel featuring the most advanced nano-carbon cotton — ultra-plush, ultra-absorbent, and built to last a lifetime.',
    shortDescription: 'Flagship ultra-plush adult towel',
    image: img('/trillionaire_towel_1772993789927.png'),
    category: 'Adult Towels',
    material: 'Nano Carbon Premium Cotton',
    weight: '700 GSM',
    dimensions: '160 x 85 cm',
    color: 'Deep Black',
    featured: true,
    stockQuantity: 20,
    tags: ['adult towel', 'flagship', 'ultra-premium'],
  },

  // ─────────── Kids & Infant Care (Category 5) ───────────
  {
    _id: 501,
    categoryId: 5,
    title: 'Infant Hooded Towel',
    price: 699,
    originalPrice: 999,
    description:
      'An adorable hooded towel for babies made from hypoallergenic, chemical-free organic cotton. Extra gentle on delicate newborn skin.',
    shortDescription: 'Hypoallergenic hooded baby towel',
    image: img('/emerald_cotton_towel_1770901516592.png'),
    category: 'Kids & Infant Care',
    material: 'Organic Cotton (Chemical-Free)',
    weight: '350 GSM',
    dimensions: '90 x 90 cm',
    color: 'Soft Green',
    featured: true,
    stockQuantity: 70,
    tags: ['infant', 'hooded', 'organic', 'hypoallergenic'],
  },
  {
    _id: 502,
    categoryId: 5,
    title: 'Kids Fun Bath Towel',
    price: 799,
    originalPrice: 1099,
    description:
      'A soft, colorful bath towel sized just right for children. Skin-safe dyes and gentle fibers make bath time fun and comfortable.',
    shortDescription: 'Colorful skin-safe towel for kids',
    image: img('/ruby_cotton_towel_1770901499695.png'),
    category: 'Kids & Infant Care',
    material: 'Organic Cotton',
    weight: '380 GSM',
    dimensions: '110 x 60 cm',
    color: 'Ruby',
    featured: false,
    stockQuantity: 80,
    tags: ['kids', 'colorful', 'organic'],
  },
  {
    _id: 503,
    categoryId: 5,
    title: 'Baby Washcloth Set',
    price: 599,
    originalPrice: 899,
    description:
      'A set of ultra-soft baby washcloths, perfect for gentle cleansing. Made from breathable organic cotton that is kind to sensitive skin.',
    shortDescription: 'Set of ultra-soft organic washcloths',
    image: img('/sky_filament_towel_1772994099377.png'),
    category: 'Kids & Infant Care',
    material: 'Organic Cotton Muslin',
    weight: '250 GSM',
    dimensions: '30 x 30 cm (pack of 5)',
    color: 'Sky Blue',
    featured: true,
    stockQuantity: 100,
    tags: ['infant', 'washcloth', 'set', 'organic'],
  },
];

const importData = async () => {
  try {
    // Clear existing data
    await Order.deleteMany();
    await Feedback.deleteMany();
    await Address.deleteMany();
    await User.deleteMany();
    try {
      await Product.collection.drop();
    } catch (e) {
      // Collection may not exist
    }
    try {
      await Category.collection.drop();
    } catch (e) {
      // Collection may not exist
    }

    // Create admin user
    const adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: '123devpassword',
      roles: ['user', 'admin'],
      phone: '9876543210',
    });

    // Create sample customer
    const customer = await User.create({
      name: 'Jai Kumar',
      email: 'jai@example.com',
      password: 'customer123',
      roles: ['user'],
      phone: '9876543211',
    });

    // Create sample address
    await Address.create({
      user: customer._id,
      label: 'home',
      fullName: 'Jai Kumar',
      phone: '9876543211',
      addressLine: '123 Main Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      country: 'India',
      isDefault: true,
    });

    // Insert products
    await Product.insertMany(products);

    // Insert categories (use create to trigger slug generation)
    await Category.create(categories);

    console.log('\n✅ Data Imported Successfully!');
    console.log(`   📦 ${products.length} products created`);
    console.log(`   🗂️  ${categories.length} categories created`);
    console.log(`   👤 Admin: admin@example.com / 123devpassword`);
    console.log(`   👤 Customer: jai@example.com / customer123\n`);
    process.exit();
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    await Order.deleteMany();
    await Feedback.deleteMany();
    await Address.deleteMany();
    await User.deleteMany();
    try {
      await Product.collection.drop();
    } catch (e) {
      // Collection may not exist
    }
    try {
      await Category.collection.drop();
    } catch (e) {
      // Collection may not exist
    }

    console.log('\n🗑️  Data Destroyed!\n');
    process.exit();
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
};

if (process.argv[2] === '-d') {
  destroyData();
} else {
  importData();
}
