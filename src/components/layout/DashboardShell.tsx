'use client';

import { memo } from 'react';
import { DashboardHeader } from './DashboardHeader';

export const DashboardShell = memo(function DashboardShell() {
  return (
    <div className="bg-background flex h-screen flex-col">
      <DashboardHeader />
      <main className="flex-1 overflow-hidden p-2">
        <div className="border-border bg-background-secondary flex h-full items-center justify-center rounded-lg border">
          <div className="text-center">
            <h2 className="text-foreground text-lg font-medium">Dashboard Widgets</h2>
            <p className="text-foreground-secondary mt-1 text-sm">Widgets will be rendered here</p>
          </div>
        </div>
      </main>
    </div>
  );
});
