const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const stripe = require('../config/stripe');

exports.register = async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const customer = await stripe.customers.create({ email });
    const user = await User.create({ email, password: hashed, stripeCustomerId: customer.id });
    res.json({ success: true, user });
  } catch (e) { res.status(400).json({ error: e.message }); }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "Date incorecte!" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, status: user.subscriptionStatus });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
