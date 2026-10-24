# Rigid contact projection correction

Round5 completed two of three independent cases. Seed83 ended with one detached component within3mm of protected anatomy; Finish was rejected. All eight historical attempts remain in the evaluation ledger. This correction does not reinterpret that failure.

## Cause and counterfactual

Exact replay reproduced all160 accepted states. At revision133 the shell sweep had no remaining collision candidates, but rigid node1509 repeatedly missed the unchanged0.1mm residual margin: old residual0.100002129mm, proposed residual0.099998936mm. The provided cross-section normal has zero axial component although the sampled distance residual has an independently measured axial derivative of0.759994 at that point. Alternating projection therefore did not converge within the bounded solver, which conservatively returned zero advancement.

The correction computes the local gradient of the same residual using central differences at0.0001mm and scales the projection by the gradient norm. Bounded-query/nonfinite fallbacks retain the provided normal. Every proposal is still checked against the original rigid margin and continuous shell sweep. No anatomical surface, evaluator threshold, command limit, controller instruction, fixed timestep, collision gap or final hold changed.

`verify-contact-projection.mjs` reconstructs three frozen failure states from the published journal and compares the identical0.1s command. The original solver moves no nodes; corrected projection restores motion while preserving simulated elapsed time, rigid margin, protected/off-target checks and zero audited proper crossings. This is a numerical counterfactual, not an autonomous procedure success.

Two rejected candidates are retained: starting rigid-only backtracking at one produced only small motion before re-locking; adaptive integration recovered some states but a later command required more than21 seconds of computation. Neither was adopted or used in a live evaluation.

## Verification

The corrected saved-state continuation executes the original28 commands from revision132 in actual Godot Forward+. All images and observations are preserved in `rendered-tail/`. Exact numerical/image-hash verification passed, with maximum3,230ms command-to-frame latency, minimum sampled rigid residual0.0999999999999987mm within the existing1e-9 numerical tolerance, and zero proper crossings. The endpoint still fails collection because the recorded model had abandoned it; this is not a replacement successful episode.

Seventeen focused contact regressions and31 anatomy/mechanics/cutting/evaluation/scenario/audit regressions pass. Existing broad-phase pair ordering and150 near-gap shell queries remain identical to the archived implementation. Offline compute timings are diagnostic, may include concurrent checks, and are not substituted for actual rendering measurements.

Preserved full-path replay exposed source-sensitive endpoints: seed11 reached only4.9417 seconds of released hold and required a separately recorded0.1-second scripted continuation; seed29 passed unchanged. The canonical seed83 path failed component collection. Two subsequent single-grasp attempts and a held relaxation also failed and are retained. A separately documented227-action bilateral collection continuation finally passed every unchanged gate, with5.0067 seconds released hold and4.3777mm minimum component clearance. These are scripted feasibility checks, not new autonomous successes. All228 actual continuation frames verify exact observations and JPEG hashes, with maximum1,341ms feedback, minimum sampled rigid residual0.12883mm and24 zero-crossing audits. The records are stored under `rendered-collection/`.

The historical default playback recording is mechanically source-bound. A fresh exact-model two-move recording now replaces the default example, with five actual images and independent verification. The original recording is preserved under `evidence/controller-loop-original/`. New actual Forward+ replay also verifies both moves; old playback success was not reused for corrected mechanics. A new source freeze must precede all new independent procedure episodes. Prior renderer, UI, lifecycle and transport evidence applies only where source remains unchanged. Visual realism, mechanical fidelity and clinical validity remain distinct; no clinical validation is established.


## Reproduction inputs

Run `node verify-contact-projection.mjs` from the adult module for the exact-state lock counterfactual. The full-path numerical reports use the preserved round5 seed11/29 model journals and `evidence/s1-full-83/trajectory.json`. For seed83, apply that canonical trajectory with the corrected runtime, then each explicit `actions` array from `full-paths/seed-83-collection-continuation-01.json`, `seed-83-collection-continuation-02.json`, `held-relaxation-01.json` and `seed-83-bilateral-continuation-01.json`, in that order. Intermediate failed Finish assessments do not advance mechanics. The terminal successful Finish follows revision2350. This assembled scripted chain preserves failed collection attempts and is not an uninterrupted model episode. Actual continuation frames begin at revision2124; the earlier corrected prefix has numerical replay evidence, not a claim of newly rendered full-path evidence.
