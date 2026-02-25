'use client';

import { useEffect } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { ToastContainer } from '@/components/ui/ToastContainer';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const theme = useUiStore((state) => state.theme);

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
