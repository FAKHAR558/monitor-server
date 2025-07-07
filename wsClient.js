// wsClient.js
const WebSocket = require('ws');
const { handle15mCandle, handle5mCandle, handle1mCandle } = require('./logic');

const symbol = 'btcusdt';

function initWS() {
  const streams = [
    `${symbol}@kline_15m`,
    `${symbol}@kline_5m`,
    `${symbol}@kline_1m`
  ].join('/');

  const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

  ws.on('open', () => {
    console.log('✅ Connected to Binance WebSocket');
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    const candle = msg.data.k;
    const interval = candle.i;

    if (!candle.x) return; // Only use closed candles

    switch (interval) {
      case '15m':
        handle15mCandle(candle);
        break;
      case '5m':
        handle5mCandle(candle);
        break;
      case '1m':
        handle1mCandle(candle);
        break;
    }
  });

  ws.on('close', () => console.log('❌ Disconnected from WebSocket'));
  ws.on('error', err => console.error('WebSocket Error:', err));
}

module.exports = initWS;
