import { useState } from 'react';
import { useHOSStore } from '../../store/hosStore';
import type { WorkRequest } from '../../types';

interface Props {
  onClose: () => void;
}

export function WRCreateForm({ onClose }: Props) {
  const upsertWR = useHOSStore((s) => s.upsertWR);
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'feature' as const,
    priority: 3 as 1 | 2 | 3 | 4 | 5,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      setError('Title and description are required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/v1/wr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error);
      }
      const wr = await res.json() as WorkRequest;
      upsertWR(wr);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create WR');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d0d20] border border-[#1a1a3e] rounded-lg w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-[#4fc3f7] tracking-widest">NEW WORK REQUEST</h2>
          <button onClick={onClose} className="text-[#546e7a] hover:text-[#c8d6e5] text-lg">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] text-[#546e7a] mb-1 uppercase tracking-wider">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full bg-[#080815] border border-[#1a1a3e] rounded px-3 py-2 text-[13px] text-[#c8d6e5] focus:border-[#4fc3f7] focus:outline-none"
              placeholder="Brief descriptive title..."
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-[11px] text-[#546e7a] mb-1 uppercase tracking-wider">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full bg-[#080815] border border-[#1a1a3e] rounded px-3 py-2 text-[13px] text-[#c8d6e5] focus:border-[#4fc3f7] focus:outline-none resize-none"
              rows={5}
              placeholder="Full description, context, requirements, error messages..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-[#546e7a] mb-1 uppercase tracking-wider">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}
                className="w-full bg-[#080815] border border-[#1a1a3e] rounded px-3 py-2 text-[13px] text-[#c8d6e5] focus:border-[#4fc3f7] focus:outline-none"
              >
                <option value="feature">Feature</option>
                <option value="bug">Bug</option>
                <option value="research">Research</option>
                <option value="infra">Infra</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-[#546e7a] mb-1 uppercase tracking-wider">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) as typeof form.priority })}
                className="w-full bg-[#080815] border border-[#1a1a3e] rounded px-3 py-2 text-[13px] text-[#c8d6e5] focus:border-[#4fc3f7] focus:outline-none"
              >
                <option value={1}>P1 — Critical</option>
                <option value={2}>P2 — High</option>
                <option value={3}>P3 — Medium</option>
                <option value={4}>P4 — Low</option>
                <option value={5}>P5 — Backlog</option>
              </select>
            </div>
          </div>

          {error && (
            <p className="text-[#ef5350] text-[12px]">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded border border-[#1a1a3e] text-[#546e7a] text-[12px] hover:border-[#2a2a5e] hover:text-[#c8d6e5] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 rounded bg-[#4fc3f722] border border-[#4fc3f744] text-[#4fc3f7] text-[12px] hover:bg-[#4fc3f733] transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create WR'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
