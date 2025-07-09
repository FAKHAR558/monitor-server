// models/MomentumSignal.js
const mongoose = require('mongoose');

const LevelSchema = new mongoose.Schema({
  high: Number,
  low: Number,
  breakoutDirection: { type: String, enum: ['up', 'down', null], default: null },
  retestConfirmed: { type: Boolean, default: false },
  trackingStarted: { type: Boolean, default: false },
  priceAction: { type: String, enum: ['strong', 'weak', 'neutral', null], default: null }
}, { _id: false });

const MomentumSignalSchema = new mongoose.Schema({
  symbol: { type: String, required: true, unique: true },
  prevDay: LevelSchema,
  marketSession: LevelSchema,
  opening15m: LevelSchema,
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MomentumSignal', MomentumSignalSchema);
