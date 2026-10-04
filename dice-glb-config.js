// Dice configuration for procedural dice
// Material order (same as main game): right(+x)=2, left(-x)=5, top(+y)=1, bottom(-y)=6, front(+z)=4, back(-z)=3
const DICE_GLB_CONFIG = {
  scale: 0.45,
  separation: 3.0
};

// Helper functions for dice animation
function getDiceLandY() {
  return 0;
}

function getDiceRollDurationMs() {
  return 2000;
}

function applyDiceFace(diceMesh, value) {
  // Apply rotation to show the desired face
  // Material order (same as main game): right(+x)=2, left(-x)=5, top(+y)=1, bottom(-y)=6, front(+z)=4, back(-z)=3
  const faceRotations = {
    1: { x: Math.PI / 2, y: 0, z: 0 },        // Top side (+y) faces forward
    2: { x: 0, y: -Math.PI / 2, z: 0 },      // Right side (+x) faces forward
    3: { x: 0, y: Math.PI, z: 0 },             // Back side (-z) faces forward
    4: { x: 0, y: 0, z: 0 },                   // Front side (+z) faces forward
    5: { x: -Math.PI / 2, y: 0, z: 0 },       // Bottom side (-y) faces forward
    6: { x: 0, y: Math.PI / 2, z: 0 }         // Left side (-x) faces forward
  };

  const rotation = faceRotations[value] || faceRotations[1];
  diceMesh.rotation.x = rotation.x;
  diceMesh.rotation.y = rotation.y;
  diceMesh.rotation.z = rotation.z;
}

function runDiceRollAnimation({ meshes, values, duration, anchor, onComplete }) {
  const startTime = performance.now();
  const sep = DICE_GLB_CONFIG.separation * 0.5;
  const landY = getDiceLandY();
  const dropHeight = 8; // Start even higher like main game
  
  // Store initial positions and set starting high position
  const initialPositions = meshes.map((mesh, i) => {
    const separation = DICE_GLB_CONFIG.separation || 2.0;
    mesh.position.x = (i === 0 ? -separation / 2 : separation / 2);
    mesh.position.y = dropHeight;
    mesh.position.z = 0;
    return mesh.position.clone();
  });
  
  const targetRotations = values.map(value => {
    // Material order (same as main game): right(+x)=2, left(-x)=5, top(+y)=1, bottom(-y)=6, front(+z)=4, back(-z)=3
    const faceRotations = {
      1: { x: Math.PI / 2, y: 0, z: 0 },        // Top side (+y) faces forward
      2: { x: 0, y: -Math.PI / 2, z: 0 },      // Right side (+x) faces forward
      3: { x: 0, y: Math.PI, z: 0 },             // Back side (-z) faces forward
      4: { x: 0, y: 0, z: 0 },                   // Front side (+z) faces forward
      5: { x: -Math.PI / 2, y: 0, z: 0 },       // Bottom side (-y) faces forward
      6: { x: 0, y: Math.PI / 2, z: 0 }         // Left side (-x) faces forward
    };
    return faceRotations[value] || faceRotations[1];
  });
  
  // Set random initial rotations for dramatic effect
  meshes.forEach(mesh => {
    mesh.rotation.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );
  });
  
  // Track angular velocities for rolling effect (much slower for natural rolling)
  const angularVelocities = meshes.map(() => ({
    x: (Math.random() - 0.5) * 2,
    y: (Math.random() - 0.5) * 2,
    z: (Math.random() - 0.5) * 2
  }));
  
  return function(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    meshes.forEach((mesh, i) => {
      // Dramatic drop with bouncing and rolling (like main game physics)
      let currentY;
      let isRolling = false;
      
      if (progress < 0.25) {
        // Fast drop phase (like main game velocity: -15)
        const dropProgress = progress / 0.25;
        currentY = dropHeight - (dropHeight - landY - 0.5) * dropProgress;
        
        // Maintain natural spinning during drop
        mesh.rotation.x += angularVelocities[i].x * 0.05;
        mesh.rotation.y += angularVelocities[i].y * 0.05;
        mesh.rotation.z += angularVelocities[i].z * 0.05;
      } else if (progress < 0.6) {
        // Bounce and roll phase
        const bounceProgress = (progress - 0.25) / 0.35;
        const bounceHeight = 2.0 * Math.sin(bounceProgress * Math.PI * 2) * (1 - bounceProgress);
        currentY = landY + 0.5 + bounceHeight;
        isRolling = true;
        
        // Rolling motion - tumble on the ground
        mesh.rotation.x += angularVelocities[i].x * 0.02;
        mesh.rotation.y += angularVelocities[i].y * 0.02;
        mesh.rotation.z += angularVelocities[i].z * 0.02;
        
        // Add some horizontal movement for rolling effect
        mesh.position.x += Math.sin(elapsed * 0.01) * 0.02;
        mesh.position.z += Math.cos(elapsed * 0.01) * 0.02;
      } else {
        // Settling phase - slow down and interpolate to target
        const settleProgress = (progress - 0.6) / 0.4;
        const bounceHeight = 0.3 * Math.sin(settleProgress * Math.PI) * (1 - settleProgress);
        currentY = landY + 0.5 + bounceHeight;
        
        // Gradually slow down rotation
        const slowDown = 1 - settleProgress;
        mesh.rotation.x += angularVelocities[i].x * 0.02 * slowDown;
        mesh.rotation.y += angularVelocities[i].y * 0.02 * slowDown;
        mesh.rotation.z += angularVelocities[i].z * 0.02 * slowDown;
        
        // Interpolate to target rotation
        const target = targetRotations[i];
        mesh.rotation.x = mesh.rotation.x + (target.x - mesh.rotation.x) * settleProgress * 0.3;
        mesh.rotation.y = mesh.rotation.y + (target.y - mesh.rotation.y) * settleProgress * 0.3;
        mesh.rotation.z = mesh.rotation.z + (target.z - mesh.rotation.z) * settleProgress * 0.3;
      }
      
      mesh.position.y = currentY;
    });
    
    if (progress >= 1) {
      // Ensure final positions are correct
      meshes.forEach((mesh, i) => {
        mesh.position.y = landY + 0.5;
        mesh.position.x = (i === 0 ? -sep : sep);
        mesh.position.z = 0;
        const target = targetRotations[i];
        mesh.rotation.x = target.x;
        mesh.rotation.y = target.y;
        mesh.rotation.z = target.z;
      });
      
      if (onComplete) onComplete();
      return false; // Animation complete
    }
    
    return true; // Continue animation
  };
}
