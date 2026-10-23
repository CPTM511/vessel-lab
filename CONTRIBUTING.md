# Contributing

Vessel Lab is an experimental embodied-AI benchmark. Contributions should improve the environment, controller interface, evaluation reliability, or reproducibility while keeping experimental claims precise.

## Workflow

1. Describe the concrete behavior or experiment being changed.
2. Keep implementation, user-facing copy, comments, documentation, and release material in English.
3. Run `npm test` and the checks relevant to the change. Inspect the native Godot scene when changing rendering or interaction.
4. Include the seed, software versions, reproduction command, and relevant evidence in the pull request.

## Evaluation integrity

Keep model decisions separate from scripted fixtures and recorded playback. Preserve failed attempts. Changes affecting mechanics, controller policy, or scoring require a fresh declared evaluation; do not reuse an earlier success as evidence for a changed system. Never weaken checks simply to make a run pass.

## Privacy and artifacts

Do not commit credentials, local account metadata, machine-specific paths, raw private session records, caches, or unrelated assets. Publish sanitized examples and make the distinction between an original model run and a product replay explicit.

## Scope

The current milestone is a reproducible vessel-suturing benchmark. Physics approximations and unsupported clinical assumptions must remain documented. Additional procedures should have a separate proposal, mechanics model, and evaluator.

Contributions are distributed under the MIT license.
