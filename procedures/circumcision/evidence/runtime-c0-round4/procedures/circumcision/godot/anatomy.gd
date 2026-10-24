extends Node3D

# Original synthetic adult anatomy. World units are millimetres.
# Inspection retraction is a geometric morph, not a mechanical solver.
const SEGMENTS = 192
const RINGS = 112
var parts: Dictionary = {}
var meshes: Dictionary = {}
var materials: Dictionary = {}
var retraction = 0.0
var mechanical_positions: Array = []
var mechanical_faces: Array = []
var rest_cage: Dictionary = {}
var mechanical_scale = 1.0
var mechanical_templates: Dictionary = {}
var template_retraction = -1.0
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
	m.subsurf_scatter_enabled = RenderingServer.get_current_rendering_method() == "forward_plus"
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

func glans_profile_point(x: float, theta: float) -> Vector3:
	var r: float
	if x >= 18.0:
		# Rounded apical cap. The distal opening removes a patch from this
		# surface; it does not extend a tube beyond a closed pointed tip.
		r = 6.9*sqrt(maxf(0.0,(23.0-x)/5.0))
	else:
		r = profile(x,[Vector2(-9.5,9.7),Vector2(-6.5,12.9),Vector2(-3.5,14.0),Vector2(.5,13.6),Vector2(6,12.4),Vector2(12,10.1),Vector2(18,6.9),Vector2(21,4.0),Vector2(23,.12)])
	var ventral = pow(maxf(0.0,-cos(theta)),12)
	var notch = 1.0-.15*ventral*exp(-pow((x+3.5)/7.0,2.0)) if x < 18.0 else 1.0
	var subtle = .018*sin(theta*13.0+x*1.4)*sin((x+9.5)/32.5*PI)*(1-smoothstep(16.0,18.0,x))
	return Vector3(x,(r*notch+subtle)*cos(theta)*.91+.5,(r+subtle)*sin(theta))

func glans_point(u: float, theta: float) -> Vector3:
	var x = lerpf(-9.5,23.0,u)
	if x >= 18.0:
		var edge_radius = 1.0/sqrt(pow(.91*cos(theta)/1.65,2.0)+pow(sin(theta)/.30,2.0))
		var edge_x = 23.0-5.0*pow(edge_radius/6.9,2.0)
		x = lerpf(18.0,edge_x,(x-18.0)/5.0)
	return glans_profile_point(x,theta)

func glans_volume_point(u: float, theta: float) -> Vector3:
	# A conservative solid cap fills the protected urethral cavity. Visible
	# surface and exclusion sections use the same authored profile.
	return glans_profile_point(lerpf(-9.5,23.0,u),theta)

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
	var outside = deformed_point(1.0,theta,false)
	var inside = deformed_point(1.0,theta,true)
	return outside.lerp(inside,u) + Vector3(.20*sin(u*PI),0,0)

func fold_cell_active(theta: float) -> bool:
	if mechanical_faces.is_empty():
		return true
	var j = int(floor(fposmod(theta,TAU)/TAU*rest_cage.angular))
	for layer in range(2):
		var id = (layer*rest_cage.axial*rest_cage.angular+(rest_cage.axial-1)*rest_cage.angular+j)*2
		if not mechanical_faces[id].active or not mechanical_faces[id+1].active:
			return false
	return true

func mechanical_template(face: Dictionary, layer: int) -> Array:
	var uv_points: Array = []
	for id in face.nodes:
		var node: Dictionary = rest_cage.nodes[int(id)]
		var j = int(node.j)
		if int(face.j) == int(rest_cage.angular)-1 and j == 0:
			j = int(rest_cage.angular)
		uv_points.append(Vector2(float(j)/rest_cage.angular,float(node.ring)/rest_cage.axial))
	var uvs = PackedVector2Array()
	var rest_points = PackedVector3Array()
	var weights = PackedVector3Array()
	var divisions = 4
	for i in range(divisions):
		for j in range(divisions-i):
			var triangles = [[Vector2(i,j),Vector2(i+1,j),Vector2(i,j+1)]]
			if i+j < divisions-1:
				triangles.append([Vector2(i+1,j),Vector2(i+1,j+1),Vector2(i,j+1)])
			for triangle in triangles:
				if layer == 0:
					triangle.reverse()
				for v in triangle:
					var w = Vector3(1.0-(v.x+v.y)/divisions,v.x/divisions,v.y/divisions)
					var uv: Vector2 = uv_points[0]*w.x+uv_points[1]*w.y+uv_points[2]*w.z
					uvs.append(uv)
					rest_points.append(prepuce_point(uv.y,uv.x*TAU,layer==1))
					weights.append(w)
	return [uvs,rest_points,weights]

func mechanical_surface(layer: int) -> void:
	if template_retraction != retraction:
		mechanical_templates.clear()
		template_retraction = retraction
	var st = SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var count = 0
	for face_id in range(mechanical_faces.size()):
		var face: Dictionary = mechanical_faces[face_id]
		if not face.active or int(face.layer) != layer:
			continue
		if not mechanical_templates.has(face_id):
			mechanical_templates[face_id] = mechanical_template(face,layer)
		var template: Array = mechanical_templates[face_id]
		var deltas: Array = []
		for id in face.nodes:
			var node: Dictionary = rest_cage.nodes[int(id)]
			deltas.append(vector_array(mechanical_positions[int(id)])/mechanical_scale-vector_array(node.rest))
		for index in range(template[0].size()):
			var w: Vector3 = template[2][index]
			var delta: Vector3 = deltas[0]*w.x+deltas[1]*w.y+deltas[2]*w.z
			st.set_uv(template[0][index])
			st.add_vertex(template[1][index]+delta)
			count += 1
	if count == 0:
		return
	st.index()
	st.generate_normals()
	st.generate_tangents()
	var n = MeshInstance3D.new()
	n.mesh = st.commit()
	n.material_override = materials.skin if layer==0 else materials.mucosa
	var key = "outer" if layer==0 else "inner"
	parts[key].add_child(n)
	meshes[key] = n

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
			vertices.append(p)
			uvs.append(Vector2(float(j)/segments,u))
	# Normals follow the actual deformed mesh; sample each vertex only once.
	for i in range(rings+1):
		for j in range(segments+1):
			var du = vertices[mini(rings,i+1)*(segments+1)+j]-vertices[maxi(0,i-1)*(segments+1)+j]
			var dv = vertices[i*(segments+1)+(j+1)%segments]-vertices[i*(segments+1)+(j-1+segments)%segments]
			var n = dv.cross(du).normalized()
			normals.append(-n if reverse else n)
	for i in range(rings):
		for j in range(segments):
			if name_value == "fold" and not fold_cell_active(TAU*(float(j)+.5)/segments):
				continue
			var a = i*(segments+1)+j
			var b = a+segments+1
			indices.append_array(PackedInt32Array([a,b+1,b,a,a+1,b+1]))
	if indices.is_empty():
		return null
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
	# Rounded mucosal rim and a short, recessed lumen. The hidden lumen end is
	# a visualization boundary, not a physiological flow model.
	surface("meatus",meatus_point,materials.mucosa,48,SEGMENTS,true)

func meatus_point(u: float, theta: float) -> Vector3:
	var edge = glans_point(1.0,theta)
	var t = smoothstep(0.0,1.0,u)
	return Vector3(lerpf(edge.x,19.8,u),.5+lerpf(edge.y-.5,.95*cos(theta),t),lerpf(edge.z,.70*sin(theta),t))

func frenulum_point(u: float, theta: float) -> Vector3:
	# A thin, closed-section ventral web joins the glanular underside to the
	# retained inner collar. It remains a protected fixture in mechanics.
	var x = lerpf(9.0,-10.8,u)
	var glans_u = clampf((x+9.5)/32.5,0,1)
	var underside = glans_point(glans_u,PI).y
	var root_y = prepuce_point(0.0,PI,true).y
	var y = lerpf(underside-.12-.35*sin(u*PI),root_y,smoothstep(.72,1.0,u))
	var width = .35+1.45*pow(sin(u*PI*.5),.8)
	var thickness = .12+.18*sin(u*PI)
	return Vector3(x,y+thickness*cos(theta),width*sin(theta))

func update_prepuce(value: float) -> void:
	retraction = clampf(value,0,1)
	for key in ["outer","inner","fold","frenulum"]:
		for c in parts[key].get_children():
			parts[key].remove_child(c)
			c.queue_free()
	if mechanical_positions.is_empty():
		surface("outer",func(u,t):return deformed_point(u,t,false),materials.skin)
		surface("inner",func(u,t):return deformed_point(u,t,true),materials.mucosa,RINGS,SEGMENTS,true)
	else:
		mechanical_surface(0)
		mechanical_surface(1)
	surface("fold",fold_point,materials.mucosa,10)
	surface("frenulum",frenulum_point,materials.frenulum,64,32)
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
		"glans", "meatus":
			for key in ["outer","inner","fold"]:
				parts[key].visible = false
		"outer":
			for key in parts:
				parts[key].visible = key in ["outer","fold"]

func vector_array(value: Array) -> Vector3:
	return Vector3(value[0],value[1],value[2])

func deformed_point(u: float, theta: float, inner: bool) -> Vector3:
	var rest = prepuce_point(u,theta,inner)
	if mechanical_positions.is_empty():
		return rest
	var angular: int = rest_cage.angular
	var axial: int = rest_cage.axial
	var ring_value = clampf(u,0,1)*axial
	var ring = mini(axial-1,int(floor(ring_value)))
	var radial_value = fposmod(theta,TAU)/TAU*angular
	var j = int(floor(radial_value))%angular
	var a = ring_value-ring
	var b = radial_value-floor(radial_value)
	var layer = 1 if inner else 0
	var offset = layer*(axial+1)*angular
	var indices = [offset+ring*angular+j,offset+ring*angular+(j+1)%angular,offset+(ring+1)*angular+j,offset+(ring+1)*angular+(j+1)%angular]
	var weights = [(1-a)*(1-b),(1-a)*b,a*(1-b),a*b]
	var delta = Vector3.ZERO
	for i in range(4):
		var id: int = indices[i]
		delta += (vector_array(mechanical_positions[id])/mechanical_scale-vector_array(rest_cage.nodes[id].rest))*weights[i]
	return rest+delta

func apply_mechanics(data: Dictionary) -> void:
	if rest_cage.is_empty():
		rest_cage = JSON.parse_string(FileAccess.get_file_as_string("res://data/tissue-rest.json"))
	mechanical_positions = data.positions
	mechanical_faces = data.faces
	mechanical_scale = data.scale
	scale = Vector3.ONE*mechanical_scale
	update_prepuce(0.0)

func clear_mechanics() -> void:
	mechanical_positions = []
	mechanical_faces = []
	mechanical_scale = 1.0
	scale = Vector3.ONE
