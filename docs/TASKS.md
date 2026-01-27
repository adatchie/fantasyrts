# Fantasy RTS - タスク管理

**最終更新**: 2026-01-24

## 運用ルール

### 複雑度ラベル
| ラベル | 説明 | 担当 |
|---|---|---|
| 🟢 `easy` | 単純な実装・定数追加・既存パターンの複製 | 低コストAI (GitHub Actions) |
| 🟡 `medium` | 既存コードの理解必要・ロジック変更 | 低コストAI + Claudeレビュー |
| 🔴 `hard` | 設計判断・複数ファイル連携・新機能 | Claude直接実装 |

---

## Phase 0: 緊急対応

### TICKET-000: マップデータの永続化対応 (緊急) ✅完了
- **複雑度**: 🟡 medium
- **完了日**: 2026-01-24
- **実装内容**:
  - `map-editor.html` の保存UIを改善し、JSONファイル読込機能を追加

---

## Phase 1: バトル通しプレイ

### TICKET-001: 古いbuildTerrainFromMapData削除 ✅完了
- **複雑度**: 🟢 easy
- **対象**: `scripts/rendering3d.js`
- **完了日**: 2026-01-24

### TICKET-002: 部隊データ構造の定義 ✅完了
- **複雑度**: 🔴 hard
- **対象**: `scripts/constants.js`, `scripts/game-data.js`
- **受け入れ条件**:
  - [x] `Squadron` データ構造定義（1部隊=最大30ユニット）
  - [x] 指揮官ユニット1体必須
  - [x] 部隊全体ステータス集計メソッド

### TICKET-003: UnitManager部隊管理機能 ✅完了
- **複雑度**: 🟡 medium
- **依存**: TICKET-002
- **対象**: `scripts/unit-manager.js`
- **受け入れ条件**:
  - [x] `createSquadron(config)` 追加
  - [x] `getSquadronById(id)` 追加
  - [x] 既存 `getUnitsByWarlordId` と互換性維持

### TICKET-004: 高さルール - 移動コスト ✅完了
- **複雑度**: 🟡 medium
- **対象**: `scripts/pathfinding.js`
- **受け入れ条件**:
  - [x] 高さ差1: コスト+1
  - [x] 高さ差2以上: 移動不可
  - [x] 下り: コスト変化なし

### TICKET-005: 高さルール - 攻撃射程 ✅完了
- **複雑度**: 🟡 medium
- **対象**: `scripts/combat.js`, `scripts/attack-patterns.js`
- **受け入れ条件**:
  - [x] 高所から攻撃: 射程+1
  - [x] 低所から攻撃: 射程-1（最低1）

### TICKET-006: 戦闘フェイズ通しプレイ ✅完了
- **複雑度**: 🔴 hard
- **依存**: TICKET-003, TICKET-004, TICKET-005
- **対象**: `scripts/main.js`, `scripts/combat.js`
- **受け入れ条件**:
  - [x] ORDER → ACTION 2フェイズ動作
  - [x] 複数部隊同時行動
  - [x] 勝敗判定

---

## Phase 2: ユニット種別

### TICKET-010: 兵種別ステータス定義
- **複雑度**: 🟢 easy
- **対象**: `scripts/constants.js`
- **受け入れ条件**:
  - [ ] 各兵種の移動速度、攻撃範囲、攻撃力、防御力定義

### TICKET-011: 兵種別移動速度反映
- **複雑度**: 🟢 easy
- **依存**: TICKET-010
- **対象**: `scripts/unit-manager.js`

### TICKET-012: 兵種別攻撃範囲反映
- **複雑度**: 🟡 medium
- **依存**: TICKET-010
- **対象**: `scripts/attack-patterns.js`, `scripts/combat.js`

### TICKET-013: スプライト仕様策定
- **複雑度**: 🔴 hard
- **対象**: `docs/SPRITE_SPECIFICATION.md` (新規)

### TICKET-014: スプライト生成スクリプト
- **複雑度**: 🟡 medium
- **依存**: TICKET-013
- **対象**: `scripts/tools/generate_sprites.js` (新規)

---

## 完了済み

| チケット | 完了日 |
|---|---|
| TICKET-001 | 2026-01-24 |
