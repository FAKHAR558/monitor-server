// logic/handleCandles.js
const MomentumSignal = require('../models/MomentumSignal');
const { getUTCDateString, getUTCHoursMinutes } = require('../utils/time');
const { broadcastSignal } = require('../socketServer'); // ⬅️ Add this line at the top


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

  if (hours === 1 && minutes === 0 && candle.x && !doc.opening15m?.trackingStarted) {
    const rawHigh = candle.h;
    const rawLow = candle.l;
    const high = parseFloat(rawHigh);
    const low = parseFloat(rawLow);
    const mid = (high + low) / 2;
    const range = high - low;
    const percentRange = (range / mid) * 100;

    // console.log(`🟡 [${symbol}] RAW Candle => high: ${rawHigh}, low: ${rawLow}`);
    // console.log(`🔍 Parsed => high: ${high} (${typeof high}), low: ${low} (${typeof low})`);
    // console.log(`🔬 Rounded => high: ${high.toFixed(6)}, low: ${low.toFixed(6)}`);

    if (percentRange < 1) {
      console.log(`⚠️ Skipping ${symbol} due to low range (${percentRange.toFixed(2)}%)`);
      return; // Skip tracking this coin
    }

    doc.opening15m = {
      high: parseFloat(candle.h),
      low: parseFloat(candle.l),
      breakoutDirection: null,
      retestConfirmed: false,
      trackingStarted: true,
      priceAction: null
    };

    // console.log(`[${symbol}] Saving 15m Range => high: ${candle.h}, low: ${candle.l}`);
    doc.updatedAt = new Date();
    await doc.save();

    // console.log(`✅ Saved 15m Range [${symbol}] => High: ${candle.h}, Low: ${candle.l}`);
    // console.log(`From DB [${symbol}] => High: ${parseFloat(doc.opening15m.high.toString())}, Low: ${parseFloat(doc.opening15m.low.toString())}`);

  }
}


async function handle5mCandle(candle, symbol) {
  const doc = await MomentumSignal.findOne({ symbol });
  if (!doc || !doc.opening15m?.trackingStarted) return;

  const close = parseFloat(candle.c);
  const high = parseFloat(doc.opening15m.high.toString());
  const low = parseFloat(doc.opening15m.low.toString());
  const breakoutDirection = doc.opening15m.breakoutDirection;

  if (!breakoutDirection) {
    if (close > high) {
      doc.opening15m.breakoutDirection = 'up';
      doc.opening15m.recentCandles = []; // ⬅️ Same here
      await doc.save();
      console.log(`🚀 [${symbol}] Breakout UP`);
    } else if (close < low) {
      doc.opening15m.breakoutDirection = 'down';
      doc.opening15m.recentCandles = []; // ⬅️ Same here
      await doc.save();
      console.log(`🔻 [${symbol}] Breakout DOWN`);
    }
  }
}

async function handle1mCandle(candle, symbol) {
  const doc = await MomentumSignal.findOne({ symbol });
  if (!doc?.opening15m?.breakoutDirection || doc.opening15m.invalidated) return;

  const close = parseFloat(candle.c);
  const open = parseFloat(candle.o);
  const high = parseFloat(candle.h);
  const low = parseFloat(candle.l);
  const rangeHigh = parseFloat(doc.opening15m.high.toString());
  const rangeLow = parseFloat(doc.opening15m.low.toString());
  const dir = doc.opening15m.breakoutDirection;

  const bodySize = Math.abs(close - open);
  const wickSize = dir === 'up' ? (rangeHigh - low) : (high - rangeLow);
  const range = rangeHigh - rangeLow;
  const wickToBodyRatio = wickSize / (bodySize || 1e-6);

  // ✅ Invalidation check
  if (dir === 'up' && low <= rangeLow) {
    doc.opening15m.invalidated = true;
    await doc.save();
    console.log(`❌ [${symbol}] Bullish breakout invalidated`);
    return;
  }
  if (dir === 'down' && high >= rangeHigh) {
    doc.opening15m.invalidated = true;
    await doc.save();
    console.log(`❌ [${symbol}] Bearish breakout invalidated`);
    return;
  }

  // ✅ Track recent candles
  const recent = doc.opening15m.recentCandles || [];
  recent.push({ open, close, high, low });
  if (recent.length > 10) recent.shift();
  doc.opening15m.recentCandles = recent;

  // ✅ Consolidation Check
  if (!doc.opening15m.consolidated) {
    const baseLevel = dir === 'up' ? rangeHigh : rangeLow;
    const valid = recent.slice(-6, -1).filter(c => {
      if (dir === 'up') return c.low > baseLevel && c.close > baseLevel;
      if (dir === 'down') return c.high < baseLevel && c.close < baseLevel;
    });

    if (valid.length >= 3) {
      doc.opening15m.consolidated = true;
      console.log(`🔒 [${symbol}] Consolidation confirmed (${dir.toUpperCase()})`);
    }
  }

  // ✅ Retest Logic (touched level)
  if (dir === 'up' && !doc.opening15m.touchedLevel && low <= rangeHigh) {
    doc.opening15m.touchedLevel = true;
  }
  if (dir === 'down' && !doc.opening15m.touchedLevel && high >= rangeLow) {
    doc.opening15m.touchedLevel = true;
  }

  // ✅ Confirm Retest (save the retest candle but DO NOT send signal yet)
  if (
    doc.opening15m.consolidated &&
    !doc.opening15m.retestConfirmed &&
    ((dir === 'up' && close > rangeHigh) || (dir === 'down' && close < rangeLow))
  ) {
    if (wickSize < 0.1 * range && wickToBodyRatio > 2) {
      doc.opening15m.priceAction = 'strong';
    } else if (wickSize < 0.3 * range && wickToBodyRatio >= 1) {
      doc.opening15m.priceAction = 'neutral';
    } else {
      doc.opening15m.priceAction = 'weak';
    }

    doc.opening15m.retestConfirmed = true;
    doc.opening15m.retestCandle = { open, close, high, low };
    await doc.save();

    console.log(`✅ [${symbol}] Retest Confirmed (${dir.toUpperCase()}) with Price Action: ${doc.opening15m.priceAction}`);
    return;
  }

  // ✅ Trade Confirmation (after retestConfirmed)
  if (doc.opening15m.retestConfirmed && !doc.opening15m.tradeConfirmed && doc.opening15m.retestCandle) {
    const retestClose = doc.opening15m.retestCandle.close;

    if (
      (dir === 'up' && close > retestClose) ||
      (dir === 'down' && close < retestClose)
    ) {
      doc.opening15m.tradeConfirmed = true;
      doc.opening15m.tradeConfirmedAt = new Date(); // ✅ Add time
      await doc.save();

      console.log(`📈 [${symbol}] Trade Confirmed (${dir.toUpperCase()})`);

      broadcastSignal({
        coin: symbol,
        breakout: dir,
        momentum: doc.opening15m.priceAction,
        retest: 'Confirmed',
        trade: 'Confirmed',
        confirmedAt: new Date().toISOString(),
        tradeConfirmedAt: doc.opening15m.tradeConfirmedAt // ✅ Include in broadcast
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
