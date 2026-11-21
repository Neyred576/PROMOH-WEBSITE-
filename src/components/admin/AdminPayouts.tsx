"use client";

import React, { useState, useMemo } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  DollarSign,
  Download,
  CreditCard,
  CheckCircle,
  Clock,
  Search,
  Filter,
  Check,
} from "lucide-react";
import { formatCurrency } from "@/lib/currencies";

interface AdminPayoutsProps {
  allBookings: any[];
}

export default function AdminPayouts({ allBookings }: AdminPayoutsProps) {
  const [filter, setFilter] = useState<"all" | "pending" | "paid" | "disputed">("all");
  const [search, setSearch] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Completed bookings represent payable jobs
  const completedBookings = useMemo(() => {
    return allBookings.filter((b) => b.status === "completed");
  }, [allBookings]);

  // Totals
  const totalRevenue = useMemo(() => {
    return completedBookings.reduce((sum, b) => sum + Number(b.amount || 0), 0);
  }, [completedBookings]);

  const totalPaidOut = useMemo(() => {
    return completedBookings
      .filter((b) => b.payoutStatus === "paid")
      .reduce((sum, b) => sum + Number(b.amount || 0), 0);
  }, [completedBookings]);

  const pendingPayouts = totalRevenue - totalPaidOut;

  // Filtered
  const filtered = useMemo(() => {
    return completedBookings.filter((b) => {
      const pStatus = b.payoutStatus || "pending";
      if (filter === "pending" && pStatus !== "pending") return false;
      if (filter === "paid" && pStatus !== "paid") return false;
      if (filter === "disputed" && b.status !== "disputed") return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        b.providerName?.toLowerCase().includes(q) ||
        b.customerName?.toLowerCase().includes(q) ||
        b.service?.toLowerCase().includes(q) ||
        b.id?.toLowerCase().includes(q)
      );
    });
  }, [completedBookings, filter, search]);

  const markAsPaid = async (bookingId: string) => {
    setProcessingId(bookingId);
    try {
      await updateDoc(doc(db, "bookings", bookingId), {
        payoutStatus: "paid",
        payoutDate: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Payout update failed", e);
    } finally {
      setProcessingId(null);
    }
  };

  const exportCSV = () => {
    const headers = [
      "Booking ID",
      "Provider Name",
      "Customer Name",
      "Service",
      "Amount",
      "Date",
      "Payout Status",
      "Payout Date",
    ];

    const rows = completedBookings.map((b) => [
      b.id,
      `"${b.providerName || ""}"`,
      `"${b.customerName || ""}"`,
      `"${b.service || ""}"`,
      b.amount || 0,
      b.date || "",
      b.payoutStatus || "pending",
      b.payoutDate || "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `promoh_payouts_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Financial KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-secondary-200 bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-secondary-500">
                Gross Completed Volume
              </span>
              <DollarSign className="w-5 h-5 text-secondary-600" />
            </div>
            <div className="text-2xl font-black text-secondary-900">
              {formatCurrency(totalRevenue, "USD")}
            </div>
            <p className="text-[11px] text-secondary-500 mt-1">
              From {completedBookings.length} completed bookings
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-green-800">
                Total Settled & Paid
              </span>
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-2xl font-black text-green-950">
              {formatCurrency(totalPaidOut, "USD")}
            </div>
            <p className="text-[11px] text-green-700 mt-1">
              Transferred to verified providers
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Pending Payouts
              </span>
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-950">
              {formatCurrency(pendingPayouts, "USD")}
            </div>
            <p className="text-[11px] text-amber-700 mt-1">
              Awaiting payout execution
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
                Payout Rate
              </span>
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-blue-950">
              {totalRevenue > 0
                ? `${Math.round((totalPaidOut / totalRevenue) * 100)}%`
                : "0%"}
            </div>
            <p className="text-[11px] text-blue-700 mt-1">
              Disbursed platform volume
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border-secondary-200">
        <CardHeader className="bg-secondary-50/50 border-b border-secondary-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary-600" />
                Provider Payout Ledger
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time disbursements, settlement tracking, and transaction records.
              </CardDescription>
            </div>
            <Button
              onClick={exportCSV}
              variant="outline"
              size="sm"
              className="text-xs font-semibold gap-1.5 h-9 shrink-0"
            >
              <Download className="w-4 h-4" /> Export CSV Report
            </Button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
            <div className="flex items-center gap-1.5 bg-white border border-secondary-200 rounded-xl p-1 overflow-x-auto">
              {(["all", "pending", "paid"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all whitespace-nowrap ${
                    filter === f
                      ? "bg-secondary-900 text-white"
                      : "text-secondary-600 hover:text-secondary-900"
                  }`}
                >
                  {f === "pending" ? "Pending Payout" : f === "paid" ? "Paid Out" : "All Completed"}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-secondary-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search provider, service..."
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-secondary-200 text-xs bg-white text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-xs text-secondary-400">
              No completed transactions matching your filter.
            </div>
          ) : (
            <div className="divide-y divide-secondary-100 max-h-[600px] overflow-y-auto">
              {filtered.map((b) => {
                const isPaid = b.payoutStatus === "paid";
                return (
                  <div
                    key={b.id}
                    className="p-4 hover:bg-secondary-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-secondary-900">
                          {b.service || "Service Job"}
                        </span>
                        <span className="text-[11px] font-mono text-secondary-400">
                          #{b.id.slice(0, 8)}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            isPaid
                              ? "bg-green-100 text-green-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {isPaid ? "Paid Out" : "Pending Payout"}
                        </span>
                      </div>

                      <div className="text-secondary-600 flex items-center gap-3 flex-wrap">
                        <span>
                          <strong>Provider:</strong> {b.providerName || "Provider"}
                        </span>
                        <span>&bull;</span>
                        <span>
                          <strong>Customer:</strong> {b.customerName || "Customer"}
                        </span>
                        <span>&bull;</span>
                        <span>
                          <strong>Date:</strong> {b.date || "N/A"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <span className="text-base font-black text-secondary-900">
                          {formatCurrency(Number(b.amount || 0), "USD")}
                        </span>
                        {b.payoutDate && (
                          <p className="text-[10px] text-secondary-400">
                            Paid {new Date(b.payoutDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      {!isPaid && (
                        <Button
                          size="sm"
                          variant="outline"
                          isLoading={processingId === b.id}
                          onClick={() => markAsPaid(b.id)}
                          className="text-xs h-8 text-green-700 border-green-300 hover:bg-green-50"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" /> Mark as Paid
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
