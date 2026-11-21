"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { db } from "@/lib/firebase/client";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import Navbar from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  CreditCard,
  DollarSign,
  Receipt,
  Download,
  Printer,
  Calendar,
  CheckCircle,
  Search,
  ArrowLeft,
  FileText,
  ShieldCheck,
  ExternalLink,
  Sparkles,
  X
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency } from "@/lib/currencies";

interface PaymentRecord {
  id: string;
  bookingId: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  providerId: string;
  providerName?: string;
  service: string;
  amount: number;
  currency?: string;
  paymentStatus: string;
  paidAt?: string;
  createdAt?: string;
  date?: string;
  time?: string;
  promoCode?: string;
  discountAmount?: number;
}

export default function PaymentsHistoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [fetching, setFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeReceipt, setActiveReceipt] = useState<PaymentRecord | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user?.uid) return;

    // If provider: get bookings where providerId == user.uid && paymentStatus == "paid"
    // If customer: get bookings where customerId == user.uid && paymentStatus == "paid"
    const isProvider = user.role === "provider";
    const fieldToQuery = isProvider ? "providerId" : "customerId";

    const q = query(
      collection(db, "bookings"),
      where(fieldToQuery, "==", user.uid)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: PaymentRecord[] = [];
      snapshot.docs.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.paymentStatus === "paid" || d.paidAt || (d.status === "completed" && d.amount)) {
          list.push({
            id: docSnap.id,
            bookingId: docSnap.id,
            customerId: d.customerId,
            customerName: d.customerName || "Customer",
            customerEmail: d.customerEmail,
            providerId: d.providerId,
            providerName: d.providerName || "Service Provider",
            service: d.service || "Professional Service",
            amount: Number(d.amount || d.estimatedRate || 0),
            currency: d.currency || "USD",
            paymentStatus: d.paymentStatus || "paid",
            paidAt: d.paidAt || d.updatedAt || d.createdAt,
            createdAt: d.createdAt,
            date: d.date,
            time: d.time,
            promoCode: d.promoCode,
            discountAmount: d.discountAmount,
          });
        }
      });

      // Sort newest first
      list.sort((a, b) => {
        const tA = new Date(a.paidAt || a.createdAt || 0).getTime();
        const tB = new Date(b.paidAt || b.createdAt || 0).getTime();
        return tB - tA;
      });

      setRecords(list);
      setFetching(false);
    });

    return () => unsub();
  }, [user?.uid, user?.role]);

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase().trim();
    return records.filter(
      (r) =>
        r.service.toLowerCase().includes(q) ||
        r.providerName?.toLowerCase().includes(q) ||
        r.customerName?.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
    );
  }, [records, searchQuery]);

  const totalSpentOrEarned = useMemo(() => {
    return records.reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [records]);

  if (loading || fetching) {
    return (
      <div className="min-h-screen bg-secondary-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isProvider = user?.role === "provider";

  return (
    <div className="min-h-screen bg-secondary-50 pb-20">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Back navigation */}
        <Link
          href={isProvider ? "/provider/dashboard" : "/dashboard"}
          className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900 font-semibold mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        {/* Header summary cards */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-secondary-900 tracking-tight flex items-center gap-2.5">
              <Receipt className="w-8 h-8 text-primary-600" />
              {isProvider ? "Earnings & Payment History" : "Payment History & Invoices"}
            </h1>
            <p className="text-secondary-500 mt-1">
              {isProvider
                ? "Review client payments, settlements, and download official receipts."
                : "View all your past payments, download PDF receipts, and track your service spend."}
            </p>
          </div>

          <div className="bg-white border border-secondary-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs uppercase font-bold text-secondary-400 tracking-wider">
                {isProvider ? "Total Received" : "Total Spent"}
              </p>
              <p className="text-2xl font-black text-secondary-900">
                {formatCurrency(totalSpentOrEarned, "USD")}
              </p>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="bg-white rounded-2xl border border-secondary-200 p-4 mb-6 shadow-sm flex items-center gap-3">
          <Search className="w-5 h-5 text-secondary-400 shrink-0" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isProvider
                ? "Search by service, client name or booking ID..."
                : "Search by service, provider name or booking ID..."
            }
            className="border-0 shadow-none focus-visible:ring-0 p-0 text-base"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-xs font-semibold text-secondary-400 hover:text-secondary-600 px-2 py-1"
            >
              Clear
            </button>
          )}
        </div>

        {/* Payments List */}
        {filteredRecords.length === 0 ? (
          <Card className="text-center py-16 border-dashed border-2">
            <CardContent>
              <div className="w-16 h-16 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-4 text-secondary-400">
                <Receipt className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-secondary-800">No payment records found</h3>
              <p className="text-secondary-500 text-sm mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? "No payments match your search query."
                  : isProvider
                  ? "You haven't received any completed payments yet."
                  : "You haven't completed any paid bookings yet."}
              </p>
              {!isProvider && !searchQuery && (
                <Link href="/search" className="inline-block mt-4">
                  <Button>Find a Service</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredRecords.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-secondary-200/90 hover:border-primary-300 p-5 shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-secondary-900 text-base">
                        {item.service}
                      </h3>
                      <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-semibold">
                        Paid
                      </span>
                      {item.promoCode && (
                        <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-indigo-500" />
                          {item.promoCode}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-secondary-500 mt-0.5">
                      {isProvider ? (
                        <>Client: <strong className="text-secondary-700">{item.customerName}</strong></>
                      ) : (
                        <>Provider: <strong className="text-secondary-700">{item.providerName}</strong></>
                      )}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-secondary-400 mt-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(item.paidAt || "").toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span className="font-mono">Ref: #{item.id.slice(0, 8)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-5 pt-3 md:pt-0 border-t md:border-t-0 border-secondary-100">
                  <div className="text-right">
                    <p className="text-xl font-black text-secondary-900">
                      {formatCurrency(item.amount, item.currency || "USD")}
                    </p>
                    <p className="text-xs text-emerald-600 font-semibold">Confirmed & Settled</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveReceipt(item)}
                    className="gap-1.5 text-xs font-semibold shrink-0"
                  >
                    <FileText className="w-4 h-4 text-primary-600" />
                    Receipt
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Official Receipt Modal */}
      <AnimatePresence>
        {activeReceipt && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setActiveReceipt(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative border border-secondary-100 my-8"
            >
              {/* Close button */}
              <button
                onClick={() => setActiveReceipt(null)}
                className="absolute top-5 right-5 text-secondary-400 hover:text-secondary-700 p-2 rounded-full hover:bg-secondary-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Receipt Header */}
              <div className="flex items-center justify-between border-b pb-6 mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-primary-600 tracking-tight">Promoh</span>
                    <span className="text-xs uppercase bg-primary-100 text-primary-800 font-bold px-2 py-0.5 rounded">
                      Official Receipt
                    </span>
                  </div>
                  <p className="text-xs text-secondary-400 mt-1 font-mono">
                    Receipt ID: #{activeReceipt.id.toUpperCase()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-secondary-400">Date Paid</p>
                  <p className="text-sm font-semibold text-secondary-800">
                    {new Date(activeReceipt.paidAt || "").toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {/* Party Information */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-secondary-50 rounded-2xl mb-6 text-xs">
                <div>
                  <p className="text-secondary-400 font-bold uppercase tracking-wider mb-1">Billed To</p>
                  <p className="font-bold text-secondary-900 text-sm">{activeReceipt.customerName}</p>
                  {activeReceipt.customerEmail && (
                    <p className="text-secondary-500 truncate">{activeReceipt.customerEmail}</p>
                  )}
                </div>
                <div>
                  <p className="text-secondary-400 font-bold uppercase tracking-wider mb-1">Service Provider</p>
                  <p className="font-bold text-secondary-900 text-sm">{activeReceipt.providerName}</p>
                  <p className="text-secondary-500">Verified Marketplace Partner</p>
                </div>
              </div>

              {/* Item Details */}
              <div className="border-t border-b py-4 mb-6 space-y-3">
                <div className="flex justify-between items-center text-sm font-bold text-secondary-900">
                  <span>{activeReceipt.service}</span>
                  <span>{formatCurrency(activeReceipt.amount + (activeReceipt.discountAmount || 0), activeReceipt.currency || "USD")}</span>
                </div>
                {activeReceipt.date && (
                  <p className="text-xs text-secondary-500">
                    Scheduled date: {activeReceipt.date} {activeReceipt.time ? `at ${activeReceipt.time}` : ""}
                  </p>
                )}

                {activeReceipt.discountAmount && activeReceipt.discountAmount > 0 ? (
                  <div className="flex justify-between items-center text-xs text-emerald-600 font-semibold pt-1 border-t border-dashed">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Promo Code Discount ({activeReceipt.promoCode})
                    </span>
                    <span>-{formatCurrency(activeReceipt.discountAmount, activeReceipt.currency || "USD")}</span>
                  </div>
                ) : null}
              </div>

              {/* Total Summary */}
              <div className="flex justify-between items-baseline mb-8">
                <div>
                  <p className="text-xs text-secondary-400 uppercase font-bold tracking-wider">Total Paid</p>
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold mt-0.5">
                    <CheckCircle className="w-3.5 h-3.5" /> Settled via Promoh Secure
                  </span>
                </div>
                <p className="text-3xl font-black text-secondary-900">
                  {formatCurrency(activeReceipt.amount, activeReceipt.currency || "USD")}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => window.print()}
                >
                  <Printer className="w-4 h-4" />
                  Print Receipt
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => setActiveReceipt(null)}
                >
                  Done
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
