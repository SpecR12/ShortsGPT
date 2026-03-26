const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');
const path = require('path');

const authRoutes = require('./routes/auth.routes');
const chatRoutes = require('./routes/chat.routes');
const paymentRoutes = require('./routes/payment.routes');

const app = express();
app.use(cors());

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server ShortsGPT pornit pe portul ${PORT}`);
    });
  })
  .catch((eroare) => {
    console.error("❌ Eșec critic! Nu am putut porni serverul pentru că baza de date nu răspunde:");
    console.error(eroare);
    process.exit(1);
  });


app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server ShortsGPT pornit pe portul ${PORT}`));
