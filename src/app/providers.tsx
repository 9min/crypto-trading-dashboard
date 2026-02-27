'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useUiStore } from '@/stores/uiStore';
import { useWebVitals } from '@/hooks/useWebVitals';
import { ToastContainer } from '@/components/ui/ToastContainer';

// Lazy-load auth + preferences sync to keep Supabase (~58KB gzip)
// out of the initial JS bundle. Loaded after hydration.
const AuthProvider = dynamic(
  () => import('@/components/layout/AuthProvider').then((mod) => mod.AuthProvider),
  { ssr: false },
);

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const theme = useUiStore((state) => state.theme);

  useWebVitals();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      <AuthProvider />
      {children}
      <ToastContainer />
    </>
  );
}
