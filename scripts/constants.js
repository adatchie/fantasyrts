/**
 * SEKIGAHARA RTS - Constants and Data
 * 定数、武将データ、セリフデータなど
 */

// ゲーム定数 - スクエアグリッド（クォータービュー）
export const TILE_SIZE = 32;        // タイルの基本サイズ（ピクセル）
export const TILE_HEIGHT = 16;      // 1段あたりの高さ（ピクセル）
export const MAX_HEIGHT = 8;        // 地形の最大高さ段数
export const MAP_W = 70;            // マップ幅（タイル数）
export const MAP_H = 70;            // マップ高さ（タイル数）

// 後方互換性のためHEX_SIZEも維持（段階的移行用）
export const HEX_SIZE = TILE_SIZE;

// カラー定数
export const C_EAST = '#88AAEE';
export const C_WEST = '#EE4444';
export const C_SEL_BOX = 'rgba(255, 255, 255, 0.2)';
export const C_SEL_BORDER = '#fff';

// ユニットタイプ定数
export const UNIT_TYPE_HEADQUARTERS = 'HEADQUARTERS'; // 本陣
export const UNIT_TYPE_NORMAL = 'NORMAL';             // 通常ユニット

// マルチユニットシステム定数
export const SOLDIERS_PER_UNIT = 1000; // 1ユニットあたりの標準兵力



// ========================================
// ファンタジーRTS ユニットタイプ定義
// ========================================

/**
 * ユニットタイプ定義
 * size: グリッド占有数 (1=小, 2=中/縦2マス, 4=大/2×2)
 * sizeShape: 'single' | 'vertical' | '2x2'
 * rangeType: 攻撃パターンタイプ（attack-patterns.jsと連携）
 * baseHp: 基本HP
 * baseMoveRange: 基本移動力
 * mobility: 行動フェイズのターン順を決めるための機動力（数値が高いほど早く行動）
 * marker: 暫定表示用マーカー（スプライト未実装時）
 */
export const UNIT_TYPES = {
    // ────────── 小サイズ (1グリッド) ──────────
    INFANTRY: {
        name: '歩兵',
        size: 1,
        sizeShape: 'single',
        rangeType: 'melee',
        atk: 50,
        def: 50,
        baseHp: 1000,
        baseMoveRange: 9,
        mobility: 4,
        cost: 5, // 歩兵30人 = 150
        marker: '⚔️',
        description: '攻撃力防御力平均的。近接攻撃のみ。軽装鎧に剣装備。',
        weapon: 'sword'
    },
    KNIGHT: {
        name: '騎士',
        size: 1,
        sizeShape: 'single',
        rangeType: 'melee',
        atk: 40,
        def: 80,
        baseHp: 1200,
        baseMoveRange: 6,
        mobility: 3,
        cost: 10,
        marker: '🛡️',
        description: '防御力が高く壁役。近接攻撃のみ。重装鎧に盾を装備。',
        weapon: 'sword'
    },
    ARCHER: {
        name: '弓兵',
        size: 1,
        sizeShape: 'single',
        rangeType: 'bowArc',
        atk: 40,
        def: 30,
        baseHp: 800,
        baseMoveRange: 9,
        mobility: 5,
        cost: 8,
        marker: '🏹',
        description: '攻撃力防御力弱いが射程長い。皮装備に弓を装備。',
        weapon: 'bow'
    },
    SPEAR: {
        name: '槍兵',
        size: 1,
        sizeShape: 'single',
        rangeType: 'forward2',
        atk: 50,
        def: 50,
        baseHp: 1000,
        baseMoveRange: 9,
        mobility: 4,
        cost: 8,
        marker: '🔱',
        description: '攻撃力防御力平均的。前方2マス攻撃可。軽装鎧に槍装備。',
        weapon: 'spear'
    },
    GUNNER: {
        name: '銃士',
        size: 1,
        sizeShape: 'single',
        rangeType: 'longArc',
        atk: 70,
        def: 25,
        baseHp: 700,
        baseMoveRange: 6,
        mobility: 2,
        cost: 12,
        marker: '🔫',
        description: '攻撃力高いが防御低い。射程長い。皮装備に長銃装備。',
        weapon: 'gun'
    },
    MAGE: {
        name: '魔術師',
        size: 1,
        sizeShape: 'single',
        rangeType: 'aoe',
        atk: 80,
        def: 15,
        baseHp: 600,
        baseMoveRange: 6,
        mobility: 2,
        cost: 15,
        marker: '✨',
        isAoe: true,  // 範囲攻撃フラグ（着弾点+周囲8マスにダメージ）
        description: '攻撃力高いが防御極度に低い。射程中。範囲攻撃。ローブに魔導書。',
        weapon: 'staff'
    },
    PRIEST: {
        name: '僧侶',
        size: 1,
        sizeShape: 'single',
        rangeType: 'heal',
        atk: 0,
        def: 50,
        baseHp: 800,
        baseMoveRange: 6,
        mobility: 2,
        cost: 10,
        isHealer: true,
        marker: '✝️',
        description: '攻撃力なし防御平均的。味方を回復。僧衣に杖。',
        weapon: 'staff'
    },

    // ────────── 中サイズ (縦2グリッド) ──────────
    CAVALRY: {
        name: '騎兵',
        size: 2,
        sizeShape: 'vertical',
        rangeType: 'forward2',
        atk: 70,
        def: 70,
        baseHp: 1500,
        baseMoveRange: 12,
        mobility: 6,
        cost: 20,
        canPushBack: true,  // 押し出し能力
        marker: '🐴',
        description: '攻撃力高防御高。移動力高。前方2マス攻撃可。敵を押し出す。'
    },

    // ────────── 大サイズ (2×2グリッド) ──────────
    DRAGON: {
        name: 'ドラゴン',
        size: 4,
        sizeShape: '2x2',
        rangeType: 'breath',
        breathEffectId: 'breath_attack',
        atk: 90,
        def: 80,
        baseHp: 3000,
        baseMoveRange: 11,
        mobility: 6,
        cost: 50, // ドラゴン3匹 = 150
        marker: '🐉',
        description: '強力な飛行ユニット。ブレス攻撃で前方扇状にダメージ。'
    },
    DRAGON_RIDER: {
        name: '竜騎兵',
        size: 4,
        sizeShape: '2x2',
        rangeType: 'breath',
        breathEffectId: 'flame_stream_attack',
        atk: 85,
        def: 75,
        baseHp: 2500,
        baseMoveRange: 12,
        mobility: 6,
        cost: 45,
        marker: '🦅',
        description: 'ドラゴンに騎乗した騎士。機動力と攻撃力を兼ね備える。'
    },
    ARTILLERY: {
        name: '砲兵',
        size: 4,
        sizeShape: '2x2',
        rangeType: 'siege',
        atk: 100,
        def: 20,
        baseHp: 1000,
        baseMoveRange: 3,
        mobility: 1,
        cost: 30,
        marker: '💣',
        description: '圧倒的な攻撃力と超長射程。移動力は極端に低い。',
        weapon: 'cannon' // 武器種別
    }
};

// 武器定義
// sprite: 武器スプライト画像ファイル名（assets/sprites/ 以下）
// scale: ユニットサイズに対する武器スプライトの倍率
// pivot: 武器スプライト内の回転中心（正規化座標 0-1）。y=1.0 で柄の底部
// hand: ユニットスプライト上の手の位置（正規化座標 0-1）
// swing: スイングアニメーション定義
//   windupDeg: 振りかぶり角度（baseAngleからの相対）
//   strikeDeg: 振り下ろし角度（baseAngleからの相対）
//   easing: イージング関数名
// ※同じ weapon キーでスプライトを差し替えてもモーションはそのまま成立する
export const WEAPON_TYPES = {
    sword: {
        sprite: 'sword.png',
        scale: 1.5,
        pivot: { x: 0.5, y: 1.0 },
        hand: { x: 0.6, y: 0.55 },
        swing: { windupDeg: 40, strikeDeg: -80, easing: 'easeOutCubic' }
    },
    spear: {
        sprite: 'spear.png',
        scale: 1.8,
        pivot: { x: 0.5, y: 0.85 },
        hand: { x: 0.55, y: 0.5 },
        swing: { windupDeg: 25, strikeDeg: -40, easing: 'easeOutCubic' }
    },
    bow: {
        sprite: 'bow.png',
        scale: 1.3,
        pivot: { x: 0.5, y: 0.5 },
        hand: { x: 0.55, y: 0.5 },
        swing: { windupDeg: 15, strikeDeg: -10, easing: 'linear' }
    },
    gun: {
        sprite: 'gun.png',
        scale: 1.4,
        pivot: { x: 0.5, y: 0.7 },
        hand: { x: 0.55, y: 0.5 },
        swing: { windupDeg: 10, strikeDeg: -5, easing: 'linear' }
    },
    staff: {
        sprite: 'staff.png',
        scale: 1.6,
        pivot: { x: 0.5, y: 0.9 },
        hand: { x: 0.55, y: 0.5 },
        swing: { windupDeg: 20, strikeDeg: -30, easing: 'easeOutCubic' }
    },
    cannon: {
        sprite: 'sword.png',
        scale: 1.8,
        pivot: { x: 0.5, y: 0.7 },
        hand: { x: 0.5, y: 0.5 },
        swing: { windupDeg: 5, strikeDeg: -10, easing: 'linear' }
    }
};

/**
 * ユニットタイプIDからタイプ情報を取得
 * @param {string} typeId - ユニットタイプID
 * @returns {Object|null} ユニットタイプ情報
 */
export function getUnitTypeInfo(typeId) {
    return UNIT_TYPES[typeId] || null;
}

// ========================================
// 部隊長（Commander）システム
// ========================================

/**
 * 職業別ベースパラメータ
 * 部隊長のクラス（職業）ごとの基本ステータス
 */
export const COMMANDER_CLASS_BASE = {
    INFANTRY:     { ATK: 50, DEF: 50, AGI: 50, VIT: 50, INT: 20, MND: 20, LUK: 30 },
    KNIGHT:       { ATK: 40, DEF: 80, AGI: 30, VIT: 70, INT: 15, MND: 25, LUK: 20 },
    ARCHER:       { ATK: 45, DEF: 30, AGI: 60, VIT: 35, INT: 25, MND: 15, LUK: 40 },
    SPEAR:        { ATK: 50, DEF: 50, AGI: 45, VIT: 50, INT: 20, MND: 20, LUK: 30 },
    GUNNER:       { ATK: 70, DEF: 25, AGI: 25, VIT: 30, INT: 30, MND: 10, LUK: 20 },
    MAGE:         { ATK: 30, DEF: 15, AGI: 25, VIT: 25, INT: 90, MND: 50, LUK: 30 },
    PRIEST:       { ATK:  0, DEF: 40, AGI: 25, VIT: 40, INT: 30, MND: 90, LUK: 40 },
    CAVALRY:      { ATK: 70, DEF: 60, AGI: 70, VIT: 55, INT: 15, MND: 15, LUK: 30 },
    DRAGON:       { ATK: 90, DEF: 80, AGI: 60, VIT: 90, INT: 70, MND: 30, LUK: 25 },
    DRAGON_RIDER: { ATK: 85, DEF: 70, AGI: 65, VIT: 75, INT: 50, MND: 30, LUK: 35 },
    ARTILLERY:    { ATK:100, DEF: 20, AGI: 15, VIT: 35, INT: 25, MND: 10, LUK: 15 }
};

/**
 * LvUP時の成長率（Fire Emblem風確率成長）
 * 各値は1LvUPあたりの期待上昇値（%確率で+1、小数は追加確率）
 */
export const COMMANDER_GROWTH_RATES = {
    INFANTRY:     { ATK: 3.0, DEF: 3.0, AGI: 2.0, VIT: 2.5, INT: 1.0, MND: 1.0, LUK: 1.0 },
    KNIGHT:       { ATK: 2.0, DEF: 4.0, AGI: 1.5, VIT: 3.5, INT: 0.5, MND: 1.0, LUK: 0.5 },
    ARCHER:       { ATK: 2.5, DEF: 1.5, AGI: 3.0, VIT: 2.0, INT: 1.5, MND: 0.5, LUK: 2.0 },
    SPEAR:        { ATK: 3.0, DEF: 2.5, AGI: 2.0, VIT: 2.5, INT: 1.0, MND: 1.0, LUK: 1.5 },
    GUNNER:       { ATK: 3.5, DEF: 1.0, AGI: 1.5, VIT: 1.5, INT: 2.0, MND: 0.5, LUK: 1.0 },
    MAGE:         { ATK: 1.0, DEF: 1.0, AGI: 1.5, VIT: 1.5, INT: 4.5, MND: 2.5, LUK: 1.0 },
    PRIEST:       { ATK: 0.5, DEF: 2.0, AGI: 1.5, VIT: 2.0, INT: 2.0, MND: 4.5, LUK: 1.5 },
    CAVALRY:      { ATK: 3.5, DEF: 3.0, AGI: 3.5, VIT: 3.0, INT: 0.5, MND: 0.5, LUK: 1.5 },
    DRAGON:       { ATK: 4.0, DEF: 3.5, AGI: 3.0, VIT: 4.0, INT: 3.0, MND: 1.5, LUK: 1.0 },
    DRAGON_RIDER: { ATK: 3.5, DEF: 3.0, AGI: 3.0, VIT: 3.5, INT: 2.5, MND: 1.5, LUK: 1.5 },
    ARTILLERY:    { ATK: 4.0, DEF: 1.0, AGI: 0.5, VIT: 1.5, INT: 1.5, MND: 0.5, LUK: 0.5 }
};

/**
 * 次レベルに必要なEXP
 * @param {number} level - 現在のレベル
 * @returns {number} 次Lvに必要なEXP
 */
export const MAX_LEVEL = 99;
export const STAT_CAP = 100;

export function expToNextLevel(level) {
    return Math.floor(100 * Math.pow(1.3, level - 1));
}

/**
 * ユニットが占有するグリッド座標を計算
 * @param {number} x - 基準X座標（★の位置）
 * @param {number} y - 基準Y座標（★の位置）
 * @param {number} dir - 向き (0=上, 1=右, 2=下, 3=左)
 * @param {string} sizeShape - サイズ形状
 * @returns {Array<{x: number, y: number}>} 占有グリッド座標配列
 */
export function getOccupiedGrids(x, y, dir, sizeShape) {
    const grids = [{ x, y }]; // 基準位置は必ず含む

    if (sizeShape === 'vertical') {
        // 縦2マス：基準（前方）の後ろにもう1マス
        switch (dir) {
            case 0: grids.push({ x, y: y + 1 }); break; // 上向き→後ろは下
            case 1: grids.push({ x: x - 1, y }); break; // 右向き→後ろは左
            case 2: grids.push({ x, y: y - 1 }); break; // 下向き→後ろは上
            case 3: grids.push({ x: x + 1, y }); break; // 左向き→後ろは右
        }
    } else if (sizeShape === '2x2') {
        // 2×2マス：基準を左上として右、下、右下を追加
        grids.push({ x: x + 1, y });
        grids.push({ x, y: y + 1 });
        grids.push({ x: x + 1, y: y + 1 });
    }

    return grids;
}

// 陣形定数
export const FORMATION_HOKO = 'HOKO';         // 鋒矢の陣（攻撃的・本陣前方）
export const FORMATION_KAKUYOKU = 'KAKUYOKU'; // 鶴翼の陣（バランス型・本陣中央）
export const FORMATION_GYORIN = 'GYORIN';     // 魚鱗の陣（防御的・本陣後方）

// 性格タイプ
export const P_BRAVE = '勇猛';
export const P_LOYAL = '忠義';
export const P_COWARD = '臆病';
export const P_CALM = '沈着';

// セリフデータ
export const DIALOGUE = {
    [P_BRAVE]: {
        ATTACK: ["突撃せよ！", "蹴散らせ！", "我に続け！"],
        DAMAGED: ["ぬぅ！", "退くな！"],
        PLOT_DO: ["寝返れ！"],
        PLOT_REC: ["愚弄するか"],
        DYING: ["見事…！"]
    },
    [P_LOYAL]: {
        ATTACK: ["主君の為！", "参る！", "忠義は我にあり"],
        DAMAGED: ["持ち堪えよ！"],
        PLOT_DO: ["大義の為"],
        PLOT_REC: ["裏切らぬ"],
        DYING: ["無念…！"]
    },
    [P_COWARD]: {
        ATTACK: ["い、行け！", "囲め！"],
        DAMAGED: ["ひっ！", "来るな！"],
        PLOT_DO: ["うまい話だ"],
        PLOT_REC: ["話を聞こう"],
        DYING: ["助けて！"]
    },
    [P_CALM]: {
        ATTACK: ["好機だ", "掛かれ"],
        DAMAGED: ["想定内だ", "崩れるな"],
        PLOT_DO: ["時勢を見よ"],
        PLOT_REC: ["乗らぬ"],
        DYING: ["計算違いか"]
    }
};

// 部隊長データ
export const WARLORDS = [
    // --- Kingdom (East) ---
    { name: "アルドリック", side: 'EAST', class: 'KNIGHT', soldiers: 30000, ATK: 95, DEF: 99, AGI: 99, VIT: 85, INT: 45, MND: 60, LUK: 70, loyalty: 100, x: 60, y: 35, size: 2, p: P_CALM, kamon: 'MITSUBA_AOI', bg: '#d4af37', face: 'tokugawa_iyeyasu.png', level: 1, exp: 0 },
    { name: "ギャレス", side: 'EAST', class: 'KNIGHT', soldiers: 500, ATK: 99, DEF: 90, AGI: 80, VIT: 80, INT: 20, MND: 25, LUK: 25, loyalty: 100, x: 45, y: 35, size: 1, p: P_BRAVE, kamon: 'MARUNI_TACHIAOI', bg: '#111', face: 'honda_tadakatsu.png', level: 1, exp: 0 },
    { name: "ローラン", side: 'EAST', class: 'CAVALRY', soldiers: 3600, ATK: 92, DEF: 85, AGI: 85, VIT: 70, INT: 20, MND: 15, LUK: 30, loyalty: 100, x: 35, y: 33, size: 1, p: P_BRAVE, kamon: 'TACHIBANA', bg: '#cc0000', face: 'ii_naomasa.png', level: 1, exp: 0 },
    { name: "エドリック", side: 'EAST', class: 'INFANTRY', soldiers: 3000, ATK: 80, DEF: 80, AGI: 75, VIT: 55, INT: 30, MND: 25, LUK: 35, loyalty: 100, x: 36, y: 34, size: 1, p: P_LOYAL, kamon: 'MITSUBA_AOI', bg: '#444', face: 'matsudaira_tadayoshi.png', level: 1, exp: 0 },

    // Kingdom vassals
    { name: "ケイル", side: 'EAST', class: 'INFANTRY', soldiers: 6000, ATK: 90, DEF: 80, AGI: 70, VIT: 60, INT: 25, MND: 20, LUK: 40, loyalty: 75, x: 32, y: 30, size: 1, p: P_BRAVE, kamon: 'OMODAKA', bg: '#222', face: 'fukushima_masanori.png', level: 1, exp: 0 },
    { name: "ダリウス", side: 'EAST', class: 'GUNNER', soldiers: 5400, ATK: 88, DEF: 85, AGI: 85, VIT: 40, INT: 50, MND: 15, LUK: 25, loyalty: 82, x: 38, y: 15, size: 1, p: P_CALM, kamon: 'FUJIDOMOE', bg: '#333', face: 'kuroda_nagamasa.png', level: 1, exp: 0 },
    { name: "トリスタン", side: 'EAST', class: 'INFANTRY', soldiers: 5000, ATK: 85, DEF: 80, AGI: 80, VIT: 55, INT: 30, MND: 30, LUK: 35, loyalty: 78, x: 40, y: 16, size: 1, p: P_LOYAL, kamon: 'KUYO', bg: '#333', face: 'hosokawa_tadaoki.png', level: 1, exp: 0 },
    { name: "レイナルド", side: 'EAST', class: 'INFANTRY', soldiers: 3000, ATK: 82, DEF: 80, AGI: 75, VIT: 55, INT: 25, MND: 20, LUK: 35, loyalty: 75, x: 38, y: 20, size: 1, p: P_BRAVE, kamon: 'SAGARI_FUJI', bg: '#444', face: 'kato_yoshiaki.png', level: 1, exp: 0 },
    { name: "セドリック", side: 'EAST', class: 'INFANTRY', soldiers: 3000, ATK: 80, DEF: 80, AGI: 75, VIT: 55, INT: 30, MND: 30, LUK: 40, loyalty: 85, x: 35, y: 22, size: 1, p: P_LOYAL, kamon: 'KUGINUKI', bg: '#444', face: 'tanaka_yoshimasa.png', level: 1, exp: 0 },
    { name: "マルコム", side: 'EAST', class: 'INFANTRY', soldiers: 2490, ATK: 85, DEF: 85, AGI: 85, VIT: 60, INT: 40, MND: 35, LUK: 30, loyalty: 88, x: 33, y: 38, size: 1, p: P_CALM, kamon: 'TSUTA', bg: '#555', face: 'todo_takatora.png', level: 1, exp: 0 },
    { name: "ゴッドウィン", side: 'EAST', class: 'INFANTRY', soldiers: 3000, ATK: 78, DEF: 75, AGI: 70, VIT: 50, INT: 30, MND: 25, LUK: 35, loyalty: 85, x: 34, y: 39, size: 1, p: P_LOYAL, kamon: 'FOUR_DIAMONDS', bg: '#666', face: 'kyogoku_takatomo.png', level: 1, exp: 0 },
    { name: "ハーラン", side: 'EAST', class: 'INFANTRY', soldiers: 2400, ATK: 75, DEF: 75, AGI: 70, VIT: 50, INT: 30, MND: 25, LUK: 30, loyalty: 80, x: 38, y: 35, size: 1, p: P_CALM, kamon: 'KANI', bg: '#666', face: 'terasawa_hirotaka.png', level: 1, exp: 0 },
    { name: "オールドウィン", side: 'EAST', class: 'INFANTRY', soldiers: 2850, ATK: 75, DEF: 75, AGI: 70, VIT: 50, INT: 30, MND: 25, LUK: 30, loyalty: 80, x: 40, y: 30, size: 1, p: P_CALM, kamon: 'UMEBACHI', bg: '#666', face: 'tsutsui_sadatsugu.png', level: 1, exp: 0 },
    { name: "ハドリアン", side: 'EAST', class: 'INFANTRY', soldiers: 1830, ATK: 75, DEF: 70, AGI: 65, VIT: 50, INT: 25, MND: 20, LUK: 35, loyalty: 80, x: 42, y: 25, size: 1, p: P_LOYAL, kamon: 'GENJI_GURUMA', bg: '#666', face: 'ikoma_kazumasa.png', level: 1, exp: 0 },
    { name: "オーウェン", side: 'EAST', class: 'INFANTRY', soldiers: 1140, ATK: 70, DEF: 70, AGI: 60, VIT: 45, INT: 25, MND: 25, LUK: 40, loyalty: 85, x: 45, y: 20, size: 1, p: P_LOYAL, kamon: 'UMEBACHI', bg: '#666', face: 'kanamori_nagachika.png', level: 1, exp: 0 },
    { name: "ファビアン", side: 'EAST', class: 'INFANTRY', soldiers: 1200, ATK: 70, DEF: 70, AGI: 60, VIT: 45, INT: 30, MND: 25, LUK: 30, loyalty: 80, x: 48, y: 25, size: 1, p: P_CALM, kamon: 'MARUNI_FUTATSUHIKI', bg: '#666', face: 'furuta_shigenari.png', level: 1, exp: 0 },
    { name: "ランドール", side: 'EAST', class: 'INFANTRY', soldiers: 450, ATK: 60, DEF: 60, AGI: 50, VIT: 40, INT: 35, MND: 30, LUK: 50, loyalty: 70, x: 45, y: 30, size: 1, p: P_COWARD, kamon: 'ODA_MOKKO', bg: '#888', face: 'oda_nagamasu.png', level: 1, exp: 0 },
    { name: "ボールドウィン", side: 'EAST', class: 'INFANTRY', soldiers: 1000, ATK: 80, DEF: 80, AGI: 75, VIT: 55, INT: 25, MND: 30, LUK: 35, loyalty: 100, x: 50, y: 32, size: 1, p: P_LOYAL, kamon: 'KUGINUKI', bg: '#222', face: 'horio_tadauji.png', level: 1, exp: 0 },
    { name: "キャラム", side: 'EAST', class: 'INFANTRY', soldiers: 2050, ATK: 75, DEF: 75, AGI: 75, VIT: 50, INT: 30, MND: 30, LUK: 40, loyalty: 95, x: 54, y: 40, size: 1, p: P_LOYAL, kamon: 'MITSU_GASHIWA', bg: '#222', face: 'yamanouchi_kazutoyo.png', level: 1, exp: 0 },
    { name: "レオリック", side: 'EAST', class: 'INFANTRY', soldiers: 4560, ATK: 85, DEF: 85, AGI: 85, VIT: 60, INT: 25, MND: 20, LUK: 30, loyalty: 90, x: 52, y: 38, size: 1, p: P_BRAVE, kamon: 'IKEDA_CHO', bg: '#222', face: 'ikeda_terumasa.png', level: 1, exp: 0 },
    { name: "マグナス", side: 'EAST', class: 'INFANTRY', soldiers: 1000, ATK: 75, DEF: 75, AGI: 70, VIT: 50, INT: 25, MND: 20, LUK: 35, loyalty: 100, x: 50, y: 37, size: 1, p: P_BRAVE, kamon: 'MARUNI_MITSUBONSUGI', bg: '#222', face: 'togawa_michiyasu.png', level: 1, exp: 0 },

    // --- Empire (West) ---
    { name: "ヴァレン", side: 'WEST', class: 'MAGE', soldiers: 6900, ATK: 40, DEF: 85, AGI: 95, VIT: 30, INT: 95, MND: 70, LUK: 35, loyalty: 100, x: 8, y: 12, size: 2, p: P_LOYAL, kamon: 'DAIICHI', bg: '#4a0080', face: 'ishida_mitsunari.png', level: 1, exp: 0 },
    { name: "ドレイヴン", side: 'WEST', class: 'INFANTRY', soldiers: 1000, ATK: 95, DEF: 90, AGI: 85, VIT: 65, INT: 30, MND: 20, LUK: 25, loyalty: 100, x: 10, y: 14, size: 1, p: P_BRAVE, kamon: 'MITSU_GASHIWA', bg: '#8b0000', face: 'shima_sakon.png', level: 1, exp: 0 },
    { name: "ドリアン", side: 'WEST', class: 'INFANTRY', soldiers: 800, ATK: 80, DEF: 80, AGI: 80, VIT: 55, INT: 30, MND: 25, LUK: 35, loyalty: 100, x: 9, y: 13, size: 1, p: P_LOYAL, kamon: 'MUKAI_TSURU', bg: '#444', face: 'gamo_satoie.png', level: 1, exp: 0 },
    { name: "セイン", side: 'WEST', class: 'GUNNER', soldiers: 1500, ATK: 90, DEF: 35, AGI: 80, VIT: 40, INT: 55, MND: 15, LUK: 30, loyalty: 100, x: 12, y: 18, size: 1, p: P_BRAVE, kamon: 'MARUNI_JUJI', bg: '#222', face: 'shimazu_yoshihiro.png', level: 1, exp: 0 },
    { name: "リース", side: 'WEST', class: 'GUNNER', soldiers: 500, ATK: 85, DEF: 30, AGI: 75, VIT: 35, INT: 50, MND: 10, LUK: 25, loyalty: 100, x: 13, y: 19, size: 1, p: P_BRAVE, kamon: 'MARUNI_JUJI', bg: '#222', face: 'shimazu_toyohisa.png', level: 1, exp: 0 },
    { name: "カシウス", side: 'WEST', class: 'GUNNER', soldiers: 4000, ATK: 80, DEF: 30, AGI: 75, VIT: 35, INT: 55, MND: 15, LUK: 25, loyalty: 100, x: 15, y: 25, size: 1, p: P_CALM, kamon: 'GION_MAMORI', bg: '#333', face: 'konishi_yukinaga.png', level: 1, exp: 0 },
    { name: "ヴァレリウス", side: 'WEST', class: 'INFANTRY', soldiers: 17000, ATK: 85, DEF: 85, AGI: 80, VIT: 60, INT: 30, MND: 25, LUK: 30, loyalty: 100, x: 18, y: 30, size: 2, p: P_BRAVE, kamon: 'JI', bg: '#222', face: 'ukita_hideie.png', level: 1, exp: 0 },
    { name: "マーカス", side: 'WEST', class: 'INFANTRY', soldiers: 2000, ATK: 88, DEF: 80, AGI: 75, VIT: 55, INT: 25, MND: 20, LUK: 35, loyalty: 100, x: 20, y: 31, size: 1, p: P_BRAVE, kamon: 'JI', bg: '#444', face: 'akashi_teruzumi.png', level: 1, exp: 0 },
    { name: "エランドール", side: 'WEST', class: 'MAGE', soldiers: 600, ATK: 35, DEF: 50, AGI: 95, VIT: 30, INT: 90, MND: 80, LUK: 35, loyalty: 100, x: 15, y: 40, size: 1, p: P_CALM, kamon: 'MUKAI_CHO', bg: '#fff', face: 'otani_yoshitsugu.png', level: 1, exp: 0 },
    { name: "フロリアン", side: 'WEST', class: 'INFANTRY', soldiers: 1000, ATK: 75, DEF: 75, AGI: 70, VIT: 50, INT: 25, MND: 25, LUK: 30, loyalty: 100, x: 16, y: 41, size: 1, p: P_LOYAL, kamon: 'MUKAI_CHO', bg: '#ccc', face: 'ootani_yoshiharu.png', level: 1, exp: 0 },
    { name: "ギデオン", side: 'WEST', class: 'INFANTRY', soldiers: 1500, ATK: 70, DEF: 70, AGI: 60, VIT: 50, INT: 25, MND: 25, LUK: 35, loyalty: 100, x: 18, y: 39, size: 1, p: P_LOYAL, kamon: 'MUTSUBOSHI', bg: '#555', face: 'toda_shigemasa.png', level: 1, exp: 0 },
    { name: "フェンリス", side: 'WEST', class: 'INFANTRY', soldiers: 360, ATK: 75, DEF: 70, AGI: 60, VIT: 50, INT: 25, MND: 20, LUK: 35, loyalty: 100, x: 17, y: 42, size: 1, p: P_BRAVE, kamon: 'MITSU_UROKO', bg: '#555', face: 'hiratsuka_tamehiro.png', level: 1, exp: 0 },
    { name: "サイラス", side: 'WEST', class: 'SPEAR', soldiers: 990, ATK: 70, DEF: 55, AGI: 50, VIT: 45, INT: 20, MND: 15, LUK: 45, loyalty: 60, x: 12, y: 48, size: 1, p: P_COWARD, kamon: 'WA_CHIGAI', bg: '#666', face: 'wakisaka_yasuharu.png', level: 1, exp: 0 },
    { name: "ブレナン", side: 'WEST', class: 'ARCHER', soldiers: 600, ATK: 55, DEF: 35, AGI: 60, VIT: 35, INT: 30, MND: 15, LUK: 45, loyalty: 60, x: 13, y: 49, size: 1, p: P_COWARD, kamon: 'FOUR_DIAMONDS', bg: '#666', face: 'kuchiki_mototsuna.png', level: 1, exp: 0 },
    { name: "エクター", side: 'WEST', class: 'ARCHER', soldiers: 2100, ATK: 60, DEF: 35, AGI: 55, VIT: 35, INT: 25, MND: 15, LUK: 40, loyalty: 60, x: 11, y: 47, size: 1, p: P_COWARD, kamon: 'MARUNI_DAKIGASHIWA', bg: '#666', face: 'ogawa_suketada.png', level: 1, exp: 0 },
    { name: "ロデリック", side: 'WEST', class: 'GUNNER', soldiers: 600, ATK: 70, DEF: 25, AGI: 50, VIT: 30, INT: 35, MND: 10, LUK: 25, loyalty: 60, x: 10, y: 50, size: 1, p: P_COWARD, kamon: 'MARUNI_MITSUMEBISHI', bg: '#666', face: 'akaza_naoyasu.png', level: 1, exp: 0 },

    // --- Uncertain Forces (Hillfort) ---
    { name: "モルデカイ", side: 'WEST', class: 'INFANTRY', soldiers: 15600, ATK: 85, DEF: 80, AGI: 70, VIT: 55, INT: 30, MND: 25, LUK: 45, loyalty: 40, x: 5, y: 60, size: 2, p: P_COWARD, kamon: 'CHIGAI_GAMA', bg: '#a52a2a', face: 'kobayakawa_hideaki.png', level: 1, exp: 0 },
    { name: "バートラム", side: 'WEST', class: 'INFANTRY', soldiers: 1000, ATK: 75, DEF: 75, AGI: 60, VIT: 50, INT: 30, MND: 25, LUK: 35, loyalty: 50, x: 6, y: 61, size: 1, p: P_CALM, kamon: 'OSHIKI_NI_SAN', bg: '#888', face: 'inaba_masashige.png', level: 1, exp: 0 },

    // --- Uncertain Forces (South Garrison) ---
    { name: "アルデマール", side: 'WEST', class: 'INFANTRY', soldiers: 16000, ATK: 85, DEF: 90, AGI: 80, VIT: 60, INT: 35, MND: 30, LUK: 35, loyalty: 70, x: 60, y: 60, size: 2, p: P_CALM, kamon: 'MITSUBOSHI', bg: '#222', face: 'mouri_hidemoto.png', level: 1, exp: 0 },
    { name: "ヴォス", side: 'WEST', class: 'INFANTRY', soldiers: 3000, ATK: 80, DEF: 85, AGI: 85, VIT: 55, INT: 30, MND: 25, LUK: 30, loyalty: 20, x: 58, y: 58, size: 1, p: P_CALM, kamon: 'MITSUBOSHI', bg: '#333', face: 'kikkawa_hiroie.png', level: 1, exp: 0 },
    { name: "シルヴァン", side: 'WEST', class: 'MAGE', soldiers: 1800, ATK: 30, DEF: 40, AGI: 75, VIT: 30, INT: 80, MND: 75, LUK: 35, loyalty: 90, x: 62, y: 58, size: 1, p: P_CALM, kamon: 'TAKEDA_BISHI', bg: '#555', face: 'ankokuji_ekei.png', level: 1, exp: 0 },
    { name: "ラグナル", side: 'WEST', class: 'SPEAR', soldiers: 6600, ATK: 85, DEF: 55, AGI: 80, VIT: 55, INT: 20, MND: 15, LUK: 30, loyalty: 80, x: 65, y: 55, size: 1, p: P_BRAVE, kamon: 'KATABAMI', bg: '#333', face: 'chosokabe_nobuchika.png', level: 1, exp: 0 },
    { name: "アリステア", side: 'WEST', class: 'ARCHER', soldiers: 1500, ATK: 60, DEF: 35, AGI: 70, VIT: 35, INT: 30, MND: 20, LUK: 45, loyalty: 90, x: 63, y: 56, size: 1, p: P_LOYAL, kamon: 'HANABISHI', bg: '#444', face: 'nagatsuka_masaie.png', level: 1, exp: 0 }
];
