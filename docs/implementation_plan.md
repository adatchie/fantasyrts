# Implementation Plan - Phase 1: Battle Playable

バトルの通しプレイを実現するための基盤実装計画。

## Goal
部隊（Squadron）単位でのユニット管理を実現し、高さルールを適用した状態で戦闘が完結するようにする。

## Proposed Changes

### 1. 部隊データ構造の導入 (TICKET-002)

**対象ファイル**:
- `scripts/game-data.js`
- `scripts/unit-manager.js`
- `scripts/constants.js`
- `scripts/formation.js` (既存コードの活用・改修)

**変更内容**:
- `scripts/formation.js` のリファクタリングと正式採用
  - 既存の「鋒矢」「鶴翼」「魚鱗」データを活用
  - 各陣形のステータス補正 (`atkMod`, `defMod`) を適用
- `Squadron` クラスの定義 (`game-data.js`)
  - プロパティ: `id`, `warlordId`, `memberUnitIds`, `formationType`
  - メソッド: `getFormationBonus()` - 現在の陣形による補正値を返す
  - メソッド: `getFormationSlots()` - 現在の向きと陣形に基づき、配下の目標座標を計算 (`calculateFormationTargets` を移植または利用)
- `UnitManager` に部隊管理機能を追加
  - 部隊生成時に `formation.js` のスロット定義に基づいてユニットを配置


### 2. 高さルールの厳密化 (TICKET-004, 005)

**対象ファイル**:
- `scripts/pathfinding.js` (移動コスト)
- `scripts/combat.js` (射程・命中補正)

**変更内容**:
- **移動**: 高さ差2以上は通行不可(コスト無限大)。高さ差1はコスト+1。
- **攻撃**: 高所有利補正（射程+1, ダメージ1.1倍）。低所不利補正（射程-1, ダメージ0.9倍）。

### 3. 戦闘フェイズのループ実装 (TICKET-006)

**対象ファイル**:
- `scripts/main.js`
- `scripts/ai.js` (既存コードの改修)

**変更内容**:
- ORDERフェイズ: 全部隊への命令発行UI
- ACTIONフェイズ: イニシアチブ順に行動解決
- **AIロジックの導入**:
  - `scripts/ai.js` の `selectBestTarget` などを活用し、戦術的な行動決定を実装
  - 高低差や側面攻撃ボーナスを考慮した評価関数を利用
- 勝利条件判定（敵全滅 or ボス撃破）実装

## Verification Plan

### Automated Tests
- コンソールでの単体テスト実行
  - `UnitManager` の部隊生成テスト
  - `Pathfinding` の高さ別コスト計算テスト

### Manual Verification
- カスタムマップ（起伏あり）で移動・攻撃を確認
- 部隊単位での移動命令が機能するか確認
- 敵部隊全滅時にリザルト画面へ遷移するか確認
