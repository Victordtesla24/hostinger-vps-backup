import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { useHOSStore } from '../store/hosStore';
import { WRCard } from '../components/wr/WRCard';
import { WRCreateForm } from '../components/wr/WRCreateForm';
import { WRDetailModal } from '../components/wr/WRDetailModal';
import type { WorkRequest, WRStatus } from '../types';

const COLUMNS: { status: WRStatus; label: string }[] = [
  { status: 'DRAFT', label: 'Backlog' },
  { status: 'FRONT_DOOR', label: 'Front Door' },
  { status: 'IN_PROGRESS', label: 'In Progress' },
  { status: 'VERIFICATION', label: 'Verify' },
  { status: 'PASSED', label: 'Done' },
];

export function WorkRequestsPage() {
  const workRequests = useHOSStore((s) => s.workRequests);
  const selectedWR = useHOSStore((s) => s.selectedWR);
  const selectWR = useHOSStore((s) => s.selectWR);
  const upsertWR = useHOSStore((s) => s.upsertWR);
  const wrFilter = useHOSStore((s) => s.wrFilter);
  const setWrFilter = useHOSStore((s) => s.setWrFilter);
  const [showCreate, setShowCreate] = useState(false);

  const filtered = workRequests.filter((w) => {
    if (wrFilter.status && w.status !== wrFilter.status) return false;
    if (wrFilter.priority && w.priority !== wrFilter.priority) return false;
    if (wrFilter.type && w.type !== wrFilter.type) return false;
    if (wrFilter.agent && w.assignedAgent !== wrFilter.agent) return false;
    return true;
  });

  function byStatus(status: WRStatus) {
    return filtered.filter((w) => w.status === status);
  }

  async function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const newStatus = result.destination.droppableId as WRStatus;
    const wrId = result.draggableId;
    const wr = workRequests.find((w) => w.id === wrId);
    if (!wr || wr.status === newStatus) return;

    try {
      const res = await fetch(`/api/v1/wr/${wrId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const updated = await res.json() as WorkRequest;
      upsertWR(updated);
    } catch { /* ignore drag failure — UI stays consistent */ }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a3e] shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold text-[#4fc3f7] tracking-widest">WORK REQUESTS</h1>
          <span className="text-[11px] text-[#546e7a]">{workRequests.length} total</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Filters */}
          <select
            value={wrFilter.priority ?? ''}
            onChange={(e) => setWrFilter({ priority: e.target.value ? parseInt(e.target.value) as 1|2|3|4|5 : undefined })}
            className="bg-[#080815] border border-[#1a1a3e] rounded px-2 py-1 text-[11px] text-[#546e7a] focus:outline-none"
          >
            <option value="">All Priorities</option>
            {[1,2,3,4,5].map((p) => <option key={p} value={p}>P{p}</option>)}
          </select>
          <select
            value={wrFilter.type ?? ''}
            onChange={(e) => setWrFilter({ type: e.target.value || undefined })}
            className="bg-[#080815] border border-[#1a1a3e] rounded px-2 py-1 text-[11px] text-[#546e7a] focus:outline-none"
          >
            <option value="">All Types</option>
            <option value="feature">Feature</option>
            <option value="bug">Bug</option>
            <option value="research">Research</option>
            <option value="infra">Infra</option>
          </select>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-1.5 rounded bg-[#4fc3f722] border border-[#4fc3f744] text-[#4fc3f7] text-[12px] hover:bg-[#4fc3f733] transition-colors"
          >
            + NEW WR
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex flex-1 overflow-x-auto gap-0 p-4">
          {COLUMNS.map(({ status, label }) => {
            const cards = byStatus(status);
            return (
              <Droppable key={status} droppableId={status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`
                      flex flex-col w-52 shrink-0 mr-3 rounded border
                      ${snapshot.isDraggingOver ? 'border-[#4fc3f744] bg-[#4fc3f705]' : 'border-[#1a1a3e] bg-[#080815]'}
                    `}
                  >
                    <div className="px-3 py-2 border-b border-[#1a1a3e] flex items-center justify-between shrink-0">
                      <span className="text-[11px] text-[#546e7a] uppercase tracking-wider">{label}</span>
                      <span className="text-[11px] text-[#2a2a4e] bg-[#1a1a3e] rounded px-1.5 py-0.5">{cards.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                      {cards.map((wr, index) => (
                        <Draggable key={wr.id} draggableId={wr.id} index={index}>
                          {(dragProvided) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                            >
                              <WRCard wr={wr} onClick={() => selectWR(wr)} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>

      {showCreate && <WRCreateForm onClose={() => setShowCreate(false)} />}
      {selectedWR && <WRDetailModal />}
    </div>
  );
}
