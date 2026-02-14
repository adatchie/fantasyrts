/**
 * Input Handler Module
 * Provides input handling functionality for the game
 *
 * This module re-exports GameInputHandler and provides factory functions
 * for easy integration with main.js
 */

import { GameInputHandler } from '../game-input-handler.js';

/**
 * Create and configure an input handler for the game
 * @param {Object} dependencies - Dependencies object for GameInputHandler
 * @returns {GameInputHandler} Configured input handler instance
 */
export function createInputHandler(dependencies) {
    return new GameInputHandler(dependencies);
}

/**
 * Setup event listeners for the input handler
 * @param {GameInputHandler} inputHandler - The input handler instance
 * @param {HTMLElement} canvas - The game canvas element
 */
export function setupInputListeners(inputHandler, canvas) {
    // Mouse events
    window.addEventListener('mousedown', (e) => {
        if (e.target === canvas || e.target.id === 'gameCanvas') {
            inputHandler.handleMouseDown(e);
        }
    }, true);

    window.addEventListener('mousemove', (e) => {
        if (e.target === canvas || e.target.id === 'gameCanvas') {
            inputHandler.handleMouseMove(e);
        }
    }, true);

    window.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            inputHandler.handleMouseUp(e);
        }
    }, true);

    canvas.addEventListener('wheel', (e) => inputHandler.handleWheel(e), { passive: false });

    // Keyboard events
    window.addEventListener('keydown', (e) => inputHandler.handleKeyDown(e));

    // Touch events
    window.addEventListener('touchstart', (e) => {
        if (e.target === canvas || e.target.id === 'gameCanvas') {
            inputHandler.handleTouchStart(e);
        }
    }, { passive: false, capture: true });

    window.addEventListener('touchmove', (e) => {
        inputHandler.handleTouchMove(e);
    }, { passive: false, capture: true });

    window.addEventListener('touchend', (e) => {
        inputHandler.handleTouchEnd(e);
    }, { passive: false, capture: true });
}

// Re-export GameInputHandler for direct use
export { GameInputHandler };
