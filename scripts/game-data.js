/**
 * Fantasy RTS - Game Data
 * ステージデータ、ユニットプール、キャンペーン進行状態など
 */

// UNIT_TYPESはconstants.jsで定義されており、ここでは使用しない

// ============================================
// ステージデータ
// ============================================

export const STAGES = {
    tutorial: {
        id: 'tutorial',
        name: 'チュートリアル',
        description: '初めての戦場 - 基本操作を学ぼう',
        difficulty: 1,
        mapSize: { width: 30, height: 30 },
        thumbnail: null, // 将来的に画像パス
        enemyForces: [
            { type: 'INFANTRY', count: 5 },
            { type: 'ARCHER', count: 3 }
        ],
        deploymentZone: { x: 0, y: 20, width: 10, height: 10 },
        victoryCondition: 'eliminate', // 全滅
        turns: null // 無制限
    },
    plains: {
        id: 'plains',
        name: '平原の戦い',
        description: '広大な平原での会戦',
        difficulty: 2,
        mapSize: { width: 50, height: 50 },
        thumbnail: null,
        enemyForces: [
            { type: 'INFANTRY', count: 8 },
            { type: 'ARCHER', count: 4 },
            { type: 'CAVALRY', count: 2 },
            { type: 'KNIGHT', count: 3 }
        ],
        deploymentZone: { x: 0, y: 35, width: 15, height: 15 },
        victoryCondition: 'eliminate',
        turns: null
    },
    mountain: {
        id: 'mountain',
        name: '山岳決戦',
        description: '高低差を活かした戦い',
        difficulty: 3,
        mapSize: { width: 40, height: 40 },
        thumbnail: null,
        enemyForces: [
            { type: 'INFANTRY', count: 6 },
            { type: 'ARCHER', count: 6 },
            { type: 'MAGE', count: 2 },
            { type: 'ARTILLERY', count: 1 }
        ],
        deploymentZone: { x: 0, y: 25, width: 12, height: 15 },
        victoryCondition: 'eliminate',
        turns: 30
    },
    dragon_lair: {
        id: 'dragon_lair',
        name: '竜の巣窟',
        description: 'ドラゴンを討伐せよ',
        difficulty: 5,
        mapSize: { width: 35, height: 35 },
        thumbnail: null,
        enemyForces: [
            { type: 'DRAGON', count: 1 },
            { type: 'DRAGOON', count: 2 },
            { type: 'MAGE', count: 4 }
        ],
        deploymentZone: { x: 0, y: 25, width: 10, height: 10 },
        victoryCondition: 'boss', // ボス撃破
        turns: null
    }
};

// ============================================
// プレイヤーユニットプール
// ============================================

export const PLAYER_UNIT_POOL = [
    // 初期所持ユニット
    { id: 1, type: 'INFANTRY', name: '第一歩兵隊', level: 1, exp: 0 },
    { id: 2, type: 'INFANTRY', name: '第二歩兵隊', level: 1, exp: 0 },
    { id: 3, type: 'INFANTRY', name: '第三歩兵隊', level: 1, exp: 0 },
    { id: 4, type: 'ARCHER', name: '弓兵隊', level: 1, exp: 0 },
    { id: 5, type: 'ARCHER', name: '狙撃隊', level: 1, exp: 0 },
    { id: 6, type: 'KNIGHT', name: '近衛騎士団', level: 2, exp: 0 },
    { id: 7, type: 'SPEAR', name: '槍兵隊', level: 1, exp: 0 },
    { id: 8, type: 'CAVALRY', name: '騎馬隊', level: 1, exp: 0 },
    { id: 9, type: 'MAGE', name: '魔術師団', level: 1, exp: 0 },
    { id: 10, type: 'PRIEST', name: '僧侶団', level: 1, exp: 0 }
];

// ============================================
// ゲーム進行状態
// ============================================

export class GameProgress {
    constructor() {
        this.completedStages = [];
        this.unlockedStages = ['tutorial'];
        this.playerUnits = [...PLAYER_UNIT_POOL];
        this.deployedUnits = [];
        this.gold = 1000;
        this.currentStage = null;
    }

    /**
     * ステージクリア時の処理
     */
    completeStage(stageId, result) {
        if (!this.completedStages.includes(stageId)) {
            this.completedStages.push(stageId);
        }

        // 次のステージをアンロック
        const stageOrder = ['tutorial', 'plains', 'mountain', 'dragon_lair'];
        const currentIndex = stageOrder.indexOf(stageId);
        if (currentIndex >= 0 && currentIndex < stageOrder.length - 1) {
            const nextStage = stageOrder[currentIndex + 1];
            if (!this.unlockedStages.includes(nextStage)) {
                this.unlockedStages.push(nextStage);
            }
        }

        // 報酬処理
        this.gold += result.goldEarned || 100;
    }

    /**
     * ユニットを出撃部隊に追加
     */
    deployUnit(unitId) {
        const unit = this.playerUnits.find(u => u.id === unitId);
        if (unit && !this.deployedUnits.includes(unitId)) {
            this.deployedUnits.push(unitId);
            return true;
        }
        return false;
    }

    /**
     * ユニットを出撃部隊から外す
     */
    undeployUnit(unitId) {
        const index = this.deployedUnits.indexOf(unitId);
        if (index >= 0) {
            this.deployedUnits.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * 出撃部隊をクリア
     */
    clearDeployment() {
        this.deployedUnits = [];
    }

    /**
     * 出撃部隊を取得
     */
    getDeployedUnits() {
        return this.deployedUnits.map(id =>
            this.playerUnits.find(u => u.id === id)
        ).filter(Boolean);
    }

    /**
     * 利用可能なステージリストを取得
     */
    getAvailableStages() {
        return this.unlockedStages.map(id => ({
            ...STAGES[id],
            completed: this.completedStages.includes(id)
        }));
    }

    /**
     * セーブデータとしてエクスポート
     */
    export() {
        return {
            completedStages: this.completedStages,
            unlockedStages: this.unlockedStages,
            playerUnits: this.playerUnits,
            gold: this.gold
        };
    }

    /**
     * プレイヤー所持ユニットをすべて取得
     */
    getPlayerUnits() {
        return this.playerUnits;
    }

    /**
     * 出撃済みユニットIDリストを取得 (互換性用)
     */
    get deployedUnitIds() {
        return this.deployedUnits;
    }

    /**
     * セーブデータからインポート
     */
    import(data) {
        if (data.completedStages) this.completedStages = data.completedStages;
        if (data.unlockedStages) this.unlockedStages = data.unlockedStages;
        if (data.playerUnits) this.playerUnits = data.playerUnits;
        if (data.gold) this.gold = data.gold;
    }
}

// グローバルなゲーム進行状態（シングルトン）
export const gameProgress = new GameProgress();
