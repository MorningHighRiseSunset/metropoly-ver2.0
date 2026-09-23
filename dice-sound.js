/**
 * Dice Roll Sound Generator
 * Uses dice-roll.mp3 audio file
 */

// Dice roll sound using MP3 file
function playDiceRollSound() {
    try {
        const audio = new Audio('dice-roll.mp3');
        audio.volume = 0.7;
        audio.play().catch(e => console.warn('Could not play dice sound:', e));
    } catch (e) {
        console.warn('Could not play dice sound:', e);
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { playDiceRollSound };
}

if (typeof window !== 'undefined') {
    window.DiceSound = {
        playDiceRollSound
    };
}