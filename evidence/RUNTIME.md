# Runtime verification

On October 24, 2026, the graphical Godot 4.7.2 renderer on an Apple M3 Pro returned changing camera images while the simulator was in the background and while macOS was locked. These were scripted renderer tests, not autonomous surgical episodes.

| Condition | Samples | Maximum action-to-frame latency | Result |
|---|---:|---:|---|
| Other applications in the foreground | 20 | 328 ms | Passed |
| Physical console and current-user session locked | 40 | 727 ms | Passed |

Each sample applied a bounded movement, required a new current-session/revision image, checked that the image hash changed, and recorded the host condition before and after the action. The locked test lasted approximately two minutes. Raw measurements are in `background-render-check.json` and `locked-render-check.json`; first/last camera frames are included. The core draw path also passed with the automatic render loop disabled, recorded in `background-capture-check.txt`.

An earlier native minimize request did not establish that the OS window was minimized; it remains a failed setup attempt. Initial lock probes were also rejected before actions when their required OS flag was absent. These setup attempts are not accepted lock evidence. The successful locked test used IORegistry physical-console and current-user session flags in addition to the CoreGraphics session read.

The controller now rejects missing or expired frames before acting. Stop revokes its local action lease immediately and terminates the process group, including a child that ignores graceful termination. Protocol tests cover both revoked commands and unavailable ordinary model allowance using an explicitly labeled local test double; those tests make no model calls.

System sleep, shutdown, network loss, and prolonged application suspension do not provide continuous inference. The service does not change OS security or sleep settings. A recovered host must supply fresh frames; interrupted episodes remain recorded and must not be counted as successful autonomous runs. This evidence is local and reproducible, not third-party attestation.
