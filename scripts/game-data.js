/**
 * Fantasy RTS - Game Data
 * ステージデータ、ユニットプール、キャンペーン進行状態など
 */

// UNIT_TYPESはconstants.jsで定義されており、ここでは使用しない

// ============================================
// ステージデータ
// ============================================

import { getFormationModifiers } from './formation.js';

export class Squadron {
    constructor(id, leaderId) {
        this.id = id;
        this.leaderUnitId = leaderId;
        this.memberUnitIds = [];
        this.formationType = 'HOKO'; // デフォルトは鋒矢
        this.tactic = null;
    }

    addMember(unitId) {
        if (!this.memberUnitIds.includes(unitId)) {
            this.memberUnitIds.push(unitId);
        }
    }

    removeMember(unitId) {
        this.memberUnitIds = this.memberUnitIds.filter(id => id !== unitId);
    }

    setFormation(type) {
        this.formationType = type;
    }

    getFormationBonus() {
        return getFormationModifiers(this.formationType);
    }
}

export const STAGES = {
    tutorial: {
        id: 'tutorial',
        name: 'チュートリアル',
        description: '初めての戦場 - 基本操作を学ぼう',
        difficulty: 1,
        mapName: 'チュートリアル平原',
        enemyForces: [
            { type: 'INFANTRY', count: 5 },
            { type: 'ARCHER', count: 3 }
        ],
        victoryCondition: 'eliminate',
        turns: null
    },
    mountain: {
        id: 'mountain',
        name: '山岳決戦',
        description: '高低差を活かした戦い',
        difficulty: 3,
        mapName: '山岳決戦',
        enemyForces: [
            { type: 'INFANTRY', count: 6 },
            { type: 'ARCHER', count: 6 },
            { type: 'MAGE', count: 2 },
            { type: 'ARTILLERY', count: 1 }
        ],
        victoryCondition: 'eliminate',
        turns: 30
    }
};

// ============================================
// プレイヤーユニットプール
// ============================================

// 初期所持ユニット（部隊リスト）
// unitCount: 部隊内のユニット数（コスト管理対象）
export const PLAYER_UNIT_POOL = [
    { id: 1, type: 'INFANTRY', name: '歩兵隊', level: 1, exp: 0, unitCount: 10 },
    { id: 2, type: 'ARCHER', name: '弓兵隊', level: 1, exp: 0, unitCount: 5 },
    { id: 3, type: 'MAGE', name: '魔導師団', level: 1, exp: 0, unitCount: 3 },
    { id: 4, type: 'PRIEST', name: '僧侶団', level: 1, exp: 0, unitCount: 2 },
    { id: 5, type: 'KNIGHT', name: '騎士団', level: 1, exp: 0, unitCount: 2 }
];

// ============================================
// ゲーム進行状態
// ============================================

export class GameProgress {
    constructor() {
        this.completedStages = [];
        this.unlockedStages = ['tutorial'];
        this.playerUnits = [...PLAYER_UNIT_POOL]; // 部隊リストをコピー
        this.deployedUnits = this.playerUnits.map(u => u.id); // 全員出撃設定
        this.gold = 1000;
        this.currentStage = null;
        this.nextUnitId = 10;
    }

    /**
     * 指定されたIDの部隊を取得
     */
    getUnit(unitId) {
        return this.playerUnits.find(u => u.id === unitId);
    }

    /**
     * ステージクリア時の処理
     */

    /**
     * 新しいユニットを雇用して追加
     * @param {string} type - ユニットタイプ
     */
    addUnit(type) {
        const info = getUnitTypeInfo(type); // constant.jsから取得する必要があるが、ここではimportできないので引数か、外でやるか
        // 簡易的に名前だけ生成
        // 名前生成ロジックは別途必要かも
        const newUnit = {
            id: this.nextUnitId++,
            type: type,
            name: `${type}_${this.nextUnitId}`, // 仮名
            level: 1,
            exp: 0
        };
        this.playerUnits.push(newUnit);
        this.deployUnit(newUnit.id); // 自動で出撃枠に入れる
        return newUnit;
    }

    /**
     * ユニットを解雇（削除）
     */
    removeUnit(unitId) {
        this.undeployUnit(unitId);
        this.playerUnits = this.playerUnits.filter(u => u.id !== unitId);
    }

    /**
     * ステージクリア時の処理
     */
    completeStage(stageId, result) {
        if (!this.completedStages.includes(stageId)) {
            this.completedStages.push(stageId);
        }

        // 次のステージをアンロック
        const stageOrder = ['tutorial', 'mountain'];
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
