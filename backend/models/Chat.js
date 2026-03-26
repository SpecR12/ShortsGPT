const mongoose = require('mongoose');

module.exports = mongoose.model('Chat', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  prompt: { type: String },
  scenariiGenerate: { type: Object },
  scenariuAles: { type: Object },
  istoricInterviu: { type: Array, default: [] },
  videoFinalUrl: { type: String },
  formatVideo: { type: String },
  videoPrincipalUrl: { type: String },
  status: { type: String, enum: ['generat_scenarii', 'in_interviu', 'randare', 'finalizat'], default: 'generat_scenarii' }
}, { timestamps: true }));
