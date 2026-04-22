const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  name:      { type: String, required: true },
  price:     { type: Number, required: true, min: 0 },
  qty:       { type: Number, required: true, min: 1, default: 1 },
  img:       { type: String, default: '' }
}, { _id: false });

const cartSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items:     { type: [cartItemSchema], default: [] },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Virtual: total price
cartSchema.virtual('total').get(function () {
  return this.items.reduce((sum, item) => sum + item.price * item.qty, 0);
});

module.exports = mongoose.model('Cart', cartSchema);
