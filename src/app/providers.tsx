'use client';

import { useEffect } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { useAuth } from '@/hooks/useAuth';
import { usePreferencesSync } from '@/hooks/usePreferencesSync';
import { ToastContainer } from '@/components/ui/ToastContainer';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const theme = useUiStore((state) => state.theme);

  // Initialize auth session listener and preferences sync
  useAuth();
  usePreferencesSync();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      {children}
      <ToastContainer />
    </>
  );
}
