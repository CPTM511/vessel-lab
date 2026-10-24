extends SceneTree
const Anatomy = preload("res://anatomy.gd")

# Export the actual subdivided mechanical surface vertices, without rendering.
# This diagnostic does not change the simulation or its acceptance thresholds.
func _initialize() -> void:
	var args = OS.get_cmdline_user_args()
	if args.size() != 2:
		push_error("Expected input state JSON and output vertex JSON paths")
		quit(1)
		return
	var state: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(args[0]))
	var a = Anatomy.new()
	a.rest_cage = JSON.parse_string(FileAccess.get_file_as_string("res://data/tissue-rest.json"))
	a.mechanical_positions = state.positions
	a.mechanical_faces = state.faces
	a.mechanical_scale = state.scale
	a.materials = {"skin": null, "mucosa": null}
	var result: Dictionary = {"revision":state.revision,"anatomyHash":FileAccess.get_sha256("res://anatomy.gd"),"surfaces":{}}
	for layer in range(2):
		var name_value = "outer" if layer == 0 else "inner"
		var parent = Node3D.new()
		a.add_child(parent)
		a.parts[name_value] = parent
		a.mechanical_surface(layer)
		var points: Array = []
		for child in parent.get_children():
			for index in range(child.mesh.get_surface_count()):
				var arrays = child.mesh.surface_get_arrays(index)
				for vertex in arrays[Mesh.ARRAY_VERTEX]:
					var p: Vector3 = vertex * state.scale
					points.append([p.x,p.y,p.z])
		result.surfaces[name_value] = points
	var out = FileAccess.open(args[1],FileAccess.WRITE)
	out.store_string(JSON.stringify(result)+"\n")
	out.close()
	a.free()
	quit()
