/**
 * SEKIGAHARA RTS - Sprite Configuration
 * 個別スプライトファイルによるアニメーション定義
 */

// スプライトファイルのベースパス
export const SPRITE_BASE_PATH = 'sprites/soldier/';

/**
 * 方向定義（クォータービュー4方向）
 * ゲーム内の dir (0=右, 1=下, 2=左, 3=上) との対応
 * クォータービューでは：
 *   0 (右) → front_right（右下向き）
 *   1 (下) → front_left（左下向き）← front_rightを反転
 *   2 (左) → back_left（左上向き）
 *   3 (上) → back_right（右上向き）← back_leftを反転
 */
export const DIRECTIONS = {
    0: { prefix: 'front_right', flip: false },  // 右（右下向き）
    1: { prefix: 'front_right', flip: true },   // 下（左下向き）= front_right反転
    2: { prefix: 'back_left', flip: false },    // 左（左上向き）
    3: { prefix: 'back_left', flip: true }      // 上（右上向き）= back_left反転
};

/**
 * アニメーション定義
 * frameIds: 使用するフレーム番号（ファイル名の末尾2桁）
 * speed: アニメーション速度（ミリ秒/フレーム）
 * loop: ループするかどうか
 */
export const ANIMATIONS = {
    // 行動済みユニット（静止）
    idle: {
        frameIds: ['00'],
        speed: 1000,
        loop: false
    },
    // 未行動ユニット（待機中、体を揺らす）
    ready: {
        frameIds: ['01', '02'],
        speed: 300,
        loop: true
    },
    // 移動中
    walk: {
        frameIds: ['01', '02'],
        speed: 200,
        loop: true
    },
    // 攻撃中
    attack: {
        frameIds: ['03', '04'],
        speed: 150,
        loop: true
    },
    // 被ダメージ
    damage: {
        frameIds: ['05'],
        speed: 300,
        loop: false
    },
    // 倒れ
    death: {
        frameIds: ['06'],
        speed: 500,
        loop: false
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
 * スプライトのファイルパスを取得
 * @param {number} dir - 方向 (0-3)
 * @param {string} frameId - フレーム番号 ('00'-'06')
 * @returns {{ path: string, flip: boolean }}
 */
export function getSpriteInfo(dir, frameId) {
    const dirInfo = DIRECTIONS[dir] || DIRECTIONS[0];
    const path = `${SPRITE_BASE_PATH}${dirInfo.prefix}_${frameId}.png`;
    return { path, flip: dirInfo.flip };
}

/**
 * 全スプライトファイルのパスを取得（プリロード用）
 */
export function getAllSpritePaths() {
    const paths = [];
    const prefixes = ['back_left', 'front_right'];
    const frameIds = ['00', '01', '02', '03', '04', '05', '06'];

    for (const prefix of prefixes) {
        for (const frameId of frameIds) {
            paths.push(`${SPRITE_BASE_PATH}${prefix}_${frameId}.png`);
        }
    }
    return paths;
}
