/**
 * Fantasy RTS - Map Data Repository
 * フィールド（地形）と建造物配置データを複数保存・管理
 */

import { TUTORIAL_PLAIN_DATA } from './data/tutorial_plain_data.js';

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
    FOREST: { id: 'forest', name: '森', moveCost: 2, passable: true, color: '#2d5a27' },
    WATER: { id: 'water', name: '水', moveCost: Infinity, passable: false, color: '#3b7cb8' },
    MOUNTAIN: { id: 'mountain', name: '山', moveCost: 3, passable: true, color: '#7a6b5a' },
    ROAD: { id: 'road', name: '道', moveCost: 0.5, passable: true, color: '#8b7355' },
    SAND: { id: 'sand', name: '砂地', moveCost: 1.5, passable: true, color: '#c9b896' },
    SWAMP: { id: 'swamp', name: '沼', moveCost: 3, passable: true, color: '#5a6b4a' },
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

function compressArray(arr) {
    if (!arr || !arr.length) return '';
    const flat = arr.flat();
    let result = '';
    let count = 1;
    let prev = flat[0];

    // Map string types to codes if necessary
    const isString = typeof prev === 'string';
    let prevVal = isString ? (TERRAIN_CODE_MAP[prev] || 0) : prev;

    for (let i = 1; i < flat.length; i++) {
        let val = flat[i];
        if (isString) val = TERRAIN_CODE_MAP[val] || 0;

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

function decompressArray(str, width, height, isString) {
    if (!str) return [];
    const flat = [];
    const parts = str.split(',');
    for (const part of parts) {
        const [val, count] = part.split(':').map(Number);
        const decodedVal = isString ? (CODE_TO_TERRAIN[val] || 'grass') : val;
        for (let i = 0; i < count; i++) {
            flat.push(decodedVal);
        }
    }

    const result = [];
    for (let y = 0; y < height; y++) {
        result.push(flat.slice(y * width, (y + 1) * width));
    }
    return result;
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
        this.storageKey = 'fantasy_rts_maps';
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
            }
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
        return map;
    }

    /**
     * マップを削除
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
     * JSONからインポート
     */
    importFromJson(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (!data.id) {
                data.id = this.generateId();
            }
            data.createdAt = new Date(data.createdAt);
            data.updatedAt = new Date();

            this.maps.set(data.id, data);
            return data;
        } catch (e) {
            console.error('[MapDataRepository] Import failed:', e);
            return null;
        }
    }

    /**
     * LocalStorageに保存
     */
    saveToStorage() {
        try {
            const data = {};
            this.maps.forEach((map, id) => {
                // Compress terrain data for storage
                const compressedMap = { ...map };

                // 画像データは圧縮済み（256x256 JPEG）なので保持する

                if (map.terrain) {
                    compressedMap.terrain = {
                        width: map.terrain.width,
                        height: map.terrain.height,
                        compressed: true,
                        heightMap: compressArray(map.terrain.heightMap),
                        terrainType: compressArray(map.terrain.terrainType)
                    };
                }
                data[id] = compressedMap;
            });

            const json = JSON.stringify(data);
            console.log(`[MapDataRepository] Saving to storage. Size: ${(json.length / 1024).toFixed(2)}KB`);

            localStorage.setItem(this.storageKey, json);
            console.log('[MapDataRepository] Saved to localStorage');
            return true;
        } catch (e) {
            console.error('[MapDataRepository] Save failed:', e);
            alert(`保存に失敗しました。容量制限の可能性があります。\n不要なマップを削除してください。\n(${e.name})`);
            return false;
        }
    }

    /**
     * LocalStorageから読み込み
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (!stored) return false;

            const data = JSON.parse(stored);
            this.maps.clear();

            Object.keys(data).forEach(id => {
                const map = data[id];

                // Decompress if needed
                if (map.terrain && map.terrain.compressed) {
                    map.terrain.heightMap = decompressArray(map.terrain.heightMap, map.terrain.width, map.terrain.height, false);
                    map.terrain.terrainType = decompressArray(map.terrain.terrainType, map.terrain.width, map.terrain.height, true);
                    delete map.terrain.compressed;
                }

                if (map.createdAt) map.createdAt = new Date(map.createdAt);
                if (map.updatedAt) map.updatedAt = new Date(map.updatedAt);
                this.maps.set(id, map);
            });

            console.log(`[MapDataRepository] Loaded ${this.maps.size} maps from localStorage`);
            return true;
        } catch (e) {
            console.error('[MapDataRepository] Load failed:', e);
            return false;
        }
    }

    /**
     * ユニークIDを生成
     */
    generateId() {
        return `map_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * マップをコピー
     */
    duplicate(mapId, newName = null) {
        const original = this.maps.get(mapId);
        if (!original) return null;

        const copy = JSON.parse(JSON.stringify(original));
        copy.id = this.generateId();
        copy.name = newName || `${original.name} (コピー)`;
        copy.createdAt = new Date();
        copy.updatedAt = new Date();
        copy.version = 1;

        this.maps.set(copy.id, copy);
        return copy;
    }

    /**
     * JSONとしてエクスポート
     */
    exportToJson(mapId) {
        const map = this.maps.get(mapId);
        if (!map) return null;
        return JSON.stringify(map, null, 2);
    }
}

// シングルトンインスタンス
export const mapRepository = new MapDataRepository();

// 【重要】起動時にLocalStorageからカスタムマップを自動ロード
mapRepository.loadFromStorage();

// ============================================
// サンプルマップデータ
// ============================================

/**
 * サンプルマップを生成
 */
export function createSampleMaps() {
    // チュートリアルマップ (カスタムデータをロード)
    try {
        mapRepository.importFromJson(JSON.stringify(TUTORIAL_PLAIN_DATA));
        console.log('[MapDataRepository] Tutorial data loaded');
    } catch (e) {
        console.error('[MapDataRepository] Failed to load tutorial data', e);
        // フォールバック: デフォルト作成 (もし必要なら)
    }

    // 山岳マップ
    const mountain = mapRepository.create({
        id: 'sample_mountain',
        name: '山岳決戦',
        description: '高低差のある山岳地帯',
        width: 40,
        height: 40,
        difficulty: 3
    });

    // 高低差を追加
    for (let y = 10; y < 30; y++) {
        for (let x = 15; x < 25; x++) {
            mapRepository.setTerrain('sample_mountain', x, y, 'mountain', 3);
        }
    }

    // 城砦マップ
    const castle = mapRepository.create({
        id: 'sample_castle',
        name: '城砦攻略戦',
        description: '敵の城を攻略せよ',
        width: 50,
        height: 50,
        difficulty: 4
    });

    // 城を配置
    mapRepository.addBuilding('sample_castle', {
        type: 'castle',
        x: 40,
        y: 10
    });

    // 壁を配置
    for (let i = 0; i < 10; i++) {
        mapRepository.addBuilding('sample_castle', {
            type: 'wall',
            x: 35,
            y: 5 + i
        });
    }

    console.log('[MapDataRepository] Sample maps created');
    return mapRepository.list();
}
