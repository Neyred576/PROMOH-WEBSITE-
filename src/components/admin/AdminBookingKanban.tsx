"use client";

import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/currencies";

interface BookingKanbanProps {
  allBookings: any[];
}

const COLUMNS = [
  {
    key: "pending",
    label: "Pending",
    bg: "bg-amber-500",
    border: "border-amber-200",
    pill: "bg-amber-100 text-amber-800",
  },
  {
    key: "accepted",
    label: "Accepted",
    bg: "bg-blue-500",
    border: "border-blue-200",
    pill: "bg-blue-100 text-blue-800",
  },
  {
    key: "in_progress",
    label: "In Progress",
    bg: "bg-indigo-500",
    border: "border-indigo-200",
    pill: "bg-indigo-100 text-indigo-800",
  },
  {
    key: "completed",
    label: "Completed",
    bg: "bg-green-500",
    border: "border-green-200",
    pill: "bg-green-100 text-green-800",
  },
  {
    key: "cancelled",
    label: "Cancelled",
    bg: "bg-rose-500",
    border: "border-rose-200",
    pill: "bg-rose-100 text-rose-800",
  },
  {
    key: "disputed",
    label: "Disputed",
    bg: "bg-orange-500",
    border: "border-orange-200",
    pill: "bg-orange-100 text-orange-800",
  },
];

export default function AdminBookingKanban({ allBookings }: BookingKanbanProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    setUpdatingId(bookingId);
    try {
      await updateDoc(doc(db, "bookings", bookingId), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Status update error", e);
    } finally {
      setUpdatingId(null);
    }
  };

  const total = allBookings.length;
  const completed = allBookings.filter((b) => b.status === "completed").length;
  const cancelled = allBookings.filter(
    (b) => b.status === "cancelled" || b.status === "rejected"
  ).length;
  const disputed = allBookings.filter((b) => b.status === "disputed").length;

  const completedPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const cancelledPct = total > 0 ? Math.round((cancelled / total) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Summary KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-secondary-50 p-4 rounded-2xl border border-secondary-200">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-secondary-500">
            Total In Pipeline
          </span>
          <p className="text-2xl font-black text-secondary-900 mt-0.5">{total}</p>
        </div>
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-green-700">
            Completion Rate
          </span>
          <p className="text-2xl font-black text-green-700 mt-0.5">{completedPct}%</p>
        </div>
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
            Cancellation Rate
          </span>
          <p className="text-2xl font-black text-rose-700 mt-0.5">{cancelledPct}%</p>
        </div>
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
            Disputed Rate
          </span>
          <p className="text-2xl font-black text-amber-700 mt-0.5">
            {disputed} Case{disputed === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {/* Kanban Board Container */}
      <div className="flex gap-4 overflow-x-auto pb-6 pt-1">
        {COLUMNS.map((col) => {
          const items = allBookings.filter((b) => {
            if (col.key === "cancelled") {
              return b.status === "cancelled" || b.status === "rejected";
            }
            return b.status === col.key;
          });

          return (
            <div
              key={col.key}
              className="flex-shrink-0 w-72 bg-secondary-100/70 rounded-2xl p-3 border border-secondary-200/80 flex flex-col max-h-[720px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.bg}`} />
                  <span className="font-extrabold text-xs uppercase tracking-wider text-secondary-800">
                    {col.label}
                  </span>
                </div>
                <span className={`text-xs font-black px-2 py-0.5 rounded-full ${col.pill}`}>
                  {items.length}
                </span>
              </div>

              {/* Cards Scrollable Area */}
              <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                {items.length === 0 ? (
                  <div className="text-center py-10 text-[11px] text-secondary-400 border border-dashed border-secondary-300 rounded-xl">
                    No bookings here
                  </div>
                ) : (
                  items.map((b) => (
                    <div
                      key={b.id}
                      className="bg-white rounded-xl p-3.5 border border-secondary-200/90 shadow-2xs hover:shadow-xs transition-shadow space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-secondary-900 leading-snug line-clamp-1">
                          {b.service || "Booking"}
                        </span>
                        <span className="font-extrabold text-secondary-900 shrink-0">
                          {formatCurrency(Number(b.amount || 0), "USD")}
                        </span>
                      </div>

                      <div className="text-[11px] text-secondary-500 space-y-0.5">
                        <p className="truncate">
                          <strong>Customer:</strong> {b.customerName || "Customer"}
                        </p>
                        <p className="truncate">
                          <strong>Provider:</strong> {b.providerName || "Provider"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-secondary-400 pt-1 border-t border-secondary-100">
                        <Calendar className="w-3 h-3" />
                        <span>{b.date || "Date N/A"}</span>
                        {b.time && <span>&bull; {b.time}</span>}
                      </div>

                      {/* Admin Quick Status Override */}
                      <div className="pt-1">
                        <select
                          disabled={updatingId === b.id}
                          value={b.status}
                          onChange={(e) => handleStatusChange(b.id, e.target.value)}
                          className="w-full text-[10px] font-semibold bg-secondary-50 border border-secondary-200 rounded-lg px-2 py-1 text-secondary-700 focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
                        >
                          <option value="pending">Move to: Pending</option>
                          <option value="accepted">Move to: Accepted</option>
                          <option value="in_progress">Move to: In Progress</option>
                          <option value="completed">Move to: Completed</option>
                          <option value="cancelled">Move to: Cancelled</option>
                          <option value="disputed">Move to: Disputed</option>
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
