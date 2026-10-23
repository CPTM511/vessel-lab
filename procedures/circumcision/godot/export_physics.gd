extends SceneTree

# Export a shared rest cage and collision sections from the authored anatomy.
# No textures, rendering or controller decisions are involved in this export.
const Anatomy = preload("res://anatomy.gd")
const ANGULAR = 48
const AXIAL = 24

func point(p: Vector3) -> Array:
	return [snappedf(p.x,.000001),snappedf(p.y,.000001),snappedf(p.z,.000001)]

func _initialize() -> void:
	var anatomy = Anatomy.new()
	anatomy.retraction = 0.0
	var nodes: Array = []
	var faces: Array = []
	for layer in range(2):
		for ring in range(AXIAL+1):
			for j in range(ANGULAR):
				var p = anatomy.prepuce_point(float(ring)/AXIAL,TAU*float(j)/ANGULAR,layer==1)
				nodes.append({"rest":point(p),"layer":layer,"ring":ring,"j":j,"fixed":ring==0})
		for ring in range(AXIAL):
			for j in range(ANGULAR):
				var a = layer*(AXIAL+1)*ANGULAR+ring*ANGULAR+j
				var b = layer*(AXIAL+1)*ANGULAR+ring*ANGULAR+(j+1)%ANGULAR
				var c = a+ANGULAR
				var d = b+ANGULAR
				faces.append({"nodes":[a,b,c],"layer":layer,"ring":ring,"j":j})
				faces.append({"nodes":[b,d,c],"layer":layer,"ring":ring,"j":j})
	var sections: Array = []
	for i in range(81):
		var points: Array = []
		for j in range(ANGULAR):
			points.append(point(anatomy.glans_point(float(i)/80,TAU*float(j)/ANGULAR)))
		sections.append(points)
	var result = {"schema":"anatomy-rest-cage-v1","units":"mm","angular":ANGULAR,"axial":AXIAL,"nodes":nodes,"faces":faces,"glansSections":sections,"provenance":"Original authored Godot anatomy.gd; synthetic dimensions, not patient data","anatomySourceSha256":FileAccess.get_sha256("res://anatomy.gd")}
	var output = ProjectSettings.globalize_path("res://data/tissue-rest.json")
	var f = FileAccess.open(output,FileAccess.WRITE)
	f.store_string(JSON.stringify(result)+"\n")
	f.close()
	print("Shared anatomy export: %s nodes, %s faces, %s protected glans sections" % [nodes.size(),faces.size(),sections.size()])
	anatomy.free()
	quit()
