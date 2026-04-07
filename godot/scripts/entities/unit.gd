## ユニットデータクラス
## JSの unit オブジェクト構造をGDScriptクラスとして定義
class_name Unit
extends RefCounted

# --- 基本情報 ---
var id: int = 0
var unit_name: String = ""
var side: String = ""       # "EAST" or "WEST"
var warlord_id: String = ""
var unit_type: String = "NORMAL"  # "NORMAL" or "HEADQUARTERS"

# --- 位置・向き ---
var x: int = 0
var y: int = 0
var dir: int = 0  # 0=up 1=right 2=down 3=left

# --- サイズ ---
var size: int = 1
var size_shape: String = "single"  # "single", "vertical", "2x2"

# --- ステータス ---
var soldiers: int = 1000
var atk: int = 70
var def: int = 70
var jin: int = 50   # 仁（調略成功率）
var loyalty: int = 80

# --- ユニットタイプ・能力 ---
var type: String = "INFANTRY"
var formation: String = "KAKUYOKU"
var can_fly: bool = false
var move_range: int = 9
var attack_range: int = 1

# --- 計算済みステータス（陣形補正後） ---
var final_atk: int = 70
var final_def: int = 70

# --- ターン状態 ---
var order: Dictionary = {}
var has_acted: bool = false
var dead: bool = false

# --- 表示用 ---
var color: Color = Color.BLUE  # プロトタイプ用

func _init(data: Dictionary = {}) -> void:
	for key in data:
		if key in self:
			set(key, data[key])
	_recalculate_stats()

func _recalculate_stats() -> void:
	var atk_mod = 1.0
	var def_mod = 1.0
	match formation:
		"HOKO":     atk_mod = 1.2
		"GYORIN":   def_mod = 1.2
		"KAKUYOKU": pass  # バランス、補正なし
	final_atk = int(atk * atk_mod)
	final_def = int(def * def_mod)

func set_formation(f: String) -> void:
	formation = f
	_recalculate_stats()

func apply_damage(dmg: int) -> void:
	soldiers = max(0, soldiers - dmg)
	if soldiers == 0:
		dead = true

func is_alive() -> bool:
	return not dead and soldiers > 0

func get_occupied_tiles() -> Array[Vector2i]:
	var tiles: Array[Vector2i] = []
	match size_shape:
		"single":
			tiles.append(Vector2i(x, y))
		"vertical":
			tiles.append(Vector2i(x, y))
			tiles.append(Vector2i(x, y + 1))
		"2x2":
			tiles.append(Vector2i(x, y))
			tiles.append(Vector2i(x + 1, y))
			tiles.append(Vector2i(x, y + 1))
			tiles.append(Vector2i(x + 1, y + 1))
	return tiles
