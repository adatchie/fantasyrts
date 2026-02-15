/**
 * SEKIGAHARA RTS - Unit Spawner
 * ユニット生成ロジックを管理するモジュール
 *
 * main.jsのstartGame()内にあった巨大なユニット生成処理を分離。
 * カスタムマップ敵・プレイヤーユニット・ステージ敵・フォールバック(WARLORDS)を担当。
 */

import { STAGES, gameProgress } from '../game-data.js';
import { WARLORDS, TILE_SIZE, UNIT_TYPES, SOLDIERS_PER_UNIT } from '../constants.js';
import { BUILDING_TEMPLATES } from '../building.js?v=118';
import { decompressBlocks } from '../map-repository.js';

export class UnitSpawner {
    /**
     * @param {Object} game - Gameインスタンス
     */
    constructor(game) {
        this.game = game;
    }

    /**
     * カスタムマップのセットアップ（テレイン再構築・建物配置）
     */
    setupCustomMap() {
        const game = this.game;
        const mapData = game.customMapData;

        if (!mapData || !game.renderingEngine) return;

        console.log('Starting Custom Map:', mapData.name);

        // 既存のテレインをクリアしてから新規マップを構築
        game.renderingEngine.clearTerrain();
        game.renderingEngine.buildTerrainFromMapData(mapData);
        game.mapSystem.setMapData(mapData);

        if (game.buildingSystem) {
            game.buildingSystem.clearBuildings();

            if (mapData.buildings && Array.isArray(mapData.buildings)) {
                mapData.buildings.forEach(b => {
                    const template = this._resolveBuildingTemplate(b, mapData);
                    if (template) {
                        game.buildingSystem.placeCustomBuildingAtGrid(
                            template,
                            b.gridX || b.x,
                            b.gridY || b.y,
                            b.rotation || 0
                        );
                    }
                });
            }
        }
    }

    /**
     * カスタムマップの敵ユニットを生成
     * @returns {Array} 生成されたユニット配列
     */
    spawnCustomMapEnemies() {
        const game = this.game;
        const mapData = game.customMapData;
        const units = [];

        if (!mapData || !mapData.units || !mapData.unitDefinitions || mapData.units.length === 0) {
            return units;
        }

        const enemySide = game.playerSide === 'EAST' ? 'WEST' : 'EAST';

        console.log('[CUSTOM MAP] Raw unitDefinitions JSON:', JSON.stringify(mapData.unitDefinitions));
        mapData.unitDefinitions.forEach(u => {
            console.log('  -', u.id, u.name, 'type=' + u.type);
        });

        mapData.units.forEach((placedUnit, placementIndex) => {
            const def = mapData.unitDefinitions.find(d => d.id === placedUnit.defId);
            if (!def) return;

            const warlordData = {
                name: def.name,
                side: enemySide,
                x: placedUnit.x,
                y: placedUnit.y,
                soldiers: (def.count || 1) * 1000,
                atk: def.atk || 50,
                def: def.def || 50,
                jin: 50,
                loyalty: 100,
                p: 50,
                kamon: null,
                bg: null,
                face: null
            };

            const warlordId = `enemy_${placementIndex}`;
            const generatedUnits = game.unitManager.createUnitsFromWarlord(
                warlordData, warlordId, [], game.mapSystem
            );

            generatedUnits.forEach((unit, i) => {
                unit.type = def.type;
                unit.level = def.level || 1;
                console.log('[CUSTOM MAP] Created: ' + unit.name + ' type=' + unit.type + ' def.type=' + def.type);
                if (def.role === 'commander' && i === 0) {
                    unit.unitType = 'HEADQUARTERS';
                }
            });

            units.push(...generatedUnits);
        });

        return units;
    }

    /**
     * プレイヤーのユニット（配置済み）を生成
     * @returns {Array} 生成されたユニット配列
     */
    spawnPlayerUnits() {
        const game = this.game;
        const units = [];

        if (!game.sceneManager) return units;

        const placements = game.sceneManager.getGameData('unitPlacements') || [];
        console.log(`[startGame] Found ${placements.length} placements.`);

        const deployedUnits = gameProgress.getDeployedUnits();
        console.log(`[startGame] Deployed units count: ${deployedUnits.length}`);

        placements.forEach(([unitId, pos], placementIndex) => {
            const targetId = typeof unitId === 'string' ? parseInt(unitId) : unitId;
            const unitData = deployedUnits.find(u => u.id === targetId);

            if (unitData) {
                console.log(`[startGame] Spawning player unit: ${unitData.name} (ID: ${targetId}) at ${pos.x},${pos.y}`);

                const unitCount = unitData.unitCount || 1;
                const soldiers = unitCount * SOLDIERS_PER_UNIT;

                const warlordData = {
                    name: unitData.warlordName || unitData.name,
                    side: game.playerSide,
                    x: pos.x,
                    y: pos.y,
                    soldiers: soldiers,
                    atk: unitData.atk || 50,
                    def: unitData.def || 50,
                    jin: unitData.jin || 50,
                    loyalty: unitData.loyalty || 100,
                    p: unitData.p || 50,
                    kamon: unitData.kamon || null,
                    bg: unitData.bg || null,
                    face: unitData.face || null
                };

                const warlordId = unitData.warlordId || `player_${placementIndex}`;
                const generatedUnits = game.unitManager.createUnitsFromWarlord(
                    warlordData, warlordId, [], game.mapSystem
                );

                generatedUnits.forEach((unit, i) => {
                    unit.type = unitData.type || 'infantry';
                    unit.level = unitData.level || 1;
                });

                units.push(...generatedUnits);
            } else {
                console.warn(`[startGame] Unit data NOT found for ID: ${targetId} (Original: ${unitId})`);
                console.log(`[startGame] Available IDs: ${deployedUnits.map(u => u.id).join(',')}`);
            }
        });

        return units;
    }

    /**
     * ステージ定義またはWARLORDSフォールバックから敵ユニットを生成
     * @param {boolean} skipIfCustomLoaded - カスタムマップ敵が既に読み込み済みならスキップ
     * @returns {Array} 生成されたユニット配列
     */
    spawnEnemyUnits(skipIfCustomLoaded) {
        const game = this.game;
        const units = [];

        if (skipIfCustomLoaded) return units;

        const currentStageId = gameProgress.currentStage;
        console.log('[DEBUG] currentStageId=' + currentStageId);
        console.log('[DEBUG] STAGES keys=' + Object.keys(STAGES));

        const stageConfig = STAGES[currentStageId] || (game.customMapData && game.customMapData.enemyForces ? game.customMapData : null);

        if (stageConfig && stageConfig.enemyForces) {
            console.log(`Generating enemies for stage: ${stageConfig.name}`);
            console.log(`Player side: ${game.playerSide}, Enemy side will be: ${game.playerSide === 'EAST' ? 'WEST' : 'EAST'}`);
            let enemyUnitIdCounter = 0;

            const zone = stageConfig.deploymentZone || { x: 0, y: 20, width: 20, height: 20 };

            stageConfig.enemyForces.forEach(force => {
                const typeInfo = Object.values(UNIT_TYPES).find(t => t.name === force.type) || UNIT_TYPES.INFANTRY;

                for (let i = 0; i < force.count; i++) {
                    const ex = zone.x + Math.floor(Math.random() * zone.width);
                    const ey = zone.y + Math.floor(Math.random() * zone.height);

                    const enemyWarlord = {
                        name: `敵将${enemyUnitIdCounter}`,
                        side: game.playerSide === 'EAST' ? 'WEST' : 'EAST',
                        x: ex,
                        y: ey,
                        soldiers: 3000,
                        atk: 50,
                        def: 50,
                        jin: 50,
                        loyalty: 0,
                        type: force.type,
                        face: null
                    };

                    const warlordId = `enemy_stage_${enemyUnitIdCounter}`;
                    const generatedEnemies = game.unitManager.createUnitsFromWarlord(
                        enemyWarlord, warlordId, [], game.mapSystem
                    );

                    generatedEnemies.forEach(u => {
                        u.unitType = 'NORMAL';
                        u.type = force.type || 'INFANTRY';
                        console.log('[ENEMY] Created: ' + u.name + ' type=' + u.type + ' force.type=' + force.type);
                    });

                    units.push(...generatedEnemies);
                    enemyUnitIdCounter++;
                }
            });
        } else if (!stageConfig && !game.customMapData) {
            // 関ヶ原デモのフォールバック
            console.log('[WARNING] Using WARLORDS fallback - units will be INFANTRY only!');
            Object.values(WARLORDS).forEach((warlord, index) => {
                if (warlord.side !== game.playerSide) {
                    const warlordId = `enemy_${index}`;
                    const generatedEnemies = game.unitManager.createUnitsFromWarlord(
                        warlord, warlordId, Object.values(WARLORDS), game.mapSystem
                    );
                    units.push(...generatedEnemies);
                }
            });
        }

        return units;
    }

    /**
     * レガシーモード（シナリオ）のユニット生成
     * @returns {Array} 生成されたユニット配列
     */
    spawnLegacyUnits() {
        const game = this.game;

        game.mapSystem.generateMap();
        Object.values(WARLORDS).forEach((warlord, index) => {
            game.unitManager.createUnitsFromWarlord(warlord, `warlord_${index}`, Object.values(WARLORDS), game.mapSystem);
        });

        return game.unitManager.getAllUnits();
    }

    // ==================== Private ====================

    /**
     * 建物テンプレートを解決する
     * @private
     */
    _resolveBuildingTemplate(buildingPlacement, mapData) {
        let template = buildingPlacement.templateData;

        if (template && !template.blockSize) {
            template.blockSize = TILE_SIZE;
        }

        if (!template && buildingPlacement.type) {
            // 1. カスタム定義から検索
            if (mapData.customBuildingDefinitions) {
                const customDef = mapData.customBuildingDefinitions.find(d => d.id === buildingPlacement.type);
                if (customDef) {
                    template = customDef.data;
                    if (!template.blockSize) template.blockSize = TILE_SIZE;

                    if (template.compressedBlocks && !template.blocks) {
                        template.blocks = decompressBlocks(template.compressedBlocks, template.size);
                    }
                    if (customDef.name) template.name = customDef.name;
                }
            }
            // 2. 標準テンプレートから検索
            if (!template) {
                template = BUILDING_TEMPLATES[buildingPlacement.type];
            }
        }

        return template;
    }
}
