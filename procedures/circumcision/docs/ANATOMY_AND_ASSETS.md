# Anatomy and asset provenance

## Reference basis

The South African National Department of Health's [National Guidelines for Medical Male Circumcision, 2025](https://knowledgehub.health.gov.za/system/files/elibdownloads/2025-09/VMMC%20Guidelines%202025%20%283%29%20%282%29%20%282%29.pdf), Annexure C, printed/PDF pages 100–101, was read as text and visually inspected on 2026-10-24. The surface and section diagrams support the relative placement of the outer and inner preputial surfaces, glans, corona, coronal sulcus, ventral frenulum and urethral opening. The section distinguishes the paired dorsal corpora cavernosa from the ventral corpus spongiosum containing the urethra.

The model uses these **anatomical relationships**, not copied illustrations. Its dimensions and surface profiles are authored synthetic adult-scale examples; they are not population measurements, patient scans or a clinically calibrated anatomy. The source document's SHA-256 is `3626025975ab3f17ccb9c0aec93e354a8101df1afacc8d37571fb3e79b56a071`. Reference diagrams and PDF files are not redistributed with the MIT source.

NCBI Bookshelf NBK482236 and the WHO 2018 manual were candidate references. Direct full-document access returned a browser challenge and a fetch timeout, respectively. They are not claimed as independently reviewed sources for this checkpoint.

## Original assets

| Asset | Origin | Distribution |
| --- | --- | --- |
| Shaft, glans, coronal contour, double preputial surface and fold | Authored parametric meshes in `godot/anatomy.gd` | MIT, source included |
| Frenular loft, open meatal rim, recessed mucosal wall and urethral proxy | Authored synthetic meshes in the same file | MIT, source included |
| Skin, mucosal and glanular color/roughness/normal detail | Deterministic procedural noise generated locally | MIT, generator included |
| Drape, scale and inspection lights | Authored scene geometry and configuration | MIT, source included |
| Interface font | Godot's built-in theme font | Distributed by Godot; no copied font file |

The frenular loft connects the ventral glanular surface to the retained inner collar. The meatal rim opens into a recessed original mucosal mesh and shares its angular vertices with the rounded glans cap. This is authored topology, not a patient scan or surgically deformable frenulum.

The sampled mechanical cage, glanular sections and conservative protection envelopes are generated directly from the original Godot geometry by `godot/export_physics.gd`; the exporter, source hash and data are included under MIT.

Protection envelopes are convex support halfspaces fitted to the rendered surface vertices and padded by 0.005 mm. The frenular envelope includes both endpoints of the inspection morph. Existing capsule exclusions are retained. The glanular solid conservatively protects the urethral cavity rather than modeling a passable lumen. These halfspaces can include empty space and report lower distance bounds, not exact signed distances or injury thresholds.

There are no patient images, external textures, downloaded meshes or generative bitmap assets. Anatomical labels refer to modeled structures, not independently validated segmentation.

## Fidelity boundaries

- **Visual realism:** smooth layered geometry, distinct surface finish, subtle skin detail and clinical inspection lighting. The first version is an anatomical specimen, not a complete body. Procedural regularity, synthetic dimensions, a simplified urethral cavity and attachment geometry remain limitations.
- **Mechanical fidelity:** the inspection morph remains nonphysical. The separate mechanics sandbox now uses a shared sampled cage, compliant constraints and barycentric grasps. It lacks material calibration. Continuous shell contact has one complete scripted regression, with sampled-contact and geometric limitations documented in [the evidence](../evidence/ANATOMY_INTEGRATION.md); a plausible image does not establish general mechanical correctness.
- **Clinical validity:** not established. There is no expert anatomical validation, patient-specific fit, living-tissue calibration, perfusion, innervation, healing or clinical outcome model.

Godot's [renderer feature matrix](https://docs.godotengine.org/en/stable/tutorials/rendering/renderers.html) identifies subsurface scattering as a Forward+ feature. Compatibility remains an explicit fallback with different shading. The selected renderer and actual observed output are recorded in checkpoint evidence.
