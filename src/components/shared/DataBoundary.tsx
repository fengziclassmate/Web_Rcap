import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type DataBoundaryProps = {
  loading: boolean;
  error?: Error | null;
  isEmpty: boolean;
  emptyMessage?: string;
  loadingSkeleton?: ReactNode;
  onRetry?: () => void;
  children: ReactNode;
};

function DefaultSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-xl border border-stone-100 bg-stone-50 p-4">
          <div className="h-3 w-1/3 rounded bg-stone-200" />
          <div className="mt-3 h-3 w-2/3 rounded bg-stone-200" />
          <div className="mt-2 h-3 w-1/2 rounded bg-stone-200" />
        </div>
      ))}
    </div>
  );
}

export function DataBoundary({
  loading,
  error = null,
  isEmpty,
  emptyMessage = "暂无数据。",
  loadingSkeleton,
  onRetry,
  children,
}: DataBoundaryProps) {
  if (loading) return <>{loadingSkeleton ?? <DefaultSkeleton />}</>;

  if (error) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
        <h3 className="font-semibold">数据加载失败</h3>
        <p className="mt-2 break-words text-red-700">{error.message}</p>
        {onRetry ? (
          <Button type="button" variant="outline" size="sm" className="mt-4 bg-white" onClick={onRetry}>
            重试
          </Button>
        ) : null}
      </section>
    );
  }

  if (isEmpty) {
    return (
      <section className="rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-center text-sm text-stone-500">
        {emptyMessage}
      </section>
    );
  }

  return <>{children}</>;
}
