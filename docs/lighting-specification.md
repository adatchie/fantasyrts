# Fantasy RTS - Lighting Specification

## 光源設定（Three.js）

### 初期設定（安全寄りの値）

```javascript
// メインライト（左上・斜め上）
const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
keyLight.position.set(-1, 2, 1); // 左・上・手前
scene.add(keyLight);

// フィルライト（右下）
const fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
fillLight.position.set(1, -1, -1);
scene.add(fillLight);

// アンビエント（最低限）
const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
scene.add(ambientLight);
```

### パラメータ説明

| ライト | 色 | 強度 | 位置 | 役割 |
|--------|---|------|------|------|
| keyLight | 白 | 1.0 | (-1, 2, 1) | 主光源、左上から |
| fillLight | 白 | 0.35 | (1, -1, -1) | 補助光源、右下から |
| ambientLight | 白 | 0.25 | - | 環境光、底上げ |

### 影の設定（必要に応じて）

```javascript
// メインライトに影を有効化
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 500;
```

---

## 視点との関係

### カメラ視点（クォータービュー）

```
      +Y (上)
       ↑
       │  keyLight (-1, 2, 1)
       │ ／
       │ ／
       │ ／──────────────
       │ ／              │
       │ ／              │
       │ ／──────────────│
       │       +X
       │      ／
       │     ／
       └─────／──────→ +Z (奥)
         camera
```

- カメラは斜め上から見下ろしている
- keyLightは左上から照らす（影が右下へ落ちる）
- これにより地形の高低差が強調される

---

## 実装箇所

### 現在のコード
`scripts/rendering3d.js` または `scripts/terrain-manager.js`

### 既存のシェーダー設定
`terrain-manager.js` の `createTerrain()` 内で、既にカスタムシェーダーを使用しているため、そこに統合

---

## 今後の拡張オプション

### 時間帯プリセット

```javascript
const LIGHTING_PRESETS = {
  DAY: {
    keyLight: { intensity: 1.0, color: 0xffffff },
    fillLight: { intensity: 0.35, color: 0xffffff },
    ambient: { intensity: 0.25, color: 0xffffff }
  },
  SUNSET: {
    keyLight: { intensity: 0.8, color: 0xffaa55 }, // オレンジ系
    fillLight: { intensity: 0.3, color: 0xff8844 },
    ambient: { intensity: 0.2, color: 0x554433 }
  },
  NIGHT: {
    keyLight: { intensity: 0.4, color: 0x8888ff }, // 青系（月光）
    fillLight: { intensity: 0.1, color: 0x4444aa },
    ambient: { intensity: 0.15, color: 0x222233 }
  }
};
```

---

*この仕様書は Version 1.0 です。実装中に随時更新してください。*
