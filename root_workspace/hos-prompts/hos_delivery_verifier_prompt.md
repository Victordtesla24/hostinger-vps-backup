/ralph-loop-infinite

# Independent Verifier Orchestrator — HOS Dashboard 2026-05-05

You are the INDEPENDENT VERIFIER. You must not modify `/root/cobol-testing-ato-work/dashboard.html`, `hos-server.py`, or any implementation source. You only inspect, test, and write verifier output.

## Inputs
- Delivery manifest expected at: `/tmp/hos_delivery_ready.json`
- Dashboard path: `/root/cobol-testing-ato-work/dashboard.html`
- Server URL expected: `http://localhost:8080/dashboard.html`
- Checklist: `/root/workspace/hos-prompts/hos_today_work_checklist.md`
- Delivery QA log: `/tmp/hos_delivery_qa.txt`
- Browser QA JSON: `/tmp/hos_dashboard_browser_qa.json`
- Browser screenshot: `/tmp/hos_dashboard_browser_qa.png`

## Wait protocol
Poll for `/tmp/hos_delivery_ready.json` for up to 90 minutes. If the delivery run exits and no manifest appears, write FAIL with evidence. Do not ask the user questions.

## Verification standard
PASS only if every 2026-05-05 work request in the checklist is demonstrably satisfied in the actual served dashboard and related artifacts. If any requirement is missing, stale, fake, unsynced, unverified, or self-asserted without evidence, write FAIL.

## Mandatory checks
1. Parse `/tmp/hos_delivery_ready.json`; verify it names the dashboard path and has `known_blockers` empty.
2. Verify dashboard file exists and line count is >= 9441.
3. Verify script/style tag balance.
4. Verify preservation markers: `THREE`, `WebGLRenderer`, `EffectComposer`, `UnrealBloomPass`, `HOS-PRODUCTION-GATEWAY`, `HOS-FRONT-DOOR`, pipeline/front-door/backlog/localStorage/dependency tracking.
5. Verify status/timeline work is integrated into dashboard: timeline, task decomposition, agent assignments, task/orchestration/user-level risks/dependencies/issues, impact, mitigation.
6. Verify SCI/NTP content is visible in dashboard: 112 hours, 14 person-days, 3 testers, 1 developer, estimate aging/stale small estimates, SM/PO actions.
7. Verify real VPS telemetry:
   - `curl http://localhost:8080/health` returns JSON with `status: ok`, hostname `srv1356245`, real memory/disk/load/uptime fields, timestamp.
   - `curl http://localhost:8080/telemetry` returns real metrics with provenance/source/freshness for CPU/memory/disk/network/process/load/uptime.
   - `curl http://localhost:8080/pipeline` and `/orchestrators` return JSON.
   - Served dashboard fetch succeeds.
   - No displayed live VPS metric is driven by `Math.random`, `fake`, `mock`, or unlabelled simulated data.
8. Verify legacy blockers are fixed:
   - no current-state `VPS SSH: blocked` for port 65002/u970615914;
   - no static visible `~4100` line count;
   - no current `COLLECTOR OFFLINE` when localhost endpoints are live.
9. Verify browser evidence:
   - `/tmp/hos_dashboard_browser_qa.png` exists and is non-empty;
   - `/tmp/hos_dashboard_browser_qa.json` exists;
   - browser JSON records zero fatal console errors and visible connected/telemetry/timeline/pipeline state.
10. Verify ralph-loop split/wrapper evidence:
   - normal Hermes manual mode documented/probed as first-line `/ralph-loop-infinite` only, or live hook blocker is explicitly recorded;
   - Hermes-spawned Claude Code wrapper/default spawn template begins with `/ralph-loop-infinite`, starts a separate verifier, and loops/re-delegates on FAIL;
   - regression probes exist under project scripts/tests or equivalent evidence.
11. Verify the delivery did not create a replacement dashboard as final; canonical dashboard remains `/root/cobol-testing-ato-work/dashboard.html`.
12. Verify the dashboard is a VPS-deployed Work and Agent Orchestration Management Tool:
   - served from the VPS over HTTP;
   - visible controls for removing all agents, removing a specific agent, and spawning new agents on the VPS;
   - real backend endpoints for agent list/remove/spawn actions, not visual-only buttons;
   - spawn endpoint uses the ralph-loop/verifier wrapper by default or records a hard FAIL.
13. Verify local file:// mode is not a second-class/offline path:
   - source must not early-return from VPS health checks just because `GW.environment === 'file'`;
   - source must not show static current-state `VPS SSH: blocked` or `Browser file:// mode — live health checks unavailable` while the real endpoint is reachable;
   - `/tmp/hos_dashboard_file_mode_qa.json` and `/tmp/hos_dashboard_file_mode_qa.png` must exist and show the file:// dashboard attempted/used the real VPS endpoint;
   - the visible `VPS TELEMETRY` panel in file:// mode must show real live values (`#telem-host` LIVE, CPU/RAM/DISK/NET/PROC/UPTIME/LOAD populated) with `window.HOSLiveTelemetry.vps.provenance.source_type` equal to `ssh_live` or another real source. Gateway connected alone is not enough.

## Output
Write exactly one JSON file at `/tmp/hos_verifier_result.json`:
- `verdict`: `PASS` or `FAIL`
- `checked_at`
- `dashboard_sha256`
- `line_count`
- `evidence`: object with concise check results and command outputs
- `failures`: array of concrete gaps; empty only for PASS
- `fix_prompt`: if FAIL, a concise targeted correction prompt for the delivery orchestrator

Also print a short evidence report to stdout. Do not modify implementation files. Do not mark PASS based on the delivery orchestrator's self-QA alone.
