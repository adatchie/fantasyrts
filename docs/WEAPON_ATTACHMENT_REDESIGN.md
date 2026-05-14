# Fantasy RTS - Weapon Attachment Redesign

**Date**: 2026-04-21  
**Status**: Draft

---

## 1. Goal

武器アタッチを「ユニットごとに座標を手打ちする仕組み」から、「アンカー + 武器定義 + モーショントラック」に整理し、次を実現する。

- 武器種が増えても破綻しにくい
- ユニット種ごとの差異を吸収できる
- 近接 / 射撃 / 魔法で別の持ち方・振り方を定義できる
- 将来的な 3D / 2.5D 化にも流用できる

---

## 2. Current Problems

- 手元位置、武器ピボット、動作軌道の責務が混ざっている
- フレームごとの手修正が増えると保守しづらい
- 武器側の「どこを手に持たせるか」が武器定義として独立していない

---

## 3. New Concept Model

### 3.1 Anchor
ユニット側が持つ「装着基準点」。

例:
- `right_hand`
- `left_hand`
- `weapon_tip`
- `muzzle`
- `staff_head`

### 3.2 Weapon Definition
武器画像 / 武器メッシュ側の定義。

持つ情報:
- sprite / mesh
- pivot
- grip
- scale
- defaultLayer

### 3.3 Motion Track
アクション中に、アンカーに対して武器をどう動かすか。

持つ情報:
- relative position
- relative rotation
- timing

---

## 4. Data Separation

### 4.1 Unit Visual Attachment Data
責務:
- 各ユニット / 各フレーム / 各向きにおけるアンカー位置を定義する

### 4.2 Weapon Static Data
責務:
- 武器ごとの grip / pivot / scale / asset を定義する

### 4.3 Action Motion Data
責務:
- 攻撃中・射撃中・詠唱中に武器がどう相対移動するかを定義する

---

## 5. JSON Structure

### 5.1 Example
```json
{
  "weapons": {
    "sword_basic": {
      "type": "sprite",
      "asset": "assets/sprites/sword.png",
      "pivot": { "x": 0.30, "y": 0.69 },
      "grip": { "x": 0.30, "y": 0.69 },
      "scale": 1.0,
      "defaultLayer": "front"
    },
    "bow_basic": {
      "type": "sprite",
      "asset": "assets/sprites/bow.png",
      "pivot": { "x": 0.50, "y": 0.85 },
      "grip": { "x": 0.48, "y": 0.82 },
      "scale": 1.0,
      "defaultLayer": "front"
    }
  },
  "unitAttachments": {
    "DEFAULT": {
      "anchors": {
        "17": {
          "right_hand": { "x": 0.689, "y": 0.573, "layer": "back" }
        },
        "19": {
          "right_hand": { "x": 0.782, "y": 0.747, "layer": "front" }
        }
      },
      "equip": {
        "weapon": "sword_basic",
        "anchor": "right_hand"
      }
    }
  },
  "motions": {
    "sword_slash_basic": {
      "anchor": "right_hand",
      "timeline": [
        { "t": 0.0, "pos": [0.00, 0.00, 0.00], "rot": [0, -50, 0] },
        { "t": 0.4, "pos": [0.10, 0.06, 0.00], "rot": [0, 10, 0] },
        { "t": 1.0, "pos": [0.02, 0.02, 0.00], "rot": [0, -10, 0] }
      ],
      "layerPolicy": "follow_anchor"
    }
  }
}
```

---

## 6. Runtime Resolution Order

武器表示時は次の順番で最終位置を解決する。

1. ユニットの現在フレームを取得
2. そのフレームの `anchor` 位置を取得
3. 装備中 `weapon` の `grip` / `pivot` を取得
4. 再生中 `motion` の相対位置・相対回転を取得
5. `anchor + motion offset` を最終武器配置点にする
6. `pivot` / `grip` を考慮してメッシュを配置

---

## 7. Meaning of `pivot` and `grip`

### 7.1 `pivot`
- 見た目上の回転中心
- 画像またはメッシュ上の原点補正に使う

### 7.2 `grip`
- 手で持つべき場所
- アンカーに一致させる基準点

通常は同じ値でもよいが、将来は別に持てるようにする。

---

## 8. Layer Policy

### 8.1 `follow_anchor`
- アンカーに設定された `front / back` に従う

### 8.2 `force_front`
- 常に前面

### 8.3 `force_back`
- 常に背面

### 8.4 `timeline`
- キーフレームごとにレイヤーを変える

---

## 9. Editing Workflow

### 9.1 Step 1: Anchor Editing
- フレームごとの手位置を調整する
- この時点では「手の位置」だけを見る

### 9.2 Step 2: Weapon Grip/Pivot Editing
- 武器画像上で grip / pivot を調整する

### 9.3 Step 3: Motion Editing
- 開始 / 中間 / 終了の姿勢を調整する
- これはアンカー相対の動作として保存する

---

## 10. Compatibility Policy

既存の `weaponPivot`, `weaponAngleOffset`, `weaponSwing` はすぐには削除しない。

移行期間の優先順位:

1. `motions` があればそれを優先
2. なければ `weaponSwing`
3. なければ static `angle`

---

## 11. Suggested File Layout

```text
scripts/data/attachments/
  weapons.json
  soldier_anchors.json
  archer_anchors.json
  motions.json
```

移行初期は 1 ファイルでもよいが、最終的には責務ごとに分離する。

---

## 12. Initial Migration Plan

### Stage 1
- `DEFAULT` 歩兵だけを新構造へ変換

### Stage 2
- 弓兵を追加
- `bow_basic`, `arrow_basic`, `muzzle` / `weapon_tip` を定義

### Stage 3
- 杖・槍・大型武器へ展開

---

## 13. Success Criteria

- 武器種を追加しても既存コードへの条件分岐追加が最小で済む
- ユニット側調整と武器側調整を独立して行える
- 近接 / 射撃 / 魔法のアタッチ方式を統一的に扱える

