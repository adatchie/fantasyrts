/**
 * Fantasy RTS - Map Data Repository
 * フィールド（地形）と建造物配置データを複数保存・管理
 */

import { MAP_REGISTRY } from './map-registry.js';
// import { TUTORIAL_PLAIN_DATA } from './data/maps/tutorial_plain.js'; // Removed in favor of registry

// ============================================
// マップデータ構造
// ============================================

/**
 * @typedef {Object} MapData
 * @property {string} id - マップ固有ID
 * @property {string} name - 表示名
 * @property {string} description - 説明
 * @property {number} version - データバージョン
 * @property {Date} createdAt - 作成日時
 * @property {Date} updatedAt - 更新日時
 * @property {Object} metadata - メタデータ（作者、難易度など）
 * @property {TerrainData} terrain - 地形データ
 * @property {BuildingData[]} buildings - 建造物データ
 * @property {ZoneData} zones - エリアデータ（配置可能範囲など）
 */

/**
 * @typedef {Object} TerrainData
 * @property {number} width - マップ幅
 * @property {number} height - マップ高さ
 * @property {number[][]} heightMap - 高さマップ (0-10)
 * @property {string[][]} terrainType - 地形タイプ (grass, water, mountain, etc.)
 */

/**
 * @typedef {Object} BuildingData
 * @property {string} id - 建造物ID
 * @property {string} type - 建造物タイプ
 * @property {number} x - X座標
 * @property {number} y - Y座標
 * @property {number} rotation - 回転角度 (0, 90, 180, 270)
 * @property {Object} properties - カスタムプロパティ
 */

/**
 * @typedef {Object} ZoneData
 * @property {Object} playerDeployment - プレイヤー配置可能エリア
 * @property {Object} enemyDeployment - 敵配置エリア
 * @property {Object[]} objectives - 目標地点
 */

// ============================================
// 地形タイプ定義
// ============================================

export const TERRAIN_TYPES = {
    GRASS: { id: 'grass', name: '草原', moveCost: 1, passable: true, color: '#4a7c41' },
    PLAIN: { id: 'plain', name: '平原', moveCost: 1, passable: true, color: '#4a7c41' }, // GRASSと同じだが互換性のため追加
    FOREST: { id: 'forest', name: '森', moveCost: 1.5, passable: true, color: '#2d5a27' },
    WATER: { id: 'water', name: '水', moveCost: Infinity, passable: false, color: '#3b7cb8' },
    MOUNTAIN: { id: 'mountain', name: '山', moveCost: 2, passable: true, color: '#7a6b5a' },
    ROAD: { id: 'road', name: '道', moveCost: 0.5, passable: true, color: '#8b7355' },
    SAND: { id: 'sand', name: '砂地', moveCost: 1.2, passable: true, color: '#c9b896' },
    SWAMP: { id: 'swamp', name: '沼', moveCost: 2, passable: true, color: '#5a6b4a' },
    CLIFF: { id: 'cliff', name: '崖', moveCost: Infinity, passable: false, color: '#4a4a4a' }
};

// Compression Helpers
const TERRAIN_CODE_MAP = {
    'grass': 0, 'plain': 0,
    'forest': 1,
    'water': 2,
    'mountain': 3,
    'road': 4,
    'cliff': 5,
    'swamp': 6,
    'sand': 7
};
const CODE_TO_TERRAIN = ['grass', 'forest', 'water', 'mountain', 'road', 'cliff', 'swamp', 'sand'];

/**
 * Generic RLE Compression
 * @param {Array} arr - Flat array of numbers or strings
 * @returns {string} Compressed string "val:count,val:count"
 */
export function compressRLE(arr) {
    if (!arr || !arr.length) return '';
    let result = '';
    let count = 1;
    let prev = arr[0];

    // Map string types to codes if necessary (Legacy terrain support)
    // For general usage, assume numbers or keep as is if no map found
    const isString = typeof prev === 'string';
    let prevVal = isString ? (TERRAIN_CODE_MAP[prev] !== undefined ? TERRAIN_CODE_MAP[prev] : prev) : prev;

    for (let i = 1; i < arr.length; i++) {
        let val = arr[i];
        if (isString) val = TERRAIN_CODE_MAP[val] !== undefined ? TERRAIN_CODE_MAP[val] : val;

        if (val === prevVal) {
            count++;
        } else {
            result += `${prevVal}:${count},`;
            prevVal = val;
            count = 1;
        }
    }
    result += `${prevVal}:${count}`;
    return result;
}

/**
 * Generic RLE Decompression
 * @param {string} str - Compressed string
 * @param {boolean} isString - If true, map codes back to terrain strings
 * @returns {Array} Flat array
 */
export function decompressRLE(str, isString = false) {
    if (!str) return [];
    const flat = [];
    const parts = str.split(',');
    for (const part of parts) {
        const [val, count] = part.split(':').map(Number);
        // If isString is true and val is a number index, decode it.
        // If val is NOT a number (custom string RLE), keep it? 
        // Current logic assumes val is number code for terrain.
        const decodedVal = isString ? (CODE_TO_TERRAIN[val] || 'grass') : val;
        for (let i = 0; i < count; i++) {
            flat.push(decodedVal);
        }
    }
    return flat;
}

// Helpers for Terrain (Wrappers)
function compressArray(arr) {
    if (!arr) return '';
    return compressRLE(arr.flat());
}

function decompressArray(str, width, height, isString) {
    const flat = decompressRLE(str, isString);
    const result = [];
    for (let y = 0; y < height; y++) {
        result.push(flat.slice(y * width, (y + 1) * width));
    }
    return result;
}

// Helper for 3D Arrays (Building Blocks)
export function compressBlocks(blocks) {
    if (!blocks) return '';
    // Flatten 3D [z][y][x] -> 1D
    const flat = blocks.flat(Infinity); // Flatten deep
    return compressRLE(flat);
}

export function decompressBlocks(str, size) {
    if (!str || !size) return [];
    const flat = decompressRLE(str, false); // Numbers (block IDs)

    // Reconstruct 3D [z][y][x]
    const blocks = [];
    for (let z = 0; z < size.z; z++) {
        blocks[z] = [];
        for (let y = 0; y < size.y; y++) {
            const row = [];
            const startIdx = (z * size.y * size.x) + (y * size.x);
            for (let x = 0; x < size.x; x++) {
                row.push(flat[startIdx + x]);
            }
            blocks[z].push(row);
        }
    }
    return blocks;
}

// ============================================
// 建造物タイプ定義
// ============================================

export const BUILDING_TYPES = {
    CASTLE: { id: 'castle', name: '城', size: { w: 3, h: 3 }, capturable: true },
    FORT: { id: 'fort', name: '砦', size: { w: 2, h: 2 }, capturable: true },
    TOWER: { id: 'tower', name: '塔', size: { w: 1, h: 1 }, capturable: false },
    BARRACKS: { id: 'barracks', name: '兵舎', size: { w: 2, h: 1 }, capturable: true },
    BRIDGE: { id: 'bridge', name: '橋', size: { w: 1, h: 3 }, capturable: false },
    GATE: { id: 'gate', name: '門', size: { w: 1, h: 1 }, capturable: false },
    WALL: { id: 'wall', name: '壁', size: { w: 1, h: 1 }, capturable: false },
    HOUSE: { id: 'house', name: '民家', size: { w: 1, h: 1 }, capturable: false },
    SHRINE: { id: 'shrine', name: '祠', size: { w: 1, h: 1 }, capturable: false }
};

// ============================================
// マップデータリポジトリ
// ============================================

export class MapDataRepository {
    constructor() {
        this.maps = new Map();
        // 初期化時にRegistryからロード
        this.loadFromRegistry();
    }

    /**
     * ランダムなIDを生成
     */
    generateId() {
        return 'map_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }

    /**
     * MapRegistryから定義済みマップを読み込む
     */
    loadFromRegistry() {
        try {
            // 定義済みマップを読み込む
            const maps = MAP_REGISTRY;
            let loadedCount = 0;
            maps.forEach(mapData => {
                try {
                    // ディープコピーを作成して参照汚染を防ぐ
                    const mapClone = JSON.parse(JSON.stringify(mapData));

                    // 日付文字列をDateオブジェクトに変換
                    if (typeof mapClone.createdAt === 'string') mapClone.createdAt = new Date(mapClone.createdAt);
                    if (typeof mapClone.updatedAt === 'string') mapClone.updatedAt = new Date(mapClone.updatedAt);

                    // メモリ上に既にロードされている（ユーザーが編集中の）場合は上書きしない
                    // ただし、初回ロード時はセットする
                    if (!this.maps.has(mapClone.id)) {
                        this.maps.set(mapClone.id, mapClone);
                        loadedCount++;
                    }
                } catch (e) {
                    console.error(`[MapRepository] Failed to load map ${mapData?.id || 'unknown'}:`, e);
                }
            });
            console.log(`[MapRepository] Loaded ${loadedCount} maps from registry (Total: ${this.maps.size}).`);
            return true;
        } catch (e) {
            console.error('[MapRepository] Failed to load from registry:', e);
            return false;
        }
    }

    /**
     * 新規マップを作成
     */
    create(options = {}) {
        const id = options.id || this.generateId();
        const now = new Date();

        const mapData = {
            id: id,
            name: options.name || '新規マップ',
            description: options.description || '',
            version: 1,
            createdAt: now,
            updatedAt: now,
            metadata: {
                author: options.author || 'Unknown',
                difficulty: options.difficulty || 1,
                recommendedLevel: options.recommendedLevel || 1,
                tags: options.tags || []
            },
            terrain: this.createEmptyTerrain(
                options.width || 30,
                options.height || 30
            ),
            buildings: [],
            zones: {
                playerDeployment: { x: 0, y: 0, width: 10, height: 10 },
                enemyDeployment: { x: 20, y: 20, width: 10, height: 10 },
                objectives: []
            },
            playerDeploymentZones: [],
            unitDefinitions: [],
            customBuildingDefinitions: [],
            units: []
        };

        this.maps.set(id, mapData);
        return mapData;
    }

    /**
     * 空の地形データを生成
     */
    createEmptyTerrain(width, height) {
        const heightMap = [];
        const terrainType = [];

        for (let y = 0; y < height; y++) {
            const heightRow = [];
            const typeRow = [];
            for (let x = 0; x < width; x++) {
                heightRow.push(0); // 高さ0
                typeRow.push('grass'); // 草原
            }
            heightMap.push(heightRow);
            terrainType.push(typeRow);
        }

        return { width, height, heightMap, terrainType };
    }

    /**
     * マップを取得
     */
    get(id) {
        return this.maps.get(id);
    }

    /**
     * マップを更新
     */
    update(id, updates) {
        const map = this.maps.get(id);
        if (!map) return null;

        Object.assign(map, updates, { updatedAt: new Date() });
        map.version++;

        // デフォルト値を確保（既存データとの互換性）
        if (!map.zones) {
            map.zones = {
                playerDeployment: { x: 0, y: 0, width: 10, height: 10 },
                enemyDeployment: { x: 20, y: 20, width: 10, height: 10 },
                objectives: []
            };
        }
        if (!map.playerDeploymentZones) {
            map.playerDeploymentZones = [];
        }
        if (!map.buildings) {
            map.buildings = [];
        }
        if (!map.unitDefinitions) {
            map.unitDefinitions = [];
        }
        if (!map.customBuildingDefinitions) {
            map.customBuildingDefinitions = [];
        }
        if (!map.units) {
            map.units = [];
        }

        return map;
    }

    /**
     * マップを削除 (メモリ上からのみ)
     */
    delete(id) {
        return this.maps.delete(id);
    }

    /**
     * 全マップのリストを取得
     */
    list() {
        return Array.from(this.maps.values()).map(m => ({
            id: m.id,
            name: m.name,
            description: m.description,
            metadata: m.metadata,
            terrain: m.terrain,
            updatedAt: m.updatedAt
        }));
    }

    /**
     * 地形を設定
     */
    setTerrain(mapId, x, y, terrainType, height = null) {
        const map = this.maps.get(mapId);
        if (!map) return false;

        if (x >= 0 && x < map.terrain.width && y >= 0 && y < map.terrain.height) {
            map.terrain.terrainType[y][x] = terrainType;
            if (height !== null) {
                map.terrain.heightMap[y][x] = height;
            }
            map.updatedAt = new Date();
            return true;
        }
        return false;
    }

    /**
     * 建造物を追加
     */
    addBuilding(mapId, building) {
        const map = this.maps.get(mapId);
        if (!map) return null;

        const newBuilding = {
            id: building.id || `bldg_${Date.now()}`,
            type: building.type,
            x: building.x,
            y: building.y,
            rotation: building.rotation || 0,
            properties: building.properties || {}
        };

        map.buildings.push(newBuilding);
        map.updatedAt = new Date();
        return newBuilding;
    }

    /**
     * 建造物を削除
     */
    removeBuilding(mapId, buildingId) {
        const map = this.maps.get(mapId);
        if (!map) return false;

        const index = map.buildings.findIndex(b => b.id === buildingId);
        if (index >= 0) {
            map.buildings.splice(index, 1);
            map.updatedAt = new Date();
            return true;
        }
        return false;
    }

    /**
     * 配置エリアを設定
     */
    setDeploymentZone(mapId, zoneType, zone) {
        const map = this.maps.get(mapId);
        if (!map) return false;

        if (zoneType === 'player') {
            map.zones.playerDeployment = zone;
        } else if (zoneType === 'enemy') {
            map.zones.enemyDeployment = zone;
        }
        map.updatedAt = new Date();
        return true;
    }

    /**
     * JSONとしてエクスポート
     */
    exportToJson(mapId) {
        const map = this.maps.get(mapId);
        if (!map) return null;

        return JSON.stringify(map, null, 2);
    }

    /**
     * JSONからインポート (エディタなどで使用)
     * インポートしたデータはメモリ上に保持される
     */
    importFromJson(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (!data.id) {
                data.id = this.generateId();
            }
            data.createdAt = new Date(data.createdAt);
            data.updatedAt = new Date(); // インポート時を更新とする

            // デフォルト値を設定（createメソッドと同様）
            if (!data.zones) {
                data.zones = {
                    playerDeployment: { x: 0, y: 0, width: 10, height: 10 },
                    enemyDeployment: { x: 20, y: 20, width: 10, height: 10 },
                    objectives: []
                };
            }
            if (!data.playerDeploymentZones) {
                data.playerDeploymentZones = [];
            }
            if (!data.buildings) {
                data.buildings = [];
            }
            if (!data.unitDefinitions) {
                data.unitDefinitions = [];
            }
            if (!data.customBuildingDefinitions) {
                data.customBuildingDefinitions = [];
            }
            if (!data.units) {
                data.units = [];
            }

            this.maps.set(data.id, data);
            return data;
        } catch (e) {
            console.error('[MapDataRepository] Import failed:', e);
            return null;
        }
    }

    /**
     * LocalStorageに保存 (復活)
     */
    saveToStorage() {
        try {
            // メモリ上のマップを全て保存
            // MapはJSON化できないので配列に変換
            const mapsArray = Array.from(this.maps.values());
            const json = JSON.stringify(mapsArray);
            localStorage.setItem('fantasy_rts_maps', json);
            console.log(`[MapRepository] Saved ${mapsArray.length} maps to storage.`);

            // 各マップのzonesとplayerDeploymentZonesをログ出力
            mapsArray.forEach(m => {
                console.log(`[MapRepository] Saved map "${m.name}":`, {
                    id: m.id,
                    hasZones: !!m.zones,
                    zones: m.zones,
                    hasPlayerDeploymentZones: !!m.playerDeploymentZones,
                    playerDeploymentZonesCount: m.playerDeploymentZones?.length || 0,
                    hasBuildings: !!m.buildings,
                    buildingsCount: m.buildings?.length || 0,
                    hasTextureData: !!m.textureData,
                    hasUnits: !!m.units,
                    unitsCount: m.units?.length || 0,
                    hasUnitDefinitions: !!m.unitDefinitions,
                    unitDefinitionsCount: m.unitDefinitions?.length || 0
                });
            });

            return true;
        } catch (e) {
            console.error('[MapRepository] Save failed:', e);
            return false;
        }
    }

    /**
     * LocalStorageから読み込み (復活)
     */
    loadFromStorage() {
        try {
            // Registryからの読み込みを先に行う
            this.loadFromRegistry();

            const json = localStorage.getItem('fantasy_rts_maps');
            if (json) {
                try {
                    const mapsArray = JSON.parse(json);
                    let storageLoadedCount = 0;
                    mapsArray.forEach(data => {
                        try {
                            // 日付文字列復元
                            if (typeof data.createdAt === 'string') data.createdAt = new Date(data.createdAt);
                            if (typeof data.updatedAt === 'string') data.updatedAt = new Date(data.updatedAt);

                            // デフォルト値を設定（createメソッドと同様）
                            if (!data.zones) {
                                data.zones = {
                                    playerDeployment: { x: 0, y: 0, width: 10, height: 10 },
                                    enemyDeployment: { x: 20, y: 20, width: 10, height: 10 },
                                    objectives: []
                                };
                            }
                            if (!data.playerDeploymentZones) {
                                data.playerDeploymentZones = [];
                            }
                            if (!data.buildings) {
                                data.buildings = [];
                            }
                            if (!data.unitDefinitions) {
                                data.unitDefinitions = [];
                            }
                            if (!data.customBuildingDefinitions) {
                                data.customBuildingDefinitions = [];
                            }
                            if (!data.units) {
                                data.units = [];
                            }

                            // 重複時はStorage優先（ユーザー編集データのため）
                            this.maps.set(data.id, data);
                            storageLoadedCount++;
                        } catch (e) {
                            console.error(`[MapRepository] Failed to load storage map ${data?.id || 'unknown'}:`, e);
                        }
                    });
                    console.log(`[MapRepository] Loaded ${storageLoadedCount} maps from storage (Total: ${this.maps.size}).`);
                } catch (e) {
                    console.error('[MapRepository] Failed to parse storage JSON:', e);
                    // JSONパースに失敗しても、Registryからのマップは保持される
                }
            } else {
                console.log('[MapRepository] No maps in localStorage, using registry maps only.');
            }
            return true;
        } catch (e) {
            console.error('[MapRepository] Load failed:', e);
            // 何があってもRegistryからのマップは保持される
            return this.maps.size > 0;
        }
    }
}

export const mapRepository = new MapDataRepository();
