extends Control

const Anatomy = preload("res://anatomy.gd")
const INK = Color("dce4e8")
const MUTED = Color("8e9da8")
const ACCENT = Color("9bc9c1")
var base = OS.get_environment("ANATOMY_URL") if OS.has_environment("ANATOMY_URL") else "http://127.0.0.1:8785"
var viewport: SubViewport
var view_box: SubViewportContainer
var camera: Camera3D
var specimen: Node3D
var world: Node3D
var labels: Node3D
var support: Node3D
var orbit_yaw = .70
var orbit_pitch = .47
var orbit_distance = 116.0
var target = Vector3(-14,0,0)
var revision = -1
var session = ""
var scene_state: Dictionary = {}
var poll_busy = false
var capture_busy = false
var last_capture = 0
var frames = 0
var status: Label
var geometry_label: Label
var renderer_label: Label
var mode_label: Label
var feedback_label: Label
var show_labels = true
var dragging = false
var instrument_nodes: Node3D
var mechanics_panel: VBoxContainer
var arm_select: OptionButton
var mechanics_label: Label
var seed_input: SpinBox
var active_mechanics = false
var retraction_button: Button
var cut_toggle: CheckBox
var last_mode = ""
var last_morph = -1.0
var morph_slider: HSlider
var slider_timer: Timer

func _ready() -> void:
	Engine.max_fps = 45
	var theme_value = Theme.new()
	theme_value.default_font_size = 15
	theme = theme_value
	build_ui()
	build_world()
	var timer = Timer.new()
	timer.wait_time = .15
	timer.timeout.connect(poll)
	add_child(timer)
	timer.start()
	poll()

func text_label(value: String, size_value: int = 16, color: Color = INK) -> Label:
	var l = Label.new()
	l.text = value
	l.add_theme_font_size_override("font_size",size_value)
	l.add_theme_color_override("font_color",color)
	return l

func add_button(value: String, parent: Node, callback: Callable) -> Button:
	var b = Button.new()
	b.text = value
	b.custom_minimum_size.y = 38
	b.pressed.connect(callback)
	parent.add_child(b)
	return b

func note(value: String, parent: Node, color: Color = MUTED) -> Label:
	var l = text_label(value,14,color)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	parent.add_child(l)
	return l

func build_ui() -> void:
	var background = ColorRect.new()
	background.color = Color("0e141a")
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(background)
	var margin = MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["left","right","top","bottom"]:
		margin.add_theme_constant_override("margin_"+side,22)
	add_child(margin)
	var layout = VBoxContainer.new()
	layout.add_theme_constant_override("separation",12)
	margin.add_child(layout)
	var header = HBoxContainer.new()
	layout.add_child(header)
	var title = text_label("VESSEL LAB  /  ANATOMY",25,ACCENT)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title)
	header.add_child(text_label("ADULT SPECIMEN   ·   RESEARCH PREVIEW",13,MUTED))
	layout.add_child(text_label("Circumcision simulation   /   Anatomy and bilateral mechanics checkpoint",17))
	var body = HBoxContainer.new()
	body.add_theme_constant_override("separation",20)
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	layout.add_child(body)
	var left = VBoxContainer.new()
	left.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_child(left)
	var tools = HBoxContainer.new()
	left.add_child(tools)
	add_button("Overview",tools,func(): preset("covered"))
	retraction_button = add_button("Retracted",tools,func(): preset("retracted"))
	add_button("Ventral",tools,func(): preset("ventral"))
	add_button("Close-up",tools,func(): orbit_distance=68.0;target=Vector3(2,0,0);update_camera())
	add_button("Labels",tools,func():show_labels=!show_labels;labels.visible=show_labels)
	view_box = SubViewportContainer.new()
	view_box.stretch = true
	view_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	view_box.size_flags_vertical = Control.SIZE_EXPAND_FILL
	view_box.custom_minimum_size = Vector2(780,560)
	view_box.gui_input.connect(view_input)
	left.add_child(view_box)
	viewport = SubViewport.new()
	viewport.size = Vector2i(1080,760)
	viewport.own_world_3d = true
	viewport.msaa_3d = Viewport.MSAA_4X
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	view_box.add_child(viewport)
	left.add_child(text_label("Drag to orbit  ·  Scroll to zoom  ·  Anatomical units: mm  ·  Scale marks: 10 mm",13,MUTED))
	var scroll = ScrollContainer.new()
	scroll.custom_minimum_size.x = 315
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	body.add_child(scroll)
	var panel = VBoxContainer.new()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_theme_constant_override("separation",11)
	scroll.add_child(panel)
	status = note("Connecting to inspection service…",panel,ACCENT)
	note("Seed for next reset (11 / 29 / 83)",panel)
	seed_input = SpinBox.new()
	seed_input.min_value = 0
	seed_input.max_value = 4294967295
	seed_input.step = 1
	seed_input.value = 11
	panel.add_child(seed_input)
	add_button("Reset mechanics sandbox",panel,func(): send_request("/api/mechanics/reset",{"source":"manual-mechanics","seed":int(seed_input.value)}))
	add_button("Return to anatomy inspector",panel,func(): send_request("/api/inspection/reset",{"source":"manual-inspection"}))
	mechanics_panel = VBoxContainer.new()
	mechanics_panel.visible = false
	mechanics_panel.add_theme_constant_override("separation",8)
	panel.add_child(mechanics_panel)
	mechanics_panel.add_child(text_label("Low-level manual controls",18))
	arm_select = OptionButton.new()
	arm_select.add_item("Left gripper")
	arm_select.add_item("Right gripper")
	mechanics_panel.add_child(arm_select)
	var jog_grid = GridContainer.new()
	jog_grid.columns = 3
	mechanics_panel.add_child(jog_grid)
	for sign_value in [-1,1]:
		for axis in range(3):
			var selected_axis = axis
			var selected_sign = sign_value
			add_button(["X","Y","Z"][axis]+(" -1" if sign_value<0 else " +1"),jog_grid,func():mechanical_jog(selected_axis,selected_sign,false))
	var rotate_grid = GridContainer.new()
	rotate_grid.columns = 3
	mechanics_panel.add_child(rotate_grid)
	for sign_value in [-1,1]:
		for axis in range(3):
			var selected_axis = axis
			var amount = sign_value*10
			add_button(["Rx","Ry","Rz"][axis]+(" -10" if sign_value<0 else " +10"),rotate_grid,func():mechanical_jog(selected_axis,amount,true))
	var jaw_row = HBoxContainer.new()
	mechanics_panel.add_child(jaw_row)
	add_button("Grasp",jaw_row,func():mechanical_step({"jaw":0.0}))
	add_button("Release",jaw_row,func():mechanical_step({"jaw":1.0}))
	cut_toggle = CheckBox.new()
	cut_toggle.text = "Cut with each manual jog"
	mechanics_panel.add_child(cut_toggle)
	add_button("Local cut pulse",mechanics_panel,func():mechanical_step({"cut":true}))
	add_button("Synthetic edge attachment",mechanics_panel,func():global_mechanical_step({"approximate":true}))
	add_button("Advance 0.5 simulated seconds",mechanics_panel,func():global_mechanical_step({"duration":.5}))
	add_button("Finish C0 assessment",mechanics_panel,func():send_request("/api/finish",{"source":"manual-mechanics"}))
	mechanics_label = note("",mechanics_panel,ACCENT)
	note("Edge ties are synthetic constraints, not simulated stitches or knots. Model control remains disabled.",mechanics_panel)
	panel.add_child(text_label("Layer inspection",18))
	add_button("Outer preputial skin",panel,func():preset("outer"))
	add_button("Inner preputial mucosa",panel,func():preset("inner"))
	add_button("Glans / corona / sulcus",panel,func():preset("glans"))
	add_button("Meatal close-up",panel,func():preset("meatus"))
	add_button("Protected anatomy",panel,func():preset("protected"))
	panel.add_child(HSeparator.new())
	panel.add_child(text_label("Retraction morphology",18))
	morph_slider = HSlider.new()
	morph_slider.min_value = 0
	morph_slider.max_value = 1
	morph_slider.step = .01
	morph_slider.custom_minimum_size.y = 30
	panel.add_child(morph_slider)
	slider_timer = Timer.new()
	slider_timer.one_shot = true
	slider_timer.wait_time = .18
	slider_timer.timeout.connect(func(): send_change({"retraction":morph_slider.value}))
	add_child(slider_timer)
	morph_slider.value_changed.connect(func(_v):slider_timer.start())
	note("Visual inspection morph only. Disabled during the physical mechanics sandbox.",panel)
	mode_label = note("",panel,ACCENT)
	panel.add_child(HSeparator.new())
	panel.add_child(text_label("Inspection record",18))
	geometry_label = note("",panel)
	renderer_label = note("",panel)
	feedback_label = note("",panel)
	panel.add_child(HSeparator.new())
	note("Original procedural meshes and materials. No patient images. Synthetic adult scale.",panel)
	note("Reference basis: South African National MMC Guidelines 2025, Annexure C, pp. 100–101.",panel)
	add_button("Reset inspection",panel,func():preset("covered"))
	layout.add_child(text_label("Anatomical visualization ≠ mechanical fidelity ≠ clinical validation. This preview does not provide operative guidance.",13,MUTED))

func mesh_node(mesh: Mesh, mat: Material, position_value: Vector3, parent: Node) -> MeshInstance3D:
	var n = MeshInstance3D.new()
	n.mesh = mesh
	n.material_override = mat
	n.position = position_value
	parent.add_child(n)
	return n

func plain_material(color: Color, rough: float = .8) -> StandardMaterial3D:
	var m = StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = rough
	return m

func line(a: Vector3, b: Vector3, radius: float, color: Color, parent: Node) -> void:
	var m = CylinderMesh.new()
	m.top_radius = radius
	m.bottom_radius = radius
	m.height = a.distance_to(b)
	m.radial_segments = 8
	var n = mesh_node(m,plain_material(color),(a+b)/2,parent)
	n.quaternion = Quaternion(Vector3.UP,(b-a).normalized())

func world_label(value: String, p: Vector3, parent: Node, color: Color = INK, size_value: int = 26) -> void:
	var l = Label3D.new()
	l.text = value
	l.position = p
	l.font_size = size_value
	l.pixel_size = .10
	l.modulate = color
	l.outline_size = 4
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	parent.add_child(l)

func build_world() -> void:
	world = Node3D.new()
	viewport.add_child(world)
	var env_node = WorldEnvironment.new()
	var env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("18252d")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("dce5e7")
	env.ambient_light_energy = .45
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.ssao_enabled = true
	env.ssao_radius = 2.0
	env.ssao_intensity = 1.4
	env_node.environment = env
	world.add_child(env_node)
	for setting in [Vector3(-55,-25,0),Vector3(-28,140,0)]:
		var light = DirectionalLight3D.new()
		light.rotation_degrees = setting
		light.light_energy = 1.5 if setting.y < 0 else .5
		light.light_color = Color("fff4e9") if setting.y < 0 else Color("e4effa")
		light.shadow_enabled = true
		world.add_child(light)
	support = Node3D.new()
	world.add_child(support)
	var table = BoxMesh.new()
	table.size = Vector3(150,2,95)
	mesh_node(table,plain_material(Color("294951")),Vector3(-20,-16.5,0),support)
	# The drape is a neutral specimen support, with an independently visible scale.
	var drape = PlaneMesh.new()
	drape.size = Vector2(148,93)
	drape.subdivide_width = 80
	drape.subdivide_depth = 60
	mesh_node(drape,plain_material(Color("355861")),Vector3(-20,-15.4,0),support)
	for i in range(11):
		var x = -70.0+i*10.0
		line(Vector3(x,-15.1,29),Vector3(x,-15.1,32 if i%2==0 else 31),.08,Color("b4c9cb"),support)
		if i%2==0:
			world_label(str(i*10),Vector3(x,-14.8,34),support,Color("b4c9cb"),20)
	line(Vector3(-70,-15.1,29),Vector3(30,-15.1,29),.08,Color("b4c9cb"),support)
	specimen = Anatomy.new()
	world.add_child(specimen)
	labels = Node3D.new()
	world.add_child(labels)
	instrument_nodes = Node3D.new()
	world.add_child(instrument_nodes)
	camera = Camera3D.new()
	camera.near = .1
	camera.far = 500
	camera.fov = 48
	world.add_child(camera)
	update_camera()
	update_labels("covered")
	geometry_label.text = "%s surfaces · %s triangles\nNominal specimen length: %.1f mm" % [specimen.surface_count,specimen.triangle_count,97.3*specimen.scale.x]
	renderer_label.text = "Renderer: %s\nDriver: %s" % [RenderingServer.get_current_rendering_method(),RenderingServer.get_current_rendering_driver_name()]

func update_labels(mode: String) -> void:
	for c in labels.get_children():
		labels.remove_child(c)
		c.queue_free()
	var points: Array = []
	match mode:
		"inner":points=[["Inner preputial surface",Vector3(0,19,-15),Vector3(0,12,0)],["Folded distal rim",Vector3(31,12,0),Vector3(25,4,0)]]
		"protected":points=[["Glans / corona",Vector3(19,-23,-12),Vector3(6,-9,0)],["Urethral proxy",Vector3(-43,-17,-10),Vector3(-40,-5,0)],["Ventral frenulum",Vector3(-2,-22,15),Vector3(0,-10.5,0)]]
		"outer":points=[["Outer preputial skin",Vector3(-2,23,0),Vector3(-2,13,0)],["Distal fold",Vector3(31,13,0),Vector3(25,4,0)]]
		"ventral":points=[["Frenular attachment",Vector3(10,-25,4),Vector3(0,-10.5,0)],["Inner preputial mucosa",Vector3(-24,-21,13),Vector3(-11,-10,0)]]
		"meatus":points=[["Meatus",Vector3(24,5,-3),Vector3(22.9,.5,.3)]]
		"retracted", "glans":points=[["Corona",Vector3(-6,23,-6),Vector3(-4,12,0)],["Coronal sulcus",Vector3(-24,21,9),Vector3(-10,9,0)],["Urethral meatus",Vector3(32,14,0),Vector3(22.6,1,0)]]
		_:points=[["Outer preputial skin",Vector3(-3,24,0),Vector3(-3,14,0)],["Preputial opening",Vector3(33,13,0),Vector3(25.3,5,0)],["Shaft",Vector3(-51,20,6),Vector3(-51,10,0)]]
	for p in points:
		line(p[1],p[2],.055,Color("a8bbb9"),labels)
		world_label(p[0],p[1],labels,INK,24)
	labels.scale = specimen.scale
	labels.visible = show_labels

func update_camera() -> void:
	if not camera:
		return
	var direction = Vector3(sin(orbit_yaw)*cos(orbit_pitch),sin(orbit_pitch),cos(orbit_yaw)*cos(orbit_pitch))
	camera.position = target + direction*orbit_distance
	camera.look_at(target)
	last_capture = 0

func view_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT:
			dragging = event.pressed
		if event.pressed and event.button_index in [MOUSE_BUTTON_WHEEL_UP,MOUSE_BUTTON_WHEEL_DOWN]:
			orbit_distance = clampf(orbit_distance + (-6 if event.button_index==MOUSE_BUTTON_WHEEL_UP else 6),42,200)
			update_camera()
	if event is InputEventMouseMotion and dragging:
		orbit_yaw -= event.relative.x*.007
		orbit_pitch = clampf(orbit_pitch+event.relative.y*.007,-1.45,1.45)
		update_camera()

func preset(mode: String) -> void:
	var value = 1.0 if mode in ["retracted","ventral","protected","glans","meatus"] else 0.0
	send_change({"mode":mode} if active_mechanics else {"mode":mode,"retraction":value})

func send_change(change: Dictionary) -> void:
	change["source"] = "manual-inspection"
	send_request("/api/inspect",change)

func send_request(route: String, change: Dictionary) -> void:
	if session.is_empty():
		return
	var request = HTTPRequest.new()
	request.timeout = 10
	add_child(request)
	change.merge({"session":session,"revision":revision,"commandId":str(Time.get_ticks_usec())})
	request.request_completed.connect(func(_r,code,_h,body):
		if code != 200:
			feedback_label.text = "Request rejected: " + body.get_string_from_utf8().left(150)
		request.queue_free())
	request.request(base+route,["Content-Type: application/json"],HTTPClient.METHOD_POST,JSON.stringify(change))

func selected_arm() -> String:
	return "left" if arm_select.selected == 0 else "right"

func global_mechanical_step(change: Dictionary) -> void:
	if not active_mechanics:
		return
	var action = {"revision":scene_state.mechanics.revision,"duration":.05}
	action.merge(change,true)
	send_request("/api/step",{"source":"manual-mechanics","action":action})

func mechanical_step(change: Dictionary) -> void:
	if not active_mechanics:
		return
	var action = {"revision":scene_state.mechanics.revision,"duration":.05}
	action[selected_arm()] = change
	send_request("/api/step",{"source":"manual-mechanics","action":action})

func mechanical_jog(axis: int, amount: float, rotation_value: bool) -> void:
	if not active_mechanics:
		return
	var property = "rotationDeg" if rotation_value else "position"
	var target_value: Array = scene_state.mechanics.arms[selected_arm()][property].duplicate()
	target_value[axis] += amount
	if rotation_value:
		target_value[axis] = fposmod(target_value[axis]+180.0,360.0)-180.0
	var change = {property:target_value}
	if cut_toggle.button_pressed:
		change["cut"] = true
	mechanical_step(change)

func draw_instruments(data: Dictionary) -> void:
	for n in instrument_nodes.get_children():
		instrument_nodes.remove_child(n)
		n.queue_free()
	for arm_name in ["left","right"]:
		var a: Dictionary = data.arms[arm_name]
		var p = Vector3(a.position[0],a.position[1],a.position[2])
		var q = Quaternion(a.quaternion[0],a.quaternion[1],a.quaternion[2],a.quaternion[3])
		var color = Color("a9cfc6") if arm_name == "left" else Color("ceb8a3")
		line(p,p+q*Vector3(0,12,0),.25,Color("a5b3ba"),instrument_nodes)
		for sign_value in [-1,1]:
			var tip = p+q*Vector3(0,0,sign_value*(.22+a.jaw*.75))
			line(tip,p+q*Vector3(0,4,0),.18,color,instrument_nodes)
		if a.get("cutting",false):
			var blade = SphereMesh.new()
			blade.radius = .35
			blade.height = .70
			mesh_node(blade,plain_material(Color("eea672")),p,instrument_nodes)
		world_label("L" if arm_name=="left" else "R",p+q*Vector3(0,14,0),instrument_nodes,color,23)
	for tie in data.get("attachments",[]):
		if tie.active:
			line(Vector3(tie.points[0][0],tie.points[0][1],tie.points[0][2]),Vector3(tie.points[1][0],tie.points[1][1],tie.points[1][2]),.085,Color("aac4f0"),instrument_nodes)
	var m: Dictionary = data.metrics
	mechanics_label.text = "Seed: %s  ·  Scale: %.3f\nGrasps: %s  ·  Protected hits: %s\nPeak displacement: %.2f mm\nTime: %.2f s\nL: %.1f, %.1f, %.1f\nR: %.1f, %.1f, %.1f" % [data.seed,data.scale,m.activeGrasps,m.protectedIntersections,m.maxDisplacementMm,m.simulationSeconds,data.arms.left.position[0],data.arms.left.position[1],data.arms.left.position[2],data.arms.right.position[0],data.arms.right.position[1],data.arms.right.position[2]]
	mechanics_label.text += "\nCut faces: %s · Components: %s\nTarget detached: %.2f%%\nOff-target removed: %.2f%%" % [m.cutFaceCount,m.components.size(),m.area.targetDetachedFraction*100,m.area.offTargetRemovedFraction*100]
	var grasp_error := 0.0
	for grasp in m.graspErrors:
		grasp_error = maxf(grasp_error,float(grasp.error))
	mechanics_label.text += "\nGrasp error: %.3f mm\nContact-limited substeps: %s" % [grasp_error,m.get("shellContact",{}).get("limitedSubsteps",0)]
	var assessment: Dictionary = data.assessment
	mechanics_label.text += "\nSynthetic ties: %s\nReleased hold: %.2f / 5.00 s\nValid wound samples: %s / 48\nC0 assessment: %s" % [m.activeAttachments,m.releaseSeconds,assessment.closure.validSamples,"PASS" if assessment.passed else "INCOMPLETE"]
	if not assessment.passed:
		mechanics_label.text += "\nUnmet: " + ", ".join(assessment.failedGates)

func poll() -> void:
	if poll_busy:
		return
	poll_busy = true
	var request = HTTPRequest.new()
	request.timeout = 2
	add_child(request)
	request.request_completed.connect(func(_r,code,_h,body):
		poll_busy = false
		request.queue_free()
		if code != 200:
			status.text = "Inspection service unavailable"
			return
		var data = JSON.parse_string(body.get_string_from_utf8())
		if not data is Dictionary:
			return
		if data.session != session or data.revision != revision:
			apply_state(data)
		if not capture_busy and Time.get_ticks_msec()-last_capture>1800:
			capture())
	var error = request.request(base+"/api/state")
	if error != OK:
		poll_busy = false
		request.queue_free()

func apply_state(data: Dictionary) -> void:
	scene_state = data
	session = data.session
	revision = data.revision
	var mode: String = data.mode
	var morph: float = data.retraction
	var was_mechanical = active_mechanics
	active_mechanics = data.get("mechanicsEnabled",false)
	mechanics_panel.visible = active_mechanics
	morph_slider.editable = not active_mechanics
	retraction_button.disabled = active_mechanics
	instrument_nodes.visible = active_mechanics
	if active_mechanics:
		specimen.apply_mechanics(data.mechanics)
		draw_instruments(data.mechanics)
		last_morph = 0.0
		morph_slider.set_value_no_signal(0.0)
	elif morph != last_morph or was_mechanical:
		specimen.clear_mechanics()
		specimen.update_prepuce(morph)
		last_morph = morph
		morph_slider.set_value_no_signal(morph)
	if mode != last_mode:
		specimen.show_mode(mode)
		support.visible = mode not in ["ventral","protected","meatus"]
		orbit_yaw = .70
		orbit_pitch = -.80 if mode in ["ventral","protected"] else .47
		orbit_distance = 135 if mode in ["covered","protected"] else 114
		target = Vector3(-18,0,0) if mode in ["covered","protected"] else Vector3(-2,0,0)
		if mode == "meatus":
			orbit_yaw=1.38
			orbit_pitch=.12
			orbit_distance=38.0
			target=Vector3(20,.5,0)
		update_camera()
		last_mode = mode
	update_labels(mode)
	var scripted = str(data.get("controlSource","")).begins_with("scripted-")
	status.text = ("BILATERAL MECHANICS  ·  SCRIPTED" if scripted else "BILATERAL MECHANICS  ·  MANUAL") if active_mechanics else "ANATOMY INSPECTOR  ·  CONNECTED"
	mode_label.text = "View: %s\nMorph: %.0f%%  ·  Revision: %s" % [mode,morph*100,revision]
	geometry_label.text = "%s surfaces · %s triangles\nNominal specimen length: %.1f mm" % [specimen.surface_count,specimen.triangle_count,97.3*specimen.scale.x]
	last_capture = 0

func capture() -> void:
	if revision < 0 or capture_busy:
		return
	capture_busy = true
	last_capture = Time.get_ticks_msec()
	var captured_revision = revision
	var captured_session = session
	await get_tree().process_frame
	RenderingServer.force_draw(false)
	if captured_revision != revision or captured_session != session:
		capture_busy = false
		return
	var frame = viewport.get_texture().get_image()
	var ui = get_viewport().get_texture().get_image()
	if frame == null or frame.is_empty() or ui == null or ui.is_empty():
		capture_busy = false
		return
	var body = {"session":captured_session,"revision":captured_revision,"controlSource":scene_state.get("controlSource",""),"image":"data:image/jpeg;base64,"+Marshalls.raw_to_base64(frame.save_jpg_to_buffer(.91)),"uiImage":"data:image/jpeg;base64,"+Marshalls.raw_to_base64(ui.save_jpg_to_buffer(.91)),"renderer":RenderingServer.get_current_rendering_method(),"driver":RenderingServer.get_current_rendering_driver_name(),"surfaces":specimen.surface_count,"triangles":specimen.triangle_count,"mode":scene_state.get("mode",""),"retraction":last_morph,"mechanicsEnabled":active_mechanics,"mechanicsRevision":scene_state.get("mechanics",{}).get("revision",null),"seed":scene_state.get("mechanics",{}).get("seed",null),"anatomyScale":specimen.scale.x,"cutFaceCount":scene_state.get("mechanics",{}).get("metrics",{}).get("cutFaceCount",null),"activeAttachments":scene_state.get("mechanics",{}).get("metrics",{}).get("activeAttachments",null),"assessmentPassed":scene_state.get("mechanics",{}).get("assessment",{}).get("passed",null),"camera":{"yaw":orbit_yaw,"pitch":orbit_pitch,"distance":orbit_distance},"width":frame.get_width(),"height":frame.get_height()}
	var request = HTTPRequest.new()
	request.timeout = 3
	add_child(request)
	request.request_completed.connect(func(_r,code,_h,_b):
		capture_busy = false
		request.queue_free()
		if code==200:
			frames+=1
			feedback_label.text=("Actual Godot frames: %s\nScripted verification; no model inference." if str(body.controlSource).begins_with("scripted-") else "Actual Godot frames: %s\nNo model controller is running.") % frames)
	var error = request.request(base+"/api/frame",["Content-Type: application/json"],HTTPClient.METHOD_POST,JSON.stringify(body))
	if error != OK:
		capture_busy = false
		request.queue_free()
