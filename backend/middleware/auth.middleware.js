const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  if (req.headers.authorization?.startsWith('Bearer')) {
    try {
      const decoded = jwt.verify(req.headers.authorization.split(' ')[1], process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      if (['none', 'canceled'].includes(req.user.subscriptionStatus)) {
        return res.status(403).json({ error: "Abonament inactiv! Verifică plata." });
      }
      return next();
    } catch (error) { return res.status(401).json({ error: "Token invalid!" }); }
  }
  res.status(401).json({ error: "Neautorizat!" });
};
