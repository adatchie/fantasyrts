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
    HILL: { name: '丘陵', moveCost: 2, passable: true, color: 0xa0826d },
    MTN: { name: '山岳', moveCost: Infinity, passable: false, color: 0x808080 },
    WATER: { name: '水域', moveCost: Infinity, passable: false, color: 0x4169e1 },
    RIVER: { name: '川', moveCost: 3, passable: true, color: 0x6495ed },
    ROAD: { name: '道', moveCost: 0.5, passable: true, color: 0xdeb887 },
    BRIDGE: { name: '橋', moveCost: 1, passable: true, color: 0x8b4513 },
    FOREST: { name: '森', moveCost: 2, passable: true, color: 0x228b22 }
};

/**
 * マップシステムクラス
 */
export class MapSystem {
    constructor() {
        this.tiles = [];
        this.buildingSystem = null; // 建物システムへの参照
        this.generateSquareMap();
    }

    /**
     * 建物システムを設定
     * @param {Object} buildingSystem - BuildingSystemインスタンス
     */
    setBuildingSystem(buildingSystem) {
        this.buildingSystem = buildingSystem;
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
     * 指定座標の高さを取得
     */
    getHeight(x, y) {
        const tile = this.getTile(x, y);
        return tile ? tile.z : 0;
    }

    /**
     * 指定座標の実効高さを取得（地形高さ + 建物高さ）
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @returns {number} 実効高さ
     */
    getEffectiveHeight(x, y) {
        const terrainHeight = this.getHeight(x, y);
        let buildingHeight = 0;

        if (this.buildingSystem && this.buildingSystem.getBuildingHeightAtGrid) {
            buildingHeight = this.buildingSystem.getBuildingHeightAtGrid(x, y);
        }

        return terrainHeight + buildingHeight;
    }

    /**
     * 座標が有効範囲内かチェック
     */
    isValidCoord(x, y) {
        return x >= 0 && x < MAP_W && y >= 0 && y < MAP_H;
    }

    /**
     * 移動コストを取得
     * @param {Object} p1 - 現在の座標 {x, y}
     * @param {Object} p2 - 次の座標 {x, y}
     * @param {boolean} canFly - 飛行可能か
     * @returns {number} コスト
     */
    getMoveCost(p1, p2, canFly = false) {
        if (canFly) return 1;

        // 距離チェック（隣接している前提だが一応）
        const dx = Math.abs(p1.x - p2.x);
        const dy = Math.abs(p1.y - p2.y);
        if (dx > 1 || dy > 1) return Infinity; // ワープ不可

        const tile = this.getTile(p2.x, p2.y);
        if (!tile) return Infinity;

        const typeData = TERRAIN_TYPES[tile.type];
        let cost = typeData ? typeData.moveCost : 1;

        // 標高差によるコスト加算
        const currentTile = this.getTile(p1.x, p1.y);
        if (currentTile) {
            const dz = tile.z - currentTile.z;
            if (dz > 0) {
                // 登り坂はコスト増（1段につき+1）
                cost += dz;
            }
            // 降り坂はコスト増なし（あるいは減らす？現状はそのまま）
        }

        return cost;
    }

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
     * 2点間の移動コストを計算
     * @param {Object} from - {x, y}
     * @param {Object} to - {x, y}
     * @param {boolean} canFly - 飛行ユニットかどうか
     */
    getMoveCost(from, to, canFly = false) {
        const fromTile = this.getTile(from.x, from.y);
        const toTile = this.getTile(to.x, to.y);

        if (!fromTile || !toTile) return Infinity;

        // 通行可能かチェック
        if (!this.isPassable(to.x, to.y, canFly)) {
            return Infinity;
        }

        const terrain = TERRAIN_TYPES[toTile.type];
        let cost = terrain ? terrain.moveCost : 1;

        // 高低差コスト（飛行ユニットは無視）
        if (!canFly) {
            // 実効高さ（地形高さ + 建物高さ）を使用
            const fromHeight = this.getEffectiveHeight(from.x, from.y);
            const toHeight = this.getEffectiveHeight(to.x, to.y);
            const heightDiff = Math.abs(fromHeight - toHeight);

            // 2段以上の高低差は通行不可（建物の高さも考慮）
            if (heightDiff > 2) {
                return Infinity;
            }

            // 高低差によるコスト増加
            cost += heightDiff * 0.5;
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
