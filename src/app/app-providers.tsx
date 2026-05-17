"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { syncEngine } from "@/lib/sync-engine";
import { NetworkBanner } from "@/components/schedule/network-banner";
import { SyncIndicator } from "@/components/schedule/sync-indicator";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted && session?.user) syncEngine.init(session.user.id);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) syncEngine.init(session.user.id);
      else syncEngine.destroy();
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
      syncEngine.destroy();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <div className="fixed bottom-20 right-4 z-40 hidden sm:block">
        <SyncIndicator />
      </div>
      <NetworkBanner />
    </QueryClientProvider>
  );
}
