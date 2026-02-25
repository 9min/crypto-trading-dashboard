'use client';

import { memo } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { ConnectionStatus } from './ConnectionStatus';
import { IntervalSelector } from './IntervalSelector';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { UserMenu } from '@/components/ui/UserMenu';
import { formatSymbol } from '@/utils/formatSymbol';

export const DashboardHeader = memo(function DashboardHeader() {
  const symbol = useUiStore((state) => state.symbol);

  return (
    <header className="border-border bg-background-secondary flex h-12 shrink-0 items-center justify-between border-b px-4">
      <div className="flex items-center gap-3">
        <h1 className="text-foreground text-sm font-semibold">CryptoDash</h1>
        <span className="font-mono-num text-accent text-sm font-medium">
          {formatSymbol(symbol)}
        </span>
        <IntervalSelector />
      </div>
      <div className="flex items-center gap-3">
        <ConnectionStatus />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
});
