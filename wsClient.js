const getAllFuturesSymbols = require('./utils/getAllFuturesSymbols');
const subscribeInChunks = require('./utils/splitAndSubscribe');

async function initWS() {
  const symbols = await getAllFuturesSymbols();

  console.log(`✅ Loaded ${symbols.length} USDT-futures symbols`);

  subscribeInChunks(symbols); // <-- handles chunking internally
}

module.exports = initWS;
