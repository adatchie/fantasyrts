/**
 * Fantasy RTS - Map System (Square Grid with Height)
 * スクエアグリッド + 高低差マップシステム
 */

import { MAP_W, MAP_H, MAX_HEIGHT, TILE_SIZE, TILE_HEIGHT } from './constants.js';

/**
 * 地形タイプ定義
 */
export const TERRAIN_TYPES = {
    PLAIN: { name: '平地', moveCost: 1, passable: true, color: 0x7cba3d },
    GRASS: { name: '草原', moveCost: 1, passable: true, color: 0x8fbc8f },
    HILL: { name: '丘陵', moveCost: 1.5, passable: true, color: 0xa0826d },
    MTN: { name: '山岳', moveCost: Infinity, passable: false, color: 0x808080 },
    WATER: { name: '水域', moveCost: Infinity, passable: false, color: 0x4169e1 },
    RIVER: { name: '川', moveCost: 2, passable: true, color: 0x6495ed },
    ROAD: { name: '道', moveCost: 0.5, passable: true, color: 0xdeb887 },
    BRIDGE: { name: '橋', moveCost: 1, passable: true, color: 0x8b4513 },
    FOREST: { name: '森', moveCost: 1.5, passable: true, color: 0x228b22 }
};

/**
 * マップシステムクラス
 */
export class MapSystem {
    constructor() {
        this.tiles = [];
        this.externalHeightProvider = null; // 外部からの高さ情報提供（建物など）
        this.buildingHeightCache = new Map(); // 建物高さキャッシュ
        this.generateSquareMap();
    }

    /**
     * 外部高さプロバイダを設定
     * @param {Function} provider - (x, y) => heightLevel
     */
    setExternalHeightProvider(provider) {
        this.externalHeightProvider = provider;
        this.buildingHeightCache.clear(); // プロバイダ変更時にキャッシュクリア
    }

    /**
     * スクエアグリッドマップを生成
     * パーリンノイズ風のシンプルな高低差生成
     */
    generateSquareMap() {
        this.tiles = [];

        for (let y = 0; y < MAP_H; y++) {
            const row = [];
            for (let x = 0; x < MAP_W; x++) {
                // 高さを計算（シンプルなノイズベース）
                const z = this.calculateHeight(x, y);

                // 地形タイプを高さから決定
                const type = this.determineTerrainType(x, y, z);

                row.push({
                    x,
                    y,
                    z,
                    type,
                    // 視界遮蔽など将来的な拡張用
                    blocksLOS: type === 'MTN' || type === 'FOREST'
                });
            }
            this.tiles.push(row);
        }

        return this.tiles;
    }

    /**
     * 座標から高さを計算（シンプルなノイズ）
     */
    calculateHeight(x, y) {
        // 複数の周波数のサイン波を合成してノイズを生成
        let h = 0;

        // 大きな地形（山脈など）
        h += Math.sin(x * 0.05) * Math.cos(y * 0.05) * 3;

        // 中程度の地形（丘陵）
        h += Math.sin(x * 0.1 + 1) * Math.sin(y * 0.1 + 2) * 1.5;

        // 細かい凹凸
        h += Math.sin(x * 0.2 + 3) * Math.cos(y * 0.2 + 4) * 0.5;

        // 端っこに山を配置（マップ境界を自然に）
        const edgeDist = Math.min(x, y, MAP_W - 1 - x, MAP_H - 1 - y);
        if (edgeDist < 5) {
            h += (5 - edgeDist) * 0.8;
        }

        // 0〜MAX_HEIGHTの範囲に正規化
        h = (h + 5) / 10 * MAX_HEIGHT;
        h = Math.max(0, Math.min(MAX_HEIGHT, Math.round(h)));

        return h;
    }

    /**
     * 座標と高さから地形タイプを決定
     */
    determineTerrainType(x, y, z) {
        // 高さベースの基本地形
        if (z >= MAX_HEIGHT - 1) {
            return 'MTN';
        } else if (z >= MAX_HEIGHT - 3) {
            return 'HILL';
        } else if (z <= 0) {
            // 低地に川や水域を配置
            if (Math.abs(x - MAP_W / 2) < 3 && y > 10 && y < MAP_H - 10) {
                return 'RIVER';
            }
            return 'PLAIN';
        } else if (z === 1) {
            // 低い丘に森を点在
            if ((x + y) % 7 === 0) {
                return 'FOREST';
            }
            return 'GRASS';
        }

        return 'PLAIN';
    }

    /**
     * 外部からマップデータを設定（エディタ作成マップ用）
     * @param {Object} mapData - マップデータオブジェクト
     */
    setMapData(mapData) {
        if (!mapData || !mapData.terrain) {
            console.warn('[MapSystem] Invalid mapData provided, generating default map');
            this.generateSquareMap();
            return;
        }

        const terrain = mapData.terrain;
        const width = terrain.width || 60;
        const height = terrain.height || 60;
        const heightMap = terrain.heightMap || [];
        const terrainType = terrain.terrainType || [];

        this.tiles = [];

        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                // 高さマップから取得（ない場合はデフォルト値）
                const z = (heightMap[y] && heightMap[y][x] !== undefined) ? heightMap[y][x] : 1;

                // 地形タイプ取得（ない場合は自動決定）
                let type = 'PLAIN';
                if (terrainType[y] && terrainType[y][x]) {
                    // エディタからの地形タイプ名をマップする
                    const editorType = terrainType[y][x];
                    type = this.mapTerrainTypeName(editorType, z);
                } else {
                    type = this.determineTerrainType(x, y, z);
                }

                row.push({
                    x,
                    y,
                    z,
                    type,
                    blocksLOS: type === 'MTN' || type === 'FOREST'
                });
            }
            this.tiles.push(row);
        }

        // マップデータ変更時にキャッシュをクリア
        this.buildingHeightCache.clear();
    }

    /**
     * エディタの地形タイプ名を内部タイプに変換
     */
    mapTerrainTypeName(editorType, height) {
        // nullチェック
        if (!editorType || typeof editorType !== 'string') {
            return 'PLAIN';
        }

        // エディタからの地形タイプ名マッピング
        const mapping = {
            'plain': 'PLAIN',
            'grass': 'GRASS',
            'forest': 'FOREST',
            'mountain': 'MTN',
            'hill': 'HILL',
            'water': 'WATER',
            'river': 'RIVER',
            'road': 'ROAD',
            'bridge': 'BRIDGE',
            'swamp': 'PLAIN', // 沼は平地として扱う（将来拡張可）
            'sand': 'PLAIN',  // 砂も平地として扱う
            'cliff': 'HILL'   // 崖は丘として扱う
        };

        const lowerType = editorType.toLowerCase();
        return mapping[lowerType] || 'PLAIN';
    }

    /**
     * マップ全体を取得
     */
    getMap() {
        return this.tiles;
    }

    /**
     * 指定座標のタイルを取得
     */
    getTile(x, y) {
        if (!this.isValidCoord(x, y)) return null;
        return this.tiles[y][x];
    }

    /**
     * 指定座標の高さを取得（建物の高さを含む）
     * 返り値は世界単位（world units）
     */
    getHeight(x, y) {
        const tile = this.getTile(x, y);
        // tile.z はグリッド単位なので世界単位に変換
        let height = (tile ? tile.z : 0) * TILE_HEIGHT;

        // 建物の高さも考慮（externalHeightProviderがある場合）
        // externalHeightProvider は世界単位で返す
        if (this.externalHeightProvider) {
            const cacheKey = `${x},${y}`;
            let buildingHeight = this.buildingHeightCache.get(cacheKey);

            if (buildingHeight === undefined) {
                buildingHeight = this.externalHeightProvider(x, y);
                this.buildingHeightCache.set(cacheKey, buildingHeight);
            }

            if (buildingHeight !== undefined && buildingHeight !== null && buildingHeight > 0) {
                height = Math.max(height, buildingHeight);
            }
        }
        return height;
    }

    /**
     * 座標が有効範囲内かチェック
     */
    isValidCoord(x, y) {
        // カスタムマップ対応: tiles配列の実サイズでチェック
        if (!this.tiles || this.tiles.length === 0) return false;
        const mapH = this.tiles.length;
        const mapW = this.tiles[0] ? this.tiles[0].length : 0;
        return x >= 0 && x < mapW && y >= 0 && y < mapH;
    }

    /**
     * 移動コストを取得
     * @param {Object} p1 - 現在の座標 {x, y}
     * @param {Object} p2 - 次の座標 {x, y}
     * @param {boolean} canFly - 飛行可能か
     * @returns {number} コスト
     */


    /**
     * 指定座標が通行可能かチェック
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {boolean} canFly - 飛行ユニットかどうか
     */
    isPassable(x, y, canFly = false) {
        const tile = this.getTile(x, y);
        if (!tile) return false;

        // 飛行ユニットは山も水も通過可能
        if (canFly) return true;

        const terrain = TERRAIN_TYPES[tile.type];
        return terrain ? terrain.passable : false;
    }

    /**
     * 指定座標から指定座標へ移動可能か判定（高低差含む）
     * @param {Object} from - {x, y}
     * @param {Object} to - {x, y}
     * @param {boolean} canFly 
     */
    canEnter(from, to, canFly = false) {
        if (!this.isValidCoord(to.x, to.y)) return false;

        // 地形通行不可ならNG
        if (!this.isPassable(to.x, to.y, canFly)) return false;

        if (canFly) return true;

        const fromZ = this.getHeight(from.x, from.y);
        const toZ = this.getHeight(to.x, to.y);

        // 崖判定：高さ差が段差2超（32 world units超）なら移動不可
        if (Math.abs(toZ - fromZ) > 2 * TILE_HEIGHT) return false;

        return true;
    }

    /**
     * 2点間の移動コストを計算
     * @param {Object} from - {x, y}
     * @param {Object} to - {x, y}
     * @param {boolean} canFly - 飛行ユニットかどうか
     */
    getMoveCost(from, to, canFly = false) {
        const fromTile = this.getTile(from.x, from.y);
        const toTile = this.getTile(to.x, to.y);

        if (!fromTile || !toTile) return Infinity;

        // キャッシュ付きgetHeightを使用（建物の高さを含む）
        const startZ = this.getHeight(from.x, from.y);
        const endZ = this.getHeight(to.x, to.y);
        const dz = endZ - startZ;

        // 異常な高低差（降りる場合で仕様を大幅に超える場合）のみログ
        if (!canFly && dz < -100) {
            console.error(`[MoveCost ABNORMAL] Large drop: (${from.x},${from.y})->(${to.x},${to.y}): startZ=${startZ}, endZ=${endZ}, dz=${dz}`);
        }

        // 通行可能かチェック
        if (!this.isPassable(to.x, to.y, canFly)) {
            return Infinity;
        }

        const terrain = TERRAIN_TYPES[toTile.type];
        let cost = terrain ? terrain.moveCost : 1;

        // 高低差コスト（飛行ユニットは無視）
        if (!canFly) {
            // 歩行ユニットは段差2まで移動可能（段差2超は移動不可）
            // TILE_HEIGHT = 16なので、2グリッド = 32 world units
            const MAX_WALKABLE_HEIGHT_DIFF = 2 * TILE_HEIGHT;
            if (Math.abs(dz) > MAX_WALKABLE_HEIGHT_DIFF) {
                return Infinity;
            }

            // 登り坂はコスト増（高さ差をグリッド単位に換算）
            const heightDiffInGrids = Math.abs(dz) / TILE_HEIGHT;
            if (dz > 0) {
                cost += heightDiffInGrids * 0.3;
            }
        }

        return cost;
    }

    /**
     * 隣接タイルを取得（4方向）
     * @param {number} x - 中心X座標
     * @param {number} y - 中心Y座標
     */
    getNeighbors(x, y) {
        const directions = [
            { dx: 1, dy: 0 },   // 右
            { dx: -1, dy: 0 },  // 左
            { dx: 0, dy: 1 },   // 下
            { dx: 0, dy: -1 }   // 上
        ];

        const neighbors = [];
        for (const dir of directions) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            if (this.isValidCoord(nx, ny)) {
                neighbors.push(this.tiles[ny][nx]);
            }
        }
        return neighbors;
    }

    /**
     * 8方向の隣接タイルを取得（斜め含む）
     */
    getNeighbors8(x, y) {
        const directions = [
            { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
            { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
            { dx: 1, dy: 1 }, { dx: -1, dy: -1 },
            { dx: 1, dy: -1 }, { dx: -1, dy: 1 }
        ];

        const neighbors = [];
        for (const dir of directions) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            if (this.isValidCoord(nx, ny)) {
                neighbors.push(this.tiles[ny][nx]);
            }
        }
        return neighbors;
    }

    /**
     * 旧API互換性のためのエイリアス（段階的移行用）
     * @deprecated 将来削除予定
     */
    updateTerrain(q, r, heightVal) {
        const x = q;
        const y = r;
        if (!this.isValidCoord(x, y)) return;

        const tile = this.tiles[y][x];

        // ハイトマップ値から高さを計算
        const z = Math.floor(heightVal / 255 * MAX_HEIGHT);
        tile.z = z;
        tile.type = this.determineTerrainType(x, y, z);
    }

    /**
     * 旧API互換性: generateMap エイリアス
     * @deprecated generateSquareMapを使用してください
     */
    generateMap() {
        return this.generateSquareMap();
    }
}
