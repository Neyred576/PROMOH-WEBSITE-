"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { XCircle, X, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface RejectBookingModalProps {
  booking: any;
  isOpen: boolean;
  onClose: () => void;
  onReject: (bookingId: string, reason: string, note: string) => Promise<void>;
}

const REASONS = [
  "Schedule conflict / Time slot unavailable",
  "Outside my service coverage area",
  "Service request is outside my scope of work",
  "Fully booked on this date",
  "Emergency or personal time off",
  "Other reason",
];

export default function RejectBookingModal({
  booking,
  isOpen,
  onClose,
  onReject,
}: RejectBookingModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>(REASONS[0]);
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  if (!isOpen || !booking) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await onReject(booking.id, selectedReason, note);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to decline booking");
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
          className="w-full max-w-md"
        >
          <Card className="border-secondary-100 shadow-2xl overflow-hidden bg-white">
            <CardHeader className="bg-rose-50 border-b border-rose-100 relative p-6">
              <button
                type="button"
                onClick={onClose}
                className="absolute top-5 right-5 text-secondary-400 hover:text-secondary-600 p-1 rounded-full hover:bg-white/80 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-lg text-rose-950">Decline Request</CardTitle>
                  <CardDescription className="text-rose-700 text-xs mt-0.5">
                    Decline booking for {booking.customerName}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              <div className="flex items-start gap-2.5 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 mb-4">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  The customer will be notified with your reason so they can choose a different time slot or another provider.
                </span>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary-700 uppercase tracking-wider mb-2">
                    Select Reason
                  </label>
                  <div className="space-y-2">
                    {REASONS.map((r) => (
                      <label
                        key={r}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          selectedReason === r
                            ? "border-rose-300 bg-rose-50/60 text-rose-900 font-medium"
                            : "border-secondary-200 hover:bg-secondary-50 text-secondary-700"
                        }`}
                      >
                        <input
                          type="radio"
                          name="rejectReason"
                          value={r}
                          checked={selectedReason === r}
                          onChange={() => setSelectedReason(r)}
                          className="text-rose-600 focus:ring-rose-500"
                        />
                        <span>{r}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary-700 uppercase tracking-wider mb-1.5">
                    Optional Note to Customer
                  </label>
                  <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. I am booked up this morning, but I would love to assist you after 3 PM if you can rebook."
                    className="w-full rounded-xl border border-secondary-300 p-3 text-xs text-secondary-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-secondary-100">
                  <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>
                    Keep Request
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    isLoading={loading}
                    className="bg-rose-600 hover:bg-rose-700 text-white"
                  >
                    Confirm Decline
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
