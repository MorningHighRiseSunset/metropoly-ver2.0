const WebSocket = require('ws');
const http = require('http');

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket server is running');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store active games and players
const games = new Map();
const players = new Map();

wss.on('connection', (ws) => {
  console.log('New client connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received:', data.type);
      
      switch (data.type) {
        case 'create_game':
          handleCreateGame(ws, data);
          break;
        case 'join_game':
          handleJoinGame(ws, data);
          break;
        case 'player_action':
          handlePlayerAction(ws, data);
          break;
        case 'update_token':
          handleUpdateToken(ws, data);
          break;
        case 'leave_game':
          handleLeaveGame(ws, data);
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });
  
  ws.on('close', () => {
    handleDisconnect(ws);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function handleCreateGame(ws, data) {
  const gameId = data.gameId;
  const playerName = data.playerName;
  const token = data.token;
  
  console.log(`Creating game: ${gameId} for player: ${playerName}`);
  
  // Create new game
  games.set(gameId, {
    id: gameId,
    players: [],
    createdAt: Date.now()
  });
  
  // Add host to game
  const player = {
    id: 0,
    name: playerName,
    token: token,
    ws: ws,
    isHost: true
  };
  
  games.get(gameId).players.push(player);
  players.set(ws, { gameId, playerId: 0 });
  
  // Confirm game creation
  ws.send(JSON.stringify({
    type: 'game_created',
    gameId: gameId,
    playerId: 0,
    isHost: true
  }));
  
  console.log(`Game ${gameId} created with host ${playerName}`);
}

function handleJoinGame(ws, data) {
  const gameId = data.gameId;
  const playerName = data.playerName;
  const token = data.token;
  
  console.log(`Player ${playerName} joining game: ${gameId}`);
  
  const game = games.get(gameId);
  
  if (!game) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Game not found'
    }));
    return;
  }
  
  if (game.players.length >= 4) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Game is full (max 4 players)'
    }));
    return;
  }
  
  // Add player to game
  const playerId = game.players.length;
  const player = {
    id: playerId,
    name: playerName,
    token: token,
    ws: ws,
    isHost: false
  };
  
  game.players.push(player);
  players.set(ws, { gameId, playerId });
  
  // Notify player they joined
  ws.send(JSON.stringify({
    type: 'game_joined',
    gameId: gameId,
    playerId: playerId,
    isHost: false,
    players: game.players.map(p => ({
      id: p.id,
      name: p.name,
      token: p.token,
      isHost: p.isHost
    }))
  }));
  
  // Notify all players about new player
  broadcastToGame(gameId, {
    type: 'player_joined',
    playerId: playerId,
    playerName: playerName,
    token: token,
    isHost: false
  }, ws);
  
  console.log(`Player ${playerName} joined game ${gameId} (total: ${game.players.length})`);
}

function handlePlayerAction(ws, data) {
  const playerInfo = players.get(ws);
  if (!playerInfo) return;
  
  const { gameId, playerId } = playerInfo;
  const game = games.get(gameId);
  
  if (!game) return;
  
  // Broadcast action to all other players
  broadcastToGame(gameId, {
    type: 'player_action',
    playerId: playerId,
    action: data.action,
    data: data.data
  }, ws);
}

function handleUpdateToken(ws, data) {
  const playerInfo = players.get(ws);
  if (!playerInfo) return;
  
  const { gameId, playerId } = playerInfo;
  const game = games.get(gameId);
  
  if (!game) return;
  
  // Update player's token
  const player = game.players.find(p => p.id === playerId);
  if (player) {
    player.token = data.token;
    
    // Broadcast token update to all other players
    broadcastToGame(gameId, {
      type: 'token_updated',
      playerId: playerId,
      token: data.token
    }, ws);
  }
}

function handleLeaveGame(ws, data) {
  const playerInfo = players.get(ws);
  if (!playerInfo) return;
  
  const { gameId, playerId } = playerInfo;
  const game = games.get(gameId);
  
  if (game) {
    // Remove player from game
    game.players = game.players.filter(p => p.id !== playerId);
    
    // Notify other players
    broadcastToGame(gameId, {
      type: 'player_left',
      playerId: playerId
    });
    
    // If game is empty, delete it
    if (game.players.length === 0) {
      games.delete(gameId);
      console.log(`Game ${gameId} deleted (no players)`);
    }
  }
  
  players.delete(ws);
}

function handleDisconnect(ws) {
  const playerInfo = players.get(ws);
  if (!playerInfo) return;
  
  const { gameId, playerId } = playerInfo;
  const game = games.get(gameId);
  
  if (game) {
    // Remove player from game
    game.players = game.players.filter(p => p.id !== playerId);
    
    // Notify other players
    broadcastToGame(gameId, {
      type: 'player_left',
      playerId: playerId
    });
    
    // If game is empty, delete it
    if (game.players.length === 0) {
      games.delete(gameId);
      console.log(`Game ${gameId} deleted (no players)`);
    }
  }
  
  players.delete(ws);
  console.log('Client disconnected');
}

function broadcastToGame(gameId, message, excludeWs = null) {
  const game = games.get(gameId);
  if (!game) return;
  
  game.players.forEach(player => {
    if (player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(message));
    }
  });
}

// Cleanup old games periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [gameId, game] of games.entries()) {
    if (now - game.createdAt > 300000) { // 5 minutes
      games.delete(gameId);
      console.log(`Cleaned up old game: ${gameId}`);
    }
  }
}, 300000);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});
