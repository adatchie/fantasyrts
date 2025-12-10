# 関ケ原テクスチャ仕様書

## 地面テクスチャ

### ファイル情報
- **保存先**: `c:\sekigahara4\assets\textures\ground_sekigahara.jpg`
- **ファイル名**: `ground_sekigahara.jpg`
- **フォーマット**: JPEG または PNG
- **推奨解像度**: **2048 x 2048 ピクセル**
  - より高品質が必要な場合: 4096 x 4096
  - パフォーマンス重視の場合: 1024 x 1024

### テクスチャの内容
関ケ原の戦場（1600年代の日本の戦場）をイメージした地面テクスチャ：

**推奨要素**:
1. **草地と土の混合**
   - 踏み荒らされた草地
   - 所々に露出した土
   - 秋（10月）の色合い（やや枯れた草）

2. **色調**
   - ベース: 暗めの緑～茶色
   - アクセント: 黄土色、灰褐色
   - 全体的に落ち着いた、戦場らしい雰囲気

3. **質感**
   - 不均一な地面
   - 草のテクスチャ
   - 土や砂利の質感
   - シームレス（タイル可能）

4. **避けるべき要素**
   - 現代的な要素（アスファルト、コンクリート）
   - 鮮やかすぎる色
   - 明確なパターン（自然に見えるように）

## AIへのプロンプト例

```
Create a seamless tileable ground texture for a historical Japanese battlefield (Sekigahara, 1600 AD).
The texture should be 2048x2048 pixels and include:
- Worn grassland with exposed dirt in places
- Autumn colors (October) - slightly dried grass
- Dark green to brown tones with ochre and gray-brown accents
- Natural, irregular surface with grass, dirt, and small pebbles
- Suitable for a real-time strategy game
- Top-down view perspective
- No modern elements
- Realistic but slightly stylized
- Somber, battlefield atmosphere
```

## 実装方法

テクスチャファイルを配置した後、`scripts/rendering3d.js`の`setupGround()`メソッドを以下のように修正：

```javascript
setupGround() {
    // ... 既存のサイズ計算コード ...
    
    // テクスチャをロード
    const textureLoader = new THREE.TextureLoader();
    const groundTexture = textureLoader.load('./assets/textures/ground_sekigahara.jpg');
    
    // テクスチャの繰り返し設定（グリッドサイズに応じて）
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(10, 10); // 10x10回繰り返し（調整可能）
    
    // 地面（グリッドより少し大きめ）
    const groundGeometry = new THREE.PlaneGeometry(gridWidth * 1.2, gridHeight * 1.2);
    const groundMaterial = new THREE.MeshStandardMaterial({
        map: groundTexture,  // テクスチャを適用
        roughness: 0.8,
        metalness: 0.2
    });
    
    // ... 残りのコード ...
}
```

## テクスチャ生成ツール推奨

1. **AI画像生成**:
   - Midjourney
   - Stable Diffusion
   - DALL-E 3

2. **テクスチャサイト**:
   - Polyhaven.com（無料、高品質）
   - Textures.com

3. **手動作成**:
   - Photoshop / GIMP
   - Substance Designer

## 注意事項
- テクスチャはシームレス（継ぎ目が目立たない）である必要があります
- ファイルサイズは1MB以下を推奨（ロード時間のため）
- JPEGで圧縮する場合、品質80-90%が適切
