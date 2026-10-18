"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/currencies";
import {
  CreditCard,
  Building2,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  X,
  ExternalLink,
} from "lucide-react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { motion, AnimatePresence } from "framer-motion";

interface PayoutsCardProps {
  providerId: string;
  providerData: any;
  bookings: any[];
  currency: string;
}

export default function PayoutsCard({
  providerId,
  providerData,
  bookings,
  currency,
}: PayoutsCardProps) {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState<string>("");
  const [payoutType, setPayoutType] = useState<"standard" | "instant">("standard");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // Calculate balances
  const paidCompletedTotal = bookings.reduce((sum, b) => {
    if (b.status === "completed" && b.paymentStatus === "paid") {
      return sum + Number(b.amount || 0);
    }
    return sum;
  }, 0);

  const pendingCustomerPaymentTotal = bookings.reduce((sum, b) => {
    if (b.status === "completed" && b.paymentStatus !== "paid") {
      return sum + Number(b.amount || 0);
    }
    return sum;
  }, 0);

  const totalWithdrawn = Number(providerData?.withdrawnAmount || 0);
  const availableBalance = Math.max(0, paidCompletedTotal - totalWithdrawn);

  // Listen to provider's past payouts
  useEffect(() => {
    if (!providerId) return;

    const q = query(collection(db, "payouts"), where("providerId", "==", providerId));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
        list.sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        setPayouts(list);
      },
      (err) => console.error("Error fetching payouts", err)
    );

    return () => unsub();
  }, [providerId]);

  const handleOpenModal = () => {
    setPayoutAmount(availableBalance.toFixed(2));
    setStatusMessage("");
    setIsModalOpen(true);
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(payoutAmount);
    if (!amountNum || amountNum <= 0) {
      setStatusMessage("Please enter a valid payout amount.");
      return;
    }
    if (amountNum > availableBalance) {
      setStatusMessage("Requested payout amount exceeds your available balance.");
      return;
    }

    setLoading(true);
    setStatusMessage("");

    try {
      // 1. Record payout
      await addDoc(collection(db, "payouts"), {
        providerId,
        amount: amountNum,
        currency,
        type: payoutType,
        destination: "Bank Account (•••• 4242)",
        status: payoutType === "instant" ? "completed" : "processing",
        estimatedArrival:
          payoutType === "instant"
            ? "Arrives in ~30 minutes"
            : "1-2 business days (ACH Direct Deposit)",
        createdAt: new Date().toISOString(),
      });

      // 2. Increment withdrawnAmount on provider
      await updateDoc(doc(db, "providers", providerId), {
        withdrawnAmount: increment(amountNum),
        lastPayoutDate: new Date().toISOString(),
      });

      setIsModalOpen(false);
      alert(
        `Payout of ${formatCurrency(
          amountNum,
          currency
        )} requested successfully! Funds are on the way to your linked bank account.`
      );
    } catch (err: any) {
      console.error("Payout error", err);
      setStatusMessage(err?.message || "Failed to initiate payout.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-secondary-200/80 shadow-sm overflow-hidden mb-8">
      <CardHeader className="border-b border-secondary-100 bg-secondary-50/50 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              Stripe Connect & Payouts Center
            </CardTitle>
            <CardDescription className="text-xs">
              Manage your earnings, direct deposits, and Stripe payout schedule
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Stripe Express Connected
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Balances Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-400/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Available to Payout
              </span>
              <Building2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-extrabold text-emerald-950">
              {formatCurrency(availableBalance, currency)}
            </div>
            <p className="text-xs text-emerald-700 mt-1">Cleared from customer payments</p>
          </div>

          <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200/80 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Awaiting Checkout
              </span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-3xl font-extrabold text-amber-950">
              {formatCurrency(pendingCustomerPaymentTotal, currency)}
            </div>
            <p className="text-xs text-amber-700 mt-1">Completed jobs pending client payment</p>
          </div>

          <div className="p-4 bg-secondary-50 rounded-2xl border border-secondary-200 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-secondary-600">
                Lifetime Paid Out
              </span>
              <ArrowUpRight className="w-4 h-4 text-secondary-500" />
            </div>
            <div className="text-3xl font-extrabold text-secondary-900">
              {formatCurrency(totalWithdrawn, currency)}
            </div>
            <p className="text-xs text-secondary-500 mt-1">
              Transferred to bank
            </p>
          </div>
        </div>

        {/* Bank & Action Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-secondary-50/70 rounded-2xl border border-secondary-200 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-secondary-200 flex items-center justify-center text-secondary-800 font-bold shrink-0">
              <Building2 className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-secondary-900">
                {providerData?.bankName || "Chase Checking Account"} (•••• 4242)
              </p>
              <p className="text-xs text-secondary-500">
                Automatic rolling transfers enabled via Stripe Connect
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                alert(
                  "Redirecting to Stripe Express Dashboard where you can update tax info, identity docs, or bank details."
                )
              }
              className="text-xs h-9 border-secondary-300"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Stripe Portal
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleOpenModal}
              disabled={availableBalance <= 0}
              className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              <ArrowUpRight className="w-4 h-4 mr-1.5" />
              Request Payout
            </Button>
          </div>
        </div>

        {/* Recent Payouts Table */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-secondary-600 mb-3">
            Payout Activity ({payouts.length})
          </h4>
          {payouts.length === 0 ? (
            <div className="p-6 text-center text-xs text-secondary-400 bg-secondary-50/40 rounded-xl border border-dashed border-secondary-200">
              No payouts requested yet. Once you complete jobs and receive customer payments, you can transfer your funds here.
            </div>
          ) : (
            <div className="divide-y divide-secondary-100 border border-secondary-200 rounded-xl overflow-hidden text-xs">
              {payouts.slice(0, 5).map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 flex items-center justify-between hover:bg-secondary-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        p.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {p.status === "completed" ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-secondary-900">
                        {p.destination || "Direct Deposit"}
                      </p>
                      <p className="text-[11px] text-secondary-500">
                        {new Date(p.createdAt || 0).toLocaleDateString()} &middot;{" "}
                        {p.estimatedArrival || "Processing"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-secondary-900">
                      {formatCurrency(Number(p.amount || 0), p.currency || currency)}
                    </p>
                    <span
                      className={`inline-block text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        p.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      {/* Payout Request Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md"
            >
              <Card className="border-secondary-100 shadow-2xl bg-white overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white relative p-6">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="absolute top-5 right-5 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <CardTitle className="text-lg text-white">Transfer Funds to Bank</CardTitle>
                  <CardDescription className="text-emerald-100 text-xs mt-0.5">
                    Available balance: {formatCurrency(availableBalance, currency)}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-6">
                  {statusMessage && (
                    <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {statusMessage}
                    </div>
                  )}

                  <form onSubmit={handleRequestPayout} className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-secondary-700 uppercase tracking-wider">
                          Payout Amount
                        </label>
                        <button
                          type="button"
                          onClick={() => setPayoutAmount(availableBalance.toFixed(2))}
                          className="text-xs text-emerald-600 hover:underline font-bold"
                        >
                          Transfer Max
                        </button>
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        min="1"
                        max={availableBalance}
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
                        placeholder="0.00"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-secondary-700 uppercase tracking-wider mb-2">
                        Transfer Speed
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                            payoutType === "standard"
                              ? "border-emerald-500 bg-emerald-50/50 text-emerald-950 font-semibold ring-1 ring-emerald-500"
                              : "border-secondary-200 hover:bg-secondary-50 text-secondary-700"
                          }`}
                        >
                          <input
                            type="radio"
                            name="speed"
                            checked={payoutType === "standard"}
                            onChange={() => setPayoutType("standard")}
                            className="hidden"
                          />
                          <p className="font-bold">Standard (Free)</p>
                          <p className="text-[11px] text-secondary-500 mt-0.5">
                            1-2 business days
                          </p>
                        </label>

                        <label
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                            payoutType === "instant"
                              ? "border-emerald-500 bg-emerald-50/50 text-emerald-950 font-semibold ring-1 ring-emerald-500"
                              : "border-secondary-200 hover:bg-secondary-50 text-secondary-700"
                          }`}
                        >
                          <input
                            type="radio"
                            name="speed"
                            checked={payoutType === "instant"}
                            onChange={() => setPayoutType("instant")}
                            className="hidden"
                          />
                          <p className="font-bold">Instant (1.5%)</p>
                          <p className="text-[11px] text-secondary-500 mt-0.5">
                            Arrives in minutes
                          </p>
                        </label>
                      </div>
                    </div>

                    <div className="p-3 bg-secondary-50 rounded-xl border border-secondary-200 text-xs text-secondary-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Destination</span>
                        <span className="font-semibold text-secondary-800">
                          Chase Bank (•••• 4242)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Transfer Fee</span>
                        <span className="font-semibold text-secondary-800">
                          {payoutType === "standard"
                            ? "$0.00"
                            : formatCurrency(
                                (parseFloat(payoutAmount) || 0) * 0.015,
                                currency
                              )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-secondary-100">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsModalOpen(false)}
                        disabled={loading}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        isLoading={loading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                      >
                        Confirm Transfer
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Card>
  );
}
