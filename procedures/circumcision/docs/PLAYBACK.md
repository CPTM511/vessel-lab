# Recorded playback

The adult module includes an explicitly labeled replay of the published two-movement Astra connectivity recording. Select **Replay recorded example** after launching the scene. Playback resets the specimen to the recording's seed, validates the record and its mechanical dependencies, then submits the recorded accepted commands one at a time. Each change must receive a new matching actual Godot image within five seconds. The original images are checked for integrity; they are not sent to Godot as substitute output.

This is recorded playback, not autonomous execution. Read-only model observations and originally rejected requests do not advance the replay; their original journal remains available. Original action durations are preserved, while model deliberation delays are omitted. The bundled example is a connectivity demonstration, not a complete C0 procedure.

Playback uses the same exclusive, revocable action lease as live control. Manual controls and new executions are locked during replay. **Stop execution** revokes the lease immediately and terminates the worker. Missing frames stop further playback; an already accepted command remains recorded even if its following image is unavailable. Neither a model connection nor model authentication is required for playback.

The recording parser requires the exact mechanical solver, contact, cutting, attachment, scenario, target definition, evaluator, rest cage and protocol hashes from the original run. Controller and UI changes may be compatible with playback; this does not transfer the original live evaluation result to those changes. The live verifier continues to require the original full source digest.

```sh
# Verify a completed local playback with its exact runtime:
node verify-playback.mjs sessions/<playback-run-directory>
# Export playback records without private session identifiers:
node export-playback-evidence.mjs sessions/<playback-run-directory> evidence/new-playback
```

The verifier independently replays the original mechanical decisions, validates their match to the playback journal, and checks the new JPEG hashes, control-source labels, state associations and feedback deadlines. It cannot reconstruct rendered pixels independently or establish clinical validity. Protocol test doubles use prerecorded transport images and are excluded from actual renderer evidence.
