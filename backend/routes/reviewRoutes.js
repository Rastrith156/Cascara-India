const router = require('express').Router();
const Review = require('../models/Review');
const authMiddleware = require('../middleware/auth');

const sanitize = (str, max = 200) => String(str || '').trim().slice(0, max);

/* ─── GET /api/reviews — All reviews (paginated) ─── */
router.get('/', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      Review.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Review.countDocuments()
    ]);

    res.json({ reviews, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('[GET /reviews]', err);
    res.status(500).json({ message: 'Could not load reviews.' });
  }
});

/* ─── POST /api/reviews — Submit a review ─── */
router.post('/', async (req, res) => {
  try {
    const name    = sanitize(req.body.name, 80);
    const email   = sanitize(req.body.email, 100).toLowerCase();
    const rating  = parseInt(req.body.rating);
    const product = req.body.product;
    const text    = sanitize(req.body.text, 1000);

    // Validation
    if (!name || name.length < 2)
      return res.status(400).json({ message: 'Name must be at least 2 characters.' });
    if (!text || text.length < 10)
      return res.status(400).json({ message: 'Review must be at least 10 characters.' });
    if (!rating || rating < 1 || rating > 5)
      return res.status(400).json({ message: 'Rating must be between 1 and 5.' });

    const validProducts = ['Sachet Box', '50g Pack', '5g Sachet'];
    const safeProduct = validProducts.includes(product) ? product : 'Sachet Box';

    const review = await Review.create({ name, email, rating, product: safeProduct, text });
    res.status(201).json({ message: 'Review submitted successfully!', review });
  } catch (err) {
    console.error('[POST /reviews]', err);
    res.status(500).json({ message: 'Could not save review.' });
  }
});

/* ─── PUT /api/reviews/:id/helpful — Mark review as helpful ─── */
router.put('/:id/helpful', async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { $inc: { helpful: 1 } },
      { new: true }
    );
    if (!review) return res.status(404).json({ message: 'Review not found.' });
    res.json({ helpful: review.helpful });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
