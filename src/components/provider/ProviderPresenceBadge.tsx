"use client";

import React from "react";

interface ProviderPresenceBadgeProps {
  isOnline?: boolean;
  lastSeen?: string | any;
  className?: string;
  showText?: boolean;
}

export function ProviderPresenceBadge({
  isOnline,
  lastSeen,
  className = "",
  showText = true,
}: ProviderPresenceBadgeProps) {
  // Calculate if active within last 5 minutes
  let isActiveNow = !!isOnline;
  let relativeTimeText = "";

  if (lastSeen) {
    let ms = 0;
    if (typeof lastSeen === "object" && "seconds" in lastSeen) {
      ms = lastSeen.seconds * 1000;
    } else {
      ms = new Date(lastSeen).getTime();
    }

    if (!isNaN(ms) && ms > 0) {
      const diffMinutes = Math.floor((Date.now() - ms) / (60 * 1000));
      if (diffMinutes < 5) {
        isActiveNow = true;
      } else if (diffMinutes < 60) {
        relativeTimeText = `Active ${diffMinutes}m ago`;
      } else if (diffMinutes < 1440) {
        const hours = Math.floor(diffMinutes / 60);
        relativeTimeText = `Active ${hours}h ago`;
      } else {
        relativeTimeText = "Active recently";
      }
    }
  }

  if (isActiveNow) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-semibold select-none ${className}`}
        title="Online now - Typically responds within minutes"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        {showText && <span>Active Now</span>}
      </div>
    );
  }

  if (relativeTimeText && showText) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200/70 text-[11px] font-medium select-none ${className}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        <span>{relativeTimeText}</span>
      </div>
    );
  }

  return null;
}
