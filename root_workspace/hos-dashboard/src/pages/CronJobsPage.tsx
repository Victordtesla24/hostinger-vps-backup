import { useState } from 'react';
import { useHOSStore } from '../store/hosStore';

export function CronJobsPage() {
  const cronJobs = useHOSStore((s) => s.cronJobs);
  const [showCreate, setShowCreate] = useState(false);

  const [name, setName] = useState('');
  const [schedule, setSchedule] = useState('');
  const [prompt, setPrompt] = useState('');
  const [script, setScript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name || !schedule || (!prompt && !script)) {
      setError('Name, schedule, and either prompt or script are required.');
      return;
    }

    try {
      const res = await fetch('/api/v1/cron/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, schedule, prompt, script })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create cron job');
      }

      closeModal();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const closeModal = () => {
    setShowCreate(false);
    setName('');
    setSchedule('');
    setPrompt('');
    setScript('');
    setError(null);
  };

  const hasOsJobs = cronJobs.some(j => j.source === 'os');

  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-white mb-1">Cron Jobs</h1>
          <p className="text-xs text-[#546e7a]">Manage active scheduled tasks and agents</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-[#00bfa5] text-white px-3 py-1.5 rounded text-sm hover:bg-[#1de9b6] transition"
        >
          Create Job
        </button>
      </div>

      {hasOsJobs && (
        <div className="mb-6 p-3 rounded border border-orange-500/30 bg-orange-500/10 text-orange-200 text-sm">
          <strong>Migration Notice:</strong> OS-level crontab scripts were detected. We recommend migrating them to Hermes cron for unified logging and telemetry.
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0d0d20] w-full max-w-lg border border-[#1a1a3e] rounded flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a3e] shrink-0">
              <h2 className="text-sm text-[#c8d6e5] font-semibold">Create Hermes Cron Job</h2>
              <button onClick={closeModal} className="text-[#546e7a] hover:text-[#c8d6e5] text-xl">×</button>
            </div>
            
            <div className="p-5">
              <form onSubmit={createJob} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs text-[#546e7a] mb-1">Job Name</label>
                  <input
                    className="w-full bg-[#080815] border border-[#1a1a3e] rounded px-3 py-2 text-sm text-white focus:border-[#4fc3f7] focus:outline-none"
                    placeholder="e.g. daily-summary"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#546e7a] mb-1">Schedule</label>
                  <input
                    className="w-full bg-[#080815] border border-[#1a1a3e] rounded px-3 py-2 text-sm text-white focus:border-[#4fc3f7] focus:outline-none"
                    placeholder="e.g. 0 8 * * * or 'every 2h'"
                    value={schedule}
                    onChange={e => setSchedule(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#546e7a] mb-1">Agent Prompt (Optional if script provided)</label>
                  <textarea
                    className="w-full bg-[#080815] border border-[#1a1a3e] rounded px-3 py-2 text-sm text-white min-h-[80px] focus:border-[#4fc3f7] focus:outline-none"
                    placeholder="Agent instruction..."
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#546e7a] mb-1">Script Path (Optional if prompt provided)</label>
                  <input
                    className="w-full bg-[#080815] border border-[#1a1a3e] rounded px-3 py-2 text-sm text-white focus:border-[#4fc3f7] focus:outline-none"
                    placeholder="/path/to/script.sh"
                    value={script}
                    onChange={e => setScript(e.target.value)}
                  />
                </div>

                {error && <div className="text-[#ef5350] text-xs bg-[#ef535011] p-2 rounded border border-[#ef535044]">{error}</div>}

                <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-[#1a1a3e]">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 rounded text-sm text-[#546e7a] hover:text-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-[#4fc3f7] text-black px-4 py-2 rounded text-sm hover:bg-[#81d4fa] font-medium"
                  >
                    Create Job
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
        {cronJobs.map(job => (
          <div key={job.id} className="bg-[#1a1a3e] p-4 rounded border border-[#2a2a5a] flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <div className="font-mono text-sm text-white font-bold">{job.name}</div>
              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${job.source === 'hermes' ? 'bg-blue-500/20 text-blue-300' : 'bg-orange-500/20 text-orange-300'}`}>
                {job.source}
              </span>
            </div>
            
            <div className="text-xs text-[#b0bec5] mb-2">{job.description}</div>
            
            {job.command && (
              <div className="mb-2">
                <div className="text-[10px] text-[#546e7a] uppercase mb-0.5">Script / Command</div>
                <div className="font-mono text-xs text-[#4fc3f7] bg-[#080815] rounded px-2 py-1 break-all">{job.command}</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mt-auto pt-3 border-t border-[#2a2a5a]/50">
              <div>
                <div className="text-[10px] text-[#546e7a] uppercase mb-0.5">Schedule</div>
                <div className="font-mono text-xs text-[#00bfa5]">{job.schedule}</div>
              </div>
              <div>
                <div className="text-[10px] text-[#546e7a] uppercase mb-0.5">Next Run</div>
                <div className="font-mono text-xs text-white">
                  {job.nextRunAt ? new Date(job.nextRunAt).toLocaleString() : 'Unknown'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#546e7a] uppercase mb-0.5">Last Run</div>
                <div className="font-mono text-xs text-[#b0bec5]">
                  {job.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#546e7a] uppercase mb-0.5">Status</div>
                <div className={`text-xs font-bold ${job.enabled ? 'text-[#00bfa5]' : 'text-[#546e7a]'}`}>
                  {job.enabled ? 'Enabled' : 'Disabled'}
                </div>
              </div>
            </div>

            {job.logFile && (
              <div className="mt-2 pt-2 border-t border-[#2a2a5a]/50">
                <div className="text-[10px] text-[#546e7a] uppercase mb-0.5">Log Target</div>
                <div className="font-mono text-xs text-[#b0bec5]">{job.logFile}</div>
              </div>
            )}
          </div>
        ))}
        {cronJobs.length === 0 && (
          <div className="text-[#546e7a] text-sm italic col-span-2">No cron jobs found.</div>
        )}
      </div>
    </div>
  );
}