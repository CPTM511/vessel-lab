# Adult anatomy research preview

An in-development Godot module for an adult circumcision tissue-manipulation benchmark. It provides original layered anatomy, bilateral low-level grippers, constrained tissue deformation, local swept cutting, component/area accounting, synthetic local attachments and actual rendered feedback. The current S1 checkpoint demonstrates numerical feasibility on three authored size cases and a 1,915-command expanded-case Godot trajectory with a preserved camera interruption and explicit scripted continuation. Independent evaluation has **five completed unsuccessful attempts and no successful episodes**. Previous access-check, synthetic-gate and rendered-feedback failures are preserved. See the [evaluation record](evidence/EVALUATION.md). Complete model outcomes and the final adult prototype release remain **pending**.

A short actual GPT-6 Astra connectivity check separately completed two model-selected translations with five real Godot images. Neither the scripted paths nor recorded playback are independent autonomy results. The released vessel-suturing benchmark remains available at the repository root and tag `v0.1.2`.

## Run

Use Godot 4 and Node.js 22 or later. From this directory:

```sh
node launch.mjs
```

On macOS, double-click `Start anatomy.command`. Set `GODOT_BIN` if Godot is outside the usual application locations. The preview uses Forward+; run `node launch.mjs --compatibility` for the fallback. The local inspection service listens on `127.0.0.1:8785`.

Drag to orbit, scroll to zoom, or select the covered, retracted, ventral and isolated anatomical views. In anatomy inspection, the retraction slider is a **visual morph**. Choose a seed for the next reset: **11**, **29** and **83** select compact, reference and expanded specimens. Selecting **Reset mechanics sandbox** disables that morph and exposes translation, orientation, grasp, release and local cutting controls backed by the tissue solver. Cutting requires an open, unoccupied instrument and is explicit for each jog or pulse. An on-screen scale uses millimetres. Every captured image comes from the running Godot viewport; no rendered substitute is used when the renderer is unavailable.

```sh
node inspect.mjs --output evidence/local-inspection
```

This command saves actual images and source hashes for eight views, including a dedicated meatal close-up. `--locked --samples 40` additionally requires affirmative macOS console and current-user lock flags throughout every sample. The probe is explicitly scripted and must not be reported as model evidence. It does not lock the computer or change power/security settings. Screen lock does not imply execution during system sleep.

## Model connectivity

After resetting the mechanics sandbox, choose **Verify Astra control loop** for two independently selected translations with actual image/state feedback. The current checkout also includes the [C0 source and instruction freeze](evaluation-freeze.json); **Start C0 procedure** requests an independent complete task from the selected initial seed. **Stop execution** revokes authority and stops the process group. The freeze enables evaluation and does not imply a successful model result. See [controller setup and boundaries](docs/CONTROLLER.md), [preflight evidence](evidence/c0-preflight.json) and [historical connectivity evidence](evidence/CONTROLLER.md).

## Recorded playback

**Replay recorded example** resets to the bundled seed and executes its recorded commands, requesting new actual Godot frames after each change. It performs no model inference. The example contains the two translations from the published connectivity check; it is not a complete procedure. The interface labels playback explicitly, and **Stop execution** revokes its action lease. Playback and live control cannot overlap. See [playback methods and verification](docs/PLAYBACK.md).

## Mechanical development

The preserved [resection failure](evidence/RESECTION.md) shows why a passing geometric score is insufficient: the earlier solver allowed retained-layer crossings and detached-shell self-intersections. The [anatomy and protected-surface checkpoint](evidence/ANATOMY_INTEGRATION.md), preserved at commit `3c87412`, records refined frenular/meatal geometry, conservative surface-derived exclusions and coupled rigid/shell contact. Its 2,023 bounded commands have actual Godot frames, maximum 2,490 ms feedback, zero proper crossings at 130 checkpoints and exact offline replay. The earlier missed-grasp collection failure remains preserved. No attachments were placed: retained edge proximity comes from authored geometry and recoil, not demonstrated suturing. The [previous complete scripted checkpoint](evidence/SCRIPTED_C0.md) remains a historical result at commit `b3df294`.

See [local cutting and independent area semantics](docs/CUTTING.md), [the mechanical model and controls](docs/MECHANICS.md) and [earlier scripted attachment evidence](evidence/CLOSURE.md). The local fixture demonstrates bilateral grasp/release, local cutting, one synthetic edge attachment and a released hold, with actual Godot images and independently reproduced topology and assessment. See [evaluator definitions and limitations](docs/EVALUATOR.md). It is not an autonomous episode or a completed procedure.

```sh
node --test tests/*.test.mjs
node probe-mechanics.mjs --closure --seed 11 --output evidence/local-mechanical-probe
node verify-mechanics.mjs evidence/local-mechanical-probe/report.json
```

The [S1 full-path and runtime evidence](evidence/S1_FULL_PATH.md) records the three numerical cases, failed development endpoints, segmented expanded-case rendering, final background verification and clean-source workflow. The earlier [S1 local evidence](evidence/SCENARIOS.md) preserves 237 actual actions across all three cases and the correct rejection of incomplete procedures. See [S1 scenario definitions](docs/SCENARIOS.md) for size cases, initial offsets and scope. Historical records require their exact source; no result is transferred silently to changed initial conditions.

## Research boundaries

See the frozen [prototype protocol](docs/PROTOCOL.md) for the mechanical, safety-volume, closure and independent-controller release gates. See [anatomy and assets](docs/ANATOMY_AND_ASSETS.md) for primary references and provenance. Geometry and textures are authored procedurally; no patient photographs or third-party anatomical meshes are bundled.

Visual realism, mechanical fidelity and clinical validity are separate claims. The scripted checkpoint tests a complete synthetic detachment/collection path; it does not establish clinical operative completeness, tissue realism or autonomous capability. It has no clinical validation and is not an operative guide. Final prototype acceptance, model evaluation and a new versioned release remain pending.
