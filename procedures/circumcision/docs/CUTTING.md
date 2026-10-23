# Local cutting and topology checkpoint

The sandbox now supports a bounded local cutting interaction and independent material-area accounting. This is a development checkpoint, **not a completed procedure or live model evaluation**. Synthetic wound attachments, retained-element integrity checks, the released hold and terminal evaluator are described in [EVALUATOR.md](EVALUATOR.md). The complete procedural workflow remains pending. The numerical C0 acceptance thresholds are unchanged.

## Instrument interaction

An instrument action may include `cut: true` alongside its bounded pose. This enables a 0.35 mm radius cutting capsule at the tip for that command only. The tool must be open and unoccupied. Closing a gripper and cutting with the same instrument are rejected before either instrument changes. A subsequent command without `cut: true` does not cut.

For each 1/120-second-or-shorter solver substep, the capsule sweeps the tip's translation against the current triangle geometry. A segment/triangle distance test includes interior crossings and edge contacts; this avoids testing only the endpoints of an instrument move. Tissue is also tested at the new tip position after the substep. Deforming-tissue contact remains time-discretized: this is not exact continuous collision detection for every moving triangle.

Intersected cage triangles are ablated in full. Their local area can exceed the capsule's cross-section. There is no remeshed infinitesimal incision, blade-force model, thermal effect or clinical cutting claim. Neither the action handler nor its geometric collision query consults the task's target mask. They cannot remove an entire target region through a macro or target identifier. A cut through a grasp's supporting triangle releases that grasp.

## Connected tissue

Surface, diagonal and bending constraints have explicit supporting triangle groups. Losing the required support disables the constraint; a bending constraint cannot silently bridge a deleted strip. Interlayer and distal-fold links require live tissue at both endpoints. Orphan vertices cease participating. Components are computed from surviving faces and supported constraints, with fixed proximal vertices identifying retained components.

A surviving inner layer can keep an outer-layer incision connected. Separating both layers produces a detached component. Detached faces remain visible and simulated; they are not automatically hidden, disposed of or moved to a collection location. A direct topology regression creates test strips by editing fixture faces, and is explicitly **not** an instrument trajectory or a procedure-completion demonstration.

Godot subdivides each surviving cage triangle independently, using the original authored surface and barycentric displacement. A deleted triangle has no corresponding visual surface. The dense visual surface does not bridge a cut through bilinear interpolation. Fold strips disappear where their endpoint surface cells are absent. Cut edges are currently open shell boundaries without a detailed thickness cross-section.

## Independent synthetic target

`task-definition.mjs` fixes material-space labels at reset, with no action or model result as an input:

- Outer faces at axial row 12 or higher and inner faces at row 4 or higher belong to the target region. These are synthetic benchmark coordinates, not anatomical operative recommendations.
- Each face's initial rest area is immutable. Current stretching does not alter the denominator. The serialized definition, initial areas and nominal wound-pair indices are hashed.
- Target removal includes locally ablated target faces and surviving target faces disconnected from every proximal fixed vertex.
- Off-target removal uses the same rule for initially non-target faces, divided by initial non-target area.
- Nominal retained edge samples are the 48 angular vertex pairs at the two boundary rows. These identify fixed evaluation samples; the evaluator additionally requires actual new retained cut edges and does not award closure credit for intact adjacent surfaces.

The displayed area fractions are **partial accounting**, not terminal success. No-cut tissue has zero target detachment. The separate evaluator rejects missing or invalid wound samples, unresolved detached material and protected-volume hits. No live episode has been run and the complete mechanics/evaluator/controller candidate is not frozen yet.

## Reproduction

```sh
node --test tests/*.test.mjs
node launch.mjs
# In a second terminal, with actual rendered frames available:
node probe-mechanics.mjs --cutting --output evidence/local-cutting-probe
node verify-mechanics.mjs evidence/local-cutting-probe/report.json
```

The probe first repeats the bilateral pull/release workflow affected by the topology and visual interpolation changes, then performs local cut pulses and withdraws the instrument. All decisions in this fixture are scripted. The verifier checks source fingerprints, actions, observations, node positions, active topology, target labels and saved actual-image hashes. It does not infer clinical realism or autonomous capability from a successful replay.
