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
	# Support half-spaces conservatively enclose every vertex of the rendered
	# protected surfaces. These are exclusion envelopes, not injury thresholds.
	var hulls: Dictionary = {}
	for name_value in ["frenulum","meatus"]:
		var vertices: Array = []
		var rings = 64 if name_value == "frenulum" else 48
		var angular = 32 if name_value == "frenulum" else 96
		var morphs = [0.0,1.0] if name_value == "frenulum" else [0.0]
		for morph in morphs:
			anatomy.retraction = morph
			for i in range(rings+1):
				for j in range(angular):
					var p: Vector3 = anatomy.frenulum_point(float(i)/rings,TAU*j/angular) if name_value == "frenulum" else anatomy.meatus_point(float(i)/rings,TAU*j/angular)
					vertices.append(p)
		anatomy.retraction = 0.0
		var planes: Array = []
		for ix in range(-2,3):
			for iy in range(-2,3):
				for iz in range(-2,3):
					if (ix==0 and iy==0 and iz==0) or (ix%2==0 and iy%2==0 and iz%2==0):
						continue
					var normal = Vector3(ix,iy,iz).normalized()
					var bound = -INF
					for p in vertices:
						bound = maxf(bound,normal.dot(p))
					# A 0.005 mm protective padding covers finite sampling and
					# floating-point differences; unrelated to C0 score thresholds.
					planes.append([normal.x,normal.y,normal.z,bound+.005])
		hulls[name_value] = {"planes":planes,"sampledVertices":vertices.size(),"inspectionMorphs":morphs,"paddingMm":.005,"method":"Conservative intersection of support half-spaces; may include adjacent empty space"}
	var result = {"schema":"anatomy-rest-cage-v1","units":"mm","angular":ANGULAR,"axial":AXIAL,"nodes":nodes,"faces":faces,"glansSections":sections,"protectedHulls":hulls,"provenance":"Original authored Godot anatomy.gd; synthetic dimensions, not patient data","anatomySourceSha256":FileAccess.get_sha256("res://anatomy.gd")}
	var output = ProjectSettings.globalize_path("res://data/tissue-rest.json")
	var f = FileAccess.open(output,FileAccess.WRITE)
	f.store_string(JSON.stringify(result)+"\n")
	f.close()
	print("Shared anatomy export: %s nodes, %s faces, %s protected glans sections" % [nodes.size(),faces.size(),sections.size()])
	anatomy.free()
	quit()
