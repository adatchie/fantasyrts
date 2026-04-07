## 戦闘システム
## JSの combat.js のコアロジックを移植
class_name CombatSystem
extends RefCounted

signal damage_dealt(attacker: Unit, defender: Unit, dmg: int)
signal unit_died(unit: Unit)
signal plot_succeeded(attacker: Unit, target: Unit)

var map_system: Node = null  # MapSystem参照（地形高さ取得用）

## ダメージ計算式（JSのcombat()から移植）
## sqrt(兵力) × 攻撃力 × 補正 ÷ (防御力 / 15)
func calculate_damage(
	attacker: Unit,
	defender: Unit,
	flanking_allies: int = 0
) -> int:
	var mod: float = 1.0

	# 高所ボーナス
	if map_system != null:
		var ah = map_system.get_height(attacker.x, attacker.y)
		var dh = map_system.get_height(defender.x, defender.y)
		if ah > dh:
			mod *= 1.3

	# 協応攻撃ボーナス（味方が周囲にいるごとに+20%）
	mod += flanking_allies * 0.2

	# 方向補正（背面×2, 側面×1.5）
	var dir_mod = _get_direction_modifier(attacker, defender)

	var raw = sqrt(float(attacker.soldiers)) * float(attacker.final_atk) * mod * dir_mod
	var dmg = int(raw / (float(defender.final_def) / 15.0))
	return max(1, dmg)

## 近接攻撃処理
func process_attack(attacker: Unit, defender: Unit, all_units: Array) -> void:
	var flanking = _count_flanking_allies(attacker, defender, all_units)
	var dmg = calculate_damage(attacker, defender, flanking)

	defender.apply_damage(dmg)
	damage_dealt.emit(attacker, defender, dmg)

	if defender.dead:
		unit_died.emit(defender)

## 調略処理
func process_plot(attacker: Unit, target: Unit) -> bool:
	var success_rate = 30 + (attacker.jin - target.loyalty)
	if randi() % 100 < success_rate:
		target.side = attacker.side
		plot_succeeded.emit(attacker, target)
		return true
	return false

## 射程内かどうか判定
func in_attack_range(attacker: Unit, target: Unit) -> bool:
	var dist = Pathfinding.dist_units(attacker, target)
	return dist <= attacker.attack_range

# --- private ---

func _count_flanking_allies(attacker: Unit, defender: Unit, all_units: Array) -> int:
	var count = 0
	for u in all_units:
		if u == attacker or u.dead or u.side != attacker.side:
			continue
		# 防御者の隣接マスにいる味方をカウント
		var dist = Pathfinding.dist_units(u, defender)
		if dist <= u.size + 1:
			count += 1
	return count

func _get_direction_modifier(attacker: Unit, defender: Unit) -> float:
	# 攻撃者から見た防御者の方向
	var attack_dir = Pathfinding.get_facing_dir(attacker.x, attacker.y, defender.x, defender.y)
	# 防御者の向きと比較
	var facing_diff = abs((attack_dir - defender.dir + 4) % 4)
	match facing_diff:
		0: return 1.0   # 正面
		1: return 1.5   # 側面
		2: return 2.0   # 背面
		3: return 1.5   # 側面
	return 1.0
