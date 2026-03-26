const mongoose = require('mongoose');

module.exports = mongoose.model('User', new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  stripeCustomerId: String,
  subscriptionStatus: { type: String, enum: ['trialing', 'active', 'canceled', 'none'], default: 'active' } //default: 'none'
}, { timestamps: true }));
