import React from "react";

export function ProviderCardSkeleton() {
  return (
    <div className="rounded-2xl border border-secondary-200/80 bg-white shadow-xs overflow-hidden flex flex-col h-full animate-pulse">
      {/* Banner / Photo placeholder */}
      <div className="h-40 bg-gradient-to-r from-secondary-100 via-secondary-200/70 to-secondary-100 relative flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-secondary-200/90 border-4 border-white shadow-2xs" />
        <div className="absolute top-3 left-3 w-20 h-5 rounded-md bg-secondary-200/90" />
      </div>

      {/* Card Content */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2.5">
          {/* Provider name */}
          <div className="h-5 bg-secondary-200 rounded-md w-3/4" />
          {/* Service category */}
          <div className="h-4 bg-secondary-100 rounded-md w-1/2" />
          {/* Location */}
          <div className="flex items-center gap-2 pt-1">
            <div className="w-3.5 h-3.5 rounded-full bg-secondary-200 shrink-0" />
            <div className="h-3.5 bg-secondary-100 rounded-md w-2/5" />
          </div>
        </div>

        {/* Bottom meta row */}
        <div className="pt-3 border-t border-secondary-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-secondary-200" />
            <div className="h-4 bg-secondary-200 rounded-md w-10" />
          </div>
          <div className="h-8 bg-primary-100/70 rounded-xl w-24" />
        </div>
      </div>
    </div>
  );
}

export function ProviderGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ProviderCardSkeleton key={i} />
      ))}
    </div>
  );
}
