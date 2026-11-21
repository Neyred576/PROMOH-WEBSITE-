"use client";

import React, { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
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
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  ShieldAlert,
  UserCheck,
  RefreshCw,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { formatCurrency } from "@/lib/currencies";

interface DisputeBooking {
  id: string;
  customerName?: string;
  customerId?: string;
  providerName?: string;
  providerId?: string;
  service?: string;
  amount?: number | string;
  date?: string;
  time?: string;
  status: string;
  disputeReason?: string;
  disputedAt?: any;
  resolution?: string;
  resolvedAt?: string;
  paymentStatus?: string;
  adminWarned?: boolean;
}

function parseDate(val: any): string {
  if (!val) return "Recent";
  if (typeof val === "object" && "seconds" in val) {
    return new Date(val.seconds * 1000).toLocaleDateString();
  }
  return new Date(val).toLocaleDateString();
}

export default function AdminDisputeCenter() {
  const [allBookings, setAllBookings] = useState<DisputeBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "resolved" | "all">("active");
  const [msg, setMsg] = useState("");

  const showMsg = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(""), 4000);
  };

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "bookings"),
      (snap) => {
        const list: DisputeBooking[] = [];
        snap.forEach((d) => {
          const data = d.data() as DisputeBooking;
          // Match disputed bookings or resolution records
          if (
            data.status === "disputed" ||
            data.status === "dispute_resolved" ||
            data.disputeReason
          ) {
            list.push({ ...data, id: d.id });
          }
        });
        setAllBookings(list);
        setLoading(false);
      },
      (err) => {
        console.error("Disputes listener error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const activeDisputes = allBookings.filter((b) => b.status === "disputed");
  const resolvedDisputes = allBookings.filter(
    (b) => b.status === "dispute_resolved"
  );

  const displayedList =
    filter === "active"
      ? activeDisputes
      : filter === "resolved"
      ? resolvedDisputes
      : allBookings;

  // Actions
  const handleRefund = async (booking: DisputeBooking) => {
    if (!confirm(`Refund customer for booking #${booking.id.slice(0, 8)}?`))
      return;
    setActionLoading(booking.id + "_refund");
    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        status: "dispute_resolved",
        resolution: "refunded",
        paymentStatus: "refunded",
        resolvedAt: new Date().toISOString(),
      });

      if (booking.customerId) {
        await addDoc(collection(db, "notifications"), {
          userId: booking.customerId,
          title: "Dispute Resolved: Refund Issued",
          message: `Your dispute for ${booking.service || "service"} has been resolved. A full refund has been credited.`,
          link: "/dashboard",
          read: false,
          createdAt: serverTimestamp(),
        });
      }

      showMsg("✅ Customer refunded and dispute marked resolved!");
    } catch (e) {
      console.error(e);
      showMsg("Error processing refund.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRelease = async (booking: DisputeBooking) => {
    if (
      !confirm(
        `Release payment to provider for booking #${booking.id.slice(0, 8)}?`
      )
    )
      return;
    setActionLoading(booking.id + "_release");
    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        status: "dispute_resolved",
        resolution: "released",
        payoutStatus: "paid",
        resolvedAt: new Date().toISOString(),
      });

      if (booking.providerId) {
        await addDoc(collection(db, "notifications"), {
          userId: booking.providerId,
          title: "Dispute Resolved: Payment Released",
          message: `The dispute for ${booking.service || "service"} has been cleared by admin. Payout has been released.`,
          link: "/provider/dashboard",
          read: false,
          createdAt: serverTimestamp(),
        });
      }

      showMsg("✅ Payment released to provider and dispute resolved!");
    } catch (e) {
      console.error(e);
      showMsg("Error releasing payment.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleWarnBoth = async (booking: DisputeBooking) => {
    setActionLoading(booking.id + "_warn");
    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        adminWarned: true,
      });

      if (booking.customerId) {
        await addDoc(collection(db, "notifications"), {
          userId: booking.customerId,
          title: "Admin Notice: Booking Under Mediation",
          message: `Promoh Trust & Safety is reviewing booking #${booking.id.slice(
            0,
            8
          )}. Please keep communication within platform terms.`,
          link: "/dashboard",
          read: false,
          createdAt: serverTimestamp(),
        });
      }

      if (booking.providerId) {
        await addDoc(collection(db, "notifications"), {
          userId: booking.providerId,
          title: "Admin Notice: Booking Under Mediation",
          message: `Promoh Trust & Safety has issued a warning regarding booking #${booking.id.slice(
            0,
            8
          )}. Please review project requirements.`,
          link: "/provider/dashboard",
          read: false,
          createdAt: serverTimestamp(),
        });
      }

      showMsg("⚠️ Mediation warnings sent to both customer and provider.");
    } catch (e) {
      console.error(e);
      showMsg("Error sending mediation notice.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Active Disputes
              </p>
              <h3 className="text-3xl font-extrabold text-amber-950 mt-1">
                {activeDisputes.length}
              </h3>
              <p className="text-[11px] text-amber-700 mt-1 font-medium">
                Requires admin arbitration
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-green-800">
                Resolved Disputes
              </p>
              <h3 className="text-3xl font-extrabold text-green-950 mt-1">
                {resolvedDisputes.length}
              </h3>
              <p className="text-[11px] text-green-700 mt-1 font-medium">
                Settled through mediation
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-green-700">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-secondary-200 bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-secondary-500">
                Resolution SLA
              </p>
              <h3 className="text-3xl font-extrabold text-secondary-900 mt-1">
                &lt; 24h
              </h3>
              <p className="text-[11px] text-secondary-500 mt-1 font-medium">
                Target mediation turnaround
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-secondary-100 flex items-center justify-center text-secondary-600">
              <Clock className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {msg && (
        <div className="p-3 bg-primary-50 border border-primary-200 text-primary-800 text-xs font-medium rounded-xl">
          {msg}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-secondary-100 p-1 rounded-xl">
          <button
            onClick={() => setFilter("active")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === "active"
                ? "bg-white text-secondary-900 shadow-xs"
                : "text-secondary-600 hover:text-secondary-900"
            }`}
          >
            Active ({activeDisputes.length})
          </button>
          <button
            onClick={() => setFilter("resolved")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === "resolved"
                ? "bg-white text-secondary-900 shadow-xs"
                : "text-secondary-600 hover:text-secondary-900"
            }`}
          >
            Resolved ({resolvedDisputes.length})
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === "all"
                ? "bg-white text-secondary-900 shadow-xs"
                : "text-secondary-600 hover:text-secondary-900"
            }`}
          >
            All History ({allBookings.length})
          </button>
        </div>
      </div>

      {/* Disputes List */}
      <Card className="border-secondary-200">
        <CardHeader className="bg-secondary-50/50 border-b border-secondary-100">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Dispute Cases Management
          </CardTitle>
          <CardDescription className="text-xs">
            Review customer claims, inspect booking communications, and enforce platform arbitration.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="text-center py-8 text-xs text-secondary-400">
              Loading dispute records...
            </div>
          ) : displayedList.length === 0 ? (
            <div className="text-center py-12 text-secondary-500">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p className="font-semibold text-sm">No disputes found</p>
              <p className="text-xs text-secondary-400 mt-1">
                Platform is operating normally with zero active customer-provider escalations.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedList.map((b) => (
                <div
                  key={b.id}
                  className="p-5 rounded-2xl border border-secondary-200 bg-white hover:border-secondary-300 transition-colors space-y-3"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-secondary-900">
                          {b.service || "Booking"}
                        </span>
                        <span className="text-xs font-mono text-secondary-400">
                          #{b.id.slice(0, 8)}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            b.status === "disputed"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {b.status.replace("_", " ")}
                        </span>
                        {b.adminWarned && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            Warned
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-secondary-500 mt-1 flex items-center gap-3 flex-wrap">
                        <span>
                          <strong>Customer:</strong> {b.customerName || "Customer"}
                        </span>
                        <span>&bull;</span>
                        <span>
                          <strong>Provider:</strong> {b.providerName || "Provider"}
                        </span>
                        <span>&bull;</span>
                        <span>
                          <strong>Amount:</strong>{" "}
                          {formatCurrency(Number(b.amount || 0), "USD")}
                        </span>
                        <span>&bull;</span>
                        <span>
                          <strong>Date:</strong> {b.date || "N/A"}
                        </span>
                      </div>
                    </div>

                    {b.resolution && (
                      <div className="text-right">
                        <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-lg">
                          Resolution: {b.resolution}
                        </span>
                      </div>
                    )}
                  </div>

                  {b.disputeReason && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-900">
                      <strong>Customer Claim:</strong> {b.disputeReason}
                    </div>
                  )}

                  {b.status === "disputed" && (
                    <div className="flex items-center gap-2 pt-2 border-t border-secondary-100 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs text-green-700 border-green-300 hover:bg-green-50"
                        isLoading={actionLoading === b.id + "_release"}
                        onClick={() => handleRelease(b)}
                      >
                        <DollarSign className="w-3.5 h-3.5 mr-1" /> Release to Provider
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs text-rose-700 border-rose-300 hover:bg-rose-50"
                        isLoading={actionLoading === b.id + "_refund"}
                        onClick={() => handleRefund(b)}
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refund Customer
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-amber-700 hover:bg-amber-50"
                        isLoading={actionLoading === b.id + "_warn"}
                        onClick={() => handleWarnBoth(b)}
                      >
                        <ShieldAlert className="w-3.5 h-3.5 mr-1" /> Send Warning Both
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
