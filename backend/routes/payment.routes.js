const express = require('express');
const router = express.Router();
const { createCheckoutSession, webhook } = require('../controllers/payment.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/create-checkout-session', protect, createCheckoutSession);
router.post('/webhook', webhook);
module.exports = router;
