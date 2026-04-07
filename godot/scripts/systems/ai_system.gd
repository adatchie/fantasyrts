## AIシステム
## JSの ai.js から移植
class_name AISystem
extends RefCounted

## ユニット1体の行動を決定してorderに書き込む
func decide_action(unit: Unit, all_units: Array, map_system: Node) -> void:
	if unit.unit_type == "HEADQUARTERS":
		_decide_hq_action(unit, all_units, map_system)
		return

	var enemies = all_units.filter(func(u: Unit): return u.side != unit.side and u.is_alive())
	if enemies.is_empty():
		return

	# 調略を検討（jin >= 75）
	if unit.jin >= 75:
		var plot_target = _consider_plot(unit, enemies)
		if plot_target:
			unit.order = {"type": "PLOT", "target_id": plot_target.id}
			return

	# 最良の攻撃対象を選択
	var target = select_best_target(unit, enemies, all_units, map_system)
	if target == null:
		return

	var dist = Pathfinding.dist_units(unit, target)
	if dist <= unit.attack_range:
		unit.order = {"type": "ATTACK", "target_id": target.id}
	else:
		# 目標に向けて移動
		unit.order = {
			"type": "MOVE",
			"target_x": target.x,
			"target_y": target.y,
			"target_id": target.id  # 移動後に攻撃できれば攻撃
		}

## 最良の攻撃対象を評価スコアで選択
func select_best_target(unit: Unit, enemies: Array, all_units: Array, map_system: Node) -> Unit:
	var best_score = -INF
	var best: Unit = null

	for enemy in enemies:
		var score = _evaluate_target(unit, enemy, all_units, map_system)
		if score > best_score:
			best_score = score
			best = enemy

	return best

## 陣形決定
func decide_formation(hq_unit: Unit, all_units: Array) -> String:
	if hq_unit.soldiers <= 500:
		return "GYORIN"
	if hq_unit.soldiers <= 800:
		return "KAKUYOKU"

	var friendly_soldiers = 0
	var enemy_soldiers = 0
	for u in all_units:
		if not u.is_alive():
			continue
		if u.side == hq_unit.side:
			friendly_soldiers += u.soldiers
		else:
			enemy_soldiers += u.soldiers

	var ratio = float(friendly_soldiers) / max(float(enemy_soldiers), 1.0)
	if ratio >= 1.5:
		return "HOKO"
	elif ratio <= 0.67:
		return "GYORIN"
	return "KAKUYOKU"

# --- private ---

func _evaluate_target(unit: Unit, enemy: Unit, all_units: Array, map_system: Node) -> float:
	var score = 0.0
	var dist = Pathfinding.dist_units(unit, enemy)

	score += (50.0 - dist) * 2.0                        # 近いほど高得点
	score += (10000.0 - enemy.soldiers) / 100.0          # 兵力が少ないほど高得点

	# 地形高さ優位
	if map_system != null:
		var uh = map_system.get_height(unit.x, unit.y)
		var eh = map_system.get_height(enemy.x, enemy.y)
		if uh > eh:
			score += 30.0

	# 協応攻撃できる味方の数
	var allies = all_units.filter(func(u: Unit):
		return u.side == unit.side and u != unit and u.is_alive()
			and Pathfinding.dist_units(u, enemy) <= u.size + 1
	)
	score += allies.size() * 20.0

	# 本陣・大型ユニットは優先
	if enemy.size >= 2:
		score += 50.0

	# 忠誠度が低い敵（調略向き）は攻撃優先度を下げる
	if enemy.loyalty < 70:
		score -= 30.0

	return score

func _consider_plot(unit: Unit, enemies: Array) -> Unit:
	for enemy in enemies:
		var success_rate = 30 + (unit.jin - enemy.loyalty)
		if success_rate >= 50:
			return enemy
	return null

func _decide_hq_action(hq: Unit, all_units: Array, map_system: Node) -> void:
	var enemies = all_units.filter(func(u: Unit): return u.side != hq.side and u.is_alive())
	if enemies.is_empty():
		return

	# 本陣は近くに敵がいたら攻撃、それ以外は待機
	for enemy in enemies:
		var dist = Pathfinding.dist_units(hq, enemy)
		if dist <= 5:
			if dist <= hq.attack_range:
				hq.order = {"type": "ATTACK", "target_id": enemy.id}
			else:
				hq.order = {"type": "MOVE", "target_x": enemy.x, "target_y": enemy.y}
			return
	# 待機
	hq.order = {}
