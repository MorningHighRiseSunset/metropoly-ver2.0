// ===== GAME STATE =====
const gameState = {
  selectedToken: null,
  selectedModel: null,
  gameMode: 'ai', // 'multiplayer' or 'ai'
  aiCount: 0,
  aiSelectedTokens: [], // Store AI token selections from lobby
  players: [],
  gameStarted: false,
  currentPlayerIndex: 0,
  playerTokens: [] // 3D token models on the board
};

// Store animation mixers for each player
const playerAnimations = {};

// ===== DOM ELEMENTS =====
const scene = document.querySelector('.scene');
const lobbyOverlay = document.getElementById('lobbyOverlay');
const gameUI = document.getElementById('gameUI');
const tokenOptions = document.querySelectorAll('.token-option');
const aiSection = document.getElementById('aiSection');
const inviteLink = document.getElementById('inviteLink');
const copyBtn = document.getElementById('copyBtn');
const addAiBtn = document.getElementById('addAiBtn');
const aiCount = document.getElementById('aiCount');
const playerList = document.getElementById('playerList');
const playerCount = document.getElementById('playerCount');
const startGameBtn = document.getElementById('startGameBtn');
const hostToken = document.getElementById('hostToken');
const rollDiceBtn = document.getElementById('rollDiceBtn');
const die1 = document.getElementById('die1');
const die2 = document.getElementById('die2');
const playersList = document.getElementById('playersList');
const aiMoves = document.getElementById('aiMoves');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const myProperties = document.getElementById('myProperties');
const playerMoney = document.getElementById('playerMoney');
const endTurnBtn = document.getElementById('endTurnBtn');

// ===== BOARD ROTATION FOR THREE.JS =====
let boardRotationZ = 0;
let boardVel = 0;
let isBoardDragging = false;
let lastBoardX = 0;
let boardRaf = null;

function applyBoardRotation() {
  if (board3DGroup) {
    board3DGroup.rotation.z = boardRotationZ;
  }
}

function boardInertia() {
  if (isBoardDragging) return;
  boardVel *= 0.94;
  if (Math.abs(boardVel) < 0.015) {
    boardVel = 0;
    return;
  }
  boardRotationZ += boardVel;
  applyBoardRotation();
  boardRaf = requestAnimationFrame(boardInertia);
}

function startBoardDrag(x) {
  isBoardDragging = true;
  lastBoardX = x;
  boardVel = 0;
  if (boardRaf) cancelAnimationFrame(boardRaf);
}

function moveBoardDrag(x) {
  if (!isBoardDragging) return;
  const dx = x - lastBoardX;
  lastBoardX = x;
  const sens = 0.55;
  boardVel = dx * sens * 0.18;
  boardRotationZ += dx * sens;
  applyBoardRotation();
}

function endBoardDrag() {
  if (!isBoardDragging) return;
  isBoardDragging = false;
  boardRaf = requestAnimationFrame(boardInertia);
}

// Add board rotation controls to the scene
if (scene) {
  scene.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startBoardDrag(e.clientX);
  });
  window.addEventListener('mousemove', (e) => moveBoardDrag(e.clientX));
  window.addEventListener('mouseup', endBoardDrag);

  scene.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) startBoardDrag(e.touches[0].clientX);
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!isBoardDragging || e.touches.length !== 1) return;
      moveBoardDrag(e.touches[0].clientX);
    }, { passive: true });

  window.addEventListener('touchend', endBoardDrag);
  window.addEventListener('touchcancel', endBoardDrag);

  // Double-click resets board rotation
  scene.addEventListener('dblclick', () => {
    boardRotationZ = 0;
    boardVel = 0;
    applyBoardRotation();
  });
}

// ===== LOBBY FUNCTIONALITY =====

// Generate invite link
function generateInviteLink() {
  const baseUrl = window.location.origin + window.location.pathname;
  const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${baseUrl}?game=${gameId}`;
}

// Initialize invite link if element exists
if (inviteLink) {
  inviteLink.value = generateInviteLink();
}

// Token selection
tokenOptions.forEach(option => {
  option.addEventListener('click', () => {
    tokenOptions.forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
    gameState.selectedToken = option.dataset.token;
    gameState.selectedModel = option.dataset.model;

    // Update host token display
    const hostTokenImg = document.getElementById('hostToken');
    const hostTokenEmoji = document.getElementById('hostTokenEmoji');
    const selectedImg = option.querySelector('img').src;

    hostTokenImg.src = selectedImg;
    hostTokenImg.style.display = 'block';
    hostTokenEmoji.style.display = 'none';

    updateStartButton();
  });
});

// Copy invite link
if (copyBtn && inviteLink) {
  copyBtn.addEventListener('click', () => {
    inviteLink.select();
    document.execCommand('copy');
    copyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyBtn.textContent = 'Copy';
    }, 2000);
  });
}

// Add AI opponents
addAiBtn.addEventListener('click', () => {
  if (gameState.aiCount < 3) {
    gameState.aiCount++;
    aiCount.textContent = `${gameState.aiCount} AI opponents`;
    updatePlayerList();
    updateStartButton();
  }
});

// Update player list
function updatePlayerList() {
  // Clear existing AI players
  const existingAiPlayers = playerList.querySelectorAll('.ai-player');
  existingAiPlayers.forEach(player => player.remove());

  // Available tokens (excluding player's selection)
  const allTokens = ['RollsRoyce', 'Helicopter', 'TopHat', 'Shoe', 'Cheeseburger', 'CoffeeCup', 'Football', 'WhiteGirlIdle'];
  const availableTokens = allTokens.filter(t => t !== gameState.selectedToken);
  
  // Shuffle and assign tokens to AI
  const shuffledTokens = [...availableTokens].sort(() => Math.random() - 0.5);
  gameState.aiSelectedTokens = shuffledTokens.slice(0, gameState.aiCount);

  // Add AI players to lobby UI
  const tokenImageMap = {
    'RollsRoyce': 'rolls_royce',
    'Helicopter': 'helicopter',
    'TopHat': 'top_hat',
    'Shoe': 'shoe',
    'Cheeseburger': 'burger',
    'CoffeeCup': 'coffee',
    'Football': 'football',
    'WhiteGirlIdle': 'whitegirlmodel'
  };

  for (let i = 0; i < gameState.aiCount; i++) {
    const token = gameState.aiSelectedTokens[i];
    const tokenImage = tokenImageMap[token] || 'burger';
    
    const aiPlayer = document.createElement('div');
    aiPlayer.className = 'player-item ai-player';
    aiPlayer.innerHTML = `
      <img src="tokenimages/${tokenImage}.png" class="player-token-img" alt="AI Token">
      <span class="player-name">AI ${i + 1}</span>
    `;
    playerList.appendChild(aiPlayer);
  }

  // Update player count
  const totalPlayers = 1 + gameState.aiCount;
  playerCount.textContent = totalPlayers;

  // Update AI count text
  if (gameState.aiCount === 0) {
    aiCount.textContent = 'Add AI opponents';
  } else {
    aiCount.textContent = `${gameState.aiCount} AI opponent${gameState.aiCount > 1 ? 's' : ''}`;
  }
}

// Update start button state
function updateStartButton() {
  const hasToken = gameState.selectedToken !== null;
  const totalPlayers = 1 + gameState.aiCount;
  const canStart = hasToken && totalPlayers >= 2;

  if (canStart) {
    startGameBtn.disabled = false;
    startGameBtn.classList.add('enabled');
  } else {
    startGameBtn.disabled = true;
    startGameBtn.classList.remove('enabled');
  }
}

// Start game
startGameBtn.addEventListener('click', () => {
  if (startGameBtn.disabled) return;

  // Initialize players
  let playerData = {
    name: 'You',
    token: gameState.selectedToken,
    model: gameState.selectedModel,
    isHuman: true,
    isAI: false,
    position: 0,
    money: 2500,
    isInJail: false,
    jailTurns: 0,
    properties: []
  };

  // Add walk model for female character
  if (gameState.selectedToken === 'WhiteGirlIdle') {
    playerData.walkModel = 'Models/WhiteGirlWalk/Walking.fbx';
  }

  gameState.players = [playerData];

  // Add AI players if in AI mode
  if (gameState.aiCount > 0) {
    const allTokens = [
      { token: 'RollsRoyce', model: 'Models/RollsRoyce/rollsRoyceCarAnim.glb' },
      { token: 'Helicopter', model: 'Models/Helicopter/helicopter.glb' },
      { token: 'TopHat', model: 'Models/TopHat/tophat.glb' },
      { token: 'Shoe', model: 'Models/Shoe/shoe.glb' },
      { token: 'Cheeseburger', model: 'Models/Cheeseburger/cheeseburger.glb' },
      { token: 'CoffeeCup', model: 'Models/CoffeeCup/coffee.gltf' },
      { token: 'Football', model: 'Models/Football/football.glb' }
    ];
    
    // Filter out the player's selected token
    const availableTokens = allTokens.filter(t => t.token !== gameState.selectedToken);
    
    console.log('Available tokens for AI:', availableTokens.map(t => t.token));
    console.log('AI selected tokens from lobby:', gameState.aiSelectedTokens);
    
    for (let i = 0; i < gameState.aiCount; i++) {
      // Use the token that was selected in the lobby
      const selectedTokenName = gameState.aiSelectedTokens[i];
      const selectedToken = availableTokens.find(t => t.token === selectedTokenName);
      
      if (!selectedToken) {
        console.error(`Token ${selectedTokenName} not found in available tokens`);
        continue;
      }
      
      console.log(`AI ${i + 1} selected:`, selectedToken.token);
      
      let aiPlayerData = {
        name: `AI ${i + 1}`,
        token: selectedToken.token,
        model: selectedToken.model,
        isHuman: false,
        isAI: true,
        position: 0,
        money: 2500,
        isInJail: false,
        jailTurns: 0,
        properties: []
      };

      // Add walk model for female AI character
      if (selectedToken.token === 'WhiteGirlIdle') {
        aiPlayerData.walkModel = 'Models/WhiteGirlWalk/Walking.fbx';
      }

      gameState.players.push(aiPlayerData);
    }
  }

  gameState.gameStarted = true;

  // Start animation loop when game starts
  animateThreeJS();

  // Create the 3D board
  create3DBoard();

  // Load 3D token models onto the board
  loadPlayerTokens();

  // Hide lobby and show game UI
  lobbyOverlay.style.display = 'none';
  gameUI.style.display = 'flex';

  // Initialize UI panels
  updatePlayersList();
  
  // Show carousel
  showCarousel();
});

// Update players list in UI
function updatePlayersList() {
  if (!playersList) return;
  playersList.innerHTML = '';
  
  const tokenImages = {
    'RollsRoyce': 'tokenimages/rolls_royce.png',
    'Helicopter': 'tokenimages/helicopter.png',
    'TopHat': 'tokenimages/top_hat.png',
    'Shoe': 'tokenimages/shoe.png',
    'Cheeseburger': 'tokenimages/burger.png',
    'CoffeeCup': 'tokenimages/coffee.png',
    'Football': 'tokenimages/football.png',
    'WhiteGirlIdle': 'tokenimages/whitegirlmodel.png'
  };
  
  gameState.players.forEach((player, index) => {
    const isActive = index === gameState.currentPlayerIndex;
    const playerItem = document.createElement('div');
    playerItem.className = `player-item ${isActive ? 'player-item--active' : ''}`;
    
    const tokenImage = tokenImages[player.token] || '';
    
    playerItem.innerHTML = `
      <div class="player-info">
        <div class="player-name">${player.name}</div>
        <div class="player-money">$${player.money || 2500}</div>
      </div>
      ${tokenImage ? `<img src="${tokenImage}" class="player-token-img" alt="${player.token}" style="width: 32px; height: 32px; object-fit: contain;">` : `<div class="player-token">❓</div>`}
    `;
    
    playersList.appendChild(playerItem);
  });
}

// Update AI moves display
function addAIMove(playerName, action) {
  if (!aiMoves) return;
  const moveEntry = document.createElement('div');
  moveEntry.className = 'ai-move-entry';
  moveEntry.innerHTML = `
    <span class="ai-move-player">${playerName}</span>
    <span class="ai-move-action">${action}</span>
  `;
  aiMoves.appendChild(moveEntry);
  aiMoves.scrollTop = aiMoves.scrollHeight;
}

// Add chat message
function addChatMessage(sender, message) {
  if (!chatMessages) return;
  const chatMessage = document.createElement('div');
  chatMessage.className = 'chat-message';
  chatMessage.innerHTML = `
    <span class="chat-message-author">${sender}:</span>
    <span class="chat-message-text">${message}</span>
  `;
  chatMessages.appendChild(chatMessage);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Update properties list
function updatePropertiesList() {
  if (!myProperties) return;
  myProperties.innerHTML = '';
  
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  if (!currentPlayer || !currentPlayer.properties) return;
  
  currentPlayer.properties.forEach(propertyPosition => {
    const tile = boardConfig.find(t => t.position === propertyPosition);
    if (!tile) return;
    
    const propertyItem = document.createElement('div');
    propertyItem.className = 'property-item';
    propertyItem.innerHTML = `
      <div class="property-color" style="background: ${tile.color || '#888'};"></div>
      <div class="property-info">
        <div class="property-name">${tile.name}</div>
        <div class="property-rent">Rent: $${tile.rent && tile.rent.length > 0 ? tile.rent[0] : Math.floor(tile.price * 0.1)}</div>
      </div>
    `;
    myProperties.appendChild(propertyItem);
  });
}

// Update player money display
function updatePlayerMoney() {
  if (!playerMoney) return;
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  if (currentPlayer) {
    playerMoney.textContent = `$${currentPlayer.money || 2500}`;
  }
  
  // Check win/lose conditions
  checkGameEnd();
}

// Check if game should end (someone reached 10k or went bankrupt)
function checkGameEnd() {
  const winningAmount = 10000;
  
  for (const player of gameState.players) {
    // Check if player won
    if (player.money >= winningAmount) {
      showGameOver(player, true);
      return;
    }
    
    // Check if player went bankrupt
    if (player.money <= 0) {
      showGameOver(player, false);
      return;
    }
  }
}

// Show game over UI
function showGameOver(winner, playerWon) {
  gameState.gameStarted = false;
  
  const gameOverOverlay = document.createElement('div');
  gameOverOverlay.className = 'game-over-overlay';
  gameOverOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 5000;
  `;
  
  const player = gameState.players[gameState.currentPlayerIndex];
  const youWon = playerWon && winner.name === player.name;
  
  gameOverOverlay.innerHTML = `
    <div class="game-over-container" style="background: rgba(255, 255, 255, 0.05); border: 2px solid rgba(74, 158, 255, 0.3); border-radius: 24px; padding: 64px; max-width: 500px; text-align: center; backdrop-filter: blur(20px);">
      <h2 style="font-size: 3rem; font-weight: 800; margin-bottom: 16px; background: ${youWon ? 'linear-gradient(135deg, #3dd68c 0%, #00ff88 100%)' : 'linear-gradient(135deg, #ff6b6b 0%, #ff4444 100%)'}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
        ${youWon ? '🎉 YOU WIN!' : '💔 GAME OVER'}
      </h2>
      <p style="color: rgba(255, 255, 255, 0.8); font-size: 1.2rem; margin-bottom: 32px;">
        ${playerWon ? `${winner.name} reached $10,000!` : `${winner.name} went bankrupt!`}
      </p>
      <button id="restartBtn" style="padding: 16px 48px; background: linear-gradient(135deg, #4a9eff 0%, #667eea 100%); border: none; border-radius: 12px; color: white; font-size: 1.1rem; font-weight: 700; cursor: pointer;">
        Play Again
      </button>
    </div>
  `;
  
  document.body.appendChild(gameOverOverlay);
  
  document.getElementById('restartBtn').addEventListener('click', () => {
    location.reload();
  });
}

// Load 3D player tokens onto the board
function loadPlayerTokens() {
  gameState.players.forEach((player, index) => {
    loadPlayerToken(player, index);
  });
}

function loadPlayerToken(player, index) {
  const fileExtension = player.model.split('.').pop().toLowerCase();
  let loader;

  if (fileExtension === 'fbx') {
    loader = new THREE.FBXLoader();
  } else {
    loader = new THREE.GLTFLoader();
  }

  loader.load(
    player.model,
    (object) => {
      const tokenModel = fileExtension === 'fbx' ? object : object.scene;

      // Different scale for different tokens based on their native size
      if (player.token === 'WhiteGirlIdle') {
        tokenModel.scale.set(0.00005, 0.00005, 0.00005); // Original scale that was good
      } else if (player.token === 'Helicopter') {
        tokenModel.scale.set(0.002, 0.002, 0.002); // Smaller helicopter
      } else if (player.token === 'RollsRoyce') {
        tokenModel.scale.set(0.1, 0.1, 0.1); // Much larger Rolls Royce
      } else if (player.token === 'TopHat') {
        tokenModel.scale.set(0.1, 0.1, 0.1); // Much larger Top Hat
      } else if (player.token === 'Football') {
        tokenModel.scale.set(0.025, 0.025, 0.025); // Smaller Football
      } else if (player.token === 'Cheeseburger') {
        tokenModel.scale.set(0.5, 0.5, 0.5); // Larger Burger
      } else {
        tokenModel.scale.set(0.3, 0.3, 0.3); // For others (Shoe, Coffee)
      }

      // Position token at starting position (GO)
      const startPosition = getCellPosition(0);
      tokenModel.position.set(startPosition.x, 0.12, startPosition.z);
      
      // Rotate tokens to face the right direction
      if (player.token === 'WhiteGirlIdle') {
        tokenModel.rotation.y = Math.PI / 2; // Face forward (90 degrees)
      } else if (player.token === 'Shoe') {
        tokenModel.rotation.y = -Math.PI / 2; // Face right
        tokenModel.position.y = 0.2; // Raise a bit higher
      } else if (player.token === 'Football') {
        tokenModel.position.y = 0.2; // Raise a bit higher
      } else if (player.token === 'Helicopter') {
        tokenModel.rotation.y = -Math.PI / 2; // Face right
      } else if (player.token === 'Cheeseburger') {
        tokenModel.position.y = 0.2; // Raise a bit higher
      } else if (player.token === 'RollsRoyce') {
        tokenModel.rotation.y = -Math.PI / 2; // Face right
      }

      console.log(`Token ${player.token} positioned at:`, tokenModel.position.x, tokenModel.position.y, tokenModel.position.z);
      
      // Ensure materials are properly loaded for FBX models to fix wireframe issue
      if (fileExtension === 'fbx') {
        tokenModel.traverse((child) => {
          if (child.isMesh) {
            if (!child.material || Array.isArray(child.material)) {
              child.material = new THREE.MeshStandardMaterial({
                color: 0xffcccc,
                side: THREE.DoubleSide
              });
            }
          }
        });
      }

      // Add to board group
      board3DGroup.add(tokenModel);

      // Set up animation mixer for all models (both FBX and GLTF)
      let mixer = null;
      let animations = {};

      // Handle animations for all model types
      if (object.animations && object.animations.length > 0) {
        mixer = new THREE.AnimationMixer(tokenModel);
        
        object.animations.forEach((clip) => {
          // For female character, rename to Idle
          if (player.token === 'WhiteGirlIdle') {
            const idleClip = clip.clone();
            idleClip.name = 'Idle';
            animations['Idle'] = mixer.clipAction(idleClip);
          } else {
            // For other models, play all built-in animations (rotors, wheels, etc.)
            const action = mixer.clipAction(clip);
            action.play();
            animations[clip.name] = action;
          }
        });

        // For female character, play idle by default
        if (player.token === 'WhiteGirlIdle' && animations['Idle']) {
          animations['Idle'].play();
          animations['Idle'].timeScale = 1.0; // Normal speed for idle
        }
      } else {
        // Create empty mixer for models without animations
        mixer = new THREE.AnimationMixer(tokenModel);
      }

      // Store mixer and animations (even if empty)
      playerAnimations[index] = { mixer, animations, currentAction: 'idle' };

      playerTokenModels.push({
        model: tokenModel,
        playerIndex: index,
        position: 0,
        player: player
      });

      // Load walk model if available for female character
      if (player.walkModel) {
        loadWalkModel(player, index, tokenModel);
      }
    },
    undefined,
    (error) => {
      // Create fallback cube
      const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const material = new THREE.MeshStandardMaterial({ color: 0x7ab8c4 });
      const tokenModel = new THREE.Mesh(geometry, material);

      const startPosition = getCellPosition(0);
      tokenModel.position.set(startPosition.x, 0.5, startPosition.z);

      board3DGroup.add(tokenModel);
      playerTokenModels.push({
        model: tokenModel,
        playerIndex: index,
        position: 0
      });
    }
  );
}

function loadWalkModel(player, index, baseModel) {
  const loader = new THREE.FBXLoader();
  loader.load(
    player.walkModel,
    (object) => {
      const walkModel = object;

      // Store walk animations with different names to avoid conflict
      if (playerAnimations[index]) {
        walkModel.animations.forEach((clip) => {
          // Rename walk animation to avoid conflict with idle
          const walkClip = clip.clone();
          walkClip.name = 'Walk';
          const walkAction = playerAnimations[index].mixer.clipAction(walkClip, baseModel);
          walkAction.timeScale = 2.5; // Much faster walk animation
          playerAnimations[index].animations['Walk'] = walkAction;
        });
      }

      console.log(`Loaded walk model for ${player.name}`);
    },
    undefined,
    (error) => {
      console.error(`Error loading walk model for ${player.name}:`, error);
    }
  );
}

function switchAnimation(playerIndex, animationType) {
  const animData = playerAnimations[playerIndex];
  if (!animData || !animData.mixer) {
    console.log(`No animation data for player ${playerIndex}`);
    return;
  }

  const targetAction = animationType === 'walk' ? 'Walk' : 'Idle';
  
  // If already playing the same animation, don't reset it
  if (animData.currentAction === targetAction) {
    return;
  }

  // Find the action
  const newAction = animData.animations[targetAction];

  console.log(`Switching player ${playerIndex} to ${animationType}, action:`, newAction ? 'found' : 'NOT FOUND');

  if (newAction) {
    // Stop all other actions to prevent conflicts
    Object.keys(animData.animations).forEach(key => {
      if (key !== targetAction && animData.animations[key]) {
        animData.animations[key].stop();
      }
    });
    
    // Play the new action
    newAction.reset();
    newAction.play();
    animData.currentAction = targetAction;
  } else {
    // No animation found - that's okay, just update currentAction
    animData.currentAction = targetAction;
  }
}

// Get 3D position for a board cell
function getCellPosition(cellIndex) {
  const cell = boardCells.find(c => c.index === cellIndex % 40);
  if (cell) {
    return { x: cell.x, z: cell.z };
  }
  return { x: 0, z: 0 };
}

// Move player token to new position
function movePlayerToken(playerIndex, newPosition) {
  const tokenData = playerTokenModels.find(t => t.playerIndex === playerIndex);
  if (tokenData) {
    const position = getCellPosition(newPosition);
    tokenData.model.position.set(position.x, 0.12, position.z);
    tokenData.position = newPosition;
  }
}

// Animate player movement between cells (continuous smooth movement following board perimeter)
function animatePlayerMovement(playerIndex, oldPosition, newPosition, callback) {
  const tokenData = playerTokenModels.find(t => t.playerIndex === playerIndex);
  if (!tokenData) {
    console.log(`No token data for player ${playerIndex}`);
    if (callback) callback();
    return;
  }

  console.log(`Moving player ${playerIndex} from ${oldPosition} to ${newPosition}`);

  // Store original camera position
  const originalCameraPos = threeCamera.position.clone();
  const originalCameraLook = new THREE.Vector3(0, 0, 0);

  // Calculate number of steps (wrap around board)
  let steps = newPosition - oldPosition;
  if (steps < 0) steps += 40;
  
  console.log(`Steps to move: ${steps}`);
  
  // Build path following board perimeter
  const path = [];
  for (let i = 0; i <= steps; i++) {
    const cellIndex = (oldPosition + i) % 40;
    const pos = getCellPosition(cellIndex);
    path.push(pos);
    
    // Check if passed GO (when going from 39 to 0)
    if (cellIndex === 0 && i > 0) {
      const currentPlayer = gameState.players[playerIndex];
      currentPlayer.money += 200;
      console.log(`${currentPlayer.name} passed GO and collected $200`);
      updatePlayerMoney();
    }
  }
  
  const totalDuration = steps * 300; // 300ms per step for faster movement
  const startTime = Date.now();
  
  // Calculate initial direction
  const firstPos = path[0];
  const lastPos = path[path.length - 1];
  const dx = lastPos.x - firstPos.x;
  const dz = lastPos.z - firstPos.z;
  const angle = Math.atan2(dx, dz);
  tokenData.model.rotation.y = angle;
  
  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / totalDuration, 1);
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    
    // Calculate current position along path
    const totalDistance = steps;
    const currentDistance = easedProgress * totalDistance;
    const currentIndex = Math.floor(currentDistance);
    const nextIndex = Math.min(currentIndex + 1, path.length - 1);
    const segmentProgress = currentDistance - currentIndex;
    
    if (currentIndex < path.length - 1) {
      const currentPos = path[currentIndex];
      const nextPos = path[nextIndex];
      
      tokenData.model.position.x = currentPos.x + (nextPos.x - currentPos.x) * segmentProgress;
      tokenData.model.position.z = currentPos.z + (nextPos.z - currentPos.z) * segmentProgress;
      
      // Update rotation to face direction of movement
      const segDx = nextPos.x - currentPos.x;
      const segDz = nextPos.z - currentPos.z;
      if (Math.abs(segDx) > 0.01 || Math.abs(segDz) > 0.01) {
        tokenData.model.rotation.y = Math.atan2(segDx, segDz);
      }
      
      // Camera follows token (very close zoom - disable controls)
      orbitControls.enabled = false;
      threeCamera.position.set(tokenData.model.position.x, tokenData.model.position.y + 0.3, tokenData.model.position.z + 0.1);
      threeCamera.lookAt(tokenData.model.position);
    }
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Return camera to original position
      threeCamera.position.copy(originalCameraPos);
      threeCamera.lookAt(originalCameraLook);
      orbitControls.enabled = true;
      
      // Done - switch to idle
      const finalCell = boardCells.find(c => c.index === newPosition % 40);
      console.log(`Movement complete for player ${playerIndex}, landed on: ${finalCell ? finalCell.tile.name : 'unknown'}`);
      switchAnimation(playerIndex, 'idle');
      if (callback) callback();
    }
  }
  
  animate();
}

// ===== DICE ROLLING =====
rollDiceBtn.addEventListener('click', () => {
  if (!gameState.gameStarted) return;

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  
  // Don't allow rolling if AI's turn
  if (currentPlayer.isAI) {
    return;
  }
  
  // Don't allow rolling if in jail (must pay first)
  if (currentPlayer.isInJail) {
    return;
  }

  // Only use 3D dice
  if (diceLoaded) {
    roll3DDice();
  } else {
    console.log('Dice model not loaded yet');
  }
});

// ===== CAROUSEL SYSTEM =====
const baseImages = [
  'Images/1.png',
  'Images/screenshot_2024-12-12_033702.png',
  'Images/raidersimage.png',
  'Images/230613231941-04-knights-stanley-cup-061323.jpg',
  'Images/9b.jpg',
  'Images/HelicopterRidesNight.jpg',
  'Images/LVACES.jpg',
  'Images/LVTheater.jpg',
  'Images/LasVegasSphere.jpg',
  'Images/las_vegas_strip_map_blog.jpg',
  'Images/PIX-1-Exosphere-Architecture.jpg',
  'Images/ResortsWorldTheater.jpg',
  'Images/ShrinersChildrens-18-hole-2022.jpg',
  'Images/SpeedVegasOffroading.jpg',
  'Images/welcome_fabulous_las_vegas_sign.jpg',
  'Images/wynn_2_2.jpg',
  'Images/bellagio.jpg',
  'Images/cityracing.jpg',
  'Images/cosmopolitan.jpg',
  'Images/eater_vegas_large.jpg',
  'Images/hq720.jpg',
  'Images/santafecasino.jpg',
  'Images/themirage.jpg',
  'Images/thesphere.jpg',
  'Images/welcome_caesars_palace.jpg',
  'Images/01je2cjc09h0eq0z3pgh.webp',
  'Images/17509129_web1_INMATE-WHISPERER-FEB28-23__001-1.webp',
  'Images/11929141633_b4ab5fd45e_k.webp',
  'Images/Adele-Slams-Fan-Who-Yelled-Pride-Sucks-During-Concert-02.webp',
  'Images/BetMGM.jpg',
  'Images/las_vegas_motor_speedway.webp',
  'Images/tigetwoods.avif',
  'Images/minus_1x_1.webp',
  'Images/berry_1.webp',
  'Images/las_vegas_elopement_wedding_champagne_pop.webp',
  'Images/unnamed_1.png',
  'Images/helicopters.webp',
  'Images/house_of_blues_sunset.webp',
  'Images/yellow_light_bulb.jpg'
];

const casinoGameImages = [
  'Images/baccarat_photo.webp',
  'Images/poker_photo.jpg',
  'Images/poker_photo_2.jpg',
  'Images/roulette_photo.jpg',
  'Images/blackjack_photo.jpg'
];

// Images that are hotel/casino properties (need casino game images after them)
const hotelCasinoImages = [
  'Images/LasVegasSphere.jpg',
  'Images/Wynn_2_(2).jpg',
  'Images/bellagio.jpg',
  'Images/cosmopolitan.jpg',
  'Images/santafecasino.jpg',
  'Images/themirage.jpg',
  'Images/thesphere.jpg',
  'Images/welcome-to-caesars-palace.jpg'
];

let carouselImageList = [];
let currentCarouselIndex = 0;
let carouselPlane = null;
let carouselTexture = null;
let carouselInterval = null;
let isCarouselVisible = false;
let failedImages = new Set();
let nextTexture = null;
let textureLoader = null;

function encodeCarouselPath(path) {
  // Normalize path to start with /
  let normalizedPath = path.startsWith('/') ? path : '/' + path;
  
  // Split path and encode each segment except the first
  const segments = normalizedPath.split('/');
  const encodedSegments = segments.map((segment, index) => {
    return index === 0 ? segment : encodeURIComponent(segment);
  });
  
  return encodedSegments.join('/');
}

function buildCarouselImageList() {
  carouselImageList = [];
  let casinoImageIndex = 0;

  baseImages.forEach((image) => {
    carouselImageList.push(image);
    
    // Add casino game image after hotel/casino properties
    if (hotelCasinoImages.includes(image)) {
      carouselImageList.push(casinoGameImages[casinoImageIndex % casinoGameImages.length]);
      casinoImageIndex++;
    }
  });
}

function createCarouselPlane() {
  if (!threeScene) return;
  
  textureLoader = new THREE.TextureLoader();
  
  // Create plane geometry - fills center without touching property squares
  const geometry = new THREE.PlaneGeometry(6.5, 6.5);
  
  // Create initial material with placeholder
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff
  });
  
  carouselPlane = new THREE.Mesh(geometry, material);
  carouselPlane.rotation.x = -Math.PI / 2; // Flat on board
  carouselPlane.position.y = tileHeight / 2 + 0.02; // Just above board surface
  carouselPlane.visible = false;
  
  board3DGroup.add(carouselPlane);
  
  console.log('Carousel plane created');
}

function loadCarouselTexture(imagePath, callback) {
  const encodedPath = encodeCarouselPath(imagePath);
  const fullUrl = encodedPath; // Use local path
  
  textureLoader.load(
    fullUrl,
    (texture) => {
      texture.minFilter = THREE.NearestFilter;
      texture.magFilter = THREE.NearestFilter;
      callback(null, texture);
    },
    undefined,
    (error) => {
      callback(error, null);
    }
  );
}

function updateCarouselPlane() {
  if (!carouselPlane || !textureLoader) return;
  
  const imagePath = carouselImageList[currentCarouselIndex];
  
  loadCarouselTexture(imagePath, (error, texture) => {
    if (error) {
      console.log('Failed to load carousel image, skipping to next');
      failedImages.add(imagePath);
      currentCarouselIndex = (currentCarouselIndex + 1) % carouselImageList.length;
      updateCarouselPlane();
      return;
    }
    
    if (carouselTexture) {
      carouselTexture.dispose();
    }
    
    carouselTexture = texture;
    carouselPlane.material.map = carouselTexture;
    carouselPlane.material.needsUpdate = true;
    carouselPlane.visible = true;
    
    // Preload next image
    preloadNextCarouselImage();
  });
}

function preloadNextCarouselImage() {
  const nextIndex = (currentCarouselIndex + 1) % carouselImageList.length;
  const nextImagePath = carouselImageList[nextIndex];
  
  // Skip if already failed
  if (failedImages.has(nextImagePath)) {
    // Try the one after instead of recursing
    const afterNextIndex = (nextIndex + 1) % carouselImageList.length;
    const afterNextImagePath = carouselImageList[afterNextIndex];
    
    loadCarouselTexture(afterNextImagePath, (error, texture) => {
      if (!error && texture) {
        texture.anisotropy = 8;
        nextTexture = texture;
      }
    });
    return;
  }
  
  // Skip if it's a hotel/casino and current is also hotel/casino (prevent back-to-back)
  const currentIsHotelCasino = hotelCasinoImages.includes(carouselImageList[currentCarouselIndex]);
  const nextIsHotelCasino = hotelCasinoImages.includes(nextImagePath);
  if (currentIsHotelCasino && nextIsHotelCasino) {
    // Skip this image and try the one after instead of recursing
    const afterNextIndex = (nextIndex + 1) % carouselImageList.length;
    const afterNextImagePath = carouselImageList[afterNextIndex];
    
    loadCarouselTexture(afterNextImagePath, (error, texture) => {
      if (!error && texture) {
        texture.anisotropy = 8;
        nextTexture = texture;
      }
    });
    return;
  }
  
  loadCarouselTexture(nextImagePath, (error, texture) => {
    if (!error && texture) {
      texture.anisotropy = 8;
      nextTexture = texture;
    }
  });
}

function startCarouselAnimation() {
  stopCarouselAnimation();
  
  carouselInterval = setInterval(() => {
    currentCarouselIndex = (currentCarouselIndex + 1) % carouselImageList.length;
    
    // Skip failed images
    while (failedImages.has(carouselImageList[currentCarouselIndex])) {
      currentCarouselIndex = (currentCarouselIndex + 1) % carouselImageList.length;
    }
    
    updateCarouselPlane();
  }, 3000);
}

function stopCarouselAnimation() {
  if (carouselInterval) {
    clearInterval(carouselInterval);
    carouselInterval = null;
  }
}

function showCarousel() {
  if (carouselPlane) {
    carouselPlane.visible = true;
    isCarouselVisible = true;
    currentCarouselIndex = 0;
    updateCarouselPlane();
    startCarouselAnimation();
  }
}

function hideCarousel() {
  if (carouselPlane) {
    carouselPlane.visible = false;
    isCarouselVisible = false;
    stopCarouselAnimation();
  }
}

// Initialize carousel
buildCarouselImageList();

// ===== THREE.JS SETUP =====
let threeScene, threeCamera, threeRenderer, orbitControls;
let physicsWorld;
let diceModel1, diceBody1;
let diceModel2, diceBody2;
let diceLoaded = false;
let isRolling = false;
let playerTokenModels = [];
let board3DGroup; // Group to hold the 3D board
let boardCells = []; // Store cell positions for token placement

function initThreeJS() {
  console.log('Initializing Three.js...');

  // Scene (no background)
  threeScene = new THREE.Scene();

  // Camera - top-down view (zoomed in)
  threeCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  threeCamera.position.set(0, 7, 0);
  threeCamera.lookAt(0, 0, 0);

  // Renderer
  threeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  threeRenderer.setSize(window.innerWidth, window.innerHeight);
  threeRenderer.shadowMap.enabled = true;

  const container = document.getElementById('three-container');
  if (container) {
    container.appendChild(threeRenderer.domElement);
    console.log('Three.js renderer added to container');
  } else {
    console.error('Three.js container not found');
  }

  // Orbit controls - no rotation
  orbitControls = new THREE.OrbitControls(threeCamera, threeRenderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.05;
  orbitControls.enablePan = false;
  orbitControls.enableRotate = false;
  orbitControls.minDistance = 8;
  orbitControls.maxDistance = 20;
  orbitControls.target.set(0, 0, 0);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  threeScene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 5);
  directionalLight.castShadow = true;
  threeScene.add(directionalLight);

  const pointLight = new THREE.PointLight(0x4a9eff, 0.5, 20);
  pointLight.position.set(0, 5, 0);
  threeScene.add(pointLight);

  // Create board group
  board3DGroup = new THREE.Group();
  threeScene.add(board3DGroup);

  // Create the 3D board structure
  create3DBoard();

  // Create carousel plane
  createCarouselPlane();

  // Physics World
  physicsWorld = new CANNON.World();
  physicsWorld.gravity.set(0, -9.82, 0);
  physicsWorld.broadphase = new CANNON.NaiveBroadphase();
  physicsWorld.solver.iterations = 10;

  // Ground plane (invisible physics ground)
  const groundBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Plane(),
    material: new CANNON.Material({ friction: 0.3, restitution: 0.3 })
  });
  groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  physicsWorld.addBody(groundBody);

  // Load dice model
  loadDiceModel();

  // Don't start animation loop until game starts
  // animateThreeJS();

  // Handle window resize
  window.addEventListener('resize', onWindowResize);

  console.log('Three.js initialized');
}

const tileSize = 0.7;
const gap = 0.03;
const tileHeight = 0.12;
const step = 0.73;
let boardConfig = [];

function create3DBoard() {
  const boardSize = 11;

  // Calculate board dimensions to match tile positions
  const boardSpan = 10 * step; // 10 tiles across
  const boardActualSize = boardSpan + tileSize * 0.5; // Add slight margin

  // Board configuration
  boardConfig = [
    { name: 'GO', type: 'corner', position: 0, videos: [] },
    { name: 'Las Vegas Raiders', type: 'property', color: '#8B4513', price: 200, position: 1, videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/LVRaidersVid.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/LVRaiders%202.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/LVRaiders%203.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/LVRaiders%204.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/LVRaiders%205.mp4'], address: '3333 Al Davis Way, Las Vegas, NV 89118', rent: [38, 77, 220, 605, 825, 1045] },
    { name: 'Community Cards', type: 'community-chest', position: 2, videos: [] },
    { name: 'Las Vegas Grand Prix', type: 'property', color: '#8B4513', price: 180, position: 3, videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/LV%20Grand%20Prix.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/LV%20Grand%20Prix%20End.mp4'], address: '7000 Las Vegas Blvd N, Las Vegas, NV 89115', rent: [33, 66, 198, 550, 770, 990] },
    { name: 'Income Tax', type: 'tax', amount: 150, position: 4, videos: [], image: 'free_parking.jpg' },
    { name: 'Las Vegas Monorail', type: 'railroad', price: 250, position: 5, videos: ['Las Vegas Monorail1.mp4', 'Las Vegas Monorail2.mp4'], address: '2535 S Las Vegas Blvd, Las Vegas, NV 89109', rent: [28, 55, 110, 220] },
    { name: 'Speed Vegas Off Roading', type: 'property', color: '#87CEEB', price: 150, position: 6, videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Offroading%201.mp4'], address: '14200 S Las Vegas Blvd, Las Vegas, NV 89054', rent: [28, 55, 165, 495, 687, 825] },
    { name: 'Chance', type: 'chance', position: 7, videos: [] },
    { name: 'Las Vegas Golden Knights', type: 'property', color: '#87CEEB', price: 180, position: 8, videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/LV%20GKnights%201.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/LV%20GKnights%202.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/LV%20Golden%20Knights.mp4'], address: '3780 S Las Vegas Blvd, Las Vegas, NV 89158', rent: [31, 61, 181, 544, 770, 935] },
    { name: 'Maverick Helicopter Rides', type: 'property', color: '#87CEEB', price: 200, position: 9, videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/MavHeli%201.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/MavHeli%202.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/MavHeli%203.mp4'], address: '6075 S Las Vegas Blvd, Las Vegas, NV 89119', rent: [35, 71, 214, 638, 880, 1045] },
    { name: 'JAIL', type: 'corner', position: 10, videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Imgoingtojail.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Jailclip4.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Jailclip5.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/jailclip6.mp4_1743296163946.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Jailmoment2%28cropped%29.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/jailmoment3%28cropped%29.mp4'] },
    { name: 'Brothel', type: 'property', color: '#FF69B4', price: 120, position: 11, videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/BrothelVid.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Brothel2.webm', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Brothel3.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Brothel4.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/brothelVideo5.mp4'], address: 'Nevada Brothel', rent: [22, 44, 132, 396, 550, 660] },
    { name: 'Electric Company', type: 'utility', price: 100, position: 12, videos: [], image: 'electric_company.jpg', address: '', rent: [] },
    { name: 'Venetian', type: 'property', color: '#FF69B4', price: 150, position: 13, isCasino: true, casinoGame: 'baccarat', videos: [], address: '3355 S Las Vegas Blvd, Las Vegas, NV 89109', rent: [38, 77, 231, 693, 962, 1155] },
    { name: 'Las Vegas Monorail', type: 'railroad', price: 100, position: 14, videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Las%20Vegas%20Monorail1.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Las%20Vegas%20Monorail2.mp4'], address: '2535 S Las Vegas Blvd, Las Vegas, NV 89109', rent: [28, 55, 110, 220] },
    { name: 'Bellagio', type: 'property', color: '#FFA500', price: 160, position: 15, isCasino: true, casinoGame: 'blackjack', videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Cropped/Bellagio2.mp4'], address: '3600 S Las Vegas Blvd, Las Vegas, NV 89115', rent: [44, 88, 264, 792, 1100, 1320] },
    { name: 'Las Vegas Aces', type: 'property', color: '#FFA500', price: 100, position: 16, videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/WNBA.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/WNBAHL2.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/WNBAHL3.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/WNBAHL4.mp4'], address: '3950 S Las Vegas Blvd, Las Vegas, NV 89119', rent: [33, 66, 198, 594, 825, 990] },
    { name: 'Community Cards', type: 'community-chest', position: 17, videos: [] },
    { name: 'Santa Fe Hotel and Casino', type: 'property', color: '#FF0000', price: 120, position: 18, isCasino: true, casinoGame: 'poker', videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Santa%20Fe%20Hotel%20And%20Casino1.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Santa%20Fe%20Hotel%20And%20Casino2.mp4'], address: '4949 N Rancho Dr, Las Vegas, NV 89130', rent: [29, 57, 171, 514, 715, 858] },
    { name: 'Resorts World Theatre', type: 'property', color: '#FF0000', price: 150, position: 19, videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Resorts%20World%20Theatre1.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Resorts%20World%20Theatre2.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Resorts%20World%20Theatre3.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Resorts%20World%20Theatre4.mp4'], address: '3000 S Las Vegas Blvd, Las Vegas, NV 89109', rent: [38, 77, 231, 693, 962, 1155] },
    { name: 'FREE PARKING', type: 'corner', position: 20, videos: [] },
    { name: 'Hard Rock Hotel', type: 'property', color: '#FFFF00', price: 120, position: 21, isCasino: true, casinoGame: 'roulette', videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Hard%20Rock%20Hotel.mp4'], address: '3400 S Las Vegas Blvd, Las Vegas, NV 89109', rent: [34, 67, 201, 605, 840, 1008] },
    { name: 'Chance', type: 'chance', position: 22, videos: [] },
    { name: 'Shriners Children\'s Open', type: 'property', color: '#FFFF00', price: 140, position: 23, videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Shriners%201.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Shriners%203.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Shriners%204.mp4'], address: '1700 Village Center Circle Las Vegas NV 89134', rent: [35, 71, 214, 638, 880, 1045] },
    { name: 'County Fair', type: 'property', color: '#FFFF00', price: 130, position: 24, videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/KHAOS%20KMG%20Afterburner%20POV%20Clark%20county%20fair_35_45.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/YTDown.com_Shorts_CRAZY-carnival-ride-fun-exciting-statefa_Media_H-IcVGpmpwE_001_1080p.mp4'], address: '', rent: [33, 66, 198, 594, 825, 990] },
    { name: 'Las Vegas Little White Wedding Chapel', type: 'property', color: '#008000', price: 150, position: 25, videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Las%20Vegas%20Little%20White%20Wedding%20Chapel1.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Las%20Vegas%20Little%20White%20Wedding%20Chapel2.mp4'], address: '1301 Las Vegas Blvd S, Las Vegas, NV 89104', rent: [38, 77, 231, 693, 962, 1155] },
    { name: 'Community Cards', type: 'community-chest', position: 26, videos: [] },
    { name: 'Sphere', type: 'property', color: '#008000', price: 180, position: 27, videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Sphere.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Sphere1.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Sphere2.mp4'], address: '255 Sands Ave, Las Vegas, NV 89169', rent: [44, 88, 264, 792, 1100, 1320] },
    { name: 'Water Works', type: 'utility', price: 100, position: 28, videos: [], image: 'water_works.jpg', address: '', rent: [] },
    { name: 'Caesars Palace', type: 'property', color: '#0000FF', price: 180, position: 29, isCasino: true, casinoGame: 'blackjack', videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Caesars%20Palace1.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Caesars%20Palace3.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Caesars%20Palace4.mp4'], address: '3570 S Las Vegas Blvd, Las Vegas, NV 89109', rent: [46, 92, 277, 831, 1155, 1386] },
    { name: 'GO TO JAIL', type: 'corner', position: 30, videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Imgoingtojail.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Jailclip4.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Jailclip5.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/jailclip6.mp4_1743296163946.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Jailmoment2%28cropped%29.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/jailmoment3%28cropped%29.mp4'] },
    { name: 'Luxury Tax', type: 'tax', amount: 50, position: 31, videos: [], image: 'luxury_tax.jpg' },
    { name: 'Chance', type: 'chance', position: 32, videos: [] },
    { name: 'House of Blues', type: 'property', color: '#0000FF', price: 120, position: 33, videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/House%20Of%20Blues1.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/House%20Of%20Blues2.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/House%20Of%20Blues3.mp4'], address: '3950 S Las Vegas Blvd, Las Vegas, NV 89119', rent: [33, 66, 198, 594, 825, 990] },
    { name: 'Bet MGM', type: 'property', color: '#0000FF', price: 140, position: 34, videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/MGMBoxing%201.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/MGMBoxing%203.mp4'], address: '3799 S Las Vegas Blvd, Las Vegas, NV 89109', rent: [38, 77, 231, 693, 962, 1155] },
    { name: 'Wynn Las Vegas', type: 'property', color: '#4B0082', price: 150, position: 35, isCasino: true, casinoGame: 'roulette', videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Wynn%20Las%20Vegas1.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Wynn%20Las%20Vegas2.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Wynn%20Las%20Vegas3.mp4'], address: '3131 S Las Vegas Blvd, Las Vegas, NV 89109', rent: [38, 77, 231, 693, 962, 1155] },
    { name: 'The Cosmopolitan', type: 'property', color: '#4B0082', price: 120, position: 36, videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/The%20Cosmopolitan1.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/The%20Cosmopolitan2.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/The%20Cosmopolitan3.mp4'], address: '3708 S Las Vegas Blvd, Las Vegas, NV 89109', rent: [31, 61, 181, 544, 770, 935] },
    { name: 'Las Vegas Monorail', type: 'railroad', price: 100, position: 37, videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Las%20Vegas%20Monorail1.mp4', 'https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Las%20Vegas%20Monorail2.mp4'], address: '2535 S Las Vegas Blvd, Las Vegas, NV 89109', rent: [28, 55, 110, 220] },
    { name: 'Horseback Riding', type: 'property', color: '#4B0082', price: 100, position: 38, videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/horse6.mp4'], address: 'Red Rock Canyon National Conservation Area, Las Vegas, NV', rent: [29, 57, 171, 514, 715, 858] },
    { name: 'Speed Vegas Off Roading', type: 'property', color: '#4B0082', price: 110, position: 39, videos: ['https://pub-7e0044f8048c45d0a1c328e210708508.r2.dev/Videos/Offroading%201.mp4'], address: '14200 S Las Vegas Blvd, Las Vegas, NV 89054', rent: [31, 61, 181, 544, 770, 935] }
  ];

  // Board base - sized to match tile positions
  const boardBase = new THREE.Mesh(
    new THREE.BoxGeometry(boardActualSize, 0.025, boardActualSize),
    new THREE.MeshPhongMaterial({
      color: 0x0f0f0f,
      emissive: 0x1a1a1a,
      emissiveIntensity: 0.35,
      shininess: 60,
      specular: 0x1a3a5c
    })
  );
  boardBase.position.y = -0.012;
  board3DGroup.add(boardBase);

  // Glowing rim - sized to match board
  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(boardActualSize + 0.12, 0.012, boardActualSize + 0.12),
    new THREE.MeshBasicMaterial({
      color: 0x4a9eff,
      transparent: true,
      opacity: 0.35
    })
  );
  rim.position.y = 0.002;
  board3DGroup.add(rim);

  // Center pad - sized to match inner area
  const innerSpan = 9 * step - gap;
  const centerPad = new THREE.Mesh(
    new THREE.BoxGeometry(innerSpan * 0.98, 0.028, innerSpan * 0.98),
    new THREE.MeshPhongMaterial({
      color: 0x1a1f28,
      emissive: 0x243447,
      emissiveIntensity: 0.4,
      shininess: 70,
      specular: 0x4a9eff
    })
  );
  centerPad.position.y = tileHeight * 0.5;
  board3DGroup.add(centerPad);

  // Create tiles around perimeter
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      let position = null;

      if (row === 0) position = col;
      else if (row === 10) position = 20 + (10 - col);
      else if (col === 0) position = 30 + (10 - row);
      else if (col === 10) position = 10 + row;
      else continue;

      const spaceData = boardConfig[position];
      if (!spaceData) continue;

      const x = (col - 5) * step;
      const z = (row - 5) * step;
      const tile = createTile(spaceData, row, col);
      tile.position.set(x, tileHeight / 2, z);
      tile.rotation.y = getTileFacingRotationY(row, col);
      tile.userData.position = position;

      board3DGroup.add(tile);

      // Store cell position for tokens
      boardCells.push({
        index: position,
        x: x,
        z: z,
        tile: spaceData
      });
    }
  }
}

function createTile(spaceData, row, col) {
  const group = new THREE.Group();

  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(tileSize * 0.98, tileHeight, tileSize * 0.98),
    new THREE.MeshPhongMaterial({
      color: 0x0c1018,
      emissive: 0x050810,
      emissiveIntensity: 0.6,
      shininess: 95,
      specular: 0x5588bb
    })
  );
  group.add(slab);

  const tex = createMonopolyFaceTexture(spaceData, row, col);

  const faceMat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: true
  });
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(tileSize * 0.9, tileSize * 0.9),
    faceMat
  );
  face.rotation.x = -Math.PI / 2;
  face.position.y = tileHeight / 2 + 0.004;
  group.add(face);

  const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(tileSize * 0.99, tileHeight + 0.004, tileSize * 0.99));
  const edgeLines = new THREE.LineSegments(
    edgeGeo,
    new THREE.LineBasicMaterial({ color: 0x5aa8ff, transparent: true, opacity: 0.28 })
  );
  group.add(edgeLines);

  return group;
}

function getTileFacingRotationY(row, col) {
  if (row === 0) return 0;
  if (row === 10) return Math.PI;
  if (col === 0) return Math.PI / 2;
  if (col === 10) return -Math.PI / 2;
  return 0;
}

function createMonopolyFaceTexture(spaceData, row, col) {
  const W = 512;
  const H = 512;
  const pad = 10;
  const cornerR = 26;
  const stripThick = 64;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.translate(W, 0);
  ctx.scale(-1, 1);

  const inner = { x: pad + 4, y: pad + 4, w: W - (pad + 4) * 2, h: H - (pad + 4) * 2 };

  roundRectPath(ctx, pad, pad, W - pad * 2, H - pad * 2, cornerR);
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#161e2e');
  bg.addColorStop(0.45, '#0d1219');
  bg.addColorStop(1, '#1a2638');
  ctx.fillStyle = bg;
  ctx.fill();

  const c = stripAccentColor(spaceData);

  ctx.save();
  roundRectPath(ctx, pad, pad, W - pad * 2, H - pad * 2, cornerR);
  ctx.clip();

  const lg = ctx.createLinearGradient(0, inner.y, 0, inner.y + stripThick);
  lg.addColorStop(0, c);
  lg.addColorStop(1, hexToRgba(c, 0.55));
  ctx.fillStyle = lg;
  ctx.fillRect(inner.x, inner.y, inner.w, stripThick);
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, pad + 1, pad + 1, W - (pad + 1) * 2, H - (pad + 1) * 2, cornerR - 1);
  ctx.strokeStyle = 'rgba(74, 158, 255, 0.55)';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = 'rgba(74, 158, 255, 0.65)';
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, pad, pad, W - pad * 2, H - pad * 2, cornerR);
  ctx.clip();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (spaceData.type === 'chance') {
    ctx.fillStyle = '#f8fbff';
    ctx.font = '900 85px "Arial Black", "Impact", sans-serif';
    ctx.fillText('CHANCE', W / 2, H / 2 - 100);
    ctx.font = '900 220px "Arial Black", "Impact", sans-serif';
    ctx.fillStyle = '#ffc107';
    ctx.shadowColor = 'rgba(255, 193, 7, 0.45)';
    ctx.shadowBlur = 18;
    ctx.fillText('?', W / 2, H / 2 + 80);
  } else if (spaceData.type === 'community-chest') {
    ctx.fillStyle = '#f8fbff';
    ctx.font = '900 72px "Arial Black", "Impact", sans-serif';
    ctx.fillText('COMMUNITY', W / 2, H / 2 - 60);
    ctx.fillText('CHEST', W / 2, H / 2 + 45);
  } else {
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f5f8fc';
    ctx.font = '900 58px "Arial Black", "Impact", sans-serif';
    const displayName = spaceData.isCasino ? '★ ' + spaceData.name : spaceData.name;
    const bodyLines = wrapCanvasLines(ctx, displayName, inner.w - 15, 3);
    const sub = tileSubLabel(spaceData);
    const lineH = 62;
    const extra = sub ? 1 : 0;
    let ty = H / 2 - ((bodyLines.length + extra - 1) * lineH) / 2 + 12;
    bodyLines.forEach((ln) => {
      ctx.fillText(ln, W / 2, ty);
      ty += lineH;
    });
    if (sub) {
      ctx.font = '900 50px "Arial Black", "Impact", sans-serif';
      ctx.fillStyle = 'rgba(190, 210, 235, 0.95)';
      ctx.fillText(sub, W / 2, ty + 10);
    }
  }

  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  tex.flipY = false;
  tex.anisotropy = 8;
  return tex;
}

function stripAccentColor(spaceData) {
  if (spaceData.type === 'property' && spaceData.color) return spaceData.color;
  if (spaceData.type === 'railroad') return '#4a9eff';
  if (spaceData.type === 'utility') return '#95a5a6';
  if (spaceData.type === 'chance') return '#ffc107';
  if (spaceData.type === 'community-chest') return '#dc3545';
  if (spaceData.type === 'tax') return '#e74c3c';
  if (spaceData.type === 'corner') return '#4a9eff';
  return '#4a9eff';
}

function hexToRgba(hex, alpha) {
  const h = (hex || '#000000').replace('#', '');
  if (h.length !== 6) return `rgba(74, 158, 255, ${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function roundRectPath(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapCanvasLines(ctx, text, maxWidth, maxLines) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
      if (lines.length >= maxLines) break;
    }
  }
  lines.push(currentLine);
  return lines.slice(0, maxLines);
}

function tileSubLabel(spaceData) {
  if (spaceData.type === 'property') return spaceData.price ? `$${spaceData.price}` : '';
  if (spaceData.type === 'tax') return spaceData.amount ? `$${spaceData.amount}` : '';
  if (spaceData.type === 'railroad') return '$150';
  if (spaceData.type === 'utility') return '$100';
  return '';
}

function loadDiceModel() {
  console.log('Attempting to load dice model from: Models/Dice/dice.glb');

  const loader = new THREE.GLTFLoader();

  loader.load(
    'Models/Dice/dice.glb',
    (gltf) => {
      console.log('Dice model loaded successfully!', gltf);
      
      // Create two dice from the same model
      diceModel1 = gltf.scene.clone();
      diceModel1.scale.set(0.3, 0.3, 0.3);
      diceModel1.visible = false;
      board3DGroup.add(diceModel1);

      diceModel2 = gltf.scene.clone();
      diceModel2.scale.set(0.3, 0.3, 0.3);
      diceModel2.visible = false;
      board3DGroup.add(diceModel2);

      // Create physics bodies for both dice
      const diceShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
      
      diceBody1 = new CANNON.Body({
        mass: 1,
        shape: diceShape,
        material: new CANNON.Material({ friction: 0.5, restitution: 0.3 }),
        linearDamping: 0.5,
        angularDamping: 0.5
      });
      diceBody1.position.set(-0.5, 3, 0);
      physicsWorld.addBody(diceBody1);

      diceBody2 = new CANNON.Body({
        mass: 1,
        shape: diceShape,
        material: new CANNON.Material({ friction: 0.5, restitution: 0.3 }),
        linearDamping: 0.5,
        angularDamping: 0.5
      });
      diceBody2.position.set(0.5, 3, 0);
      physicsWorld.addBody(diceBody2);

      // Create invisible walls to keep dice from rolling off the board
      const wallThickness = 0.5;
      const wallHeight = 2;
      const wallDistance = 2.5; // Distance from center
      
      const wallShape = new CANNON.Box(new CANNON.Vec3(wallDistance + wallThickness, wallHeight, wallThickness));
      
      // North wall
      const northWall = new CANNON.Body({ mass: 0, shape: wallShape });
      northWall.position.set(0, 0, -wallDistance);
      physicsWorld.addBody(northWall);
      
      // South wall
      const southWall = new CANNON.Body({ mass: 0, shape: wallShape });
      southWall.position.set(0, 0, wallDistance);
      physicsWorld.addBody(southWall);
      
      // East wall
      const eastWall = new CANNON.Body({ mass: 0, shape: wallShape });
      eastWall.position.set(wallDistance, 0, 0);
      eastWall.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
      physicsWorld.addBody(eastWall);
      
      // West wall
      const westWall = new CANNON.Body({ mass: 0, shape: wallShape });
      westWall.position.set(-wallDistance, 0, 0);
      westWall.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
      physicsWorld.addBody(westWall);

      diceLoaded = true;
      console.log('Dice physics bodies created and models loaded');
    },
    (progress) => {
      if (progress.total > 0) {
        console.log('Loading dice model:', Math.round(progress.loaded / progress.total * 100) + '%');
      }
    },
    (error) => {
      console.error('Error loading dice model:', error);
      console.error('Error details:', error.message);
      // Try fallback with simple geometry
      createFallbackDice();
    }
  );
}

function createFallbackDice() {
  console.log('Creating fallback dice with simple geometry');
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
  
  // Create two dice
  diceModel1 = new THREE.Mesh(geometry, material);
  diceModel1.scale.set(0.3, 0.3, 0.3);
  diceModel1.visible = false;
  board3DGroup.add(diceModel1);

  diceModel2 = new THREE.Mesh(geometry, material);
  diceModel2.scale.set(0.3, 0.3, 0.3);
  diceModel2.visible = false;
  board3DGroup.add(diceModel2);

  // Create physics bodies for both dice
  const diceShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
  
  diceBody1 = new CANNON.Body({
    mass: 1,
    shape: diceShape,
    material: new CANNON.Material({ friction: 0.5, restitution: 0.3 }),
    linearDamping: 0.5,
    angularDamping: 0.5
  });
  diceBody1.position.set(-0.5, 3, 0);
  physicsWorld.addBody(diceBody1);

  diceBody2 = new CANNON.Body({
    mass: 1,
    shape: diceShape,
    material: new CANNON.Material({ friction: 0.5, restitution: 0.3 }),
    linearDamping: 0.5,
    angularDamping: 0.5
  });
  diceBody2.position.set(0.5, 3, 0);
  physicsWorld.addBody(diceBody2);

  // Create invisible walls to keep dice from rolling off the board
  const wallThickness = 0.5;
  const wallHeight = 2;
  const wallDistance = 2.5;
  
  const wallShape = new CANNON.Box(new CANNON.Vec3(wallDistance + wallThickness, wallHeight, wallThickness));
  
  const northWall = new CANNON.Body({ mass: 0, shape: wallShape });
  northWall.position.set(0, 0, -wallDistance);
  physicsWorld.addBody(northWall);
  
  const southWall = new CANNON.Body({ mass: 0, shape: wallShape });
  southWall.position.set(0, 0, wallDistance);
  physicsWorld.addBody(southWall);
  
  const eastWall = new CANNON.Body({ mass: 0, shape: wallShape });
  eastWall.position.set(wallDistance, 0, 0);
  eastWall.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
  physicsWorld.addBody(eastWall);
  
  const westWall = new CANNON.Body({ mass: 0, shape: wallShape });
  westWall.position.set(-wallDistance, 0, 0);
  westWall.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
  physicsWorld.addBody(westWall);

  diceLoaded = true;
  console.log('Fallback dice created');
}

function animateThreeJS() {
  requestAnimationFrame(animateThreeJS);

  // Update orbit controls
  if (orbitControls) {
    orbitControls.update();
  }

  // Update physics
  if (physicsWorld) {
    physicsWorld.step(1 / 60);
  }

  // Sync dice models with physics bodies
  if (diceModel1 && diceBody1 && diceLoaded) {
    diceModel1.position.copy(diceBody1.position);
    diceModel1.quaternion.copy(diceBody1.quaternion);
  }
  if (diceModel2 && diceBody2 && diceLoaded) {
    diceModel2.position.copy(diceBody2.position);
    diceModel2.quaternion.copy(diceBody2.quaternion);
  }

  // Update animation mixers
  Object.values(playerAnimations).forEach(animData => {
    if (animData.mixer) {
      animData.mixer.update(0.016); // ~60fps
    }
  });

  // Render
  threeRenderer.render(threeScene, threeCamera);
}

function onWindowResize() {
  threeCamera.aspect = window.innerWidth / window.innerHeight;
  threeCamera.updateProjectionMatrix();
  threeRenderer.setSize(window.innerWidth, window.innerHeight);
  if (orbitControls) {
    orbitControls.update();
  }
}

function roll3DDice() {
  if (!diceLoaded || isRolling) return;

  isRolling = true;
  diceModel1.visible = true;
  diceModel2.visible = true;

  // Reset dice positions above the board (closer to center and each other)
  diceBody1.position.set(-0.1, 3, 0);
  diceBody2.position.set(0.1, 3, 0);

  // Reset dice rotations with random starting orientations
  diceBody1.quaternion.setFromAxisAngle(new CANNON.Vec3(Math.random(), Math.random(), Math.random()), Math.random() * Math.PI * 2);
  diceBody2.quaternion.setFromAxisAngle(new CANNON.Vec3(Math.random(), Math.random(), Math.random()), Math.random() * Math.PI * 2);

  // Reset velocities
  diceBody1.angularVelocity.set(0, 0, 0);
  diceBody1.velocity.set(0, 0, 0);
  diceBody2.angularVelocity.set(0, 0, 0);
  diceBody2.velocity.set(0, 0, 0);

  // Wake up the bodies
  diceBody1.wakeUp();
  diceBody2.wakeUp();

  // Apply strong random rotation and velocity for dramatic effect
  setTimeout(() => {
    diceBody1.velocity.set(
      (Math.random() - 0.5) * 0.08,
      -5,
      (Math.random() - 0.5) * 0.08
    );

    diceBody2.angularVelocity.set(
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 30
    );
    diceBody2.velocity.set(
      (Math.random() - 0.5) * 0.08,
      -5,
      (Math.random() - 0.5) * 0.08
    );
  }, 100);

  // Wait for dice to settle, then hide them after a delay
  const checkSettled = setInterval(() => {
    const speed1 = diceBody1.velocity.length();
    const speed2 = diceBody2.velocity.length();
    const angularSpeed1 = diceBody1.angularVelocity.length();
    const angularSpeed2 = diceBody2.angularVelocity.length();

    // Check if both dice have settled (low velocity and angular velocity)
    if (speed1 < 0.1 && speed2 < 0.1 && angularSpeed1 < 0.5 && angularSpeed2 < 0.5) {
      clearInterval(checkSettled);
      
      console.log('Dice settled, processing results');
      
      // Wait 0.5 seconds after settling, then hide dice
      setTimeout(() => {
        isRolling = false;
        diceModel1.visible = false;
        diceModel2.visible = false;

        // Get dice results based on final rotation
        const diceResult1 = getDiceResult(diceBody1);
        const diceResult2 = getDiceResult(diceBody2);
        let totalDice = diceResult1 + diceResult2;

        // Bias dice toward casino squares (positions 13, 15, 18, 21, 29, 35)
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        
        if (!currentPlayer) {
          console.error('Current player is undefined! gameState:', gameState);
          return;
        }
        
        const casinoPositions = [13, 15, 18, 21, 29, 35];
        
        // Calculate what position we would land on with current roll
        const potentialPosition = (currentPlayer.position + totalDice) % 40;
        
        // 30% chance to reroll for casino if not already on one
        if (!casinoPositions.includes(potentialPosition) && Math.random() < 0.3) {
          // Find nearest casino position
          let nearestCasino = casinoPositions[0];
          let minDistance = 40;
          
          casinoPositions.forEach(casinoPos => {
            const distance = Math.abs(casinoPos - potentialPosition);
            if (distance < minDistance) {
              minDistance = distance;
              nearestCasino = casinoPos;
            }
          });
          
          // Calculate needed roll to reach casino
          let neededRoll = nearestCasino - potentialPosition;
          if (neededRoll < 0) neededRoll += 40;
          
          // If needed roll is between 2-12, use it
          if (neededRoll >= 2 && neededRoll <= 12) {
            totalDice = neededRoll;
          }
        }

        console.log('Dice results:', diceResult1, diceResult2, 'Total:', totalDice);

        // Move current player token
        // currentPlayer is already declared above
        
        // Check if player is in jail
        if (currentPlayer.isInJail) {
          // Player paid to get out, now move normally
          currentPlayer.isInJail = false;
          currentPlayer.jailTurns = 0;
          currentPlayer.money -= 50;
          
          const newPosition = (currentPlayer.position + totalDice) % 40;
          
          switchAnimation(gameState.currentPlayerIndex, 'walk');
          animatePlayerMovement(gameState.currentPlayerIndex, currentPlayer.position, newPosition, () => {
            currentPlayer.position = newPosition;
            console.log(`${currentPlayer.name} movement complete, position now: ${currentPlayer.position}`);
            handleLanding(currentPlayer, newPosition);
          });
        } else {
          const newPosition = (currentPlayer.position + totalDice) % 40;
          
          // Check for Go To Jail (position 30)
          if (newPosition === 30) {
            // Send to jail (position 10)
            switchAnimation(gameState.currentPlayerIndex, 'walk');
            animatePlayerMovement(gameState.currentPlayerIndex, currentPlayer.position, 10, () => {
              currentPlayer.position = 10;
              currentPlayer.isInJail = true;
              currentPlayer.jailTurns = 0;
              
              // Show jail UI
              showJailUI('You landed in jail!');
            });
          } else {
            // Normal movement
            switchAnimation(gameState.currentPlayerIndex, 'walk');
            animatePlayerMovement(gameState.currentPlayerIndex, currentPlayer.position, newPosition, () => {
              currentPlayer.position = newPosition;
              handleLanding(currentPlayer, newPosition);
            });
          }
        }
      }, 1000);
    }
  }, 100);

  // Fallback: hide after 8 seconds max
  setTimeout(() => {
    clearInterval(checkSettled);
    if (isRolling) {
      isRolling = false;
      diceModel1.visible = false;
      diceModel2.visible = false;
    }
  }, 8000);
}

function getDiceResult(diceBody) {
  // Face detection based on which local axis points up
  // Mapping from user's dice model:
  // - local +Y (top) = 1
  // - local -Y (bottom) = 6
  // - local +Z (front) = 4
  // - local -Z (back) = 3
  // - local +X (right) = 2
  // - local -X (left) = 5
  
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion(diceBody.quaternion.x, diceBody.quaternion.y, diceBody.quaternion.z, diceBody.quaternion.w);
  const localUp = up.clone().applyQuaternion(q.clone().invert());
  
  const lx = localUp.x;
  const ly = localUp.y;
  const lz = localUp.z;
  
  // Determine which face is pointing up based on local up vector
  if (ly > 0.9) return 1; // Top face (local +Y)
  if (ly < -0.9) return 6; // Bottom face (local -Y)
  if (lz > 0.9) return 4; // Front face (local +Z)
  if (lz < -0.9) return 3; // Back face (local -Z)
  if (lx > 0.9) return 2; // Right face (local +X)
  if (lx < -0.9) return 5; // Left face (local -X)
  
  // Fallback - use closest match
  const absLx = Math.abs(lx);
  const absLy = Math.abs(ly);
  const absLz = Math.abs(lz);
  const maxVal = Math.max(absLx, absLy, absLz);
  
  if (maxVal === absLy) return ly > 0 ? 1 : 6;
  if (maxVal === absLz) return lz > 0 ? 4 : 3;
  return lx > 0 ? 2 : 5;
}

// Handle landing on a square
function handleLanding(player, position) {
  // Get the tile configuration
  const tile = boardConfig.find(t => t.position === position);
  
  if (!tile) {
    endTurn();
    return;
  }
  
  // Position 10 is Jail - just visiting, end turn
  if (position === 10 && !player.isInJail) {
    console.log('Just visiting jail');
    if (player.isAI) {
      addAIMove(player.name, 'visited jail');
    }
    endTurn();
    return;
  }
  
  // Handle property tiles and railroads
  if (tile.type === 'property' || tile.type === 'railroad') {
    const owner = gameState.players.find(p => p.properties && p.properties.includes(position));
    
    if (!owner) {
      if (!player.isAI) {
        // If it's a casino property, launch game first, then show purchase UI
        if (tile.isCasino && tile.casinoGame) {
          launchCasinoGame(tile.casinoGame, tile);
        } else {
          showPropertyPurchaseUI(tile, player);
        }
      } else {
        addAIMove(player.name, `landed on ${tile.name}`);
        if (player.money >= tile.price) {
          player.money -= tile.price;
          player.properties.push(position);
          console.log(`AI ${player.name} bought ${tile.name} for $${tile.price}`);
          
          // If it's a casino property, AI plays the game
          if (tile.isCasino && tile.casinoGame) {
            const winAmount = Math.floor(Math.random() * 100) + 50; // Random win between 50-150
            player.money += winAmount;
            addAIMove(player.name, `bought ${tile.name} for $${tile.price}, won $${winAmount} at ${tile.casinoGame}`);
          } else {
            addAIMove(player.name, `bought ${tile.name} for $${tile.price}`);
          }
          updatePlayerMoney();
          updatePlayersList();
          updatePropertiesList();
          checkGameEnd();
        }
        endTurn();
      }
    } else if (owner !== player) {
      let rent;
      if (tile.rent && tile.rent.length > 0) {
        rent = tile.rent[0];
      } else {
        rent = Math.floor(tile.price * 0.1);
      }
      
      // If it's a casino property, launch game first, then pay rent
      if (tile.isCasino && tile.casinoGame && !player.isAI) {
        launchCasinoGame(tile.casinoGame, tile);
        // After game closes, pay rent (handled in closeCasinoBtn)
      } else {
        player.money -= rent;
        owner.money += rent;
        console.log(`${player.name} paid $${rent} rent to ${owner.name} for ${tile.name}`);
        
        if (player.isAI) {
          addAIMove(player.name, `paid $${rent} rent to ${owner.name} for ${tile.name}`);
        }
        
        updatePlayerMoney();
        updatePlayersList();
        checkGameEnd();
        endTurn();
      }
    } else {
      // Player owns the property - show UI
      if (tile.isCasino && tile.casinoGame) {
        if (!player.isAI) {
          launchCasinoGame(tile.casinoGame, tile);
        } else {
          // AI plays casino game
          const winAmount = Math.floor(Math.random() * 100) + 50;
          player.money += winAmount;
          addAIMove(player.name, `won $${winAmount} at ${tile.casinoGame}`);
          updatePlayerMoney();
          checkGameEnd();
          endTurn();
        }
      } else {
        if (!player.isAI) {
          showOwnedPropertyUI(tile);
        } else {
          addAIMove(player.name, `landed on ${tile.name} (owned)`);
          endTurn();
        }
      }
    }
  } else if (tile.type === 'utility') {
    const owner = gameState.players.find(p => p.properties && p.properties.includes(position));
    
    if (!owner) {
      if (!player.isAI) {
        showPropertyPurchaseUI(tile, player);
      } else {
        addAIMove(player.name, `landed on ${tile.name}`);
        if (player.money >= tile.price) {
          player.money -= tile.price;
          player.properties.push(position);
          console.log(`AI ${player.name} bought ${tile.name} for $${tile.price}`);
          addAIMove(player.name, `bought ${tile.name} for $${tile.price}`);
          updatePlayerMoney();
          updatePlayersList();
          updatePropertiesList();
          checkGameEnd();
        }
        endTurn();
      }
    } else if (owner !== player) {
      const rent = Math.floor(tile.price * 0.1);
      player.money -= rent;
      owner.money += rent;
      console.log(`${player.name} paid $${rent} rent to ${owner.name} for ${tile.name}`);
      
      if (player.isAI) {
        addAIMove(player.name, `paid $${rent} rent to ${owner.name} for ${tile.name}`);
      }
      
      updatePlayerMoney();
      checkGameEnd();
      endTurn();
    } else {
      if (player.isAI) {
        addAIMove(player.name, `landed on ${tile.name} (owned)`);
        endTurn();
      } else {
        endTurn();
      }
    }
  } else if (tile.type === 'tax') {
    if (!player.isAI) {
      showTaxUI(tile, player);
    } else {
      player.money -= tile.amount;
      console.log(`${player.name} paid $${tile.amount}`);
      updatePlayerMoney();
      checkGameEnd();
      endTurn();
    }
  } else if (tile.type === 'chance' || tile.type === 'community-chest') {
    // Show chance/community card UI
    if (!player.isAI) {
      showCardUI(tile);
    } else {
      // AI automatically accepts
      console.log(`AI ${player.name} drew a ${tile.type} card`);
      addAIMove(player.name, `landed on ${tile.type === 'chance' ? 'Chance' : 'Community Chest'}`);
      endTurn();
    }
  } else {
    // Other tile types (corners)
    endTurn();
  }
}

// Show chance/community card UI
function showCardUI(tile) {
  document.getElementById('cardTitle').textContent = tile.type === 'chance' ? 'Chance' : 'Community Chest';
  document.getElementById('cardMessage').textContent = 'You drew a card!';
  document.getElementById('cardOverlay').style.display = 'flex';
}

// Show jail UI with video
function showJailUI(message) {
  document.getElementById('jailMessage').textContent = message;
  
  // Load and play random jail video
  const jailVideo = document.getElementById('jailVideo');
  const jailTile = boardConfig.find(t => t.position === 10);
  if (jailTile && jailTile.videos && jailTile.videos.length > 0) {
    const randomVideo = jailTile.videos[Math.floor(Math.random() * jailTile.videos.length)];
    jailVideo.src = randomVideo;
    jailVideo.load();
    jailVideo.play().catch(e => console.log('Video play error:', e));
    
    // Stop video and audio when it ends
    jailVideo.onended = function() {
      jailVideo.pause();
      jailVideo.currentTime = 0;
    };
  } else {
    jailVideo.src = '';
  }
  
  document.getElementById('jailOverlay').style.display = 'flex';
}

// Show tax/utility UI
function showTaxUI(tile, player) {
  document.getElementById('taxTitle').textContent = tile.name;
  
  let amount;
  if (tile.type === 'tax') {
    amount = tile.amount;
  } else if (tile.type === 'utility') {
    amount = Math.floor(tile.price * 0.1);
  }
  
  document.getElementById('taxMessage').textContent = `Pay $${amount}`;
  
  // Show image if available
  const taxImageContainer = document.getElementById('taxImageContainer');
  const taxImage = document.getElementById('taxImage');
  if (tile.image) {
    taxImage.src = `Images/${tile.image}`;
    taxImageContainer.classList.add('has-image');
  } else {
    taxImageContainer.classList.remove('has-image');
  }
  
  document.getElementById('taxOverlay').style.display = 'flex';
  
  // Store for button handler
  window.currentTaxTile = tile;
  window.currentTaxPlayer = player;
}

// Tax OK button handler
document.getElementById('taxOkBtn').addEventListener('click', () => {
  const tile = window.currentTaxTile;
  const player = window.currentTaxPlayer;
  
  if (tile && player) {
    let amount;
    if (tile.type === 'tax') {
      amount = tile.amount;
    } else if (tile.type === 'utility') {
      amount = Math.floor(tile.price * 0.1);
    }
    player.money -= amount;
    console.log(`${player.name} paid $${amount}`);
    updatePlayerMoney();
    updatePlayersList();
    checkGameEnd();
  }
  
  document.getElementById('taxOverlay').style.display = 'none';
  endTurn();
});

// Launch casino game
function launchCasinoGame(gameType, tile) {
  console.log(`Launching ${gameType} game for ${tile.name}`);
  
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const owner = gameState.players.find(p => p.properties && p.properties.includes(tile.position));
  
  // Create casino game overlay
  const casinoOverlay = document.createElement('div');
  casinoOverlay.className = 'casino-overlay';
  casinoOverlay.id = 'casinoOverlay';
  casinoOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 3000;
  `;
  
  const gamePaths = {
    'baccarat': 'Baccarat/baccarat-display.html',
    'blackjack': 'Blackjack/blackjack.html',
    'poker': 'PokerFP/poker.html',
    'roulette': 'Roulette/roulette.html'
  };
  
  const gamePath = gamePaths[gameType] || gamePaths['blackjack'];
  
  casinoOverlay.innerHTML = `
    <div class="casino-container" style="width: 90%; height: 90%; max-width: 1200px; position: relative;">
      <button id="closeCasinoBtn" style="position: absolute; top: 10px; right: 10px; z-index: 10; padding: 10px 20px; background: #4a9eff; border: none; border-radius: 8px; color: white; cursor: pointer; font-size: 14px;">Close</button>
      <iframe id="casinoFrame" src="${gamePath}" style="width: 100%; height: 100%; border: none; border-radius: 12px;"></iframe>
    </div>
  `;
  
  document.body.appendChild(casinoOverlay);
  
  // Wait for iframe to load, then initialize the game
  const iframe = document.getElementById('casinoFrame');
  iframe.onload = () => {
    try {
      const iframeWindow = iframe.contentWindow;
      
      // Initialize the minigame with player's balance
      if (iframeWindow.initBaccaratMinigame) {
        iframeWindow.initBaccaratMinigame(document.getElementById('casinoFrame'), currentPlayer.money, (newBalance) => {
          currentPlayer.money = newBalance;
          updatePlayerMoney();
          checkGameEnd();
          console.log(`Balance updated to: $${newBalance}`);
        });
      } else if (iframeWindow.initBlackjack) {
        iframeWindow.initBlackjack(currentPlayer.money, (newBalance) => {
          currentPlayer.money = newBalance;
          updatePlayerMoney();
          checkGameEnd();
          console.log(`Balance updated to: $${newBalance}`);
        });
      } else if (iframeWindow.initRoulette) {
        iframeWindow.initRoulette(currentPlayer.money, (newBalance) => {
          currentPlayer.money = newBalance;
          updatePlayerMoney();
          checkGameEnd();
          console.log(`Balance updated to: $${newBalance}`);
        });
      } else if (iframeWindow.initPoker) {
        iframeWindow.initPoker(currentPlayer.money, (newBalance) => {
          currentPlayer.money = newBalance;
          updatePlayerMoney();
          checkGameEnd();
          console.log(`Balance updated to: $${newBalance}`);
        });
      }
    } catch (e) {
      console.log('Error initializing casino game:', e);
    }
  };
  
  // Close button handler
  document.getElementById('closeCasinoBtn').addEventListener('click', () => {
    document.body.removeChild(casinoOverlay);
    
    // After casino game, handle the rest of the flow
    if (!owner) {
      // Property is unowned - show purchase UI
      showPropertyPurchaseUI(tile, currentPlayer);
    } else if (owner !== currentPlayer) {
      // Property is owned by someone else - pay rent
      let rent;
      if (tile.rent && tile.rent.length > 0) {
        rent = tile.rent[0];
      } else {
        rent = Math.floor(tile.price * 0.1);
      }
      currentPlayer.money -= rent;
      owner.money += rent;
      console.log(`${currentPlayer.name} paid $${rent} rent to ${owner.name} for ${tile.name}`);
      updatePlayerMoney();
      checkGameEnd();
      endTurn();
    } else {
      // Player owns the property
      showOwnedPropertyUI(tile);
    }
  });
}

// Card OK button handler
document.getElementById('cardOkBtn').addEventListener('click', () => {
  document.getElementById('cardOverlay').style.display = 'none';
  endTurn();
});

// Show owned property UI
function showOwnedPropertyUI(tile) {
  document.getElementById('propertyTitle').textContent = tile.name;
  document.getElementById('propertyAddress').textContent = tile.address || '';
  document.getElementById('propertyPrice').textContent = 'OWNED';
  document.getElementById('propertyRentValue').textContent = 'You own this property';
  
  // Load and play random video
  const propertyVideo = document.getElementById('propertyVideo');
  if (tile.videos && tile.videos.length > 0) {
    const randomVideo = tile.videos[Math.floor(Math.random() * tile.videos.length)];
    propertyVideo.src = randomVideo;
    propertyVideo.load();
    propertyVideo.play().catch(e => {
      console.log('Video play error:', e);
      const nextIndex = (tile.videos.indexOf(randomVideo) + 1) % tile.videos.length;
      propertyVideo.src = tile.videos[nextIndex];
      propertyVideo.load();
      propertyVideo.play().catch(e2 => console.log('Second video also failed:', e2));
    });
    
    // Stop video and audio when it ends
    propertyVideo.onended = function() {
      propertyVideo.pause();
      propertyVideo.currentTime = 0;
    };
  } else {
    propertyVideo.src = '';
  }
  
  // Change button to just OK
  document.getElementById('propertyBuyBtn').style.display = 'none';
  document.getElementById('propertyPassBtn').textContent = 'OK';
  document.getElementById('propertyPassBtn').onclick = () => {
    document.getElementById('propertyOverlay').style.display = 'none';
    // Reset buttons
    document.getElementById('propertyBuyBtn').style.display = 'inline-block';
    document.getElementById('propertyPassBtn').textContent = 'Pass';
    document.getElementById('propertyPassBtn').onclick = null;
    endTurn();
  };
  
  document.getElementById('propertyOverlay').style.display = 'flex';
}

// Show property purchase UI
function showPropertyPurchaseUI(tile, player) {
  document.getElementById('propertyTitle').textContent = tile.name;
  document.getElementById('propertyAddress').textContent = tile.address || '';
  document.getElementById('propertyPrice').textContent = `$${tile.price}`;
  
  // Display base rent (first value in array)
  let rent = 0;
  if (tile.rent && tile.rent.length > 0) {
    rent = tile.rent[0];
  } else {
    rent = Math.floor(tile.price * 0.1);
  }
  document.getElementById('propertyRentValue').textContent = `$${rent}`;
  
  // Load and play random video
  const propertyVideo = document.getElementById('propertyVideo');
  if (tile.videos && tile.videos.length > 0) {
    const randomVideo = tile.videos[Math.floor(Math.random() * tile.videos.length)];
    propertyVideo.src = randomVideo;
    propertyVideo.load();
    propertyVideo.play().catch(e => {
      console.log('Video play error:', e);
      // Try the next video if the first one fails
      const nextIndex = (tile.videos.indexOf(randomVideo) + 1) % tile.videos.length;
      propertyVideo.src = tile.videos[nextIndex];
      propertyVideo.load();
      propertyVideo.play().catch(e2 => console.log('Second video also failed:', e2));
    });
    
    // Stop video and audio when it ends
    propertyVideo.onended = function() {
      propertyVideo.pause();
      propertyVideo.currentTime = 0;
    };
  } else {
    propertyVideo.src = '';
  }
  
  document.getElementById('propertyOverlay').style.display = 'flex';
  
  // Store current tile and player for button handlers
  window.currentPropertyTile = tile;
  window.currentPropertyPlayer = player;
}

// Property purchase button handlers
document.getElementById('propertyBuyBtn').addEventListener('click', () => {
  const tile = window.currentPropertyTile;
  const player = window.currentPropertyPlayer;
  
  // Stop video before closing overlay
  const propertyVideo = document.getElementById('propertyVideo');
  propertyVideo.pause();
  propertyVideo.currentTime = 0;
  
  if (tile && player && player.money >= tile.price) {
    player.money -= tile.price;
    player.properties.push(tile.position);
    console.log(`${player.name} bought ${tile.name} for $${tile.price}`);
    updatePlayerMoney();
    updatePlayersList();
    updatePropertiesList();
    checkGameEnd();
  }
  
  document.getElementById('propertyOverlay').style.display = 'none';
  endTurn();
});

document.getElementById('propertyPassBtn').addEventListener('click', () => {
  // Stop video before closing overlay
  const propertyVideo = document.getElementById('propertyVideo');
  propertyVideo.pause();
  propertyVideo.currentTime = 0;
  
  document.getElementById('propertyOverlay').style.display = 'none';
  endTurn();
});

// End current turn and move to next player
function endTurn() {
  // Move to next player
  gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
  
  // Update UI for new player
  updatePlayersList();
  updatePlayerMoney();
  
  // If next player is AI, auto-roll
  const nextPlayer = gameState.players[gameState.currentPlayerIndex];
  if (nextPlayer && nextPlayer.isAI) {
    console.log(`Next player is AI: ${nextPlayer.name}, will roll in 2 seconds`);
    setTimeout(() => {
      console.log(`AI ${nextPlayer.name} attempting to roll - diceLoaded: ${diceLoaded}, isRolling: ${isRolling}`);
      if (diceLoaded && !isRolling) {
        roll3DDice();
      } else {
        console.log('Dice not ready yet, retrying in 1 second...');
        setTimeout(() => {
          if (diceLoaded && !isRolling) {
            roll3DDice();
          } else {
            console.log('Dice still not ready, forcing roll anyway');
            roll3DDice();
          }
        }, 1000);
      }
    }, 2000);
  } else if (nextPlayer && nextPlayer.isInJail) {
    // Show jail pay UI for human player in jail
    document.getElementById('jailPayOverlay').style.display = 'flex';
  }
}

// Initialize Three.js when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initThreeJS();
  
  // Jail UI handlers
  document.getElementById('jailProceedBtn').addEventListener('click', () => {
    document.getElementById('jailOverlay').style.display = 'none';
    endTurn();
  });

  document.getElementById('jailPayBtn').addEventListener('click', () => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.money >= 50) {
      document.getElementById('jailPayOverlay').style.display = 'none';
      // Player pays and rolls dice
      currentPlayer.money -= 50;
      updatePlayerMoney();
      checkGameEnd();
      roll3DDice();
    }
  });
});

// ===== UI EVENT LISTENERS =====

// Chat functionality
if (sendChatBtn && chatInput) {
  sendChatBtn.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (message) {
      addChatMessage('You', message);
      chatInput.value = '';
    }
  });

  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendChatBtn.click();
    }
  });
}

// Video chat buttons (placeholder)
const startVideoCall = document.getElementById('startVideoCall');
const endVideoCall = document.getElementById('endVideoCall');
const connectionStatus = document.getElementById('connectionStatus');

if (startVideoCall) {
  startVideoCall.addEventListener('click', () => {
    if (connectionStatus) {
      connectionStatus.textContent = 'Connecting...';
    }
    // Placeholder for actual WebRTC implementation
    setTimeout(() => {
      if (connectionStatus) {
        connectionStatus.textContent = 'Connected';
      }
      if (startVideoCall) startVideoCall.style.display = 'none';
      if (endVideoCall) endVideoCall.style.display = 'block';
    }, 2000);
  });
}

if (endVideoCall) {
  endVideoCall.addEventListener('click', () => {
    if (connectionStatus) {
      connectionStatus.textContent = 'Not connected';
    }
    if (startVideoCall) startVideoCall.style.display = 'block';
    if (endVideoCall) endVideoCall.style.display = 'none';
  });
}

// End turn button
if (endTurnBtn) {
  endTurnBtn.addEventListener('click', () => {
    // Placeholder for end turn logic
    gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    updatePlayersList();
    updatePlayerMoney();
  });
}

// ===== INITIALIZE =====
