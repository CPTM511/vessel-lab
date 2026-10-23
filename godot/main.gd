extends Control

const BASE = "http://127.0.0.1:8765"
const ACCENT = Color("72e5b4")
var state: Dictionary = {}
var session_id = ""
var rendered_revision = -1
var poll_busy = false
var capture_busy = false
var uploaded_frames = 0
var command_busy = false
var agent_running = false
var last_phase = ""
var viewport: SubViewport
var world: Node3D
var dynamic: Node3D
var camera: Camera3D
var status_label: Label
var metrics_label: Label
var events_label: RichTextLabel
var coords_label: Label
var feedback_label: Label
var progress: ProgressBar
var arm_select: OptionButton
var move_size: SpinBox
var buttons: Array[Button] = []
var metal: StandardMaterial3D
var tissue: StandardMaterial3D
var cyan: StandardMaterial3D
var thread_material: StandardMaterial3D
var orange: StandardMaterial3D
var timer: Timer

func material(color: Color, metallic: float = 0.0) -> StandardMaterial3D:
	var m = StandardMaterial3D.new()
	m.albedo_color = color
	m.metallic = metallic
	m.roughness = 0.38
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	return m

func _ready() -> void:
	var theme_value = Theme.new()
	theme_value.default_font_size = 15
	theme = theme_value
	metal = material(Color("bacbd4"), 0.75)
	tissue = material(Color("be6167"), 0.08)
	cyan = material(ACCENT, 0.2)
	thread_material = material(Color("62baff"), 0.2)
	orange = material(Color("ffa86b"), 0.25)
	build_ui()
	build_world()
	timer = Timer.new()
	timer.wait_time = 0.20
	timer.timeout.connect(poll)
	add_child(timer)
	timer.start()
	poll()

func label(text_value: String, size: int = 16, color: Color = Color("d9e6ed")) -> Label:
	var l = Label.new()
	l.text = text_value
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	return l

func button(text_value: String, callback: Callable, parent: Node, lock: bool = false) -> Button:
	var b = Button.new()
	b.text = text_value
	b.custom_minimum_size.y = 38
	b.pressed.connect(callback)
	parent.add_child(b)
	if lock:
		buttons.append(b)
	return b

func build_ui() -> void:
	var background = ColorRect.new()
	background.color = Color("0b121a")
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(background)
	var margin = MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 18)
	add_child(margin)
	var layout = VBoxContainer.new()
	layout.add_theme_constant_override("separation", 12)
	margin.add_child(layout)
	var header = HBoxContainer.new()
	layout.add_child(header)
	var title = label("VESSEL  /  LAB", 27, ACCENT)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title)
	header.add_child(label("GODOT  ·  LOCAL RESEARCH PROTOTYPE  ·  0.1", 13, Color("78919f")))
	layout.add_child(label("Autonomous vessel suturing  /  GPT-6 Astra · Low-level control · Replayable experiments", 17))
	var body = HBoxContainer.new()
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 18)
	layout.add_child(body)
	var view_column = VBoxContainer.new()
	view_column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_child(view_column)
	var cameras = HBoxContainer.new()
	view_column.add_child(cameras)
	button("Perspective", func(): set_camera(Vector3(11, 9, 14)), cameras)
	button("Top", func(): set_camera(Vector3(0.1, 18, 0.1)), cameras)
	button("Side", func(): set_camera(Vector3(0.1, 3, 19)), cameras)
	button("Seam", func(): set_camera(Vector3(10, 4, 7)), cameras)
	var view_container = SubViewportContainer.new()
	view_container.stretch = true
	view_container.size_flags_vertical = Control.SIZE_EXPAND_FILL
	view_container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	view_container.custom_minimum_size = Vector2(640, 480)
	view_column.add_child(view_container)
	viewport = SubViewport.new()
	viewport.size = Vector2i(900, 650)
	viewport.own_world_3d = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	view_container.add_child(viewport)
	view_column.add_child(label("Units: mm  ·  X axial / Y vertical / Z lateral  ·  Simulation pauses during model inference", 13, Color("78919f")))
	var panel_scroll = ScrollContainer.new()
	panel_scroll.custom_minimum_size.x = 330
	panel_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	body.add_child(panel_scroll)
	var panel = VBoxContainer.new()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_theme_constant_override("separation", 10)
	panel_scroll.add_child(panel)
	status_label = label("Connecting to controller…", 17, ACCENT)
	panel.add_child(status_label)
	button("Verify model feedback loop", func(): command("/api/agent/start", {"task": "loop"}), panel, true)
	button("Start autonomous suturing", func(): command("/api/agent/start", {"task": "suture"}), panel, true)
	button("Stop controller", func(): command("/api/agent/stop", {}), panel)
	button("Replay recorded run", func(): command("/api/replay/start", {}), panel, true)
	var reset_row = HBoxContainer.new()
	panel.add_child(reset_row)
	button("Reset · seed 42", func(): command("/api/reset", {"seed": 42}), reset_row, true)
	button("Evaluate", finish_episode, reset_row, true)
	panel.add_child(HSeparator.new())
	panel.add_child(label("Experiment metrics", 17, ACCENT))
	progress = ProgressBar.new()
	progress.max_value = 100
	progress.custom_minimum_size.y = 18
	panel.add_child(progress)
	metrics_label = label("Waiting for scene state", 15)
	panel.add_child(metrics_label)
	panel.add_child(HSeparator.new())
	var manual_row = HBoxContainer.new()
	panel.add_child(manual_row)
	arm_select = OptionButton.new()
	arm_select.add_item("Right arm")
	arm_select.add_item("Left arm")
	manual_row.add_child(arm_select)
	move_size = SpinBox.new()
	move_size.min_value = 0.1
	move_size.max_value = 2.5
	move_size.step = 0.1
	move_size.value = 0.5
	manual_row.add_child(move_size)
	coords_label = label("", 13, Color("9fb3bf"))
	coords_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	panel.add_child(coords_label)
	var grid = GridContainer.new()
	grid.columns = 3
	panel.add_child(grid)
	for axis in range(3):
		var a = axis
		button(["X−", "Y−", "Z−"][axis], func(): jog(a, -1), grid, true)
	for axis in range(3):
		var a = axis
		button(["X+", "Y+", "Z+"][axis], func(): jog(a, 1), grid, true)
	var jaw_row = HBoxContainer.new()
	panel.add_child(jaw_row)
	button("Grasp", func(): jaw(0.0), jaw_row, true)
	button("Release", func(): jaw(1.0), jaw_row, true)
	button("Trim thread", func(): command("/api/cut", {"commandId": command_id(), "source": "manual"}), jaw_row, true)
	feedback_label = label("Manual controls ready.", 13, Color("9fb3bf"))
	feedback_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	feedback_label.custom_minimum_size.y = 40
	panel.add_child(feedback_label)
	events_label = RichTextLabel.new()
	events_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	events_label.custom_minimum_size.y = 70
	events_label.add_theme_font_size_override("normal_font_size", 12)
	panel.add_child(events_label)
	layout.add_child(label("Research prototype: annular lips, compliant constraints and a geometric knot. Fixture-supported lumen. No clinical validation.", 12, Color("78919f")))

func build_world() -> void:
	world = Node3D.new()
	viewport.add_child(world)
	var environment = WorldEnvironment.new()
	var e = Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color("162630")
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color("b5d3df")
	e.ambient_light_energy = 0.65
	environment.environment = e
	world.add_child(environment)
	var light = DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-55, -30, 0)
	light.light_energy = 1.2
	world.add_child(light)
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 20
	world.add_child(camera)
	set_camera(Vector3(11, 9, 14))
	var floor_mesh = BoxMesh.new()
	floor_mesh.size = Vector3(22, 0.25, 19)
	mesh_instance(floor_mesh, material(Color("213d48")), world, Vector3(0, -4.5, 0))
	var grid_mat = material(Color("385460"))
	for i in range(-10, 11, 2):
		line3(Vector3(i, -4.35, -8), Vector3(i, -4.35, 8), 0.015, grid_mat, world)
	for i in range(-8, 9, 2):
		line3(Vector3(-10, -4.35, i), Vector3(10, -4.35, i), 0.015, grid_mat, world)
	for x in [-6.0, 6.0]:
		var block = BoxMesh.new()
		block.size = Vector3(1.2, 1.2, 7)
		mesh_instance(block, metal, world, Vector3(x, -3.7, 0))
	var axis_origin = Vector3(-7, -3.8, 6)
	line3(axis_origin, axis_origin + Vector3(2, 0, 0), .045, material(Color("f48c8c")), world)
	line3(axis_origin, axis_origin + Vector3(0, 2, 0), .045, cyan, world)
	line3(axis_origin, axis_origin + Vector3(0, 0, 2), .045, thread_material, world)
	text3("X", axis_origin + Vector3(2.4, 0, 0), world, Color("f48c8c"))
	text3("Y", axis_origin + Vector3(0, 2.4, 0), world, ACCENT)
	text3("Z", axis_origin + Vector3(0, 0, 2.4), world, Color("62baff"))
	text3("L", Vector3(-7, 5, -3), world, ACCENT)
	text3("R", Vector3(7, 5, -3), world, Color("ffa86b"))
	dynamic = Node3D.new()
	world.add_child(dynamic)

func v3(a: Array) -> Vector3:
	return Vector3(a[0], a[1], a[2])

func mesh_instance(mesh: Mesh, mat: Material, parent: Node, pos: Vector3 = Vector3.ZERO) -> MeshInstance3D:
	var m = MeshInstance3D.new()
	m.mesh = mesh
	m.material_override = mat
	m.position = pos
	parent.add_child(m)
	return m

func sphere(p: Vector3, radius: float, mat: Material, parent: Node) -> void:
	var m = SphereMesh.new()
	m.radius = radius
	m.height = radius * 2
	m.radial_segments = 12
	m.rings = 6
	mesh_instance(m, mat, parent, p)

func line3(a: Vector3, b: Vector3, radius: float, mat: Material, parent: Node) -> void:
	var delta = b - a
	if delta.length() < .001:
		return
	var mesh = CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.height = delta.length()
	mesh.radial_segments = 8
	var node = mesh_instance(mesh, mat, parent, (a + b) / 2)
	node.quaternion = Quaternion(Vector3.UP, delta.normalized())

func text3(text_value: String, pos: Vector3, parent: Node, color: Color) -> void:
	var l = Label3D.new()
	l.text = text_value
	l.position = pos
	l.font_size = 40
	l.pixel_size = .012
	l.modulate = color
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	parent.add_child(l)

func set_camera(pos: Vector3) -> void:
	if camera:
		camera.position = pos
		camera.look_at(Vector3.ZERO)
		rendered_revision = -1

func draw_state(s: Dictionary) -> void:
	for child in dynamic.get_children():
		dynamic.remove_child(child)
		child.queue_free()
	var points: Array = s.particles
	var st = SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for face in s.faces:
		for index in face:
			st.add_vertex(v3(points[int(index)].p))
	st.generate_normals()
	mesh_instance(st.commit(), tissue, dynamic)
	for side in range(2):
		for j in range(24):
			var a = v3(points[side * 96 + j].p)
			var b = v3(points[side * 96 + (j + 1) % 24].p)
			line3(a, b, .075, material(Color("ee9698")), dynamic)
	for stitch in s.stitches:
		var a = v3(points[int(stitch.left.node)].p)
		var b = v3(points[int(stitch.right.node)].p)
		var middle = (a+b)/2 + Vector3(0, .15 + maxf(0, stitch.rest - a.distance_to(b))*.35, 0)
		line3(a, middle, .045, thread_material, dynamic)
		line3(middle, b, .045, thread_material, dynamic)
		if stitch.locked:
			sphere(middle, .10, cyan, dynamic)
	var tip = v3(s.needle.position)
	for i in range(10):
		var a = float(i) / 10 * PI * .8
		var b = float(i+1) / 10 * PI * .8
		line3(tip + Vector3(.65*sin(a), .65*(1-cos(a)), 0), tip + Vector3(.65*sin(b), .65*(1-cos(b)), 0), .055, metal, dynamic)
	sphere(tip, .10, orange, dynamic)
	var tail = v3(s.tail)
	if not s.instrumentation.threadCut:
		var middle = (tail+tip)/2 + Vector3(0, -.8, 0)
		line3(tip, middle, .035, thread_material, dynamic)
		line3(middle, tail, .035, thread_material, dynamic)
	sphere(tail, .12, thread_material, dynamic)
	for name in ["left", "right"]:
		var p = v3(s.arms[name].position)
		var sign_value = -1.0 if name == "left" else 1.0
		var base_pos = Vector3(sign_value*7, 4, -5)
		var elbow = Vector3(sign_value*5, 6, -1)
		line3(base_pos, elbow, .27, metal, dynamic)
		line3(elbow, p + Vector3(0, .9, 0), .18, metal, dynamic)
		var col = cyan if name == "left" else orange
		sphere(elbow, .38, col, dynamic)
		var opening = .07 + float(s.arms[name].jaw) * .26
		for side in [-1, 1]:
			line3(p + Vector3(side*.12, .9, 0), p + Vector3(side*opening, .1, 0), .065, col, dynamic)
	var cutter = v3(s.task.cutter)
	line3(cutter + Vector3(-.45, -.4, 0), cutter + Vector3(.45, .4, 0), .09, metal, dynamic)
	line3(cutter + Vector3(.45, -.4, 0), cutter + Vector3(-.45, .4, 0), .09, metal, dynamic)
	text3("CUT", cutter + Vector3(0, .7, 0), dynamic, Color("9fb3bf"))
	var trail: Array = s.trail
	for i in range(maxi(1, trail.size()-25), trail.size()):
		line3(v3(trail[i-1]), v3(trail[i]), .018, orange, dynamic)

func poll() -> void:
	if poll_busy:
		return
	poll_busy = true
	var req = HTTPRequest.new()
	req.timeout = 3
	add_child(req)
	var err = req.request(BASE + "/api/state")
	if err != OK:
		poll_busy = false
		req.queue_free()
		return
	var response = await req.request_completed
	req.queue_free()
	poll_busy = false
	if response[1] != 200:
		status_label.text = "Controller offline · run the launcher"
		return
	var data = JSON.parse_string(response[3].get_string_from_utf8())
	if not data is Dictionary:
		return
	if session_id != data.session:
		session_id = data.session
		rendered_revision = -1
	state = data.state
	agent_running = data.agent.get("running", false)
	var phase = str(data.agent.get("phase", ""))
	if phase != last_phase:
		last_phase = phase
		rendered_revision = -1
	status_label.text = (("Replay · " if data.agent.get("task") == "replay" else "GPT-6 Astra · ") + data.agent.get("phase", "running")) if agent_running else ("Godot connected · " + str(state.status))
	if not agent_running and data.agent.get("task") == "replay":
		status_label.text = "Replay finished · recorded actions"
	for b in buttons:
		b.disabled = agent_running
	progress.value = state.metrics.coverage * 100
	metrics_label.text = "Closure coverage  %.1f%%\nThread bridges  %d  /  Knot  %s\nMean gap  %.3f mm\nTrimmed  %s  /  Damage  %.3f\nSim time  %.2f s  /  Revision %d" % [state.metrics.coverage*100, state.metrics.bridges, "secured" if state.metrics.knot else "unsecured", state.metrics.meanGap, "yes" if state.metrics.cut else "no", state.metrics.damage, state.time, state.revision]
	coords_label.text = "R  (%.2f, %.2f, %.2f)\nL  (%.2f, %.2f, %.2f)" % [state.arms.right.position[0], state.arms.right.position[1], state.arms.right.position[2], state.arms.left.position[0], state.arms.left.position[1], state.arms.left.position[2]]
	var event_lines: Array[String] = []
	for ev in state.events:
		event_lines.append("%s  %s" % [ev.revision, ev.type])
	events_label.text = "\n".join(event_lines)
	if data.agent.get("error"):
		feedback_label.text = str(data.agent.error)
	if state.get("result"):
		feedback_label.text = "Evaluation: " + ("PASS" if state.result.passed else "FAIL") + "\n" + str(state.result.checks)
	if rendered_revision != int(state.revision) and not capture_busy:
		draw_state(state)
		rendered_revision = int(state.revision)
		capture(rendered_revision, session_id)

func capture(revision: int, sid: String) -> void:
	if capture_busy:
		return
	capture_busy = true
	# Request an actual draw even when the native window is minimized or occluded.
	await get_tree().process_frame
	RenderingServer.force_draw(false)
	var img = viewport.get_texture().get_image()
	if img.get_width() > 1000:
		img.resize(1000, int(float(img.get_height())*1000/img.get_width()))
	var b64 = Marshalls.raw_to_base64(img.save_jpg_to_buffer(.86))
	var ui_image = get_viewport().get_texture().get_image()
	if ui_image.get_width() > 1600:
		ui_image.resize(1600, int(float(ui_image.get_height())*1600/ui_image.get_width()))
	var ui_b64 = Marshalls.raw_to_base64(ui_image.save_jpg_to_buffer(.90))
	var req = HTTPRequest.new()
	req.timeout = 3
	add_child(req)
	var err = req.request(BASE + "/api/frame", ["Content-Type: application/json"], HTTPClient.METHOD_POST, JSON.stringify({"revision": revision, "session": sid, "engine": "Godot " + Engine.get_version_info().string, "image": "data:image/jpeg;base64," + b64, "uiImage": "data:image/jpeg;base64," + ui_b64}))
	if err != OK:
		req.queue_free()
		capture_busy = false
		rendered_revision = -1
		return
	var upload = await req.request_completed
	req.queue_free()
	capture_busy = false
	if upload[1] != 200:
		rendered_revision = -1
	else:
		uploaded_frames += 1

func command_id() -> String:
	return "godot-" + str(Time.get_ticks_usec())

func command(endpoint: String, value: Dictionary) -> void:
	if command_busy:
		return
	command_busy = true
	var req = HTTPRequest.new()
	req.timeout = 5
	add_child(req)
	var err = req.request(BASE + endpoint, ["Content-Type: application/json"], HTTPClient.METHOD_POST, JSON.stringify(value))
	if err != OK:
		command_busy = false
		req.queue_free()
		return
	var result = await req.request_completed
	req.queue_free()
	command_busy = false
	var data = JSON.parse_string(result[3].get_string_from_utf8())
	feedback_label.text = str(data.get("error", "Command applied")) if data is Dictionary else "Connection error"
	poll()

func jog(axis: int, direction: int) -> void:
	if state.is_empty() or agent_running:
		return
	var name = "right" if arm_select.selected == 0 else "left"
	var target: Array = state.arms[name].position.duplicate()
	target[axis] += direction * move_size.value
	command("/api/step", {"commandId": command_id(), "source": "manual", "action": {"revision": state.revision, "duration": .3, name: {"position": target}}})

func jaw(value: float) -> void:
	if state.is_empty() or agent_running:
		return
	var name = "right" if arm_select.selected == 0 else "left"
	command("/api/step", {"commandId": command_id(), "source": "manual", "action": {"revision": state.revision, "duration": .1, name: {"jaw": value}}})

func finish_episode() -> void:
	command("/api/finish", {"commandId": command_id(), "source": "manual"})
