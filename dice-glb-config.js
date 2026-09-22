// Dice configuration for procedural dice
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
  const faceRotations = {
    1: { x: 0, y: 0, z: 0 },
    2: { x: 0, y: -Math.PI / 2, z: 0 },
    3: { x: 0, y: 0, z: -Math.PI / 2 },
    4: { x: 0, y: 0, z: Math.PI / 2 },
    5: { x: 0, y: Math.PI / 2, z: 0 },
    6: { x: Math.PI, y: 0, z: 0 }
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
  
  // Store initial positions
  const initialPositions = meshes.map(mesh => mesh.position.clone());
  const targetRotations = values.map(value => {
    const faceRotations = {
      1: { x: 0, y: 0, z: 0 },
      2: { x: 0, y: -Math.PI / 2, z: 0 },
      3: { x: 0, y: 0, z: -Math.PI / 2 },
      4: { x: 0, y: 0, z: Math.PI / 2 },
      5: { x: 0, y: Math.PI / 2, z: 0 },
      6: { x: Math.PI, y: 0, z: 0 }
    };
    return faceRotations[value] || faceRotations[1];
  });
  
  return function(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function for smooth animation
    const easeOut = 1 - Math.pow(1 - progress, 3);
    
    meshes.forEach((mesh, i) => {
      // Animate position (bounce effect)
      const bounceHeight = 2 * Math.sin(progress * Math.PI) * (1 - progress);
      const targetY = landY + 0.5 + bounceHeight;
      
      mesh.position.y = targetY;
      
      // Animate rotation (spin during roll, settle to target)
      if (progress < 0.8) {
        // Spinning phase
        const spinProgress = progress / 0.8;
        mesh.rotation.x += spinProgress * 0.2;
        mesh.rotation.y += spinProgress * 0.3;
        mesh.rotation.z += spinProgress * 0.15;
      } else {
        // Settling phase - interpolate to target rotation
        const settleProgress = (progress - 0.8) / 0.2;
        const target = targetRotations[i];
        
        mesh.rotation.x = mesh.rotation.x + (target.x - mesh.rotation.x) * settleProgress;
        mesh.rotation.y = mesh.rotation.y + (target.y - mesh.rotation.y) * settleProgress;
        mesh.rotation.z = mesh.rotation.z + (target.z - mesh.rotation.z) * settleProgress;
      }
    });
    
    if (progress >= 1) {
      // Ensure final positions are correct
      meshes.forEach((mesh, i) => {
        mesh.position.y = landY + 0.5;
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
