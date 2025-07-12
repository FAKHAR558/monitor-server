// server/socketServer.js
const WebSocket = require('ws');

let clients = [];

function initSocket(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    clients.push(ws);
    console.log('📡 Client connected');

    ws.on('close', () => {
      clients = clients.filter((c) => c !== ws);
      console.log('❌ Client disconnected');
    });
  });
}

function broadcastSignal(data) {
  const json = JSON.stringify(data);
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(json);
  });
}

module.exports = {
  initSocket,
  broadcastSignal
};
