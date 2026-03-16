/**
 * Fantasy RTS - Pathfinding (Square Grid)
 * A*アルゴリズムによる障害物回避パスファインチE��ング�E�スクエアグリチE��対応！E
 */

import { TILE_SIZE, MAP_W, MAP_H } from './constants.js';
import { TERRAIN_TYPES } from './map.js';

// 旧API互換性のためのエイリアス
export const HEX_SIZE = TILE_SIZE;

/**
 * グリチE��座標をピクセル座標に変換�E�アイソメトリチE���E�E
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
 * ピクセル座標をグリチE��座標に変換�E�アイソメトリチE��送E��換�E�E
 */
export function pixelToGrid(px, pz) {
    const gx = (px / (TILE_SIZE / 2) + pz / (TILE_SIZE / 4)) / 2;
    const gy = (pz / (TILE_SIZE / 4) - px / (TILE_SIZE / 2)) / 2;
    return { x: Math.round(gx), y: Math.round(gy) };
}

// 旧API互換
export function pixelToHex(mx, my, camera) {
    // カメラオフセチE��適用�E�旧APIとの互換性のため�E�E
    let wx = camera ? (mx - camera.x) / camera.zoom : mx;
    let wy = camera ? (my - camera.y) / camera.zoom : my;
    const result = pixelToGrid(wx, wy);
    return { q: result.x, r: result.y };
}

// 旧API互換�E�使用されなくなったが残す�E�E
export function cubeRound(c) {
    return { q: Math.round(c.q), r: Math.round(c.r) };
}

/**
 * 座標が有効篁E��冁E��チェチE��
 */
export function isValidCoord(coord) {
    return coord.x >= 0 && coord.x < MAP_W && coord.y >= 0 && coord.y < MAP_H;
}

// 旧API互換
export function isValidHex(h) {
    return h.q >= 0 && h.q < MAP_W && h.r >= 0 && h.r < MAP_H;
}

/**
 * 2点間�Eマンハッタン距離を計算（スクエアグリチE��用�E�E
 */
export function getDistRaw(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

/**
 * ユニット間の距離を計箁E
 */
export function getDist(u1, u2) {
    return getDistRaw(u1.x, u1.y, u2.x, u2.y);
}

/**
 * チェビシェフ距離�E�斜め移動も距離1�E�E
 * 攻撁E��定などに使用
 */
export function getDistChebyshev(u1, u2) {
    return Math.max(Math.abs(u1.x - u2.x), Math.abs(u1.y - u2.y));
}

// 攻撁E��離用エイリアス
export const getDistAttack = getDistChebyshev;

/**
 * 直線パス�E�シンプル版、�Eンハッタン経路�E�E
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
 * 目標地点までの予想ターン数を計箁E
 * @param {Object} unit - 移動するユニッチE
 * @param {number} targetX - 目標X座樁E
 * @param {number} targetY - 目標Y座樁E
 * @param {Object} mapSystem - マップシスチE��
 * @param {Array} units - 全ユニットリスト（障害物判定用�E�E
 * @returns {number} 予想ターン数 (Infinity if unreachable)
 */
export function estimateTurns(unit, targetX, targetY, mapSystem, units) {
    if (unit.x === targetX && unit.y === targetY) return 0;

    const path = findPath(unit.x, unit.y, targetX, targetY, units, unit, mapSystem);
    if (!path || path.length < 2) return Infinity; // パスなし、また�E移動不要E

    // パスからコスト計箁E
    let totalCost = 0;
    // canFlyプロパティがあるか不�Eだが、あれ�E使ぁE
    const canFly = unit.canFly || false;

    for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i + 1];
        // p2への移動コスチE
        let cost = mapSystem.getMoveCost(p1, p2, canFly);

        // getMoveCostは 1.0, 1.5, Infinity 等を返す
        if (cost === Infinity) cost = 999;

        totalCost += cost;
    }

    const move = unit.movePower || unit.move || 6; // チE��ォルチE
    // ターン数は ceil(総コスチE/ 移動力)
    // ただし、移動力ちめE��どの残りで次のターンに行けるかなどの細かいルールはあるが、E
    // ここでは単純な割り算で概算する、E
    // �E�侁E Move 6, Cost 4+4=8 -> 2ターン�E�E

    // より正確には、毎ターン move だけ進んで、残りは持ち越せなぁE��ールならシミュレーションが忁E��、E
    // Fantasy RTSのルールでは「移動力使ぁE�Eり」が一般皁E��E
    // Cost 4 の森に入ると残り移動力ぁE2 になり、次の Cost 4 の森には入れなぁE-> 次ターン、E
    // ここまで厳寁E��めE��にはシミュレーションが忁E��だが、今回は概算でOKとするか、シミュレーションするか、E
    // ユーザーは「予想ターン数」と言ってぁE��ので、単純な割り算より�Eシミュレーションの方が親刁E��E

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
            // 1歩も動けなぁE��合（最大移動力 < コスト）�E移動不可とみなすか、最佁E歩は動けるとするぁE
            if (currentMove < 0) return Infinity; // 移動不可
        }
    }

    return turns;
}

/**
 * 到達可能なタイルを取得（移動篁E��表示用�E�E
 * @param {number} startX - 開始X座樁E
 * @param {number} startY - 開始Y座樁E
 * @param {number} maxMove - 最大移動力
 * @param {Object} mapSystem - マップシスチE���E�コスト計算用�E�E
 * @param {boolean} canFly - 飛行ユニットかどぁE��
 * @returns {Array<{x:number, y:number}>} 到達可能なタイルのリスチE
 */
export function getReachableTiles(startX, startY, maxMove, mapSystem, canFly = false) {
    const reachable = [];
    // 訪問済みセチE��: "x,y" => cost
    const visited = new Map();

    // 優先度付きキューの代わりに単純な配�Eとソートを使ぁE��実裁E��易化�E�E
    // { x, y, cost }
    const queue = [{ x: startX, y: startY, cost: 0 }];
    visited.set(`${startX},${startY}`, 0);

    while (queue.length > 0) {
        // コストが小さぁE��E��処琁E
        queue.sort((a, b) => a.cost - b.cost);
        const current = queue.shift();

        reachable.push({ x: current.x, y: current.y });

        const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dy] of neighbors) {
            const nx = current.x + dx;
            const ny = current.y + dy;
            const key = `${nx},${ny}`;

            // マップ篁E��外チェチE��はgetMoveCost冁E��行われるが、呼び出し前に弾く�EもあめE

            // コスト計箁E
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
 * 隣接グリチE��を取得！E方向！E
 */
function getNeighbors(x, y) {
    const directions = [
        [1, 0],   // 右
        [-1, 0],  // 左
        [0, 1],   // 丁E
        [0, -1]   // 丁E
    ];
    return directions
        .map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
        .filter(coord => isValidCoord(coord));
}

/**
 * 他�Eユニットが障害物となるかチェチE���E�味方と敵を区別�E�E
 * @param {number} x
 * @param {number} y
 * @param {Array|Map} unitsOrMap - ユニット�E刁Eまた�E 位置マッチEKey="x,y", Value=Unit)
 * @param {Object} movingUnit
 */
function getBlockingInfo(x, y, unitsOrMap, movingUnit) {
    let unitAtPos = null;

    // Mapが渡された場合（高速検索�E�E
    if (unitsOrMap instanceof Map) {
        unitAtPos = unitsOrMap.get(`${x},${y}`);
    } 
    // 配�Eが渡された場合（従来互換�E�E
    else if (Array.isArray(unitsOrMap)) {
        // 半征E��ェチE��を含む厳寁E��判定（従来通り�E�E
        for (const u of unitsOrMap) {
            if (u.id === movingUnit.id || u.dead) continue;
            const dist = getDistRaw(x, y, u.x, u.y);
            if (dist < (movingUnit.radius + u.radius)) {
                unitAtPos = u;
                break;
            }
        }
        if (unitAtPos) {
             return {
                blocked: true,
                isFriendly: unitAtPos.side === movingUnit.side,
                unit: unitAtPos
            };
        }
        return { blocked: false, isFriendly: false, unit: null };
    }

    // Map検索で見つかった場吁E
    if (unitAtPos && unitAtPos.id !== movingUnit.id && !unitAtPos.dead) {
        return {
            blocked: true,
            isFriendly: unitAtPos.side === movingUnit.side,
            unit: unitAtPos
        };
    }
    
    return { blocked: false, isFriendly: false, unit: null };
}

/**
 * 従来のisBlocked関数�E�敵ユニット�EみブロチE���E�E
 */
function isBlocked(x, y, units, movingUnitId, movingUnitRadius, movingUnitSide) {
    // 高速化のため、findPath冁E��Mapが利用可能な場合�Eそちらを使ぁE��きだが、E
    // ここは既存API互換のため配�E走査のままにする�E�呼び出し頻度が低いと想定！E
    return units.some(u =>
        u.id !== movingUnitId &&
        !u.dead &&
        u.side !== movingUnitSide && // 敵のみブロチE��
        getDistRaw(x, y, u.x, u.y) < (movingUnitRadius + u.radius)
    );
}

/**
 * A*アルゴリズムによるパスファインチE��ング
 * 他�Eユニットを避けるルートを探索
 */
export function findPath(startX, startY, goalX, goalY, units, movingUnit, mapSystem) {
    // ユニット位置の高速検索用Mapを作�E
    // key: "x,y", value: unit
    // これにより getBlockingInfo めEO(N) -> O(1) に高速化
    const unitMap = new Map();
    // 自刁E�EIDは除外しなぁE��Map構築時に上書きされる可能性があるが、E
    // そもそも自刁E��ぁE��場所に他人はぁE��ぁE��提、E
    // ただし、移動シミュレーションなので「現在の全ユニット位置」をスナップショチE��として使ぁE��E
    for (const u of units) {
        if (!u.dead) {
            unitMap.set(`${u.x},${u.y}`, u);
        }
    }

    // 目標と同じ位置にぁE��場吁E
    if (startX === goalX && startY === goalY) {
        return [{ x: startX, y: startY }];
    }

    // 直線距離が近い場合�E直線パスを試ぁE
    const straightPath = getLine(startX, startY, goalX, goalY);
    let blocked = false;

    // 飛行ユニット判宁E
    const canFly = movingUnit && (movingUnit.canFly || movingUnit.type === 'FLYING');

    for (let i = 1; i < straightPath.length; i++) {
        // unitMapを使用して高速チェチE��
        const blockInfo = getBlockingInfo(straightPath[i].x, straightPath[i].y, unitMap, movingUnit);

        // 敵ユニット�EみブロチE��扱ぁE��ゴール地点は例外！E
        if (!(straightPath[i].x === goalX && straightPath[i].y === goalY) && blockInfo.blocked && !blockInfo.isFriendly) {
            blocked = true;
            break;
        }

        // 地形チェチE�� - mapSystem.getMoveCostを使用して統一皁E��判宁E
        if (mapSystem && mapSystem.getMoveCost) {
            const prevX = straightPath[i - 1].x;
            const prevY = straightPath[i - 1].y;
            const currX = straightPath[i].x;
            const currY = straightPath[i].y;
            const moveCost = mapSystem.getMoveCost(
                { x: prevX, y: prevY },
                { x: currX, y: currY },
                canFly
            );
            // 無限コスト（山岳、E��低差趁E��など�E��EブロチE��
            if (moveCost === Infinity || moveCost >= 999) {
                blocked = true;
                break;
            }
        }
        // 従来の配�E判定によるフォールバック
        else if (mapSystem) {
            let tile = null;
            if (mapSystem.getTile) tile = mapSystem.getTile(straightPath[i].x, straightPath[i].y);
            else if (Array.isArray(mapSystem) && mapSystem[straightPath[i].y]) tile = mapSystem[straightPath[i].y][straightPath[i].x];

            if (tile && TERRAIN_TYPES[tile.type] && !TERRAIN_TYPES[tile.type].passable) {
                blocked = true;
                break;
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
    const maxIterations = 10000; // 大きなマップや褁E��な障害物に対忁E

    while (openSet.length > 0 && iterations < maxIterations) {
        iterations++;

        // fScoreが最小�Eノ�Eドを線形探索で取得（ソートより高速！E
        let minIndex = 0;
        let minFScore = fScore.get(key(openSet[0].x, openSet[0].y)) || Infinity;
        for (let i = 1; i < openSet.length; i++) {
            const currentFScore = fScore.get(key(openSet[i].x, openSet[i].y)) || Infinity;
            if (currentFScore < minFScore) {
                minFScore = currentFScore;
                minIndex = i;
            }
        }
        const current = openSet.splice(minIndex, 1)[0];
        const currentKey = key(current.x, current.y);

        // ゴールに到遁E
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

        // 隣接ノ�Eドを探索�E�E方向！E
        for (const neighbor of getNeighbors(current.x, current.y)) {
            const neighborKey = key(neighbor.x, neighbor.y);

            if (closedSet.has(neighborKey)) continue;

            // ブロチE��惁E��を取征E(Mapを使用)
            const blockInfo = getBlockingInfo(neighbor.x, neighbor.y, unitMap, movingUnit);

            // ゴールでなぁE��合�E障害物チェチE��
            if (!(neighbor.x === goalX && neighbor.y === goalY)) {
                // 敵ユニット�E完�EにブロチE��
                if (blockInfo.blocked && !blockInfo.isFriendly) {
                    continue;
                }
            }

            // 移動コストを計箁E
            let moveCost = 1;

            // 飛行ユニット判宁E
            const canFly = movingUnit && (movingUnit.canFly || movingUnit.type === 'FLYING');

            // mapSystem.getMoveCostが利用可能な場合�Eそれを使用�E�地形�E�標高コスト！E
            if (mapSystem && mapSystem.getMoveCost) {
                moveCost = mapSystem.getMoveCost(current, neighbor, canFly);
            }
            // 従来の配�E/オブジェクト判定によるフォールバック
            else if (mapSystem) {
                let tile = null;
                if (mapSystem.getTile) tile = mapSystem.getTile(neighbor.x, neighbor.y);
                else if (Array.isArray(mapSystem) && mapSystem[neighbor.y]) tile = mapSystem[neighbor.y][neighbor.x];

                if (tile && TERRAIN_TYPES[tile.type]) {
                    moveCost = TERRAIN_TYPES[tile.type].moveCost;
                }
            }

            // 味方ユニットがぁE��場合�Eコスト増（迂回を俁E��が、E��行�E可能�E�E
            if (blockInfo.blocked && blockInfo.isFriendly) {
                moveCost += 5;
            }

            // 山岳などでコストが極端に高い場合�EスキチE�E
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

    // パスが見つからなぁE��合�E、ゴールに向かって可能な限り近づぁE
    for (let i = straightPath.length - 1; i >= 0; i--) {
        const targetPos = straightPath[i];

        // ユニット干渉チェチE��
        if (isBlocked(targetPos.x, targetPos.y, units, movingUnit.id, movingUnit.radius, movingUnit.side)) {
            continue;
        }

        // 地形・高さコストチェチE��
        // mapSystemがある場合�EみチェチE���E�互換性のため�E�E
        if (mapSystem && mapSystem.getMoveCost) {
            // 現在位置から目標位置までの間に、移動不可な地形がなぁE��簡易チェチE��
            // straightPathの一部を採用する場合、そのパス上�E全移動が可能か確認すべきだが、E
            // 簡易的に「目標地点に行けるか」だけチェチE��すると壁を飛�E越える可能性がある、E
            // そ�Eため、経路上�E吁E��チE��プをチェチE��する、E

            let pathValid = true;
            // 自刁E�E現在位置からスターチE
            let currentCheck = { x: startX, y: startY };

            // iまでのパスを頁E��チェチE��
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
 * 向き判定！E方吁E 0=右, 1=丁E 2=左, 3=上！E
 */
export function getFacingAngle(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    // 絶対値で主方向を判宁E
    if (Math.abs(dx) >= Math.abs(dy)) {
        return dx >= 0 ? 0 : 2; // 右 or 左
    } else {
        return dy >= 0 ? 1 : 3; // 丁Eor 丁E
    }
}

