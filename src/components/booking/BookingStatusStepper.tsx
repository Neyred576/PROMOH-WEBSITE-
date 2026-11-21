"use client";

import React from "react";
import { Check, Clock, Play, CheckCircle2, CreditCard, XCircle } from "lucide-react";

interface BookingStatusStepperProps {
  status: "pending" | "accepted" | "in_progress" | "completed" | "cancelled" | "rejected" | string;
  paymentStatus?: "unpaid" | "paid" | "pending" | string;
  className?: string;
  compact?: boolean;
}

const STEPS = [
  { key: "pending", label: "Requested", icon: Clock },
  { key: "accepted", label: "Accepted", icon: Check },
  { key: "in_progress", label: "In Progress", icon: Play },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
  { key: "paid", label: "Paid", icon: CreditCard },
];

export default function BookingStatusStepper({
  status,
  paymentStatus,
  className = "",
  compact = false,
}: BookingStatusStepperProps) {
  const isCancelled = status === "cancelled" || status === "rejected";

  if (isCancelled) {
    return (
      <div className={`flex items-center gap-2 p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium ${className}`}>
        <XCircle className="w-4 h-4 shrink-0 text-red-500" />
        <span>
          Booking {status === "rejected" ? "declined by provider" : "cancelled"}
        </span>
      </div>
    );
  }

  // Calculate current active step index (0-4)
  let activeIndex = 0;
  if (status === "accepted") activeIndex = 1;
  else if (status === "in_progress") activeIndex = 2;
  else if (status === "completed") {
    activeIndex = paymentStatus === "paid" ? 4 : 3;
  }

  return (
    <div className={`w-full py-2 ${className}`}>
      {/* Stepper nodes & connectors */}
      <div className="relative flex items-center justify-between">
        {/* Connecting Background Line */}
        <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-1 bg-secondary-200 rounded-full z-0" />

        {/* Connecting Active Progress Line */}
        <div
          className="absolute left-3 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-primary-500 to-indigo-600 rounded-full z-0 transition-all duration-500"
          style={{ width: `${(activeIndex / (STEPS.length - 1)) * 95}%` }}
        />

        {STEPS.map((step, idx) => {
          const isDone = idx < activeIndex;
          const isCurrent = idx === activeIndex;
          const StepIcon = step.icon;

          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center group">
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  isDone
                    ? "bg-emerald-500 text-white shadow-xs scale-95"
                    : isCurrent
                    ? "bg-primary-600 text-white ring-4 ring-primary-100 shadow-md scale-110"
                    : "bg-white border-2 border-secondary-300 text-secondary-400"
                }`}
              >
                {isDone ? (
                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                ) : (
                  <StepIcon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isCurrent ? "animate-pulse" : ""}`} />
                )}
              </div>

              {!compact && (
                <span
                  className={`mt-1.5 text-[10px] sm:text-xs font-semibold whitespace-nowrap transition-colors ${
                    isCurrent
                      ? "text-primary-700 font-bold"
                      : isDone
                      ? "text-secondary-700"
                      : "text-secondary-400"
                  }`}
                >
                  {step.label}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Human friendly status hint */}
      {!compact && (
        <div className="mt-3 flex items-center justify-between text-[11px] text-secondary-500 bg-secondary-50/80 px-3 py-1.5 rounded-lg border border-secondary-100">
          <span>
            {status === "pending" && "Waiting for provider to accept this booking..."}
            {status === "accepted" && "Provider confirmed! Ready for service appointment."}
            {status === "in_progress" && "Work is underway."}
            {status === "completed" && paymentStatus !== "paid" && "Job finished! Ready for client review and payment."}
            {status === "completed" && paymentStatus === "paid" && "Booking completed and fully paid. Thank you!"}
          </span>
          <span className="text-[10px] uppercase font-bold text-primary-600 tracking-wider ml-2 shrink-0">
            Live Status
          </span>
        </div>
      )}
    </div>
  );
}
