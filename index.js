// index.js
require('dotenv').config();
const express = require('express');
const connectDB = require('./db');
const initWS = require('./wsClient');

const app = express();
const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => res.send('📡 Binance Momentum Monitor Running'));

connectDB().then(() => {
  initWS();
  app.listen(PORT, () => console.log(`🚀 Server listening at http://localhost:${PORT}`));
});
