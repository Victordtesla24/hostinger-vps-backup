import { useState, useMemo } from 'react';
import type { DecompositionResult } from '../../types';

type DiffOp = 'add' | 'remove' | 'equal';
interface DiffToken { op: DiffOp; text: string }

function lcs(a: string[], b: string[]): number[][] {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp;
}

function diffWords(original: string, revised: string): DiffToken[] {
  const a = original.split(/(\s+)/);
  const b = revised.split(/(\s+)/);
  const dp = lcs(a, b);
  const tokens: DiffToken[] = [];
  let i = a.length, j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      tokens.unshift({ op: 'equal', text: a[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tokens.unshift({ op: 'add', text: b[j - 1] });
      j--;
    } else {
      tokens.unshift({ op: 'remove', text: a[i - 1] });
      i--;
    }
  }
  return tokens;
}

interface LineEntry { op: DiffOp; text: string }

function diffLines(original: string[], revised: string[]): LineEntry[] {
  const dp = lcs(original, revised);
  const result: LineEntry[] = [];
  let i = original.length, j = revised.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && original[i - 1] === revised[j - 1]) {
      result.unshift({ op: 'equal', text: original[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ op: 'add', text: revised[j - 1] });
      j--;
    } else {
      result.unshift({ op: 'remove', text: original[i - 1] });
      i--;
    }
  }
  return result;
}

function tokenizeDescription(desc: string): string[] {
  return desc
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const LINE_STYLE: Record<DiffOp, string> = {
  add: 'bg-[#1a3a1a] border-l-2 border-[#66bb6a] text-[#a5d6a7]',
  remove: 'bg-[#3a1a1a] border-l-2 border-[#ef5350] text-[#ef9a9a]',
  equal: 'border-l-2 border-transparent text-[#7a8fa6]',
};
const LINE_PREFIX: Record<DiffOp, string> = { add: '+ ', remove: '− ', equal: '  ' };
const PREFIX_COLOR: Record<DiffOp, string> = {
  add: 'text-[#66bb6a]',
  remove: 'text-[#ef5350]',
  equal: 'text-[#2a3a4e]',
};

function InlineWordDiff({ original, revised }: { original: string; revised: string }) {
  const tokens = useMemo(() => diffWords(original, revised), [original, revised]);
  return (
    <span>
      {tokens.map((t, i) =>
        t.op === 'add' ? (
          <mark key={i} className="bg-[#1a3a1a] text-[#66bb6a] rounded px-0.5">{t.text}</mark>
        ) : t.op === 'remove' ? (
          <del key={i} className="bg-[#3a1a1a] text-[#ef5350] rounded px-0.5 no-underline line-through opacity-70">{t.text}</del>
        ) : (
          <span key={i} className="text-[#7a8fa6]">{t.text}</span>
        )
      )}
    </span>
  );
}

interface Props {
  description: string;
  decomposition: DecompositionResult;
}

export function DecompositionDiff({ description, decomposition }: Props) {
  const [view, setView] = useState<'unified' | 'split' | 'inline'>('unified');

  const originalLines = useMemo(() => tokenizeDescription(description), [description]);
  const revisedLines = useMemo(
    () => decomposition.structuredRequirements.map((r) => r.trim()).filter(Boolean),
    [decomposition.structuredRequirements],
  );
  const lineDiff = useMemo(() => diffLines(originalLines, revisedLines), [originalLines, revisedLines]);

  const addCount = lineDiff.filter((l) => l.op === 'add').length;
  const removeCount = lineDiff.filter((l) => l.op === 'remove').length;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-[#66bb6a] font-mono">+{addCount}</span>
          <span className="text-[#ef5350] font-mono">−{removeCount}</span>
          <span className="text-[#546e7a] text-[10px]">requirements extracted</span>
        </div>
        <div className="flex rounded overflow-hidden border border-[#1a1a3e]">
          {(['unified', 'split', 'inline'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 text-[10px] uppercase transition-colors ${view === v ? 'bg-[#1a1a3e] text-[#4fc3f7]' : 'text-[#546e7a] hover:text-[#c8d6e5]'}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Unified diff */}
      {view === 'unified' && (
        <div className="bg-[#080815] rounded overflow-hidden font-mono text-[11px]">
          <div className="px-3 py-1.5 bg-[#0d0d25] border-b border-[#1a1a3e] flex justify-between text-[10px] text-[#546e7a]">
            <span>original description → structured requirements</span>
          </div>
          <div className="divide-y divide-[#0d0d25]">
            {lineDiff.map((line, i) => (
              <div key={i} className={`flex gap-2 px-3 py-1 ${LINE_STYLE[line.op]}`}>
                <span className={`w-3 shrink-0 select-none ${PREFIX_COLOR[line.op]}`}>{LINE_PREFIX[line.op]}</span>
                <span className="break-all leading-relaxed">{line.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Split view */}
      {view === 'split' && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#080815] rounded overflow-hidden">
            <div className="px-3 py-1.5 bg-[#1a0a0a] border-b border-[#3a1a1a] text-[10px] text-[#ef9a9a]">Original Description</div>
            <div className="divide-y divide-[#0d0d15] font-mono text-[11px]">
              {originalLines.map((line, i) => (
                <div key={i} className="px-3 py-1 text-[#7a8fa6] leading-relaxed">{line}</div>
              ))}
            </div>
          </div>
          <div className="bg-[#080815] rounded overflow-hidden">
            <div className="px-3 py-1.5 bg-[#0a1a0a] border-b border-[#1a3a1a] text-[10px] text-[#a5d6a7]">Structured Requirements</div>
            <div className="divide-y divide-[#0d0d15] font-mono text-[11px]">
              {revisedLines.map((line, i) => (
                <div key={i} className="px-3 py-1 text-[#a5d6a7] leading-relaxed">
                  <span className="text-[#4fc3f7] mr-1.5">{i + 1}.</span>{line}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Inline word-level diff */}
      {view === 'inline' && (
        <div className="bg-[#080815] rounded overflow-hidden">
          <div className="px-3 py-1.5 bg-[#0d0d25] border-b border-[#1a1a3e] text-[10px] text-[#546e7a]">
            Word-level diff — <span className="text-[#66bb6a]">additions</span>{' '}
            <span className="text-[#ef5350]">removals</span>
          </div>
          <div className="px-3 py-3 text-[12px] leading-7">
            {revisedLines.length > 0 ? (
              revisedLines.map((req, i) => {
                const orig = originalLines[i] ?? '';
                return (
                  <div key={i} className="mb-2">
                    <span className="text-[10px] text-[#4fc3f7] font-mono mr-2">{i + 1}.</span>
                    <InlineWordDiff original={orig} revised={req} />
                  </div>
                );
              })
            ) : (
              <span className="text-[#546e7a]">No structured requirements yet.</span>
            )}
          </div>
        </div>
      )}

      {/* Acceptance criteria if present */}
      {decomposition.acceptanceCriteria.length > 0 && (
        <div className="bg-[#080815] rounded p-3">
          <p className="text-[10px] text-[#546e7a] uppercase mb-2">Acceptance Criteria</p>
          <ul className="space-y-1">
            {decomposition.acceptanceCriteria.map((c, i) => (
              <li key={i} className="flex gap-2 text-[11px] text-[#c8d6e5]">
                <span className="text-[#66bb6a] shrink-0">✓</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {decomposition.missingContextWarnings.length > 0 && (
        <div className="bg-[#1a0a2a] border border-[#4a2a6a] rounded p-3">
          <p className="text-[10px] text-[#ce93d8] uppercase mb-2">Missing Context</p>
          {decomposition.missingContextWarnings.map((w, i) => (
            <p key={i} className="text-[11px] text-[#ce93d8]">◆ {w}</p>
          ))}
        </div>
      )}
    </div>
  );
}
