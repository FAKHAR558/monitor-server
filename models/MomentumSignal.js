// models/MomentumSignal.js
const mongoose = require('mongoose');

const Decimal128 = mongoose.Schema.Types.Decimal128;

const LevelSchema = new mongoose.Schema({
  high: Decimal128,
  low: Decimal128,
  breakoutDirection: { type: String, enum: ['up', 'down', null], default: null },
  retestConfirmed: { type: Boolean, default: false },
  trackingStarted: { type: Boolean, default: false },
  priceAction: { type: String, enum: ['strong', 'weak', 'neutral', null], default: null },
  invalidated: { type: Boolean, default: false },
  consolidated: { type: Boolean, default: false },
  tradeConfirmed: { type: Boolean, default: false },
  tradeConfirmedAt: { type: Date },
  retestCandle: {
    open: Decimal128,
    close: Decimal128,
    high: Decimal128,
    low: Decimal128
  },
  tradeConfirmation: {
    type: String,
    enum: ['confirmed', 'failed', null],
    default: null
  },
  recentCandles: [
    {
      open: Decimal128,
      close: Decimal128,
      high: Decimal128,
      low: Decimal128,
      _id: false // ✅ prevent automatic _id creation for subdocs
    }
  ]
}, { _id: false });

const MomentumSignalSchema = new mongoose.Schema({
  symbol: { type: String, required: true, unique: true },
  prevDay: LevelSchema,
  marketSession: LevelSchema,
  opening15m: LevelSchema,
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MomentumSignal', MomentumSignalSchema);
