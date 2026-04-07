## メインゲームスクリプト（プロトタイプ）
## _draw() で直接描画することでControl/Node2D混在の問題を回避
extends Node2D

# --- 定数 ---
const TILE_W    = 48    # アイソメトリックタイル幅
const TILE_H    = 24    # アイソメトリックタイル高さ
const ORIGIN    = Vector2(640, 180)  # マップ表示の起点
const UNIT_R    = 14.0  # ユニット表示の円半径

# --- ノード参照 ---
@onready var commit_btn:  Button        = $UILayer/HUD/CommitButton
@onready var log_label:   RichTextLabel = $UILayer/HUD/LogPanel/LogLabel
@onready var info_label:  Label         = $UILayer/HUD/InfoPanel/InfoLabel
@onready var turn_label:  Label         = $UILayer/HUD/TurnLabel

# --- システム ---
var turn_manager: TurnManager
var selected_unit: Unit = null

func _ready() -> void:
	turn_manager = TurnManager.new()
	add_child(turn_manager)

	turn_manager.phase_changed.connect(_on_phase_changed)
	turn_manager.turn_started.connect(_on_turn_started)
	turn_manager.action_log.connect(_append_log)
	turn_manager.unit_action_started.connect(func(_u): queue_redraw())
	turn_manager.game_ended.connect(_on_game_ended)

	commit_btn.pressed.connect(_on_commit_pressed)

	_setup_test_scenario()
	queue_redraw()

# -------------------------------------------------------
#  描画
# -------------------------------------------------------

func _draw() -> void:
	_draw_grid()
	_draw_units()

func _draw_grid() -> void:
	var grid_color = Color(0.4, 0.4, 0.4, 0.5)
	var grid_line  = Color(0.55, 0.55, 0.55, 0.7)
	for gy in range(18):
		for gx in range(18):
			var pts = _tile_diamond(gx, gy)
			draw_polygon(pts, PackedColorArray([grid_color, grid_color, grid_color, grid_color]))
			var outline = PackedVector2Array(pts)
			outline.append(pts[0])
			draw_polyline(outline, grid_line, 1.0)

func _draw_units() -> void:
	for unit in turn_manager.units:
		if not unit.is_alive():
			continue
		var pos = _grid_to_screen(unit.x, unit.y)

		var col: Color = unit.color
		if selected_unit == unit:
			col = col.lightened(0.45)
		elif unit.has_acted:
			col = col.darkened(0.35)

		var r = UNIT_R * (1.3 if unit.size >= 2 else 1.0)
		draw_circle(pos, r, col)
		draw_arc(pos, r, 0, TAU, 24, Color.WHITE if selected_unit == unit else Color(1,1,1,0.4), 2.0)

		# 命令アイコン
		var order_type = unit.order.get("type", "")
		if order_type == "ATTACK":
			draw_string(ThemeDB.fallback_font, pos + Vector2(-6, 5), "A", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color.YELLOW)
		elif order_type == "MOVE":
			draw_string(ThemeDB.fallback_font, pos + Vector2(-4, 5), "M", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color.CYAN)

		# ユニット名
		draw_string(ThemeDB.fallback_font, pos + Vector2(-30, r + 14),
			unit.unit_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color.WHITE)

		# 兵力バー
		_draw_soldier_bar(pos, r, unit)

func _draw_soldier_bar(pos: Vector2, r: float, unit: Unit) -> void:
	var max_s = 2000.0 if unit.unit_type == "HEADQUARTERS" else 1200.0
	var ratio = clampf(unit.soldiers / max_s, 0.0, 1.0)
	var bar_w = r * 2.0
	var bar_y = pos.y + r + 3.0
	draw_rect(Rect2(pos.x - r, bar_y, bar_w, 4), Color(0.2, 0.2, 0.2))
	var fill_col = Color.GREEN if ratio > 0.5 else (Color.YELLOW if ratio > 0.25 else Color.RED)
	draw_rect(Rect2(pos.x - r, bar_y, bar_w * ratio, 4), fill_col)

# -------------------------------------------------------
#  座標変換
# -------------------------------------------------------

func _grid_to_screen(gx: int, gy: int) -> Vector2:
	return ORIGIN + Vector2(
		(gx - gy) * TILE_W * 0.5,
		(gx + gy) * TILE_H * 0.5
	)

func _tile_diamond(gx: int, gy: int) -> PackedVector2Array:
	var c = _grid_to_screen(gx, gy)
	var hw = TILE_W * 0.5
	var hh = TILE_H * 0.5
	return PackedVector2Array([
		c + Vector2(0, -hh),
		c + Vector2(hw, 0),
		c + Vector2(0, hh),
		c + Vector2(-hw, 0),
	])

# -------------------------------------------------------
#  入力
# -------------------------------------------------------

func _input(event: InputEvent) -> void:
	if turn_manager.current_phase != TurnManager.Phase.ORDER:
		return
	if not (event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT):
		return

	var mouse_pos = get_global_mouse_position()
	var clicked_unit = _get_unit_at_screen(mouse_pos)

	if clicked_unit == null:
		selected_unit = null
		queue_redraw()
		_update_info_label()
		return

	if selected_unit == null:
		if clicked_unit.side == turn_manager.player_side:
			selected_unit = clicked_unit
	else:
		if clicked_unit.side != turn_manager.player_side:
			selected_unit.order = {"type": "ATTACK", "target_id": clicked_unit.id}
			_append_log("%s → %s に攻撃命令" % [selected_unit.unit_name, clicked_unit.unit_name])
			selected_unit = null
		elif clicked_unit == selected_unit:
			selected_unit = null
		else:
			selected_unit = clicked_unit

	queue_redraw()
	_update_info_label()

func _get_unit_at_screen(pos: Vector2) -> Unit:
	var reversed = turn_manager.units.duplicate()
	reversed.reverse()
	for unit in reversed:
		if not unit.is_alive():
			continue
		var unit_pos = _grid_to_screen(unit.x, unit.y)
		var r = UNIT_R * (1.3 if unit.size >= 2 else 1.0)
		if pos.distance_to(unit_pos) <= r:
			return unit
	return null

# -------------------------------------------------------
#  コールバック
# -------------------------------------------------------

func _on_commit_pressed() -> void:
	if turn_manager.current_phase == TurnManager.Phase.ORDER:
		selected_unit = null
		await turn_manager.commit_turn()
		queue_redraw()
		_update_info_label()

func _on_phase_changed(phase: String) -> void:
	commit_btn.disabled = (phase == "ACTION")
	commit_btn.text = "解決中..." if phase == "ACTION" else "コミット（行動確定）"
	queue_redraw()

func _on_turn_started(t: int) -> void:
	turn_label.text = "ターン %d" % t
	queue_redraw()

func _on_game_ended(winner: String, reason: String) -> void:
	commit_btn.disabled = true
	_append_log("=== ゲーム終了: %s の勝利（%s）===" % [winner, reason])

func _update_info_label() -> void:
	if selected_unit:
		info_label.text = "[%s]\n%s\n兵力: %d\nATK:%d DEF:%d\n命令: %s" % [
			selected_unit.side,
			selected_unit.unit_name,
			selected_unit.soldiers,
			selected_unit.final_atk,
			selected_unit.final_def,
			selected_unit.order.get("type", "なし")
		]
	else:
		info_label.text = "ユニットをクリック→選択\n敵をクリック→攻撃命令"

func _append_log(text: String) -> void:
	log_label.append_text(text + "\n")
	log_label.scroll_to_line(log_label.get_line_count())

# -------------------------------------------------------
#  テストシナリオ
# -------------------------------------------------------

func _setup_test_scenario() -> void:
	var id = 0

	var e_hq = _make_unit(id, "家康本陣", "EAST", 2, 2, "HEADQUARTERS", 2000, 95, 99)
	e_hq.size = 2; e_hq.size_shape = "vertical"
	e_hq.warlord_id = "ieyasu"; e_hq.color = Color(0.2, 0.4, 0.9); e_hq.move_range = 6
	id += 1

	var e1 = _make_unit(id, "福島正則", "EAST", 3, 4, "NORMAL", 1000, 90, 60)
	e1.warlord_id = "ieyasu"; e1.color = Color(0.3, 0.5, 1.0)
	id += 1

	var e2 = _make_unit(id, "加藤清正", "EAST", 1, 4, "NORMAL", 800, 70, 55)
	e2.type = "ARCHER"; e2.attack_range = 5
	e2.warlord_id = "ieyasu"; e2.color = Color(0.5, 0.7, 1.0)
	id += 1

	var w_hq = _make_unit(id, "三成本陣", "WEST", 2, 10, "HEADQUARTERS", 2000, 80, 95)
	w_hq.size = 2; w_hq.size_shape = "vertical"
	w_hq.warlord_id = "mitsunari"; w_hq.color = Color(0.9, 0.2, 0.2); w_hq.move_range = 6
	id += 1

	var w1 = _make_unit(id, "島左近", "WEST", 1, 8, "NORMAL", 1200, 95, 70)
	w1.warlord_id = "mitsunari"; w1.color = Color(1.0, 0.3, 0.3)
	id += 1

	var w2 = _make_unit(id, "大谷吉継", "WEST", 3, 8, "NORMAL", 900, 75, 80)
	w2.warlord_id = "mitsunari"; w2.color = Color(0.9, 0.5, 0.5)
	id += 1

	turn_manager.units = [e_hq, e1, e2, w_hq, w1, w2]

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
