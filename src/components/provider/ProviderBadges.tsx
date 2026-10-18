"use client";

import React from "react";
import {
  ShieldCheck,
  Star,
  Zap,
  Award,
  Clock,
  Sparkles,
  Trophy,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";

export interface BadgeItem {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  isUnlocked: boolean;
  color: string;
  bgColor: string;
  borderColor: string;
  progressText?: string;
}

export function computeProviderBadges(providerData: any, bookings: any[] = []): BadgeItem[] {
  const rating = Number(providerData?.rating || 0);
  const reviewCount = Number(providerData?.reviewCount || 0);
  const completedCount = bookings.filter((b) => b.status === "completed").length;
  const isVerified = !!providerData?.isVerified;
  const hasSchedule = !!providerData?.availability?.workingDays?.length;
  const hasPortfolio = (providerData?.portfolioURLs?.length || 0) >= 3;
  const trustScore = Number(providerData?.trustScore || 85);

  return [
    {
      id: "verified",
      name: "Verified Pro",
      description: "Official identity & credential verification approved by Promoh",
      icon: ShieldCheck,
      isUnlocked: isVerified,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      progressText: isVerified ? "Verified" : "Verification required",
    },
    {
      id: "top-rated",
      name: "Top Rated 2026",
      description: "Maintains an outstanding 4.8+ client review rating",
      icon: Star,
      isUnlocked: rating >= 4.8 && reviewCount >= 3,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      progressText:
        rating >= 4.8 && reviewCount >= 3
          ? "Unlocked"
          : `${Math.max(0, 3 - reviewCount)} more review${3 - reviewCount === 1 ? "" : "s"} needed`,
    },
    {
      id: "rapid-responder",
      name: "Rapid Responder",
      description: "Fast communication — typically replies in under 15 minutes",
      icon: Zap,
      isUnlocked: hasSchedule,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
      progressText: hasSchedule ? "Active" : "Set working schedule to unlock",
    },
    {
      id: "master-craft",
      name: "Showcase Master",
      description: "Demonstrated proven workmanship with verified portfolio photos",
      icon: Sparkles,
      isUnlocked: hasPortfolio,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
      progressText: hasPortfolio
        ? "Unlocked"
        : `${Math.max(0, 3 - (providerData?.portfolioURLs?.length || 0))} more photos needed`,
    },
    {
      id: "veteran-pro",
      name: "Job Veteran",
      description: "Successfully completed 5 or more client service bookings",
      icon: Trophy,
      isUnlocked: completedCount >= 5,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      borderColor: "border-indigo-200",
      progressText:
        completedCount >= 5 ? "Unlocked" : `${completedCount}/5 jobs completed`,
    },
    {
      id: "trust-elite",
      name: "Elite Trust Tier",
      description: "Achieved an exemplary safety, compliance & reliability standing",
      icon: Award,
      isUnlocked: trustScore >= 90,
      color: "text-rose-600",
      bgColor: "bg-rose-50",
      borderColor: "border-rose-200",
      progressText: `${trustScore}/100 Trust Score`,
    },
  ];
}

/**
 * Public badges strip to showcase earned badges on `/provider/[id]`
 */
export function ProviderBadgesStrip({
  providerData,
  className = "",
}: {
  providerData: any;
  className?: string;
}) {
  const badges = computeProviderBadges(providerData, []).filter((b) => b.isUnlocked);

  if (badges.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2.5 ${className}`}>
      {badges.map((b) => {
        const Icon = b.icon;
        return (
          <div
            key={b.id}
            title={b.description}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs hover:scale-105 cursor-help ${b.bgColor} ${b.color} ${b.borderColor}`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span>{b.name}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Detailed Dashboard Card for provider's achievement progress
 */
export function ProviderBadgesDashboardCard({
  providerData,
  bookings,
}: {
  providerData: any;
  bookings: any[];
}) {
  const badges = computeProviderBadges(providerData, bookings);
  const unlockedCount = badges.filter((b) => b.isUnlocked).length;

  return (
    <Card className="border-secondary-200/80 shadow-sm overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-secondary-50 to-primary-50/30 border-b border-secondary-100 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2 text-secondary-900">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>Earned Badges & Standing</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Badges boost your visibility and search ranking to clients
            </CardDescription>
          </div>
          <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-white border border-secondary-200 text-secondary-800 shadow-xs">
            {unlockedCount} / {badges.length} Unlocked
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {badges.map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.id}
                className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                  b.isUnlocked
                    ? `${b.bgColor} ${b.borderColor}`
                    : "bg-secondary-50/60 border-secondary-200/70 opacity-60"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    b.isUnlocked ? `bg-white ${b.color} shadow-xs` : "bg-secondary-200 text-secondary-400"
                  }`}
                >
                  {b.isUnlocked ? <Icon className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <h5
                      className={`text-xs font-bold truncate ${
                        b.isUnlocked ? "text-secondary-900" : "text-secondary-500"
                      }`}
                    >
                      {b.name}
                    </h5>
                    {b.isUnlocked && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-secondary-500 line-clamp-1 mt-0.5">
                    {b.description}
                  </p>
                  <p
                    className={`text-[10px] font-semibold mt-1.5 ${
                      b.isUnlocked ? b.color : "text-secondary-400"
                    }`}
                  >
                    {b.progressText}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
