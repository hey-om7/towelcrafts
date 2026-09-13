const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const mongoSanitize = require('./middleware/sanitize');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// Load env vars
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// ─────────────────────────────────────────────
// Fail-fast environment validation
// ─────────────────────────────────────────────
function validateEnv() {
  const problems = [];

  if (!process.env.MONGO_URI) {
    problems.push('MONGO_URI is not set (falling back to localhost in dev only)');
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    problems.push('JWT_SECRET must be set to a strong secret (>= 32 characters)');
  }

  if (isProduction) {
    if (!process.env.CORS_ORIGIN) {
      problems.push('CORS_ORIGIN must be set in production');
    }
    // In production, missing/weak secrets are fatal.
    const fatal = problems.filter(
      (p) => p.includes('JWT_SECRET') || p.includes('MONGO_URI') || p.includes('CORS_ORIGIN')
    );
    if (fatal.length) {
      console.error('\n❌ FATAL: Invalid production configuration:');
      fatal.forEach((p) => console.error(`   - ${p}`));
      process.exit(1);
    }
  } else if (problems.length) {
    console.warn('\n⚠️  Configuration warnings (development):');
    problems.forEach((p) => console.warn(`   - ${p}`));
    console.warn('');
  }
}

validateEnv();

// Connect to database
connectDB();

const app = express();

// Trust proxy (needed for correct client IPs behind load balancers / rate limiting)
app.set('trust proxy', 1);

// ─────────────────────────────────────────────
// Security middleware
// ─────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS — locked down in production, permissive in development
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: isProduction
    ? function (origin, callback) {
        // Allow same-origin/non-browser requests (no origin) and whitelisted origins
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      }
    : true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitize against NoSQL injection (Express 5-safe)
app.use(mongoSanitize);

// Prevent HTTP parameter pollution
app.use(hpp());

// Compression
app.use(compression());

// Logging (dev only)
if (!isProduction) {
  app.use(morgan('dev'));
}

// ─────────────────────────────────────────────
// Rate limiting
// ─────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/users/login', authLimiter);
app.use('/api/users/google', authLimiter);

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/feedbacks', require('./routes/feedbackRoutes'));
app.use('/api/stats', require('./routes/statsRoutes'));
app.use('/api/uploads', require('./routes/uploadRoutes'));

// Health checks
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'TowelCrafts API',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Error handling (must be last)
app.use(notFound);
app.use(errorHandler);

// ─────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 5001;

const server = app.listen(PORT, () => {
  console.log(`\n🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
});

// Graceful shutdown on unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});

module.exports = app;
