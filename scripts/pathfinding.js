/**
 * Fantasy RTS - Pathfinding (Square Grid)
 * A*アルゴリズムによる障害物回避パスファインディング（スクエアグリッド対応）
 */

import { TILE_SIZE, MAP_W, MAP_H } from './constants.js';
import { TERRAIN_TYPES } from './map.js';

// 旧API互換性のためのエイリアス
export const HEX_SIZE = TILE_SIZE;

/**
 * グリッド座標をピクセル座標に変換（アイソメトリック）
 */
export function gridToPixel(x, y) {
    return {
        x: (x - y) * TILE_SIZE / 2,
        z: (x + y) * TILE_SIZE / 4
    };
}

// 旧API互換
export function hexToPixel(q, r) {
    const result = gridToPixel(q, r);
    return { x: result.x, y: result.z };
}

/**
 * ピクセル座標をグリッド座標に変換（アイソメトリック逆変換）
 */
export function pixelToGrid(px, pz) {
    const gx = (px / (TILE_SIZE / 2) + pz / (TILE_SIZE / 4)) / 2;
    const gy = (pz / (TILE_SIZE / 4) - px / (TILE_SIZE / 2)) / 2;
    return { x: Math.round(gx), y: Math.round(gy) };
}

// 旧API互換
export function pixelToHex(mx, my, camera) {
    // カメラオフセット適用（旧APIとの互換性のため）
    let wx = camera ? (mx - camera.x) / camera.zoom : mx;
    let wy = camera ? (my - camera.y) / camera.zoom : my;
    const result = pixelToGrid(wx, wy);
    return { q: result.x, r: result.y };
}

// 旧API互換（使用されなくなったが残す）
export function cubeRound(c) {
    return { q: Math.round(c.q), r: Math.round(c.r) };
}

/**
 * 座標が有効範囲内かチェック
 */
export function isValidCoord(coord) {
    return coord.x >= 0 && coord.x < MAP_W && coord.y >= 0 && coord.y < MAP_H;
}

// 旧API互換
export function isValidHex(h) {
    return h.q >= 0 && h.q < MAP_W && h.r >= 0 && h.r < MAP_H;
}

/**
 * 2点間のマンハッタン距離を計算（スクエアグリッド用）
 */
export function getDistRaw(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

/**
 * ユニット間の距離を計算
 */
export function getDist(u1, u2) {
    return getDistRaw(u1.x, u1.y, u2.x, u2.y);
}

/**
 * チェビシェフ距離（斜め移動も距離1）
 * 攻撃判定などに使用
 */
export function getDistChebyshev(u1, u2) {
    return Math.max(Math.abs(u1.x - u2.x), Math.abs(u1.y - u2.y));
}

// 攻撃距離用エイリアス
export const getDistAttack = getDistChebyshev;

/**
 * 直線パス（シンプル版、マンハッタン経路）
 */
export function getLine(x1, y1, x2, y2) {
    const N = getDistRaw(x1, y1, x2, y2);
    const res = [];
    if (N === 0) {
        return [{ x: x1, y: y1 }];
    }
    for (let i = 0; i <= N; i++) {
        const t = i / N;
        res.push({
            x: Math.round(x1 + (x2 - x1) * t),
            y: Math.round(y1 + (y2 - y1) * t)
        });
    }
    return res;
}

/**
 * 目標地点までの予想ターン数を計算
 * @param {Object} unit - 移動するユニット
 * @param {number} targetX - 目標X座標
 * @param {number} targetY - 目標Y座標
 * @param {Object} mapSystem - マップシステム
 * @param {Array} units - 全ユニットリスト（障害物判定用）
 * @returns {number} 予想ターン数 (Infinity if unreachable)
 */
export function estimateTurns(unit, targetX, targetY, mapSystem, units) {
    if (unit.x === targetX && unit.y === targetY) return 0;

    const path = findPath(unit.x, unit.y, targetX, targetY, units, unit, mapSystem);
    if (!path || path.length < 2) return Infinity; // パスなし、または移動不要

    // パスからコスト計算
    let totalCost = 0;
    // canFlyプロパティがあるか不明だが、あれば使う
    const canFly = unit.canFly || false;

    for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i + 1];
        // p2への移動コスト
        let cost = mapSystem.getMoveCost(p1, p2, canFly);

        // getMoveCostは 1.0, 1.5, Infinity 等を返す
        if (cost === Infinity) cost = 999;

        totalCost += cost;
    }

    const move = unit.movePower || unit.move || 6; // デフォルト6
    // ターン数は ceil(総コスト / 移動力)
    // ただし、移動力ちょうどの残りで次のターンに行けるかなどの細かいルールはあるが、
    // ここでは単純な割り算で概算する。
    // （例: Move 6, Cost 4+4=8 -> 2ターン）

    // より正確には、毎ターン move だけ進んで、残りは持ち越せないルールならシミュレーションが必要。
    // Fantasy RTSのルールでは「移動力使い切り」が一般的。
    // Cost 4 の森に入ると残り移動力が 2 になり、次の Cost 4 の森には入れない -> 次ターン。
    // ここまで厳密にやるにはシミュレーションが必要だが、今回は概算でOKとするか、シミュレーションするか。
    // ユーザーは「予想ターン数」と言っているので、単純な割り算よりはシミュレーションの方が親切。

    let turns = 1;
    let currentMove = move;

    for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i + 1];
        let cost = mapSystem.getMoveCost(p1, p2, canFly);
        if (cost === Infinity) return Infinity;

        if (currentMove >= cost) {
            currentMove -= cost;
        } else {
            turns++;
            currentMove = move - cost;
            // 1歩も動けない場合（最大移動力 < コスト）は移動不可とみなすか、最低1歩は動けるとするか
            if (currentMove < 0) return Infinity; // 移動不可
        }
    }

    return turns;
}

/**
 * 到達可能なタイルを取得（移動範囲表示用）
 * @param {number} startX - 開始X座標
 * @param {number} startY - 開始Y座標
 * @param {number} maxMove - 最大移動力
 * @param {Object} mapSystem - マップシステム（コスト計算用）
 * @param {boolean} canFly - 飛行ユニットかどうか
 * @returns {Array<{x:number, y:number}>} 到達可能なタイルのリスト
 */
export function getReachableTiles(startX, startY, maxMove, mapSystem, canFly = false) {
    const reachable = [];
    // 訪問済みセット: "x,y" => cost
    const visited = new Map();

    // 優先度付きキューの代わりに単純な配列とソートを使う（実装簡易化）
    // { x, y, cost }
    const queue = [{ x: startX, y: startY, cost: 0 }];
    visited.set(`${startX},${startY}`, 0);

    while (queue.length > 0) {
        // コストが小さい順に処理
        queue.sort((a, b) => a.cost - b.cost);
        const current = queue.shift();

        reachable.push({ x: current.x, y: current.y });

        const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dy] of neighbors) {
            const nx = current.x + dx;
            const ny = current.y + dy;
            const key = `${nx},${ny}`;

            // マップ範囲外チェックはgetMoveCost内で行われるが、呼び出し前に弾くのもあり

            // コスト計算
            const moveCost = mapSystem.getMoveCost({ x: current.x, y: current.y }, { x: nx, y: ny }, canFly);

            if (moveCost !== Infinity) {
                const newCost = current.cost + moveCost;
                if (newCost <= maxMove) {
                    // より低コストで到達できるなら更新
                    if (!visited.has(key) || visited.get(key) > newCost) {
                        visited.set(key, newCost);
                        queue.push({ x: nx, y: ny, cost: newCost });
                    }
                }
            }
        }
    }
    return reachable;
}

/**
 * 隣接グリッドを取得（4方向）
 */
function getNeighbors(x, y) {
    const directions = [
        [1, 0],   // 右
        [-1, 0],  // 左
        [0, 1],   // 下
        [0, -1]   // 上
    ];
    return directions
        .map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
        .filter(coord => isValidCoord(coord));
}

/**
 * 他のユニットが障害物となるかチェック（味方と敵を区別）
 */
function getBlockingInfo(x, y, units, movingUnit) {
    for (const u of units) {
        if (u.id === movingUnit.id || u.dead) continue;

        const dist = getDistRaw(x, y, u.x, u.y);
        if (dist < (movingUnit.radius + u.radius)) {
            return {
                blocked: true,
                isFriendly: u.side === movingUnit.side,
                unit: u
            };
        }
    }
    return { blocked: false, isFriendly: false, unit: null };
}

/**
 * 従来のisBlocked関数（敵ユニットのみブロック）
 */
function isBlocked(x, y, units, movingUnitId, movingUnitRadius, movingUnitSide) {
    return units.some(u =>
        u.id !== movingUnitId &&
        !u.dead &&
        u.side !== movingUnitSide && // 敵のみブロック
        getDistRaw(x, y, u.x, u.y) < (movingUnitRadius + u.radius)
    );
}

/**
 * A*アルゴリズムによるパスファインディング
 * 他のユニットを避けるルートを探索
 */
export function findPath(startX, startY, goalX, goalY, units, movingUnit, mapSystem) {
    // 目標と同じ位置にいる場合
    if (startX === goalX && startY === goalY) {
        return [{ x: startX, y: startY }];
    }

    // 直線距離が近い場合は直線パスを試す
    const straightPath = getLine(startX, startY, goalX, goalY);
    let blocked = false;
    for (let i = 1; i < straightPath.length; i++) {
        const blockInfo = getBlockingInfo(straightPath[i].x, straightPath[i].y, units, movingUnit);
        // 敵ユニットのみブロック扱い
        if (blockInfo.blocked && !blockInfo.isFriendly) {
            blocked = true;
            break;
        }
        // 地形チェック
        if (mapSystem) {
            let tile = null;
            if (mapSystem.getTile) tile = mapSystem.getTile(straightPath[i].x, straightPath[i].y);
            else if (Array.isArray(mapSystem) && mapSystem[straightPath[i].y]) tile = mapSystem[straightPath[i].y][straightPath[i].x];

            if (tile && TERRAIN_TYPES[tile.type] && !TERRAIN_TYPES[tile.type].passable) {
                blocked = true;
                break;
            }

            // 高低差チェック（降りる場合も段差2まで制限）
            const canFly = movingUnit && (movingUnit.canFly || movingUnit.type === 'FLYING');
            if (!canFly && mapSystem.getMoveCost && mapSystem.getHeight) {
                // 前の位置から現在の位置への移動コストを確認
                const prevX = straightPath[i - 1].x;
                const prevY = straightPath[i - 1].y;
                const currX = straightPath[i].x;
                const currY = straightPath[i].y;
                const moveCost = mapSystem.getMoveCost(
                    { x: prevX, y: prevY },
                    { x: currX, y: currY },
                    false
                );
                if (moveCost === Infinity || moveCost >= 999) {
                    blocked = true;
                    break;
                }
            }
        }
    }
    if (!blocked) {
        return straightPath;
    }

    // A*探索
    const openSet = [{ x: startX, y: startY }];
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    const key = (x, y) => `${x},${y}`;
    gScore.set(key(startX, startY), 0);
    fScore.set(key(startX, startY), getDistRaw(startX, startY, goalX, goalY));

    let iterations = 0;
    const maxIterations = 1000;

    while (openSet.length > 0 && iterations < maxIterations) {
        iterations++;

        // fScoreが最小のノードを取得
        openSet.sort((a, b) =>
            (fScore.get(key(a.x, a.y)) || Infinity) - (fScore.get(key(b.x, b.y)) || Infinity)
        );
        const current = openSet.shift();
        const currentKey = key(current.x, current.y);

        // ゴールに到達
        if (current.x === goalX && current.y === goalY) {
            const path = [];
            let node = current;
            while (node) {
                path.unshift(node);
                node = cameFrom.get(key(node.x, node.y));
            }
            return path;
        }

        closedSet.add(currentKey);

        // 隣接ノードを探索（4方向）
        for (const neighbor of getNeighbors(current.x, current.y)) {
            const neighborKey = key(neighbor.x, neighbor.y);

            if (closedSet.has(neighborKey)) continue;

            // ブロック情報を取得
            const blockInfo = getBlockingInfo(neighbor.x, neighbor.y, units, movingUnit);

            // ゴールでない場合の障害物チェック
            if (!(neighbor.x === goalX && neighbor.y === goalY)) {
                // 敵ユニットは完全にブロック
                if (blockInfo.blocked && !blockInfo.isFriendly) {
                    continue;
                }
            }

            // 移動コストを計算
            let moveCost = 1;

            // 飛行ユニット判定
            const canFly = movingUnit && (movingUnit.canFly || movingUnit.type === 'FLYING');

            // mapSystem.getMoveCostが利用可能な場合はそれを使用（地形＋標高コスト）
            if (mapSystem && mapSystem.getMoveCost) {
                moveCost = mapSystem.getMoveCost(current, neighbor, canFly);
            }
            // 従来の配列/オブジェクト判定によるフォールバック
            else if (mapSystem) {
                let tile = null;
                if (mapSystem.getTile) tile = mapSystem.getTile(neighbor.x, neighbor.y);
                else if (Array.isArray(mapSystem) && mapSystem[neighbor.y]) tile = mapSystem[neighbor.y][neighbor.x];

                if (tile && TERRAIN_TYPES[tile.type]) {
                    moveCost = TERRAIN_TYPES[tile.type].moveCost;
                }
            }

            // 味方ユニットがいる場合はコスト増（迂回を促すが、通行は可能）
            if (blockInfo.blocked && blockInfo.isFriendly) {
                moveCost += 5;
            }

            // 山岳などでコストが極端に高い場合はスキップ
            if (moveCost >= 999) continue;

            const tentativeGScore = (gScore.get(currentKey) || Infinity) + moveCost;

            if (tentativeGScore < (gScore.get(neighborKey) || Infinity)) {
                cameFrom.set(neighborKey, current);
                gScore.set(neighborKey, tentativeGScore);
                fScore.set(neighborKey, tentativeGScore + getDistRaw(neighbor.x, neighbor.y, goalX, goalY));

                if (!openSet.some(n => n.x === neighbor.x && n.y === neighbor.y)) {
                    openSet.push(neighbor);
                }
            }
        }
    }

    // パスが見つからない場合は、ゴールに向かって可能な限り近づく
    for (let i = straightPath.length - 1; i >= 0; i--) {
        const targetPos = straightPath[i];

        // ユニット干渉チェック
        if (isBlocked(targetPos.x, targetPos.y, units, movingUnit.id, movingUnit.radius, movingUnit.side)) {
            continue;
        }

        // 地形・高さコストチェック
        // mapSystemがある場合のみチェック（互換性のため）
        if (mapSystem && mapSystem.getMoveCost) {
            // 現在位置から目標位置までの間に、移動不可な地形がないか簡易チェック
            // straightPathの一部を採用する場合、そのパス上の全移動が可能か確認すべきだが、
            // 簡易的に「目標地点に行けるか」だけチェックすると壁を飛び越える可能性がある。
            // そのため、経路上の各ステップをチェックする。

            let pathValid = true;
            // 自分の現在位置からスタート
            let currentCheck = { x: startX, y: startY };

            // iまでのパスを順にチェック
            for (let j = 1; j <= i; j++) {
                const nextStep = straightPath[j];
                const cost = mapSystem.getMoveCost(currentCheck, nextStep);
                if (cost === Infinity || cost >= 999) {
                    pathValid = false;
                    break;
                }
                currentCheck = nextStep;
            }

            if (!pathValid) continue;
        }

        return straightPath.slice(0, i + 1);
    }

    return [{ x: startX, y: startY }];
}

/**
 * 向き判定（4方向: 0=右, 1=下, 2=左, 3=上）
 */
export function getFacingAngle(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    // 絶対値で主方向を判定
    if (Math.abs(dx) >= Math.abs(dy)) {
        return dx >= 0 ? 0 : 2; // 右 or 左
    } else {
        return dy >= 0 ? 1 : 3; // 下 or 上
    }
}
