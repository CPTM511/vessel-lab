# Runtime cost observability

Round 4, seed 11 stopped after 89 accepted movements and 157 actual images. Its final 0.5-second action took 4,658ms to return from the simulation and missed the existing five-second actual-frame deadline. Complete detachment, edge proximity and protected/non-target integrity passed; collection and released hold remained incomplete. The attempt remains unsuccessful.

The controller contract omitted that deadline and tool results omitted action costs. The model selected repeated 0.5-second actions while measured feedback rose toward the limit. This proves an interface omission, not a counterfactual claim about the model's internal reasoning.

The solver executes `ceil(duration * 120)` substeps. From the exact predecessor state, the same endpoint command at durations 0.5, 0.1 and 0.02 seconds used 60, 12 and 3 substeps. Offline measured costs were approximately 5,196ms, 1,474ms and 346ms. An actual Godot run of the 0.1-second counterfactual returned a matching frame in 2,513ms. Shorter duration increased grasp lag, so these results are not physically equivalent states and do not prescribe a universal duration.

The correction adds measured last-action response time, actual-frame time, requested simulation duration and solver substep count to the text delivered with real observations. It discloses the unchanged 5,000ms deadline and explains that prior cost is not a prediction. The model still chooses every command and sees the physical response after each. There is no automatic splitting, movement template, reduction of the five-second released hold or changed action range.

Protocol tests check the text actually delivered to the controller, timestamp arithmetic, invalid timing rejection, the unchanged missing-frame stop, ordinary-access guards, exact model restriction, Stop and source freezing. These use explicitly labeled test doubles and are not model evaluation successes. Historical failed records remain bound to their original source; current-schema verification checks timing fields against recorded dispatch, response and frame timestamps.

Only the controller adapter and its English contract change from round 4. Physics, rendering, anatomy, evaluator and acceptance thresholds remain unchanged. Earlier validated physics and renderer evidence is retained. Independent fresh episodes are required to evaluate the corrected interface.
