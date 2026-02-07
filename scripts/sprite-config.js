/**
 * SEKIGAHARA RTS - Sprite Configuration
 * 個別スプライトファイルによるアニメーション定義
 */

// スプライトファイルのベースパス（シート画像）
// スプライトファイルのベースパス（シート画像）
// 後方互換性のため残すが、基本はSPRITE_PATHSを使用する
export const SPRITE_SHEET_PATH = 'sprites/soldier/soldier.png';

// ユニットタイプごとのスプライトファイル定義
export const SPRITE_PATHS = {
    DEFAULT: 'sprites/soldier/soldier.png',
    ARCHER: 'sprites/archer/archer.png',
    MAGE: 'sprites/mage/mage.png',
    PRIEST: 'sprites/priest/priest.png'
};

// ユニットタイプIDとスプライトキーの対応
export const UNIT_TYPE_TO_SPRITE = {
    'ARCHER': 'ARCHER',
    'MAGE': 'MAGE',
    // 他はデフォルトを使用するため定義省略可、または明示的に指定
    'INFANTRY': 'DEFAULT',
    'SPEAR': 'DEFAULT',
    'GUNNER': 'DEFAULT',
    // 'MAGE': 'DEFAULT', // Removed duplicate override
    'PRIEST': 'PRIEST',
    'KNIGHT': 'DEFAULT',
    'CAVALRY': 'DEFAULT'
};

// スプライトシート構成
export const SHEET_LAYOUT = {
    cols: 7,
    rows: 4
};

/**
 * 方向定義（クォータービュー4方向）
 * ゲーム内の dir (0=右, 1=下, 2=左, 3=上) との対応
 * isBack: trueなら +7 オフセット（back_left列を使用）
 */
export const DIRECTIONS = {
    0: { name: 'front_right', isBack: false, flip: false },  // 右（右下向き）
    1: { name: 'front_right', isBack: false, flip: true },   // 下（左下向き）
    2: { name: 'back_left', isBack: true, flip: false },    // 左（左上向き）
    3: { name: 'back_left', isBack: true, flip: true }      // 上（右上向き）
};

/**
 * アニメーション定義
 * indices: 使用するスプライト番号（front_right基準）
 * speed: アニメーション速度（ミリ秒/フレーム）
 * loop: ループするかどうか
 * 
 * note: back_leftの場合は index + 7 される
 */
export const ANIMATIONS = {
    // 行動済みユニット（静止）
    idle: {
        indices: [0], // 00
        speed: 1000,
        loop: false
    },
    // 未行動ユニット（待機中、体を揺らす）
    ready: {
        indices: [1, 2], // 01, 02
        speed: 300,
        loop: true
    },
    // 移動中
    walk: {
        indices: [1, 2], // 01, 02
        speed: 200,
        loop: true
    },
    // 攻撃中 (旧互換)
    attack: {
        indices: [17, 18], // 17, 18
        speed: 150,
        loop: true
    },
    // 射撃（弓・銃）
    shoot: {
        indices: [18], // 18=Aim (修正)
        speed: 1000,   // ループしないので適当
        loop: false
    },
    // 攻撃パターン1（通常）
    attack1: {
        indices: [17], // 17=Wind up (溜め)
        speed: 150,
        loop: false // ループさせない
    },
    // 攻撃パターン2（強攻撃/別パターン）
    attack2: {
        indices: [17, 18], // 17->18 (振り下ろし)
        speed: 100, // 高速
        loop: false // 一回切り
    },
    // 被ダメージ
    damage: {
        indices: [3], // 03
        speed: 300,
        loop: false
    },
    // 倒れ
    death: {
        indices: [14], // 14
        speed: 500,
        loop: false
    },
    // 防御
    defence: {
        indices: [4], // 04
        speed: 300,
        loop: false
    },
    // 勝利ポーズ
    victory: {
        indices: [6, 5], // 06, 05
        speed: 500,
        loop: true
    },
    // 魔法
    magic: {
        indices: [15],
        speed: 300,
        loop: true
    },
    // 会話
    talk: {
        indices: [16],
        speed: 200,
        loop: true
    }
};

/**
 * 軍マーカーの色
 */
export const ARMY_COLORS = {
    EAST: 0x88AAEE,  // 青（東軍）
    WEST: 0xEE4444   // 赤（西軍）
};

/**
 * スプライト情報取得ヘルパー（廃止予定だが互換性のため残す、または用途変更）
 * @param {number} dir - 方向 (0-3)
 * @param {number} baseIndex - front_right基準のインデックス
 * @returns {{ index: number, flip: boolean }}
 */
export function getSpriteIndex(dir, baseIndex) {
    const dirInfo = DIRECTIONS[dir] || DIRECTIONS[0];
    const offset = dirInfo.isBack ? 7 : 0;
    return {
        index: baseIndex + offset,
        flip: dirInfo.flip
    };
}
