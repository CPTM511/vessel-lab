# Synthetic scenarios S1

S1 defines reproducible initial conditions for protocol C0. The three predeclared evaluation seeds select authored size cases. They are deliberately separated engineering cases, not random samples from an anatomical population. No live model episode informed their selection.

| Seed | Profile | Uniform specimen scale | Nominal length |
| --- | --- | --- | --- |
| 11 | compact | 0.92 | 89.5 mm |
| 29 | reference | 1.00 | 97.3 mm |
| 83 | expanded | 1.08 | 105.1 mm |

The same original anatomical surfaces, mechanical cage, immutable target topology and protected volumes scale together. Initial target areas therefore scale with the square of the length scale. The instruments, workspace, movement limits and C0 thresholds retain their original millimetre values. Mechanical parameters are unchanged and remain uncalibrated.

Each instrument starts open, with zero Euler rotation, near `[34, 24, ±16] × scale` mm. A deterministic integer stream adds an independent offset in `[-2, 2)` mm on each axis. It defines only initial positions; it does not supply an action sequence or treatment plan. Other unsigned 32-bit seeds select a generated uniform scale in `[0.90, 1.10)` and corresponding initial offsets. Their solvability has not been established by the declared three-case checks.

The scene displays the active seed, actual scale and nominal length. The seed input applies to the next reset. Captured frames report the seed and actual Godot specimen scale; the service rejects mismatches before making a frame available for control. A tolerance of `1e-6` accommodates Godot's transform precision. The evidence verifier checks the same association together with source, observation, geometry and image hashes.

Uniform size variation does not represent different anatomical shapes, disease states, tissue material properties or patient diversity. A successful local manipulation fixture is not a full procedure or an independent model episode. Final autonomous evaluation requires the separate C0 source/instruction freeze and all three declared live episodes.
