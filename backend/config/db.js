const mongoose = require('mongoose');

module.exports = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB conectat!');
  } catch (e) { console.error('❌ Eroare MongoDB:', e.message); process.exit(1); }
};
