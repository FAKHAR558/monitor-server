// logic/handleCandles.js
const MomentumSignal = require('../models/MomentumSignal');
const { getUTCDateString, getUTCHoursMinutes } = require('../utils/time');
const { broadcastSignal } = require('../socketServer');

async function handle15mCandle(candle, symbol) {
  const nowDate = getUTCDateString(candle.t);
  const { hours, minutes } = getUTCHoursMinutes(candle.t);
  const doc = await MomentumSignal.findOneAndUpdate(
    { symbol },
    { $setOnInsert: { symbol, updatedAt: new Date() } },
    { upsert: true, new: true }
  );

  if (doc.updatedAt.toISOString().split('T')[0] !== nowDate) {
    console.log("🗕️ New Day: Resetting data");
    doc.opening15m = undefined;
    doc.updatedAt = new Date();
    await doc.save();
  }

  if (hours === 20  && minutes === 30 && candle.x && !doc.opening15m?.trackingStarted) {
    const high = parseFloat(candle.h);
    const low = parseFloat(candle.l);
    const mid = (high + low) / 2;
    const percentRange = ((high - low) / mid) * 100;

    if (percentRange < 1) {
      console.log(`⚠️ Skipping ${symbol} due to low range (${percentRange.toFixed(2)}%)`);
      return;
    }

    doc.opening15m = {
      high,
      low,
      breakoutDirection: null,
      retestConfirmed: false,
      tradeConfirmed: false,
      trackingStarted: true,
      priceAction: null,
      touchedLevel: false,
      consolidated: false,
      recentCandles: [],
      retestCandle: null,
      invalidated: false,
      stopLoss: 0,
      status:null,
      confirmation:'CLEAR'
    };

    doc.updatedAt = new Date();
    await doc.save();
    console.log(`✅ [${symbol}] 15m Range => High: ${high}, Low: ${low}`);
  }
}

async function handle5mCandle(candle, symbol) {
  const doc = await MomentumSignal.findOne({ symbol });
  if (!doc || !doc.opening15m?.trackingStarted || doc.opening15m.breakoutDirection) return;

  const close = parseFloat(candle.c);
  const high = parseFloat(doc.opening15m.high);
  const low = parseFloat(doc.opening15m.low);

  if (close > high) {
  doc.opening15m.breakoutDirection = 'up';
  doc.opening15m.recentCandles = [];
  await doc.save();
  console.log(`🚀 [${symbol}] Breakout UP`);
} else if (close < low) {
  doc.opening15m.breakoutDirection = 'down';
  doc.opening15m.recentCandles = [];
  await doc.save();
  console.log(`🔻 [${symbol}] Breakout DOWN`);
}

}

async function handle1mCandle(candle, symbol) {
  const doc = await MomentumSignal.findOne({ symbol });
  if (!doc?.opening15m?.breakoutDirection || doc.opening15m.invalidated ||  ["PROFIT", "LOSS"].includes(doc.opening15m.status)) return;

  const close = parseFloat(candle.c);
  const open = parseFloat(candle.o);
  const high = parseFloat(candle.h);
  const low = parseFloat(candle.l);
  const dir = doc.opening15m.breakoutDirection;
  const rangeHigh = parseFloat(doc.opening15m.high);
  const rangeLow = parseFloat(doc.opening15m.low);
  const range = rangeHigh - rangeLow;
  const bodySize = Math.abs(close - open);
  const wickSize = dir === 'up' ? (rangeHigh - low) : (high - rangeLow);
  const wickToBodyRatio = wickSize / (bodySize || 1e-6);

  if (doc.opening15m.tradeConfirmed) {
  const { takeProfit, stopLoss } = doc.opening15m;

  if (dir === 'up') {
    if (close > takeProfit) {
      doc.opening15m.status = 'PROFIT';
    } else if (close < stopLoss) {
      doc.opening15m.status = 'LOSS';
    }
  } else if (dir === 'down') {
    if (close < takeProfit) {
      doc.opening15m.status = 'PROFIT';
    } else if (close > stopLoss) {
      doc.opening15m.status = 'LOSS';
    }
  }

  await doc.save(); // persist the status update
} 

  // Confirmation Clearity Status 
  if (doc.opening15m.retestConfirmed && !doc.opening15m.tradeConfirmed) {
  if (
    (dir === 'up' && close < rangeHigh) ||
    (dir === 'down' && close > rangeLow)
  ) {
    doc.opening15m.confirmation = 'NOISY';
    console.log(`⚠️ [${symbol}] Confirmation marked NOISY — price re-entered range`);
  }
  await doc.save();
 }



  // ✅ Invalidate breakout if fully re-entered opposite
  if ((dir === 'up' && close < rangeLow) || (dir === 'down' && close > rangeHigh)) {
    doc.opening15m.invalidated = true;
    await doc.save();
    console.log(`❌ [${symbol}] Breakout invalidated`);
    return;
  }

  // ✅ Track candles for consolidation check
  const recent = doc.opening15m.recentCandles || [];
  recent.push({ open, close, high, low });
  if (recent.length > 10) recent.shift();
  doc.opening15m.recentCandles = recent;

  // ✅ Consolidation confirmation
  const base = dir === 'up' ? rangeHigh : rangeLow;
  const valid = recent.slice(-6).filter(c => {
    if (dir === 'up') return c.low > base && c.high > base;
    if (dir === 'down') return c.high < base && c.low < base;
  });

  if (!doc.opening15m.consolidated && valid.length >= 2) {
    doc.opening15m.consolidated = true;
    await doc.save();
    console.log(`🔒 [${symbol}] Consolidation confirmed (${dir})`);
    return;
  }

  // ✅ Retest candle logic (must touch level AND close beyond)
if (
  doc.opening15m.consolidated &&
  !doc.opening15m.retestConfirmed &&
  (
    (dir === 'up' && close > rangeHigh && low <= rangeHigh) ||
    (dir === 'down' && close < rangeLow && high >= rangeLow)
  )
) {
  doc.opening15m.retestConfirmed = true;
  doc.opening15m.retestCandle = { open, close, high, low };

  // ➕ Set stop loss based on direction
  doc.opening15m.stopLoss = dir === 'up' ? low : high;
  
  if (wickSize < 0.1 * range && wickToBodyRatio > 2) {
    doc.opening15m.priceAction = 'strong';
  } else if (wickSize < 0.3 * range && wickToBodyRatio >= 1) {
    doc.opening15m.priceAction = 'neutral';
  } else {
    doc.opening15m.priceAction = 'weak';
  }

  await doc.save();
  console.log(`✅ [${symbol}] Retest candle locked (${dir})`);
  return;
}


  // ✅ Trade confirmation
  if (
    doc.opening15m.retestConfirmed &&
    !doc.opening15m.tradeConfirmed &&
    doc.opening15m.retestCandle
  ) {
    const retestLow = doc.opening15m.retestCandle.low;
    const retestHigh = doc.opening15m.retestCandle.high;

    if (
      (dir === 'up' && close > retestHigh) ||
      (dir === 'down' && close < retestLow)
    ) {
      doc.opening15m.tradeConfirmed = true;
      doc.opening15m.tradeConfirmedAt = new Date();
      // ✅ Take Profit Calculation (1:2 R:R)
      const stopLoss = parseFloat(doc.opening15m?.stopLoss || 0);
      const entry = close;
      if (dir === 'up') {
        doc.opening15m.takeProfit = entry + 2 * (entry - stopLoss);
      } else {
       doc.opening15m.takeProfit = entry - 2 * (stopLoss - entry);
     }

      await doc.save();

      console.log(`📈 [${symbol}] Trade Confirmed (${dir})`);

      broadcastSignal({
        coin: symbol,
        breakout: dir,
        momentum: doc.opening15m.priceAction,
        retest: 'Confirmed',
        trade: 'Confirmed',
        confirmedAt: new Date().toISOString(),
        tradeConfirmedAt: doc.opening15m.tradeConfirmedAt,
        entry:close,
        stopLoss: parseFloat(doc.opening15m.stopLoss),
        takeProfit: parseFloat(doc.opening15m.takeProfit)
      });
      return;
    }
  }

  await doc.save();
}


module.exports = {
  handle15mCandle,
  handle5mCandle,
  handle1mCandle
};
