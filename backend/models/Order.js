const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: String,
  name:      String,
  price:     Number,
  qty:       Number,
  img:       String
}, { _id: false });

const orderSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name:          { type: String, required: true, trim: true },
  email:         { type: String, required: true, trim: true, lowercase: true },
  phone:         { type: String, trim: true, default: '' },
  address:       { type: String, required: true, trim: true },
  city:          { type: String, trim: true, default: '' },
  pincode:       { type: String, trim: true, default: '' },
  items:         { type: [orderItemSchema], required: true },
  total:         { type: Number, required: true, min: 0 },
  paymentMethod: {
    type: String,
    enum: ['cod', 'card', 'upi', 'netbanking'],
    default: 'card'
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  trackingId:  { type: String, default: '' },
  notes:       { type: String, default: '' }
}, { timestamps: true });

// Index for quick user order lookup
orderSchema.index({ email: 1, createdAt: -1 });
orderSchema.index({ status: 1 });

module.exports = mongoose.model('Order', orderSchema);