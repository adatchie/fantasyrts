# Three.js 3D移行実装ガイド

## 概要
現在の2D Canvas描画システムをThree.jsベースの3D描画に移行する。
ゲームロジックは維持し、描画部分のみを段階的に置き換える。

## 完了済み
✅ `scripts/rendering3d.js` - 3Dレンダリングエンジンを作成
  - Three.jsシーン、カメラ、レンダラーのセットアップ
  - RTS視点（斜め45度上空）のカメラ配置
  - 環境光と平行光源の設置
  - ヘックスグリッドの3D描画
  - OrbitControlsによる カメラ操作

## 次のステップ

### Step 1: HTMLにThree.jsを追加
`sekigahara.html`の`<head>`セクション、`<title>`の直後に以下を追加：

```html
<!-- Three.js Library -->
<script type="importmap">
{
    "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
        "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
    }
}
</script>
```

### Step 2: main.jsで3Dレンダラーに切り替え

**変更箇所1**: import文を修正（9行目）
```javascript
// 変更前
import { RenderingEngine, generatePortrait } from './rendering.js';

// 変更後
import { RenderingEngine3D } from './rendering3d.js';
import { generatePortrait } from './rendering.js';
```

**変更箇所2**: init()メソッドを修正（42-46行目）
```javascript
init() {
    this.canvas = document.getElementById('gameCanvas');
    // 2Dコンテキストは不要になる
    // this.ctx = this.canvas.getContext('2d');
    
    // 3Dレンダラーに切り替え
    this.renderingEngine = new RenderingEngine3D(this.canvas);
    this.combatSystem = new CombatSystem(this.audioEngine);
```

**変更箇所3**: resize()メソッドを修正（58-61行目）
```javascript
resize() {
    // 3Dレンダラーのリサイズメソッドを呼ぶ
    if (this.renderingEngine) {
        this.renderingEngine.resize();
    }
}
```

**変更箇所4**: loop()メソッドを大幅簡略化（172-227行目）
```javascript
loop() {
    // 3Dレンダラーが自動的にアニメーションループを持っているので
    // ここでは描画を呼ばなくてよい
    // UIの更新のみ行う
    
    requestAnimationFrame(() => this.loop());
}
```

### Step 3: 動作確認
1. ローカルサーバーを起動（`python -m http.server 8000`）
2. ブラウザで`localhost:8000/sekigahara.html`を開く
3. 暗めの緑の地面とヘックスグリッドが表示されることを確認
4. マウスドラッグでカメラを回転できることを確認
5. マウススク ロールでズームできることを確認

### Step 4: ユニットの3D表示（次のフェーズ）
- ユニットを3Dオブジェクト（円柱や箱）として表示
- 選択状態の表示
- 移動アニメーション

## 注意事項
- **段階的に実装**: 一度に全てを変更せず、動作確認しながら進める
- **バックアップ**: 各ステップ後にGitコミット
- **2Dコードは残す**: rendering.jsは当面残し、必要に応じて参照

## トラブルシューティング

### エラー: "Failed to resolve module specifier 'three'"
→ HTMLにimportmapが正しく追加されているか確認

### 画面が真っ黒
→ ブラウザのコンソールでエラーを確認
→ Three.jsのCDNリンクが正しいか確認

### グリッドが表示されない
→ カメラの位置が正しいか確認（rendering3d.js 21行目）
→ ライトが設定されているか確認

## 実装の完了条件
1. ヘックスグリッドが3D空間に表示される
2. カメラ操作（回転・ズーム）が動作する
3. 既存のUIシステム（ユニットリスト、ボタン等）が正常に動作する

---
作成日: 2025-12-09
ブランチ: graphics-implementation
