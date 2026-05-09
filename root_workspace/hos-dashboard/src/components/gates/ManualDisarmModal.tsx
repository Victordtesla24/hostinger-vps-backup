import { useState } from 'react';
import { useHOSStore } from '../../store/hosStore';
import type { WorkRequest } from '../../types';

interface Props {
  wrId: string;
  onClose: () => void;
}

export function ManualDisarmModal({ wrId, onClose }: Props) {
  const upsertWR = useHOSStore((s) => s.upsertWR);
  const [reason, setReason] = useState('');
  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  function handleNext() {
    if (reason.trim().length < 30) {
      setError(`Reason must be at least 30 characters (${reason.trim().length} entered)`);
      return;
    }
    setError('');
    setStep('confirm');
  }

  async function handleConfirm() {
    setWorking(true);
    try {
      const res = await fetch(`/api/v1/gates/${wrId}/disarm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json() as { error?: string; disarmed?: boolean };
      if (!res.ok) { setError(data.error ?? 'Disarm failed'); setStep('input'); return; }

      const wrRes = await fetch(`/api/v1/wr/${wrId}`);
      const wr = await wrRes.json() as WorkRequest;
      upsertWR(wr);
      onClose();
    } catch {
      setError('Network error');
      setStep('input');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0d0d20] border border-[#ef535066] rounded-lg w-full max-w-md p-6 shadow-2xl gate-armed">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-[#ef5350] tracking-widest">MANUAL DISARM</h2>
          <button onClick={onClose} className="text-[#546e7a] hover:text-[#c8d6e5] text-xl">×</button>
        </div>

        <p className="text-[12px] text-[#546e7a] mb-4">
          Disarming gate for <span className="text-[#c8d6e5] font-mono">{wrId}</span>.
          This requires a documented reason of at least 30 characters and two-step confirmation.
        </p>

        {step === 'input' ? (
          <>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full bg-[#080815] border border-[#1a1a3e] rounded px-3 py-2 text-[12px] text-[#c8d6e5] focus:border-[#ef5350] focus:outline-none resize-none mb-2"
              placeholder="Documented reason for disarming the gate (min 30 chars)..."
            />
            <p className={`text-[11px] mb-3 ${reason.trim().length >= 30 ? 'text-[#66bb6a]' : 'text-[#546e7a]'}`}>
              {reason.trim().length} / 30 characters minimum
            </p>
            {error && <p className="text-[#ef5350] text-[11px] mb-3">{error}</p>}
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-2 rounded border border-[#1a1a3e] text-[#546e7a] text-[12px] hover:border-[#2a2a5e]">
                Cancel
              </button>
              <button onClick={handleNext} className="flex-1 py-2 rounded border border-[#ef535044] text-[#ef5350] text-[12px] hover:bg-[#ef535011]">
                Continue →
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-[#080815] rounded p-3 mb-4 border border-[#ef535033]">
              <p className="text-[10px] text-[#546e7a] uppercase mb-1">Disarm Reason</p>
              <p className="text-[12px] text-[#c8d6e5]">{reason}</p>
            </div>
            <p className="text-[12px] text-[#ef5350] mb-4">
              Confirm: this will permanently disarm the Ralph-Loop-Infinite gate for this WR.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setStep('input')} className="flex-1 py-2 rounded border border-[#1a1a3e] text-[#546e7a] text-[12px]">
                ← Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={working}
                className="flex-1 py-2 rounded bg-[#ef535022] border border-[#ef535066] text-[#ef5350] text-[12px] hover:bg-[#ef535033] disabled:opacity-50"
              >
                {working ? 'Disarming...' : 'Confirm Disarm'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
