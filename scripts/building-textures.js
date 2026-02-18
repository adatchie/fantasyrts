/**
 * FANTASY RTS - Building Block Textures
 * Canvas を使用した簡易テクスチャ生成
 */

import * as THREE from 'three';
import { TextureGenerator } from './texture-generator.js'; // Import TextureGenerator
import { BLOCK_TYPES } from './building.js'; // Import BLOCK_TYPES if needed (circular dependency risk, hardcode instead)

// テクスチャキャッシュ
const textureCache = {};

/**
 * テクスチャ生成クラス
 */
export class BuildingTextureGenerator {
    constructor() {
        this.textureSize = 128;
    }

    /**
     * ブロックタイプIDからテクスチャを取得
     * @param {number} typeId - ブロックタイプID
     * @returns {THREE.Texture|null} テクスチャ
     */
    getTextureForBlockType(typeId) {
        // BLOCK_TYPES.STONE_WALL = 1
        if (typeId === 1) {
            return this.createStoneWallTexture();
        }
        // BLOCK_TYPES.WOOD_WALL = 3
        if (typeId === 3) {
            return this.createWoodWallTexture();
        }
        // BLOCK_TYPES.ROOF_TILE = 5
        if (typeId === 5) {
            return this.createRoofTileTexture();
        }
        // 他のタイプも必要に応じて追加
        // STONE_FLOOR = 2
        if (typeId === 2) {
            return this.createStoneFloorTexture();
        }
        // WOOD_FLOOR = 4
        if (typeId === 4) {
            return this.createWoodFloorTexture();
        }
        // WOOD_DOOR = 6
        if (typeId === 6) {
            return this.createDoorTexture();
        }
        
        return null;
    }

    /**
     * キャンバスを作成
     */
    createCanvas() {
        const canvas = document.createElement('canvas');
        canvas.width = this.textureSize;
        canvas.height = this.textureSize;
        return canvas;
    }

    /**
     * 石壁テクスチャ（AI生成テクスチャ画像を使用）
     */
    createStoneWallTexture() {
        if (textureCache['stoneWall']) return textureCache['stoneWall'];

        const loader = new THREE.TextureLoader();
        const texture = loader.load('assets/textures/stone_wall.png');
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipMapLinearFilter;

        textureCache['stoneWall'] = texture;
        return texture;
    }

    /**
     * 木壁テクスチャ（板材模様）
     */
    createWoodWallTexture() {
        if (textureCache['woodWall']) return textureCache['woodWall'];

        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');
        const s = this.textureSize;

        // ベース色
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(0, 0, s, s);

        // 板材境界
        ctx.strokeStyle = '#6B3510';
        ctx.lineWidth = 2;

        // 横板
        for (let y = 0; y < s; y += 12) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(s, y);
            ctx.stroke();
        }

        // 木目（縦線）
        ctx.strokeStyle = '#5D2E0C';
        ctx.lineWidth = 1;
        for (let x = 16; x < s; x += 32) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, s);
            ctx.stroke();
        }

        // 木の節（ランダムに配置）
        ctx.fillStyle = '#5D2E0C';
        for (let i = 0; i < 3; i++) {
            const k = Math.floor(Math.random() * s / 8);
            const l = Math.floor(Math.random() * 8 + 4);
            ctx.fillRect(k * 8 + 2, Math.random() * s, l, 2);
        }

        this.addNoise(ctx, s, 0.04);

        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        textureCache['woodWall'] = texture;
        return texture;
    }

    createStoneFloorTexture() {
        if (textureCache['stoneFloor']) return textureCache['stoneFloor'];

        // まず手続き型のテクスチャを作成（ロード失敗時のフォールバック用）
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');
        const s = this.textureSize;
        ctx.fillStyle = '#666666';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = '#555555';
        ctx.lineWidth = 1;
        const tileSize = 16;
        for (let y = 0; y < s; y += tileSize) {
            const rowOffset = (Math.floor(y / tileSize) % 2) * 8;
            for (let x = 0; x < s; x += tileSize) {
                const ox = (Math.floor(x / tileSize) % 2) * 8 + rowOffset;
                ctx.strokeRect(x + ox, y, tileSize - 2, tileSize - 2);
            }
        }
        this.addNoise(ctx, s, 0.03);
        const texture = new THREE.CanvasTexture(canvas);

        // AI生成の新しい石床テクスチャのロードを試みる
        const loader = new THREE.TextureLoader();
        loader.load('assets/textures/stone_floor_new.png', 
            (tex) => {
                // ロード成功時、テクスチャ画像を差し替える
                texture.image = tex.image;
                // リピート設定はマテリアル単位ではなく、UV座標側で制御するため 1,1 に戻す
                // (もしくは広い範囲でループさせる)
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(1, 1); 
                texture.needsUpdate = true;
                console.log('Successfully replaced with AI stone floor texture');
            },
            undefined,
            (err) => {
                console.warn('Using procedural fallback for stone floor');
            }
        );

        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipMapLinearFilter;

        textureCache['stoneFloor'] = texture;
        return texture;
    }

    /**
     * 木床テクスチャ（板床）
     */
    createWoodFloorTexture() {
        if (textureCache['woodFloor']) return textureCache['woodFloor'];

        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');
        const s = this.textureSize;

        // ベース色
        ctx.fillStyle = '#A0522D';
        ctx.fillRect(0, 0, s, s);

        // 板材
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 1;
        for (let y = 0; y < s; y += 8) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(s, y);
            ctx.stroke();
        }

        // 木目
        ctx.strokeStyle = '#6B3510';
        for (let x = 16; x < s; x += 32) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, s);
            ctx.stroke();
        }

        this.addNoise(ctx, s, 0.04);

        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        textureCache['woodFloor'] = texture;
        return texture;
    }

    /**
     * 屋根瓦テクスチャ
     */
    createRoofTileTexture() {
        if (textureCache['roofTile']) return textureCache['roofTile'];

        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');
        const s = this.textureSize;

        // ベース色
        ctx.fillStyle = '#B22222';
        ctx.fillRect(0, 0, s, s);

        // 瓦パターン（鱗状）
        ctx.fillStyle = '#941B1B';  // 少し暗い色
        const tileSize = 16;

        for (let y = 0; y < s; y += tileSize) {
            const rowOffset = (y / tileSize) % 2;
            for (let x = 0; x < s; x += tileSize) {
                const colOffset = (x / tileSize + rowOffset) % 2;
                if (colOffset < 1) {
                    ctx.fillRect(x, y + tileSize / 2, tileSize, tileSize / 2);
                }
            }
        }

        // 瓦の境界線
        ctx.strokeStyle = '#722222';
        ctx.lineWidth = 1;
        for (let y = 0; y < s; y += tileSize) {
            ctx.strokeRect(0, y, s, tileSize);
        }
        for (let x = 0; x < s; x += tileSize) {
            ctx.strokeRect(x, 0, tileSize, s);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        textureCache['roofTile'] = texture;
        return texture;
    }

    /**
     * ノ関テクスチャ
     */
    createDoorTexture() {
        if (textureCache['door']) return textureCache['door'];

        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');
        const s = this.textureSize;

        // ベース色
        ctx.fillStyle = '#654321';
        ctx.fillRect(0, 0, s, s);

        // 枠
        ctx.strokeStyle = '#4A3520';
        ctx.lineWidth = 4;
        ctx.strokeRect(8, 8, s - 16, s - 16);

        // 枠内部の枠
        ctx.strokeStyle = '#8B5A2B';
        ctx.lineWidth = 2;
        ctx.strokeRect(12, 12, s - 24, s - 24);

        // ドー
        ctx.fillStyle = '#5D4037';
        ctx.beginPath();
        ctx.arc(s / 2, s / 2, 6, 0, Math.PI * 2);
        ctx.fill();

        // 板材模様
        ctx.fillStyle = '#5D4037';
        for (let y = 20; y < s - 20; y += 8) {
            ctx.fillRect(20, y, s - 40, 3);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        textureCache['door'] = texture;
        return texture;
    }

    /**
     * 窓テクスチャ
     */
    createWindowTexture() {
        if (textureCache['window']) return textureCache['window'];

        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');
        const s = this.textureSize;

        // 枠
        ctx.fillStyle = '#4A3828';
        ctx.fillRect(0, 0, s, s);

        // ガラス（水色）
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(8, 8, s - 16, s - 16);

        // 枠の内側
        ctx.strokeStyle = '#6B5333';
        ctx.lineWidth = 3;
        ctx.strokeRect(8, 8, s - 16, s - 16);

        // 窓枠の十字
        ctx.strokeStyle = '#4A3828';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s / 2, 8);
        ctx.lineTo(s / 2, s - 8);
        ctx.moveTo(8, s / 2);
        ctx.lineTo(s - 8, s / 2);
        ctx.stroke();

        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        textureCache['window'] = texture;
        return texture;
    }

    /**
     * ノスライズを追加（自然な質感）
     */
    addNoise(ctx, size, strength) {
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 255 * strength;
            data[i] = Math.max(0, Math.min(255, data[i] + noise));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
        }

        ctx.putImageData(imageData, 0, 0);
    }

    /**
     * ブロックタイプに対応するテクスチャを取得
     */
    getTextureForBlockType(blockType) {
        switch (blockType) {
            case 1: return this.createStoneWallTexture();      // STONE_WALL
            case 2: return this.createStoneFloorTexture();     // STONE_FLOOR
            case 3: return this.createWoodWallTexture();        // WOOD_WALL
            case 4: return this.createWoodFloorTexture();       // WOOD_FLOOR
            case 5: return this.createRoofTileTexture();        // ROOF_TILE
            case 6: return this.createDoorTexture();           // WOOD_DOOR
            case 7: return this.createWindowTexture();          // WINDOW
            default: return null;
        }
    }

    /**
     * 全テクスチャをクリア
     */
    clearCache() {
        for (const key in textureCache) {
            if (textureCache[key]) {
                textureCache[key].dispose();
                delete textureCache[key];
            }
        }
    }
}

// グローバルインスタンス
export const textureGenerator = new BuildingTextureGenerator();
