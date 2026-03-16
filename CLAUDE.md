# FantasyRTS プロジェクト

## プロジェクト概要
ブラウザで動作するファンタジー戦略RTSゲーム。Three.jsベースの3D描画、マップエディタ、建物デザイナーを含む。

## 主要ファイル
- `index.html` — メインゲーム本体
- `map-editor.html` — マップエディタ
- `building-designer.html` — 建物デザイナー
- `sekigahara.html` — 関ヶ原マップ（別シナリオ）
- `head_combat_tmp.js` — 戦闘システム（作業中）

## scripts/ 構成
- `main.js` — エントリーポイント
- `combat.js` — 戦闘ロジック
- `formation.js` — フォーメーション
- `pathfinding.js` — 経路探索
- `rendering.js` / `rendering3d.js` — 描画
- `ai.js` — AI
- `map.js` / `map-registry.js` / `map-repository.js` — マップ管理
- `terrain-manager.js` / `texture-generator.js` — 地形・テクスチャ
- `stage-loader.js` — ステージ読み込み
- `managers/` — dialogue, input, turn の各マネージャー
- `game/` — building-placement, input-controller, ui-manager, unit-spawner, validator
- `editor/` — building-editor, gate-generator
- `tools/` — 各種生成スクリプト（開発用）
- `data/` — **ステージデータ本体（重要）**
  - `stages/` — ステージ定義
  - `maps/` — マップデータ
  - `attachments/` — アタッチメント定義
  - `castle_gate.js` — 城門データ

## 技術スタック
- Three.js（3D描画）
- Vanilla JS（フレームワークなし）
- Node.js（画像変換・生成スクリプトのみ）

## 読み込み禁止（触らない）
- `node_modules/`
- `assets/`（バイナリ画像・音声）
- `secrets/`
- `claude-mem/`（セッション記録ツール、このプロジェクトと無関係）
- `portraits/` / `sounds/` / `sprites/`
- `scripts/tools/`（開発用生成スクリプト、通常作業では不要）

## 参照不要ファイル（古いバージョン・ゴミ）
- `*_backup.html` / `*_clean_backup.html`
- `fix_rendering3d_v2.js` 〜 `fix_rendering3d_v4.js`
- `rendering3d.js.backup2`
- `scripts/temp_tail.txt`
- `tmpclaude-*-cwd`
- `diff.patch` / `nul`

## 禁止事項

### 破壊的操作は必ず事前確認
以下は**確認なしで絶対に実行しない**：
- `git checkout` / `git restore` / `git reset` / `git clean`
- `rm` を使うファイル削除（ワイルドカード含む）
- 既存ファイルの全体上書き
- 正規表現による一括置換

確認時は**影響範囲と失われる可能性のある変更**を必ず明示する。

### デバッグは許可制
デバッグが必要な場合は根拠を日本語で説明してから許可を得る。
許可後は最後まで通して実行（途中確認不要）。

## 詳細ドキュメント（必要時のみ参照）
- システム仕様全般 → `docs/SYSTEM_SPECIFICATION.md`
- 現在のタスク・進捗 → `docs/TASKS.md` / `docs/STATUS_AND_PLAN.md`
- 実装計画 → `docs/implementation_plan.md`
- スプライト仕様 → `docs/SPRITE_SPECIFICATION.md`
- テクスチャ仕様 → `docs/TEXTURE_SPECIFICATION.md`
- 建物データスキーマ → `docs/BUILDING_DATA_SCHEMA.md`
- フォーメーションシステム → `FORMATION_SYSTEM_COMPLETE.md`
- Three.js移行メモ → `THREE_JS_MIGRATION_GUIDE.md`
