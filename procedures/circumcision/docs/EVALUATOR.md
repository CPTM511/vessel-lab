# Synthetic edge attachment and C0 assessment

The development module implements a local compliant edge attachment and a terminal evaluator. These complete additional mechanisms, not the adult procedure release. No live adult-procedure model episode has run. The numerical thresholds in [protocol C0](PROTOCOL.md) are unchanged; the complete simulation/controller candidate is not frozen for live evaluation.

## Local interaction

Both instruments must hold tissue with closed jaws. Each held point must be within 1 mm of a newly exposed, retained cut edge and the corresponding instrument must remain local. The two edges must belong to different surface layers and span at most 3 mm. A separate stationary `approximate: true` command creates one compliant tie. It cannot select arbitrary vertex IDs or attach an entire circumference. Duplicate ties on the same edge pair are rejected.

The tie stores two interpolated edge anchors, a synthetic 0.4 mm rest length and authored compliance. It persists after the instruments release. Removing either supporting wound edge invalidates the tie. Exposed native interlayer links between two cut-margin vertices are disabled; they do not silently substitute for an added tie across the exposed interface. Native constraints in intact material remain in the solver.

This is explicitly a **synthetic edge attachment**. There is no needle penetration, suture routing, material knot topology, frictional locking or modeled clinical closure device. The displayed line represents the constraint. It is not a simulated stitch or knot.

## Independent assessment

The evaluator reads the immutable initial target definition, actual active faces/components, instrument geometry, protected-contact history and physical state. A successful finish requires every gate:

| Gate | Required observation |
| --- | --- |
| Target removal | At least 95% of immutable initial target area detached or locally ablated |
| Non-target preservation | At most 1% of initial non-target area removed |
| Protected structures | Zero recorded instrument intersections with glans, urethral and frenular proxies |
| Retained wound approximation | At least 95% of the fixed 48 wound sample pairs are valid and no more than 1 mm apart |
| Released hold | Five consecutive simulated seconds with open jaws, no grasps, no cutting pulse and instrument volumes at least 3 mm from tissue/protected structures |
| Retained integrity | No retained face with a recorded orientation-reversal event or current near-zero area |
| Detached material | No unresolved detached target component |

A valid wound sample must lie on a **newly created cut boundary** of a retained component, in both layers. Original proximal boundaries and the natural distal opening do not qualify. A still-active native bridge across that pair invalidates the sample. Missing, detached or invalid samples remain in the fixed denominator. Therefore initially adjacent, intact surfaces cannot earn closure credit.

A detached target component remains unresolved while grasped, within 3 mm of protected structures, or within 3 mm of retained tissue. This is a synthetic geometric clearance criterion, not pathological specimen handling. It requires actual relocation of surviving detached material; merely separating its graph component does not complete that gate. Locally ablated triangles have no remaining specimen component. Whole-face ablation and rest-area accounting retain the limitations described in [CUTTING.md](CUTTING.md).

Open jaws mean a jaw value of at least 0.95. The release monitor runs after every solver substep. Instrument shaft/jaw sample points include a conservative 0.5 mm radius when measuring tissue clearance. Closing a jaw, establishing a grasp, approaching tissue or issuing a cutting pulse resets the clock. A final observation must still satisfy release conditions. Wall-clock waiting does not advance simulated time.

The evaluator does not require a particular number of attachments. This follows C0's geometric closure criterion. Actual exposed edges that remain within tolerance without a tie may satisfy that geometric gate; the result cannot establish stitch quality or clinical wound stability. The tests explicitly distinguish an intact near-contact surface, which fails, from actual retained cut margins.

## Integrity checks and limits

Each substep compares the old and new face normals and tracks near-zero area or a normal reversal through a nonpositive dot product. Recorded invalid faces remain disqualifying if retained at assessment. This conservative check prevents a flipped or collapsed retained element from disappearing from the score after numerical recovery.

A three-dimensional shell has no universal signed volume per triangle. The substep check is not a finite-element Jacobian, exact continuous inversion detector or proof of global nonintersection. A rapid legitimate fold could be conservatively rejected; a highly curved self-intersection can require additional collision tests. Full retraction, folding and self-contact validation remain pending. Visual realism and clinical validity are separate from these synthetic checks.

## Finish and reproduction

The local `/api/finish` endpoint requires the same source/session/revision/idempotency and fresh-render conditions as a motion command. Unmet gates reject the request without changing the state. Successful finish freezes subsequent mechanical commands until reset. The UI exposes **Synthetic edge attachment**, **Advance 0.5 simulated seconds** and **Finish C0 assessment**; it labels the procedure incomplete until all gates pass.

```sh
node --test tests/*.test.mjs
node launch.mjs
# With actual Godot rendering active:
node probe-mechanics.mjs --closure --output evidence/local-closure-probe
node verify-mechanics.mjs evidence/local-closure-probe/report.json
```

The rendered development probe performs a local cut and attachment, releases the tools, withdraws and advances five simulated seconds. It must remain an incomplete procedure and reject finish. A separate numerical positive-control test prepares a complete cut/component fixture directly; that test is neither a low-level resection path nor a model episode. Final release still requires a complete low-level scripted workflow, the independent live episodes and all runtime gates.
