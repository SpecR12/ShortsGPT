const stripe = require('../config/stripe');
const User = require('../models/User');

exports.createCheckoutSession = async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      customer: req.user.stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [{ price: 'ID_PRET_STRIPE', quantity: 1 }],
      mode: 'subscription',
      subscription_data: { trial_period_days: 7 },
      success_url: 'http://localhost:4200/app?success=true',
      cancel_url: 'http://localhost:4200/app?canceled=true',
    });
    res.json({ url: session.url });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.webhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      await User.findOneAndUpdate({ stripeCustomerId: event.data.object.customer }, { subscriptionStatus: event.data.object.status === 'trialing' ? 'trialing' : 'active' });
    } else if (event.type === 'customer.subscription.deleted') {
      await User.findOneAndUpdate({ stripeCustomerId: event.data.object.customer }, { subscriptionStatus: 'canceled' });
    }
    res.json({ received: true });
  } catch (err) { res.status(400).send(`Webhook Error: ${err.message}`); }
};
