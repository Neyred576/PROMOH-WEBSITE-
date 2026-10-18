"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/currencies";
import { CheckCircle2, DollarSign, X, FileText, PlusCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CompleteBookingModalProps {
  booking: any;
  currency: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (bookingId: string, amount: number, options: { notes: string; isCashPaid: boolean }) => Promise<void>;
}

export default function CompleteBookingModal({
  booking,
  currency,
  isOpen,
  onClose,
  onSuccess,
}: CompleteBookingModalProps) {
  const initialBase = Number(booking?.estimatedRate || 50);
  const [baseAmount, setBaseAmount] = useState<string>(initialBase ? String(initialBase) : "50");
  const [materialsAmount, setMaterialsAmount] = useState<string>("0");
  const [notes, setNotes] = useState<string>("");
  const [isCashPaid, setIsCashPaid] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  if (!isOpen || !booking) return null;

  const numBase = parseFloat(baseAmount) || 0;
  const numMaterials = parseFloat(materialsAmount) || 0;
  const total = Math.max(0, numBase + numMaterials);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (total <= 0) {
      setError("Total charge amount must be greater than 0");
      return;
    }
    setError("");
    setLoading(true);

    try {
      await onSuccess(booking.id, total, { notes, isCashPaid });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to finalize booking");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-lg"
        >
          <Card className="border-secondary-100 shadow-2xl overflow-hidden bg-white">
            <CardHeader className="bg-gradient-to-r from-primary-600 to-indigo-600 text-white relative p-6">
              <button
                type="button"
                onClick={onClose}
                className="absolute top-5 right-5 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl text-white">Complete Service & Bill</CardTitle>
                  <CardDescription className="text-primary-100 text-xs mt-0.5">
                    Finalize charges for {booking.customerName}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              {/* Booking Context Pill */}
              <div className="bg-secondary-50 p-3.5 rounded-xl border border-secondary-200 mb-5 flex items-center justify-between text-xs text-secondary-600">
                <div>
                  <span className="font-semibold text-secondary-900 block">{booking.service}</span>
                  <span>{new Date(booking.date + "T12:00:00").toLocaleDateString()} at {booking.time}</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] uppercase tracking-wider text-secondary-400 block">Customer</span>
                  <span className="font-medium text-secondary-800">{booking.customerName}</span>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-secondary-700 uppercase tracking-wider mb-1.5">
                      Base / Labor Charge
                    </label>
                    <div className="relative">
                      <DollarSign className="w-4 h-4 text-secondary-400 absolute left-3 top-3.5" />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={baseAmount}
                        onChange={(e) => setBaseAmount(e.target.value)}
                        className="pl-8"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-secondary-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <PlusCircle className="w-3.5 h-3.5 text-secondary-400" /> Extra Parts / Materials
                    </label>
                    <div className="relative">
                      <DollarSign className="w-4 h-4 text-secondary-400 absolute left-3 top-3.5" />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={materialsAmount}
                        onChange={(e) => setMaterialsAmount(e.target.value)}
                        className="pl-8"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Total Preview */}
                <div className="p-4 bg-primary-50/70 border border-primary-200 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-primary-800 uppercase tracking-wider">Total Final Amount</p>
                    <p className="text-xs text-primary-600">Will be billed to the customer</p>
                  </div>
                  <div className="text-2xl font-black text-primary-700">
                    {formatCurrency(total, currency)}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-secondary-400" /> Completion Notes / Receipt Summary
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Fixed leak under sink, replaced 2 washers. Tested and guaranteed."
                    className="w-full rounded-xl border border-secondary-300 p-3 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isCashPaid"
                    checked={isCashPaid}
                    onChange={(e) => setIsCashPaid(e.target.checked)}
                    className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-secondary-300"
                  />
                  <label htmlFor="isCashPaid" className="text-xs text-secondary-600 cursor-pointer select-none">
                    Customer already paid via cash or direct settlement (mark as Paid)
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-secondary-100">
                  <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" isLoading={loading} className="bg-primary-600 hover:bg-primary-700 text-white">
                    Confirm & Complete
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
