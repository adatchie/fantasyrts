/**
 * Game Input Handler
 * ゲームの入力処理を一元管理するクラス
 */

import { UNIT_TYPES, TILE_SIZE } from './constants.js';
import { pixelToHex } from './pathfinding.js';

export class GameInputHandler {
    constructor(dependencies) {
        this.game = dependencies.game;
        this.getUnits = dependencies.getUnits;
        this.getGameState = dependencies.getGameState;
        this.getPlayerSide = dependencies.getPlayerSide;
        this.getSelectedUnits = dependencies.getSelectedUnits;
        this.setSelectedUnits = dependencies.setSelectedUnits;
        this.getCamera = dependencies.getCamera;

        // Callbacks
        this.onMouseDownCallback = dependencies.onMouseDown;
        this.onMouseMoveCallback = dependencies.onMouseMove;
        this.onMouseUpCallback = dependencies.onMouseUp;
        this.onKeyDownCallback = dependencies.onKeyDown;
        this.onTouchStartCallback = dependencies.onTouchStart;
        this.onTouchMoveCallback = dependencies.onTouchMove;
        this.onTouchEndCallback = dependencies.onTouchEnd;
    }

    handleMouseDown(e) {
        if (this.onMouseDownCallback) {
            this.onMouseDownCallback(e);
        }
    }

    handleMouseMove(e) {
        if (this.onMouseMoveCallback) {
            this.onMouseMoveCallback(e);
        }
    }

    handleMouseUp(e) {
        if (this.onMouseUpCallback) {
            this.onMouseUpCallback(e);
        }
    }

    handleWheel(e) {
        // カメラ操作などをここに実装可能
        if (this.game && this.game.onWheel) {
            this.game.onWheel(e);
        }
    }

    handleKeyDown(e) {
        if (this.onKeyDownCallback) {
            this.onKeyDownCallback(e);
        }
    }

    handleTouchStart(e) {
        if (this.onTouchStartCallback) {
            this.onTouchStartCallback(e);
        }
    }

    handleTouchMove(e) {
        if (this.onTouchMoveCallback) {
            this.onTouchMoveCallback(e);
        }
    }

    handleTouchEnd(e) {
        if (this.onTouchEndCallback) {
            this.onTouchEndCallback(e);
        }
    }
}
