"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  X,
  Users,
  Briefcase,
  Calendar,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { formatCurrency } from "@/lib/currencies";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  allCustomers: any[];
  allProviders: any[];
  allBookings: any[];
  onNavigate: (tab: string, filter?: string, item?: any) => void;
}

export default function AdminCommandPalette({
  isOpen,
  onClose,
  allCustomers,
  allProviders,
  allBookings,
  onNavigate,
}: Props) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        // Toggle palette
        if (isOpen) onClose();
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();

  // Search results
  const customerMatches = q
    ? allCustomers
        .filter(
          (c) =>
            `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase().includes(q) ||
            c.email?.toLowerCase().includes(q) ||
            c.phone?.includes(q) ||
            c.id?.toLowerCase().includes(q)
        )
        .slice(0, 4)
    : [];

  const providerMatches = q
    ? allProviders
        .filter(
          (p) =>
            p.businessName?.toLowerCase().includes(q) ||
            `${p.firstName || ""} ${p.lastName || ""}`.toLowerCase().includes(q) ||
            p.email?.toLowerCase().includes(q) ||
            p.servicesOffered?.toLowerCase().includes(q) ||
            p.id?.toLowerCase().includes(q)
        )
        .slice(0, 4)
    : [];

  const bookingMatches = q
    ? allBookings
        .filter(
          (b) =>
            b.service?.toLowerCase().includes(q) ||
            b.customerName?.toLowerCase().includes(q) ||
            b.providerName?.toLowerCase().includes(q) ||
            b.id?.toLowerCase().includes(q)
        )
        .slice(0, 4)
    : [];

  const totalMatches = customerMatches.length + providerMatches.length + bookingMatches.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 px-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-secondary-200 overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-secondary-200 flex items-center gap-3 bg-secondary-50/50">
          <Search className="w-5 h-5 text-primary-600 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Universal search: customer name, provider, booking ID, email..."
            className="flex-1 bg-transparent text-sm text-secondary-900 placeholder:text-secondary-400 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="text-secondary-400 hover:text-secondary-700 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="p-4 overflow-y-auto space-y-4">
          {!q ? (
            <div className="text-center py-10 text-xs text-secondary-400 space-y-1">
              <p className="font-semibold text-secondary-700">Universal Platform Search</p>
              <p>Type any keyword to query customers, providers, or booking IDs simultaneously.</p>
              <div className="flex items-center justify-center gap-2 pt-2 text-[11px] text-secondary-400">
                <span className="px-2 py-0.5 rounded bg-secondary-100 font-mono">ESC</span> to close
              </div>
            </div>
          ) : totalMatches === 0 ? (
            <div className="text-center py-10 text-xs text-secondary-400">
              No records found matching "{query}".
            </div>
          ) : (
            <>
              {/* Customer Results */}
              {customerMatches.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-secondary-400 flex items-center gap-1.5 px-2">
                    <Users className="w-3.5 h-3.5 text-blue-600" /> Customers ({customerMatches.length})
                  </div>
                  {customerMatches.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        onNavigate("customers", "all", c);
                        onClose();
                      }}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-secondary-50 transition-colors flex items-center justify-between text-xs group"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-bold text-secondary-900 block truncate">
                          {c.firstName} {c.lastName}
                        </span>
                        <span className="text-[11px] text-secondary-400 truncate block">
                          {c.email} &bull; {c.phone || "No phone"}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-secondary-300 group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* Provider Results */}
              {providerMatches.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-secondary-400 flex items-center gap-1.5 px-2">
                    <Briefcase className="w-3.5 h-3.5 text-indigo-600" /> Providers ({providerMatches.length})
                  </div>
                  {providerMatches.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        onNavigate("providers", "all", p);
                        onClose();
                      }}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-secondary-50 transition-colors flex items-center justify-between text-xs group"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-bold text-secondary-900 block truncate">
                          {p.businessName || `${p.firstName} ${p.lastName}`}
                        </span>
                        <span className="text-[11px] text-secondary-400 truncate block">
                          {p.servicesOffered || "Services"} &bull; {p.email} &bull; Status: {p.status}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-secondary-300 group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* Booking Results */}
              {bookingMatches.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-secondary-400 flex items-center gap-1.5 px-2">
                    <Calendar className="w-3.5 h-3.5 text-green-600" /> Bookings ({bookingMatches.length})
                  </div>
                  {bookingMatches.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => {
                        onNavigate("bookings", "all", b);
                        onClose();
                      }}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-secondary-50 transition-colors flex items-center justify-between text-xs group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-secondary-900 truncate">
                            {b.service || "Booking"}
                          </span>
                          <span className="text-[10px] font-mono text-secondary-400">
                            #{b.id.slice(0, 8)}
                          </span>
                          <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.2 rounded-full">
                            {formatCurrency(Number(b.amount || 0), "USD")}
                          </span>
                        </div>
                        <span className="text-[11px] text-secondary-400 truncate block">
                          {b.customerName} &rarr; {b.providerName} &bull; {b.status}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-secondary-300 group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
