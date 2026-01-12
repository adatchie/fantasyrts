/**
 * SEKIGAHARA RTS - Combat System
 * 戦闘処理とユニット行動
 */

import { getDist, getDistRaw, getFacingAngle, findPath, getDistAttack } from './pathfinding.js';
import { TERRAIN_TYPES } from './map.js';
import { hexToPixel } from './pathfinding.js';
import { DIALOGUE } from './constants.js';
import { generatePortrait } from './rendering.js';
import { getFormationModifiers, canMoveWithFormation, checkForcedFormationChange, FORMATION_INFO, calculateFormationTargets } from './formation.js?v=2';
import { UNIT_TYPE_HEADQUARTERS } from './constants.js';

export class CombatSystem {
    constructor(audioEngine, unitManager = null) {
        this.audioEngine = audioEngine;
        this.activeEffects = [];
        this.activeBubbles = [];
        this.playerSide = 'EAST'; // デフォルト値
        this.unitManager = unitManager; // 陣形チェック用
    }

    setPlayerSide(side) {
        this.playerSide = side;
    }

    setUnitManager(unitManager) {
        this.unitManager = unitManager;
    }

    setRenderingEngine(renderingEngine) {
        this.renderingEngine = renderingEngine;
    }

    setMapSystem(mapSystem) {
        this.mapSystem = mapSystem;
    }

    /**
     * ユニットの行動を処理
     */
    async processUnit(unit, allUnits, map, warlordPlotUsed = {}) {
        if (!unit.order) return;

        console.log(`[processUnit] ${unit.name} (${unit.unitType}): order=${unit.order.type}, formation=${unit.formation}`);

        // 本陣ユニットの場合、兵力による強制陣形変更をチェック
        if (unit.unitType === UNIT_TYPE_HEADQUARTERS && this.unitManager) {
            const forceChange = checkForcedFormationChange(unit.soldiers, unit.formation);
            if (forceChange.needsChange) {
                unit.formation = forceChange.newFormation;
                const info = FORMATION_INFO[forceChange.newFormation];
                this.showFormation(unit, info.nameShort);
                console.log(`強制陣形変更: ${unit.name} -> ${info.nameShort} (兵力: ${unit.soldiers})`);
            }
        }

        const target = allUnits.find(u => u.id === unit.order.targetId);
        const reach = (unit.size + (target ? target.size : 1)) / 2.0 + 0.5;

        if (unit.order.type === 'PLOT' && target && !target.dead) {
            await this.processPlot(unit, target, allUnits, warlordPlotUsed, map);
        } else if (unit.order.type === 'ATTACK' && target && !target.dead) {
            await this.processAttack(unit, target, allUnits, map, reach);
        } else if (unit.order.type === 'MOVE') {
            await this.processMove(unit, allUnits, map);
        }

        // 行動完了フラグを設定（行動フェイズで行動済みとして静止させる）
        unit.hasActed = true;
    }

    /**
     * 調略を処理
     * マルチユニットシステム: 1武将1ターン1回のみ
     */
    async processPlot(unit, target, allUnits, warlordPlotUsed = {}, map) {
        // この武将がすでに調略を使用済みかチェック
        if (warlordPlotUsed[unit.warlordId]) {
            console.log(`${unit.warlordName} は今ターンすでに調略を使用済み`);
            // 調略をスキップして移動に切り替え
            unit.order = { type: 'MOVE', targetHex: { x: target.x, y: target.y } };
            await this.processMove(unit, allUnits, map);
            return;
        }

        const dist = getDistAttack(unit, target);
        console.log(`[processPlot] ${unit.name} -> ${target.name}, dist=${dist}`);

        // 調略射程(5) + 陣形解除距離(3)
        const engagementDist = 8.0;

        if (dist <= 5) {
            unit.dir = getFacingAngle(unit.x, unit.y, target.x, target.y);
            this.speak(unit, 'PLOT_DO');
            this.speak(target, 'PLOT_REC');
            await this.spawnEffect('WAVE', unit, target);

            // エフェクトを見せるためのウェイト
            await this.wait(400);

            // 戦況による調略成功率
            const eTotal = allUnits.filter(u => u.side === 'EAST' && !u.dead)
                .reduce((a, c) => a + c.soldiers, 0);
            const wTotal = allUnits.filter(u => u.side === 'WEST' && !u.dead)
                .reduce((a, c) => a + c.soldiers, 0);
            const myTotal = unit.side === 'EAST' ? eTotal : wTotal;
            const total = eTotal + wTotal;
            const tideRatio = myTotal / (total || 1);
            const tideMod = (tideRatio - 0.5) * 100;

            let chance = 30 + (unit.jin - target.loyalty) + tideMod;
            if (target.loyalty > 95) chance = 1;

            console.log(`[processPlot] Chance: ${chance}% (Jin: ${unit.jin}, Loyalty: ${target.loyalty}, Tide: ${tideMod.toFixed(1)})`);

            if (Math.random() * 100 < chance) {
                // マルチユニットシステム: 対象武将の全ユニットを寝返らせる
                const targetWarlordId = target.warlordId;
                const targetWarlordUnits = allUnits.filter(u => u.warlordId === targetWarlordId);

                console.log(`調略成功: ${target.warlordName} (武将ID: ${targetWarlordId})`);
                console.log(`対象ユニット数: ${targetWarlordUnits.length}`);

                targetWarlordUnits.forEach(warlordUnit => {
                    console.log(`  - ユニットID ${warlordUnit.id}: ${warlordUnit.side} -> ${unit.side}`);
                    warlordUnit.side = unit.side;
                    warlordUnit.loyalty = 100;
                    warlordUnit.order = null; // 命令をクリア

                    // 本陣ユニットのみ画像を更新（2D用）
                    if (warlordUnit.imgCanvas) {
                        warlordUnit.imgCanvas = generatePortrait(warlordUnit, warlordUnit.side);
                    }

                    // 3D表示を更新
                    if (this.renderingEngine && this.renderingEngine.updateUnitVisuals) {
                        this.renderingEngine.updateUnitVisuals(warlordUnit);
                    }
                });

                this.spawnText({ q: target.x, r: target.y }, "寝返り！", "#0f0", 60);
                this.audioEngine.sfxArrangementSuccess(); // 調略成功SE

                // 画面中央にフローメッセージを表示（潰走演出と同様）
                const defectionMsg = (unit.side === this.playerSide)
                    ? `${target.warlordName}が味方についた模様！`
                    : `${target.warlordName}が敵に寝返った模様！`;
                const defectionColor = (unit.side === this.playerSide) ? '#00ff88' : '#ff4444';

                const div = document.createElement('div');
                div.className = 'vic-title';
                div.innerText = defectionMsg;
                div.style.position = 'absolute';
                div.style.top = '30%';
                div.style.left = '50%';
                div.style.transform = 'translate(-50%,-50%)';
                div.style.color = defectionColor;
                div.style.zIndex = 150;
                div.style.pointerEvents = 'none';
                div.style.whiteSpace = 'nowrap';
                div.style.fontSize = '32px';
                div.style.textShadow = '2px 2px 4px #000';
                document.getElementById('game-container').appendChild(div);
                setTimeout(() => div.remove(), 3000);
            } else {
                console.log(`[processPlot] Failed.`);
                this.spawnText({ q: target.x, r: target.y }, "失敗...", "#aaa", 40);
                this.audioEngine.sfxArrangementFail(); // 調略失敗SE
            }

            // 調略使用フラグを立てる（武将単位）
            warlordPlotUsed[unit.warlordId] = true;

            unit.order = null;
            await this.wait(400);
        } else if (dist > engagementDist) {
            // まだ遠い場合は陣形を維持して移動
            console.log(`[processPlot] Target too far (${dist}), moving in formation.`);

            const originalOrder = unit.order;
            unit.order = {
                type: 'MOVE',
                targetHex: { x: target.x, y: target.y },
                originalTargetId: target.id
            };

            await this.processMove(unit, allUnits, map);

            // 命令復帰
            if (unit.order === null && getDist(unit, target) > 5) {
                unit.order = originalOrder;
            } else {
                unit.order = originalOrder;
            }
        } else {
            console.log(`[processPlot] Moving to plot range.`);
            await this.moveUnitStep(unit, target, allUnits, map);
        }
    }

    /**
     * 攻撃を処理
     */
    /**
     * 攻撃を処理
     */
    async processAttack(unit, target, allUnits, map, reach) {
        // スクエアグリッドに伴い、距離判定を厳格化（チェビシェフ距離を使用）
        const dist = getDistAttack(unit, target);
        console.log(`[processAttack] ${unit.name} -> ${target.name}, dist=${dist}, reach=${reach}`);

        // 接敵するまでは陣形で近づく
        // reach + 3.0 くらいまでは陣形で整然と近づき、そこから個別に襲いかかるイメージ
        const engagementDist = reach + 3.0;

        if (dist <= reach) {
            // 攻撃射程内なら攻撃実行
            unit.dir = getFacingAngle(unit.x, unit.y, target.x, target.y);
            this.speak(unit, 'ATTACK');
            await this.combat(unit, target, allUnits, map);
        } else if (dist > engagementDist) {
            // まだ遠い場合は陣形を維持して移動
            // 一時的にMOVE命令のフリをしてprocessMoveを呼ぶ（ただしターゲットは維持）
            // processMoveは内部で陣形位置を計算して移動する

            // 重要: processMoveは unit.order.targetHex を参照するので、一時的にセットする
            const originalOrder = unit.order;
            unit.order = {
                type: 'MOVE',
                targetHex: { x: target.x, y: target.y },
                // 元のターゲット情報を保持して、陣形計算時の本陣の向き決定などに使う
                originalTargetId: target.id
            };

            await this.processMove(unit, allUnits, map);

            // 命令を元に戻す（次ターンも攻撃を継続するため）
            // processMove内で目的地に着くとorderがnullになることがあるので注意
            if (unit.order === null && getDistAttack(unit, target) > reach) {
                // まだ届いていないのにMove完了扱いでnullになった場合、攻撃命令を復帰させる
                unit.order = originalOrder;
            } else {
                // まだ移動中なら、次のターンも攻撃命令として処理したいので復帰
                unit.order = originalOrder;
            }
        } else {
            // 接敵距離に入ったら、個別にターゲットへ殺到する
            const moved = await this.moveUnitStep(unit, target, allUnits, map);
            // 移動後に再チェック
            const newDist = getDistAttack(unit, target);
            if (newDist <= reach) {
                unit.dir = getFacingAngle(unit.x, unit.y, target.x, target.y);
                this.speak(unit, 'ATTACK');
                await this.combat(unit, target, allUnits, map);
            }
        }
    }

    /**
     * 移動を処理
     * 本陣の場合は陣形制限をチェック
     */
    async processMove(unit, allUnits, map) {
        console.log(`[processMove] START: ${unit.name}, unitType=${unit.unitType}, formation=${unit.formation}`);

        let dest = unit.order.targetHex;

        // ---------------------------------------------------------
        // 陣形移動ロジック (配下ユニットの場合)
        // ---------------------------------------------------------
        if (unit.unitType !== UNIT_TYPE_HEADQUARTERS) {
            // 本陣を探す
            const hq = allUnits.find(u => u.warlordId === unit.warlordId && u.unitType === UNIT_TYPE_HEADQUARTERS && !u.dead);

            if (hq && hq.formation) {
                // 配下ユニットリストを取得（自分を含む、ID順でソートして一貫性を保つ）
                const subordinates = allUnits
                    .filter(u => u.warlordId === unit.warlordId && u.unitType !== UNIT_TYPE_HEADQUARTERS && !u.dead)
                    .sort((a, b) => a.id - b.id);

                // 本陣の向きを決定（移動中なら移動方向、そうでなければ現在の向き）
                let baseDir = hq.dir;
                if (hq.order && hq.order.targetHex) {
                    // 移動目標がある場合はそちらを向く
                    baseDir = getFacingAngle(hq.x, hq.y, hq.order.targetHex.x, hq.order.targetHex.y);
                }

                // 陣形ターゲットを計算（本陣の現在位置を基準、地形考慮）
                const targets = calculateFormationTargets({ ...hq, dir: baseDir }, subordinates, this.mapSystem);

                if (targets && targets.has(unit.id)) {
                    const formDest = targets.get(unit.id);
                    // 簡易的に、ターゲットが敵ユニットでない（単なる移動）なら陣形位置を優先
                    if (dest.id === undefined) {
                        dest = formDest;
                    }
                }
            }
        }
        // ---------------------------------------------------------
        if (getDistRaw(unit.x, unit.y, dest.x, dest.y) === 0) {
            unit.order = null;
        } else {
            // 本陣の場合、配下の追従を待つ（足並みを揃える）処理
            // 本陣の場合、配下の追従を待つ（足並みを揃える）処理
            if (unit.unitType === UNIT_TYPE_HEADQUARTERS && this.unitManager) {
                // 1. 緊急回避チェック：近くに敵がいる場合はなりふり構わず動く
                let enemyNearby = false;
                for (const other of allUnits) {
                    if (other.side !== unit.side && !other.dead && getDistRaw(unit.x, unit.y, other.x, other.y) <= 2) {
                        enemyNearby = true;
                        break;
                    }
                }

                if (!enemyNearby) {
                    const subordinates = this.unitManager.getUnitsByWarlordId(unit.warlordId)
                        .filter(u => !u.dead && u.unitType !== UNIT_TYPE_HEADQUARTERS);

                    if (subordinates.length > 0) {
                        // 周囲6HEX以内にいる配下をカウント（地形による遅れを考慮して緩和）
                        const nearbySubordinates = subordinates.filter(u => getDistRaw(unit.x, unit.y, u.x, u.y) <= 6);
                        const ratio = nearbySubordinates.length / subordinates.length;

                        // 配下の50%以上が近くにいないなら、移動を待機
                        if (ratio < 0.5) {
                            console.log(`[本陣待機] ${unit.name}: 配下到着待ち (${nearbySubordinates.length}/${subordinates.length})`);
                            this.spawnText({ q: unit.x, r: unit.y }, "軍待ち...", "#aaa", 40);
                            await this.wait(200); // 少しだけウェイトを入れて雰囲気を出す
                            return; // 移動スキップ
                        }
                    }
                }
            }

            await this.moveUnitStep(unit, dest, allUnits, map);
        }
    }

    /**
     * ユニットを移動（パスファインディング使用）
     * 包囲移動をサポート
     */
    async moveUnitStep(unit, dest, allUnits, map) {
        let targetQ = dest.x;
        let targetR = dest.y;

        // 目標がユニット（攻撃対象）の場合、包囲位置を探す
        if (dest.id !== undefined) {
            const surroundPos = this.findSurroundPosition(unit, dest, allUnits);
            if (surroundPos) {
                targetQ = surroundPos.x;
                targetR = surroundPos.y;
            }
        }

        const path = findPath(unit.x, unit.y, targetQ, targetR, allUnits, unit, this.mapSystem);
        let moves = unit.movePower || 6;
        let actuallyMoved = false;

        for (let i = 1; i < path.length && moves > 0; i++) {
            const next = path[i];

            // 念のため再チェック（状況が変わっている可能性）
            const blocker = allUnits.find(u =>
                u.id !== unit.id &&
                !u.dead &&
                getDistRaw(next.x, next.y, u.x, u.y) < (unit.radius + u.radius)
            );

            if (blocker) {
                // 味方ユニットなら位置交換（Swap）を行う
                if (blocker.side === unit.side) {
                    console.log(`🔄 位置交換 (Swap): ${unit.name} <-> ${blocker.name}`);

                    // blockerをunitの元いた位置に移動させる
                    blocker.x = unit.x;
                    blocker.y = unit.y;
                    blocker.pos = hexToPixel(blocker.x, blocker.y);
                    // blockerの向きも反転させておく（すれ違った感が出る）
                    // blocker.dir = (unit.dir + 3) % 6; 

                    // unitは予定通りnextへ進む
                    unit.dir = getFacingAngle(unit.x, unit.y, next.x, next.y);
                    unit.x = next.x;
                    unit.y = next.y;
                    unit.pos = hexToPixel(unit.x, unit.y);

                    actuallyMoved = true;
                    moves--; // コスト消費
                    continue;
                } else {
                    // 敵なら移動不可
                    return actuallyMoved;
                }
            }

            unit.dir = getFacingAngle(unit.x, unit.y, next.x, next.y);

            // 移動コスト計算
            let cost = 1;
            if (map && map[next.y] && map[next.y][next.x]) {
                const t = map[next.y][next.x];
                if (TERRAIN_TYPES[t.type]) {
                    cost = TERRAIN_TYPES[t.type].moveCost;
                }
            }

            // 無限コスト（移動不可）なら停止
            if (cost === Infinity) break;

            if (moves >= cost) {
                // 移動実行
                unit.x = next.x;
                unit.y = next.y;
                unit.pos = hexToPixel(unit.x, unit.y);
                actuallyMoved = true;
                moves -= cost;
                await this.wait(20);
            } else {
                // 移動力不足で停止（次のターンへ）
                break;
            }
        }

        return actuallyMoved;
    }

    /**
     * 包囲位置を探す
     * 目標の周囲で空いているスペースを見つける
     */
    findSurroundPosition(unit, target, allUnits) {
        const directions = [
            [+1, 0], [+1, -1], [0, -1],
            [-1, 0], [-1, +1], [0, +1]
        ];

        // 目標の周囲6方向をチェック（スクエアグリッドでは4方向）
        const surroundPositions = [];
        for (const [dx, dy] of directions) {
            const nx = target.x + dx;
            const ny = target.y + dy;

            // 空いているかチェック
            const isOccupied = allUnits.some(u =>
                u.id !== unit.id &&
                !u.dead &&
                getDistRaw(nx, ny, u.x, u.y) < (unit.radius + u.radius)
            );

            if (!isOccupied) {
                const dist = getDistRaw(unit.x, unit.y, nx, ny);
                surroundPositions.push({ x: nx, y: ny, dist });
            }
        }

        if (surroundPositions.length === 0) return null;

        // 現在位置から最も近い包囲位置を選択
        surroundPositions.sort((a, b) => a.dist - b.dist);
        return surroundPositions[0];
    }

    /**
     * 戦闘を実行
     */
    async combat(att, def, allUnits, map) {
        att.dir = getFacingAngle(att.x, att.y, def.x, def.y);

        // 包囲攻撃の判定
        const siegers = allUnits.filter(u =>
            u.side === att.side &&
            !u.dead &&
            u.id !== att.id &&
            getDist(u, def) <= (u.size + def.size) / 2 + 1
        );

        // 鬨の声（戦闘開始SE）
        this.audioEngine.sfxBattleCry();

        // 攻撃側から防御側への攻撃線
        this.addEffect('BEAM', { q: att.x, r: att.y }, { q: def.x, r: def.y }, '#ffaa00');

        // 陣営色を取得するローカル関数
        const getSideColor = (side) => {
            if (side === 'EAST') return 0x6666FF; // 青（少し明るめ）
            if (side === 'WEST') return 0xFF4444; // 赤
            return 0xAAAAAA;
        };

        // 攻撃ユニットを少し光らせる
        this.addEffect('UNIT_FLASH', { unitId: att.id, color: getSideColor(att.side), duration: 10 });

        siegers.forEach(s => {
            const siegeColor = getSideColor(s.side);
            this.addEffect('BEAM', { q: s.x, r: s.y }, { q: def.x, r: def.y }, '#ffaa00');
            // 包囲参加ユニットのHEXを点滅させる
            this.addEffect('HEX_FLASH', { q: s.x, r: s.y, color: siegeColor });
            // ユニット自体も少し光らせる
            this.addEffect('UNIT_FLASH', { unitId: s.id, color: siegeColor, duration: 30 });
        });

        // 戦闘エフェクト: 土煙と火花を追加
        this.addEffect('DUST', { q: def.x, r: def.y }, null, null);
        // 攻撃アニメーション（突撃）
        if (this.renderingEngine && this.renderingEngine.triggerUnitAttackAnimation) {
            this.renderingEngine.triggerUnitAttackAnimation(att.id, def.id);
            siegers.forEach(s => {
                this.renderingEngine.triggerUnitAttackAnimation(s.id, def.id);
            });
        }

        // 突撃の予備動作時間（少し待ってからエフェクト）
        await this.wait(150);

        this.spawnSparks(att, def); // 攻撃側と防御側の間に火花

        this.audioEngine.sfxHit();
        await this.wait(300);

        // 地形ボーナス
        const hAtt = map[att.y][att.x].h;
        const hDef = map[def.y][def.x].h;
        let mod = 1.0 + (hAtt > hDef ? 0.3 : 0) + (siegers.length * 0.2);

        // 方向ボーナス
        let dirDiff = Math.abs(att.dir - def.dir);
        if (dirDiff > 3) dirDiff = 6 - dirDiff;

        let dirMod = 1.0;
        let dirMsg = "";
        if (dirDiff === 0) {
            dirMod = 2.0;
            dirMsg = "背面攻撃!";
        } else if (dirDiff !== 3) {
            dirMod = 1.5;
            dirMsg = "側面攻撃!";
        }

        if (dirMsg) this.spawnText({ q: def.x, r: def.y }, dirMsg, "#ffff00", 40);

        // 陣形によるステータス修正
        const attFormation = getFormationModifiers(att.formation);
        const defFormation = getFormationModifiers(def.formation);
        const finalAtkStat = att.atk + attFormation.atk;
        const finalDefStat = def.def + defFormation.def;

        // 入力値の検証（NaN発生源の特定用）
        if (typeof att.atk !== 'number' || typeof att.soldiers !== 'number' ||
            typeof def.def !== 'number' || typeof def.soldiers !== 'number') {
            console.error('[NaN DEBUG] Invalid unit data:', {
                attacker: { name: att.name, atk: att.atk, soldiers: att.soldiers },
                defender: { name: def.name, def: def.def, soldiers: def.soldiers }
            });
        }

        // ダメージ計算（陣形修正を適用）
        // 安全な兵士数（負やNaNを防止）
        const safeSoldiers = (typeof att.soldiers === 'number' && att.soldiers > 0) ? att.soldiers : 1;
        let dmgToDef = Math.floor((Math.sqrt(safeSoldiers) * finalAtkStat * mod * dirMod) / (finalDefStat / 15));
        if (!Number.isFinite(dmgToDef) || dmgToDef < 10) dmgToDef = 10;
        const dmgToAtt = Math.floor(dmgToDef * 0.2);

        // ダメージ適用
        def.soldiers -= dmgToDef;
        att.soldiers -= dmgToAtt;
        this.spawnText({ q: def.x, r: def.y }, `-${dmgToDef}`, '#ff3333', 60);
        this.spawnText({ q: att.x, r: att.y }, `-${dmgToAtt}`, '#ff8888', 60);
        this.speak(def, 'DAMAGED');

        // 被ダメージアニメーションをトリガー
        if (this.renderingEngine && this.renderingEngine.triggerDamageAnimation) {
            this.renderingEngine.triggerDamageAnimation(def.id);
            if (dmgToAtt > 0) {
                this.renderingEngine.triggerDamageAnimation(att.id);
            }
        }

        // 3Dレンダラー側のユニット情報を更新（兵士数ゲージなど）
        if (this.renderingEngine && this.renderingEngine.updateUnitInfo) {
            // ユニットメッシュを取得して更新
            const attMesh = this.renderingEngine.unitMeshes.get(att.id);
            const defMesh = this.renderingEngine.unitMeshes.get(def.id);
            if (attMesh) this.renderingEngine.updateUnitInfo(attMesh, att);
            if (defMesh) this.renderingEngine.updateUnitInfo(defMesh, def);
        }

        // 死亡判定（NaNの場合も死亡として扱う）
        if (def.soldiers <= 0 || isNaN(def.soldiers)) {
            def.soldiers = 0;
            def.dead = true;
            // 死亡アニメーションをトリガー（フェードアウト付き）
            if (this.renderingEngine && this.renderingEngine.triggerDeathAnimation) {
                this.renderingEngine.triggerDeathAnimation(def.id);
            }
            await this.dramaticDeath(def, att.side);
        }
        if (att.soldiers <= 0 || isNaN(att.soldiers)) {
            att.soldiers = 0;
            att.dead = true;
            // 死亡アニメーションをトリガー（フェードアウト付き）
            if (this.renderingEngine && this.renderingEngine.triggerDeathAnimation) {
                this.renderingEngine.triggerDeathAnimation(att.id);
            }
            await this.dramaticDeath(att, def.side);
        }

        await this.wait(200);
        this.activeEffects = this.activeEffects.filter(e => e.type !== 'BEAM');
    }

    /**
     * 劇的な死亡演出
     * @param {Object} unit - 討ち取られたユニット
     * @param {string} killerSide - 討ち取った側の陣営
     */
    async dramaticDeath(unit, killerSide) {
        // 本陣かどうかを判定
        const isHeadquarters = (unit.unitType === 'HEADQUARTERS');

        // 討ち取った側によってSEを変更
        if (killerSide === this.playerSide) {
            // 敵を討ち取った！シャキーン！
            this.audioEngine.sfxVictorySlash();
        } else {
            // 味方が討ち取られた…ズバッ
            this.audioEngine.sfxDefeatSlash();
        }

        this.speak(unit, 'DYING', true);

        const flash = document.getElementById('flash-overlay');
        flash.style.opacity = 0.5;
        setTimeout(() => flash.style.opacity = 0, 150);

        // メッセージを本陣と配下部隊で区別
        let msg, color;

        if (isHeadquarters) {
            // 総大将判定
            const isCommander = (unit.name === "徳川家康" || unit.name === "石田三成");

            if (unit.side !== this.playerSide) {
                // 敵本陣の場合、討ち死にか敗走かをランダムで決定
                // 将来的には士気などが関わる予定
                if (Math.random() < 0.5) {
                    // パターンA: 敗走（撤退）
                    if (isCommander) {
                        msg = `敵総大将・${unit.name}、戦場より撤退！`;
                    } else {
                        msg = `${unit.name}、戦場より撤退！`;
                    }
                    color = '#ffa500'; // オレンジ色

                    // 顔グラフィックのカットイン表示
                    if (unit.face) {
                        this.showWarlordCutIn(unit, 'ROUT');
                    }
                } else {
                    // パターンB: 討ち死に
                    if (isCommander) {
                        msg = `敵総大将・${unit.name}、討ち取ったり！`;
                    } else {
                        msg = `敵将${unit.name}、討ち取ったり！`;
                    }
                    color = '#ff0';

                    // 顔グラフィックのカットイン表示（討ち死に用）
                    if (unit.face) {
                        this.showWarlordCutIn(unit, 'DEATH');
                    }
                }
            } else {
                // 味方本陣の場合
                if (Math.random() < 0.5) {
                    // 敗走
                    if (isCommander) {
                        msg = `総大将・${unit.name}、戦場より撤退！`;
                    } else {
                        msg = `${unit.name}、戦場より撤退！`;
                    }
                    color = '#ffa500';
                    if (unit.face) {
                        this.showWarlordCutIn(unit, 'ROUT');
                    }
                } else {
                    // 討ち死に
                    msg = `無念… ${unit.name} 討ち死に！`;
                    color = '#aaa';
                    if (unit.face) {
                        this.showWarlordCutIn(unit, 'DEATH');
                    }
                }
            }
        } else {
            // 配下部隊: 「撃破/壊滅」メッセージ
            msg = (unit.side === this.playerSide) ?
                `${unit.warlordName}配下の部隊、壊滅…` :
                `${unit.warlordName}配下の部隊、撃破！`;
            color = (unit.side === this.playerSide) ? '#aaa' : '#ffa500';
        }

        // テキスト表示
        const div = document.createElement('div');
        div.className = 'vic-title';
        div.innerText = msg;
        div.style.position = 'absolute';
        div.style.top = '30%';
        div.style.left = '50%';
        div.style.transform = 'translate(-50%,-50%)';
        div.style.color = color;
        div.style.zIndex = 150;
        div.style.pointerEvents = 'none';
        div.style.whiteSpace = 'nowrap';
        // テキストシャドウやフォントサイズを強化
        div.style.fontSize = isHeadquarters ? '36px' : '24px';
        div.style.textShadow = '2px 2px 4px #000';

        document.getElementById('game-container').appendChild(div);
        setTimeout(() => div.remove(), 3000);

        await this.wait(1000);
    }

    /**
     * 武将のカットインを表示（敗走時など）
     * @param {Object} unit
     * @param {string} type 'ROUT' | 'DEATH'
     */
    showWarlordCutIn(unit, type) {
        const container = document.getElementById('game-container');

        // 画像要素作成
        const img = document.createElement('img');
        img.src = `portraits/${unit.face}`;
        img.style.position = 'absolute';
        img.style.top = '50%';
        img.style.left = '50%';
        img.style.transform = 'translate(-50%, -50%) scale(0.5)';
        img.style.maxHeight = '60%';
        img.style.zIndex = 140; // テキスト(150)の後ろ
        img.style.opacity = '0';
        img.style.transition = 'all 0.5s ease-out';
        img.style.pointerEvents = 'none';

        container.appendChild(img);

        // アニメーション開始
        requestAnimationFrame(() => {
            img.style.opacity = '1';
            img.style.transform = 'translate(-50%, -50%) scale(1.0)';
        });

        if (type === 'DEATH') {
            // 討ち死に演出: ランダムで3パターンから選択
            const variation = Math.floor(Math.random() * 3) + 1;

            setTimeout(() => {
                // まずは共通でモノクロ化
                img.style.filter = 'grayscale(100%) contrast(1.2) brightness(0.8)';
                img.style.transition = 'filter 1.0s ease, transform 0.2s';

                // 少し揺らして衝撃を表現
                img.style.transform = 'translate(-50%, -50%) scale(1.05)';
                setTimeout(() => img.style.transform = 'translate(-50%, -50%) scale(1.0)', 100);

                // 各演出へ分岐
                setTimeout(() => {
                    if (variation === 1) {
                        // 演出1: 散る（既存）
                        img.style.transition = 'all 1.5s ease-out';
                        img.style.opacity = '0';
                        img.style.transform = 'translate(-50%, -50%) scale(1.5)';
                        img.style.filter = 'grayscale(100%) blur(10px)'; // ぼやけて消える

                        setTimeout(() => img.remove(), 1500);

                    } else if (variation === 2) {
                        // 演出2: 両断（左右に割れて上下にズレる）

                        // 画像を複製して左右を作成
                        // 左半分
                        const left = img.cloneNode();
                        left.style.clipPath = 'polygon(0% 0%, 50% 0%, 50% 100%, 0% 100%)';
                        left.style.transition = 'all 1.2s ease-in';
                        container.appendChild(left);

                        // 右半分
                        const right = img.cloneNode();
                        right.style.clipPath = 'polygon(50% 0%, 100% 0%, 100% 100%, 50% 100%)';
                        right.style.transition = 'all 1.2s ease-in';
                        container.appendChild(right);

                        // 元画像は隠す
                        img.style.display = 'none';

                        // アニメーション実行（左上・右下へスライドしながらフェードアウト）
                        requestAnimationFrame(() => {
                            left.style.transform = 'translate(-50%, calc(-50% - 100px)) scale(1.0)'; // 左は上へ
                            left.style.opacity = '0';

                            right.style.transform = 'translate(-50%, calc(-50% + 100px)) scale(1.0)'; // 右は下へ
                            right.style.opacity = '0';
                        });

                        setTimeout(() => {
                            left.remove();
                            right.remove();
                            img.remove();
                        }, 1200);

                    } else if (variation === 3) {
                        // 演出3: 血しぶき（赤黒いエフェクト）

                        // ベース画像を赤黒く変化させる
                        // grayscale -> sepia -> hue-rotate(赤系) -> saturate(濃く) -> brightness(暗く)
                        img.style.transition = 'all 0.5s ease-in';
                        img.style.filter = 'grayscale(100%) sepia(100%) hue-rotate(-50deg) saturate(500%) contrast(1.5) brightness(0.4)';
                        img.style.transform = 'translate(-50%, -50%) scale(1.02)';

                        // 血のオーバーレイを追加
                        const bloodOverlay = document.createElement('div');
                        bloodOverlay.style.position = 'absolute';
                        bloodOverlay.style.top = '50%';
                        bloodOverlay.style.left = '50%';
                        // 画像サイズを正確に取得するのは難しいので、画面中央に大きめの円形グラデーションを出す
                        bloodOverlay.style.width = '600px';
                        bloodOverlay.style.height = '600px';
                        bloodOverlay.style.transform = 'translate(-50%, -50%)';
                        bloodOverlay.style.background = 'radial-gradient(circle, rgba(180, 0, 0, 0.6) 0%, rgba(100, 0, 0, 0.0) 70%)';
                        bloodOverlay.style.mixBlendMode = 'multiply';
                        bloodOverlay.style.zIndex = 141;
                        bloodOverlay.style.opacity = '0';
                        bloodOverlay.style.pointerEvents = 'none';
                        bloodOverlay.style.transition = 'opacity 0.2s ease-out';

                        container.appendChild(bloodOverlay);

                        requestAnimationFrame(() => {
                            bloodOverlay.style.opacity = '1';
                        });

                        // フェードアウト
                        setTimeout(() => {
                            img.style.transition = 'all 1.5s ease-out';
                            img.style.opacity = '0';
                            bloodOverlay.style.transition = 'opacity 1.5s ease-out';
                            bloodOverlay.style.opacity = '0';

                            setTimeout(() => {
                                img.remove();
                                bloodOverlay.remove();
                            }, 1500);
                        }, 1000);
                    }
                }, 1200); // モノクロを見てる時間

            }, 800); // 最初の表示時間

        } else {
            // 敗走演出: 表示 -> フレームアウト or フェードアウト
            setTimeout(() => {
                img.style.opacity = '0';
                img.style.transform = 'translate(-50%, -50%) scale(0.8)'; // 奥に引っ込む感じ
                setTimeout(() => img.remove(), 500);
            }, 2000);
        }
    }

    // ユーティリティ関数
    speak(unit, type, force = false) {
        if (!force && Math.random() > 0.4) return;
        const lines = DIALOGUE[unit.p]?.[type];
        if (!lines) return;
        const text = lines[Math.floor(Math.random() * lines.length)];

        if (this.renderingEngine) {
            this.renderingEngine.add3DEffect('BUBBLE', {
                unit: unit,
                text: text
            });
        }

        this.activeBubbles.push({
            x: unit.pos.x,
            y: unit.pos.y - 40,
            text: text,
            life: 100
        });
    }

    showFormation(unit, formationName) {
        this.spawnText({ q: unit.x, r: unit.y }, formationName, "#00FFFF", 40);
        this.speak(unit, 'FORMATION'); // 陣形変更時のセリフがあれば
    }

    addEffect(type, start, end, color) {
        if (this.renderingEngine) {
            this.renderingEngine.add3DEffect(type, start, end, color);
        }
    }

    spawnText(pos, text, color, size) {
        if (this.renderingEngine) {
            this.renderingEngine.add3DEffect('FLOAT_TEXT', {
                q: pos.q,
                r: pos.r,
                text: text,
                color: color,
                size: size
            });
        }
    }

    spawnSparks(unit1, unit2) {
        if (this.renderingEngine) {
            this.renderingEngine.add3DEffect('SPARK', {
                q: (unit1.x + unit2.x) / 2,
                r: (unit1.y + unit2.y) / 2
            });
        }
    }

    spawnEffect(type, unit1, unit2) {
        if (this.renderingEngine) {
            this.renderingEngine.add3DEffect(type, { q: unit1.x, r: unit1.y }, { q: unit2.x, r: unit2.y });
        }
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    updateEffects() {
        this.activeEffects.forEach(e => {
            e.life--;
            if (e.type === 'FLOAT_TEXT') {
                e.y -= 0.5;
            } else if (e.type === 'SPARK') {
                // 火花の物理演算（ほとんど動かない小さな閃き）
                e.x += e.vx;
                e.y += e.vy;
                e.vx *= 0.85; // 強い空気抵抗ですぐに減衰
                e.vy *= 0.85;
            }
        });
        this.activeEffects = this.activeEffects.filter(e => e.life > 0);

        this.activeBubbles.forEach(b => b.life--);
        this.activeBubbles = this.activeBubbles.filter(b => b.life > 0);
    }
}
