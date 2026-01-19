/**
 * Fantasy RTS - Attack Patterns
 * ユニットタイプ別の攻撃範囲パターン定義
 */

/**
 * 攻撃範囲パターン（相対座標配列）
 * 各パターンは[{dx, dy}, ...]の形式
 * dx: x方向オフセット（正=右）
 * dy: y方向オフセット（正=下/前方）
 * 
 * 注意: これらは「前方向き（dir=0）」時のパターン
 * 実際の攻撃時にはユニットの向きに応じて回転させる
 */
export const ATTACK_PATTERNS = {
    // 近接攻撃：周囲4マス（歩兵・騎士）
    melee: [
        { dx: 0, dy: -1 },  // 前
        { dx: 1, dy: 0 },   // 右
        { dx: 0, dy: 1 },   // 後
        { dx: -1, dy: 0 }   // 左
    ],

    // 前方2マス攻撃（槍兵・騎兵）
    forward2: [
        { dx: 0, dy: -1 },  // 前方1マス目
        { dx: 0, dy: -2 }   // 前方2マス目
    ],

    // 周囲2マス回復範囲（僧侶）
    heal: [
        // 1マス目
        { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
        // 1.5マス（斜め）
        { dx: 1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 },
        // 2マス目
        { dx: 0, dy: -2 }, { dx: 2, dy: 0 }, { dx: 0, dy: 2 }, { dx: -2, dy: 0 }
    ],

    // 弓：射程5の円弧（ドーナツ状、近接は含まない）
    // ユーザーのアスキーアートから変換
    bowArc: generateArcPattern(3, 5),

    // 長銃：射程6の円弧（弓より長い）
    longArc: generateArcPattern(3, 6),

    // 魔術師：範囲攻撃（中心＋周囲8マス）
    // 射程4のドーナツ形で、着弾点＋周囲を攻撃
    aoe: generateArcPattern(2, 4),

    // ドラゴンブレス：前方扇状
    breath: [
        // 近距離（2マス先から）
        { dx: 0, dy: -2 }, { dx: -1, dy: -2 }, { dx: 1, dy: -2 },
        // 中距離
        { dx: 0, dy: -3 }, { dx: -1, dy: -3 }, { dx: 1, dy: -3 }, { dx: -2, dy: -3 }, { dx: 2, dy: -3 },
        // 遠距離
        { dx: 0, dy: -4 }, { dx: -1, dy: -4 }, { dx: 1, dy: -4 }, { dx: -2, dy: -4 }, { dx: 2, dy: -4 }
    ],

    // 砲兵：超長射程の直線（前方8マス）
    siege: [
        { dx: 0, dy: -3 }, { dx: 0, dy: -4 }, { dx: 0, dy: -5 },
        { dx: 0, dy: -6 }, { dx: 0, dy: -7 }, { dx: 0, dy: -8 }
    ]
};

/**
 * ドーナツ状の円弧パターンを生成
 * @param {number} minRange - 最小射程（これより近いと攻撃不可）
 * @param {number} maxRange - 最大射程
 * @returns {Array<{dx: number, dy: number}>} 攻撃可能なグリッドの相対座標配列
 */
function generateArcPattern(minRange, maxRange) {
    const pattern = [];
    for (let dx = -maxRange; dx <= maxRange; dx++) {
        for (let dy = -maxRange; dy <= maxRange; dy++) {
            const dist = Math.abs(dx) + Math.abs(dy); // マンハッタン距離
            if (dist >= minRange && dist <= maxRange) {
                pattern.push({ dx, dy });
            }
        }
    }
    return pattern;
}

/**
 * ユニットの向きに応じてパターンを回転
 * @param {Array} pattern - 攻撃パターン
 * @param {number} dir - ユニットの向き (0=上, 1=右, 2=下, 3=左)
 * @returns {Array} 回転後のパターン
 */
export function rotatePattern(pattern, dir) {
    return pattern.map(({ dx, dy }) => {
        switch (dir) {
            case 0: return { dx, dy };           // 上向き（そのまま）
            case 1: return { dx: -dy, dy: dx };  // 右向き（90度時計回り）
            case 2: return { dx: -dx, dy: -dy }; // 下向き（180度）
            case 3: return { dx: dy, dy: -dx };  // 左向き（270度）
            default: return { dx, dy };
        }
    });
}

/**
 * 指定位置が攻撃範囲内かどうか判定
 * @param {Object} attacker - 攻撃ユニット {x, y, dir, unitType}
 * @param {Object} target - 対象位置 {x, y}
 * @param {string} rangeType - 攻撃パターンタイプ
 * @returns {boolean} 攻撃可能かどうか
 */
export function isInAttackRange(attacker, target, rangeType) {
    const pattern = ATTACK_PATTERNS[rangeType];
    if (!pattern) return false;

    const rotated = rotatePattern(pattern, attacker.dir || 0);
    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;

    return rotated.some(p => p.dx === dx && p.dy === dy);
}

/**
 * ユニットの攻撃可能なグリッド座標リストを取得
 * @param {Object} unit - ユニット {x, y, dir, unitType}
 * @param {string} rangeType - 攻撃パターンタイプ
 * @returns {Array<{x: number, y: number}>} 攻撃可能なグリッド座標
 */
export function getAttackableGrids(unit, rangeType) {
    const pattern = ATTACK_PATTERNS[rangeType];
    if (!pattern) return [];

    const rotated = rotatePattern(pattern, unit.dir || 0);
    return rotated.map(({ dx, dy }) => ({
        x: unit.x + dx,
        y: unit.y + dy
    }));
}

/**
 * パターンタイプから表示名を取得
 */
export const RANGE_TYPE_NAMES = {
    melee: '近接',
    forward2: '前衛',
    heal: '回復',
    bowArc: '弓',
    longArc: '銃',
    aoe: '範囲魔法',
    breath: 'ブレス',
    siege: '砲撃'
};
