import { type ReactNode } from 'react';
import { TopBar } from './TopBar';
import { SideNav } from './SideNav';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0a0a1a]">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <SideNav />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
