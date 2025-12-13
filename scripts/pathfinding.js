/**
 * SEKIGAHARA RTS - Pathfinding (Enhanced)
 * A*アルゴリズムによる障害物回避パスファインディング
 */

import { HEX_SIZE, MAP_W, MAP_H } from './constants.js';

// ヘックス座標ユーティリティ
export function hexToPixel(q, r) {
    return {
        x: HEX_SIZE * Math.sqrt(3) * (q + r / 2),
        y: HEX_SIZE * 3 / 2 * r
    };
}

export function pixelToHex(mx, my, camera) {
    let wx = (mx - camera.x) / camera.zoom;
    let wy = (my - camera.y) / camera.zoom;
    let q = (Math.sqrt(3) / 3 * wx - 1 / 3 * wy) / HEX_SIZE;
    let r = (2 / 3 * wy) / HEX_SIZE;
    return cubeRound({ q, r, s: -q - r });
}

export function cubeRound(c) {
    let rx = Math.round(c.q), ry = Math.round(c.r), rz = Math.round(c.s);
    let xd = Math.abs(rx - c.q), yd = Math.abs(ry - c.r), zd = Math.abs(rz - c.s);
    if (xd > yd && xd > zd) rx = -ry - rz;
    else if (yd > zd) ry = -rx - rz;
    else rz = -rx - ry;
    return { q: rx, r: ry };
}

export function isValidHex(h) {
    return h.q >= 0 && h.q < MAP_W && h.r >= 0 && h.r < MAP_H;
}

export function getDistRaw(q1, r1, q2, r2) {
    return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
}

export function getDist(u1, u2) {
    return getDistRaw(u1.q, u1.r, u2.q, u2.r);
}

// 直線パス（シンプル版）
export function getLine(q1, r1, q2, r2) {
    let N = getDistRaw(q1, r1, q2, r2);
    let res = [];
    for (let i = 0; i <= N; i++) {
        let t = i / N;
        res.push(cubeRound({
            q: q1 + (q2 - q1) * t,
            r: r1 + (r2 - r1) * t,
            s: -(q1 + (q2 - q1) * t) - (r1 + (r2 - r1) * t)
        }));
    }
    return res;
}

// 隣接ヘックスを取得
function getNeighbors(q, r) {
    const directions = [
        [+1, 0], [+1, -1], [0, -1],
        [-1, 0], [-1, +1], [0, +1]
    ];
    return directions.map(([dq, dr]) => ({ q: q + dq, r: r + dr }))
        .filter(isValidHex);
}

// 他のユニットが障害物となるかチェック（味方と敵を区別）
function getBlockingInfo(q, r, units, movingUnit) {
    for (const u of units) {
        if (u.id === movingUnit.id || u.dead) continue;

        const dist = getDistRaw(q, r, u.q, u.r);
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

// 従来のisBlocked関数（敵ユニットのみブロック）
function isBlocked(q, r, units, movingUnitId, movingUnitRadius, movingUnitSide) {
    return units.some(u =>
        u.id !== movingUnitId &&
        !u.dead &&
        u.side !== movingUnitSide && // 敵のみブロック
        getDistRaw(q, r, u.q, u.r) < (movingUnitRadius + u.radius)
    );
}

/**
 * A*アルゴリズムによるパスファインディング
 * 他のユニットを避けるルートを探索
 */
export function findPath(startQ, startR, goalQ, goalR, units, movingUnit, mapSystem) {
    // 目標と同じ位置にいる場合
    if (startQ === goalQ && startR === goalR) {
        return [{ q: startQ, r: startR }];
    }

    // 直線距離が近い場合は直線パスを試す（敵ユニットのみチェック）
    // ただし、地形コストがある場合は直線パスが最適とは限らないため、
    // 山岳がある場合はA*を優先すべきだが、簡易的に「直線上に山があればA*」とする
    const straightPath = getLine(startQ, startR, goalQ, goalR);
    let blocked = false;
    for (let i = 1; i < straightPath.length; i++) {
        const blockInfo = getBlockingInfo(straightPath[i].q, straightPath[i].r, units, movingUnit);
        // 敵ユニットのみブロック扱い
        if (blockInfo.blocked && !blockInfo.isFriendly) {
            blocked = true;
            break;
        }
        // 地形チェック
        if (mapSystem) {
            const tile = mapSystem.getTile(straightPath[i].q, straightPath[i].r);
            if (tile && tile.type === 'MTN') {
                blocked = true; // 山は通行不可（迂回させる）
                break;
            }
            // HILLの場合は通行可能だがコストがかかるため、直線移動が最適とは限らない。
            // しかし、ここでは「通行不可」かどうかだけを判定しているので、HILLはブロックしない。
            // ただし、A*の方がコストを考慮したルートを選べるため、
            // 厳密にはHILLがある場合もA*に任せた方が良いかもしれない。
            // 一旦、HILLは直線移動OKとする（コスト計算は移動時に行われるため、結果的に遅くなるだけ）
        }
    }
    if (!blocked) {
        return straightPath;
    }

    // A*探索
    const openSet = [{ q: startQ, r: startR }];
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    const key = (q, r) => `${q},${r}`;
    gScore.set(key(startQ, startR), 0);
    fScore.set(key(startQ, startR), getDistRaw(startQ, startR, goalQ, goalR));

    let iterations = 0;
    const maxIterations = 1000; // 探索範囲を少し広げる

    while (openSet.length > 0 && iterations < maxIterations) {
        iterations++;

        // fScoreが最小のノードを取得
        openSet.sort((a, b) =>
            (fScore.get(key(a.q, a.r)) || Infinity) - (fScore.get(key(b.q, b.r)) || Infinity)
        );
        const current = openSet.shift();
        const currentKey = key(current.q, current.r);

        // ゴールに到達
        if (current.q === goalQ && current.r === goalR) {
            // パスを再構築
            const path = [];
            let node = current;
            while (node) {
                path.unshift(node);
                node = cameFrom.get(key(node.q, node.r));
            }
            return path;
        }

        closedSet.add(currentKey);

        // 隣接ノードを探索
        for (const neighbor of getNeighbors(current.q, current.r)) {
            const neighborKey = key(neighbor.q, neighbor.r);

            if (closedSet.has(neighborKey)) continue;

            // ブロック情報を取得
            const blockInfo = getBlockingInfo(neighbor.q, neighbor.r, units, movingUnit);

            // ゴールでない場合の障害物チェック
            if (!(neighbor.q === goalQ && neighbor.r === goalR)) {
                // 敵ユニットは完全にブロック
                if (blockInfo.blocked && !blockInfo.isFriendly) {
                    continue;
                }
            }

            // 移動コストを計算
            let moveCost = 1;

            // 地形コスト
            if (mapSystem) {
                const tile = mapSystem.getTile(neighbor.q, neighbor.r);
                if (tile) {
                    if (tile.type === 'MTN') {
                        moveCost = 999; // 山は実質通行不可
                    } else if (tile.type === 'HILL') {
                        moveCost = 3; // 丘陵はコスト増（平地の3倍）
                    } else if (tile.type === 'RIVER') {
                        moveCost = 5; // 川はさらにコスト増
                    }
                }
            }

            // 味方ユニットがいる場合はコスト増（迂回を促す）
            if (blockInfo.blocked && blockInfo.isFriendly) {
                moveCost += 10;
            }

            // 山岳などでコストが極端に高い場合はスキップ（ただしゴールなら許容する場合もあるが、今回は山は完全不可とする）
            if (moveCost >= 999) continue;

            const tentativeGScore = (gScore.get(currentKey) || Infinity) + moveCost;

            if (tentativeGScore < (gScore.get(neighborKey) || Infinity)) {
                cameFrom.set(neighborKey, current);
                gScore.set(neighborKey, tentativeGScore);
                fScore.set(neighborKey, tentativeGScore + getDistRaw(neighbor.q, neighbor.r, goalQ, goalR));

                if (!openSet.some(n => n.q === neighbor.q && n.r === neighbor.r)) {
                    openSet.push(neighbor);
                }
            }
        }
    }

    // パスが見つからない場合は、ゴールに向かって可能な限り近づく
    // 直線パスの途中まで行けるところまで返す
    for (let i = straightPath.length - 1; i >= 0; i--) {
        if (!isBlocked(straightPath[i].q, straightPath[i].r, units, movingUnit.id, movingUnit.radius)) {
            return straightPath.slice(0, i + 1);
        }
    }

    return [{ q: startQ, r: startR }];
}

export function getFacingAngle(q1, r1, q2, r2) {
    let dx = (q2 - q1) * Math.sqrt(3) * HEX_SIZE + (r2 - r1) * Math.sqrt(3) * HEX_SIZE / 2;
    let dy = (r2 - r1) * 3 / 2 * HEX_SIZE;
    let angle = Math.atan2(dy, dx);
    let deg = angle * 180 / Math.PI;
    if (deg < 0) deg += 360;
    return Math.round(deg / 60) % 6;
}
