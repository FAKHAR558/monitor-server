const axios = require('axios');

async function getAllFuturesSymbols() {
  const res = await axios.get('https://fapi.binance.com/fapi/v1/exchangeInfo');
  return res.data.symbols
    .filter(s =>
      s.symbol.endsWith('USDT') &&
      s.contractType === 'PERPETUAL' &&
      s.status === 'TRADING'
    )
    .map(s => s.symbol);
}

module.exports = getAllFuturesSymbols;
