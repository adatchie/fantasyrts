## 経路探索システム
## JSの pathfinding.js から移植（A*アルゴリズム）
class_name Pathfinding
extends RefCounted

const MAP_W = 70
const MAP_H = 70

## A*経路探索
## 戻り値: Vector2iの配列（スタート含む）。到達不可なら空配列。
static func find_path(
	sx: int, sy: int,
	gx: int, gy: int,
	units: Array,
	moving_unit: Unit,
	map_system: Node
) -> Array[Vector2i]:
	var open_set: Array = []
	var closed_set: Dictionary = {}
	var came_from: Dictionary = {}
	var g_score: Dictionary = {}

	var start_key = _key(sx, sy)
	g_score[start_key] = 0.0
	open_set.append({"x": sx, "y": sy, "f": _heuristic(sx, sy, gx, gy)})

	# ユニット占有マップを事前構築（高速化）
	var unit_map: Dictionary = {}
	for u in units:
		if u == moving_unit or u.dead:
			continue
		for tile in u.get_occupied_tiles():
			unit_map[_key(tile.x, tile.y)] = u

	while not open_set.is_empty():
		open_set.sort_custom(func(a, b): return a.f < b.f)
		var current = open_set.pop_front()
		var cx: int = current.x
		var cy: int = current.y
		var ck: String = _key(cx, cy)

		if cx == gx and cy == gy:
			return _reconstruct_path(came_from, cx, cy)

		if closed_set.has(ck):
			continue
		closed_set[ck] = true

		for d in [[0, -1], [1, 0], [0, 1], [-1, 0]]:
			var nx: int = cx + d[0]
			var ny: int = cy + d[1]
			if nx < 0 or nx >= MAP_W or ny < 0 or ny >= MAP_H:
				continue
			var nk: String = _key(nx, ny)
			if closed_set.has(nk):
				continue

			var move_cost: float = 1.0
			if map_system != null:
				move_cost = map_system.get_move_cost(cx, cy, nx, ny, moving_unit.can_fly if moving_unit else false)
			if move_cost == INF:
				continue

			# 敵ユニット通過コスト
			if unit_map.has(nk):
				var blocker: Unit = unit_map[nk]
				if moving_unit and blocker.side != moving_unit.side:
					move_cost += 5.0

			var tentative_g: float = g_score.get(ck, INF) + move_cost
			if tentative_g < g_score.get(nk, INF):
				came_from[nk] = [cx, cy]
				g_score[nk] = tentative_g
				var new_f: float = tentative_g + _heuristic(nx, ny, gx, gy)

				var found_in_open = false
				for node in open_set:
					if node.x == nx and node.y == ny:
						node.f = new_f
						found_in_open = true
						break
				if not found_in_open:
					open_set.append({"x": nx, "y": ny, "f": new_f})

	return []  # 到達不可

## 移動可能タイルの列挙
static func get_reachable_tiles(
	sx: int, sy: int,
	max_move: int,
	map_system: Node,
	can_fly: bool = false
) -> Array[Vector2i]:
	var costs: Dictionary = {}
	var queue: Array = [{"x": sx, "y": sy, "cost": 0.0}]

	while not queue.is_empty():
		queue.sort_custom(func(a, b): return a.cost < b.cost)
		var cur = queue.pop_front()
		var ck = _key(cur.x, cur.y)

		if costs.has(ck) and costs[ck] <= cur.cost:
			continue
		costs[ck] = cur.cost

		for d in [[0, -1], [1, 0], [0, 1], [-1, 0]]:
			var nx: int = cur.x + d[0]
			var ny: int = cur.y + d[1]
			if nx < 0 or nx >= MAP_W or ny < 0 or ny >= MAP_H:
				continue
			var move_cost: float = 1.0
			if map_system != null:
				move_cost = map_system.get_move_cost(cur.x, cur.y, nx, ny, can_fly)
			if move_cost == INF:
				continue
			var new_cost: float = cur.cost + move_cost
			if new_cost <= max_move:
				var nk = _key(nx, ny)
				if not costs.has(nk) or costs[nk] > new_cost:
					queue.append({"x": nx, "y": ny, "cost": new_cost})

	var result: Array[Vector2i] = []
	for key in costs:
		var parts = key.split(",")
		result.append(Vector2i(int(parts[0]), int(parts[1])))
	return result

## マンハッタン距離（移動コスト判定用）
static func dist_manhattan(x1: int, y1: int, x2: int, y2: int) -> int:
	return abs(x2 - x1) + abs(y2 - y1)

## チェビシェフ距離（攻撃射程判定用）
static func dist_chebyshev(x1: int, y1: int, x2: int, y2: int) -> int:
	return max(abs(x2 - x1), abs(y2 - y1))

## ユニット間の最短チェビシェフ距離（size対応）
static func dist_units(a: Unit, b: Unit) -> int:
	var min_d = 9999
	for ta in a.get_occupied_tiles():
		for tb in b.get_occupied_tiles():
			min_d = min(min_d, dist_chebyshev(ta.x, ta.y, tb.x, tb.y))
	return min_d

## 方向算出（0=上 1=右 2=下 3=左）
static func get_facing_dir(x1: int, y1: int, x2: int, y2: int) -> int:
	var dx = x2 - x1
	var dy = y2 - y1
	if abs(dx) >= abs(dy):
		return 1 if dx > 0 else 3
	else:
		return 2 if dy > 0 else 0

# --- private ---

static func _key(x: int, y: int) -> String:
	return "%d,%d" % [x, y]

static func _heuristic(x1: int, y1: int, x2: int, y2: int) -> float:
	return float(abs(x2 - x1) + abs(y2 - y1))

static func _reconstruct_path(came_from: Dictionary, cx: int, cy: int) -> Array[Vector2i]:
	var path: Array[Vector2i] = [Vector2i(cx, cy)]
	var key = _key(cx, cy)
	while came_from.has(key):
		var prev: Array = came_from[key]
		path.push_front(Vector2i(prev[0], prev[1]))
		key = _key(prev[0], prev[1])
	return path
