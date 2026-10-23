# Resection feasibility and contact failure

**INCOMPLETE.** A 1,715-action numerical instrument trajectory satisfies the existing C0 geometric score, but an independent mesh audit detects interlayer and self-intersection defects. The graphical run was stopped when this defect was established. This checkpoint does not complete the procedure prototype and contains **no live model episode**.

## Numerical trajectory

All state changes use the existing bounded pose, jaw and cut actions. No faces or specimen positions are edited directly. The fixture uses seed 11, local retained-surface traction, swept cuts, repeated proximity-based specimen grasps, instrument withdrawal and simulated released time. The complete numerical endpoint has:

- 192 ablated faces; 100% of the declared target detached and zero non-target area removed.
- Zero recorded instrument/protected-volume intersections and zero retained elements flagged by the existing orientation/collapse check.
- 48/48 exposed retained edge samples within 1 mm; 5.7333 simulated seconds released; no unresolved target component under the existing 3 mm clearance check.
- Zero synthetic attachments. This fixture's geometric edge approximation comes from relaxation of the original shell geometry. It does not demonstrate sutures, knots, physiological closure stability or clinical success.

The [development record](resection-development.json) preserves the unsuccessful checkpoints. These are related numerical continuations, not independent autonomous attempts.

| Checkpoint | Actions from reset | Remaining C0 geometric failures |
|---|---:|---|
| Circumferential resection | 1,188 | Edge approximation, released hold, specimen clearance |
| Initial opposite-point extraction | 1,354 | Specimen clearance |
| Extended opposite-point extraction | 1,377 | Specimen clearance |
| Quarter-point regrasp | 1,516 | Specimen clearance |
| Distal-fold regrasp | 1,658 | Instrument clearance/released hold |
| Further instrument withdrawal | 1,715 | None; independent contact audit still fails |

## Why the geometric score is insufficient

The [static mesh audit](resection-mesh-audit.json) detects **42 proper crossings involving retained faces and 4,836 involving detached faces** at the complete numerical endpoint. Initial geometry has zero detected crossings. The retained witnesses include outer and inner surfaces near the proximal inner-layer boundary. Detached tissue folds through itself during collection. The shell's current distance constraints and glans projection do not provide non-adjacent surface contact handling.

`mesh-audit.mjs` uses a spatial grid and interior segment/triangle intersections. It excludes adjacent faces, records witness face IDs and intersection points, and distinguishes retained, detached and mixed pairs. Its analytical controls detect a crossing and reject separated geometry. This diagnostic does **not** cover coplanar overlap, near-contact thickness or continuous collision; passing it alone would not establish a correct contact solver. The 42/4,836 figures are intersecting face-pair counts, not clinical damage measurements.

The frozen C0 numbers have not been changed. The already-required large-deformation and self-contact validation remains unmet. Improving contact handling and checking the resulting deformed meshes must precede a new complete graphical run and any independent controller evaluation.

## Actual Godot record

[The interrupted graphical run](resection-attempt-01/report.json) contains 267 fully recorded actions with fresh Forward+/Metal frames. Maximum measured action-to-frame feedback was 1,891 ms; both OS lock flags were true before and after every timed action. One further accepted action was in progress at interruption. Its actual state and frame were recovered separately at mechanical revision 268; its feedback latency was not measured and is excluded from timing claims.

The actual stopped state has 38 cut faces, 1.559608% target detached and zero off-target removal or protected-volume hits. An [audit of that actual recovered geometry](resection-contact-localization.json) already detects 20 retained interlayer crossings at revision 268. The defect therefore precedes detached-specimen collection and is present in the graphical experiment as well. It has not completed resection or the procedure. Every completed frame, the streaming action journal, the recovered action and the interruption reason are retained. The full 1,715-action sequence in `trajectory.json` is a **numerical scripted fixture**, not a claim that all of it ran in Godot.

## Reproduce

From the adult module directory, with this checkpoint's source:

```sh
node --test tests/mesh-audit.test.mjs
node verify-mechanics.mjs evidence/resection-attempt-01/report.json
node verify-development.mjs evidence/resection-development.json
```

The first replay checks actual observations, geometry/topology, source fingerprints, image hashes and the recovered interrupted action. The numerical replay independently reproduces every development checkpoint, including the alternate initial extraction, and verifies the crossing witnesses. Both are offline and require no model inference.

`probe-trajectory.mjs --trajectory <record> --output <new-directory>` can execute an explicit scripted action record with a fresh Godot image after each action. Output ownership is exclusive; failed attempts must not be overwritten. Do not rerun the known-defective complete fixture as a release test. Fix contact handling first, preserve this checkpoint, and regenerate task-affecting evidence.

For the contact implementation, [Small Steps in Physics Simulation, sections 4.2–4.3](https://matthias-research.github.io/pages/publications/smallsteps.pdf) provides a primary reference for collision candidate generation and nonpenetration inequalities. It also discusses missed contacts and depenetration artifacts. This is an implementation reference, not evidence that the present simulator implements those methods.
