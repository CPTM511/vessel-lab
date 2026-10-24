extends SceneTree
const Anatomy = preload("res://anatomy.gd")
func _initialize() -> void:
	var a = Anatomy.new()
	var rows: Array = []
	for retraction in [0.0,0.5,1.0]:
		a.retraction = retraction
		var samples: Array = []
		for i in range(65):
			for j in range(33):
				var p = a.frenulum_point(i/64.0,TAU*j/32.0)
				samples.append([p.x,p.y,p.z])
		var meatus: Array = []
		for i in range(97):
			for j in range(193):
				var p = a.meatus_point(i/96.0,TAU*j/192.0)
				meatus.append([p.x,p.y,p.z])
		var glans: Array = []
		for i in range(113):
			for j in range(193):
				var p = a.glans_point(i/112.0,TAU*j/192.0)
				glans.append([p.x,p.y,p.z])
		rows.append({"retraction":retraction,"frenulum":samples,"meatus":meatus,"glans":glans})
	var f = FileAccess.open("res://data/anatomy-audit.json",FileAccess.WRITE)
	f.store_string(JSON.stringify({"kind":"Actual Godot parametric surface samples; not rendered evidence","anatomyHash":FileAccess.get_sha256("res://anatomy.gd"),"rows":rows})+"\n")
	f.close()
	a.free()
	quit()
