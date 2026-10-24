# Computation and mesh-construction validation

Round 3, seed 11 stopped after its hundredth accepted movement because a fresh Godot image was unavailable within five seconds. Target detachment and edge proximity passed, but collection and released hold remained incomplete. The attempt remains unsuccessful.

The final movement was replayed from its exact serialized predecessor state. Baseline cold computation plus rendering took 6,099ms. Scalar collision-query optimizations alone still required 5,212ms of actual feedback. With static mechanical-surface templates cached, the same diagnostic required 4,419ms. The final JPEG bytes were identical across these diagnostic variants. These are individual measurements, not a general throughput estimate.

The contact changes preserve the four-millimetre broadphase grid, exact candidate order, arithmetic order, collision tolerances and conservative advancement. Indexed query storage invalidates on broadphase rebuild. First-shared-cell detection replaces duplicate-set lookups. Temporary projection vectors are replaced with the same scalar expressions. A finer-grid experiment was discarded because it did not provide sufficient benefit.

The renderer caches only static per-face UV coordinates, rest-surface positions and barycentric weights. Subdivision density, dynamic displacement, winding, indexing, normal generation and tangent generation remain unchanged. All surface arrays matched exactly for the three declared size cases and the states immediately before and after the failed movement. The mandatory anatomy re-export changed only its source-binding hash; every physical geometry field remained identical.

A complete scripted replay of all 100 accepted movements produced 100 actual Godot frames, with maximum 3,764ms feedback and unchanged final assessment. Mesh crossing audits passed. Twenty changing background views passed with maximum 758ms feedback. Twenty Compatibility-renderer mechanical actions passed with maximum 1,189ms feedback. None of these scripted checks is an independent model success.

Frame transport, rendering configuration, controller lifecycle and the Godot main loop remain unchanged. Earlier actual locked-host evidence is retained for those mechanisms, supported by exact mesh and image equivalence. This checkpoint does not claim a new locked-host measurement. Cold-state and recorded-path timing do not guarantee arbitrary-path timing.

The current and historical unsuccessful journals are checked using `verify-controller.mjs` with explicit failure-record modes. Default successful-episode verification continues to reject them. The declared seeds and all C0 acceptance thresholds remain unchanged; new independent episodes require a fresh published source freeze.
