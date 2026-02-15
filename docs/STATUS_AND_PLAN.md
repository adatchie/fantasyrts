# Fantasy RTS - 実装状況レポート・次期開発計画

**作成日**: 2026-02-14
**目的**: 他の開発環境（別セッション、別エージェント）でもすぐに状況を把握できる「引き継ぎドキュメント」

---

## 1. プロジェクト概要

Fantasy RTSは「関ヶ原の戦い」をモチーフにしたブラウザベースのクォータービューRTSゲーム。

- **技術スタック**: HTML + CSS + Pure JavaScript (ES6 Modules) + Three.js
- **ビルドシステム**: なし（静的ファイルサーブ: `python -m http.server 8000`）
- **テストフレームワーク**: なし
- **エントリーポイント**: `index.html`
- **ゲームフロー**: TITLE → MAP_SELECT → ORGANIZATION → DEPLOYMENT → BATTLE → RESULT

---

## 2. 主要ファイルマップ

| ファイル | 役割 | 行数（概算） |
|---------|------|-------------|
| `scripts/main.js` | ゲームループ、入力処理、UI | 2,000+ |
| `scripts/combat.js` | 戦闘ロジック（近接・遠距離・回復） | 1,536 |
| `scripts/rendering3d.js` | Three.js 3D描画エンジン | 4,209 |
| `scripts/scene-manager.js` | 6画面のシーン遷移管理 | 996 |
| `scripts/building.js` | ボクセルベースの建物システム | 804 |
| `scripts/unit-manager.js` | ユニット生成・部隊(Squadron)管理 | 550+ |
| `scripts/pathfinding.js` | A*経路探索（高低差対応） | 522 |
| `scripts/constants.js` | 定数、UNIT_TYPES(11種)、武器定義 | 350+ |
| `scripts/formation.js` | 陣形システム（鋒矢/鶴翼/魚鱗） | 279 |
| `scripts/ai.js` | CPU思考ルーチン | 295 |
| `scripts/game-data.js` | Squadron class、ステージ定義、ユニットプール | 200+ |
| `scripts/attack-patterns.js` | 8種の攻撃範囲パターン定義 | 153 |
| `scripts/sprite-config.js` | スプライト設定・アニメーション定義 | 162 |
| `scripts/map-repository.js` | マップデータ保存/読み込み(localStorage) | 300+ |
| `scripts/terrain-manager.js` | 地形管理 | 200+ |
| `scripts/audio.js` | Web Audio API サウンド管理 | 200+ |
| `scripts/kamon.js` | 家紋描画システム | 1,340 |
| `scripts/effects.js` | 戦闘エフェクト | 609 |
| `map-editor.html` | マップエディタ（スタンドアロン） | - |
| `building-designer.html` | 建物エディタ（スタンドアロン） | - |

---

## 3. ロードマップと実装状況

### 3.1 Phase 1: バトル通しプレイ — ✅ 完了

全6チケット（TICKET-000〜006）完了。コアゲームシステムが動作する。

| チケット | 内容 | 状態 |
|---------|------|------|
| TICKET-000 | マップデータ永続化対応 | ✅ 完了 |
| TICKET-001 | 古いbuildTerrainFromMapData削除 | ✅ 完了 |
| TICKET-002 | 部隊データ構造(Squadron)定義 | ✅ 完了 |
| TICKET-003 | UnitManager部隊管理機能 | ✅ 完了 |
| TICKET-004 | 高さルール - 移動コスト | ✅ 完了 |
| TICKET-005 | 高さルール - 攻撃射程 | ✅ 完了 |
| TICKET-006 | 戦闘フェイズ通しプレイ | ✅ 完了 |

**動作するコアシステム**:
- ORDER→ACTION 2フェイズ戦闘
- A*パスファインディング（高低差コスト対応、段差2まで歩行可）
- 陣形システム（鋒矢/鶴翼/魚鱗）＋CPU AI自動選択
- 部隊(Squadron)単位のユニット管理
- ボクセルベースの建物配置と高さ判定
- シーン管理（6画面遷移、シーン間データ共有）
- マップエディタ（地形テクスチャ、建物、配置ゾーン、JSON入出力）
- Three.js 3Dレンダリング（クォータービュー、スプライト描画）
- 高所有利/低所不利（ダメージ±15%/段、弓射程+1/段）

### 3.2 Phase 2: ユニット種別 — 🔶 部分完了

| チケット | 内容 | 状態 | 備考 |
|---------|------|------|------|
| TICKET-010 | 兵種別ステータス定義 | ✅ 完了 | constants.jsに11種UNIT_TYPES定義済み |
| TICKET-011 | 兵種別移動速度反映 | ✅ 完了 | baseMoveRange/mobility反映済み |
| TICKET-012 | 兵種別攻撃範囲反映 | 🔶 部分完了 | attack-patterns.js完了、**特殊能力の一部が未実装** |
| TICKET-013 | スプライト仕様策定 | ✅ 完了 | docs/sprite-specification-v2.md |
| TICKET-014 | スプライト生成スクリプト | 🔶 骨格のみ | tools/generate_sprites.js（ブラウザ用Canvas API、機能不完全） |

#### UNIT_TYPES定義（11種、全てconstants.jsに定義済み）

| ID | 名前 | サイズ | rangeType | atk | def | HP | 移動力 |
|----|------|--------|-----------|-----|-----|-----|--------|
| INFANTRY | 歩兵 | S(1) | melee | 50 | 50 | 1000 | 9 |
| KNIGHT | 騎士 | S(1) | melee | 40 | 80 | 1200 | 6 |
| ARCHER | 弓兵 | S(1) | bowArc | 40 | 30 | 800 | 9 |
| SPEAR | 槍兵 | S(1) | forward2 | 50 | 50 | 1000 | 9 |
| GUNNER | 銃士 | S(1) | longArc | 70 | 25 | 700 | 6 |
| MAGE | 魔術師 | S(1) | aoe | 80 | 15 | 600 | 6 |
| PRIEST | 僧侶 | S(1) | heal | 0 | 50 | 800 | 6 |
| CAVALRY | 騎兵 | M(2) | forward2 | 70 | 70 | 1500 | 12 |
| DRAGON | ドラゴン | L(4) | breath | 90 | 80 | 3000 | 11 |
| DRAGON_RIDER | 竜騎兵 | L(4) | breath | 85 | 75 | 2500 | 12 |
| ARTILLERY | 砲兵 | L(4) | siege | 100 | 20 | 1000 | 3 |

#### 特殊能力の実装状況（最重要）

| 能力 | ユニット | 定義 | combat.js実装 | 状態 |
|------|---------|------|--------------|------|
| 近接攻撃 (melee) | 歩兵,騎士 | attack-patterns.js | combat() | ✅ 動作 |
| 弓攻撃 (bowArc) | 弓兵 | attack-patterns.js | rangedCombat() | ✅ 動作 |
| 銃攻撃 (longArc) | 銃士 | attack-patterns.js | rangedCombat() | ✅ 動作 |
| 槍前方2マス (forward2) | 槍兵,騎兵 | attack-patterns.js | rangedCombat() | ✅ 動作 |
| 回復 (heal) | 僧侶 | attack-patterns.js | rangedCombat():1479 | ✅ 動作 |
| 砲撃 (siege) | 砲兵 | attack-patterns.js | rangedCombat() | ✅ 動作 |
| **範囲魔法 (aoe)** | 魔術師 | constants.js `isAoe: true` | ❌ **スプラッシュダメージ未実装** | 単体攻撃として動作 |
| **ブレス (breath)** | ドラゴン,竜騎兵 | attack-patterns.js | ❌ **扇状ダメージ未実装** | 単体攻撃として動作 |
| **騎兵押し出し (canPushBack)** | 騎兵 | constants.js `canPushBack: true` | ❌ **完全未実装** | 能力なし |

#### スプライト実装状況

| スプライト | ファイル | 状態 |
|-----------|---------|------|
| soldier（歩兵デフォルト） | `sprites/soldier/soldier.png` | ✅ |
| archer | `sprites/archer/archer.png` | ✅ |
| mage | `sprites/mage/mage.png` | ✅ |
| priest | `sprites/priest/priest.png` | ✅ |
| KNIGHT, SPEAR, GUNNER | なし | ❌ soldier.pngにフォールバック |
| CAVALRY, DRAGON, DRAGON_RIDER, ARTILLERY | なし | ❌ soldier.pngにフォールバック |

`sprite-config.js`で`UNIT_TYPE_TO_SPRITE`マッピングが定義されており、未実装ユニットは`'DEFAULT'`（soldier.png）に自動フォールバックする。

### 3.3 Phase 3〜10 — ❌ 未着手

| Phase | 内容 | 状態 |
|-------|------|------|
| Phase 3 | フィールドデータバリエーション（地形・建物） | ❌ |
| Phase 4 | 編成・装備などの成長要素 | ❌ |
| Phase 5 | ストーリー要素の表現方法 | ❌ |
| Phase 6 | ストーリーに合わせたフィールドデータ量産 | ❌ |
| Phase 7 | ストーリー要素作成 | ❌ |
| Phase 8 | エフェクト作成 | ❌ |
| Phase 9 | BGM・SE作成 | ❌ |
| Phase 10 | バランス調整 | ❌ |

---

## 4. 技術的負債

| 課題 | 影響 | 優先度 |
|------|------|--------|
| テストフレームワーク不在 | リグレッションリスク大 | 高 |
| rendering3d.js 4,209行の巨大ファイル | 変更・理解が困難 | 中 |
| rangedCombat()が2つ定義（374行目と1349行目） | 374行目はデッドコード（後の定義が有効） | 中 |
| TASKS.mdの完了状態が実態と乖離 | 開発判断を誤る原因 | 中 |
| バックアップファイル混在 (rendering3d.js.backup等) | リポジトリ汚染 | 低 |
| デバッグ/一時ファイル残留 (_debug_formations.js等) | リポジトリ汚染 | 低 |
| fix_rendering3d_*.js がルートに散在 | 不要ファイル | 低 |
| memo.txt 空ファイル | 不要 | 低 |

---

## 5. 次のステップ（推奨優先順位）

### 5.1 最優先: Phase 2完遂 — 特殊能力の実装

**場所**: `scripts/combat.js`

1. **魔術師AoEスプラッシュダメージ** (`rangedCombat()` 1349行目付近)
   - rangeType === 'aoe' の場合、着弾点の周囲8マスにいる敵にも50%ダメージ
   - `attack-patterns.js` の既存関数を利用可能

2. **ドラゴンブレス扇状ダメージ** (`rangedCombat()`)
   - rangeType === 'breath' の場合、`ATTACK_PATTERNS.breath`パターン内の全敵にダメージ
   - `rotatePattern()` と `getAttackableGrids()` で向き対応の範囲取得

3. **騎兵押し出し** (`combat()` 745行目付近)
   - `UNIT_TYPES[att.type].canPushBack === true` の場合、防御側を攻撃方向に1マス押し出し
   - 押し出し先が移動不可なら無効

**注意**: rangedCombatの第3引数に`allUnits`を追加する必要あり（現状は`map`のみ）。呼び出し元は全て`processAttack()`内で`allUnits`がスコープ内にある。

### 5.2 高優先: スプライト整備

1. 全11種 × 2陣営のスプライト制作（手動またはAI生成）
2. `sprite-config.js` の `SPRITE_PATHS` と `UNIT_TYPE_TO_SPRITE` を更新
3. スプライト仕様は `docs/sprite-specification-v2.md` に詳細定義済み

### 5.3 中優先: テスト基盤

- 現在テストなし。最低限のユニットテスト（ダメージ計算、パスファインディング）を導入すべき

### 5.4 低優先: リファクタリング

- `rendering3d.js` の分割（4,209行は過大）
- rangedCombat()デッドコード（374行目）の削除
- 一時ファイル・バックアップファイルの整理

---

## 6. 関連ドキュメント

| ドキュメント | 場所 | 内容 |
|-------------|------|------|
| システム仕様書 | `docs/SYSTEM_SPECIFICATION.md` | コアモジュール仕様、画面フロー、データフロー |
| タスク管理 | `docs/TASKS.md` | チケット一覧と完了状態 |
| スプライト仕様 v2 | `docs/sprite-specification-v2.md` | 全11種の解像度・アニメーション・レイアウト |
| 実装計画(Phase1) | `docs/implementation_plan.md` | Phase 1の設計（完了済み） |
| アーキテクチャガイド | `SYSTEM_ARCHITECTURE.md` | HEX→スクエア移行ガイド |
| 陣形システム完了レポート | `FORMATION_SYSTEM_COMPLETE.md` | 陣形実装の詳細 |
| Three.js移行ガイド | `THREE_JS_MIGRATION_GUIDE.md` | 2D→3D移行手順 |
| テクスチャ仕様 | `docs/TEXTURE_SPECIFICATION.md` | 地形テクスチャ |
| ライティング仕様 | `docs/lighting-specification.md` | 照明設定 |
| 建物データスキーマ | `docs/BUILDING_DATA_SCHEMA.md` | 建物JSON構造 |

---

## 7. 開発環境セットアップ

```bash
# リポジトリクローン後
cd fantasyrts

# ローカルサーバー起動（ビルド不要）
python -m http.server 8000

# ブラウザでアクセス
open http://localhost:8000/index.html

# マップエディタ
open http://localhost:8000/map-editor.html

# 建物エディタ
open http://localhost:8000/building-designer.html
```

**デバッグ方法**:
- `window.game` でGameインスタンスにアクセス
- `window.gameState` でユニット状態確認
- コンソールログは `[クラス名]` プレフィックスで出力される

---

*最終更新: 2026-02-14*
