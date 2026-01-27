# Fantasy RTS - Sprite Specification

## 1. スプライトシート基本仕様

### 1.1 スプライトサイズ（セルサイズ）

| サイズ区分 | グリッド占有 | セルサイズ（px） | 用途 |
|------------|--------------|------------------|------|
| 小（S）    | 1×1         | 64×64            | 一般ユニット |
| 中（M）    | 1×2（縦）   | 64×128           | 騎兵 |
| 大（L）    | 2×2         | 128×128          | ドラゴン、竜騎兵、砲兵 |

**決定理由**:
- 64pxは現代の2Dゲームにおけるキャラクタースプライトの標準サイズ
- 1グリッド＝32px（TILE_SIZE）に対し、キャラクターは2倍のサイズで視認性確保
- 解像度が高いため縮小表示も綺麗

### 1.2 スプライトシート構成

```
┌─────────────────────────────────────────────────┐
│ アニメーション種別 × 方向 × フレーム数          │
├─────────────────────────────────────────────────┤
│ 横方向: フレーム数（アニメーション）            │
│ 縦方向: 方向 × アニメーション種別               │
└─────────────────────────────────────────────────┘
```

---

## 2. アニメーションパターン

### 2.1 全ユニット共通

| アニメーション名 | フレーム数 | ループ | 説明 |
|-----------------|------------|--------|------|
| IDLE            | 4          | Yes    | 待機アニメーション |
| WALK            | 6          | Yes    | 移動アニメーション |
| ATTACK          | 6          | No     | 攻撃アニメーション |
| HIT             | 3          | No     | 被弾アニメーション |
| DEATH           | 8          | No     | 死亡アニメーション |

### 2.2 ユニット別特殊アニメーション

| ユニットタイプ | 追加アニメーション | フレーム数 | 説明 |
|---------------|-------------------|------------|------|
| ARCHER        | SHOOT             | 8          | 弓を射つアニメーション |
| GUNNER        | SHOOT             | 10         | 銃を発射するアニメーション |
| MAGE          | CAST              | 8          | 魔法を詠唱・発動するアニメーション |
| PRIEST        | HEAL              | 8          | 回復魔法を発動するアニメーション |
| DRAGON        | BREATH            | 10         | ブレス攻撃アニメーション |
| DRAGON_RIDER  | BREATH            | 10         | ブレス攻撃アニメーション |
| ARTILLERY     | FIRE              | 12         | 大砲を発射するアニメーション |

---

## 3. 方向定義

### 3.1 方向数と角度

ゲームはスクエアグリッドのクォータービュー（斜め上から見下ろす視点）のため、**4方向**を採用：

| 方向インデックス | 方向名 | 角度 | 説明 |
|-----------------|--------|------|------|
| 0               | FRONT  | 0°   | 手前（下） |
| 1               | RIGHT  | 90°  | 右 |
| 2               | BACK   | 180° | 奥（上） |
| 3               | LEFT   | 270° | 左 |

**4方向とする理由**:
- クォータービューでは斜め方向の見た目が類似しやすく、8方向のコストパフォーマンスが悪い
- スプライトシートのサイズを抑制

---

## 4. 各ユニットタイプのスプライト構成

### 4.1 小サイズユニット（Sサイズ / 64×64）

#### INFANTRY（歩兵）
```
特徴: 軽装鎧に剣
色: 青系（東軍）/ 赤系（西軍）
ポーズ: 剣を構えた姿勢
```

#### KNIGHT（騎士）
```
特徴: 重装鎧に盾
色: 青系（東軍）/ 赤系（西軍）
ポーズ: 盾を構えた防御姿勢
視覚的差異: 鎧が重厚、盾が大きい
```

#### ARCHER（弓兵）
```
特徴: 皮装備に弓
色: 青系（東軍）/ 赤系（西軍）
ポーズ: 弓を構えた姿勢
装備: 背中に矢筒
```

#### SPEAR（槍兵）
```
特徴: 軽装鎖に槍
色: 青系（東軍）/ 赤系（西軍）
ポーズ: 槍を前方に突き出した姿勢
装備: 槍は長く、2マス攻撃を表現
```

#### GUNNER（銃士）
```
特徴: 皮装備に長銃
色: 青系（東軍）/ 赤系（西軍）
ポーズ: 銃を構えた姿勢
装備: マスケット銃のような長銃
```

#### MAGE（魔術師）
```
特徴: ローブに魔導書
色: 紫・青（東軍）/ 紫・赤（西軍）
ポーズ: 魔導書を開いた姿勢
エフェクト: 手が微かに光る（IDLE時）
```

#### PRIEST（僧侶）
```
特徴: 僧衣に杖
色: 白・金（東軍）/ 白・銀（西軍）
ポーズ: 杖を上に持った姿勢
エフェクト: 微かなオーラ（IDLE時）
```

### 4.2 中サイズユニット（Mサイズ / 64×128）

#### CAVALRY（騎兵）
```
特徴: 騎乗ユニット（馬＋騎手）
色: 青系（東軍）/ 赤系（西軍）
ポーズ: 騎手が槍を持って馬に乗った姿勢
構成:
  - 下半分: 馬の姿
  - 上半分: 騎手
特殊: 移動アニメーションで馬が蹄を動かす
```

### 4.3 大サイズユニット（Lサイズ / 128×128）

#### DRAGON（ドラゴン）
```
特徴: 巨大な飛行ドラゴン
色: 青・緑（東軍）/ 赤・橙（西軍）
ポーズ: 翼を広げた構え
特殊:
  - IDLE: 翽が微かに揺れる、口から煙
  - BREATH: 口を開けてブレス
```

#### DRAGON_RIDER（竜騎兵）
```
特徴: ドラゴンに騎乗した騎士
色: 青・緑のドラゴン（東軍）/ 赤・橙のドラゴン（西軍）
ポーズ: ドラゴンの背に騎手が乗っている
構成:
  - 本体: ドラゴン
  - 上部: 騎手（小さく描画）
```

#### ARTILLERY（砲兵）
```
特徴: 大砲と操作員2名
色: 青系（東軍）/ 赤系（西軍）
ポーズ: 大砲とその周囲に操作員
構成:
  - 中央: 大砲
  - 周囲: 操作員2名（小さく）
特殊: FIREアニメーションで反動と煙
```

---

## 5. スプライトシート構成計算

### 5.1 小サイズユニット（例：INFANTRY）

```
共通アニメーションのみ:
  - 5種類 × 4方向 × 6フレーム（最大）= 120セル
  - 実際はアニメーションごとにフレーム数が異なる

推奨構成:
  横: 8フレーム（最大フレーム数 + 余白）
  縦: 20行（5種類 × 4方向）
  → 8 × 20 = 160セル
  → 64×64px セル → スプライトシートサイズ: 512×1280px
```

### 5.2 特殊アニメーション追加ユニット（例：ARCHER）

```
共通5種類 + SHOOT1種類 = 6種類
  - 6種類 × 4方向 × 8フレーム（SHOOTは8フレーム）

推奨構成:
  横: 8フレーム
  縦: 24行（6種類 × 4方向）
  → 8 × 24 = 192セル
  → 64×64px セル → スプライトシートサイズ: 512×1536px
```

### 5.3 中サイズユニット（CAVALRY）

```
共通アニメーションのみ:
  - 5種類 × 4方向 × 6フレーム

推奨構成:
  横: 8フレーム
  縦: 20行（5種類 × 4方向）
  → 64×128px セル → スプライトシートサイズ: 512×2560px
```

### 5.4 大サイズユニット（DRAGON）

```
共通5種類 + BREATH1種類 = 6種類
  - 6種類 × 4方向 × 10フレーム（BREATHは10フレーム）

推奨構成:
  横: 10フレーム
  縦: 24行（6種類 × 4方向）
  → 128×128px セル → スプライトシートサイズ: 1280×3072px
```

---

## 6. スプライトシートレイアウト（行定義）

### 6.1 小サイズ標準ユニット

| 行 | アニメーション | 方向 | フレーム数 |
|----|---------------|------|------------|
| 0-3   | IDLE    | FRONT,RIGHT,BACK,LEFT | 4 |
| 4-9   | WALK    | FRONT,RIGHT,BACK,LEFT | 6 |
| 10-15 | ATTACK  | FRONT,RIGHT,BACK,LEFT | 6 |
| 16-18 | HIT     | FRONT,RIGHT,BACK,LEFT | 3 |
| 19-26 | DEATH   | FRONT,RIGHT,BACK,LEFT | 8 |

### 6.2 弓兵・銃士・魔術師・僧侶（特殊アニメ追加）

| 行 | アニメーション | 方向 | フレーム数 |
|----|---------------|------|------------|
| 0-3   | IDLE    | FRONT,RIGHT,BACK,LEFT | 4 |
| 4-9   | WALK    | FRONT,RIGHT,BACK,LEFT | 6 |
| 10-15 | ATTACK  | FRONT,RIGHT,BACK,LEFT | 6 |
| 16-18 | HIT     | FRONT,RIGHT,BACK,LEFT | 3 |
| 19-26 | DEATH   | FRONT,RIGHT,BACK,LEFT | 8 |
| 27-34 | SHOOT/CAST/HEAL | FRONT,RIGHT,BACK,LEFT | 8 |

---

## 7. 陣営別カラーリング

### 7.1 東軍（EAST）

| パーツ | 基本色 | アクセント |
|--------|--------|-----------|
| 鎧     | 銀灰色 | 青の差し色 |
| 布     | 紺青色 | 金色の縁取り |
| 肌     | 明るい肌色 | - |
| 武器   | 金属色 | - |

### 7.2 西軍（WEST）

| パーツ | 基本色 | アクセント |
|--------|--------|-----------|
| 鎧     | 鉄黒色 | 赤の差し色 |
| 布     | 深紅色 | 銀色の縁取り |
| 肌     | 明るい肌色 | - |
| 武器   | 金属色 | - |

---

## 8. AI画像生成プロンプト

### 8.1 共通設定

**スタイル**: ピクセルアート、ゲームスプライト
**解像度**: 64×64px（小）、64×128px（中）、128×128px（大）
**視点**: クォータービュー（斜め上から見下ろし）
**背景**: 透明

### 8.2 小サイズユニット プロンプト

#### INFANTRY（歩兵）- 東軍

```
Pixel art game sprite, 64x64 pixels, side view slightly from above.
A foot soldier in light blue leather armor holding a sword.
Front-facing idle pose, standing ready.
Clean pixel art style, game sprite sheet frame.
Transparent background.
Isometric quarter view.
```

#### INFANTRY（歩兵）- 西軍

```
Pixel art game sprite, 64x64 pixels, side view slightly from above.
A foot soldier in red leather armor holding a sword.
Front-facing idle pose, standing ready.
Clean pixel art style, game sprite sheet frame.
Transparent background.
Isometric quarter view.
```

#### KNIGHT（騎士）- 東軍

```
Pixel art game sprite, 64x64 pixels.
A heavily armored knight with a large shield.
Armor is silver-gray with blue accents.
Holding sword and shield in defensive stance.
Clean pixel art, game sprite sheet.
Transparent background.
Isometric quarter view.
```

#### ARCHER（弓兵）- 東軍

```
Pixel art game sprite, 64x64 pixels.
An archer in blue leather armor holding a bow.
Quiver on back.
Aiming pose, ready to shoot.
Clean pixel art, game sprite sheet.
Transparent background.
Isometric quarter view.
```

#### SPEAR（槍兵）- 東軍

```
Pixel art game sprite, 64x64 pixels.
A spearman in blue leather armor holding a long spear.
Spear pointing forward, attack stance.
Clean pixel art, game sprite sheet.
Transparent background.
Isometric quarter view.
```

#### GUNNER（銃士）- 東軍

```
Pixel art game sprite, 64x64 pixels.
A musketeer in blue leather armor holding a long musket gun.
Aiming pose, ready to fire.
Clean pixel art, game sprite sheet.
Transparent background.
Isometric quarter view.
```

#### MAGE（魔術師）- 東軍

```
Pixel art game sprite, 64x64 pixels.
A wizard in purple-blue robes holding a magic book.
Hands slightly glowing with magical energy.
Casting pose.
Clean pixel art, game sprite sheet.
Transparent background.
Isometric quarter view.
```

#### PRIEST（僧侶）- 東軍

```
Pixel art game sprite, 64x64 pixels.
A priest in white and gold robes holding a staff upward.
Faint divine aura around.
Healing pose.
Clean pixel art, game sprite sheet.
Transparent background.
Isometric quarter view.
```

### 8.3 中サイズユニット プロンプト

#### CAVALRY（騎兵）- 東軍

```
Pixel art game sprite, 64x128 pixels.
A knight riding a horse.
Knight in blue armor holding a spear.
Horse in charging stance.
Clean pixel art, game sprite sheet.
Transparent background.
Isometric quarter view.
```

### 8.4 大サイズユニット プロンプト

#### DRAGON（ドラゴン）- 東軍

```
Pixel art game sprite, 128x128 pixels.
A large dragon with wings spread.
Blue-green scales, mouth slightly smoking.
Powerful standing pose.
Clean pixel art, game sprite sheet.
Transparent background.
Isometric quarter view.
```

#### ARTILLERY（砲兵）- 東軍

```
Pixel art game sprite, 128x128 pixels.
A large cannon with two operators in blue uniforms.
Cannon pointing sideways.
Clean pixel art, game sprite sheet.
Transparent background.
Isometric quarter view.
```

---

## 9. アニメーションフレーム生成プロンプト

### 9.1 WALKアニメーション（6フレーム）

```
Pixel art game sprite, 64x64 pixels, 6-frame walk animation.
[ユニット説明]
Frame 1: Standing pose
Frame 2: Right foot forward
Frame 3: Weight on right foot
Frame 4: Left foot forward
Frame 5: Weight on left foot
Frame 6: Return to standing
Clean pixel art, game sprite sheet.
Transparent background.
Isometric quarter view.
```

### 9.2 ATTACKアニメーション（6フレーム）

```
Pixel art game sprite, 64x64 pixels, 6-frame attack animation.
[ユニット説明]
Frame 1-2: Wind up / Preparation
Frame 3-4: Attack execution
Frame 5-6: Recovery / Return to idle
Clean pixel art, game sprite sheet.
Transparent background.
Isometric quarter view.
```

### 9.3 DEATHアニメーション（8フレーム）

```
Pixel art game sprite, 64x64 pixels, 8-frame death animation.
[ユニット説明]
Frame 1-2: Hit reaction
Frame 3-5: Falling down
Frame 6-8: Fading away / lying on ground
Clean pixel art, game sprite sheet.
Transparent background.
Isometric quarter view.
```

---

## 10. 各方向のプロンプト修正

方向を変える場合は「[Direction]」の部分を変更：

```
Front view: "front-facing, facing viewer"
Right view: "facing right, profile view"
Back view: "facing away, showing back"
Left view: "facing left, profile view"
```

---

## 11. 陣営色変換

西軍に変換する場合は：
- `blue` → `red`
- `silver-gray with blue` → `dark iron with red`
- `purple-blue` → `purple-red`
- `white and gold` → `white and silver`

---

## 12. スプライトシート出力形式

各ユニットのスプライトシートは以下の形式で出力：

```
ファイル名: [unit_type]_[faction]_[size].png
例: infantry_east_S.png, cavalry_west_M.png, dragon_east_L.png

サイズ:
  S: 512×1280px（64×64セル、160セル）
  M: 512×2560px（64×128セル、160セル）
  L: 1280×3072px（128×128セル、192セル）
```

---

## 13. アニメーション速度設定（実装時の参考）

| アニメーション | フレームレート | ループ |
|---------------|----------------|--------|
| IDLE          | 4fps           | Yes    |
| WALK          | 8fps           | Yes    |
| ATTACK        | 12fps          | No     |
| HIT           | 15fps          | No     |
| DEATH         | 10fps          | No     |
| SHOOT/CAST    | 10fps          | No     |
| BREATH        | 8fps           | No     |

---

*この仕様書は Version 1.0 です。実装中に随時更新してください。*
