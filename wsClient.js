// wsClient.js
const WebSocket = require('ws');
const symbols = require('./config/symbols');
const {
  handle15mCandle,
  handle5mCandle,
  handle1mCandle
} = require('./logic/handleCandles');

function initWS() {
  const streams = symbols.flatMap(symbol => ([
    `${symbol.toLowerCase()}@kline_15m`,
    `${symbol.toLowerCase()}@kline_5m`,
    `${symbol.toLowerCase()}@kline_1m`
  ])).join('/');

  const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

  ws.on('open', () => console.log('✅ Connected to Binance WebSocket'));

  ws.on('message', async (data) => {
    const msg = JSON.parse(data);
    const candle = msg.data.k;
    const interval = candle.i;
    const symbol = msg.data.s;

    if (!candle.x) return;

    switch (interval) {
      case '15m':
        await handle15mCandle(candle, symbol);
        break;
      case '5m':
        await handle5mCandle(candle, symbol);
        break;
      case '1m':
        await handle1mCandle(candle, symbol);
        break;
    }
  });

  ws.on('error', (err) => console.error('❌ WebSocket Error:', err));
  ws.on('close', () => console.log('🔌 WebSocket Closed'));
}

module.exports = initWS;
