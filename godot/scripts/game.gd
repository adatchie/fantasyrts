## FantasyRTS プロトタイプ
## UIをコードで生成し、@onreadyのパス依存を排除
extends Node2D

# --- 定数 ---
const TILE_W = 48
const TILE_H = 24
const ORIGIN = Vector2(400, 150)
const UNIT_R = 14.0

# --- UI ノード（コードで生成） ---
var commit_btn:  Button
var log_label:   RichTextLabel
var info_label:  Label
var turn_label:  Label

# --- システム ---
var turn_manager: TurnManager
var selected_unit: Unit = null

func _ready() -> void:
	print("[Game] _ready() 開始")
	_build_ui()

	turn_manager = TurnManager.new()
	add_child(turn_manager)

	turn_manager.phase_changed.connect(_on_phase_changed)
	turn_manager.turn_started.connect(_on_turn_started)
	turn_manager.action_log.connect(_append_log)
	turn_manager.unit_action_started.connect(func(_u): queue_redraw())
	turn_manager.game_ended.connect(_on_game_ended)

	commit_btn.pressed.connect(_on_commit_pressed)

	_setup_test_scenario()
	print("[Game] ユニット数: %d" % turn_manager.units.size())
	queue_redraw()
	print("[Game] _ready() 完了")

# -------------------------------------------------------
#  UI生成（コードで作ることでシーンファイル依存を排除）
# -------------------------------------------------------

func _build_ui() -> void:
	var ui = CanvasLayer.new()
	add_child(ui)

	# ターンラベル（右上）
	turn_label = Label.new()
	turn_label.text = "ターン 1"
	turn_label.position = Vector2(1100, 10)
	ui.add_child(turn_label)

	# コミットボタン（左中）
	commit_btn = Button.new()
	commit_btn.text = "コミット（行動確定）"
	commit_btn.position = Vector2(10, 340)
	commit_btn.size = Vector2(240, 40)
	ui.add_child(commit_btn)

	# ユニット情報（左下）
	var info_bg = PanelContainer.new()
	info_bg.position = Vector2(10, 540)
	info_bg.size = Vector2(240, 160)
	ui.add_child(info_bg)
	info_label = Label.new()
	info_label.text = "ユニットをクリック→選択\n敵をクリック→攻撃命令"
	info_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	info_bg.add_child(info_label)

	# ログパネル（右側）
	var log_bg = PanelContainer.new()
	log_bg.position = Vector2(960, 10)
	log_bg.size = Vector2(310, 500)
	ui.add_child(log_bg)
	log_label = RichTextLabel.new()
	log_label.scroll_following = true
	log_label.custom_minimum_size = Vector2(300, 480)
	log_bg.add_child(log_label)

# -------------------------------------------------------
#  描画
# -------------------------------------------------------

func _draw() -> void:
	_draw_grid()
	_draw_units()

func _draw_grid() -> void:
	var fill = Color(0.35, 0.35, 0.38, 0.6)
	var edge = Color(0.6, 0.6, 0.65, 0.8)
	for gy in range(16):
		for gx in range(16):
			var pts = _tile_diamond(gx, gy)
			draw_polygon(pts, PackedColorArray([fill, fill, fill, fill]))
			var ring = PackedVector2Array(pts)
			ring.append(pts[0])
			draw_polyline(ring, edge, 1.0)

func _draw_units() -> void:
	if turn_manager == null:
		return
	for unit in turn_manager.units:
		if not unit.is_alive():
			continue
		var pos = _grid_to_screen(unit.x, unit.y)
		var r = UNIT_R * (1.4 if unit.size >= 2 else 1.0)

		# 本体の色
		var col: Color = unit.color
		if selected_unit == unit:
			col = col.lightened(0.5)
		elif unit.has_acted:
			col = col.darkened(0.4)

		draw_circle(pos, r, col)
		var ring_col = Color.WHITE if selected_unit == unit else Color(1, 1, 1, 0.5)
		draw_arc(pos, r, 0, TAU, 24, ring_col, 2.0)

		# 命令マーク
		var ot = unit.order.get("type", "")
		if ot == "ATTACK":
			draw_string(ThemeDB.fallback_font, pos + Vector2(-5, 5), "A", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color.YELLOW)
		elif ot == "MOVE":
			draw_string(ThemeDB.fallback_font, pos + Vector2(-5, 5), "M", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color.CYAN)

		# 名前
		draw_string(ThemeDB.fallback_font, pos + Vector2(-28, r + 14),
			unit.unit_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color.WHITE)

		# 兵力バー
		var max_s = 2000.0 if unit.unit_type == "HEADQUARTERS" else 1200.0
		var ratio = clampf(unit.soldiers / max_s, 0.0, 1.0)
		var bw = r * 2.0
		var by = pos.y + r + 3.0
		draw_rect(Rect2(pos.x - r, by, bw, 4), Color(0.15, 0.15, 0.15))
		var bc = Color.GREEN if ratio > 0.5 else (Color.YELLOW if ratio > 0.25 else Color.RED)
		draw_rect(Rect2(pos.x - r, by, bw * ratio, 4), bc)

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
	if turn_manager == null or turn_manager.current_phase != TurnManager.Phase.ORDER:
		return
	if not (event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT):
		return

	var mp = get_global_mouse_position()
	var clicked = _unit_at(mp)

	if clicked == null:
		selected_unit = null
	elif selected_unit == null:
		if clicked.side == turn_manager.player_side:
			selected_unit = clicked
	elif clicked.side != turn_manager.player_side:
		selected_unit.order = {"type": "ATTACK", "target_id": clicked.id}
		_append_log("%s → %s に攻撃命令" % [selected_unit.unit_name, clicked.unit_name])
		selected_unit = null
	elif clicked == selected_unit:
		selected_unit = null
	else:
		selected_unit = clicked

	queue_redraw()
	_update_info()

func _unit_at(pos: Vector2) -> Unit:
	for unit in turn_manager.units:
		if not unit.is_alive():
			continue
		var r = UNIT_R * (1.4 if unit.size >= 2 else 1.0)
		if pos.distance_to(_grid_to_screen(unit.x, unit.y)) <= r:
			return unit
	return null

# -------------------------------------------------------
#  コールバック
# -------------------------------------------------------

func _on_commit_pressed() -> void:
	if turn_manager.current_phase == TurnManager.Phase.ORDER:
		selected_unit = null
		commit_btn.disabled = true
		await turn_manager.commit_turn()
		queue_redraw()
		_update_info()

func _on_phase_changed(phase: String) -> void:
	commit_btn.disabled = (phase == "ACTION")
	commit_btn.text = "解決中..." if phase == "ACTION" else "コミット（行動確定）"
	queue_redraw()

func _on_turn_started(t: int) -> void:
	turn_label.text = "ターン %d" % t
	queue_redraw()

func _on_game_ended(winner: String, reason: String) -> void:
	commit_btn.disabled = true
	_append_log("=== %s の勝利（%s）===" % [winner, reason])

func _update_info() -> void:
	if selected_unit:
		info_label.text = "[%s] %s\n兵力: %d\nATK:%d DEF:%d\n命令: %s" % [
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
	print(text)
	if log_label:
		log_label.append_text(text + "\n")

# -------------------------------------------------------
#  テストシナリオ
# -------------------------------------------------------

func _setup_test_scenario() -> void:
	var units: Array[Unit] = []
	var id = 0

	# EAST（プレイヤー・青系）
	var e_hq = _mk(id, "家康本陣", "EAST", 2, 2, "HEADQUARTERS", 2000, 95, 99, Color(0.2, 0.4, 0.9))
	e_hq.size = 2; e_hq.size_shape = "vertical"; e_hq.move_range = 6; id += 1

	var e1 = _mk(id, "福島正則", "EAST", 3, 4, "NORMAL", 1000, 90, 60, Color(0.3, 0.55, 1.0)); id += 1
	var e2 = _mk(id, "加藤清正", "EAST", 1, 4, "NORMAL", 800, 70, 55, Color(0.5, 0.75, 1.0))
	e2.type = "ARCHER"; e2.attack_range = 5; id += 1

	# WEST（CPU・赤系）
	var w_hq = _mk(id, "三成本陣", "WEST", 2, 10, "HEADQUARTERS", 2000, 80, 95, Color(0.9, 0.2, 0.2))
	w_hq.size = 2; w_hq.size_shape = "vertical"; w_hq.move_range = 6; id += 1

	var w1 = _mk(id, "島左近", "WEST", 1, 8, "NORMAL", 1200, 95, 70, Color(1.0, 0.3, 0.3)); id += 1
	var w2 = _mk(id, "大谷吉継", "WEST", 3, 8, "NORMAL", 900, 75, 80, Color(0.9, 0.5, 0.5)); id += 1

	units.assign([e_hq, e1, e2, w_hq, w1, w2])
	turn_manager.units = units

func _mk(id: int, name: String, side: String, x: int, y: int,
		unit_type: String, soldiers: int, atk: int, def_v: int, col: Color) -> Unit:
	var u = Unit.new()
	u.id = id; u.unit_name = name; u.side = side
	u.x = x; u.y = y; u.unit_type = unit_type
	u.soldiers = soldiers; u.atk = atk; u.def = def_v
	u.final_atk = atk; u.final_def = def_v
	u.color = col
	return u
