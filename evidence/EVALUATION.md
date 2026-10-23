# Vessel suturing v1 evaluation

Five independent live GPT-6 Astra episodes completed the declared seed set **1, 7, 42, 99, 2026**. All five passed the unchanged closure, secured-knot, trim, release and synthetic-damage checks. Per-episode measurements and rejected commands are retained below.

| Seed | Step calls | Godot observations | Rejected tool calls | Coverage | Damage | Maximum gap (mm) | All five checks |
|---|---:|---:|---:|---:|---:|---:|---|
| 1 | 59 | 65 | 0 | 100.00% | 0.000 | 0.081700 | Passed |
| 7 | 60 | 66 | 0 | 100.00% | 0.000 | 0.081802 | Passed |
| 42 | 63 | 133 | 1 | 100.00% | 0.000 | 0.081647 | Passed |
| 99 | 62 | 130 | 1 | 95.83% | 0.030 | 0.553197 | Passed |
| 2026 | 59 | 66 | 0 | 100.00% | 0.000 | 0.081643 | Passed |

## Protocol and provenance

The seed set and shared instructions were fixed before this evaluation. Each episode started from a reset scene in a separate ephemeral model thread. The model selected every bounded low-level movement and received actual Godot camera frames and instrumented state after successful tool calls. No operator commands or injected trajectories were used. Simulation time paused during inference; wall time includes controller startup and completion polling and is not simulated procedure time.

Runtime source baseline: `48b6799`. SHA-256 source-manifest digest: `5f99a4b67661585ad3b308d1a3322d36f17a14bd2f9003022b2eea46efbcbae8`. The full file manifest and controller-instruction/tool-schema/task hashes are embedded in the sanitized episode records. Subsequent publication changes do not modify the evaluated runtime files.

All **5 attempted episodes passed**; none was omitted or automatically retried. The set includes **2 rejected tool call(s)**, retained in the corresponding episode's `toolErrors` and `rejectedCommands`. Rejected actions did not bypass the environment's bounds. The historical prototype seed-42 recording is separate and is not included in this denominator. Scripted mechanics and renderer tests are also separate from these live-model results.

Each episode passed offline replay, action-to-command correspondence and JPEG hash checks. Sanitized evidence preserves actions, observations, rejected commands, source hashes and rendered frames while excluding authentication and private session metadata. It is reproducible local evidence, not third-party attestation.

## Records and reproduction

[Machine-readable summary](evaluations/summary.json)

- [Seed 1 episode](evaluations/attempt-01-seed-1/episode.json) — 65 frame files in the same directory.
- [Seed 7 episode](evaluations/attempt-02-seed-7/episode.json) — 66 frame files in the same directory.
- [Seed 42 episode](evaluations/attempt-03-seed-42/episode.json) — 133 frame files in the same directory.
- [Seed 99 episode](evaluations/attempt-04-seed-99/episode.json) — 130 frame files in the same directory.
- [Seed 2026 episode](evaluations/attempt-05-seed-2026/episode.json) — 66 frame files in the same directory.

From the matching `v0.1.2` release checkout:

```sh
for episode in evidence/evaluations/attempt-*/episode.json; do
  node verify-public.mjs "$episode"
done
```

To generate a new declared set with the graphical Godot client and local service running, execute `node evaluate.mjs`. The runner stops on a failed episode, preserves the ledger and rejects continuation after source changes. It does not silently retry failures.

## Runtime and scope

[Runtime verification](RUNTIME.md) records actual background and locked-macOS rendering, fresh-frame checks, process cleanup and clean-source replay. [Verification overview](VERIFICATION.md) retains the earlier prototype evidence. The public verifier also rejected deliberately tampered action and frame records (`public-verifier-check.json`).

These five seeds are a small fixed fixture set, not a population success-rate estimate. Mechanics remain fixture-supported annular lips, tensile distance constraints and a geometric winding rule. There is no independent lumen collapse, tissue tearing model, blood flow, pressure leakage test, true knot topology or full robot dynamics. Passing this benchmark does not establish clinical validity or real surgical capability.
