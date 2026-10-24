# C0 independent controller evaluation

**Round5 finished2/3: seeds11/29 succeeded, while seed83 failed detached-component collection. Across all rounds there are two successes and six unsuccessful attempts.** The adult prototype has not met its release gate.

The [initial source and instruction freeze](evaluation-rounds/round1-freeze.json) was published at `47488cc1ed2a593021d28d5099ae6c16a6b9d119` before evaluation began. Runtime digest: `d5dc3ac1de7d5f322460c8b5aaad7eed6a34a65474cd95c75fd9f59e325acc8b`. The declared seeds remain **11, 29 and 83**; all three complete case successes are required by [protocol C0](../docs/PROTOCOL.md). Every attempt, including infrastructure interruptions, remains in the [evaluation ledger](c0-evaluation-status.json). The historical two-translation connectivity check is excluded from this denominator.

## Round1 seed 11, attempt 01

| Measure | Result |
| --- | --- |
| Actual model / provider | `gpt-6-astra` / `openai` |
| Reasoning effort | Inherited `xhigh` |
| Start / stop | 2026-10-24 09:22:31 / 09:25:05 UTC |
| Model tool requests | 17 |
| Accepted mechanical moves | 9 |
| Actual image responses | 16: 15 successful results and one rejected-action observation |
| Mechanical rejection | One translation exceeding the 4 mm command limit; the model adjusted and continued |
| Last requested action | Not executed; access check failed before simulation access |
| Maximum accepted-command feedback time | 1,739 ms |
| Final mechanical revision | 9 |
| Cuts / protected intersections | 0 / 0 |
| Accepted Finish | None |
| Outcome | Infrastructure interruption; unsuccessful complete-procedure attempt |

The run began from a fresh reset and model context. The frozen controller supplied low-level anatomy tools and actual Godot observations, with no injected trajectory or operator action. The journal preserves the model's original narration, selected camera, geometry queries, all movement requests, the rejected translation and the unexecuted final request.

The terminal error is RPC `-32603`: an external usage-status network request failed. The controller stopped before the next requested operation and exited with an error. This event establishes neither exhausted access allowance nor inability to complete the synthetic procedure. There was no automatic retry in the episode. A later post-stop snapshot matches the final recorded mechanical observation and geometry/topology hashes; it is not a further model observation.

## Reproduction and limits

From `procedures/circumcision` at this evidence revision:

```sh
# Verify the accepted prefix and its real image associations only.
node verify-controller.mjs evidence/c0-seed-11-attempt-01 --aborted-access

# Expected to fail: the record has no successful procedure completion.
node verify-controller.mjs evidence/c0-seed-11-attempt-01

node --test tests/controller-interruption-record.test.mjs
```

The interruption verifier reproduces every accepted mechanical state, geometry/topology query and mechanical rejection, checks actual JPEG hashes and revision associations, and requires exactly one final unresolved request with the recorded access-check error. It returns `recordVerified: true` and **`episodeSucceeded: false`**. The default verifier still requires completed-turn evidence and accepted Finish. [Seven focused tests](c0-interruption-tests.txt) cover the valid partial record, strict completion rejection and five corruptions: unrelated failure cause, fabricated completion, accepted final request, missing earlier result and changed image.

The [public journal](c0-seed-11-attempt-01/agent.jsonl), [16 unchanged JPEGs](c0-seed-11-attempt-01-export.json) and [partial-record verification](c0-seed-11-attempt-01-verification.json) omit private access checks and session identifiers. Recorded private checks preceding the interruption were verified locally. The final access check failed, so a complete post-run access verification is unavailable. Public verification cannot establish redacted private checks. Numerical replay checks recorded image integrity and association; it does not reconstruct pixels or provide clinical validation.

The [preflight record](c0-preflight.json) remains unchanged. Its scripted feasibility and renderer/workflow checks do not count as independent controller successes. Visual realism, mechanical fidelity and clinical validity remain separate, with the previously documented passive approximation, high strain, sampled contact and uncalibrated-material limitations.

![Actual Godot UI after the controller stopped](c0-seed-11-attempt-01-ui.jpg)

## Subsequent failed attempts and targeted corrections

Round1 seed29 completed its model turn after24 accepted moves and31 actual images, without accepted Finish. It recorded3 protected contacts,0.826% target detachment and12.5% edge coverage. The accepted states reproduce exactly. Counterfactual replay identifies translation as the mechanical contact trigger: the damaging move still contacts protected geometry with cutting disabled or rotation unchanged; a stationary control does not. The controller contract omitted the separate0.5mm instrument-contact threshold and shaft/jaw sampling semantics. Round2 disclosed those existing mechanics without changing thresholds or supplying a trajectory. This omission is a plausible contributor, not proof of the model's internal reasoning.

Round2 seed11 accepted75 moves and received140 actual model image responses. Its final accepted action took4,273ms to compute and failed to obtain a fresh rendered observation by the unchanged5-second deadline. All accepted states, including the final one, reproduce exactly. Target detachment reached100% with zero protected contacts and zero off-target removal, but release and component collection remained incomplete. A later screenshot is not substituted for missing timely model feedback.

CPU profiling identified allocation-heavy shell contact filtering. A candidate optimization removes temporary arrays and callbacks while retaining identical geometric checks, order and tolerances. All75 recorded observations and paired final full snapshots match exactly. Explicit scripted playback with actual Godot images completed75 actions with maximum4,010ms feedback, zero audited crossings and the same incomplete final assessment. This validates this path, not arbitrary-path performance or autonomous success. See [scripted performance evidence](evaluation-rounds/contact-performance.json). Every earlier failed attempt remains in the denominator; runtime changes require a new freeze and fresh independent cases.

```sh
node verify-controller.mjs evidence/c0-seed-29-attempt-01 --incomplete
node verify-controller.mjs evidence/c0-round2-seed11-attempt01 --frame-failure
node --test tests/controller-unsuccessful-record.test.mjs
```

Both failure-verification modes return `episodeSucceeded: false`; default successful-episode verification rejects these records. Historical source bundles bind replay to the exact executed runtime instead of replaying against changed mechanics.

Round3 seed11 began at2026-10-24 10:56:23 UTC under published commit`4726d5df45a192912d784ca38dfdea572ad4d95a`, runtime`b51db9fee0baa0223c905a8f4ed3b734dc8862c255e730079e327089474386ae`. It ended unsuccessfully at 11:31:46 UTC after 100 accepted moves and 153 actual image responses. The final accepted collection action missed the unchanged five-second feedback deadline. Full detachment, protected integrity and edge proximity passed, but collection and released hold did not. No successful Finish was recorded.

## Round 4 preparation

The targeted contact and mesh-template optimizations passed the [recorded validation](evaluation-rounds/round4-validation/METHOD.md). The [new source freeze](../evaluation-freeze.json) preserves the same declared seeds, exact model, controller instructions and C0 thresholds. All four previous failed attempts remain reported. No round 4 outcome is implied by scripted validation.

## Round 4 outcome and round 5 preparation

Round 4 seed 11 ended unsuccessfully after 89 accepted moves and 157 actual images. A collection action missed the five-second actual-frame deadline. Target detachment, protected and non-target integrity, and edge proximity passed; collection and released hold remained unmet. The [runtime observability correction](evaluation-rounds/round5-validation/METHOD.md) exposes measured action cost and the existing deadline without changing physics, rendering, action ranges or C0 gates. The new freeze precedes fresh independent evaluation; no success is implied by its scripted or protocol checks.


## Round5 seed11: completed C0 episode

The fresh exact `gpt-6-astra` / `xhigh` episode ran from12:35:07 to13:29:46 UTC on2026-10-24 under frozen runtime `541fa1f89ec5546454acb94e5c8c6cf773ee0ffd11dc18fce5f63cc1e2149d4e`, published before the run at `e0602d9`. It completed165 model-selected mechanical actions and221 actual rendered tool responses, with no rejected commands and maximum3,535ms accepted-command feedback. All C0 gates passed, including100% target detachment, zero off-target removal/protected contacts,48/48 edge samples within tolerance, resolved target components and5.0417 simulated seconds of released hold. Finish was accepted and the model turn completed naturally.

The [record](c0-round5-seed11-attempt01/agent.jsonl) retains the actual decisions and unchanged images. [Verification](c0-round5-seed11-attempt01-verification.json) reproduces every numerical state and checks image integrity/association and measured timing metadata. Private pre/post checks were verified locally. This is one authored synthetic case, not proof of general reliability, anatomical accuracy or clinical validity; passive edge approximation and detached-shell crumpling remain disclosed limitations.

```sh
node verify-controller.mjs evidence/c0-round5-seed11-attempt01
```


## Round5 seed29: completed C0 episode

A fresh context and reset under the same frozen runtime completed96 model-selected actions and132 actual image responses from13:37:30 to14:09:13 UTC on2026-10-24. Exact `gpt-6-astra` / `xhigh`, no rejected commands, maximum2,846ms feedback. All C0 gates and Finish passed:100% target detachment, zero off-target removal/protected contacts,48/48 edge samples within tolerance and5.0083 simulated seconds of released hold. All states and image associations reproduce exactly; private pre/post checks passed.

[Original decisions and images](c0-round5-seed29-attempt01/agent.jsonl) and [verification](c0-round5-seed29-attempt01-verification.json) retain the same scope and limitations as seed11.

```sh
node verify-controller.mjs evidence/c0-round5-seed29-attempt01
```


## Round5 seed83: unresolved detached component

The independent episode ended14:57:30 UTC after160 accepted moves and210 actual image responses. Maximum feedback was3,336ms; no frame deadline failed. Target detachment reached100%, off-target removal/protected contacts remained zero,48/48 edge pairs passed and released hold reached5.0117 simulated seconds. Finish was rejected because one detached component remained within3mm of protected anatomy. The model reported the incomplete result without claiming success.

The [original record](c0-round5-seed83-attempt01/agent.jsonl) preserves contact limiting, retreat, release, local target cuts and the rejected Finish. Beginning at mechanical revision133, multiple substeps report zero permitted advancement. This is a diagnostic observation, not yet a proven root cause or a reason to relax collection/contact thresholds. No unchanged retry is counted.
