const state = require('./state');
const { getUTCDateString, getUTCHoursMinutes } = require('./utils');

function handle15mCandle(candle) {
  const nowDate = getUTCDateString(candle.t);
  const { hours, minutes } = getUTCHoursMinutes(candle.t);

  // Reset at new UTC date
  if (state.currentDate !== nowDate) {
    console.log(`[MATCH] ✅ 11:00 UTC Candle Found!`);
    console.log(`📅 New Day: ${nowDate}`);
    state.currentDate = nowDate;
    state.rangeHigh = null;
    state.rangeLow = null;
    state.breakoutDirection = null;
    state.touchedLevel = false;
    state.retestConfirmed = false;
    state.trackingStarted = false;
  }

  console.log(`[DEBUG] 15m Candle: ${new Date(candle.t).toISOString()} | Closed: ${candle.x}`);
  console.log(`[DEBUG] UTC Time: ${hours}:${minutes}, Start of Candle: ${new Date(candle.t).toISOString()}, Closed: ${candle.x}`);

  // Start only at 10:30 UTC (which is start time of the 10:30–10:45 candle)
  if (hours === 11 && minutes === 15 && candle.x && !state.trackingStarted) {
    console.log("analyzing");
    state.trackingStarted = true;
    state.rangeHigh = parseFloat(candle.h);
    state.rangeLow = parseFloat(candle.l);

    console.log(`🟦 10:30 UTC Candle Set: High=${state.rangeHigh}, Low=${state.rangeLow}`);
  }
}


function handle5mCandle(candle) {
  if (!state.rangeHigh || !state.rangeLow) return;

  const close = parseFloat(candle.c);

  if (!state.breakoutDirection) {
    if (close > state.rangeHigh) {
      state.breakoutDirection = "up";
      console.log("🚀 Breakout UP");
    } else if (close < state.rangeLow) {
      state.breakoutDirection = "down";
      console.log("🔻 Breakout DOWN");
    }
  }
}

function handle1mCandle(candle) {
  if (!state.breakoutDirection || state.retestConfirmed) return;

  const close = parseFloat(candle.c);
  const high = parseFloat(candle.h);
  const low = parseFloat(candle.l);

  if (state.breakoutDirection === "up") {
    if (!state.touchedLevel && low <= state.rangeHigh) {
      state.touchedLevel = true;
      console.log("🔄 Retest wick touched (UP). Waiting for close above...");
    }

    if (state.touchedLevel && close > state.rangeHigh) {
      state.retestConfirmed = true;
      console.log("✅ Retest Confirmed (UP)");
    }
  }

  if (state.breakoutDirection === "down") {
    if (!state.touchedLevel && high >= state.rangeLow) {
      state.touchedLevel = true;
      console.log("🔄 Retest wick touched (DOWN). Waiting for close below...");
    }

    if (state.touchedLevel && close < state.rangeLow) {
      state.retestConfirmed = true;
      console.log("✅ Retest Confirmed (DOWN)");
    }
  }
}

module.exports = {
  handle15mCandle,
  handle5mCandle,
  handle1mCandle // ✅ Add this line
};
