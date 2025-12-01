/**
 * SEKIGAHARA RTS - Unit Manager
 * マルチユニットシステム: 兵力1000人単位でユニットを管理
 */

import { hexToPixel } from './pathfinding.js';
import { generatePortrait } from './rendering.js';

// ユニットタイプ定数
export const UNIT_TYPE_HEADQUARTERS = 'HEADQUARTERS'; // 本陣
export const UNIT_TYPE_NORMAL = 'NORMAL';             // 通常ユニット

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
    createUnitsFromWarlord(warlord, warlordId, allWarlords = []) {
        // 必要なユニット数を計算
        const totalUnits = Math.ceil(warlord.soldiers / SOLDIERS_PER_UNIT);

        // 本陣の初期位置を決定（重複回避）
        const hqPosition = this.findNonOverlappingPosition(
            warlord.q,
            warlord.r,
            totalUnits,
            allWarlords.filter(w => w !== warlord)
        );

        // 螺旋状の配置座標を生成
        const positions = this.generateSpiralPositions(hqPosition.q, hqPosition.r, totalUnits);

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

                // このユニットの兵力
                soldiers: soldierDistribution[i],
                maxSoldiers: soldierDistribution[i],

                // 位置情報
                q: positions[i].q,
                r: positions[i].r,
                pos: hexToPixel(positions[i].q, positions[i].r),
                dir: warlord.side === 'EAST' ? 3 : 0,

                // ゲーム状態
                order: null,
                dead: false,

                // 描画情報 - すべて1HEXサイズ
                radius: 0.45,
                size: 1,

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
     * @param {number} originalQ - 元のQ座標
     * @param {number} originalR - 元のR座標
     * @param {number} unitCount - 配置するユニット数
     * @param {Array} otherWarlords - 他の武将データ
     * @returns {{q: number, r: number}} 調整後の座標
     */
    findNonOverlappingPosition(originalQ, originalR, unitCount, otherWarlords) {
        // 必要な半径を計算（螺旋の最大半径）
        const requiredRadius = Math.ceil(Math.sqrt(unitCount)) + 1;

        // まず元の位置で重複チェック
        if (!this.checkOverlap(originalQ, originalR, requiredRadius, otherWarlords)) {
            return { q: originalQ, r: originalR };
        }

        // 重複する場合、螺旋状に探索
        let searchRadius = 1;
        while (searchRadius < 15) { // 最大15HEX探索
            const searchPositions = this.generateSpiralPositions(originalQ, originalR, searchRadius * 6);

            for (const pos of searchPositions) {
                if (!this.checkOverlap(pos.q, pos.r, requiredRadius, otherWarlords)) {
                    console.log(`Position adjusted: (${originalQ},${originalR}) -> (${pos.q},${pos.r})`);
                    return pos;
                }
            }

            searchRadius++;
        }

        // 見つからなければ元の位置を返す（最悪のケース）
        console.warn(`Could not find non-overlapping position for (${originalQ},${originalR})`);
        return { q: originalQ, r: originalR };
    }

    /**
     * 指定位置が他の武将と重複するかチェック
     * @param {number} q - チェックするQ座標
     * @param {number} r - チェックするR座標
     * @param {number} radius - 必要な半径
     * @param {Array} otherWarlords - 他の武将データ
     * @returns {boolean} 重複する場合true
     */
    checkOverlap(q, r, radius, otherWarlords) {
        for (const other of otherWarlords) {
            const distance = this.hexDistance(q, r, other.q, other.r);
            const otherRadius = Math.ceil(Math.sqrt(Math.ceil(other.soldiers / SOLDIERS_PER_UNIT))) + 1;

            // 2つの円が重なるかチェック
            if (distance < radius + otherRadius) {
                return true; // 重複
            }
        }
        return false; // 重複なし
    }

    /**
     * HEX距離を計算
     */
    hexDistance(q1, r1, q2, r2) {
        const dq = q2 - q1;
        const dr = r2 - r1;
        return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
    }

    /**
     * 時計回りの螺旋状に座標を生成
     * @param {number} centerQ - 中心のQ座標（本陣の位置）
     * @param {number} centerR - 中心のR座標
     * @param {number} count - 生成する座標の数
     * @returns {Array<{q: number, r: number}>} 座標配列
     */
    generateSpiralPositions(centerQ, centerR, count) {
        const positions = [{ q: centerQ, r: centerR }];

        if (count <= 1) return positions;

        // HEXの6方向（時計回り: 東, 南東, 南西, 西, 北西, 北東）
        const directions = [
            { q: 1, r: 0 },   // 0: 東
            { q: 0, r: 1 },   // 1: 南東  
            { q: -1, r: 1 },  // 2: 南西
            { q: -1, r: 0 },  // 3: 西
            { q: 0, r: -1 },  // 4: 北西
            { q: 1, r: -1 }   // 5: 北東
        ];

        let currentQ = centerQ;
        let currentR = centerR;
        let ring = 1; // 現在のリング（中心からの距離）

        while (positions.length < count) {
            // リングの開始位置（北東方向に移動）
            currentQ += directions[5].q;
            currentR += directions[5].r;

            // 6方向それぞれにring個ずつ配置
            for (let dir = 0; dir < 6 && positions.length < count; dir++) {
                for (let step = 0; step < ring && positions.length < count; step++) {
                    positions.push({ q: currentQ, r: currentR });

                    // 次の位置へ移動
                    currentQ += directions[dir].q;
                    currentR += directions[dir].r;
                }
            }

            ring++;
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

        if (hq && hq.soldiers <= 0 && !hq.dead) {
            console.log(`本陣全滅: ${hq.warlordName} - 全ユニット敗走`);
            this.defeatWarlord(warlordId);
            return true;
        }

        return false;
    }
}
