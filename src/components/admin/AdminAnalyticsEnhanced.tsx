"use client";

import React, { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import {
  TrendingUp,
  Users,
  Briefcase,
  DollarSign,
  AlertTriangle,
  Award,
  Layers,
  CheckCircle2,
  Percent,
} from "lucide-react";
import { formatCurrency } from "@/lib/currencies";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

interface Props {
  allBookings: any[];
  allProviders: any[];
  allCustomers: any[];
  totalRevenue: number;
}

function toMs(val: any): number {
  if (!val) return 0;
  if (typeof val === "object" && "seconds" in val) return val.seconds * 1000;
  const d = new Date(val).getTime();
  return isNaN(d) ? 0 : d;
}

export default function AdminAnalyticsEnhanced({
  allBookings,
  allProviders,
  allCustomers,
  totalRevenue,
}: Props) {
  // 1. Core Conversion & Retention Metrics
  const metrics = useMemo(() => {
    const total = allBookings.length;
    const completed = allBookings.filter((b) => b.status === "completed").length;
    const acceptedOrDone = allBookings.filter(
      (b) => b.status === "accepted" || b.status === "in_progress" || b.status === "completed"
    ).length;

    const conversionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : "0.0";
    const acceptanceRate = total > 0 ? ((acceptedOrDone / total) * 100).toFixed(1) : "0.0";
    const avgTicket = completed > 0 ? totalRevenue / completed : 0;

    // Customer retention (customers who have >1 booking)
    const customerBookingCount = new Map<string, number>();
    allBookings.forEach((b) => {
      const cid = b.customerId || b.customerName;
      if (cid) customerBookingCount.set(cid, (customerBookingCount.get(cid) || 0) + 1);
    });
    let repeatCustomers = 0;
    customerBookingCount.forEach((count) => {
      if (count > 1) repeatCustomers++;
    });
    const totalCustomersWithBookings = customerBookingCount.size;
    const retentionRate =
      totalCustomersWithBookings > 0
        ? ((repeatCustomers / totalCustomersWithBookings) * 100).toFixed(1)
        : "0.0";

    return {
      conversionRate,
      acceptanceRate,
      avgTicket,
      retentionRate,
      completed,
    };
  }, [allBookings, totalRevenue]);

  // 2. Top 5 Providers by Revenue
  const topProviders = useMemo(() => {
    const map = new Map<string, { name: string; jobs: number; revenue: number }>();

    allBookings.forEach((b) => {
      if (b.status === "completed") {
        const id = b.providerId || b.providerName || "Unknown";
        const name = b.providerName || "Provider";
        const amt = Number(b.amount || 0);

        if (!map.has(id)) {
          map.set(id, { name, jobs: 0, revenue: 0 });
        }
        const curr = map.get(id)!;
        curr.jobs += 1;
        curr.revenue += amt;
      }
    });

    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [allBookings]);

  // 3. Top 5 Service Categories
  const topCategories = useMemo(() => {
    const map = new Map<string, number>();
    allBookings.forEach((b) => {
      const svc = (b.service || "General Service").trim();
      map.set(svc, (map.get(svc) || 0) + 1);
    });

    const total = allBookings.length || 1;
    return Array.from(map.entries())
      .map(([service, count]) => ({
        service,
        count,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [allBookings]);

  // 4. Growth Chart (Last 14 Days)
  const growthData = useMemo(() => {
    const days = 14;
    const now = new Date();
    const map = new Map<string, { dateStr: string; label: string; customers: number; providers: number }>();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      map.set(dateStr, { dateStr, label, customers: 0, providers: 0 });
    }

    allCustomers.forEach((c) => {
      const dateStr = c.createdAt ? new Date(toMs(c.createdAt)).toISOString().split("T")[0] : null;
      if (dateStr && map.has(dateStr)) {
        map.get(dateStr)!.customers += 1;
      }
    });

    allProviders.forEach((p) => {
      const dateStr = p.createdAt ? new Date(toMs(p.createdAt)).toISOString().split("T")[0] : null;
      if (dateStr && map.has(dateStr)) {
        map.get(dateStr)!.providers += 1;
      }
    });

    return Array.from(map.values());
  }, [allCustomers, allProviders]);

  // 5. Churn Alert (Providers with 0 completed bookings in > 30 days)
  const churnAlerts = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const providerLastJob = new Map<string, number>();

    allBookings.forEach((b) => {
      if (b.status === "completed" && b.providerId) {
        const time = toMs(b.updatedAt || b.date);
        const prev = providerLastJob.get(b.providerId) || 0;
        if (time > prev) providerLastJob.set(b.providerId, time);
      }
    });

    return allProviders
      .filter((p) => p.status === "Approved")
      .map((p) => {
        const lastJob = providerLastJob.get(p.id) || toMs(p.createdAt);
        const daysIdle = Math.round((Date.now() - lastJob) / (24 * 60 * 60 * 1000));
        return {
          id: p.id,
          name: p.businessName || `${p.firstName} ${p.lastName}`,
          daysIdle,
        };
      })
      .filter((p) => p.daysIdle >= 30)
      .sort((a, b) => b.daysIdle - a.daysIdle)
      .slice(0, 5);
  }, [allProviders, allBookings]);

  return (
    <div className="space-y-6">
      {/* 4 Conversion & Health KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-secondary-200 bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-secondary-500">
                Booking Conversion
              </span>
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
            <div className="text-3xl font-black text-secondary-900">{metrics.conversionRate}%</div>
            <p className="text-[11px] text-green-700 mt-1">Jobs completed vs placed</p>
          </CardContent>
        </Card>

        <Card className="border-secondary-200 bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-secondary-500">
                Provider Acceptance
              </span>
              <Percent className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-3xl font-black text-secondary-900">{metrics.acceptanceRate}%</div>
            <p className="text-[11px] text-blue-700 mt-1">Acceptance rate across pros</p>
          </CardContent>
        </Card>

        <Card className="border-secondary-200 bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-secondary-500">
                Avg Job Ticket
              </span>
              <DollarSign className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-3xl font-black text-secondary-900">
              {formatCurrency(metrics.avgTicket, "USD")}
            </div>
            <p className="text-[11px] text-indigo-700 mt-1">Average completed volume</p>
          </CardContent>
        </Card>

        <Card className="border-secondary-200 bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-secondary-500">
                Customer Retention
              </span>
              <Users className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-3xl font-black text-secondary-900">{metrics.retentionRate}%</div>
            <p className="text-[11px] text-purple-700 mt-1">Repeat booking customer rate</p>
          </CardContent>
        </Card>
      </div>

      {/* 14-Day Growth Area Chart */}
      <Card className="border-secondary-200">
        <CardHeader className="bg-secondary-50/50 border-b border-secondary-100 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary-600" /> Platform User Growth Trajectory (14 Days)
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time daily onboarding comparison between Customers and Providers.
              </CardDescription>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-blue-600">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Customers
              </span>
              <span className="flex items-center gap-1.5 text-indigo-600">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Providers
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="growthCustomers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="growthProviders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                <RechartsTooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                />
                <Area type="monotone" dataKey="customers" name="Customers" stroke="#3b82f6" strokeWidth={2.5} fill="url(#growthCustomers)" />
                <Area type="monotone" dataKey="providers" name="Providers" stroke="#6366f1" strokeWidth={2.5} fill="url(#growthProviders)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top 5 Providers & Top 5 Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Top 5 Providers */}
        <Card className="border-secondary-200">
          <CardHeader className="bg-secondary-50/50 border-b border-secondary-100 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" /> Top Providers by Generated Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {topProviders.length === 0 ? (
              <div className="text-center py-8 text-xs text-secondary-400">
                No completed bookings recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-secondary-100">
                {topProviders.map((p, i) => (
                  <div key={p.name + i} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-secondary-100 font-bold text-secondary-700 flex items-center justify-center text-[11px]">
                        #{i + 1}
                      </span>
                      <div>
                        <p className="font-bold text-secondary-900">{p.name}</p>
                        <p className="text-[10px] text-secondary-400">{p.jobs} jobs completed</p>
                      </div>
                    </div>
                    <span className="font-black text-secondary-900">
                      {formatCurrency(p.revenue, "USD")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top 5 Categories */}
        <Card className="border-secondary-200">
          <CardHeader className="bg-secondary-50/50 border-b border-secondary-100 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary-600" /> High Demand Service Categories
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {topCategories.length === 0 ? (
              <div className="text-center py-8 text-xs text-secondary-400">
                No booking categories logged yet.
              </div>
            ) : (
              topCategories.map((c) => (
                <div key={c.service} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-secondary-900">{c.service}</span>
                    <span className="text-secondary-500 font-semibold">
                      {c.count} bookings ({c.pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-secondary-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-600 rounded-full"
                      style={{ width: `${c.pct}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Churn Alert Box */}
      <Card className="border-amber-200 bg-amber-50/30">
        <CardHeader className="border-b border-amber-100/70 pb-3">
          <CardTitle className="text-sm font-bold text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" /> Provider Churn Risk Warnings
          </CardTitle>
          <CardDescription className="text-xs text-amber-700">
            Approved providers with zero completed bookings in over 30 days. Recommend re-engagement.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {churnAlerts.length === 0 ? (
            <p className="text-xs text-green-700 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> All verified providers have recent activity. Zero churn risk!
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {churnAlerts.map((a) => (
                <div key={a.id} className="p-3 bg-white rounded-xl border border-amber-200 text-xs">
                  <p className="font-bold text-secondary-900 truncate">{a.name}</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">Idle for {a.daysIdle} days</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
