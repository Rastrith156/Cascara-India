const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Security Middleware
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
// CORS — only allow trusted origins
const allowedOrigins = [
  'http://34.93.215.10',
  'http://34.93.215.10:80',
  'http://34.93.215.10:3000',
  'http://localhost',
  'http://localhost:80',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:5501',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow no-origin requests (curl, Postman) and file:// protocol
    if (!origin || origin === 'null') return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow any localhost / 127.0.0.1 port in development
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin '${origin}' is not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Remove fingerprinting header
app.disable('x-powered-by');

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   API Rate Limiter (global)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const { apiLimiter } = require('./middleware/rateLimiter');
app.use('/api', apiLimiter);

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Routes
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
app.use('/api/auth',     require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/reviews',  require('./routes/reviewRoutes'));
app.use('/api/cart',     require('./routes/cartRoutes'));
app.use('/api/orders',   require('./routes/orderRoutes'));

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Health Check Endpoint
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
app.get('/health', (req, res) => {
  res.json({
    status:   'ok',
    service:  'Cascara India API',
    version:  '2.0.0',
    mongo:    mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    time:     new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({ message: '🌿 Cascara India API v2.0 — Running' });
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   404 Handler
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found.` });
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Global Error Handler
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error.'
  });
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MongoDB Connection
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000
})
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
  });

mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
mongoose.connection.on('reconnected',  () => console.log('✅ MongoDB reconnected'));

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Start Server
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Cascara India API running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    mongoose.connection.close(false, () => process.exit(0));
  });
});

module.exports = app;