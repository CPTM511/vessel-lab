# Local model controller

The adult module exposes a revocable local controller through Codex app-server dynamic tools. Godot remains the renderer; the Node service owns mechanical state. A controller decision cannot advance the scene without a matching session, revision and active lease. Each accepted change must produce a fresh actual Godot image within five seconds before another decision is accepted.

## Use

Start `node launch.mjs`, select a seed and choose **Reset mechanics sandbox**. With a current rendered observation, **Verify Astra control loop** starts a short live connectivity experiment. This mode exposes observation and translations of at most 1 mm per arm over 0.02–0.05 simulated seconds. Grasping, rotation, cutting, attachment and Finish are unavailable, including at the service boundary. The model chooses each displacement from returned feedback.

A locally authenticated Codex installation with access to `gpt-6-astra` is required. `CODEX_BIN` selects a custom executable. The bridge requests that exact model, disables provider fallback and inherits the configured reasoning effort. Environment tools are disabled; only the declared simulation tools are available. A failed access check stops before inference. The implementation does not provision credentials or services.

**Stop execution** revokes authority immediately and terminates the process group. Manual controls and reset remain locked until the controller exits. Closing the launcher also stops its controller. After completion, the interface identifies the last control source and restores manual interaction. Reset before starting another independent run.

**Start C0 procedure** is available after a fresh reset when `evaluation-freeze.json` matches the simulation, evaluator, Godot source, controller instructions, tool schemas and task prompt. The current checkout bundles the C0 freeze for seeds **11, 29 and 83**, backed by the [recorded preflight](../evidence/c0-preflight.json). Restart the launcher after installing a new freeze. The three independent procedure episodes remain pending; the short historical connectivity check is excluded from that denominator.

The [65-check regression suite](../evidence/c0-frozen-tests.txt) passes with this freeze present. Protocol doubles remain distinct from actual model evidence.

## Observation and action contract

The full procedure interface defines `anatomy.observe`, `geometry`, `inspect`, `step` and `finish`. Geometry queries return explicitly requested face coordinates or spatial measurements. They never select a trajectory or modify the specimen. A step chooses absolute instrument pose, jaw and bounded local cut/attachment operations; no high-level procedure macro or reference trajectory is supplied to the model.

The controller records requested actions before execution, accepted commands before waiting for feedback, and actual images with source/state/geometry hashes. An accepted command whose rendered observation is missing remains in the journal and terminates the run. Rejected mechanical commands retain the error and unchanged observation. Protocol doubles and prerecorded transport images are labeled as tests; they are excluded from live evidence.

```sh
# Verify a private recorded run using its exact executed source:
node verify-controller.mjs sessions/<run-directory>
# Verify the historical sanitized live connectivity evidence at commit 621436e:
node verify-controller.mjs evidence/controller-loop-01
# Export a record without local access checks and session identifiers:
node export-controller-evidence.mjs sessions/<run-directory> evidence/new-record
```

The actual connectivity journal belongs to source621436e. Exact live-evidence verification requires that revision; later playback uses unchanged mechanical definitions and makes no new live-model claim.

Verification replays each recorded low-level choice, checks the resulting observation and mesh hashes, and checks JPEG integrity and state association. It cannot reconstruct rendered pixels from mechanical state or independently prove the renderer's visual accuracy. Public records omit private access/session metadata; the verifier reports that those private checks were not independently verified from the public export.

The experimental app-server interface is documented in the [official app-server reference](https://learn.chatgpt.com/docs/app-server). This checkpoint was checked against the locally installed schema and an actual runtime exchange. Runtime compatibility beyond the recorded version is unverified.
