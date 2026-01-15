/**
 * SEKIGAHARA RTS - Formation System
 * 陣形システム: スクエアグリッド対応版
 */

import { MAP_W, MAP_H, FORMATION_HOKO, FORMATION_KAKUYOKU, FORMATION_GYORIN } from './constants.js';
import { TERRAIN_TYPES } from './map.js';

/**
 * 陣形情報を取得
 */
export const FORMATION_INFO = {
    [FORMATION_HOKO]: {
        name: '鋒矢の陣',
        nameShort: '鋒矢',
        description: '攻撃+20 / 防御-20\n先陣を切って攻める',
        atkMod: 20,
        defMod: -20,
        requiredSubordinates: 0,
        // ▲型（東向き・本陣が最前列の頂点）
        // ★ = 本陣(HQ)が先頭、配下は後方に広がる
        // 最後列は両端のみ配置（中央は空き）
        slots: [
            // 2列目（本陣直後）: 02, 04, 03
            { x: -1, y: -1 }, { x: -1, y: 0 }, { x: -1, y: 1 },
            // 3列目: 05, 07, 09, 08, 06
            { x: -2, y: -2 }, { x: -2, y: -1 }, { x: -2, y: 0 }, { x: -2, y: 1 }, { x: -2, y: 2 },
            // 4列目: 10, 12, 14, 16, 15, 13, 11
            { x: -3, y: -3 }, { x: -3, y: -2 }, { x: -3, y: -1 }, { x: -3, y: 0 }, { x: -3, y: 1 }, { x: -3, y: 2 }, { x: -3, y: 3 },
            // 5列目: 17, 19, 21, 23, 25, 24, 22, 20, 18
            { x: -4, y: -4 }, { x: -4, y: -3 }, { x: -4, y: -2 }, { x: -4, y: -1 }, { x: -4, y: 0 }, { x: -4, y: 1 }, { x: -4, y: 2 }, { x: -4, y: 3 }, { x: -4, y: 4 },
            // 6列目（両端のみ）: 26, 28, 30 ... 29, 27
            { x: -5, y: -5 }, { x: -5, y: -4 }, { x: -5, y: -3 }, { x: -5, y: 3 }, { x: -5, y: 4 }, { x: -5, y: 5 }
        ]
    },
    [FORMATION_KAKUYOKU]: {
        name: '鶴翼の陣',
        nameShort: '鶴翼',
        description: '攻撃±0 / 防御±0\nバランス型の陣形',
        atkMod: 0,
        defMod: 0,
        requiredSubordinates: 1,
        // V字型（南向き・本陣は中央後方、翼が前方に広がる）
        // 配置優先順: 本陣に近い位置から左右交互 → V先端 → 本陣後方
        slots: [
            // 本陣に最も近い翼（1列目）- 左右交互
            { x: 1, y: -1 }, { x: 1, y: 1 },
            // 2列目 - 左右交互
            { x: 2, y: -2 }, { x: 2, y: 2 },
            // 3列目 - 左右交互
            { x: 3, y: -3 }, { x: 3, y: 3 },
            // 翼の厚み補強（内側）- 左右交互
            { x: 1, y: -2 }, { x: 1, y: 2 },
            { x: 2, y: -3 }, { x: 2, y: 3 },
            { x: 3, y: -4 }, { x: 3, y: 4 },
            // V字の先端（本陣から最遠）
            { x: 4, y: -4 }, { x: 4, y: 4 },
            { x: 5, y: -5 }, { x: 5, y: 5 },
            // 本陣周辺（横）
            { x: 0, y: -1 }, { x: 0, y: 1 },
            // 本陣後方
            { x: -1, y: -1 }, { x: -1, y: 0 }, { x: -1, y: 1 },
            { x: -2, y: -1 }, { x: -2, y: 0 }, { x: -2, y: 1 },
            { x: -3, y: 0 }, { x: -3, y: -1 }, { x: -3, y: 1 },
            { x: -4, y: 0 }
        ]
    },
    [FORMATION_GYORIN]: {
        name: '魚鱗の陣',
        nameShort: '魚鱗',
        description: '攻撃-20 / 防御+20\n本陣を守る堅陣',
        atkMod: -20,
        defMod: 20,
        requiredSubordinates: 2,
        // Cluster around HQ
        slots: [
            // Ring 1
            { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: -1 },
            // Ring 2
            { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 2 }, { x: -1, y: 2 }, { x: -2, y: 2 }, { x: -2, y: 1 },
            { x: -2, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -2 }, { x: 1, y: -2 }, { x: 2, y: -2 }, { x: 2, y: -1 },
            // Ring 3 (Front Heavy)
            { x: 3, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 3 }, { x: 3, y: -1 }, { x: 2, y: -3 },
            { x: -3, y: 0 }, { x: -3, y: 3 }, { x: -3, y: -3 }, { x: -1, y: 3 }, { x: -1, y: -3 }, { x: 1, y: -3 }
        ]
    }
};

/**
 * 陣形によるステータス修正を取得
 */
export function getFormationModifiers(formation) {
    if (!formation || !FORMATION_INFO[formation]) {
        return { atk: 0, def: 0 };
    }
    const info = FORMATION_INFO[formation];
    return { atk: info.atkMod, def: info.defMod };
}

/**
 * 座標を回転させる (Square Grid Rotation)
 * @param {number} x 
 * @param {number} y 
 * @param {number} rotation 0-3 (90 degree steps clockwise)
 */
function rotateSquare(x, y, rotation) {
    let nx = x;
    let ny = y;
    for (let i = 0; i < rotation; i++) {
        // Clockwise rotation: (x, y) -> (-y, x)
        const temp = nx;
        nx = -ny;
        ny = temp;
    }
    return { x: nx, y: ny };
}

/**
 * 座標が有効かつ通行可能かチェック
 */
function isValidPosition(x, y, mapSystem) {
    if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return false;
    if (mapSystem) {
        const tile = mapSystem.getTile(x, y);
        if (!tile) return false; // マップ範囲外
        if (TERRAIN_TYPES[tile.type] && !TERRAIN_TYPES[tile.type].passable) return false; // 通行不可地形
        if (tile.type === 'MTN') return false; // 念のため明示的チェック
    }
    // マップシステムが無い場合は単純な範囲チェックのみ
    return true;
}

/**
 * 最も近い有効な移動先を探す
 */
function findNearestValidPosition(bx, by, mapSystem) {
    if (isValidPosition(bx, by, mapSystem)) return { x: bx, y: by };

    // スパイラル探索オフセット（中心から近い順）
    // 距離1, 距離2 (斜め含む)
    const offsets = [
        { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }, // 4方向
        { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }, // 斜め
        { x: 2, y: 0 }, { x: 0, y: 2 }, { x: -2, y: 0 }, { x: 0, y: -2 } // 距離2
    ];

    for (const d of offsets) {
        const nx = bx + d.x;
        const ny = by + d.y;
        if (isValidPosition(nx, ny, mapSystem)) return { x: nx, y: ny };
    }

    // 見つからない場合は元の座標を返す（パスファインディングに任せる）
    return { x: bx, y: by };
}

/**
 * 本陣と配下ユニットの陣形目標座標を計算
 * @param {Object} hq 本陣ユニット
 * @param {Array} subordinates 配下ユニットのリスト
 * @param {Object} mapSystem マップシステム (地形チェック用)
 */
export function calculateFormationTargets(hq, subordinates, mapSystem) {
    const info = FORMATION_INFO[hq.formation];
    if (!info || !info.slots) return null;

    const targets = new Map(); // unitId -> {x, y}
    const dir = hq.dir !== undefined ? hq.dir : 0; // 0-3

    // スロットを回転させて絶対座標に変換
    const availableSlots = info.slots.map(slot => {
        const rotated = rotateSquare(slot.x, slot.y, dir);
        return {
            x: hq.x + rotated.x,
            y: hq.y + rotated.y
        };
    });

    // ユニットをスロットに割り当て
    for (let i = 0; i < subordinates.length; i++) {
        if (i < availableSlots.length) {
            // スロット座標が有効かチェックし、無効なら近くを探す
            const slot = availableSlots[i];
            const validPos = findNearestValidPosition(slot.x, slot.y, mapSystem);
            targets.set(subordinates[i].id, validPos);
        } else {
            // スロット不足時は本陣の位置（あるいは近く）
            targets.set(subordinates[i].id, { x: hq.x, y: hq.y });
        }
    }

    return targets;
}

/**
 * グリッド4方向オフセット
 */
const GRID_DIRECTIONS = [
    { x: 1, y: 0 },   // 0: 東 (Right)
    { x: 0, y: 1 },   // 1: 南 (Down)
    { x: -1, y: 0 },  // 2: 西 (Left)
    { x: 0, y: -1 }   // 3: 北 (Up)
];

/**
 * 進行方向から最も近い4方向のインデックスを取得
 * @returns {number} 0-3の方向インデックス
 */
function getDirectionIndex(fromX, fromY, toX, toY) {
    const dx = toX - fromX;
    const dy = toY - fromY;

    // y軸は下が正なので、atan2(dy, dx) で角度を得る
    // 0度=右(1,0), 90度=下(0,1), 180度=左(-1,0), -90度=上(0,-1)
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    if (angle < 0) angle += 360;

    // 0, 90, 180, 270 に近い値をインデックス化
    // round(angle / 90) % 4
    return Math.round(angle / 90) % 4;
}

/**
 * 進行方向の左右のグリッド座標を取得
 * @returns {{left: {x, y}, right: {x, y}}}
 */
function getLeftRightTiles(x, y, dirIndex) {
    // 0(右) -> 左は上(3), 右は下(1)
    // 左: -1 (mod 4) -> +3 (mod 4)
    // 右: +1 (mod 4)
    const leftIndex = (dirIndex + 3) % 4;
    const rightIndex = (dirIndex + 1) % 4;

    return {
        left: {
            x: x + GRID_DIRECTIONS[leftIndex].x,
            y: y + GRID_DIRECTIONS[leftIndex].y
        },
        right: {
            x: x + GRID_DIRECTIONS[rightIndex].x,
            y: y + GRID_DIRECTIONS[rightIndex].y
        }
    };
}

/**
 * 陣形要件を満たすか判定 (旧互換用、現在は常にtrue)
 */
export function canMoveWithFormation(hqUnit, subordinateUnits, targetX, targetY, formation) {
    return true;
}

/**
 * 配下ユニット数に基づいて選択可能な陣形を取得
 */
export function getAvailableFormations(subordinateCount) {
    const available = [];
    available.push(FORMATION_HOKO);
    if (subordinateCount >= 1) available.push(FORMATION_KAKUYOKU);
    if (subordinateCount >= 2) available.push(FORMATION_GYORIN);
    return available;
}

/**
 * 本陣兵力に基づいて強制的に陣形を変更する必要があるかチェック
 */
export function checkForcedFormationChange(hqSoldiers, currentFormation) {
    // 500以下 → 魚鱗に強制変更
    if (hqSoldiers <= 500) {
        if (currentFormation !== FORMATION_GYORIN) {
            return { needsChange: true, newFormation: FORMATION_GYORIN };
        }
    }
    // 800以下 → 鶴翼に強制変更
    else if (hqSoldiers <= 800) {
        if (currentFormation !== FORMATION_GYORIN && currentFormation !== FORMATION_KAKUYOKU) {
            return { needsChange: true, newFormation: FORMATION_KAKUYOKU };
        }
    }
    return { needsChange: false, newFormation: null };
}
