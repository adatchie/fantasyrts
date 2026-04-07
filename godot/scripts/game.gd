## メインゲームスクリプト（プロトタイプ）
## 描画はすべてプログラムで行う（スプライト・アイソメトリックは後回し）
extends Node2D

# --- 定数 ---
const TILE_W = 24   # 表示タイルの幅（アイソメトリック変換後）
const TILE_H = 12   # 表示タイルの高さ（アイソメトリック変換後）
const ORIGIN = Vector2(640, 200)  # マップ左上のスクリーン座標

# --- ノード参照 ---
@onready var world_layer: Node2D = $WorldLayer
@onready var ui_layer: CanvasLayer = $UILayer
@onready var hud: Control = $UILayer/HUD
@onready var commit_btn: Button = $UILayer/HUD/CommitButton
@onready var log_label: RichTextLabel = $UILayer/HUD/LogLabel
@onready var info_label: Label = $UILayer/HUD/InfoLabel
@onready var turn_label: Label = $UILayer/HUD/TurnLabel

# --- システム ---
var turn_manager: TurnManager
var selected_unit: Unit = null
var unit_sprites: Dictionary = {}  # unit.id -> Sprite2D (プロト用の色四角形)

func _ready() -> void:
	# TurnManagerはNodeなのでシーンツリーに追加
	turn_manager = TurnManager.new()
	add_child(turn_manager)

	# シグナル接続
	turn_manager.phase_changed.connect(_on_phase_changed)
	turn_manager.turn_started.connect(_on_turn_started)
	turn_manager.action_log.connect(_append_log)
	turn_manager.unit_action_started.connect(_on_unit_action_started)
	turn_manager.game_ended.connect(_on_game_ended)

	commit_btn.pressed.connect(_on_commit_pressed)

	# テストユニットを生成してゲーム開始
	_setup_test_scenario()
	_refresh_display()

## テストシナリオ: 東西2勢力が向かい合う
func _setup_test_scenario() -> void:
	var id = 0

	# EAST側（プレイヤー）
	var east_hq = _make_unit(id, "家康本陣", "EAST", 5, 5, "HEADQUARTERS", 2000, 95, 99)
	east_hq.size = 2; east_hq.size_shape = "vertical"; east_hq.warlord_id = "ieyasu"
	east_hq.color = Color(0.2, 0.4, 0.9); east_hq.move_range = 6
	id += 1

	var east1 = _make_unit(id, "福島正則", "EAST", 6, 7, "NORMAL", 1000, 90, 60)
	east1.warlord_id = "ieyasu"; east1.color = Color(0.3, 0.5, 1.0)
	id += 1

	var east2 = _make_unit(id, "加藤清正（弓）", "EAST", 4, 7, "NORMAL", 800, 70, 55)
	east2.type = "ARCHER"; east2.attack_range = 5; east2.warlord_id = "ieyasu"
	east2.color = Color(0.5, 0.7, 1.0)
	id += 1

	# WEST側（CPU）
	var west_hq = _make_unit(id, "三成本陣", "WEST", 5, 12, "HEADQUARTERS", 2000, 80, 95)
	west_hq.size = 2; west_hq.size_shape = "vertical"; west_hq.warlord_id = "mitsunari"
	west_hq.color = Color(0.9, 0.2, 0.2); west_hq.move_range = 6
	id += 1

	var west1 = _make_unit(id, "島左近", "WEST", 4, 10, "NORMAL", 1200, 95, 70)
	west1.warlord_id = "mitsunari"; west1.color = Color(1.0, 0.3, 0.3)
	id += 1

	var west2 = _make_unit(id, "大谷吉継", "WEST", 6, 10, "NORMAL", 900, 75, 80)
	west2.warlord_id = "mitsunari"; west2.color = Color(0.9, 0.5, 0.5)
	id += 1

	turn_manager.units = [east_hq, east1, east2, west_hq, west1, west2]
	_build_unit_sprites()

func _make_unit(
	id: int, name: String, side: String,
	x: int, y: int, unit_type: String,
	soldiers: int, atk: int, def_val: int
) -> Unit:
	var u = Unit.new()
	u.id = id; u.unit_name = name; u.side = side
	u.x = x; u.y = y; u.unit_type = unit_type
	u.soldiers = soldiers; u.atk = atk; u.def = def_val
	u.final_atk = atk; u.final_def = def_val
	return u

## ユニットを色付き四角形として描画（プロトタイプ）
func _build_unit_sprites() -> void:
	for child in world_layer.get_children():
		child.queue_free()
	unit_sprites.clear()

	for unit in turn_manager.units:
		var rect = ColorRect.new()
		rect.size = Vector2(TILE_W * unit.size, TILE_H * unit.size)
		rect.color = unit.color
		rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
		world_layer.add_child(rect)
		unit_sprites[unit.id] = rect

## ユニット位置・表示を更新
func _refresh_display() -> void:
	for unit in turn_manager.units:
		if not unit_sprites.has(unit.id):
			continue
		var rect: ColorRect = unit_sprites[unit.id]
		rect.visible = unit.is_alive()
		if unit.is_alive():
			var screen_pos = _grid_to_screen(unit.x, unit.y)
			rect.position = screen_pos - rect.size / 2.0

			# 選択中は明るく表示
			if selected_unit == unit:
				rect.color = unit.color.lightened(0.4)
			elif unit.has_acted:
				rect.color = unit.color.darkened(0.3)
			else:
				rect.color = unit.color

	_update_info_label()

## アイソメトリック変換（グリッド座標 → スクリーン座標）
func _grid_to_screen(gx: int, gy: int) -> Vector2:
	return ORIGIN + Vector2(
		(gx - gy) * TILE_W / 2.0,
		(gx + gy) * TILE_H / 2.0
	)

func _input(event: InputEvent) -> void:
	if turn_manager.current_phase != TurnManager.Phase.ORDER:
		return

	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var mouse_pos = get_global_mouse_position()
		var clicked_unit = _get_unit_at_screen(mouse_pos)

		if clicked_unit == null:
			selected_unit = null
			_refresh_display()
			return

		if selected_unit == null:
			# ユニット選択
			if clicked_unit.side == turn_manager.player_side:
				selected_unit = clicked_unit
				_refresh_display()
		else:
			# 命令設定
			if clicked_unit.side != turn_manager.player_side and selected_unit != null:
				# 敵クリック → 攻撃命令
				selected_unit.order = {"type": "ATTACK", "target_id": clicked_unit.id}
				_append_log("%s → %s に攻撃命令" % [selected_unit.unit_name, clicked_unit.unit_name])
				selected_unit = null
				_refresh_display()
			elif clicked_unit == selected_unit:
				# 同じユニットを再クリック → 選択解除
				selected_unit = null
				_refresh_display()
			else:
				# 別の味方を選択
				selected_unit = clicked_unit
				_refresh_display()

func _get_unit_at_screen(pos: Vector2) -> Unit:
	for unit in turn_manager.units:
		if not unit.is_alive():
			continue
		if not unit_sprites.has(unit.id):
			continue
		var rect: ColorRect = unit_sprites[unit.id]
		if Rect2(rect.position, rect.size).has_point(pos):
			return unit
	return null

func _on_commit_pressed() -> void:
	if turn_manager.current_phase == TurnManager.Phase.ORDER:
		selected_unit = null
		await turn_manager.commit_turn()
		_refresh_display()

func _on_phase_changed(phase: String) -> void:
	commit_btn.disabled = (phase == "ACTION")
	commit_btn.text = "解決中..." if phase == "ACTION" else "コミット（行動確定）"
	_refresh_display()

func _on_turn_started(t: int) -> void:
	turn_label.text = "ターン %d" % t
	_refresh_display()

func _on_unit_action_started(_unit: Unit) -> void:
	_refresh_display()

func _on_game_ended(winner: String, reason: String) -> void:
	commit_btn.disabled = true
	_append_log("=== ゲーム終了: %s の勝利（%s）===" % [winner, reason])

func _update_info_label() -> void:
	if selected_unit:
		info_label.text = "%s [%s]\n兵力: %d\nATK:%d DEF:%d\n命令: %s" % [
			selected_unit.unit_name,
			selected_unit.type,
			selected_unit.soldiers,
			selected_unit.final_atk,
			selected_unit.final_def,
			selected_unit.order.get("type", "なし")
		]
	else:
		info_label.text = "ユニットをクリックして選択\n敵をクリックして攻撃命令"

func _append_log(text: String) -> void:
	log_label.append_text(text + "\n")
	log_label.scroll_to_line(log_label.get_line_count())
