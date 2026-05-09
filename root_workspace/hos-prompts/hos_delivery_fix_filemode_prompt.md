/ralph-loop-infinite

# Claude Code Delivery Orchestrator — Final Hermes QA Fix: file:// real VPS telemetry and static blocker removal

Hermes QA found a gap after the independent verifier PASS. This is a re-delegation. Do not redo unrelated work.

## Gap Hermes QA found
The user originally referenced the dashboard as `file:///Users/vic/claude/General-Work/cobol-testing-ato-work/dashboard.html` and explicitly requires actual real VPS telemetry. The synced dashboard still contains logic that prevents file:// mode from attempting the real VPS health fetch:
- `dashboard.html` around line 7197 says `File:// protocol cannot make cross-origin requests` and returns early.
- Static publication checklist still has visible initial state `VPS SSH: blocked` around line 3009.
- This means a user opening the local file path can see a blocker/unavailable state even though the VPS server is live and CORS-capable.

## Primary files
- `/root/cobol-testing-ato-work/dashboard.html`
- `/root/cobol-testing-ato-work/hos-server.py` only if CORS/OPTIONS needs a small fix.

## Preserve all prior passed work
Preserve W1-W12, especially:
- real telemetry endpoints,
- W12 agent management endpoints/UI,
- ralph-loop wrapper scripts,
- SCI/NTP risk content,
- Three.js/gateway/front-door/pipeline.

## Required fix
1. In `dashboard.html`, remove the file:// early return in `checkVPSHealth()`.
2. In file:// mode, attempt the real remote URL `http://187.77.12.13:8080/health` with CORS and no-store cache. The server already sends `Access-Control-Allow-Origin:*`; if not, fix `hos-server.py`.
3. Static HTML defaults must not show current-state `VPS SSH: blocked`. Change initial checklist row to a pending/checking/live-probe state such as `VPS: checking live endpoint…`.
4. Do not show `Browser file:// mode — live health checks unavailable` when the remote endpoint is reachable. Only show a warning after a real fetch failure, and include the HTTP URL to open.
5. The dashboard should display connected/live VPS state when either served over `http://187.77.12.13:8080/dashboard.html` OR opened via file:// while the endpoint is reachable.
6. Keep legacy shared-hosting references absent or clearly non-current; do not reintroduce `65002` or `u970615914`.

## QA required
Update `/tmp/hos_delivery_qa.txt`, `/tmp/hos_dashboard_browser_qa.json`, and `/tmp/hos_delivery_ready.json` with evidence:
- Source grep: no `File:// protocol cannot make cross-origin requests` early-return blocker.
- Source grep: no current-state `VPS SSH: blocked` static label.
- Source grep: no `Browser file:// mode — live health checks unavailable` as default/reachable state.
- `curl http://localhost:8080/health` and `curl http://187.77.12.13:8080/health` from VPS return live JSON.
- Headless browser file-url smoke test: open `file:///root/cobol-testing-ato-work/dashboard.html`, allow JS time, capture screenshot `/tmp/hos_dashboard_file_mode_qa.png`, and save `/tmp/hos_dashboard_file_mode_qa.json` showing the DOM/checklist moved to connected/live or at least attempted real fetch with no static blocker.
- HTTP browser screenshot remains valid.
- Manifest line count and sha256 updated.

Do not self-approve. The independent verifier will be run again with a stricter file:// check.
