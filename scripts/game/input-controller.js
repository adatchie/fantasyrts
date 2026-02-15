/**
 * SEKIGAHARA RTS - Input Controller
 * マウス・タッチ・キーボード入力処理を管理するモジュール
 *
 * main.jsのGameクラスから入力処理ロジックを分離。
 * Gameインスタンスへの参照を保持し、ゲーム状態を直接操作する。
 */

import { UNIT_TYPE_HEADQUARTERS } from '../constants.js';
import { pixelToHex, isValidHex, getReachableTiles, estimateTurns } from '../pathfinding.js';

export class InputController {
    /**
     * @param {Object} game - Gameインスタンス
     */
    constructor(game) {
        this.game = game;
    }

    // ==================== Mouse ====================

    handleMouseDown(e) {
        const game = this.game;

        // デプロイメントモード中は処理をスキップ
        if (game.isDeploymentMode) return;
        if (game.buildingEditor && game.buildingEditor.isActive) return;

        // 建物配置モード
        if (game.gameState === 'PLACEMENT') {
            if (e.button === 0) {
                game.buildingPlacement.placeCurrentBuilding();
            } else if (e.button === 2) {
                game.buildingPlacement.cancelPlacementMode();
            }
            return;
        }

        // 右クリックはOrbitControlsが処理するので何もしない
        if (e.button === 0) {
            game.input.isLeftDown = true;
            game.input.start = { x: e.clientX, y: e.clientY };
            game.input.curr = { x: e.clientX, y: e.clientY };
        }
    }

    handleMouseMove(e) {
        const game = this.game;

        if (game.buildingEditor && game.buildingEditor.isActive) return;

        // 建物配置モード: ゴースト移動
        if (game.gameState === 'PLACEMENT') {
            game.buildingPlacement.updatePlacementGhost(e.clientX, e.clientY);
            return;
        }

        // 右ドラッグ（カメラ移動）はOrbitControlsが処理する
        if (game.input.isLeftDown) {
            game.input.curr = { x: e.clientX, y: e.clientY };
            this.updateSelectionBox();
        }

        // 3Dカーソル更新
        if (game.renderingEngine && game.renderingEngine.updateCursorPosition && game.renderingEngine.getHexFromScreenCoordinates) {
            const h = game.renderingEngine.getHexFromScreenCoordinates(e.clientX, e.clientY);

            let cursorText = null;
            if (h && game.selectedUnits.length > 0) {
                const leader = game.selectedUnits.find(unit => unit.unitType === UNIT_TYPE_HEADQUARTERS) || game.selectedUnits[0];

                if (leader.x !== h.q || leader.y !== h.r) {
                    const units = window.gameState ? window.gameState.units : [];
                    const turns = estimateTurns(leader, h.q, h.r, game.mapSystem, units);

                    if (turns !== Infinity) {
                        cursorText = `${turns} Turn${turns > 1 ? 's' : ''}`;
                    } else {
                        cursorText = "X";
                    }
                }
            }

            game.renderingEngine.updateCursorPosition(h ? h.q : null, h ? h.r : null, cursorText);
        }
    }

    handleMouseUp(e) {
        const game = this.game;

        if (game.isDeploymentMode) return;
        if (game.buildingEditor && game.buildingEditor.isActive) return;

        if (game.input.isLeftDown && e.button === 0) {
            game.input.isLeftDown = false;
            game.selectionBox.style.display = 'none';

            const dist = Math.hypot(e.clientX - game.input.start.x, e.clientY - game.input.start.y);

            if (dist < 15) {
                this.handleLeftClick(e.clientX, e.clientY);
            } else {
                this.handleBoxSelect();
            }
        }
    }

    // ==================== Wheel ====================

    onWheel(e) {
        // ズームはOrbitControlsが処理する
    }

    // ==================== Touch ====================

    onTouchStart(e) {
        const game = this.game;

        if (game.buildingEditor && game.buildingEditor.isActive) return;

        if (e.touches.length === 1) {
            e.preventDefault();
            e.stopImmediatePropagation();

            game.input.isLeftDown = true;
            const touch = e.touches[0];
            game.input.start = { x: touch.clientX, y: touch.clientY };
            game.input.curr = { x: touch.clientX, y: touch.clientY };
        } else {
            if (game.input.isLeftDown) {
                game.input.isLeftDown = false;
                game.selectionBox.style.display = 'none';
            }
        }
    }

    onTouchMove(e) {
        const game = this.game;

        if (game.input.isLeftDown && e.touches.length === 1) {
            e.preventDefault();
            const touch = e.touches[0];
            game.input.curr = { x: touch.clientX, y: touch.clientY };
            this.updateSelectionBox();
        }
    }

    onTouchEnd(e) {
        const game = this.game;

        if (game.input.isLeftDown) {
            game.input.isLeftDown = false;
            game.selectionBox.style.display = 'none';

            const dist = Math.hypot(game.input.curr.x - game.input.start.x, game.input.curr.y - game.input.start.y);

            if (dist < 10) {
                this.handleLeftClick(game.input.curr.x, game.input.curr.y);
            } else {
                this.handleBoxSelect();
            }
        }
    }

    // ==================== Keyboard ====================

    handleKeyDown(e) {
        const game = this.game;

        // DEBUG: Check what's under the cursor
        if (e.key === 'D' && e.shiftKey) {
            const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
            console.log("Element at center:", el);
            console.log("Active Element:", document.activeElement);
        }

        if (game.gameState === 'PLACEMENT' && e.key === 'Escape') {
            game.buildingPlacement.cancelPlacementMode();
            return;
        }

        // 配置モード中の回転 (R)
        if (game.gameState === 'PLACEMENT' && (e.key === 'r' || e.key === 'R')) {
            game.placementRotation = (game.placementRotation + 1) % 4;
            if (game.placementGhost) {
                game.placementGhost.rotation.y = -(Math.PI / 2) * game.placementRotation;
            }
            return;
        }

        // マップ保存 (Shift+P)
        if (e.key === 'P' && e.shiftKey) {
            game.buildingPlacement.exportMapData();
            return;
        }

        // Shift + B でエディタモード切替
        if (e.key === 'B' && e.shiftKey) {
            if (game.buildingEditor) {
                if (game.buildingEditor.isActive) {
                    game.buildingEditor.exit();
                } else {
                    game.buildingEditor.enter();
                }
            }
            return;
        }

        // ESCキーで選択解除とパネルを閉じる
        if (e.key === 'Escape') {
            game.selectedUnits = [];
            game.uiManager.updateSelectionUI([]);
            if (game.renderingEngine && game.renderingEngine.clearMoveRange) {
                game.renderingEngine.clearMoveRange();
            }
            document.getElementById('context-menu').style.display = 'none';
        }
    }

    // ==================== Selection Box ====================

    updateSelectionBox() {
        const game = this.game;
        const startX = Math.min(game.input.start.x, game.input.curr.x);
        const startY = Math.min(game.input.start.y, game.input.curr.y);
        const width = Math.abs(game.input.curr.x - game.input.start.x);
        const height = Math.abs(game.input.curr.y - game.input.start.y);

        if (width > 5 || height > 5) {
            game.selectionBox.style.left = startX + 'px';
            game.selectionBox.style.top = startY + 'px';
            game.selectionBox.style.width = width + 'px';
            game.selectionBox.style.height = height + 'px';
            game.selectionBox.style.display = 'block';
        } else {
            game.selectionBox.style.display = 'none';
        }
    }

    // ==================== Click & Selection ====================

    handleLeftClick() {
        const game = this.game;

        // 建物配置モード
        if (game.gameState === 'PLACEMENT') {
            game.buildingPlacement.placeCurrentBuilding();
            return;
        }

        const rect = game.canvas.getBoundingClientRect();
        const mx = game.input.start.x - rect.left;
        const my = game.input.start.y - rect.top;

        let h;

        if (game.renderingEngine && game.renderingEngine.getHexFromScreenCoordinates) {
            h = game.renderingEngine.getHexFromScreenCoordinates(game.input.start.x, game.input.start.y);
        } else {
            h = pixelToHex(mx, my, game.camera);
        }

        if (!h || !isValidHex(h)) return;

        const u = game.units.find(x => !x.dead && x.x === h.q && x.y === h.r);
        const menu = document.getElementById('context-menu');
        if (menu) menu.style.display = 'none';

        if (u) {
            if (u.side === game.playerSide) {
                // 味方ユニット選択
                const warlordUnits = game.unitManager.getUnitsByWarlordId(u.warlordId);
                game.selectedUnits = warlordUnits.filter(unit => !unit.dead);
                game.uiManager.updateSelectionUI(game.selectedUnits, null);

                // 移動範囲表示
                const leader = game.selectedUnits.find(unit => unit.unitType === UNIT_TYPE_HEADQUARTERS) || game.selectedUnits[0];
                if (leader && game.renderingEngine && game.renderingEngine.showMoveRange) {
                    game.renderingEngine.clearMoveRange();
                    const range = leader.move || 6;
                    const tiles = getReachableTiles(leader.x, leader.y, range, game.mapSystem);
                    game.renderingEngine.showMoveRange(tiles, 0x4466ff);
                }
            } else {
                // 敵ユニットをクリック
                if (game.selectedUnits.length > 0 && game.selectedUnits[0].side === game.playerSide) {
                    game.targetContextUnit = u;
                    menu.style.display = 'flex';
                    menu.style.left = mx + 'px';
                    menu.style.top = my + 'px';
                    game.uiManager.updateSelectionUI(game.selectedUnits, u);
                } else {
                    const warlordUnits = game.unitManager.getUnitsByWarlordId(u.warlordId);
                    game.uiManager.updateSelectionUI(warlordUnits.filter(unit => !unit.dead));
                    game.selectedUnits = [];
                }
            }
        } else {
            // 地面をクリック
            if (game.selectedUnits.length > 0 && game.selectedUnits[0].side === game.playerSide) {
                game.targetContextUnit = null;
                game.input.targetHex = h;

                game.selectedUnits.forEach(u => {
                    u.order = { type: 'MOVE', targetHex: { x: h.q, y: h.r } };
                });

                menu.style.display = 'none';
            } else {
                game.selectedUnits = [];
                game.uiManager.updateSelectionUI([], null);
                if (game.renderingEngine && game.renderingEngine.clearMoveRange) {
                    game.renderingEngine.clearMoveRange();
                }
            }
        }
    }

    handleBoxSelect() {
        const game = this.game;

        if (!game.renderingEngine || !game.renderingEngine.getUnitScreenPosition) return;

        const startX = Math.min(game.input.start.x, game.input.curr.x);
        const endX = Math.max(game.input.start.x, game.input.curr.x);
        const startY = Math.min(game.input.start.y, game.input.curr.y);
        const endY = Math.max(game.input.start.y, game.input.curr.y);

        const selected = [];

        game.units.forEach(u => {
            if (u.dead || u.side !== game.playerSide) return;

            const screenPos = game.renderingEngine.getUnitScreenPosition(u);
            if (screenPos) {
                if (screenPos.x >= startX && screenPos.x <= endX &&
                    screenPos.y >= startY && screenPos.y <= endY) {
                    selected.push(u);
                }
            }
        });

        if (selected.length > 0) {
            game.selectedUnits = selected;
            game.uiManager.updateSelectionUI(game.selectedUnits, null);

            if (game.selectedUnits.length > 0 && game.renderingEngine && game.renderingEngine.showMoveRange) {
                game.renderingEngine.clearMoveRange();
                const leader = game.selectedUnits.find(unit => unit.unitType === UNIT_TYPE_HEADQUARTERS) || game.selectedUnits[0];
                const range = leader.move || 6;
                const tiles = getReachableTiles(leader.x, leader.y, range, game.mapSystem);
                game.renderingEngine.showMoveRange(tiles, 0x4466ff);
            }

            this.closeCtx();
        } else {
            game.selectedUnits = [];
            game.uiManager.updateSelectionUI([], null);
        }
    }

    // ==================== Commands ====================

    issueCommand(type) {
        const game = this.game;
        if (game.targetContextUnit && game.selectedUnits.length > 0) {
            game.selectedUnits.forEach(u => {
                u.order = { type: type, targetId: game.targetContextUnit.id };
            });
        }
        this.closeCtx();
    }

    closeCtx() {
        document.getElementById('context-menu').style.display = 'none';
    }

    // ==================== Event Listener Setup ====================

    /**
     * イベントリスナーを登録する
     * Game.init() から呼ばれる
     */
    setupEventListeners() {
        const game = this.game;
        const canvas = game.canvas;

        window.addEventListener('mousedown', (e) => {
            if (e.target === canvas || e.target.id === 'gameCanvas') {
                this.handleMouseDown(e);
            }
        }, true);

        window.addEventListener('mousemove', (e) => {
            if (e.target === canvas || e.target.id === 'gameCanvas' || game.input.isLeftDown) {
                this.handleMouseMove(e);
            }
        }, true);

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.handleMouseUp(e);
            }
        }, true);

        canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // Touch Events
        window.addEventListener('touchstart', (e) => {
            if (e.target === canvas || e.target.id === 'gameCanvas') {
                this.onTouchStart(e);
            }
        }, { passive: false, capture: true });
        window.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false, capture: true });
        window.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false, capture: true });
    }
}
