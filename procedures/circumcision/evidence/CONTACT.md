# Continuous shell contact development checkpoint

**Procedure validation remains incomplete.** The current solver adds frictionless contact between non-adjacent tissue triangles. This checkpoint targets the retained-layer intersections identified in the [preserved resection failure](RESECTION.md). It is scripted engineering evidence, not an autonomous episode, complete procedure or clinical validation.

## Method

`contact.mjs` filters each proposed mechanical substep before it becomes state. A swept spatial grid identifies nearby active triangles. Fixed separating planes and swept bounds reject separated pairs. Remaining pairs use closest vertex/triangle and edge/edge features with conservative advancement. The projected separation and closing speed of each vertex pair bound advancement along the linear vertex trajectories. This formulation also handles coplanar approach; it does not rely only on a final-frame crossing test.

A synthetic **0.03 mm** contact gap, floating-point tolerances and bounded iteration counts are implementation parameters, not measured tissue thickness. Frictionless contact constraints participate in subsequent distance-constraint iterations. Cut faces leave contact handling; separated contact anchors expire. If simultaneous constraints cannot be resolved, the solver limits the proposed motion to a computed conservative fraction. It exposes the resulting grasp error and cumulative contact-limited substeps. A contact-detection count includes repeated solver detections and is not a count of injuries or distinct physical events.

Faces sharing a vertex are treated as topological neighbours and excluded from this contact pass. The method assumes a separated initial mesh and linear vertex trajectories between accepted substep states. It uses floating-point arithmetic, not an exact-predicate or formally verified collision kernel. Glans contact remains a separate sampled, node-based rigid-fixture projection. Full folding, detached-specimen collection, force fidelity and adjacent-face contact still need validation.

The implementation is original project code. [Tang, Kim and Manocha, *Continuous Collision Detection for Non-rigid Contact Computations using Local Advancement*](https://gamma-web.iacs.umd.edu/papers/documents/articles/2010/tang10.pdf), sections III and V, provides the primary reference for projected motion bounds and conservative advancement of deforming primitives. No external collision library or anatomical asset was incorporated.

## Regression scope

The declared fixture repeats the first **268 low-level commands** from the historical resection attempt and appends one **0.5 simulated-second** stationary command. It does not edit tissue state directly. The old revision-268 geometry had **20 retained crossing face pairs**. A numerical replay with the new solver has zero proper crossings at that revision, with 38 cut faces and zero off-target removal or protected-instrument intersections. The additional hold tests the maximum allowed command duration under active contact.

The [actual Godot record](contact-attempt-01/report.json) completed all **269 commands and fresh Forward+/Metal images**. Maximum action-to-frame latency was **3,668 ms**, on the 0.5-second hold. Both OS lock flags were true before and after every action. The eight declared geometry checkpoints, including revisions 268 and 269, have **zero proper retained, detached or mixed crossing pairs**. All 38 cut faces, zero off-target loss and zero protected-instrument hits were retained. Target detachment is only **1.559608%**: the procedure is still incomplete, and finish was correctly rejected.

[Independent offline verification](contact-verification.json) reproduces every observation, geometry/topology hash, mesh checkpoint and image hash. The [prefix comparison](contact-prefix-comparison.json) confirms that the original 268 commands were unchanged. [Three corruption controls](contact-verifier-negative-controls.json) reject an omitted contact source hash, a missing mesh checkpoint and a changed image. Separate [actual layer views](contact-views/report.json) inspect inner and protected structures without changing mechanical geometry.

The solver used its conservative fallback in 91 substeps across this fixture. Peak observed grasp error was below 4e-15 mm for this sequence; this does not establish calibrated grip or force behavior. The complete resection/collection trajectory must still be rebuilt and inspected with the changed mechanics. No live model episode has been run.

The separate static audit checks proper non-adjacent triangle crossings and records witness pairs. It does not detect every coplanar overlap, geometric degeneration or near-contact problem. Its counts are geometry diagnostics and do not establish biological damage or clinical success. The original C0 numeric gates and live seeds remain unchanged.

## Longer numerical resection test

A subsequent instrument-driven numerical path reached the final circumferential face with no detected retained or detached crossings, then [failed a protected-volume check](contact-resection-attempt-01.json) at command 1,184. The tool tip was 0.493231 mm from the glans proxy, inside the unchanged 0.5 mm instrument envelope. This failed attempt is preserved.

A related [corrected continuation](contact-resection-attempt-02.json) replays the 1,183-command safe prefix and changes the final approach to retain a measured clearance margin. It completes circumferential detachment at **1,188 commands**: 192 ablated faces, 100% target detached, zero off-target removal, zero protected-tool intersections and zero proper mesh crossings at that endpoint. The correction changes the low-level scripted path, not the simulator or thresholds.

This initial result was **numerical only**. The same resection path has subsequently been verified with actual Godot feedback, as recorded below. Specimen collection and released closure remain pending; it is not a full C0 pass or an independent model episode.

The subsequent [proximal-rim collection attempt](contact-collection-attempt-01.json) was stopped at its last saved checkpoint, command 1,304. It has zero detected crossings, but the solver advances zero of the proposed motion, both grasp errors exceed 34 mm, and a numerical command alone took 24,877 ms. This is an unresolved contact-response and usability failure, not successful collection. The early regression alone did not justify a complete procedure or model evaluation. A separate [distal-traction diagnostic](contact-distal-collection-attempt-01.json) stopped at command 1,295 with 1.069 mm grasp lag. Four [stationary relaxation commands](contact-distal-relaxation-01.json) reduced that lag to 0.064 mm. A subsequent [feedback-paced continuation](contact-adaptive-collection-01.json) reached command 1,603 with zero detected crossings but stopped when a held grasp remained 0.115 mm displaced after its bounded relaxation loop. Its slowest numerical command took 3,329 ms; no rendered latency was measured. These are related numerical experiments, not independent model attempts. Their diagnostic stopping limits do not replace or change C0 acceptance. Collection response and runtime remain unresolved.

## Controls and evidence

- [Mechanical and contact test output](contact-tests.txt): 30 tests, including fast tunnelling, edge/edge approach, coplanar sliding, moving broad-phase bounds, fixed points, grasp, cutting and evaluator regressions.
- [Deforming-pair stress test](contact-stress-tests.txt): 100 deterministic two-face motions with 65 sampled path checks each. This supplements the analytical controls; it is not a proof of general collision correctness.
- [Protected-query equivalence](contact-query-equivalence.json): 10,000 deterministic numerical queries compared with the previous sampled-hull implementation. Signed distance and normal differences were zero. This checks an implementation optimization, not anatomical accuracy.
- Earlier unsuccessful contact implementations and timing probes are retained in development records. Excessive conservative limiting and slow long-duration commands were diagnosed before the rendered regression. They are not independent model attempts or performance benchmarks.

From this checkpoint's source, with Godot running:

```sh
node --test tests/contact.test.mjs tests/mechanics.test.mjs tests/cutting.test.mjs tests/evaluation.test.mjs tests/mesh-audit.test.mjs
node probe-trajectory.mjs --trajectory evidence/contact-attempt-01/trajectory.json --output evidence/local-contact-probe
node verify-mechanics.mjs evidence/local-contact-probe/report.json
```

Use a fresh output directory. Source fingerprints include the contact solver and mesh audit. Offline verification reproduces actions, observed state, geometry, topology, declared mesh checkpoints and actual image hashes. Historical reports require their recorded source revision; they must not be silently reinterpreted using a changed solver.

## Allocation optimization

A subsequent implementation change removes temporary vector arrays from repeated feature-distance queries while preserving arithmetic order. The [exact-parity record](contact-allocation-check.json) checks 10,000 deterministic random motions, 12 recorded grazing motions, and the complete 1,603-command adaptive-collection prefix. The final observation, every node and the contact cache match the earlier implementation exactly. All [31 mechanical/contact tests](contact-allocation-tests.txt) pass.

In one paired numerical timing diagnostic on the same saved state, six stationary 0.05-second commands took 3.0–3.2 seconds each with the prior implementation and 0.9–1.1 seconds each after the change. The resulting snapshots and contact caches were exactly equal. This is a small timing diagnostic, not a general benchmark or a rendered-latency claim. The optimization does not resolve the recorded collection failure. The complete rendered resection test below subsequently passed its declared fixture checks.

## Actual circumferential detachment

The [complete rendered resection fixture](resection-contact-rendered-01/report.json) records **1,188 bounded commands and fresh Godot Forward+/Metal images**, with a maximum feedback latency of **2,608 ms**. It removes 192 cage faces and detaches 100% of the immutable target area, with zero off-target removal and zero protected-instrument intersections. All **25 mesh checkpoints** have zero proper retained, detached or mixed crossing pairs. [Independent offline replay](resection-contact-rendered-verification.json) verifies every action, observation, geometry/topology hash, image hash and declared mesh checkpoint.

Both host lock flags were true before and after 1,187 commands. The before-action host query was unavailable at command 637; its after-action flags were true. That single unknown observation is preserved and is not counted as confirmed locked throughout. This record does not establish unlocked-background behavior or execution during system sleep.

The rendered endpoint is **not a C0 procedure success**. Edge approximation, the five-second released hold and detached-component clearance remain unmet, and Finish correctly rejects it. The image sequence shows circumferential separation; it does not show completed specimen collection or a model-controlled procedure.

A later [fine lateral-traction numerical continuation](contact-fine-collection-01.json), after independently replaying its 1,603-command prefix with the optimized source, stopped at command 2,029. It retained zero proper crossings but a grasp remained 0.153 mm displaced after its bounded waiting loop. The slowest numerical action took 1,779 ms. The diagnostic stopping threshold is a control-development choice, not a changed C0 acceptance gate. Collection response remains an unresolved engineering issue.
