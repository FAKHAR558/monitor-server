const WebSocket = require('ws');
const {
  handle15mCandle,
  handle5mCandle,
  handle1mCandle
} = require('../logic/handleCandles');

function chunkArray(arr, size) {
  const res = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
}

function startStreamChunk(streamsChunk) {
  
  const streamQuery = streamsChunk.join('/');
  const ws = new WebSocket(`wss://fstream.binance.com/stream?streams=${streamQuery}`);
  ws.on('open', () => console.log('✅ Connected to Binance Futures WebSocket'));

  ws.on('open', () => console.log('✅ WebSocket Connected'));

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

  ws.on('close', () => console.log('🔌 WebSocket Closed'));
  ws.on('error', (err) => console.error('❌ WebSocket Error:', err));
}

function subscribeInChunks(symbols, chunkSize = 180) {
  const allStreams = symbols.flatMap(symbol => [
    `${symbol.toLowerCase()}@kline_15m`,
    `${symbol.toLowerCase()}@kline_5m`,
    `${symbol.toLowerCase()}@kline_1m`
  ]);

  const chunks = chunkArray(allStreams, chunkSize);

  chunks.forEach(chunk => {
    startStreamChunk(chunk);
  });

  console.log(`📡 Started ${chunks.length} WebSocket connections.`);
}

module.exports = subscribeInChunks;
