const WebSocket = require('ws');
const http = require('http');

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Metropoly WebSocket Server Running');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store game rooms
const games = new Map();

// Generate a random game ID
function generateGameId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Handle new WebSocket connections
wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleMessage(ws, data);
    } catch (e) {
      console.error('Error parsing message:', e);
    }
  });

  ws.on('close', () => {
    handleDisconnect(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function handleMessage(ws, data) {
  switch (data.type) {
    case 'create_game':
      createGame(ws, data);
      break;
    case 'join_game':
      joinGame(ws, data);
      break;
    case 'player_action':
      forwardToGame(ws, data);
      break;
    case 'game_update':
      forwardToGame(ws, data);
      break;
    default:
      console.log('Unknown message type:', data.type);
  }
}

function createGame(ws, data) {
  const gameId = generateGameId();
  const game = {
    id: gameId,
    host: ws,
    players: [{ ws, id: 0, name: data.playerName || 'Host', token: data.token }],
    gameState: null,
    createdAt: Date.now()
  };
  
  games.set(gameId, game);
  ws.gameId = gameId;
  ws.playerId = 0;
  
  ws.send(JSON.stringify({
    type: 'game_created',
    gameId: gameId,
    playerId: 0,
    players: game.players.map(p => ({ id: p.id, name: p.name, token: p.token }))
  }));
  
  console.log(`Game created: ${gameId} by player 0`);
}

function joinGame(ws, data) {
  const { gameId, playerName, token } = data;
  const game = games.get(gameId);
  
  if (!game) {
    ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
    return;
  }
  
  if (game.players.length >= 4) {
    ws.send(JSON.stringify({ type: 'error', message: 'Game is full' }));
    return;
  }
  
  const playerId = game.players.length;
  const player = { ws, id: playerId, name: playerName || `Player ${playerId + 1}`, token };
  game.players.push(player);
  
  ws.gameId = gameId;
  ws.playerId = playerId;
  
  // Notify all players about new player
  broadcastToGame(gameId, {
    type: 'player_joined',
    playerId: playerId,
    playerName: player.name,
    token: player.token,
    totalPlayers: game.players.length
  });
  
  // Send current game state to new player
  ws.send(JSON.stringify({
    type: 'game_joined',
    gameId: gameId,
    playerId: playerId,
    players: game.players.map(p => ({ id: p.id, name: p.name, token: p.token })),
    gameState: game.gameState
  }));
  
  console.log(`Player ${playerId} joined game ${gameId}`);
}

function forwardToGame(ws, data) {
  const gameId = ws.gameId;
  const game = games.get(gameId);
  
  if (!game) return;
  
  // Add sender's player ID to the message
  data.senderId = ws.playerId;
  
  // Broadcast to all other players in the game
  game.players.forEach(player => {
    if (player.ws !== ws && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(data));
    }
  });
}

function broadcastToGame(gameId, data) {
  const game = games.get(gameId);
  if (!game) return;
  
  game.players.forEach(player => {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(data));
    }
  });
}

function handleDisconnect(ws) {
  const gameId = ws.gameId;
  if (!gameId) return;
  
  const game = games.get(gameId);
  if (!game) return;
  
  const playerIndex = game.players.findIndex(p => p.ws === ws);
  if (playerIndex === -1) return;
  
  const playerId = game.players[playerIndex].id;
  game.players.splice(playerIndex, 1);
  
  // Notify remaining players
  broadcastToGame(gameId, {
    type: 'player_left',
    playerId: playerId
  });
  
  // If host left and there are still players, promote new host
  if (playerIndex === 0 && game.players.length > 0) {
    game.host = game.players[0].ws;
    broadcastToGame(gameId, {
      type: 'host_changed',
      newHostId: game.players[0].id
    });
  }
  
  // Delete game if no players left
  if (game.players.length === 0) {
    games.delete(gameId);
    console.log(`Game ${gameId} deleted (no players)`);
  }
  
  console.log(`Player ${playerId} disconnected from game ${gameId}`);
}

// Clean up old games (older than 24 hours)
setInterval(() => {
  const now = Date.now();
  for (const [gameId, game] of games.entries()) {
    if (now - game.createdAt > 24 * 60 * 60 * 1000) {
      games.delete(gameId);
      console.log(`Cleaned up old game: ${gameId}`);
    }
  }
}, 60 * 60 * 1000); // Check every hour

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Metropoly WebSocket server running on port ${PORT}`);
});
