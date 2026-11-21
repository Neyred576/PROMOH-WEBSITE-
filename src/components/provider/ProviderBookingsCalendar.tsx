"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  User,
  MapPin,
  MessageSquare,
  DollarSign,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/currencies";
import { motion, AnimatePresence } from "framer-motion";

interface Booking {
  id: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  service: string;
  date: string;
  time: string;
  status: "pending" | "accepted" | "in_progress" | "completed" | "rejected" | "cancelled";
  address?: string;
  amount?: number;
  estimatedRate?: string;
  currency?: string;
  paymentStatus?: string;
  notes?: string;
}

interface ProviderBookingsCalendarProps {
  bookings: Booking[];
  currency?: string;
  onSelectBooking?: (booking: Booking) => void;
}

export default function ProviderBookingsCalendar({
  bookings,
  currency = "USD",
  onSelectBooking,
}: ProviderBookingsCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDayString, setSelectedDayString] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString("default", { month: "long" });

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDayString(today.toISOString().split("T")[0]);
  };

  // Group bookings by date string YYYY-MM-DD
  const bookingsByDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    bookings.forEach((b) => {
      if (!b.date) return;
      const list = map.get(b.date) || [];
      list.push(b);
      map.set(b.date, list);
    });
    return map;
  }, [bookings]);

  // Calendar matrix calculation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: {
      day: number;
      dateString: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      bookings: Booking[];
    }[] = [];

    const todayString = new Date().toISOString().split("T")[0];

    // Leading days from prev month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = month === 0 ? 12 : month;
      const y = month === 0 ? year - 1 : year;
      const dateString = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({
        day: d,
        dateString,
        isCurrentMonth: false,
        isToday: dateString === todayString,
        bookings: bookingsByDate.get(dateString) || [],
      });
    }

    // Days in current month
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({
        day: d,
        dateString,
        isCurrentMonth: true,
        isToday: dateString === todayString,
        bookings: bookingsByDate.get(dateString) || [],
      });
    }

    // Trailing days to round up to 35 or 42 cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 1 : month + 2;
      const y = month === 11 ? year + 1 : year;
      const dateString = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({
        day: d,
        dateString,
        isCurrentMonth: false,
        isToday: dateString === todayString,
        bookings: bookingsByDate.get(dateString) || [],
      });
    }

    return days;
  }, [year, month, bookingsByDate]);

  const selectedDayBookings = useMemo(() => {
    return bookingsByDate.get(selectedDayString) || [];
  }, [selectedDayString, bookingsByDate]);

  const statusBadge = (status: Booking["status"]) => {
    switch (status) {
      case "pending":
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Pending</span>;
      case "accepted":
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Accepted</span>;
      case "in_progress":
        return <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">In Progress</span>;
      case "completed":
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Completed</span>;
      default:
        return <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border border-secondary-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-white border-b border-secondary-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary-600" />
              Bookings & Service Schedule
            </CardTitle>
            <CardDescription>
              View all your client bookings placed on the calendar and manage daily schedules.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={prevMonth} className="h-9 w-9 p-0">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-extrabold text-secondary-900 text-sm px-3 min-w-[140px] text-center">
              {monthName} {year}
            </span>
            <Button variant="outline" size="sm" onClick={nextMonth} className="h-9 w-9 p-0">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToToday} className="text-xs font-bold text-primary-600">
              Today
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 bg-secondary-50/50">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-xs font-bold text-secondary-400 uppercase tracking-wider">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {calendarDays.map((cell, idx) => {
              const isSelected = cell.dateString === selectedDayString;
              const hasBookings = cell.bookings.length > 0;
              const pendingBookings = cell.bookings.filter((b) => b.status === "pending").length;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedDayString(cell.dateString)}
                  className={`min-h-[70px] sm:min-h-[90px] p-1.5 sm:p-2 rounded-2xl text-left transition-all relative flex flex-col justify-between border ${
                    isSelected
                      ? "bg-white border-primary-500 shadow-md ring-2 ring-primary-500/20"
                      : cell.isCurrentMonth
                      ? "bg-white border-secondary-200/80 hover:border-primary-300"
                      : "bg-secondary-100/40 border-transparent text-secondary-300 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs sm:text-sm font-bold ${
                        cell.isToday
                          ? "w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center -m-1"
                          : isSelected
                          ? "text-primary-700"
                          : cell.isCurrentMonth
                          ? "text-secondary-800"
                          : "text-secondary-400"
                      }`}
                    >
                      {cell.day}
                    </span>
                    {hasBookings && (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-secondary-100 text-secondary-700">
                        {cell.bookings.length}
                      </span>
                    )}
                  </div>

                  {/* Booking Badges */}
                  <div className="space-y-1 mt-1 w-full overflow-hidden">
                    {cell.bookings.slice(0, 2).map((b) => (
                      <div
                        key={b.id}
                        className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md truncate ${
                          b.status === "pending"
                            ? "bg-amber-100 text-amber-900 border border-amber-200"
                            : b.status === "completed"
                            ? "bg-emerald-100 text-emerald-900 border border-emerald-200"
                            : "bg-blue-100 text-blue-900 border border-blue-200"
                        }`}
                      >
                        {b.time} {b.service}
                      </div>
                    ))}
                    {cell.bookings.length > 2 && (
                      <span className="text-[9px] text-secondary-500 font-semibold block text-center">
                        +{cell.bookings.length - 2} more
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Day Agenda View */}
      <Card className="border border-secondary-200 shadow-sm">
        <CardHeader className="bg-white border-b border-secondary-100 pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary-600" />
              Schedule for {new Date(selectedDayString + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </CardTitle>
            <CardDescription className="text-xs">
              {selectedDayBookings.length === 0
                ? "No bookings scheduled on this day."
                : `${selectedDayBookings.length} booking${selectedDayBookings.length > 1 ? "s" : ""} scheduled.`}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          {selectedDayBookings.length === 0 ? (
            <div className="text-center py-10 text-secondary-400">
              <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">Your schedule is free on this date.</p>
              <p className="text-xs text-secondary-400 mt-0.5">Any incoming requests for this date will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDayBookings.map((b) => (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl bg-white border border-secondary-200/90 hover:border-primary-300 transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-700 font-extrabold flex flex-col items-center justify-center shrink-0 border border-primary-100 text-xs">
                      <span>{b.time}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-bold text-secondary-900 text-sm">{b.service}</h4>
                        {statusBadge(b.status)}
                      </div>
                      <p className="text-xs text-secondary-500 flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-secondary-400" />
                          Client: <strong className="text-secondary-700">{b.customerName || "Customer"}</strong>
                        </span>
                        {b.address && (
                          <span className="flex items-center gap-1 truncate max-w-[200px]">
                            <MapPin className="w-3 h-3 text-secondary-400" />
                            {b.address}
                          </span>
                        )}
                      </p>
                      {b.notes && (
                        <p className="text-xs text-secondary-600 bg-secondary-50 rounded-lg p-2 mt-2 border border-secondary-100">
                          <strong>Note:</strong> {b.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <Link href={`/chat?user=${b.customerId}`}>
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                        <MessageSquare className="w-3.5 h-3.5 text-secondary-600" />
                        Chat
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
