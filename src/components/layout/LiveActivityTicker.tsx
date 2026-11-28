"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Star, Sparkles, X, MapPin } from "lucide-react";
import { db } from "@/lib/firebase/client";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";

interface TickerItem {
  id: string;
  type: "booking" | "review" | "job" | "verified";
  name: string;
  city?: string;
  service: string;
  timeAgo: string;
  rating?: number;
  timestampMs?: number;
}

function formatRelativeTime(dateVal: any): string {
  if (!dateVal) return "Just now";
  let ms = 0;
  if (typeof dateVal === "object" && "seconds" in dateVal) {
    ms = dateVal.seconds * 1000;
  } else if (typeof dateVal === "string" || typeof dateVal === "number") {
    ms = new Date(dateVal).getTime();
  }
  if (!ms || isNaN(ms)) return "Just now";

  const diffSec = Math.floor((Date.now() - ms) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function LiveActivityTicker() {
  const [activities, setActivities] = useState<TickerItem[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const isInitialLoad = useRef(true);

  // Real-time Firestore listener on public_activities
  useEffect(() => {
    const q = query(
      collection(db, "public_activities"),
      orderBy("createdAt", "desc"),
      limit(10)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: TickerItem[] = [];
      const now = Date.now();
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;

      snapshot.forEach((d) => {
        const data = d.data();
        let ms = 0;
        if (data.createdAt && typeof data.createdAt === "object" && "seconds" in data.createdAt) {
          ms = data.createdAt.seconds * 1000;
        } else if (data.createdAt) {
          ms = new Date(data.createdAt).getTime();
        }

        // Only display real activities created in the last 24 hours
        if (!ms || now - ms <= ONE_DAY_MS) {
          list.push({
            id: d.id,
            type: data.type || "booking",
            name: data.name || "A customer",
            city: data.city || "",
            service: data.service || "Service",
            rating: data.rating,
            timeAgo: formatRelativeTime(data.createdAt),
            timestampMs: ms || now,
          });
        }
      });

      // If a brand new real activity was just added after initial load, trigger immediate display
      if (!isInitialLoad.current && !dismissed) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            setIndex(0);
            setVisible(true);
          }
        });
      }

      isInitialLoad.current = false;
      setActivities(list);
    });

    return () => unsub();
  }, [dismissed]);

  // Periodic display cycling for real activities
  useEffect(() => {
    if (dismissed || activities.length === 0) {
      setVisible(false);
      return;
    }

    // Delay first show by 4 seconds
    const startTimer = setTimeout(() => {
      setVisible(true);
    }, 4000);

    // Rotate every 24 seconds
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % activities.length);
        setVisible(true);
      }, 700);
    }, 24000);

    return () => {
      clearTimeout(startTimer);
      clearInterval(interval);
    };
  }, [dismissed, activities.length]);

  // Hide after 6 seconds of display
  useEffect(() => {
    if (!visible) return;
    const hideTimer = setTimeout(() => {
      setVisible(false);
    }, 6000);
    return () => clearTimeout(hideTimer);
  }, [visible, index]);

  // If dismissed or no real activities exist, render nothing at all (zero fake popups)
  if (dismissed || activities.length === 0) return null;

  const current = activities[index] || activities[0];
  if (!current) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-4 z-40 pointer-events-none select-none max-w-sm">
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl p-3 sm:p-3.5 border border-secondary-200/80 shadow-[0_10px_30px_rgba(0,0,0,0.08)] flex items-center gap-3 relative group"
          >
            {/* Visual Icon */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-50 to-indigo-100 flex items-center justify-center text-primary-600 shrink-0 border border-primary-100">
              {current.type === "review" ? (
                <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
              ) : current.type === "verified" ? (
                <Sparkles className="w-5 h-5 text-indigo-600" />
              ) : current.type === "job" ? (
                <Sparkles className="w-5 h-5 text-primary-600" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              )}
            </div>

            {/* Content text */}
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-secondary-900 truncate">
                <span>{current.name}</span>
                {current.city && (
                  <span className="text-[10px] font-normal text-secondary-400 flex items-center gap-0.5">
                    <MapPin className="w-2.5 h-2.5" />
                    {current.city}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-secondary-600 truncate mt-0.5">
                {current.type === "review"
                  ? `Left a ${current.rating || 5}-star review for ${current.service}`
                  : current.type === "verified"
                  ? `New verified pro joined for ${current.service}`
                  : current.type === "job"
                  ? `Posted a new project for ${current.service}`
                  : `Booked ${current.service}`}
              </p>
              <span className="text-[9px] font-semibold text-primary-600 uppercase tracking-wider">
                {current.timeAgo}
              </span>
            </div>

            {/* Dismiss button */}
            <button
              onClick={() => setDismissed(true)}
              className="absolute top-2 right-2 text-secondary-400 hover:text-secondary-600 p-1 transition-colors"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
