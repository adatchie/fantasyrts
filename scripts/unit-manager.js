/**
 * SEKIGAHARA RTS - Unit Manager
 * マルチユニットシステム: 兵力1000人単位でユニットを管理
 */

import { hexToPixel } from './pathfinding.js';
import { generatePortrait } from './rendering.js';

// ユニットタイプ定数
export const UNIT_TYPE_HEADQUARTERS = 'HEADQUARTERS'; // 本陣
export const UNIT_TYPE_NORMAL = 'NORMAL';             // 通常ユニット

// 定数インポート
import { MAP_W, MAP_H } from './constants.js';

// 1ユニットあたりの標準兵力
export const SOLDIERS_PER_UNIT = 1000;

/**
 * マルチユニット管理クラス
 */
export class UnitManager {
    constructor() {
        this.units = [];           // 全ユニット配列
        this.warlordGroups = {};   // 武将ID -> ユニット配列のマップ
        this.nextUnitId = 0;       // ユニットID発行カウンター
    }

    /**
     * 武将データから複数ユニットを生成
     * @param {Object} warlord - 武将データ（WARLORDS配列の要素）
     * @param {number} warlordId - 武将ID
     * @param {Array} allWarlords - 全武将データ（配置重複チェック用）
     * @returns {Array} 生成されたユニット配列
     */
    /**
     * 武将データから複数ユニットを生成
     * @param {Object} warlord - 武将データ（WARLORDS配列の要素）
     * @param {number} warlordId - 武将ID
     * @param {Array} allWarlords - 全武将データ（配置重複チェック用）
     * @returns {Array} 生成されたユニット配列
     */
    createUnitsFromWarlord(warlord, warlordId, allWarlords = [], mapSystem = null) {
        // 必要なユニット数を計算
        const totalUnits = Math.ceil(warlord.soldiers / SOLDIERS_PER_UNIT);

        // 本陣の初期位置を決定（重複回避）
        const hqPosition = this.findNonOverlappingPosition(
            warlord.x,
            warlord.y,
            totalUnits,
            allWarlords.filter(w => w !== warlord)
        );

        // 螺旋状の配置座標を生成
        const positions = this.generateSpiralPositions(hqPosition.x, hqPosition.y, totalUnits, mapSystem);

        // 各ユニットに兵力を分配
        const soldierDistribution = this.distributeSoldiers(warlord.soldiers, totalUnits);

        // ユニット生成
        const units = [];
        for (let i = 0; i < totalUnits; i++) {
            const isHeadquarters = (i === 0); // 最初のユニット（中央）が本陣
            const unit = {
                id: this.nextUnitId++,
                warlordId: warlordId,
                warlordName: warlord.name,
                unitType: isHeadquarters ? UNIT_TYPE_HEADQUARTERS : UNIT_TYPE_NORMAL,

                // 武将の属性を継承
                name: warlord.name,
                side: warlord.side,
                atk: warlord.atk,
                def: warlord.def,
                jin: warlord.jin,
                loyalty: warlord.loyalty,
                p: warlord.p,
                kamon: warlord.kamon,
                bg: warlord.bg,
                face: warlord.face,

                // このユニットの兵力
                soldiers: soldierDistribution[i],
                maxSoldiers: soldierDistribution[i],

                // 位置情報
                x: positions[i].x,
                y: positions[i].y,
                // 後方互換性のためq,rも設定しておくが、基本はx,yを使用
                q: positions[i].x,
                r: positions[i].y,

                // ピクセル座標はレンダリング側で計算（必要なら）
                // pos: hexToPixel(positions[i].q, positions[i].r), // 廃止

                dir: warlord.side === 'EAST' ? 3 : 0,

                // ゲーム状態
                order: null,
                dead: false,
                formation: null, // 陣形（本陣のみ使用: HOKO/KAKUYOKU/GYORIN）

                // 描画情報
                radius: 0.45,
                size: 1,

                // 移動力 (Action Points)
                movePower: 6,  // 平地なら6マス、丘陵なら3マス移動可能

                // 画像は本陣のみ生成
                imgCanvas: isHeadquarters ? generatePortrait(warlord) : null
            };

            units.push(unit);
        }

        // 武将グループに登録
        this.warlordGroups[warlordId] = units;
        this.units.push(...units);

        return units;
    }

    /**
     * 他の武将と重ならない本陣位置を見つける
     * @param {number} originalX - 元のX座標
     * @param {number} originalY - 元のY座標
     * @param {number} unitCount - 配置するユニット数
     * @param {Array} otherWarlords - 他の武将データ
     * @returns {{x: number, y: number}} 調整後の座標
     */
    findNonOverlappingPosition(originalX, originalY, unitCount, otherWarlords) {
        // 必要な半径を計算（螺旋の最大半径）
        const requiredRadius = Math.ceil(Math.sqrt(unitCount)) + 1;

        // まず元の位置で重複チェック
        if (!this.checkOverlap(originalX, originalY, requiredRadius, otherWarlords)) {
            return { x: originalX, y: originalY };
        }

        // 重複する場合、螺旋状に探索
        let searchRadius = 1;
        while (searchRadius < 15) { // 最大15タイル探索
            const searchPositions = this.generateSpiralPositions(originalX, originalY, searchRadius * 8); // およそ外周分

            for (const pos of searchPositions) {
                if (!this.checkOverlap(pos.x, pos.y, requiredRadius, otherWarlords)) {
                    console.log(`Position adjusted: (${originalX},${originalY}) -> (${pos.x},${pos.y})`);
                    return pos;
                }
            }

            searchRadius++;
        }

        // 見つからなければ元の位置を返す（最悪のケース）
        console.warn(`Could not find non-overlapping position for (${originalX},${originalY})`);
        return { x: originalX, y: originalY };
    }

    /**
     * 指定位置が他の武将と重複するかチェック
     * @param {number} x - チェックするX座標
     * @param {number} y - チェックするY座標
     * @param {number} radius - 必要な半径
     * @param {Array} otherWarlords - 他の武将データ
     * @returns {boolean} 重複する場合true
     */
    checkOverlap(x, y, radius, otherWarlords) {
        for (const other of otherWarlords) {
            const distance = this.gridDistance(x, y, other.x, other.y);
            const otherRadius = Math.ceil(Math.sqrt(Math.ceil(other.soldiers / SOLDIERS_PER_UNIT))) + 1;

            // 2つの領域が重なるかチェック
            if (distance < radius + otherRadius) {
                return true; // 重複
            }
        }
        return false; // 重複なし
    }

    /**
     * グリッド距離（チェビシェフ距離: MAX(|dx|, |dy|)）を計算
     * 斜め移動も1歩と数える
     */
    gridDistance(x1, y1, x2, y2) {
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        return Math.max(dx, dy);
    }

    /**
     * 時計回りの螺旋状に座標を生成（スクエアグリッド用）
     * @param {number} centerX - 中心のX座標
     * @param {number} centerY - 中心のY座標
     * @param {number} count - 生成する座標の数
     * @returns {Array<{x: number, y: number}>} 座標配列
     */
    generateSpiralPositions(centerX, centerY, count, mapSystem = null) {
        const positions = [{ x: centerX, y: centerY }];
        if (count <= 1) return positions;

        // 右、下、左、上
        const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
        let len = 1; // 直進する長さ
        let x = centerX;
        let y = centerY;
        let d = 0; // 現在の方向インデックス

        let i = 0;
        while (positions.length < count) {
            // 現在の長さ分だけ進みたいが、各辺ごとにチェック
            // 螺旋の各辺は2回ずつ長さが同じで、その後長さ+1される
            // 右1, 下1, 左2, 上2, 右3, 下3...

            for (let j = 0; j < 2; j++) {
                for (let k = 0; k < len; k++) {
                    x += dirs[d][0];
                    y += dirs[d][1];

                    let isValidTerrain = true;

                    // マップ境界チェック（必須）
                    if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) {
                        isValidTerrain = false;
                    }
                    // 地形チェック（mapSystemがある場合）
                    else if (mapSystem) {
                        const tile = mapSystem.getTile ? mapSystem.getTile(x, y) : null;
                        if (!tile || tile.type === 'MTN' || tile.type === 'RIVER' || tile.type === 'SEA') {
                            // 山や川、海には配置しない
                            isValidTerrain = false;
                        }
                    }

                    if (isValidTerrain) {
                        positions.push({ x, y });
                    }

                    if (positions.length >= count) return positions;
                }
                d = (d + 1) % 4; // 方向転換
            }
            len++; // 辺の長さを増やす

            // 安全策
            if (len > 30) break;
        }

        return positions.slice(0, count);
    }

    /**
     * 兵力を各ユニットに分配
     * @param {number} totalSoldiers - 総兵力
     * @param {number} unitCount - ユニット数
     * @returns {Array<number>} 各ユニットの兵力配列
     */
    distributeSoldiers(totalSoldiers, unitCount) {
        const distribution = [];
        const baseAmount = SOLDIERS_PER_UNIT;

        // 各ユニットに基本兵力を割り当て
        for (let i = 0; i < unitCount; i++) {
            distribution.push(baseAmount);
        }

        // 端数を計算
        const assignedTotal = baseAmount * unitCount;
        const remainder = totalSoldiers - assignedTotal;

        // 端数を最後のユニット（螺旋の最外周）に割り当て
        if (remainder !== 0 && unitCount > 0) {
            distribution[unitCount - 1] += remainder;
        }

        return distribution;
    }

    /**
     * 武将IDから配下の全ユニットを取得
     * @param {number} warlordId - 武将ID
     * @returns {Array} ユニット配列
     */
    getUnitsByWarlordId(warlordId) {
        return this.warlordGroups[warlordId] || [];
    }

    /**
     * ユニットIDから所属する武将IDを取得
     * @param {number} unitId - ユニットID
     * @returns {number|null} 武将ID
     */
    getWarlordIdByUnitId(unitId) {
        const unit = this.units.find(u => u.id === unitId);
        return unit ? unit.warlordId : null;
    }

    /**
     * 全ユニットを取得
     * @returns {Array} 全ユニット配列
     */
    getAllUnits() {
        return this.units;
    }

    /**
     * 武将の本陣ユニットを取得
     * @param {number} warlordId - 武将ID
     * @returns {Object|null} 本陣ユニット
     */
    getHeadquarters(warlordId) {
        const units = this.getUnitsByWarlordId(warlordId);
        return units.find(u => u.unitType === UNIT_TYPE_HEADQUARTERS) || null;
    }

    /**
     * 本陣が全滅したら配下の全ユニットを敗走させる
     * @param {number} warlordId - 武将ID
     */
    defeatWarlord(warlordId) {
        const units = this.getUnitsByWarlordId(warlordId);
        units.forEach(unit => {
            unit.dead = true;
            unit.soldiers = 0;
        });
    }

    /**
     * 本陣の状態をチェックし、必要なら敗走処理
     * @param {number} warlordId - 武将ID
     * @returns {boolean} 敗走したかどうか
     */
    checkHeadquartersStatus(warlordId) {
        const hq = this.getHeadquarters(warlordId);
        const units = this.getUnitsByWarlordId(warlordId);

        if (!hq) {
            console.warn(`本陣が見つかりません: warlordId=${warlordId}`);
            return false;
        }

        // 本陣が死亡している、または兵力が0以下/NaNの場合
        if (hq.dead || hq.soldiers <= 0 || isNaN(hq.soldiers)) {
            // 配下ユニットがまだ生きている場合のみ敗走処理
            const aliveUnits = units.filter(u => !u.dead);

            if (aliveUnits.length > 0) {
                console.log(`本陣全滅: ${hq.warlordName} (兵力: ${hq.soldiers}, dead: ${hq.dead})`);
                console.log(`  配下ユニット ${aliveUnits.length}個を敗走させます`);
                this.defeatWarlord(warlordId);
                return true;
            }
        }

        return false;
    }
}
