"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/currencies";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Download, TrendingUp, CalendarDays, DollarSign, CheckCircle2 } from "lucide-react";

interface RealEarningsChartProps {
  bookings: any[];
  currency: string;
}

export default function RealEarningsChart({ bookings, currency }: RealEarningsChartProps) {
  const [daysRange, setDaysRange] = useState<7 | 30>(7);

  // Compute real chart data
  const { chartData, periodTotal, periodCount, avgTicket } = useMemo(() => {
    const days = daysRange;
    const now = new Date();
    const dateMap = new Map<string, number>();

    // Pre-populate days
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const key = d.toISOString().split("T")[0]; // YYYY-MM-DD
      dateMap.set(key, 0);
    }

    let total = 0;
    let count = 0;

    // Filter completed bookings
    bookings.forEach((b) => {
      if (b.status === "completed") {
        const rawDate = b.updatedAt || b.date;
        if (!rawDate) return;
        const bookingDate = rawDate.split("T")[0];
        if (dateMap.has(bookingDate)) {
          const amt = Number(b.amount || 0);
          dateMap.set(bookingDate, (dateMap.get(bookingDate) || 0) + amt);
          total += amt;
          count++;
        }
      }
    });

    // Format array for recharts
    const result = Array.from(dateMap.entries()).map(([dateStr, earnings]) => {
      const d = new Date(dateStr + "T12:00:00");
      const label =
        days === 7
          ? d.toLocaleDateString("en-US", { weekday: "short" })
          : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return {
        dateStr,
        label,
        earnings,
      };
    });

    const average = count > 0 ? total / count : 0;

    return {
      chartData: result,
      periodTotal: total,
      periodCount: count,
      avgTicket: average,
    };
  }, [bookings, daysRange]);

  // Export CSV Handler
  const handleExportCSV = () => {
    if (!bookings || bookings.length === 0) {
      alert("No bookings available to export.");
      return;
    }

    const headers = [
      "Booking ID",
      "Date",
      "Time",
      "Customer",
      "Service",
      "Status",
      "Payment Status",
      "Amount",
      "Currency",
      "Address",
    ];

    const rows = bookings.map((b) => [
      `"${b.id || ""}"`,
      `"${b.date || ""}"`,
      `"${b.time || ""}"`,
      `"${(b.customerName || "").replace(/"/g, '""')}"`,
      `"${(b.service || "").replace(/"/g, '""')}"`,
      `"${b.status || ""}"`,
      `"${b.paymentStatus || "pending"}"`,
      `"${b.amount !== undefined ? b.amount : b.estimatedRate || 0}"`,
      `"${currency}"`,
      `"${(b.address || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `promoh_earnings_statement_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="mb-8 overflow-hidden border-secondary-200/80 shadow-sm">
      <CardHeader className="border-b border-secondary-100 bg-secondary-50/50 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary-600" />
              Verified Revenue Analytics
            </CardTitle>
            <CardDescription className="text-xs">
              Live earnings generated from your completed bookings
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-secondary-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setDaysRange(7)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  daysRange === 7
                    ? "bg-white text-secondary-900 shadow-sm"
                    : "text-secondary-600 hover:text-secondary-900"
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => setDaysRange(30)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  daysRange === 30
                    ? "bg-white text-secondary-900 shadow-sm"
                    : "text-secondary-600 hover:text-secondary-900"
                }`}
              >
                30 Days
              </button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 text-xs px-3 border-secondary-300"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-secondary-500" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* KPI Mini-bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
                Period Earnings
              </p>
              <p className="text-xl font-bold text-blue-950">
                {formatCurrency(periodTotal, currency)}
              </p>
            </div>
          </div>

          <div className="p-3.5 bg-green-50/60 rounded-xl border border-green-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-100 text-green-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-green-700">
                Completed Jobs
              </p>
              <p className="text-xl font-bold text-green-950">{periodCount}</p>
            </div>
          </div>

          <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-700">
                Avg Job Value
              </p>
              <p className="text-xl font-bold text-purple-950">
                {formatCurrency(avgTicket, currency)}
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Area Chart */}
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickFormatter={(val) => `$${val}`}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                  fontSize: "12px",
                }}
                formatter={(value: any) => [
                  formatCurrency(Number(value) || 0, currency),
                  "Earned",
                ]}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]?.payload?.dateStr) {
                    return new Date(
                      payload[0].payload.dateStr + "T12:00:00"
                    ).toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    });
                  }
                  return label;
                }}
              />
              <Area
                type="monotone"
                dataKey="earnings"
                stroke="#2563eb"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorEarnings)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
