# Bilateral shell manipulation checkpoint

The development sandbox connects low-level instrument commands to a deterministic tissue solver and the running Godot renderer. It is **not a complete circumcision simulation**. Local cutting and topology accounting are available in the development sandbox. Local synthetic edge attachments and a C0 evaluator are now implemented; live model control remains disabled. A complete scripted path now passes the existing geometric evaluator; see [the actual evidence and limits](../evidence/SCRIPTED_C0.md). See [evaluator definitions](EVALUATOR.md). See [local cutting and target semantics](CUTTING.md).

## Shared anatomical representation

`godot/export_physics.gd` samples the original anatomical surfaces into `godot/data/tissue-rest.json`: 2,400 control vertices, 4,608 surface triangles and 81 glanular cross-sections. The export records the anatomical source hash. The solver refuses a stale export. Godot subdivides each surviving mechanical triangle and interpolates its barycentric displacement over the authored anatomical surface; the inspection retraction morph is disabled during mechanics. Changing the camera or inspecting a layer cannot change physical tissue positions.

To regenerate the data after changing `anatomy.gd`:

```sh
godot --headless --path godot --script res://export_physics.gd
```

This command exports numerical data; it does not generate rendered evidence. The actual application must run with a graphical renderer for images.

## Mechanical model

The original implementation uses compliant distance constraints following the multiplier update described by Macklin, Müller and Chentanez in [XPBD: Position-Based Simulation of Compliant Constrained Dynamics](https://matthias-research.github.io/pages/publications/XPBD.pdf), equations 17–18 and Algorithm 1. Axial, circumferential, diagonal, bending-distance and interlayer constraints connect the sampled prepuce. Proximal boundaries are fixed. Integration uses substeps no longer than 1/120 simulated second and ten constraint iterations per substep. Compliance and damping are authored synthetic parameters, not measurements of living tissue.

A gripper must close within 1 mm of a surface triangle. The nearest contact point establishes a barycentric grasp constraint. Translation and quaternion-interpolated orientation are bounded by the frozen C0 protocol. Reopening the jaws removes the grasp; there is no automatic retraction trajectory or target-point action. The grasp constrains a point and does not model a calibrated contact patch, friction or transmitted torque.

A rigid glanular fixture uses the sampled anatomical sections for contact projection. Urethral and frenular capsule proxies are separately checked. Conservative samples cover the complete modeled instrument shaft and jaws throughout motion. Protected intersections are recorded and remain visible after the instrument moves away. These approximations are not a clinical injury model or exact continuous collision detection against every visible triangle.

## Non-adjacent shell contact

The solver now filters each proposed substep through continuous triangle contact with a synthetic 0.03 mm gap. Swept bounds and fixed or continuously varying separating-plane certificates precede closest-feature conservative advancement. Interacting contact planes are accumulated and projected together; all nine vertex-pair support inequalities resolve tied closest features on parallel faces. Persistent frictionless contact constraints participate in subsequent mechanical iterations. A full continuous sweep rechecks each proposed motion after projection. When contacts cannot be resolved, motion is conservatively limited; the UI and observations expose grasp error and contact-limited substeps.

Shared-vertex neighbours are excluded. The algorithm assumes separated initial geometry, uses linear substep trajectories and floating-point tolerances, and is not an exact collision or calibrated tissue model. One full scripted detachment/collection path is verified; arbitrary folding and general contact robustness remain unvalidated. See [the contact method, evidence and limitations](../evidence/CONTACT.md).

## Control and evidence

Enable **Mechanics sandbox** in the application. Select a gripper, translate in millimetres, rotate, close the jaws and release. The anatomy-only retraction preset and slider are disabled. Both instruments are independently controllable. The environment advances only through explicit low-level steps.

The local service requires session and revision matching, idempotent command IDs and a fresh actual Godot frame before a mechanical step. Invalid bilateral commands are validated before either arm changes; numerical failures restore the previous mechanical state. A missing, malformed, phase-mismatched, control-source-mismatched or expired frame cannot authorize motion. Private transport logs preserve accepted and rejected command requests.

```sh
node --test tests/*.test.mjs
# With the actual Godot application running:
node probe-mechanics.mjs --output evidence/local-mechanical-probe
node verify-mechanics.mjs evidence/local-mechanical-probe/report.json
```

The probe is explicitly scripted. Its record includes every low-level action, observed state, mechanical geometry hash, actual image and read-only host-lock samples. Offline verification reruns the solver and checks observations, geometry, image hashes and source fingerprints. It does not convert a scripted run into model evidence.

## Remaining limitations

A passing scripted fixture does not establish general self-contact or material fidelity. There is no finite-element tissue model, calibrated force response, realistic friction, gravity, support-surface collision, remeshed blade incision, bleeding, healing or clinical outcome model. The complete fixture ends with maximum constraint strain 1.526994 and a visibly crumpled specimen. Its retained-edge score passes without any synthetic attachment, through passive geometry/recoil. A sampled tissue/glans residual penetration of 0.001015 mm at an intermediate release is distinct from the zero protected-instrument count. Final visual, reliability, independent model and release gates remain unmet.
