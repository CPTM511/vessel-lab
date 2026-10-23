extends Node3D

# Original synthetic adult anatomy. World units are millimetres.
# Inspection retraction is a geometric morph, not a mechanical solver.
const SEGMENTS = 192
const RINGS = 112
var parts: Dictionary = {}
var meshes: Dictionary = {}
var materials: Dictionary = {}
var retraction = 0.0
var surface_count = 0
var triangle_count = 0

func _ready() -> void:
	materials.skin = tissue_material(Color("bd8972"), 0.53, 0.11, 3107)
	materials.mucosa = tissue_material(Color("ba7c7b"), 0.35, 0.07, 5071)
	materials.glans = tissue_material(Color("b37f85"), 0.39, 0.06, 7919)
	materials.frenulum = tissue_material(Color("c18b83"), 0.39, 0.07, 9011)
	materials.urethra = tissue_material(Color("c5a38b"), 0.61, 0.03, 1831)
	for name_value in ["shaft", "glans", "outer", "inner", "fold", "frenulum", "urethra", "meatus"]:
		var n = Node3D.new()
		n.name = name_value
		add_child(n)
		parts[name_value] = n
	build_static()
	update_prepuce(0.0)

func tissue_material(base: Color, rough: float, normal_strength: float, seed_value: int) -> StandardMaterial3D:
	var size_value = 512
	var noise = FastNoiseLite.new()
	noise.seed = seed_value
	noise.frequency = 0.035
	noise.fractal_octaves = 4
	var color_image = Image.create(size_value, size_value, false, Image.FORMAT_RGB8)
	var rough_image = Image.create(size_value, size_value, false, Image.FORMAT_RGB8)
	var normal_image = Image.create(size_value, size_value, false, Image.FORMAT_RGB8)
	for y in range(size_value):
		for x in range(size_value):
			var n = noise.get_noise_2d(x, y)
			var pore = noise.get_noise_2d(x * 4.0, y * 4.0)
			var wrinkles = sin(x * .19 + sin(y * .027) * 2.0) * .5 + pore
			var vascular = exp(-pow(sin(y * .032 + sin(x * .018) * 1.7) * 12.0, 2.0))
			var tone = .99 + n * .032 + pore * .012
			var c = Color(base.r * tone, base.g * tone, base.b * tone)
			c = c.lerp(Color(base.r * .74, base.g * .86, base.b * .95), vascular * .05)
			color_image.set_pixel(x, y, c)
			var r = clampf(rough + n * .055 + pore * .035, .22, .75)
			rough_image.set_pixel(x, y, Color(r, r, r))
			var nx = noise.get_noise_2d(x * 4 + 1, y * 4) - noise.get_noise_2d(x * 4 - 1, y * 4)
			var ny = noise.get_noise_2d(x * 4, y * 4 + 1) - noise.get_noise_2d(x * 4, y * 4 - 1)
			normal_image.set_pixel(x, y, Color(.5 + nx * .55 + wrinkles * .024, .5 + ny * .55, 1.0))
	var m = StandardMaterial3D.new()
	m.albedo_texture = ImageTexture.create_from_image(color_image)
	m.roughness_texture = ImageTexture.create_from_image(rough_image)
	m.roughness = 1.0
	m.normal_enabled = true
	m.normal_texture = ImageTexture.create_from_image(normal_image)
	m.normal_scale = normal_strength
	m.subsurf_scatter_enabled = true
	m.subsurf_scatter_strength = .18
	m.subsurf_scatter_skin_mode = true
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	return m

func profile(x: float, points: Array) -> float:
	for i in range(points.size()-1):
		var a: Vector2 = points[i]
		var b: Vector2 = points[i+1]
		if x <= b.x:
			var prev: Vector2 = points[maxi(0, i-1)]
			var next: Vector2 = points[mini(points.size()-1, i+2)]
			var h = b.x-a.x
			var t = clampf((x-a.x)/h, 0.0, 1.0)
			var m0 = (b.y-prev.y)/maxf(.001,b.x-prev.x)
			var m1 = (next.y-a.y)/maxf(.001,next.x-a.x)
			return maxf(.06,(2*t*t*t-3*t*t+1)*a.y+(t*t*t-2*t*t+t)*h*m0+(-2*t*t*t+3*t*t)*b.y+(t*t*t-t*t)*h*m1)
	return points[-1].y

func glans_point(u: float, theta: float) -> Vector3:
	var x = lerpf(-9.5, 23.0, u)
	var r = profile(x,[Vector2(-9.5,9.7),Vector2(-6.5,12.9),Vector2(-3.5,14.0),Vector2(.5,13.6),Vector2(6,12.4),Vector2(12,10.1),Vector2(18,6.9),Vector2(21,4.0),Vector2(23,.12)])
	var ventral = pow(maxf(0.0,-cos(theta)),12)
	var notch = 1.0 - .15 * ventral * exp(-pow((x+3.5)/7.0,2.0))
	var subtle = .018 * sin(theta*13.0+x*1.4) * sin(u*PI)
	return Vector3(x,(r*notch+subtle)*cos(theta)*.91+.5,(r+subtle)*sin(theta))

func shaft_point(u: float, theta: float) -> Vector3:
	var x = lerpf(-72,-8.2,u)
	var r = profile(x,[Vector2(-72,12.3),Vector2(-54,11.7),Vector2(-32,11.1),Vector2(-17,10.5),Vector2(-8.2,10.1)])
	if x > -35.0:
		r -= .65*smoothstep(-35,-25,x)
	var raphe = .11*pow(maxf(0.0,-cos(theta)),32)
	var fold = .08*sin(x*.55+sin(theta*5.0))*pow(u,2)
	return Vector3(x,(r+raphe+fold)*cos(theta)*.91,(r+fold)*sin(theta))

func prepuce_point(u: float, theta: float, inner: bool) -> Vector3:
	var rim_x = lerpf(25.3,-12.0,retraction)
	var attach_x = -10.8 if inner else -35.0
	var x = lerpf(attach_x,rim_x,u)
	var r: float
	if retraction < .01:
		r = profile(x,[Vector2(-35,11.3),Vector2(-16,11.2),Vector2(-8,13.4),Vector2(-3,14.9),Vector2(7,14.0),Vector2(16,11.9),Vector2(23,8.2),Vector2(25.3,6.5)])
	else:
		var rest_x = lerpf(attach_x,25.3,u)
		var rest_r = profile(rest_x,[Vector2(-35,11.3),Vector2(-16,11.2),Vector2(-8,13.4),Vector2(-3,14.9),Vector2(7,14.0),Vector2(16,11.9),Vector2(23,8.2),Vector2(25.3,6.5)])
		var folded_r = 11.2 + 1.1*sin(u*PI) + .28*sin(u*PI*6.0)*sin(u*PI)
		r = lerpf(rest_r,folded_r,retraction)
	var thickness = .47 * (1.0 - .3*u)
	if inner:
		r -= thickness
	var wrinkle = (.06 + .12*retraction)*sin(theta*17.0+u*3.0)*sin(u*PI)
	var asymmetry = .22*sin(theta*3.0+.5)*sin(u*PI)
	return Vector3(x+.18*sin(theta*2.0)*u,(r+wrinkle+asymmetry)*cos(theta)*.92+.3,(r+wrinkle)*sin(theta))

func fold_point(u: float, theta: float) -> Vector3:
	var outside = prepuce_point(1.0,theta,false)
	var inside = prepuce_point(1.0,theta,true)
	return outside.lerp(inside,u) + Vector3(.20*sin(u*PI),0,0)

func surface(name_value: String, point_function: Callable, mat: Material, rings: int = RINGS, segments: int = SEGMENTS, reverse: bool = false) -> MeshInstance3D:
	var vertices = PackedVector3Array()
	var normals = PackedVector3Array()
	var uvs = PackedVector2Array()
	var indices = PackedInt32Array()
	for i in range(rings+1):
		var u = float(i)/rings
		for j in range(segments+1):
			var theta = TAU*float(j)/segments
			var p: Vector3 = point_function.call(u,theta)
			var du: Vector3 = point_function.call(minf(1,u+.0001),theta)-point_function.call(maxf(0,u-.0001),theta)
			var dv: Vector3 = point_function.call(u,theta+.0001)-point_function.call(u,theta-.0001)
			var n = dv.cross(du).normalized()
			if reverse:
				n = -n
			vertices.append(p)
			normals.append(n)
			uvs.append(Vector2(float(j)/segments,u))
	for i in range(rings):
		for j in range(segments):
			var a = i*(segments+1)+j
			var b = a+segments+1
			indices.append_array(PackedInt32Array([a,b+1,b,a,a+1,b+1]))
	var arrays = []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_TEX_UV] = uvs
	arrays[Mesh.ARRAY_INDEX] = indices
	var array_mesh = ArrayMesh.new()
	array_mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
	# Tangents are required for the authored normal maps.
	var st = SurfaceTool.new()
	st.create_from(array_mesh,0)
	st.generate_tangents()
	var node = MeshInstance3D.new()
	node.name = name_value + "Surface"
	node.mesh = st.commit()
	node.material_override = mat
	parts[name_value].add_child(node)
	meshes[name_value] = node
	return node

func build_static() -> void:
	surface("shaft",shaft_point,materials.skin)
	surface("glans",glans_point,materials.glans)
	# Urethral lumen proxy: ventral in the shaft, terminating at the distal glans.
	surface("urethra",func(u,theta):
		var x = lerpf(-72,22.6,u)
		var center_y = lerpf(-5.7,.3,smoothstep(-1,23,x))
		return Vector3(x,center_y+1.15*cos(theta),.95*sin(theta)),materials.urethra,96,64)
	var slit = SphereMesh.new()
	slit.radius = 1.0
	slit.height = 2.0
	slit.radial_segments = 48
	slit.rings = 24
	var m = StandardMaterial3D.new()
	m.albedo_color = Color("5d3a3d")
	m.roughness = .59
	var n = MeshInstance3D.new()
	n.mesh = slit
	n.material_override = m
	n.position = Vector3(22.6,.42,0)
	n.scale = Vector3(.24,1.68,.32)
	parts.meatus.add_child(n)

func update_prepuce(value: float) -> void:
	retraction = clampf(value,0,1)
	for key in ["outer","inner","fold","frenulum"]:
		for c in parts[key].get_children():
			parts[key].remove_child(c)
			c.queue_free()
	surface("outer",func(u,t):return prepuce_point(u,t,false),materials.skin)
	surface("inner",func(u,t):return prepuce_point(u,t,true),materials.mucosa,RINGS,SEGMENTS,true)
	surface("fold",fold_point,materials.mucosa,10)
	# Thin ventral attachment web; this is not a calibrated tissue membrane.
	var st = SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var steps = 32
	for i in range(steps):
		for j in range(12):
			for ij in [Vector2(i,j),Vector2(i+1,j),Vector2(i+1,j+1),Vector2(i,j),Vector2(i+1,j+1),Vector2(i,j+1)]:
				var u = ij.x/steps
				var v = ij.y/12.0
				var attachment_x = lerpf(7.0,-10.8,retraction)
				var x = lerpf(9.0,attachment_x,u)
				var width = .42 + 2.0*sin(u*PI*.72)
				var glans_u = clampf((x+9.5)/32.5,0,1)
				var underside = glans_point(glans_u,PI).y
				var y = underside - .24 - .45*sin(u*PI)*sin(v*PI)
				st.set_uv(Vector2(u,v))
				st.add_vertex(Vector3(x,y,(v-.5)*2*width))
	st.generate_normals()
	st.generate_tangents()
	var n = MeshInstance3D.new()
	n.mesh = st.commit()
	n.material_override = materials.frenulum
	parts.frenulum.add_child(n)
	count_geometry()

func count_geometry() -> void:
	surface_count = 0
	triangle_count = 0
	for part in parts.values():
		for child in part.get_children():
			if child is MeshInstance3D:
				surface_count += 1
				for i in range(child.mesh.get_surface_count()):
					var a = child.mesh.surface_get_arrays(i)
					var indices = a[Mesh.ARRAY_INDEX]
					triangle_count += (indices.size() if indices != null and indices.size() > 0 else a[Mesh.ARRAY_VERTEX].size())/3

func show_mode(mode: String) -> void:
	for key in parts:
		parts[key].visible = key != "urethra"
	match mode:
		"inner":
			parts.outer.visible = false
			parts.shaft.visible = false
			parts.glans.visible = false
			parts.meatus.visible = false
		"protected":
			for key in ["shaft","outer","inner","fold"]:
				parts[key].visible = false
			parts.urethra.visible = true
		"glans":
			for key in ["outer","inner","fold"]:
				parts[key].visible = false
		"outer":
			for key in parts:
				parts[key].visible = key in ["outer","fold"]
