// logic/handleCandles.js
const MomentumSignal = require('../models/MomentumSignal');
const { getUTCDateString, getUTCHoursMinutes } = require('../utils/time');

async function handle15mCandle(candle, symbol) {
  const nowDate = getUTCDateString(candle.t);
  const { hours, minutes } = getUTCHoursMinutes(candle.t);
  const doc = await MomentumSignal.findOneAndUpdate(
    { symbol },
    { $setOnInsert: { symbol, updatedAt: new Date() } },
    { upsert: true, new: true }
  );

  // Reset at new day
  if (doc.updatedAt.toISOString().split('T')[0] !== nowDate) {
    console.log("We will Reset data here")
    // doc.prevDay = {}; doc.marketSession = {}; doc.opening15m = {};
    // doc.updatedAt = new Date();
    // await doc.save();
    console.log(`📅 New Day: ${nowDate}`);
  }

  if (hours === 0 && minutes === 0 && candle.x && !doc.opening15m?.trackingStarted) {
    doc.opening15m = {
      high: parseFloat(candle.h),
      low: parseFloat(candle.l),
      breakoutDirection: null,
      retestConfirmed: false,
      trackingStarted: true,
      priceAction: null
    };
    doc.updatedAt = new Date();
    await doc.save();
    console.log(`🟦 [${symbol}] 15m Range Set: High=${doc.opening15m.high}, Low=${doc.opening15m.low}`);
  }
}

async function handle5mCandle(candle, symbol) {
  const doc = await MomentumSignal.findOne({ symbol });
  if (!doc || !doc.opening15m?.trackingStarted) return;

  const close = parseFloat(candle.c);
  const { high, low, breakoutDirection } = doc.opening15m;

  if (!breakoutDirection) {
    if (close > high) {
      doc.opening15m.breakoutDirection = 'up';
      await doc.save();
      console.log(`🚀 [${symbol}] Breakout UP`);
    } else if (close < low) {
      doc.opening15m.breakoutDirection = 'down';
      await doc.save();
      console.log(`🔻 [${symbol}] Breakout DOWN`);
    }
  }
}

async function handle1mCandle(candle, symbol) {
  const doc = await MomentumSignal.findOne({ symbol });
  if (!doc?.opening15m?.breakoutDirection || doc.opening15m.retestConfirmed) return;

  const close = parseFloat(candle.c);
  const open = parseFloat(candle.o);
  const high = parseFloat(candle.h);
  const low = parseFloat(candle.l);
  const rangeHigh = doc.opening15m.high;
  const rangeLow = doc.opening15m.low;
  const dir = doc.opening15m.breakoutDirection;

  const bodySize = Math.abs(close - open);
  const wickSize = dir === 'up' ? (rangeHigh - low) : (high - rangeLow);
  const range = rangeHigh - rangeLow;
  const wickToBodyRatio = wickSize / (bodySize || 1e-6); // avoid div by zero

  // Mark wick touched
  if (dir === 'up' && !doc.opening15m.touchedLevel && low <= rangeHigh) {
    doc.opening15m.touchedLevel = true;
    console.log(`🔄 [${symbol}] Retest wick touched (UP). Waiting for close above...`);
  }

  if (dir === 'down' && !doc.opening15m.touchedLevel && high >= rangeLow) {
    doc.opening15m.touchedLevel = true;
    console.log(`🔄 [${symbol}] Retest wick touched (DOWN). Waiting for close below...`);
  }

  // Confirm Retest
  if (doc.opening15m.touchedLevel) {
    let shouldConfirm = false;

    if (dir === 'up' && close > rangeHigh) shouldConfirm = true;
    if (dir === 'down' && close < rangeLow) shouldConfirm = true;

    if (shouldConfirm) {
      // Determine price action based on hybrid model
      if (wickSize < 0.1 * range && wickToBodyRatio > 2) {
        doc.opening15m.priceAction = 'strong';
      } else if (wickSize < 0.3 * range && wickToBodyRatio >= 1) {
        doc.opening15m.priceAction = 'neutral';
      } else {
        doc.opening15m.priceAction = 'weak';
      }

      doc.opening15m.retestConfirmed = true;
      await doc.save();
      console.log(`✅ [${symbol}] Retest Confirmed (${dir.toUpperCase()}) with Price Action: ${doc.opening15m.priceAction}`);
    }
  }
}


module.exports = {
  handle15mCandle,
  handle5mCandle,
  handle1mCandle
};
