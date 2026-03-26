const express = require('express');
const router = express.Router();
const { startProiect, chatInterviu, getVociDisponibile, getIstoricProiecte, stergeChat, initSplitScreen, proceseazaSplitScreen} = require('../controllers/chat.controller');
const { protect } = require('../middleware/auth.middleware');
const { upload } = require('../middleware/upload.middleware');
const Chat = require('../models/Chat');

router.use(protect);
router.get('/voices', getVociDisponibile);
router.post('/start', upload.single('mediaFile'), startProiect);

router.post('/split-screen/init', initSplitScreen);
router.post('/split-screen/:id', upload.single('mediaFile'), proceseazaSplitScreen);

router.get('/istoric', getIstoricProiecte);
router.post('/:id/mesaj', chatInterviu);
router.get('/:id', async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat negăsit' });

    res.json(chat);
  } catch (error) {
    console.error("EROARE LA GET CHAT:", error);
    res.status(500).json({ error: 'Eroare la citirea din DB' });
  }
});
router.delete('/:id', stergeChat);

module.exports = router;
