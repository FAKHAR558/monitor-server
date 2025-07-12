// index.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const connectDB = require('./db');
const initWS = require('./wsClient');
const { initSocket } = require('./socketServer'); // ⬅️ Import WebSocket server

const app = express();
const server = http.createServer(app); // ⬅️ Wrap app with HTTP server
const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => res.send('📡 Binance Momentum Monitor Running'));

connectDB().then(() => {
  initWS();              // ✅ Binance WebSocket client (to receive candle data)
  initSocket(server);    // ✅ Your WebSocket server (to push to frontend)

  server.listen(PORT, () =>
    console.log(`🚀 Server listening at http://localhost:${PORT}`)
  );
});
