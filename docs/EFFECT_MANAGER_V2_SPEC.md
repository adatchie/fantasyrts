# Fantasy RTS - EffectManager V2 Specification

**Date**: 2026-04-21  
**Status**: Phase 1 partially implemented

---

## 1. Goal

現行の分散したエフェクト実装を統合し、演出追加・差し替え・調整を低コストにする。

EffectManager V2 は次を担当する。

- エフェクト定義のロード
- エフェクトインスタンス生成
- ライフサイクル管理
- レンダリング更新
- Presentation 層からの呼び出し統一窓口

---

## 2. Current Issues

- `scripts/effects.js` と `scripts/rendering3d.js` にエフェクト実装が重複している。
- `combat.js` が描画メソッドを直接知っている。
- エフェクトの時間管理、追従、フェード、ビルボード処理が統一されていない。

---

## 3. Responsibility

EffectManager V2 の責務:

- 定義ベースでエフェクトを生成する
- 各エフェクトの update / cleanup を一括管理する
- ユニット追従、座標補正、寿命、透明度、拡縮を共通ルールで扱う
- `RenderingEngine3D` から利用できるようにする

責務外:

- ダメージ計算
- 攻撃の成否判定
- AI の判断

---

## 4. Architecture

### 4.1 Modules
- `scripts/effect-definitions.js`
- `scripts/effect-manager.js`
- `scripts/effect-projectile-bridge.js`
- `scripts/data/effects/*.json`
- `scripts/effect-factory.js`
- `scripts/effect-instance.js`

### 4.2 Core Flow
1. Gameplay / Presentation から `playEffect(effectId, context)` を呼ぶ
2. `effectId` から定義を取得
3. Factory が Three.js オブジェクトを生成
4. Manager が activeEffects に登録
5. 毎フレーム `update(deltaMs)` で進行
6. 寿命終了時に cleanup

### 4.3 Current Phase 1 Implementation

2026-04-21 時点で、以下は実装済み。

- `scripts/effect-manager.js` に `EffectManagerV2` を新設
- `scripts/effect-definitions.js` に最小の ID 定義テーブルを新設
- `scripts/effect-definitions.js` を helper ベースの簡易スキーマへ整理
- `scripts/effect-definitions.js` に軽量バリデーションを追加
- `main.js` で `Game.effectManager` を初期化
- `main.js` で `EffectProjectileBridge` を初期化
- `rendering3d.js` の毎フレーム更新に `effectManager.update(deltaMs)` を接続
- `scene-manager.js` のシーン遷移入口で `effectManager.clearAll()` を呼ぶ
- `main.js` の `startStage()` / `startGame()` 入口でも `effectManager.clearAll()` を呼ぶ
- `combat.js` の一部短命エフェクトを `playEffect(effectId, context)` 経由へ移行
- `combat.js` の `FLOAT_TEXT` も Manager 経由へ移行

現時点では、理想形の JSON ロードや `effect-factory.js` は未実装で、既存 `effects.js` / `rendering3d.js` の実装をブリッジして使っている。

---

## 5. Public API

### 5.1 Primary Methods
```js
effectManager.playEffect(effectId, context)
effectManager.update(deltaMs)
effectManager.clearAll()
effectManager.preload(effectIds)
```

### 5.2 Context Shape
```js
{
  sourceUnitId: "unit_001",
  targetUnitId: "unit_017",
  sourcePos: { x, y, z },
  targetPos: { x, y, z },
  anchorName: "weapon_tip",
  color: 0xffaa00,
  scale: 1.2
}
```

---

## 6. Effect Definition Schema

### 6.1 Example
```json
{
  "id": "slash_light",
  "kind": "billboard_sprite",
  "texture": "assets/effects/slash_light.png",
  "blend": "additive",
  "lifetimeMs": 220,
  "follow": null,
  "spawn": {
    "space": "target",
    "offset": [0, 18, 0]
  },
  "timeline": [
    { "t": 0.0, "opacity": 0.0, "scale": 0.6, "rotation": -20 },
    { "t": 0.2, "opacity": 1.0, "scale": 1.0, "rotation": 0 },
    { "t": 1.0, "opacity": 0.0, "scale": 1.4, "rotation": 8 }
  ]
}
```

### 6.2 Required Fields
- `id`
- `kind`
- `lifetimeMs`

### 6.3 Optional Fields
- `texture`
- `blend`
- `follow`
- `spawn`
- `timeline`
- `billboard`
- `color`
- `zBias`
- `sorting`

### 6.4 Current JS Definition Schema (`scripts/effect-definitions.js`)

Phase 1 の実装では JSON ではなく JS 定義を使っているが、JSON 化しやすい形へ寄せ始めている。

```js
{
  id: 'float_text',
  schemaVersion: 1,
  transport: 'managed3d' | 'legacy',
  category?: 'default' | 'cone_stream',
  rendererType?: 'FLOAT_TEXT',
  legacyType?: 'heal',
  normalizerKey?: 'FLOAT_TEXT',
  factoryKey?: 'FLOAT_TEXT',
  lifecycle: 'rendering3d' | 'legacy-effect-manager',
  contextKeys: ['sourceHex', 'text', 'color', 'size'],
  coneStream?: {
    schemaVersion: 1,
    mode: 'cone' | 'stream',
    attachTo: 'sourceEntity',
    aimAt: 'targetEntity',
    length: 96,
    spreadDeg: 30,
    lifetimeMs: 220,
    fadeOutMs: 120,
    flicker: false
  },
  buildArgs?: (context) => [...],
  buildParams?: (context) => ({ ... })
}
```

補足:
- `managed3d` は `rendererType + buildArgs`
- `legacy` は `legacyType + buildParams`
- `normalizerKey` は `rendering3d.js::normalize3DEffectArgs()` 側の正規化キー
- `factoryKey` は `rendering3d.js::get3DEffectDispatcher()` 側の生成キー
- `contextKeys` は実質的に「この定義が何を期待しているか」の宣言になっている
- 現状のバリデーションは型と必須キーの有無まで。実行時の値内容まではまだ検証していない
- `EffectManagerV2` も `factoryKey` を実際に参照して `addManaged3DEffect()` を呼ぶようになっている
- `EffectManagerV2` は `contextKeys` を使って、実行時に不足キーがあれば warning を出す
- さらに `normalizerKey` ごとの必須入力チェックも warning として実行する
- 開発時だけ `window.__EFFECT_VALIDATION_STRICT__ = true` を入れると、これらの不足は `console.error + trace` で強く見える
- `coneStream` はまだテンプレート段階だが、`BREATH` などを JSON 化する受け皿として `scripts/effect-definitions.js` に最小スキーマ案を置いてある
- `breath_attack` は先行して `defineManagedConeStreamEffect(...)` に寄せ、`coneStream` 情報を `BREATH` 描画へ渡し始めている
- `flame_stream_attack` を追加して、`mode: 'stream'` の実体定義も置いた
- `combat.js` では `DRAGON_RIDER` の breath 系を `flame_stream_attack` へつなぎ始めた
- breath 系の使用エフェクトはユニット定義側の `breathEffectId` で切り替える方針に寄せ始めた
- `BREATH` 描画は仮実装として CanvasTexture + PlaneGeometry の 2D スプライト風表現へ寄せ始めた

---

## 7. Supported Kinds

### 7.1 `billboard_sprite`
- 斬撃、血飛沫、魔法陣、着弾光

### 7.2 `beam`
- 稲妻、レーザー、線状魔法

### 7.3 `projectile`
- 火球、氷弾、矢の強化版

### 7.4 `particle_burst`
- 火花、土煙、破片

### 7.5 `ring`
- 範囲表示、回復波動、詠唱円

---

## 8. Spawn Spaces

### 8.1 `world`
- 絶対座標に出す

### 8.2 `source`
- 発生元ユニット基準

### 8.3 `target`
- 対象ユニット基準

### 8.4 `anchor`
- ユニットのアンカー名基準

---

## 9. Timeline Model

### 9.1 Interpolated Properties
- `opacity`
- `scale`
- `rotation`
- `color`
- `offset`

### 9.2 Timing Rule
- `t` は 0.0 - 1.0
- 実時間は `lifetimeMs` によって決まる
- イージングは keyframe ごとではなく effect 定義全体で持ってよい

---

## 10. Runtime Behavior

### 10.1 Update Loop
各アクティブエフェクトは次を処理する。

- age 更新
- 寿命判定
- follow 更新
- timeline 補間
- camera facing 更新
- Three.js object への反映

### 10.2 Cleanup
- scene から remove
- geometry / material / texture の解放
- active list から除外

---

## 11. Integration Plan

### Stage 1
- 現行 `scripts/effects.js` をラップして Manager 化
- `combat.js` からの直接 spawn を Manager 呼び出しへ集約

### Stage 2
- Three.js 直実装のエフェクトを定義ベースへ置換

### Stage 3
- MotionSystem と連携し、モーションイベントから自動発火

---

## 12. Initial Effect Set

最初に V2 へ移す対象:

- `slash_light`
- `slash_heavy`
- `hit_spark`
- `blood_small`
- `dust_step`
- `magic_cast_circle`
- `heal_pulse`
- `impact_flash`

### 12.1 Phase 1 実装済み対象

実際に Phase 1 で Manager 経由へ移行済みなのは次の 4 つ。

- `hit_spark`
- `blood_small`
- `dust_step`
- `heal_pulse`

追記:
- `float_text` も Manager 経由へ移行済み

加えて、既存 `rendering3d.js` の managed3d 経路を使う形で、次も ID ベース定義へ寄せ始めている。

- `attack_beam`
- `attack_wave`
- `hex_flash`
- `unit_flash`

---

## 13. File Layout Proposal

```text
scripts/
  effect-definitions.js
  effect-manager.js
  effect-projectile-bridge.js
  effect-factory.js
  effect-instance.js
  data/
    effects/
      slash_light.json
      hit_spark.json
      heal_pulse.json
```

---

## 14. Success Criteria

- `combat.js` が具体的な Three.js エフェクト実装を知らない
- 新規エフェクト追加時に既存コードへの分岐追加が不要
- エフェクト差別化を JSON 定義中心で行える

---

## 15. Phase 1 Breakdown

Phase 1 の目的は「理想形へ全面移行すること」ではなく、呼び出し口と更新口を先に一本化すること。

この段階では:

- JSON 定義化はしない
- `projectile` / `beam` 系は移行しない
- 既存 `effects.js` と `rendering3d.js` の実装は流用する
- まず `combat.js` からのエフェクト呼び出しを統一する

---

## 16. Phase 1 Scope

### 16.1 In Scope
- `scripts/effect-manager.js` の新設
- `playEffect() / update() / clearAll()` の導入
- `main.js` または `rendering3d.js` の更新ループへの接続
- `combat.js` の短命エフェクト呼び出しを Manager 経由へ変更

### 16.3 実装済み
- `scripts/effect-manager.js` 新設
- `scripts/effect-definitions.js` に最小定義テーブルを分離
- `playEffect() / update() / clearAll()` 実装
- `main.js` で `Game.effectManager` 初期化
- `scripts/effect-projectile-bridge.js` 新設
- `main.js` で `Game.effectProjectileBridge` 初期化
- `rendering3d.js` の更新ループ接続
- `scene-manager.js` の `transition()` で `clearAll()` 呼び出し
- `main.js` の `startStage()` / `startGame()` で `clearAll()` 呼び出し
- `combat.js` の `spawnSparks()` / `DUST` / `blood_small` / `heal_pulse` 呼び出し移行
- `combat.js` の `BEAM` / `WAVE` / `HEX_FLASH` / `UNIT_FLASH` を順次 Manager 経由へ移行

### 16.2 Out of Scope
- JSON ローダー
- `effect-factory.js`
- `effect-instance.js`
- 矢、魔法弾、雷などの飛翔体統合
- followTarget の一般化

---

## 17. Phase 1 Target Effects

Phase 1 で先に移行する対象:

- `hit_spark`
- `blood_small`
- `heal_pulse`
- `dust_step`

理由:

- 寿命が短い
- 追従不要
- 発生位置が単純
- `combat.js` 側の呼び出し置換がしやすい

---

## 18. File-by-file Tasks

### 18.1 `scripts/effect-manager.js` (new)

#### Add: `EffectManagerV2` class
最低限の責務:

- `constructor(renderingEngine)`
- `playEffect(effectId, context)`
- `update(deltaMs)`
- `clearAll()`

#### Internal state
```js
this.renderingEngine
this.activeEffects
this.legacyEffectManager
```

#### Required helper methods
- `_normalizeContext(context)`
- `_spawnLegacyEffect(effectId, context)`
- `_updateLegacyEffects(deltaMs)`
- `_cleanupEffect(effect)`

#### Notes
- 最初は `legacyEffectManager` として `scripts/effects.js` の `EffectManager` を内部利用してよい
- `rendering3d.js` の `this.effects` も Phase 1 では残す
- 実装では `effectId -> definition` の最小テーブルを `scripts/effect-definitions.js` に分離し、
  `transport: managed3d | legacy` を切り替える形にしている

### 18.1a `scripts/effect-definitions.js` (new)

#### Current role
- Phase 1 の最小 ID 定義テーブルを保持
- `effect-manager.js` から import して利用

#### Current schema
```js
{
  hit_spark: {
    id: 'hit_spark',
    schemaVersion: 1,
    transport: 'managed3d',
    rendererType: 'SPARK',
    buildArgs: (context) => [...]
  }
}
```

```js
{
  breath_attack_template: {
    id: '__template__',
    schemaVersion: 1,
    transport: 'managed3d',
    category: 'cone_stream',
    rendererType: 'BREATH',
    normalizerKey: 'BREATH',
    factoryKey: 'BREATH',
    coneStream: {
      schemaVersion: 1,
      mode: 'cone',
      attachTo: 'sourceEntity',
      aimAt: 'targetEntity',
      length: 96,
      spreadDeg: 30,
      lifetimeMs: 220,
      fadeOutMs: 120,
      flicker: true
    },
    buildArgs: (context) => [...]
  }
}
```

#### Notes
- まだ JSON ロードではなく JS 定義
- Phase 2 以降で `scripts/data/effects/*.json` へ移しやすいよう、ID ベースの責務だけ先に分離している
- 定義不備は module load 時にバリデーションされ、壊れた定義は早期に例外化される
- `MANAGED_CONE_STREAM_SCHEMA_TEMPLATE` を置いてあり、`cone/stream` 定義はそこを叩き台にできる

---

### 18.2 `scripts/effects.js`

#### Keep existing implementation
- この段階では大改修しない
- 新Managerから使えるように import される前提にする

#### Optional small task
- 既存 `EffectManager.spawnEffect(type, params)` に effectId の別名を受けられるよう整理してもよい

#### No-go in Phase 1
- 各 effect class の全面書き換え

---

### 18.3 `scripts/rendering3d.js`

#### Add: effect manager ownership
候補:

- `this.effectManagerV2 = null;`
- `setEffectManager(effectManager)`

#### Add: update hook
既存 update ループのどこかで:

```js
if (this.effectManagerV2) {
  this.effectManagerV2.update(deltaMs);
}
```

#### Keep existing methods
以下は残す:

- `spawnArrowAnimation()`
- `spawnMagicProjectile()`
- `this.effects` ベースの更新処理

理由:
- projectile 系は Phase 2 以降の対象

#### 実装済み追加点
- `setEffectManager(effectManager)`
- `addManaged3DEffect(sourceTag, type, ...)`
- `hasManagedEffects(sourceTag)`
- `clearManagedEffects(sourceTag)`
- `add3DEffect()` は薄い dispatcher 経由に整理し始めている
- 現在は `effectType -> normalize3DEffectArgs() -> dispatcher -> createX()` の 2 段構成
- dispatcher は `EFFECT_FACTORY_TABLE` で type と normalizer/factory の対応を明示化している

### 18.3a `scripts/effect-projectile-bridge.js` (new)

#### Current role
- `combat.js` から projectile 系の rendering 直呼びを薄く中継する
- `spawnArrowAnimation()` / `spawnMagicProjectile()` を今後外出しするための橋
- まずは高さ解決・軌道設定・速度設定などの共通計算をここへ寄せ始めている

#### Current API
```js
effectProjectileBridge.playArrowProjectile(fromUnit, toUnit, blockInfo)
effectProjectileBridge.playMagicProjectile(fromUnit, toUnit, color)
effectProjectileBridge.buildArrowTrajectoryConfig(fromUnit, toUnit, blockInfo)
effectProjectileBridge.buildMagicProjectileConfig(fromUnit, toUnit, color)
```

#### Notes
- まだ rendering 実装の本体は `rendering3d.js` に残っている
- Phase 2 ではこの bridge を起点に projectile factory / projectile runner へ分解していく

### 18.3b Projectile Separation Plan

`arrow / magic / breath` の分離計画は、次の 3 層に分ける。

#### Layer 1: Combat / Gameplay 呼び出し
- `combat.js`
- `EffectProjectileBridge`

役割:
- 発射元・対象・遮蔽情報・色などの gameplay 情報を受ける
- projectile 種別ごとの設定オブジェクトを作る

#### Layer 2: Trajectory / Config
- `EffectProjectileBridge.buildArrowTrajectoryConfig()`
- `EffectProjectileBridge.buildMagicProjectileConfig()`

役割:
- 高さ解決
- world 座標化
- duration / arcHeight / limitT 決定
- projectile 共通設定の組み立て

#### Layer 3: Visual Factory / Runner
- 現状はまだ `rendering3d.js` に残置
- 今回 `createArrowVisualGroup()` / `createMagicProjectileVisualGroup()` を切り出し開始
- さらに `runArrowProjectileAnimation()` / `runMagicProjectileAnimation()` へ animate ループ本体を切り出し開始

役割:
- メッシュ生成
- マテリアル生成
- 実フレーム更新
- scene 追加 / remove / dispose

#### Planned split by projectile kind

1. `arrow`
- 軌道: 放物線 + 遮蔽 limitT
- visual: shaft / head / fletch の group
- runner: lookAt と arc 更新

2. `magic`
- 軌道: 直線
- visual: core + glow
- runner: lerp + 回転 + 明滅

3. `breath`
- いまは managed3d の `BREATH` 側に残置
- 将来的には projectile bridge 側の「短距離 cone / stream」カテゴリとして分離候補

#### Decision (current)
- **`BREATH` は当面 managed3d のまま維持**

理由:
- 既存の `createBreath(att, def)` は cone 系の一発演出で、arrow / magic のような projectile とは性質が違う
- bridge 側へ無理に寄せると、短距離 stream / cone 専用の別カテゴリが必要になり、今はまだ抽象化コストが高い
- 先に `arrow / magic` の projectile 分離を進めた方がリターンが大きい
- projectile runner も現段階では bridge 側へは寄せ切らず、`rendering3d.js` 内の runner テーブル化で止める

見直し条件:
- breath 系に「持続時間」「追従」「複数フレームの stream 制御」が必要になった時
- その段階で projectile bridge 側へ `cone/stream runner` を新設する

### 18.3c Managed3D `cone/stream` Category (planned)

`BREATH` のような演出向けに、managed3d 側には将来的に `cone/stream` カテゴリを追加する想定。

#### Intended use cases
- ドラゴンブレス
- 火炎放射
- 毒霧噴射
- 氷結ブレス

#### Characteristics
- projectile の「点移動」ではなく、発射元から対象方向へ広がる短距離演出
- cone angle / length / fade / flicker を持つ
- 必要に応じて数フレームだけ持続させる

#### Why not now
- まだ `BREATH` は既存 `createBreath(att, def)` で要件を満たしている
- いま先に整えるべきは `arrow / magic` の projectile 分離で、`cone/stream` は Phase 2 の managed3d 拡張として扱う方が安全

#### Near-term next step
- `spawnArrowAnimation()` / `spawnMagicProjectile()` の runner は `rendering3d.js` 内テーブル化で維持しつつ、state オブジェクトを受け取る小さな runner に寄せる
- `BREATH` は managed3d の `cone/stream` カテゴリ定義が固まるまで現状維持
- projectile state は `dispose / cancel / onComplete` を持つ形に寄せ、終了処理の統一を始める
- `completionReason: 'finish' | 'cancel'` を持たせ、finish 側でも後続 cleanup 分岐を始める
- `MAGIC` は `finish` 時に終点へスナップして cleanup、`cancel` 時は早期 cleanup として扱い分け始めた
- `finish` 時は着弾 `HEX_FLASH`、`cancel` 時は縮小 cleanup という形で差別化を開始

---

### 18.4 `scripts/main.js`

#### Add: initialization
初期化時に:

1. `renderingEngine` 生成後
2. `effectManagerV2` を作成
3. `renderingEngine.setEffectManager(effectManagerV2)` で渡す

#### Minimal wiring
```js
this.effectManager = new EffectManagerV2(this.renderingEngine);
this.renderingEngine.setEffectManager(this.effectManager);
```

#### Notes
- Game 全体から参照しやすいように `this.effectManager` として保持する

---

### 18.5 `scripts/combat.js`

#### Add: unified effect request path
既存の以下を候補として差し替える:

- `spawnSparks(unit1, unit2)`
- `spawnEffect(type, unit1, unit2)`

#### Replace behavior
直接 `renderingEngine` や個別 effect 実装を呼ぶのではなく:

```js
this.game.effectManager.playEffect('hit_spark', context)
```

#### First replacement candidates
1. `spawnSparks()`
2. 回復演出
3. 血飛沫
4. 土煙

#### Keep untouched in Phase 1
- `spawnArrowAnimation()`
- `spawnMagicProjectile()`
- 浮遊テキスト

#### 実装済みの呼び出し口
- `spawnSparks()` -> `playEffect('hit_spark')`
- `spawnText()` -> `playEffect('float_text')`
- `addEffect('DUST', ...)` -> `playEffect('dust_step')`
- 近接/遠距離ダメージ時 -> `playEffect('blood_small')`
- 回復時 -> `playEffect('heal_pulse')`
- `addEffect('BEAM', ...)` -> `playEffect('attack_beam')`
- `spawnEffect('WAVE', ...)` / `addEffect('WAVE', ...)` -> `playEffect('attack_wave')`
- `addEffect('HEX_FLASH', ...)` -> `playEffect('hex_flash')`
- `addEffect('UNIT_FLASH', ...)` -> `playEffect('unit_flash')`
- `speak()` -> `playEffect('speech_bubble')`
- 範囲魔法の詠唱 -> `playEffect('magic_cast')`
- ブレス攻撃 -> `playEffect('breath_attack')`

---

## 19. Function-level Task List

### Task A: Create manager shell
対象:
- `scripts/effect-manager.js`

関数:
- `constructor(renderingEngine)`
- `playEffect(effectId, context)`
- `update(deltaMs)`
- `clearAll()`

完了条件:
- 空実装でも import して生成できる

実装状況:
- 完了

### Task B: Add game initialization
対象:
- `scripts/main.js`

関数:
- `init()`

完了条件:
- Game 起動時に `effectManager` が存在する

実装状況:
- 完了

### Task C: Add rendering update hook
対象:
- `scripts/rendering3d.js`

関数:
- フレーム更新処理

完了条件:
- 毎フレーム `effectManager.update(deltaMs)` が呼ばれる

実装状況:
- 完了

### Task D: Add legacy bridge
対象:
- `scripts/effect-manager.js`

関数:
- `_spawnLegacyEffect()`
- `_normalizeContext()`

完了条件:
- `hit_spark` などが既存 effect 実装経由で再生される

実装状況:
- 完了（最小定義テーブル経由）

### Task E: Replace one combat call site
対象:
- `scripts/combat.js`

関数:
- `spawnSparks()`

完了条件:
- 火花系演出が `game.effectManager.playEffect()` 経由で出る

実装状況:
- 完了
- 追加で `dust_step / blood_small / heal_pulse` も Phase 1 対象として移行済み

### Task F: Add cleanup path
対象:
- `scripts/effect-manager.js`
- 必要なら `scene-manager.js` or `main.js`

関数:
- `clearAll()`

完了条件:
- シーン切替や再開時にエフェクト残骸が残らない

実装状況:
- 完了
- `scene-manager.js::transition()` の冒頭で `game.effectManager.clearAll()` を呼ぶ
- `main.js::startStage()` / `main.js::startGame()` の冒頭でも `game.effectManager.clearAll()` を呼ぶ

---

## 20. Suggested Implementation Order

1. `scripts/effect-manager.js` の枠を作る
2. `main.js` に初期化を追加
3. `rendering3d.js` に update 接続を追加
4. `playEffect('hit_spark')` だけ動くようにする
5. `combat.js::spawnSparks()` を差し替える
6. `clearAll()` を接続する

---

## 21. Verification Checklist

Phase 1 完了時に確認すべきこと:

- ゲーム起動で例外が出ない
- 近接攻撃時に spark が出る
- update で effect が進行し、寿命で消える
- 戦闘終了 / シーン切替後に effect が残らない
- 矢や魔法弾の既存挙動が壊れていない

### 21.1 2026-04-21 実施結果

- `node --check`:
  - `scripts/effect-manager.js`
  - `scripts/main.js`
  - `scripts/rendering3d.js`
  - `scripts/combat.js`
  - `scripts/scene-manager.js`
  - すべて通過
- headless Edge + DevTools Protocol で `http://127.0.0.1:8080/index.html` を読み込み確認
- `window.game`, `combatSystem`, `effectManager` の初期化を確認
- `EffectManagerV2` インスタンスの存在を確認
- `spawnSparks()` 実行結果: `ok`
- `dust_step / blood_small / heal_pulse` 実行結果: `ok`
- `clearAll()` 実行結果: managed / legacy / manager record がすべて 0 になることを確認
- `attack_beam / attack_wave / hex_flash / unit_flash` 実行結果: `ok`
- `float_text / speech_bubble / magic_cast / breath_attack` 実行結果: `ok`
- `startGame()` 実行時に `clearAll()` が走り、 activeEffects が `4 -> 0` になることを確認
- `error-log` は空

### 21.2 combat.js 直呼びフォールバック棚卸し

2026-04-21 時点の整理:

#### Manager 化済み
- `spawnText()` -> `float_text`
- `spawnSparks()` -> `hit_spark`
- `addEffect('DUST')` -> `dust_step`
- `addEffect('BEAM')` / `spawnEffect('BEAM')` -> `attack_beam`
- `addEffect('WAVE')` / `spawnEffect('WAVE')` -> `attack_wave`
- `addEffect('HEX_FLASH')` -> `hex_flash`
- `addEffect('UNIT_FLASH')` -> `unit_flash`
- `speak()` -> `speech_bubble`
- 範囲魔法の詠唱 -> `magic_cast`
- ブレス攻撃 -> `breath_attack`
- ダメージ時 -> `blood_small`
- 回復時 -> `heal_pulse`

#### まだ直呼び or 専用経路で残すもの
- `spawnMagicProjectile()`
- `spawnArrowAnimation()`
- `renderingEngine.add3DEffect(...)` の各フォールバック分岐

#### 現時点の方針
- `spawnMagicProjectile()` / `spawnArrowAnimation()` は projectile 系として Phase 1 対象外のまま維持
- `add3DEffect(...)` フォールバックは安全網として当面維持
- Phase 2 で projectile / beam / factory 化が進んだ段階で、combat.js のフォールバックを段階的に削る
- projectile 系は `rendering3d.js` の描画組み立てと `effect-projectile-bridge.js` の軌道/設定計算を少しずつ分離していく

未確認:
- 実プレイ中の見た目確認
- Result 画面遷移を含む長時間プレイでの残留有無

---

## 22. Phase 1 Exit Criteria

次の条件を満たしたら Phase 2 へ進む:

- `combat.js` に少なくとも 1 系統の effect request が Manager 経由で入っている
- Manager の update / cleanup がゲームループに接続されている
- 既存挙動を大きく壊さず導入できている
