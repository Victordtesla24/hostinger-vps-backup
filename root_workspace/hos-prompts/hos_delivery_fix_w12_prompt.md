/ralph-loop-infinite

# Claude Code Delivery Orchestrator — W12 Fix Cycle

You are the DELIVERY ORCHESTRATOR for the second iteration. Hermes is still monitor/QA only. The independent verifier returned FAIL only for W12. Do not redo unrelated work unless needed to preserve it.

## Verifier failure to fix
The independent verifier wrote `/tmp/hos_verifier_result.json` with verdict FAIL:
- W12 requirement: make the dashboard a VPS-deployed Work and Agent Orchestration Management Tool.
- Required user capabilities: remove all agents, remove a specific agent, spawn new agents directly on the VPS via the dashboard, and deploy/serve the dashboard on the VPS.
- Gap: server currently has read-only endpoints only; dashboard UI lacks functional management controls backed by real VPS APIs.

## Primary files
- `/root/cobol-testing-ato-work/dashboard.html`
- `/root/cobol-testing-ato-work/hos-server.py`
- Existing wrapper scripts:
  - `/root/cobol-testing-ato-work/scripts/hermes-spawn-wrapper.sh`
  - `/root/cobol-testing-ato-work/scripts/ralph-verifier-probe.sh`

## Preserve successful prior work
Do not regress these already verifier-passing items:
- Real telemetry endpoints and dashboard binding.
- No legacy `~4100`, `65002`, `u970615914`, or current `COLLECTOR OFFLINE` blockers.
- NTP feasibility content: 112 hours, 14 person-days, 3 testers + 1 developer, estimate aging, SM/PO actions.
- Three.js scene and gateway/front-door/pipeline/backlog markers.
- Browser screenshot/QA evidence flow.

## Required implementation

### 1. Backend agent management APIs in `hos-server.py`
Add real POST/GET endpoints. They must be served by the VPS server on port 8080 and operate on real tmux/process state.

Required endpoints:
- `GET /api/agents` — list manageable agents, including tmux sessions and Claude Code processes. Include `id`, `name`, `type`, `status`, `pid` if known, `session`, `started_at`/`collected_at`, and `managed` boolean.
- `POST /api/agents/spawn` — spawn a new Claude Code agent on the VPS. JSON body fields:
  - `name` (slug-safe; default generated)
  - `prompt` (required unless `dry_run` true)
  - `model` (default `claude-opus-4-5`)
  - `effort` (default `max`)
  - `max_turns` (default small but configurable)
  - `dry_run` boolean for QA route validation without spending quota
- Real spawn behavior when `dry_run` is false:
  - create prompt file under `/tmp/hermes-spawns/<session>.prompt.md`
  - ensure the prompt begins with `/ralph-loop-infinite`
  - spawn tmux session named `hos-agent-<slug>`
  - use `/root/cobol-testing-ato-work/scripts/hermes-spawn-wrapper.sh` if compatible; otherwise invoke Claude Code directly with first-line `/ralph-loop-infinite`, `--permission-mode acceptEdits`, `--model`, `--effort`, `--max-turns`, stream-json log to `/tmp/hermes-spawns/<session>.log`, done marker to `/tmp/hermes-spawns/<session>.done`
  - unset `ANTHROPIC_API_KEY`
  - return JSON with `status: spawned`, `session`, `log`, `prompt_file`, `ralph_bound: true`, and verifier/wrapper evidence.
- `POST /api/agents/{id}/stop` or `POST /api/agents/stop` — stop a specific managed agent. Accept JSON `id`/`session` and optional `confirm: true`. Kill tmux session or process safely. Do not stop `hos-dashboard-srv` unless explicitly requested with `allow_system: true`.
- `POST /api/agents/stop-all` — remove/stop all managed agent sessions (`hos-agent-*`, wrapper-spawned Claude sessions). Require `confirm: true`. Do not kill the dashboard server or health server. Return stopped/skipped lists.
- `OPTIONS` responses should allow dashboard fetches.

### 2. Dashboard UI controls in `dashboard.html`
Add an Agent Management panel or integrate into existing Front Door/Gateway UI. It must have visible, functional controls:
- agent list with refresh button,
- spawn form: name, model, prompt, max turns, dry-run toggle, spawn button,
- stop/remove button per listed agent,
- remove all agents button with confirmation,
- result/status log showing API responses,
- provenance: `VPS API /api/agents` and timestamp.

The controls must call the real endpoints above. Do not make visual-only buttons.

### 3. QA
Run and update `/tmp/hos_delivery_qa.txt` and `/tmp/hos_dashboard_browser_qa.json`:
- `GET /api/agents` returns JSON.
- `POST /api/agents/spawn` with `dry_run:true` returns `status: dry_run_ok` or equivalent and `ralph_bound:true`.
- If safe, spawn a very low-turn real smoke agent with prompt `/ralph-loop-infinite\nReturn AGENT_SMOKE_OK and exit.` using max_turns 1, then stop/remove it through the API. If this risks cost or blocking, the dry-run plus code inspection must prove real spawn path; record why.
- `POST /api/agents/stop-all` with `confirm:false` must refuse; with `confirm:true` must stop only managed test agents and skip system sessions.
- Dashboard source contains the panel controls and fetch calls.
- Served dashboard still renders via `http://localhost:8080/dashboard.html` with screenshot evidence.

### 4. Manifest update
Update `/tmp/hos_delivery_ready.json`:
- Include W12 as `ADDRESSED` with evidence for API endpoints, UI controls, and VPS deployment URL.
- Update line count and sha256.
- `known_blockers` must remain empty only if W12 is truly functional.

After you finish, do not self-approve. The independent verifier must be run again and may PASS or FAIL.
