'use client';

import { memo } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { ConnectionStatus } from './ConnectionStatus';
import { IntervalSelector } from './IntervalSelector';
import { ExchangeSelector } from '@/components/ui/ExchangeSelector';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { PriceAlertPopover } from '@/components/ui/PriceAlertPopover';
import { UserMenu } from '@/components/ui/UserMenu';
import { formatSymbol, formatUpbitSymbol } from '@/utils/formatSymbol';
import { toUpbitSymbol } from '@/utils/symbolMap';

export const DashboardHeader = memo(function DashboardHeader() {
  const symbol = useUiStore((state) => state.symbol);
  const exchange = useUiStore((state) => state.exchange);

  const displaySymbol =
    exchange === 'upbit' ? formatUpbitSymbol(toUpbitSymbol(symbol)) : formatSymbol(symbol);

  return (
    <header className="border-border bg-background-secondary flex h-12 shrink-0 items-center justify-between border-b px-4">
      <div className="flex items-center gap-4">
        <h1 className="text-accent text-sm font-bold tracking-wide">CryptoDash</h1>
        <div className="bg-border h-5 w-px" />
        <ExchangeSelector />
        <span className="font-mono-num text-foreground text-sm font-semibold">{displaySymbol}</span>
        <IntervalSelector />
      </div>
      <div className="flex items-center gap-4">
        <ConnectionStatus />
        <PriceAlertPopover />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
});
