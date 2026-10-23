# Requires the local service and a graphical Godot renderer. No model inference.
extends SceneTree

func _initialize() -> void:
	run.call_deferred()

func wait_for_upload(scene: Control, previous: int) -> bool:
	var deadline = Time.get_ticks_msec() + 12000
	while Time.get_ticks_msec() < deadline:
		if scene.uploaded_frames > previous:
			return true
		await create_timer(.1).timeout
	return false

func run() -> void:
	root.size = Vector2i(1280, 820)
	var scene = load("res://main.tscn").instantiate()
	root.add_child(scene)
	if not await wait_for_upload(scene, 0):
		push_error("Initial Godot frame was not uploaded")
		quit(1)
		return
	var initial_image = scene.viewport.get_texture().get_image().get_data()
	# Disable automatic rendering to exercise capture's explicit redraw path.
	# This does not claim that the host accepted a native minimize request.
	RenderingServer.render_loop_enabled = false
	var previous = scene.uploaded_frames
	scene.set_camera(Vector3(10, 4, 7))
	if not await wait_for_upload(scene, previous):
		push_error("Godot did not upload a new frame with automatic rendering disabled")
		quit(1)
		return
	var rendered_image = scene.viewport.get_texture().get_image()
	var changed = initial_image != rendered_image.get_data()
	var passed = not rendered_image.is_empty() and changed and not RenderingServer.render_loop_enabled
	print(JSON.stringify({"test": "explicit_redraw_capture", "passed": passed, "automatic_render_loop": RenderingServer.render_loop_enabled, "changed_image": changed, "uploaded_frames": scene.uploaded_frames, "image_width": rendered_image.get_width(), "revision": scene.rendered_revision}))
	RenderingServer.render_loop_enabled = true
	quit(0 if passed else 1)
