const router = require('express').Router();
const Cart   = require('../models/Cart');
const authMiddleware = require('../middleware/auth');

/* All cart routes require authentication */
router.use(authMiddleware);

/* ─── GET /api/cart — Get user's cart ─── */
router.get('/', async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id }) || { items: [], total: 0 };
    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: 'Could not load cart.' });
  }
});

/* ─── POST /api/cart/add — Add/update item in cart ─── */
router.post('/add', async (req, res) => {
  try {
    const { productId, name, price, qty = 1, img } = req.body;
    if (!productId || !name || typeof price !== 'number')
      return res.status(400).json({ message: 'productId, name and price are required.' });

    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      cart = new Cart({ userId: req.user.id, items: [] });
    }

    const idx = cart.items.findIndex(i => i.productId === productId);
    if (idx >= 0) {
      cart.items[idx].qty += qty;
    } else {
      cart.items.push({ productId, name, price, qty, img: img || '' });
    }

    cart.markModified('items');
    await cart.save();
    res.json({ message: 'Cart updated.', cart });
  } catch (err) {
    console.error('[POST /cart/add]', err);
    res.status(500).json({ message: 'Could not update cart.' });
  }
});

/* ─── PUT /api/cart/item/:productId — Update quantity ─── */
router.put('/item/:productId', async (req, res) => {
  try {
    const { qty } = req.body;
    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) return res.status(404).json({ message: 'Cart not found.' });

    const idx = cart.items.findIndex(i => i.productId === req.params.productId);
    if (idx === -1) return res.status(404).json({ message: 'Item not in cart.' });

    if (qty <= 0) {
      cart.items.splice(idx, 1);
    } else {
      cart.items[idx].qty = qty;
    }
    cart.markModified('items');
    await cart.save();
    res.json({ message: 'Cart updated.', cart });
  } catch (err) {
    res.status(500).json({ message: 'Could not update cart.' });
  }
});

/* ─── DELETE /api/cart/item/:productId — Remove item ─── */
router.delete('/item/:productId', async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) return res.status(404).json({ message: 'Cart not found.' });

    cart.items = cart.items.filter(i => i.productId !== req.params.productId);
    cart.markModified('items');
    await cart.save();
    res.json({ message: 'Item removed.', cart });
  } catch (err) {
    res.status(500).json({ message: 'Could not remove item.' });
  }
});

/* ─── DELETE /api/cart — Clear cart ─── */
router.delete('/', async (req, res) => {
  try {
    await Cart.findOneAndUpdate({ userId: req.user.id }, { items: [] });
    res.json({ message: 'Cart cleared.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not clear cart.' });
  }
});

module.exports = router;
