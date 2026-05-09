/ralph-loop-infinite

# Claude Code Delivery Orchestrator — HOS Dashboard 2026-05-05 Recovery + Final Quality Pass

You are the DELIVERY ORCHESTRATOR. Hermes is only monitoring and QA. You and your child agents perform 100% of implementation work.

## Non-negotiable role/quality contract
- Extend the existing dashboard in place. Do NOT create a replacement dashboard or new project as the final answer.
- Primary target file: `/root/cobol-testing-ato-work/dashboard.html` (remote working copy of `file:///Users/vic/claude/General-Work/cobol-testing-ato-work/dashboard.html`).
- Secondary input copy for SCI work: `/root/workspace/input/SCI-Dashboard-Enhanced.html`.
- Sprint CSV input: `/root/workspace/input/Sprint 47.5 - Dashboard Query (5).csv`.
- Existing server file, if useful: `/root/cobol-testing-ato-work/hos-server.py`.
- The dashboard must show actual real VPS telemetry from this VPS (`srv1356245`, root@187.77.12.13), not fabricated/random/simulated numbers.
- If a metric cannot be collected, show `UNAVAILABLE` with provenance; never invent CPU/RAM/disk/network/process values.
- No careless claims. No self-approval. No "good enough". You remain inside ralph-loop-infinite until the independent verifier process writes a PASS result and Hermes QA can verify it.
- Every child/subagent you spawn must be told it inherits this ralph-loop-infinite contract and must produce evidence, not approval language.

## Current recovered status checklist
Read `/root/workspace/hos-prompts/hos_today_work_checklist.md` before modifying anything. It identifies every work request from 2026-05-05 and which items are FULL/PARTIAL/NONE. Your job is to drive all PARTIAL/NONE items to verifier-passable state.

High-level recovered gaps:
1. AAA/Three.js dashboard exists but browser verification and telemetry authenticity are not yet accepted.
2. SCI dashboard/risk work is only partially represented; explicit NTP feasibility and estimate-aging evidence are missing or not visible enough.
3. Temporary status report/timeline should now be integrated into the existing dashboard, not left as a separate file.
4. Production gateway has stale metadata (`~4100`) and legacy SSH-blocker references (`65002`, `u970615914`) that do not reflect the working root VPS path.
5. Front-door/pipeline/backlog work exists on the remote dashboard but lacks independent verifier evidence and final local sync.
6. Real VPS telemetry endpoint exists but dashboard still contains simulated/fake/mock/Math.random/COLLECTOR OFFLINE artifacts. Fix the UI/data model so real telemetry drives all metric panels.
7. ralph-loop behavior needs a safe split: Hermes manual slash-only; Claude Code orchestrators spawned by Hermes must be wrapped by default with independent verifier.
8. Mandatory browser verification must produce evidence.

## Required workstreams — spawn/use child agents
Use a swarm/council pattern. At minimum coordinate these specialist tracks (actual Task subagents if available; otherwise separate internal work sections with evidence):
- Telemetry engineer: real VPS metrics endpoints and provenance.
- Dashboard/Three.js engineer: integrate UI into existing file without breaking scene/render loop.
- SCI/NTP analyst: Sprint 47.5 risks, dependencies, estimate aging, 112-hour feasibility, SM/PO actions.
- Ralph-loop/wrapper engineer: manual-only Hermes activation + default wrapped Claude Code spawn pattern.
- Browser QA engineer: served HTTP rendering, console errors, screenshot, endpoint checks.
- Verifier liaison: prepare machine-readable manifest for the independent verifier.

## Implementation requirements

### A. Real VPS telemetry and health/pipeline endpoints
- Serve all telemetry from real VPS/system sources on port 8080 (same-origin for `/dashboard.html`).
- If `hos-server.py` exists, harden/extend it. If not adequate, modify it or create the minimal server file needed inside `/root/cobol-testing-ato-work/`.
- Required endpoints:
  - `GET /health`: real JSON, at least `status`, `hostname`, `timestamp`, `uptime`, `memory`, `disk`, `load`, `docker_containers`, `pipeline` summary, `provenance`.
  - `GET /telemetry`: real CPU/memory/disk/network/process/load/uptime/port/tmux/claude activity metrics, each with unit, source, collected_at, freshness, confidence.
  - `GET /pipeline`: real or state-file-backed task/orchestrator/ralph-loop pipeline data; no invented live claims. If seeded backlog items are used, label them as `seeded_from_session_history` or `snapshot`, not live.
  - `GET /orchestrators`: current tmux/process/log-derived Claude Code sessions and statuses.
  - `GET /dashboard.html`: the actual dashboard file.
- Run the server in tmux session `hos-dashboard-srv`, bound to `0.0.0.0:8080`, replacing fragile background processes.
- External CORS may be enabled, but same-origin HTTP must work.
- Verify from inside VPS: `curl http://localhost:8080/health`, `/telemetry`, `/pipeline`, `/orchestrators`, `/dashboard.html`.

### B. Dashboard real telemetry binding
In `/root/cobol-testing-ato-work/dashboard.html`:
- Bind visible VPS panels to real `/telemetry` and `/health` endpoint data when served over HTTP.
- Preserve existing Three.js scene: `THREE`, `WebGLRenderer`, `EffectComposer`, `UnrealBloomPass`, humanoid/council concepts, production gateway, front-door/pipeline.
- Remove or quarantine fake numeric telemetry:
  - No `Math.random()`-driven CPU/RAM/disk/network/process/uptime/load values.
  - No UI claiming `LIVE` from simulated values.
  - Strings like `simulated`, `fake`, `mock`, and `COLLECTOR OFFLINE` may only remain in code/comments if clearly part of a negative QA warning or unavailable-state label, never as the source for displayed live numbers.
- Every visible metric must display provenance/freshness/source.
- Fix stale `gw-lines` or equivalent metadata so it reflects actual line count or a runtime-computed value; do not leave `~4100` in visible static HTML.
- Remove/replace legacy `ssh -p 65002 u970615914@82.180.172.143` as the current VPS status. If mentioned, label it as legacy/shared-hosting path, not the actual root VPS. Actual working path is `ssh root@187.77.12.13` / alias `hos-vps`.
- Dashboard must show root VPS health as CONNECTED when served over `http://localhost:8080/dashboard.html` and the endpoints respond.

### C. Integrate all requested status/timeline/front-door functionality into existing dashboard
- Integrate the previous temporary real-time status report request into the existing dashboard:
  - timeline visualization,
  - high-level task decomposition,
  - agent-to-task assignment matrix,
  - task/orchestration/user-level risks, dependencies, issues,
  - impact and mitigation plans,
  - live/current orchestrator status from `/orchestrators` plus clear snapshot labels for historical items.
- Preserve/repair front-door and delivery pipeline:
  - intake, triage, delegation, execution, QA/verification, delivery stages,
  - backlog/work queue with localStorage persistence,
  - dependency tracking and blocked-by visualization,
  - ralph-loop QA/verification stage.
- Do not leave the requested status report only as `/tmp/hos-status-report.html`; the canonical deliverable is the existing dashboard file.

### D. SCI/NTP delivery-risk content
From `/root/workspace/input/Sprint 47.5 - Dashboard Query (5).csv` and the copied SCI dashboard:
- Surface hidden dependencies, unseen risks, and blockers.
- Explicitly include NTP feasibility math: `112 hours remaining = 14 person-days at 8h/day`; with `3 testers + 1 developer` the remaining window is not feasible without descoping/reallocation/overtime/risk acceptance.
- Show estimate-aging: small 2-3 hour items still in progress after a week/sprint are risk signals.
- Show SM and PO action recommendations for volatile scope and under-budget constraints.
- These can appear in HOS dashboard panels and, if you choose, the copied SCI dashboard too. But the HOS dashboard must visibly include them.

### E. Ralph-loop manual-only vs Hermes-spawned orchestrator default wrapper
Audit the live and project/distribution ralph-loop files, but do not bypass protected contract paths. Implement the safest allowed behavior:
- Hermes interactive/manual behavior must arm ralph-loop-infinite only when the first non-empty user line is `/ralph-loop-infinite` (or the documented disarm slash command). Prose mentions, code-fenced examples, and ordinary ship/complete/deploy language must not arm a normal Hermes request.
- Claude Code orchestrators spawned by Hermes must be wrapped by default: the spawn prompt begins with `/ralph-loop-infinite`, an independent verifier orchestrator is started, and no delivery is surfaced until verifier PASS.
- If live hook files under `~/.claude/hooks` or state files are protected by the active gate and cannot be changed legitimately, do NOT hack around it. Instead implement a project-local wrapper/script/config under `/root/cobol-testing-ato-work/scripts/` that Hermes can use for all future Claude Code spawns, plus regression tests/probes showing the desired semantics. Include exact evidence in the manifest. The independent verifier may still fail this if live semantics remain unsafe, so prefer real allowed fixes where possible.
- Add regression probes (shell or Python) under project scripts/tests, not by modifying protected home hook files unless permitted through the official path.

### F. Browser verification evidence
Before producing your final manifest:
- Serve dashboard on `http://localhost:8080/dashboard.html`.
- Run real browser/headless browser verification. Use Playwright/Puppeteer/headless Chromium if available; install only if necessary and reasonable.
- Capture screenshot to `/tmp/hos_dashboard_browser_qa.png`.
- Capture console errors and page text/state into `/tmp/hos_dashboard_browser_qa.json`.
- Verify visible state includes real VPS connected/live telemetry, no blocker as current state, no visible fake/simulated live metric claims, and core timeline/pipeline panels render.

## Mandatory QA gates you must run before manifest
Run deterministic checks and save outputs to `/tmp/hos_delivery_qa.txt`:
- File exists and line count did not shrink from baseline 9441.
- Script/style tag balance.
- `THREE`, `WebGLRenderer`, `EffectComposer`, `UnrealBloomPass` present.
- HOS-PRODUCTION-GATEWAY markers present.
- HOS-FRONT-DOOR / pipeline markers present.
- Backlog/localStorage/dependency tracking markers present.
- Explicit NTP math marker present (`112`, `14 person-days`, `3 testers`, `1 developer`).
- No visible static `~4100` line-count placeholder.
- No current-state `65002`/`u970615914` VPS blocker; if legacy text remains it must be clearly marked `legacy shared-hosting path` and not the current status.
- No fake/random numeric telemetry in live metric paths (`Math.random` must not drive VPS metrics).
- `/health`, `/telemetry`, `/pipeline`, `/orchestrators` return JSON from localhost:8080.
- Browser QA JSON/screenshot exists.

## Final handoff files
When you believe the deliverable is ready for independent verification, write:
- `/tmp/hos_delivery_ready.json` with fields:
  - `status`: `ready_for_independent_verifier`
  - `dashboard_path`: `/root/cobol-testing-ato-work/dashboard.html`
  - `server_url`: `http://localhost:8080/dashboard.html`
  - `line_count`
  - `sha256`
  - `changed_files`
  - `work_requests_addressed`: list W1-W11 with evidence paths/line refs
  - `qa_summary`
  - `known_blockers`: must be empty unless a protected ralph hook edit was legitimately blocked; do not hide blockers
  - `browser_qa_json`: `/tmp/hos_dashboard_browser_qa.json`
  - `browser_screenshot`: `/tmp/hos_dashboard_browser_qa.png`
  - `qa_log`: `/tmp/hos_delivery_qa.txt`
- Do not write a PASS for yourself. The independent verifier writes `/tmp/hos_verifier_result.json`.

## Final response shape
Your final Claude Code response must be an evidence report only, pointing to the handoff files. Do not ask the user for approval. Do not claim verifier PASS unless `/tmp/hos_verifier_result.json` already exists and says PASS.
