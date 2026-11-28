import React from "react";

export function JobCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-secondary-100 p-6 shadow-xs animate-pulse space-y-4">
      {/* Category badge & timestamp */}
      <div className="flex items-center justify-between">
        <div className="h-6 bg-secondary-200 rounded-full w-28" />
        <div className="h-4 bg-secondary-100 rounded-md w-20" />
      </div>

      {/* Description lines */}
      <div className="space-y-2 pt-1">
        <div className="h-4 bg-secondary-200 rounded-md w-full" />
        <div className="h-4 bg-secondary-100 rounded-md w-4/5" />
      </div>

      {/* Meta tags (budget, deadline, contact) */}
      <div className="flex flex-wrap gap-3 pt-2">
        <div className="h-8 bg-secondary-100 rounded-xl w-28" />
        <div className="h-8 bg-secondary-100 rounded-xl w-32" />
        <div className="h-8 bg-primary-100/70 rounded-xl w-36 ml-auto" />
      </div>
    </div>
  );
}

export function JobGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </div>
  );
}
