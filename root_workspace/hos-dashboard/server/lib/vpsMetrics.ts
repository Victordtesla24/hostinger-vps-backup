import si from 'systeminformation';

export interface VPSSnapshot {
  cpuPercent: number;
  ramPercent: number;
  ramUsedGB: number;
  ramTotalGB: number;
  diskPercent: number;
  diskUsedGB: number;
  diskTotalGB: number;
  diskReadMBps: number;
  diskWriteMBps: number;
  netInMBps: number;
  netOutMBps: number;
  uptime: number;
  loadAvg: [number, number, number];
  processCount: number;
}

let _prevDisk: { rIO: number; wIO: number; ts: number } | null = null;
let _prevNet: { rx: number; tx: number; ts: number } | null = null;

export async function collectVPSMetrics(): Promise<VPSSnapshot> {
  const [cpu, mem, fsStats, netStats, load, procs] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsStats(),
    si.networkStats(),
    si.currentLoad(),
    si.processes(),
  ]);

  const now = Date.now();

  // Disk I/O rates in MB/s
  let diskReadMBps = 0;
  let diskWriteMBps = 0;
  if (_prevDisk) {
    const dt = (now - _prevDisk.ts) / 1000;
    diskReadMBps = Math.max(0, (fsStats.rx - _prevDisk.rIO) / 1024 / 1024 / dt);
    diskWriteMBps = Math.max(0, (fsStats.wx - _prevDisk.wIO) / 1024 / 1024 / dt);
  }
  _prevDisk = { rIO: fsStats.rx, wIO: fsStats.wx, ts: now };

  // Net I/O rates in MB/s (sum across all interfaces)
  const totalRx = netStats.reduce((s, n) => s + (n.rx_bytes ?? 0), 0);
  const totalTx = netStats.reduce((s, n) => s + (n.tx_bytes ?? 0), 0);
  let netInMBps = 0;
  let netOutMBps = 0;
  if (_prevNet) {
    const dt = (now - _prevNet.ts) / 1000;
    netInMBps = Math.max(0, (totalRx - _prevNet.rx) / 1024 / 1024 / dt);
    netOutMBps = Math.max(0, (totalTx - _prevNet.tx) / 1024 / 1024 / dt);
  }
  _prevNet = { rx: totalRx, tx: totalTx, ts: now };

  const ramTotalGB = mem.total / 1024 / 1024 / 1024;
  const ramUsedGB = (mem.total - mem.available) / 1024 / 1024 / 1024;

  // Disk usage from fsSize
  let diskUsedGB = 0;
  let diskTotalGB = 1;
  try {
    const fsSizes = await si.fsSize();
    const root = fsSizes.find((f) => f.mount === '/') ?? fsSizes[0];
    if (root) {
      diskUsedGB = root.used / 1024 / 1024 / 1024;
      diskTotalGB = root.size / 1024 / 1024 / 1024;
    }
  } catch { /* ignore */ }

  return {
    cpuPercent: Math.round(cpu.currentLoad * 10) / 10,
    ramPercent: Math.round((ramUsedGB / ramTotalGB) * 1000) / 10,
    ramUsedGB: Math.round(ramUsedGB * 100) / 100,
    ramTotalGB: Math.round(ramTotalGB * 100) / 100,
    diskPercent: Math.round((diskUsedGB / diskTotalGB) * 1000) / 10,
    diskUsedGB: Math.round(diskUsedGB * 100) / 100,
    diskTotalGB: Math.round(diskTotalGB * 100) / 100,
    diskReadMBps: Math.round(diskReadMBps * 100) / 100,
    diskWriteMBps: Math.round(diskWriteMBps * 100) / 100,
    netInMBps: Math.round(netInMBps * 1000) / 1000,
    netOutMBps: Math.round(netOutMBps * 1000) / 1000,
    uptime: load.avgLoad,
    loadAvg: [
      Math.round((load.avgLoad ?? 0) * 100) / 100,
      Math.round((load.avgLoad ?? 0) * 100) / 100,
      Math.round((load.avgLoad ?? 0) * 100) / 100,
    ],
    processCount: procs.all,
  };
}
