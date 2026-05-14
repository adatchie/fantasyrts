/**
 * SEKIGAHARA RTS - Unit Manager
 * マルチユニットシステム: 兵力1000人単位でユニットを管理
 */

import { hexToPixel } from './pathfinding.js';
import { generatePortrait } from './rendering.js';

// ユニットタイプ定数
import { UNIT_TYPE_HEADQUARTERS, UNIT_TYPE_NORMAL, UNIT_TYPES, getUnitTypeInfo } from './constants.js';

// 定数インポート
import { MAP_W, MAP_H } from './constants.js';
import { Squadron } from './game-data.js?v=126';
import { addStatBonuses, getEquipmentStatBonus, normalizeEquipment } from './equipment-data.js';

// 1ユニットあたりの標準兵力
export const SOLDIERS_PER_UNIT = 1000;

function resolveBaseStats(source, typeInfo) {
    return {
        ATK: source.ATK ?? source.atk ?? typeInfo?.atk ?? 50,
        DEF: source.DEF ?? source.def ?? typeInfo?.def ?? 50,
        AGI: source.AGI ?? source.jin ?? 50,
        VIT: source.VIT ?? 50,
        INT: source.INT ?? 50,
        MND: source.MND ?? 50,
        LUK: source.LUK ?? 50
    };
}

/**
 * マルチユニット管理クラス
 */
export class UnitManager {
    constructor() {
        this.units = [];           // 全ユニット配列
        this.warlordGroups = {};   // 武将ID -> ユニット配列のマップ
        this.squadrons = new Map(); // 部隊ID -> Squadronオブジェクト
        this.nextUnitId = 0;       // ユニットID発行カウンター
        this.nextSquadronId = 0;   // 部隊ID発行カウンター
    }

    /**
     * 全ユニット・部隊をクリア
     */
    clearUnits() {
        this.units.length = 0;
        this.warlordGroups = {};
        this.squadrons.clear();
    }

    /**
     * 武将データから複数ユニットを生成し、部隊(Squadron)を編成する
     * @param {Object} warlord - 武将データ
     * @param {number} warlordId - 武将ID
     * @param {Array} allWarlords - 全武将データ
     * @param {Object} mapSystem - マップシステム
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

        // 部隊(Squadron)を作成
        const squadronId = `squad_${this.nextSquadronId++}`;
        // リーダーIDは後で設定（最初のユニット生成後）
        const squadron = new Squadron(squadronId, null);

        // 陣形設定（AI判断などで初期陣形を決める場合はここで設定可能）
        // 現状はデフォルト(HOKO)

        // ユニット生成
        const units = [];
        // 武将ユニットのデフォルトタイプ（未指定なら歩兵）
        const rawType = warlord.class || warlord.type || warlord.unitType || 'INFANTRY';
        const defaultUnitType = String(rawType).toUpperCase();
        const typeInfo = getUnitTypeInfo(defaultUnitType) || UNIT_TYPES.INFANTRY;
        const equipment = normalizeEquipment(warlord.equipment);
        const baseStats = resolveBaseStats(warlord, typeInfo);
        const commanderEquipmentStats = getEquipmentStatBonus(equipment);

        for (let i = 0; i < totalUnits; i++) {
            const isHeadquarters = (i === 0); // 最初のユニット（中央）が本陣
            const activeEquipmentStats = isHeadquarters ? commanderEquipmentStats : {};
            const effectiveStats = addStatBonuses(baseStats, activeEquipmentStats);

            // 安全策：positionsが足りない場合は本陣の位置を使う
            const pos = positions[i] || hqPosition;

            const unit = {
                id: this.nextUnitId++,
                warlordId: warlordId,
                squadronId: squadronId, // 部隊IDを紐付け
                warlordName: warlord.name,
                unitType: isHeadquarters ? UNIT_TYPE_HEADQUARTERS : UNIT_TYPE_NORMAL,

                // ユニットタイプ
                class: defaultUnitType,
                type: defaultUnitType, // 互換性

                // 武将の属性を継承
                name: warlord.name,
                side: warlord.side,
                ATK: effectiveStats.ATK,
                DEF: effectiveStats.DEF,
                AGI: effectiveStats.AGI,
                VIT: effectiveStats.VIT,
                INT: effectiveStats.INT,
                MND: effectiveStats.MND,
                LUK: effectiveStats.LUK,
                atk: effectiveStats.ATK, // 互換性
                def: effectiveStats.DEF, // 互換性
                jin: effectiveStats.AGI, // 互換性
                baseStats: { ...baseStats },
                equipmentStats: isHeadquarters ? { ...commanderEquipmentStats } : null,
                equipment: isHeadquarters ? { ...equipment } : null,
                loyalty: warlord.loyalty,
                p: warlord.p,
                kamon: warlord.kamon,
                bg: warlord.bg,
                face: warlord.face,
                level: warlord.level ?? 1,
                exp: warlord.exp ?? 0,

                // このユニットの兵力
                soldiers: soldierDistribution[i],
                maxSoldiers: soldierDistribution[i],

                // 位置情報
                x: pos.x,
                y: pos.y,
                q: pos.x, // 互換性
                r: pos.y, // 互換性

                dir: warlord.side === 'EAST' ? 3 : 0,

                // ゲーム状態
                order: null,
                dead: false,
                formation: null,

                // 描画情報 - ユニットタイプに基づくサイズ
                size: isHeadquarters ? 1 : typeInfo.size,
                sizeShape: isHeadquarters ? 'single' : typeInfo.sizeShape || 'single',
                radius: isHeadquarters ? 0.45 : 0.45 * (typeInfo.size === 4 ? 1.5 : typeInfo.size === 2 ? 1.2 : 1),

                // 移動力 - ユニットタイプに基づく
                movePower: isHeadquarters ? 6 : typeInfo.baseMoveRange || 3,
                mobility: isHeadquarters ? 4 : typeInfo.mobility || 4,

                // 攻撃タイプ
                rangeType: isHeadquarters ? 'melee' : typeInfo.rangeType || 'melee',
                isAoe: isHeadquarters ? false : typeInfo.isAoe || false,
                isHealer: isHeadquarters ? false : typeInfo.isHealer || false,
                canPushBack: isHeadquarters ? false : typeInfo.canPushBack || false,

                // 画像は本陣のみ生成
                imgCanvas: isHeadquarters ? generatePortrait(warlord) : null
            };

            units.push(unit);
            squadron.addMember(unit.id);

            if (isHeadquarters) {
                squadron.leaderUnitId = unit.id;
            }
        }

        // 部隊を登録
        this.squadrons.set(squadronId, squadron);

        // 武将グループに登録
        this.warlordGroups[warlordId] = units;
        this.units.push(...units);

        return units;
    }

    /**
     * 部隊を取得
     */
    getSquadron(squadronId) {
        return this.squadrons.get(squadronId);
    }

    /**
     * ユニットIDから部隊を取得
     */
    getSquadronByUnitId(unitId) {
        const unit = this.units.find(u => u.id === unitId);
        if (unit && unit.squadronId) {
            return this.squadrons.get(unit.squadronId);
        }
        return null;
    }

    /**
     * 武将IDから部隊を取得（本陣ユニット経由）
     */
    getSquadronByWarlordId(warlordId) {
        const hq = this.getHeadquarters(warlordId);
        if (hq && hq.squadronId) {
            return this.squadrons.get(hq.squadronId);
        }
        return null;
    }

    /**
     * カスタムマップ用：単一ユニットを作成
     * @param {Object} unitData - ユニットデータ
     * @param {string} side - 陣営 ('EAST' or 'WEST')
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {number} rotation - 回転（オプション）
     * @returns {Object} 作成されたユニット
     */
    createUnitInstance(unitData, side, x, y, rotation = 0) {
        // 部隊(Squadron)を作成 (単独部隊)
        const squadronId = `squad_${this.nextSquadronId++}`;
        const squadron = new Squadron(squadronId, null);

        // ユニットタイプから基本パラメータを取得
        const unitTypeId = unitData.class || unitData.type || 'INFANTRY';
        const typeInfo = getUnitTypeInfo(unitTypeId) || UNIT_TYPES.INFANTRY;
        const equipment = normalizeEquipment(unitData.equipment);
        const baseStats = resolveBaseStats(unitData, typeInfo);
        const isHeadquartersUnit = (unitData.unitType || UNIT_TYPE_NORMAL) === UNIT_TYPE_HEADQUARTERS;
        const activeEquipmentStats = isHeadquartersUnit ? getEquipmentStatBonus(equipment) : {};
        const effectiveStats = addStatBonuses(baseStats, activeEquipmentStats);

        const unit = {
            id: this.nextUnitId++,
            warlordId: unitData.warlordId || `custom_${this.nextUnitId}`,
            squadronId: squadronId,
            warlordName: unitData.warlordName || unitData.name,
            unitType: unitData.unitType || UNIT_TYPE_NORMAL,

            // ユニット属性
            name: unitData.name,
            side: side,
            // ユニットタイプの基本ステータスを適用（unitDataの値で上書き可能）
            atk: effectiveStats.ATK,
            def: effectiveStats.DEF,
            jin: effectiveStats.AGI,
            ATK: effectiveStats.ATK,
            DEF: effectiveStats.DEF,
            AGI: effectiveStats.AGI,
            VIT: effectiveStats.VIT,
            INT: effectiveStats.INT,
            MND: effectiveStats.MND,
            LUK: effectiveStats.LUK,
            baseStats: { ...baseStats },
            equipmentStats: isHeadquartersUnit ? { ...activeEquipmentStats } : null,
            equipment: isHeadquartersUnit ? { ...equipment } : null,
            level: unitData.level ?? 1,
            exp: unitData.exp ?? 0,
            loyalty: unitData.loyalty ?? 100,
            p: unitData.p ?? 1000,
            kamon: unitData.kamon || null,
            bg: unitData.bg || '#333',
            face: unitData.face || null,
            class: unitTypeId,
            type: unitTypeId, // 互換性

            // 兵力
            soldiers: unitData.soldiers || 1000,
            maxSoldiers: unitData.maxSoldiers || unitData.soldiers || 1000,

            // HP（カスタムマップ用）
            hp: unitData.hp || unitData.maxHp || typeInfo.baseHp,
            maxHp: unitData.maxHp || unitData.hp || typeInfo.baseHp,
            level: unitData.level || 1,

            // 位置情報
            x: x,
            y: y,
            q: x,
            r: y,

            dir: rotation || (side === 'EAST' ? 3 : 0),

            // ゲーム状態
            order: null,
            dead: false,
            formation: null,

            // 描画情報 - ユニットタイプに基づくサイズ
            size: typeInfo.size,
            sizeShape: typeInfo.sizeShape || 'single',
            radius: 0.45 * (typeInfo.size === 4 ? 1.5 : typeInfo.size === 2 ? 1.2 : 1),

            // 移動力 - ユニットタイプに基づく
            movePower: typeInfo.baseMoveRange || 3,
            mobility: typeInfo.mobility || 4,

            // 攻撃タイプ
            rangeType: typeInfo.rangeType || 'melee',
            isAoe: typeInfo.isAoe || false,
            isHealer: typeInfo.isHealer || false,
            canPushBack: typeInfo.canPushBack || false,

            // 画像
            imgCanvas: unitData.unitType === UNIT_TYPE_HEADQUARTERS ? generatePortrait(unitData) : null
        };

        // 部隊構築
        squadron.addMember(unit.id);
        if (unit.unitType === UNIT_TYPE_HEADQUARTERS || !unitData.unitType) {
            squadron.leaderUnitId = unit.id; // 単独なら自分がリーダー
        }
        this.squadrons.set(squadronId, squadron);

        // ユニットを登録
        this.units.push(unit);

        // 武将グループにも登録
        if (!this.warlordGroups[unit.warlordId]) {
            this.warlordGroups[unit.warlordId] = [];
        }
        this.warlordGroups[unit.warlordId].push(unit);

        return unit;
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

    /**
     * 重ならない位置を探す（本陣用）
     */
    findNonOverlappingPosition(cx, cy, totalUnits, existingUnits) {
        // 本陣の位置自体が空いているかチェック
        // 空いていなければスパイラル探索で空き地を探す
        // ここでは簡易的にcx, cyをそのまま返す（必要なら探索ロジック実装）
        // 既存ユニットとの距離チェック
        let bestX = cx;
        let bestY = cy;
        let found = false;
        let radius = 0;

        while (!found && radius < 10) {
            const positions = this.generateSpiralPositions(cx, cy, 1, null, radius);
            for (const pos of positions) {
                const isOccupied = existingUnits.some(u => u.x === pos.x && u.y === pos.y);
                if (!isOccupied) {
                    bestX = pos.x;
                    bestY = pos.y;
                    found = true;
                    break;
                }
            }
            radius++;
        }

        return { x: bestX, y: bestY };
    }

    /**
     * 螺旋状の座標リストを生成
     * @param {number} cx 中心X
     * @param {number} cy 中心Y
     * @param {number} count 必要数
     * @param {Object} mapSystem マップシステム（通行可能判定用）
     * @param {number} startRadius 開始半径
     */
    generateSpiralPositions(cx, cy, count, mapSystem = null, startRadius = 0) {
        const positions = [];
        let x = cx;
        let y = cy;
        let dx = 0;
        let dy = -1;
        let stepCount = 0;
        const skipSteps = startRadius * startRadius * 2; // 内側リングのステップ数を近似

        // startRadius=0なら中心を含む
        if (startRadius === 0) {
            positions.push({ x, y });
        }

        if (positions.length >= count) return positions;

        let segmentLength = 1;
        let segmentPassed = 0;
        let run = 0;

        while (positions.length < count && run < 1000) {
            for (let i = 0; i < segmentLength; i++) {
                x += dx;
                y += dy;
                stepCount++;

                if (stepCount <= skipSteps) continue; // startRadius未満の位置をスキップ

                if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H) {
                    positions.push({ x, y });
                    if (positions.length >= count) return positions;
                }
            }
            segmentPassed++;

            // 方向転換
            const temp = dx;
            dx = -dy;
            dy = temp;

            if (segmentPassed >= 2) {
                segmentLength++;
                segmentPassed = 0;
            }
            run++;
        }

        return positions;
    }

    // ヘルパー：武将ごとのユニットリスト取得
    getUnitsByWarlordId(warlordId) {
        if (warlordId === undefined || warlordId === null) return [];

        const idKey = String(warlordId);
        const merged = new Map();
        const add = (unit) => {
            if (unit && String(unit.warlordId) === idKey) {
                merged.set(unit.id, unit);
            }
        };

        (this.warlordGroups[warlordId] || []).forEach(add);
        this.units.forEach(add);

        const units = Array.from(merged.values());
        this.warlordGroups[warlordId] = units;
        return units;
    }

    /**
     * 兵力をユニット数に応じて分配
     * 基本的には均等割り、余りは本陣（最初のユニット）に加算
     * @param {number} totalSoldiers - 総兵力
     * @param {number} unitCount - ユニット数
     * @returns {Array<number>} 各ユニットの兵力配列
     */
    distributeSoldiers(totalSoldiers, unitCount) {
        if (unitCount <= 0) return [];

        const base = Math.floor(totalSoldiers / unitCount);
        const remainder = totalSoldiers % unitCount;

        const distribution = new Array(unitCount).fill(base);

        // 余りを本陣（index 0）に加算
        if (remainder > 0) {
            distribution[0] += remainder;
        }

        return distribution;
    }
}
