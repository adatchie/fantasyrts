/**
 * Turn Manager Module
 * ターン管理、解決処理、勝利条件を担当
 *
 * Responsibilities:
 * - commitTurn: 行動フェイズを開始するターンコミット処理
 * - resolveTurn: 全ユニットの行動解決と勝利条件判定
 * - triggerEndGame: ゲーム終了時の処理
 */

import { UNIT_TYPE_HEADQUARTERS } from '../constants.js';

/**
 * TurnManager class
 * ターン管理ロジックをカプセル化
 */
export class TurnManager {
    /**
     * @param {Object} dependencies - Required dependencies
     * @param {Object} dependencies.combatSystem - Combat system for processing unit actions
     * @param {Object} dependencies.aiSystem - AI system for CPU decisions
     * @param {Object} dependencies.unitManager - Unit manager for unit operations
     * @param {Object} dependencies.mapSystem - Map system for terrain data
     * @param {Object} dependencies.audioEngine - Audio engine for sound effects
     * @param {Function} dependencies.getUnits - Function to get units array
     * @param {Function} dependencies.getPlayerSide - Function to get player side
     * @param {Function} dependencies.getGameState - Function to get current game state
     * @param {Function} dependencies.setGameState - Function to set game state
     * @param {Function} dependencies.getWarlordPlotUsed - Function to get warlord plot usage
     * @param {Function} dependencies.setWarlordPlotUsed - Function to set warlord plot usage
     * @param {Function} dependencies.onTurnPhaseChange - Callback for turn phase changes
     * @param {Function} dependencies.onGameEnd - Callback for game end
     * @param {Function} dependencies.closeCtx - Function to close context menu
     * @param {Function} dependencies.showSpeedControl - Function to show/hide speed control
     * @param {Function} dependencies.updateHUD - Function to update HUD display
     * @param {Object} dependencies.renderingEngine - 3D Rendering Engine (Optional - used for legacy marker support if needed)
     */
    constructor(dependencies) {
        this.combatSystem = dependencies.combatSystem;
        this.aiSystem = dependencies.aiSystem;
        this.unitManager = dependencies.unitManager;
        this.mapSystem = dependencies.mapSystem;
        this.audioEngine = dependencies.audioEngine;

        this.getUnits = dependencies.getUnits;
        this.getPlayerSide = dependencies.getPlayerSide;
        this.getGameState = dependencies.getGameState;
        this.setGameState = dependencies.setGameState;
        this.getWarlordPlotUsed = dependencies.getWarlordPlotUsed;
        this.setWarlordPlotUsed = dependencies.setWarlordPlotUsed;

        this.onTurnPhaseChange = dependencies.onTurnPhaseChange;
        this.onGameEnd = dependencies.onGameEnd;
        this.closeCtx = dependencies.closeCtx;
        this.showSpeedControl = dependencies.showSpeedControl;
        this.updateHUD = dependencies.updateHUD;
        this.renderingEngine = dependencies.renderingEngine; // Keep reference but don't force use
    }

    /**
     * ターンをコミット（行動フェイズ開始）
     * CPU AIの陣形決定と命令設定を行い、アクションフェイズへ移行する
     */
    async commitTurn() {
        const gameState = this.getGameState();
        if (gameState !== 'ORDER') {
            console.warn('[commitTurn] Not in ORDER state:', gameState);
            return;
        }

        try {
            console.log('[commitTurn] Starting turn commit...');

            const playerSide = this.getPlayerSide();
            const units = this.getUnits();

            // CPU AIの陣形を決定（本陣ユニットのみ）
            const cpuHeadquarters = units.filter(u =>
                u.side !== playerSide &&
                !u.dead &&
                u.unitType === UNIT_TYPE_HEADQUARTERS
            );

            cpuHeadquarters.forEach(hq => {
                const subordinates = this.unitManager.getUnitsByWarlordId(hq.warlordId)
                    .filter(u => !u.dead && u.unitType !== UNIT_TYPE_HEADQUARTERS);

                const formation = this.aiSystem.decideFormation(hq, units, subordinates.length);

                // 陣形が変わった場合のみ更新
                if (hq.formation !== formation) {
                    hq.formation = formation;
                    console.log(`CPU陣形設定: ${hq.name} -> ${formation}`);
                }
            });

            // CPU AIの命令を設定
            units.filter(u => u.side !== playerSide && !u.dead).forEach(cpu => {
                const order = this.aiSystem.decideAction(cpu, units, this.mapSystem);
                if (order) cpu.order = order;
            });

            // アクションフェイズへ移行
            this.setGameState('ACTION');
            this._updateActionPhaseUI();

            console.log('[commitTurn] Calling resolveTurn...');
            await this.resolveTurn();
            console.log('[commitTurn] resolveTurn completed successfully');
        } catch (err) {
            console.error('[commitTurn] Error during turn commit:', err);
            console.error('[commitTurn] Stack trace:', err.stack);

            // エラー状態をリセット
            this.setGameState('ORDER');
            this._updateOrderPhaseUI();

            // ユーザーに通知
            alert(`ターン処理エラー: ${err.message}\nコンソールを確認してください。`);
        }
    }

    /**
     * 行動フェイズ解決処理
     * 全ユニットの行動を順次処理し、勝利条件をチェックする
     */
    async resolveTurn() {
        try {
            // 調略フラグをリセット（新しいターン開始）
            this.setWarlordPlotUsed({});

            // 全ユニットの行動済みフラグをリセット（未行動状態に戻す）
            const units = this.getUnits();
            units.forEach(u => u.hasActed = false);

            // 武将ごとにグループ化して、陣形に応じてID順序を制御（渋滞防止）
            const queue = this._buildUnitActionQueue(units);

            // 各ユニットの行動を実行
            for (const u of queue) {
                if (u.dead) continue;

                // Active Marker logic REMOVED to prevent Scene Error
                // if (this.renderingEngine && this.renderingEngine.showActiveMarker) { ... }

                try {
                    // ユニットの行動を処理
                    const warlordPlotUsed = this.getWarlordPlotUsed();
                    await this.combatSystem.processUnit(u, units, this.mapSystem.getMap(), warlordPlotUsed);
                } catch (err) {
                    console.error(`Error processing unit ${u.name}:`, err);
                    // エラーが出ても続行
                }

                // Active Marker logic REMOVED
                // if (this.renderingEngine && this.renderingEngine.hideActiveMarker) { ... }

                // 本陣ステータスチェック
                this._checkAllHeadquartersStatus(units);

                // 勝利条件チェック
                const gameEnded = this._checkVictoryCondition(units);
                if (gameEnded) {
                    return; // ゲーム終了
                }
            }
        } catch (e) {
            console.error('Turn resolution error:', e);
        } finally {
            const currentGameState = this.getGameState();
            if (currentGameState !== 'END') {
                this.setGameState('ORDER');
                this._updateOrderPhaseUI();
            }
        }
    }

    /**
     * ゲーム終了処理
     * @param {string} winnerSide - 勝利陣営 ('EAST' or 'WEST')
     * @param {string} loserName - 敗北陣営の表示名
     */
    triggerEndGame(winnerSide, loserName) {
        this.setGameState('END');

        const isPlayerWin = (winnerSide === this.getPlayerSide());
        this.audioEngine.playFanfare(isPlayerWin);

        if (this.onGameEnd) {
            this.onGameEnd(winnerSide, loserName);
        }
    }

    /**
     * 勝利条件をチェック
     * @param {Array} units - 全ユニット配列
     * @returns {boolean} ゲームが終了したかどうか
     */
    checkVictoryCondition(units) {
        const playerSide = this.getPlayerSide();
        const enemySide = playerSide === 'EAST' ? 'WEST' : 'EAST';

        const playerHQ = units.find(x => x.side === playerSide && x.unitType === UNIT_TYPE_HEADQUARTERS && !x.dead);
        const enemyHQ = units.find(x => x.side === enemySide && x.unitType === UNIT_TYPE_HEADQUARTERS && !x.dead);

        if (!playerHQ && enemyHQ) {
            this.triggerEndGame(enemySide, 'プレイヤー');
            return true;
        }
        if (!enemyHQ && playerHQ) {
            this.triggerEndGame(playerSide, '敵軍');
            return true;
        }

        return false;
    }

    // ==================== Private Methods ====================

    /**
     * ユニット行動キューの構築
     * 陣形と兵士数に基づいて行動順序を決定
     * @param {Array} units - 全ユニット配列
     * @returns {Array} ソートされたユニット配列
     * @private
     */
    _buildUnitActionQueue(units) {
        // 1. 武将IDでグループ化
        const warlordGroups = new Map();
        for (const u of units) {
            if (!warlordGroups.has(u.warlordId)) {
                warlordGroups.set(u.warlordId, []);
            }
            warlordGroups.get(u.warlordId).push(u);
        }

        // 2. 各武将グループ内で陣形に応じてソート
        //    - 鋒矢の陣(HOKO): ID昇順（本陣が先頭）
        //    - その他: ID降順（前方ユニットが先に動く）
        for (const [warlordId, groupUnits] of warlordGroups) {
            const hq = groupUnits.find(u => u.unitType === UNIT_TYPE_HEADQUARTERS && !u.dead);
            const formation = hq ? hq.formation : null;
            const isHoko = (formation === 'HOKO');

            groupUnits.sort((a, b) => {
                if (isHoko) {
                    // 鋒矢の陣: IDが小さい順（本陣から先に動く）
                    return a.id - b.id;
                } else {
                    // その他の陣形: IDが大きい順（前方ユニットから先に動く）
                    return b.id - a.id;
                }
            });
        }

        // 3. グループを統合し、兵士数でソート（少ない順）
        const queue = [];
        for (const groupUnits of warlordGroups.values()) {
            queue.push(...groupUnits);
        }
        queue.sort((a, b) => a.soldiers - b.soldiers);

        return queue;
    }

    /**
     * 全武将の本陣ステータスをチェック
     * @param {Array} units - 全ユニット配列
     * @private
     */
    _checkAllHeadquartersStatus(units) {
        const warlordIds = new Set(units.map(unit => unit.warlordId));
        warlordIds.forEach(warlordId => {
            this.unitManager.checkHeadquartersStatus(warlordId);
        });
    }

    /**
     * 勝利条件をチェックし、必要に応じてゲーム終了処理を実行
     * @param {Array} units - 全ユニット配列
     * @returns {boolean} ゲームが終了したかどうか
     * @private
     */
    _checkVictoryCondition(units) {
        const playerSide = this.getPlayerSide();
        const enemySide = playerSide === 'EAST' ? 'WEST' : 'EAST';

        const playerHQ = units.find(x => x.side === playerSide && x.unitType === UNIT_TYPE_HEADQUARTERS && !x.dead);
        const enemyHQ = units.find(x => x.side === enemySide && x.unitType === UNIT_TYPE_HEADQUARTERS && !x.dead);

        if (!playerHQ) {
            // プレイヤー本陣全滅 → 敵勝利
            this.triggerEndGame(enemySide, 'プレイヤー');
            return true;
        }
        if (!enemyHQ) {
            // 敵本陣全滅 → プレイヤー勝利
            this.triggerEndGame(playerSide, '敵軍');
            return true;
        }

        return false;
    }

    /**
     * アクションフェイズ用のUI更新
     * @private
     */
    _updateActionPhaseUI() {
        const actionBtn = document.getElementById('action-btn');
        if (actionBtn) actionBtn.style.display = 'none';

        const phaseText = document.getElementById('phase-text');
        if (phaseText) phaseText.innerText = "行動フェイズ";

        if (this.closeCtx) this.closeCtx();
        if (this.showSpeedControl) this.showSpeedControl(true);
    }

    /**
     * オーダーフェイズ用のUI更新
     * @private
     */
    _updateOrderPhaseUI() {
        const actionBtn = document.getElementById('action-btn');
        if (actionBtn) actionBtn.style.display = 'block';

        const phaseText = document.getElementById('phase-text');
        if (phaseText) phaseText.innerText = "目標設定フェイズ";

        if (this.updateHUD) this.updateHUD();
        if (this.showSpeedControl) this.showSpeedControl(false);
    }
}

/**
 * Factory function to create a TurnManager instance with proper dependencies
 * @param {Object} gameInstance - The main game instance
 * @returns {TurnManager} A new TurnManager instance
 */
export function createTurnManager(gameInstance) {
    return new TurnManager({
        combatSystem: gameInstance.combatSystem,
        aiSystem: gameInstance.aiSystem,
        unitManager: gameInstance.unitManager,
        mapSystem: gameInstance.mapSystem,
        audioEngine: gameInstance.audioEngine,
        getUnits: () => gameInstance.units,
        getPlayerSide: () => gameInstance.playerSide,
        getGameState: () => gameInstance.gameState,
        setGameState: (state) => { gameInstance.gameState = state; },
        getWarlordPlotUsed: () => gameInstance.warlordPlotUsed,
        setWarlordPlotUsed: (value) => { gameInstance.warlordPlotUsed = value; },
        onTurnPhaseChange: gameInstance.onTurnPhaseChange?.bind(gameInstance),
        onGameEnd: gameInstance.onGameEnd?.bind(gameInstance),
        closeCtx: gameInstance.closeCtx?.bind(gameInstance),
        showSpeedControl: gameInstance.showSpeedControl?.bind(gameInstance),
        updateHUD: gameInstance.updateHUD?.bind(gameInstance),
        renderingEngine: gameInstance.renderingEngine // Optional, might be null
    });
}
