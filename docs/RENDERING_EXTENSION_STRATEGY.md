# Fantasy RTS - Rendering Extension Strategy

**Date**: 2026-04-21  
**Status**: Draft

---

## 1. Goal

Godot への全面移植を前提にせず、既存の `Three.js + ES Modules` ベースを拡張して、次の課題を段階的に解決する。

- 各種エフェクトの差別化
- ユニットごとのモーション差別化
- 武器アタッチの破綻しにくい再設計
- 将来的な 2.5D / 3D キャラクター表現への移行余地確保

この資料では、現行システムの延長線上で採るべき全体方針を定義する。

---

## 2. Current Problems

### 2.1 Effects
- `scripts/effects.js` と `scripts/rendering3d.js` の双方にエフェクト処理が分散している。
- エフェクトごとに実装方式が異なり、追加・調整コストが高い。
- 戦闘ロジックから描画ロジックが直接呼ばれており、演出の差し替えがしづらい。

### 2.2 Motion
- ユニット本体、武器、エフェクトが 1 つの攻撃処理に強く結合している。
- 近接、弓、魔法、回復で必要な演出の粒度が異なるのに、同じ構造で扱おうとして破綻しやすい。

### 2.3 Weapon Attachment
- 現行は手元位置と武器位置の関係が実装上複数の表現に分かれており、調整の一貫性がない。
- ユニットごと、武器ごと、動作ごとの差異を吸収しきれていない。

### 2.4 Character 3Dization
- いきなり完全 3D モデルへ移ると、レンダリング・アニメーション・データ定義の再構築コストが高い。
- 既存ゲームプレイロジックと見た目実装の分離が不十分で、差し替えが難しい。

---

## 3. Design Principles

### 3.1 Keep the Current Runtime
- ベースランタイムは維持する。
- `index.html`, `scripts/main.js`, `scripts/rendering3d.js` を中心とした現行構成を前提に拡張する。

### 3.2 Separate Logic and Presentation
- 戦闘結果の決定と、その見せ方を分離する。
- `combat.js` は「何が起きたか」を発火し、描画側は「どう見せるか」を解決する。

### 3.3 Move from Hardcoded Behaviors to Data-driven Presentation
- 表現差はコード分岐ではなくデータ定義で吸収する。
- 近接・射撃・魔法・回復は、モーション定義とエフェクト定義の組み合わせで表現する。

### 3.4 Prefer Hybrid 2.5D over Immediate Full 3D
- 先に「完全 3D キャラ」を目指さない。
- 段階的に `SpriteVisual -> HybridVisual -> ModelVisual` へ進める。

---

## 4. Target Architecture

以下の 4 層構成へ再整理する。

### 4.1 Gameplay Event Layer
責務:
- 戦闘結果、被弾、回復、発射、着弾などの出来事を発火する。

主な入力:
- `combat.js`
- `unit-manager.js`
- `scene-manager.js`

主な出力:
- `AttackStarted`
- `ProjectileSpawned`
- `HitResolved`
- `EffectRequested`
- `MotionRequested`

### 4.2 Presentation Orchestrator Layer
責務:
- ゲームイベントを受けて、どのモーションとエフェクトを出すかを決定する。

新設候補:
- `scripts/presentation-manager.js`

役割:
- ユニット種別・武器種別・アクション種別からモーション定義を選択
- EffectManager へ発火
- RenderingEngine3D にトラック再生を依頼

### 4.3 Motion Layer
責務:
- 本体、武器、エフェクトアンカーを独立したトラックとして再生する。

新設候補:
- `scripts/motion-system.js`

トラック種類:
- `bodyTrack`
- `weaponTrack`
- `effectTrack`
- `cameraTrack` (将来)

### 4.4 Rendering Layer
責務:
- 実際の `Three.js` オブジェクト更新
- ビルボード、武器メッシュ、エフェクト、将来の 3D モデル描画

主なファイル:
- `scripts/rendering3d.js`
- `scripts/effects.js` (将来的には EffectManager 専用へ再編)

---

## 5. Recommended Evolution Path

### Phase A: Effect System Unification
目的:
- エフェクト追加を安くする

実施内容:
- エフェクト処理を `EffectManager` に一元化
- 描画用エフェクトを定義ベースへ移行
- `combat.js` は Effect 名とコンテキストだけを投げる

### Phase B: Motion Track Introduction
目的:
- 本体・武器・エフェクトを分離して制御する

実施内容:
- 攻撃アクションを「モーショントラック再生」に変換
- 近接 / 射撃 / 魔法で別モーション定義を使用

### Phase C: Weapon Attachment Redesign
目的:
- 武器種ごとの差異と、ユニット種ごとの差異を両立させる

実施内容:
- `anchor + pivot + grip + track` ベースに再定義
- フレーム単位調整から「アンカー+動作トラック」へ移行

### Phase D: Visual Abstraction for 2.5D/3D
目的:
- ユニット表現を差し替え可能にする

実施内容:
- `UnitVisual` インターフェースを導入
- `SpriteVisual`, `HybridVisual`, `ModelVisual` を段階追加

---

## 6. Visual Strategy

### 6.1 Near-term
- 本体: billboard sprite
- 武器: plane mesh
- エフェクト: billboard plane / particle / beam

### 6.2 Mid-term
- 本体: sprite or segmented sprite
- 武器: 3D mesh / sprite selectable
- エフェクト: timeline based

### 6.3 Long-term
- 一部ユニットを `ModelVisual` に差し替え
- ロジック側の変更なしで見た目のみ差し替える

---

## 7. Non-goals

現段階では次を目的にしない。

- Godot への全面移植
- フルボーンアニメーションシステムの導入
- 物理ベースレンダリングへの全面移行
- フル ECS への再構成

---

## 8. Expected Benefits

- エフェクト追加のコストが下がる
- 武器アタッチ調整が破綻しにくくなる
- 兵種ごとの差別化が見た目にも出しやすくなる
- 将来的な 3D キャラ導入が、全体再実装ではなく差し替え作業になる

---

## 9. Immediate Follow-up Specs

この全体方針に紐づく具体仕様は次の 2 文書で定義する。

- `docs/EFFECT_MANAGER_V2_SPEC.md`
- `docs/WEAPON_ATTACHMENT_REDESIGN.md`

