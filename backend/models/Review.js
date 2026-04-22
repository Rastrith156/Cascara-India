const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true, maxlength: 80 },
  email:    { type: String, trim: true, lowercase: true, default: '' },
  rating:   { type: Number, required: true, min: 1, max: 5 },
  product:  {
    type: String,
    enum: ['Sachet Box', '50g Pack', '5g Sachet'],
    default: 'Sachet Box'
  },
  text:     { type: String, required: true, trim: true, maxlength: 1000 },
  verified: { type: Boolean, default: false },
  helpful:  { type: Number, default: 0 }
}, { timestamps: true });

// Index for latest reviews first
reviewSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
