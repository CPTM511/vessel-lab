# Adult anatomy research preview

An in-development Godot module for an adult circumcision tissue-manipulation benchmark. The current checkpoint provides original layered anatomical geometry and a real rendered inspection service. Cutting, physical retraction and autonomous procedure execution are **not yet implemented**. The released vessel-suturing benchmark remains available at the repository root and tag `v0.1.2`.

## Run

Use Godot 4 and Node.js 22 or later. From this directory:

```sh
node launch.mjs
```

On macOS, double-click `Start anatomy.command`. Set `GODOT_BIN` if Godot is outside the usual application locations. The preview uses Forward+; run `node launch.mjs --compatibility` for the fallback. The local inspection service listens on `127.0.0.1:8785`.

Drag to orbit, scroll to zoom, or select the covered, retracted, ventral and isolated anatomical views. The retraction slider is a **visual morph**, not a physical solver. An on-screen scale uses millimetres. Every captured image comes from the running Godot viewport; no rendered substitute is used when the renderer is unavailable.

```sh
node inspect.mjs --output evidence/local-inspection
```

This command saves actual images and source hashes for seven views. `--locked --samples 40` additionally requires affirmative macOS console and current-user lock flags throughout every sample. The probe is explicitly scripted and must not be reported as model evidence. It does not lock the computer or change power/security settings. Screen lock does not imply execution during system sleep.

## Research boundaries

See the frozen [prototype protocol](docs/PROTOCOL.md) for the mechanical, safety-volume, closure and independent-controller release gates. See [anatomy and assets](docs/ANATOMY_AND_ASSETS.md) for primary references and provenance. Geometry and textures are authored procedurally; no patient photographs or third-party anatomical meshes are bundled.

Visual realism, mechanical fidelity and clinical validity are separate claims. This checkpoint tests rendering and inspectability. It has no clinical validation and is not an operative guide. Final prototype acceptance, model evaluation and a new versioned release remain pending.
