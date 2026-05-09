import { useHOSStore } from '../../store/hosStore';
import type { NavPage } from '../../types';

interface NavItem {
  page: NavPage;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { page: 'dashboard', label: 'Dashboard', icon: '◈' },
  { page: 'work-requests', label: 'Work Requests', icon: '◉' },
  { page: 'agents', label: 'Agents', icon: '◎' },
  { page: 'quality-gates', label: 'Quality Gates', icon: '⬡' },
  { page: 'telemetry', label: 'Telemetry', icon: '◆' },
  { page: 'cron-jobs', label: 'Cron Jobs', icon: '⏱' },
];

export function SideNav() {
  const currentPage = useHOSStore((s) => s.currentPage);
  const setPage = useHOSStore((s) => s.setPage);
  const workRequests = useHOSStore((s) => s.workRequests);
  const agents = useHOSStore((s) => s.agents);

  const badgeCounts: Partial<Record<NavPage, number>> = {
    'work-requests': workRequests.filter((w) => w.status === 'VERIFICATION' || w.status === 'IN_PROGRESS').length,
    agents: agents.filter((a) => a.status === 'failed' || a.status === 'blocked').length,
    'quality-gates': workRequests.filter((w) => w.gateState === 'ARMED').length,
  };

  return (
    <nav className="w-14 flex flex-col border-r border-[#1a1a3e] bg-[#080815] shrink-0">
      {NAV_ITEMS.map(({ page, label, icon }) => {
        const active = currentPage === page;
        const badge = badgeCounts[page];
        return (
          <button
            key={page}
            title={label}
            onClick={() => setPage(page)}
            className={`
              relative flex flex-col items-center justify-center h-14 text-lg transition-all duration-150
              ${active
                ? 'text-[#4fc3f7] border-r-2 border-[#4fc3f7] bg-[#4fc3f711]'
                : 'text-[#546e7a] hover:text-[#c8d6e5] hover:bg-[#1a1a2e]'
              }
            `}
          >
            <span>{icon}</span>
            {badge !== undefined && badge > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#ef5350] text-white text-[9px] flex items-center justify-center font-bold">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
