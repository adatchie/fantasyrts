## ターン管理システム
## JSの turn-manager.js から移植
## ORDER（命令）フェーズ → ACTION（解決）フェーズ のサイクルを管理
class_name TurnManager
extends Node

signal phase_changed(phase: String)   # "ORDER" or "ACTION"
signal turn_started(turn: int)
signal action_log(text: String)
signal unit_action_started(unit: Unit)
signal game_ended(winner_side: String, reason: String)

enum Phase { ORDER, ACTION }

var current_phase: Phase = Phase.ORDER
var turn: int = 1
var player_side: String = "EAST"

var units: Array[Unit] = []
var combat_system: CombatSystem
var ai_system: AISystem
var map_system: Node = null

func _ready() -> void:
	combat_system = CombatSystem.new()
	ai_system = AISystem.new()
	combat_system.damage_dealt.connect(_on_damage_dealt)
	combat_system.unit_died.connect(_on_unit_died)
	combat_system.plot_succeeded.connect(_on_plot_succeeded)

## プレイヤーがコミットボタンを押したとき呼ぶ
func commit_turn() -> void:
	if current_phase != Phase.ORDER:
		return

	_log("--- ターン %d 解決開始 ---" % turn)

	# CPU陣形を決定
	for unit in units:
		if unit.side == player_side or not unit.is_alive():
			continue
		if unit.unit_type == "HEADQUARTERS":
			var formation = ai_system.decide_formation(unit, units)
			_apply_formation_to_group(unit.warlord_id, formation)

	# CPU命令を決定
	for unit in units:
		if unit.side == player_side or not unit.is_alive():
			continue
		if unit.order.is_empty():
			ai_system.decide_action(unit, units, map_system)

	current_phase = Phase.ACTION
	phase_changed.emit("ACTION")

	await _resolve_turn()

## 全ユニットの行動を順次解決
func _resolve_turn() -> void:
	var queue = _build_action_queue()

	for unit in queue:
		if not unit.is_alive():
			continue
		unit_action_started.emit(unit)
		await _process_unit(unit)
		await get_tree().create_timer(0.05).timeout  # 微小ウェイト（描画更新余地）

	# 勝利条件チェック
	var player_hq = units.filter(func(u: Unit): return u.side == player_side and u.unit_type == "HEADQUARTERS" and u.is_alive())
	var enemy_hq = units.filter(func(u: Unit): return u.side != player_side and u.unit_type == "HEADQUARTERS" and u.is_alive())

	if player_hq.is_empty():
		game_ended.emit("ENEMY", "本陣を落とされた")
		return
	if enemy_hq.is_empty():
		game_ended.emit(player_side, "敵本陣を攻略した")
		return

	# 次のターンへ
	turn += 1
	for unit in units:
		unit.has_acted = false
		unit.order = {}

	current_phase = Phase.ORDER
	phase_changed.emit("ORDER")
	turn_started.emit(turn)
	_log("--- ターン %d 開始 ---" % turn)

## ユニット1体の行動処理
func _process_unit(unit: Unit) -> void:
	var order_type = unit.order.get("type", "")
	if order_type == "":
		return

	match order_type:
		"ATTACK":
			var target = _find_unit(unit.order.get("target_id", -1))
			if target and target.is_alive() and combat_system.in_attack_range(unit, target):
				_log("%s が %s を攻撃" % [unit.unit_name, target.unit_name])
				combat_system.process_attack(unit, target, units)
			elif target and target.is_alive():
				# 射程外になっていたら移動
				_log("%s は %s に接近" % [unit.unit_name, target.unit_name])
				_move_toward(unit, target.x, target.y)

		"MOVE":
			var tx = unit.order.get("target_x", unit.x)
			var ty = unit.order.get("target_y", unit.y)
			_log("%s が移動" % unit.unit_name)
			_move_toward(unit, tx, ty)
			# 移動後に射程内なら攻撃
			var target_id = unit.order.get("target_id", -1)
			if target_id >= 0:
				var target = _find_unit(target_id)
				if target and target.is_alive() and combat_system.in_attack_range(unit, target):
					combat_system.process_attack(unit, target, units)

		"PLOT":
			var target = _find_unit(unit.order.get("target_id", -1))
			if target and target.is_alive():
				_log("%s が %s に調略を試みる" % [unit.unit_name, target.unit_name])
				combat_system.process_plot(unit, target)

	unit.has_acted = true

## 行動順序キューの構築
## JSのロジックに準拠: 兵士数が少ない順に並べる（弱い部隊から動く）
func _build_action_queue() -> Array:
	var queue = units.filter(func(u: Unit): return u.is_alive())
	queue.sort_custom(func(a: Unit, b: Unit): return a.soldiers < b.soldiers)
	return queue

func _move_toward(unit: Unit, tx: int, ty: int) -> void:
	if unit.x == tx and unit.y == ty:
		return
	var path = Pathfinding.find_path(unit.x, unit.y, tx, ty, units, unit, map_system)
	if path.size() > 1:
		# move_range分だけ進む
		var steps = min(unit.move_range, path.size() - 1)
		unit.x = path[steps].x
		unit.y = path[steps].y
		unit.dir = Pathfinding.get_facing_dir(unit.x, unit.y, tx, ty)

func _apply_formation_to_group(warlord_id: String, formation: String) -> void:
	for unit in units:
		if unit.warlord_id == warlord_id:
			unit.set_formation(formation)

func _find_unit(id: int) -> Unit:
	for unit in units:
		if unit.id == id:
			return unit
	return null

func _on_damage_dealt(attacker: Unit, defender: Unit, dmg: int) -> void:
	_log("  → %s に %d ダメージ（残 %d）" % [defender.unit_name, dmg, defender.soldiers])

func _on_unit_died(unit: Unit) -> void:
	_log("  ★ %s が壊滅" % unit.unit_name)

func _on_plot_succeeded(attacker: Unit, target: Unit) -> void:
	_log("  ★ %s が寝返った！" % target.unit_name)

func _log(text: String) -> void:
	action_log.emit(text)
	print(text)
