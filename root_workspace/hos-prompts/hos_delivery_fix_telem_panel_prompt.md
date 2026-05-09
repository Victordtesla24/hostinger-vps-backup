/ralph-loop-infinite

# Claude Code Delivery Orchestrator — Final QA Fix: VPS Telemetry panel must show real values in file:// mode

Hermes QA opened the synced local dashboard via `file:///Users/vic/claude/General-Work/cobol-testing-ato-work/dashboard.html`. The gateway checklist correctly updated to `VPS: connected (srv1356245)`, but the visible right-column `VPS TELEMETRY` panel still showed:
- `SRV1356245 · UNAVAILABLE`
- CPU/RAM/DISK/NET/PROC/UPTIME/LOAD all `--`
- `window.HOSLiveTelemetry.vps.provenance.source_type = 'unavailable'`, reason `API fetch failed: Failed to fetch`.

Root cause likely in `fetchTelemetryEndpoints()` around lines 5807-5813: it uses `const baseUrl = window.location.origin; fetch(baseUrl + '/api/vps/metrics')`, which fails under file://. This is not acceptable because the user explicitly requires actual real VPS telemetry data and gave a file:// dashboard path.

## Primary file
- `/root/cobol-testing-ato-work/dashboard.html`
- Use `hos-server.py` only if endpoint/CORS is missing. Current `/api/vps/metrics` and `/telemetry` work on the VPS.

## Required fix
1. Update the dashboard telemetry fetch adapter so file:// mode uses the real VPS API base URL:
   - for `location.protocol === 'file:'` or `location.origin === 'null'`, use `http://187.77.12.13:8080`.
   - for HTTP served mode, use same-origin.
2. Ensure the visible `VPS TELEMETRY` panel uses real `/api/vps/metrics` or `/telemetry` response in file:// and HTTP modes.
3. After JS settles in file:// mode, `#telem-host` must show `srv1356245 · LIVE` or `187.77.12.13 · LIVE`, and CPU/RAM/DISK/NET/PROC/UPTIME/LOAD must show real numeric/string values, not `--`.
4. `window.HOSLiveTelemetry.vps.provenance.source_type` must be `ssh_live` (or equivalent real source) in file:// mode when endpoint is reachable.
5. Keep gateway checklist, W12 agent management, NTP content, ralph wrapper, and prior file:// gateway fix intact.

## QA required
Update these evidence files:
- `/tmp/hos_dashboard_file_mode_qa.json` must include the visible VPS telemetry panel text after JS settles and prove it is not `UNAVAILABLE` / `--`.
- `/tmp/hos_dashboard_file_mode_qa.png` must be refreshed.
- `/tmp/hos_delivery_ready.json` must update line count and sha256.

Run a browser/DOM file:// check equivalent to:
```js
await page.goto('file:///root/cobol-testing-ato-work/dashboard.html');
await page.waitForTimeout(8000);
return {
  host: document.querySelector('#telem-host')?.textContent,
  cpu: document.querySelector('#pct-cpu')?.textContent,
  ram: document.querySelector('#pct-ram')?.textContent,
  disk: document.querySelector('#pct-disk')?.textContent,
  uptime: document.querySelector('#telem-uptime')?.textContent,
  load: document.querySelector('#telem-load')?.textContent,
  vps: window.HOSLiveTelemetry?.vps
}
```
PASS only if host is LIVE, values are populated, and provenance is real (`ssh_live`).

Do not self-approve. The independent verifier will run again after this fix.
