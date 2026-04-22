const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true, maxlength: 80 },
  email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:   { type: String, required: true },
  otp:        { type: String, default: '' },
  otpExpires: { type: Date, default: null },
  verified:   { type: Boolean, default: false },
  role:       { type: String, enum: ['user', 'admin'], default: 'user' },
  avatar:     { type: String, default: '' },
  phone:      { type: String, default: '' }
}, { timestamps: true });

// Never return password or OTP in API responses
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.otp;
  delete obj.otpExpires;
  return obj;
};

module.exports = mongoose.model('User', userSchema);