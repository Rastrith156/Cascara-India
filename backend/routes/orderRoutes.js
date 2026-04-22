const router = require('express').Router();
const Order  = require('../models/Order');
const authMiddleware = require('../middleware/auth');

const sanitize = (str, max = 200) => String(str || '').trim().slice(0, max);

/* ─── POST /api/orders — Create a new order ─── */
router.post('/', async (req, res) => {
  try {
    const name    = sanitize(req.body.name, 120);
    const email   = sanitize(req.body.email, 150).toLowerCase();
    const phone   = sanitize(req.body.phone, 20);
    const address = sanitize(req.body.address, 300);
    const city    = sanitize(req.body.city, 100);
    const pincode = sanitize(req.body.pincode, 10);
    const items   = req.body.items;
    const total   = parseFloat(req.body.total);
    const paymentMethod = req.body.paymentMethod || 'card';

    // Validation
    if (!name || name.length < 2)
      return res.status(400).json({ message: 'Full name is required.' });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ message: 'Valid email is required.' });
    if (!address)
      return res.status(400).json({ message: 'Shipping address is required.' });
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: 'Order must contain at least one item.' });
    if (isNaN(total) || total <= 0)
      return res.status(400).json({ message: 'Invalid order total.' });

    const validPayments = ['cod', 'card', 'upi', 'netbanking'];
    const safePayment = validPayments.includes(paymentMethod) ? paymentMethod : 'card';

    // Sanitize items
    const safeItems = items.map(item => ({
      productId: sanitize(item.productId || item.id, 100),
      name:      sanitize(item.name, 200),
      price:     parseFloat(item.price) || 0,
      qty:       parseInt(item.qty)     || 1,
      img:       sanitize(item.img, 300)
    }));

    // Get userId from auth token if present
    let userId = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (_) { /* anonymous order allowed */ }
    }

    const order = await Order.create({
      userId, name, email, phone, address, city, pincode,
      items: safeItems, total, paymentMethod: safePayment
    });

    res.status(201).json({
      message: 'Order placed successfully! You will receive a confirmation email shortly.',
      orderId: order._id,
      order
    });
  } catch (err) {
    console.error('[POST /orders]', err);
    res.status(500).json({ message: 'Could not place order. Please try again.' });
  }
});

/* ─── GET /api/orders — Get all orders (admin use) ─── */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments()
    ]);
    res.json({ orders, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch orders.' });
  }
});

/* ─── GET /api/orders/my — Get orders for logged-in user ─── */
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id })
      .sort({ createdAt: -1 }).lean();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch your orders.' });
  }
});

/* ─── GET /api/orders/:id — Get single order ─── */
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch order.' });
  }
});

const authMiddlewareFn = require('../middleware/auth');
/* ─── PATCH /api/orders/:id/status — Update order status ─── */
router.patch('/:id/status', authMiddlewareFn, async (req, res) => {
  try {
    const validStatuses = ['pending','confirmed','processing','shipped','delivered','cancelled'];
    const { status } = req.body;
    if (!validStatuses.includes(status))
      return res.status(400).json({ message: 'Invalid status value.' });

    const order = await Order.findByIdAndUpdate(
      req.params.id, { status }, { new: true }
    );
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    res.json({ message: 'Status updated.', order });
  } catch (err) {
    res.status(500).json({ message: 'Could not update status.' });
  }
});

module.exports = router;