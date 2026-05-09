import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { VPSHealthPanel } from '../components/telemetry/VPSHealthPanel';
import { PipelineThroughputPanel } from '../components/telemetry/PipelineThroughputPanel';
import { AgentStatusGrid } from '../components/telemetry/AgentStatusGrid';
import { QualityMetricsPanel } from '../components/telemetry/QualityMetricsPanel';
import { QuotaBurnMeter } from '../components/telemetry/QuotaBurnMeter';
import { TimeRangeSelector, type TimeRange } from '../components/telemetry/TimeRangeSelector';

interface HistoryPoint {
  timestamp: string;
  vps: { cpuPercent: number; ramPercent: number };
  pipeline: { activeWRs: number; wrCompletedPerHour: number };
  quota: { tokensUsedToday: number };
}

const CHART_STYLE = { fontSize: 10, fill: '#546e7a' };

export function TelemetryPage() {
  const [range, setRange] = useState<TimeRange>('1h');
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/v1/telemetry/history?range=${range}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setHistory(data as HistoryPoint[]); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range]);

  function fmtTime(ts: string) {
    const d = new Date(ts);
    return range === '7d'
      ? d.toLocaleDateString([], { month: 'short', day: 'numeric' })
      : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const chartData = history.map((h) => ({
    t: fmtTime(h.timestamp),
    cpu: h.vps.cpuPercent,
    ram: h.vps.ramPercent,
    wrs: h.pipeline.activeWRs,
    tokens: Math.round(h.quota.tokensUsedToday / 1000),
  }));

  return (
    <div className="flex flex-col h-full overflow-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-bold text-[#4fc3f7] tracking-widest">TELEMETRY</h1>
        <TimeRangeSelector value={range} onChange={setRange} />
      </div>

      {/* Live Panels Row */}
      <div className="grid grid-cols-5 gap-3" style={{ minHeight: 180 }}>
        <VPSHealthPanel />
        <PipelineThroughputPanel />
        <AgentStatusGrid />
        <QualityMetricsPanel />
        <QuotaBurnMeter />
      </div>

      {/* Historical Charts */}
      <div className="grid grid-cols-2 gap-3">
        {/* CPU + RAM chart */}
        <div className="bg-[#0d0d20] border border-[#1a1a3e] rounded p-3">
          <p className="text-[10px] text-[#4fc3f7] uppercase tracking-widest mb-3">
            CPU & RAM {loading && <span className="text-[#546e7a]">loading...</span>}
          </p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="t" tick={CHART_STYLE} interval="preserveStartEnd" />
              <YAxis tick={CHART_STYLE} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: '#0d0d20', border: '1px solid #1a1a3e', fontSize: 11 }}
                labelStyle={{ color: '#546e7a' }}
              />
              <Line type="monotone" dataKey="cpu" stroke="#4fc3f7" dot={false} strokeWidth={1.5} name="CPU%" />
              <Line type="monotone" dataKey="ram" stroke="#26c6da" dot={false} strokeWidth={1.5} name="RAM%" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Active WRs chart */}
        <div className="bg-[#0d0d20] border border-[#1a1a3e] rounded p-3">
          <p className="text-[10px] text-[#4fc3f7] uppercase tracking-widest mb-3">Active Work Requests</p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="t" tick={CHART_STYLE} interval="preserveStartEnd" />
              <YAxis tick={CHART_STYLE} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#0d0d20', border: '1px solid #1a1a3e', fontSize: 11 }}
                labelStyle={{ color: '#546e7a' }}
              />
              <Line type="monotone" dataKey="wrs" stroke="#66bb6a" dot={false} strokeWidth={1.5} name="Active WRs" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Token usage chart */}
        <div className="bg-[#0d0d20] border border-[#1a1a3e] rounded p-3">
          <p className="text-[10px] text-[#4fc3f7] uppercase tracking-widest mb-3">Token Usage (k)</p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="t" tick={CHART_STYLE} interval="preserveStartEnd" />
              <YAxis tick={CHART_STYLE} />
              <Tooltip
                contentStyle={{ background: '#0d0d20', border: '1px solid #1a1a3e', fontSize: 11 }}
                labelStyle={{ color: '#546e7a' }}
              />
              <Line type="monotone" dataKey="tokens" stroke="#ffb300" dot={false} strokeWidth={1.5} name="Tokens (k)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
