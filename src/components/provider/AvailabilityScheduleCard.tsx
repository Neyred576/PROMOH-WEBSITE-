"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Clock, Calendar, Check, Power, AlertCircle } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

interface AvailabilityScheduleCardProps {
  providerId: string;
  initialAvailability?: {
    isAcceptingBookings?: boolean;
    workingDays?: string[];
    startTime?: string;
    endTime?: string;
    allowSameDay?: boolean;
  };
  bookings: any[];
}

const ALL_DAYS = [
  { key: "Mon", label: "Mon" },
  { key: "Tue", label: "Tue" },
  { key: "Wed", label: "Wed" },
  { key: "Thu", label: "Thu" },
  { key: "Fri", label: "Fri" },
  { key: "Sat", label: "Sat" },
  { key: "Sun", label: "Sun" },
];

export default function AvailabilityScheduleCard({
  providerId,
  initialAvailability,
  bookings,
}: AvailabilityScheduleCardProps) {
  const [isAccepting, setIsAccepting] = useState<boolean>(
    initialAvailability?.isAcceptingBookings !== false
  );
  const [workingDays, setWorkingDays] = useState<string[]>(
    initialAvailability?.workingDays || ["Mon", "Tue", "Wed", "Thu", "Fri"]
  );
  const [startTime, setStartTime] = useState<string>(
    initialAvailability?.startTime || "08:00"
  );
  const [endTime, setEndTime] = useState<string>(
    initialAvailability?.endTime || "18:00"
  );
  const [allowSameDay, setAllowSameDay] = useState<boolean>(
    initialAvailability?.allowSameDay || false
  );
  const [saving, setSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  useEffect(() => {
    if (initialAvailability) {
      if (initialAvailability.isAcceptingBookings !== undefined) {
        setIsAccepting(initialAvailability.isAcceptingBookings);
      }
      if (initialAvailability.workingDays) {
        setWorkingDays(initialAvailability.workingDays);
      }
      if (initialAvailability.startTime) {
        setStartTime(initialAvailability.startTime);
      }
      if (initialAvailability.endTime) {
        setEndTime(initialAvailability.endTime);
      }
      if (initialAvailability.allowSameDay !== undefined) {
        setAllowSameDay(initialAvailability.allowSameDay);
      }
    }
  }, [initialAvailability]);

  const toggleDay = (dayKey: string) => {
    setWorkingDays((prev) =>
      prev.includes(dayKey) ? prev.filter((d) => d !== dayKey) : [...prev, dayKey]
    );
  };

  const handleSave = async () => {
    if (!providerId) return;
    setSaving(true);
    setStatusMessage("");

    try {
      await updateDoc(doc(db, "providers", providerId), {
        availability: {
          isAcceptingBookings: isAccepting,
          workingDays,
          startTime,
          endTime,
          allowSameDay,
          updatedAt: new Date().toISOString(),
        },
      });
      setStatusMessage("Schedule updated successfully!");
      setTimeout(() => setStatusMessage(""), 4000);
    } catch (err: any) {
      console.error("Error saving availability", err);
      setStatusMessage("Failed to update schedule. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Build upcoming 7 days forecast
  const next7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
    const isWorking = workingDays.includes(dayName);

    // Count bookings on this day
    const dayBookings = bookings.filter(
      (b) =>
        b.date === dateStr &&
        (b.status === "pending" || b.status === "accepted" || b.status === "in_progress")
    );

    return {
      date: d,
      dateStr,
      dayName,
      dayNum: d.getDate(),
      isWorking,
      bookingsCount: dayBookings.length,
      isToday: i === 0,
    };
  });

  return (
    <Card className="border-secondary-200/80 shadow-sm overflow-hidden mb-8">
      <CardHeader className="border-b border-secondary-100 bg-secondary-50/50 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              Working Hours & Availability Schedule
            </CardTitle>
            <CardDescription className="text-xs">
              Configure your weekly active hours and view upcoming bookings
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAccepting(!isAccepting)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                isAccepting
                  ? "bg-green-100 text-green-800 border border-green-200"
                  : "bg-secondary-200 text-secondary-700 border border-secondary-300"
              }`}
            >
              <Power className={`w-3.5 h-3.5 ${isAccepting ? "text-green-600" : "text-secondary-500"}`} />
              {isAccepting ? "Accepting Bookings" : "Paused / Away"}
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Next 7 Days Mini Strip */}
        <div>
          <label className="block text-xs font-semibold text-secondary-700 uppercase tracking-wider mb-2.5">
            Upcoming 7 Days Schedule
          </label>
          <div className="grid grid-cols-7 gap-2">
            {next7Days.map((slot) => (
              <div
                key={slot.dateStr}
                className={`p-2.5 rounded-xl border text-center transition-all flex flex-col justify-between min-h-[82px] ${
                  slot.isToday
                    ? "border-primary-500 bg-primary-50/40 ring-1 ring-primary-400"
                    : slot.isWorking && isAccepting
                    ? "border-secondary-200 bg-white"
                    : "border-secondary-200/60 bg-secondary-50 opacity-60"
                }`}
              >
                <div>
                  <p className="text-[11px] font-semibold text-secondary-500 uppercase">
                    {slot.dayName}
                  </p>
                  <p className={`text-base font-bold ${slot.isToday ? "text-primary-700" : "text-secondary-900"}`}>
                    {slot.dayNum}
                  </p>
                </div>
                <div>
                  {slot.bookingsCount > 0 ? (
                    <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      {slot.bookingsCount} booked
                    </span>
                  ) : slot.isWorking && isAccepting ? (
                    <span className="text-[10px] text-green-700 font-medium">Free</span>
                  ) : (
                    <span className="text-[10px] text-secondary-400">Off</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Working Days Selector */}
        <div>
          <label className="block text-xs font-semibold text-secondary-700 uppercase tracking-wider mb-2.5">
            Active Working Days
          </label>
          <div className="flex flex-wrap gap-2">
            {ALL_DAYS.map((day) => {
              const active = workingDays.includes(day.key);
              return (
                <button
                  type="button"
                  key={day.key}
                  onClick={() => toggleDay(day.key)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                    active
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-white text-secondary-600 border-secondary-200 hover:border-secondary-300 hover:bg-secondary-50"
                  }`}
                >
                  {active && <Check className="w-3.5 h-3.5" />}
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Working Hours & Same Day notice */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-secondary-100">
          <div>
            <label className="block text-xs font-semibold text-secondary-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-secondary-400" /> Start Time
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-secondary-300 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-secondary-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-secondary-400" /> End Time
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-secondary-300 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-secondary-200 hover:bg-secondary-50 cursor-pointer transition-colors h-11">
              <input
                type="checkbox"
                checked={allowSameDay}
                onChange={(e) => setAllowSameDay(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-secondary-300"
              />
              <span className="text-xs font-medium text-secondary-700 select-none">
                Allow same-day urgent bookings
              </span>
            </label>
          </div>
        </div>

        {statusMessage && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              statusMessage.includes("Failed")
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-green-50 text-green-700 border border-green-200 font-medium"
            }`}
          >
            {statusMessage.includes("Failed") ? (
              <AlertCircle className="w-4 h-4" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {statusMessage}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-secondary-100">
          <p className="text-xs text-secondary-500">
            Clients visiting your profile can only choose dates within your active days.
          </p>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            isLoading={saving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5"
          >
            Save Schedule
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
