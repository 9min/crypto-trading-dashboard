'use client';

import { memo } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { ConnectionStatus } from './ConnectionStatus';
import { IntervalSelector } from './IntervalSelector';
import { ExchangeSelector } from '@/components/ui/ExchangeSelector';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { PriceAlertPopover } from '@/components/ui/PriceAlertPopover';
import { WidgetSelector } from '@/components/ui/WidgetSelector';
import { ResetLayoutButton } from '@/components/ui/ResetLayoutButton';
import { UserMenu } from '@/components/ui/UserMenu';
import { formatSymbol, formatUpbitSymbol } from '@/utils/formatSymbol';
import { toUpbitSymbol } from '@/utils/symbolMap';

export const DashboardHeader = memo(function DashboardHeader() {
  const symbol = useUiStore((state) => state.symbol);
  const exchange = useUiStore((state) => state.exchange);

  const displaySymbol =
    exchange === 'upbit' ? formatUpbitSymbol(toUpbitSymbol(symbol)) : formatSymbol(symbol);

  return (
    <header
      data-testid="dashboard-header"
      className="border-border bg-background-secondary flex h-11 shrink-0 items-center justify-between border-b px-3 shadow-[var(--shadow-header)]"
    >
      <div className="flex items-center gap-3">
        <h1 className="text-accent text-xs font-bold tracking-wide">CryptoDash</h1>
        <div className="bg-border h-4 w-px" />
        <ExchangeSelector />
        <span className="font-mono-num text-foreground text-xs font-semibold">{displaySymbol}</span>
        <div className="bg-border h-4 w-px" />
        <IntervalSelector />
      </div>
      <div className="flex items-center gap-1.5">
        <ConnectionStatus />
        <div className="bg-border mx-1 h-4 w-px" />
        <WidgetSelector />
        <ResetLayoutButton />
        <PriceAlertPopover />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
});
