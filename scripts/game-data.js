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
        stageFile: 'stage_01.json',
        enemyForces: [
            { type: 'INFANTRY', count: 5 },
            { type: 'ARCHER', count: 3 }
        ],
        victoryCondition: 'eliminate',
        turns: null
    },
    castle: {
        id: 'castle',
        name: '城攻めの攻防',
        description: '堅牢な城を攻略せよ',
        difficulty: 2,
        mapName: '攻城戦',
        stageFile: 'stage_02.json',
        enemyForces: [
            { type: 'INFANTRY', count: 6 },
            { type: 'ARCHER', count: 4 }
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
        stageFile: 'stage_03.json',
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
// ステージ間イベント
// ============================================

export const STAGE_EVENTS = {
    'tutorial→castle': {
        id: 'inter_tutorial_castle',
        dialogue: [
            { speaker: 'アルドリック', text: '平原の戦、見事であった。諸君らの働きのおかげだ。', position: 'top' },
            { speaker: 'ギャレス', text: 'しかし敵は城に籠もる構え。正面突破は被害が大きいかと。', position: 'bottom' },
            { speaker: 'アルドリック', text: 'だからこそ、速攻が肝要だ。城の守りが固まる前に落とす。', position: 'top' },
            { speaker: 'ヴァレン', text: '斥候の報告によれば、城の東壁が手薄とのこと。そこを突きましょう。', position: 'bottom' },
            { speaker: 'アルドリック', text: 'よし、全軍出陣の準備を。次は城攻めだ！', position: 'top' },
        ]
    },
    'castle→mountain': {
        id: 'inter_castle_mountain',
        dialogue: [
            { speaker: 'ギャレス', text: '城を落としたものの、敵本体は山岳地帯へ退却しました。', position: 'bottom' },
            { speaker: 'アルドリック', text: '追撃をかける。山に入られる前に決着をつけるぞ。', position: 'top' },
            { speaker: 'ヴァレン', text: '山道は弓兵に有利な地形。伏射には警戒が必要です。', position: 'bottom' },
            { speaker: 'アルドリック', text: '高地を制圧すれば我らの弓も有利になる。地の利を奪え！', position: 'top' },
            { speaker: 'ギャレス', text: '了解。部隊を再編成し、直ちに出発します。', position: 'bottom' },
        ]
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
        const stageOrder = ['tutorial', 'castle', 'mountain'];
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
    /**
     * ステージ順序（正規リスト）
     */
    static get STAGE_ORDER() { return ['tutorial', 'castle', 'mountain']; }

    /**
     * 全ステージ情報を取得（ロック状態含む）
     */
    getAllStages() {
        return GameProgress.STAGE_ORDER.map(id => ({
            id,
            ...STAGES[id],
            completed: this.completedStages.includes(id),
            unlocked: this.unlockedStages.includes(id)
        }));
    }

    /**
     * 次のステージIDを取得（最後にクリアしたステージの次）
     */
    getNextStageId() {
        const order = GameProgress.STAGE_ORDER;
        for (let i = order.length - 1; i >= 0; i--) {
            if (this.completedStages.includes(order[i]) && i < order.length - 1) {
                return order[i + 1];
            }
        }
        return this.unlockedStages[0] || 'tutorial';
    }

    /**
     * ステージ間の遷移キーを取得（イベント表示用）
     */
    getStageTransitionKey() {
        const order = GameProgress.STAGE_ORDER;
        for (let i = order.length - 1; i >= 0; i--) {
            if (this.completedStages.includes(order[i]) && i < order.length - 1) {
                return `${order[i]}→${order[i + 1]}`;
            }
        }
        return null;
    }

    /**
     * 戦闘前のユニットスナップショットを保存
     */
    snapshotPlayerUnits() {
        this._preBattleSnapshot = this.playerUnits.map(u => ({
            id: u.id, level: u.level || 1, exp: u.exp || 0,
            ATK: u.ATK || 50, DEF: u.DEF || 50, AGI: u.AGI || 50,
            VIT: u.VIT || 50, INT: u.INT || 50, MND: u.MND || 50, LUK: u.LUK || 50
        }));
    }

    /**
     * スナップショットを取得（ResultScene用）
     */
    getPreBattleSnapshot() {
        return this._preBattleSnapshot || [];
    }

    /**
     * ステージクリア＋EXP反映（冪等）
     */
    completeStageWithExp(stageId, battleUnits) {
        if (this._resultConsumed) return;
        this._resultConsumed = true;

        this.completeStage(stageId, { goldEarned: 100 });

        // battleUnits（自軍HQユニット）からroster unitへEXP/Level反映
        const playerHQs = (battleUnits || []).filter(u =>
            u.side === this._lastPlayerSide && u.unitType === 'HEADQUARTERS' && !u.dead
        );
        for (const hq of playerHQs) {
            const rosterUnit = this.playerUnits.find(u => u.id === hq.sourceUnitId);
            if (rosterUnit) {
                rosterUnit.level = hq.level || rosterUnit.level;
                rosterUnit.exp = hq.exp || rosterUnit.exp;
                if (hq.ATK) rosterUnit.ATK = hq.ATK;
                if (hq.DEF) rosterUnit.DEF = hq.DEF;
                if (hq.AGI) rosterUnit.AGI = hq.AGI;
                if (hq.VIT) rosterUnit.VIT = hq.VIT;
                if (hq.INT) rosterUnit.INT = hq.INT;
                if (hq.MND) rosterUnit.MND = hq.MND;
                if (hq.LUK) rosterUnit.LUK = hq.LUK;
            }
        }
    }

    /** プレイヤー側を記憶（completeStageWithExp用） */
    setPlayerSide(side) {
        this._lastPlayerSide = side;
        this._resultConsumed = false;
    }

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
