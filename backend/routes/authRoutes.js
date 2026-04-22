const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const otpGenerator = require('otp-generator');
const User   = require('../models/user');
const { authLimiter } = require('../middleware/rateLimiter');

/* ─── Email Transporter ─── */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

/* ─── Helpers ─── */
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sanitize   = (str) => String(str || '').trim().slice(0, 200);

function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

/* ════════════════════════════════════════
   POST /api/auth/signup
   ════════════════════════════════════════ */
router.post('/signup', authLimiter, async (req, res) => {
  try {
    const name     = sanitize(req.body.name);
    const email    = sanitize(req.body.email).toLowerCase();
    const password = sanitize(req.body.password);

    // Validation
    if (!name || name.length < 2)
      return res.status(400).json({ message: 'Name must be at least 2 characters.' });
    if (!emailRegex.test(email))
      return res.status(400).json({ message: 'Invalid email address.' });
    if (password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });

    const existing = await User.findOne({ email });
    if (existing && existing.verified)
      return res.status(409).json({ message: 'An account with this email already exists.' });

    const hash = await bcrypt.hash(password, 12);
    const otp  = otpGenerator.generate(6, {
      upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false
    });
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    if (existing && !existing.verified) {
      // Resend OTP to unverified existing user
      existing.password  = hash;
      existing.name      = name;
      existing.otp       = otp;
      existing.otpExpires = otpExpires;
      await existing.save();
    } else {
      await User.create({ name, email, password: hash, otp, otpExpires });
    }

    await transporter.sendMail({
      from: `"Cascara India" <${process.env.EMAIL_USER}>`,
      to:   email,
      subject: '🌿 Your Cascara India OTP Code',
      html: `
        <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;background:#FAF6F0;padding:40px;border-radius:16px;">
          <h2 style="color:#B5552B;font-family:Georgia,serif;">Welcome to Cascara India!</h2>
          <p style="color:#3D2614;">Hi ${name}, use the code below to verify your account:</p>
          <div style="background:#1A100A;color:#FAF6F0;font-size:2.5rem;font-weight:700;letter-spacing:12px;text-align:center;padding:24px;border-radius:12px;margin:24px 0;">${otp}</div>
          <p style="color:#9B7B63;font-size:0.85rem;">This code expires in 10 minutes. If you didn't request this, please ignore this email.</p>
          <p style="color:#B5552B;margin-top:24px;">☕ The Cascara India Team</p>
        </div>`
    });

    res.json({ message: 'OTP sent to your email. Please verify your account.' });
  } catch (err) {
    console.error('[signup]', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

/* ════════════════════════════════════════
   POST /api/auth/verify-otp
   ════════════════════════════════════════ */
router.post('/verify-otp', authLimiter, async (req, res) => {
  try {
    const email = sanitize(req.body.email).toLowerCase();
    const otp   = sanitize(req.body.otp);

    if (!email || !otp)
      return res.status(400).json({ message: 'Email and OTP are required.' });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: 'Account not found.' });

    if (user.otp !== otp)
      return res.status(400).json({ message: 'Incorrect OTP. Please try again.' });

    if (user.otpExpires && user.otpExpires < new Date())
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });

    user.verified   = true;
    user.otp        = '';
    user.otpExpires = null;
    await user.save();

    const token = generateToken(user._id);
    res.json({
      message: 'Account verified successfully! Welcome to Cascara India.',
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('[verify-otp]', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

/* ════════════════════════════════════════
   POST /api/auth/login
   ════════════════════════════════════════ */
router.post('/login', authLimiter, async (req, res) => {
  try {
    const email    = sanitize(req.body.email).toLowerCase();
    const password = sanitize(req.body.password);

    if (!emailRegex.test(email) || !password)
      return res.status(400).json({ message: 'Invalid credentials.' });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: 'No account found with this email.' });

    if (!user.verified)
      return res.status(403).json({ message: 'Please verify your email before logging in.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ message: 'Incorrect password.' });

    const token = generateToken(user._id);
    res.json({
      message: 'Login successful!',
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

/* ════════════════════════════════════════
   POST /api/auth/forgot-password
   ════════════════════════════════════════ */
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const email = sanitize(req.body.email).toLowerCase();
    if (!emailRegex.test(email))
      return res.status(400).json({ message: 'Please enter a valid email address.' });

    const user = await User.findOne({ email, verified: true });
    // Always return success to prevent email enumeration
    if (!user)
      return res.json({ message: 'If an account exists, a reset OTP has been sent.' });

    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false
    });
    user.otp        = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await transporter.sendMail({
      from: `"Cascara India" <${process.env.EMAIL_USER}>`,
      to:   email,
      subject: '🔑 Cascara India Password Reset OTP',
      html: `
        <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;background:#FAF6F0;padding:40px;border-radius:16px;">
          <h2 style="color:#B5552B;font-family:Georgia,serif;">Password Reset</h2>
          <p style="color:#3D2614;">Use the code below to reset your password:</p>
          <div style="background:#1A100A;color:#FAF6F0;font-size:2.5rem;font-weight:700;letter-spacing:12px;text-align:center;padding:24px;border-radius:12px;margin:24px 0;">${otp}</div>
          <p style="color:#9B7B63;font-size:0.85rem;">This code expires in 10 minutes.</p>
        </div>`
    });

    res.json({ message: 'If an account exists, a reset OTP has been sent.' });
  } catch (err) {
    console.error('[forgot-password]', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

/* ════════════════════════════════════════
   POST /api/auth/reset-password
   ════════════════════════════════════════ */
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const email       = sanitize(req.body.email).toLowerCase();
    const otp         = sanitize(req.body.otp);
    const newPassword = sanitize(req.body.newPassword);

    if (newPassword.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });

    const user = await User.findOne({ email });
    if (!user || user.otp !== otp)
      return res.status(400).json({ message: 'Invalid or expired OTP.' });

    if (user.otpExpires && user.otpExpires < new Date())
      return res.status(400).json({ message: 'OTP expired. Please request a new one.' });

    user.password   = await bcrypt.hash(newPassword, 12);
    user.otp        = '';
    user.otpExpires = null;
    await user.save();

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('[reset-password]', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

module.exports = router;
