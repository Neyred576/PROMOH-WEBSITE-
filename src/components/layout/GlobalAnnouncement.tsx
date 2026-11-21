"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Info, AlertTriangle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

export default function GlobalAnnouncement() {
  const [announcement, setAnnouncement] = useState<{ message: string; isActive: boolean } | null>(null);
  const [maintenance, setMaintenance] = useState<{ active: boolean; message: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Don't listen or show in admin routes
    if (pathname?.startsWith("/admin")) return;

    try {
      const unsubAnnounce = onSnapshot(
        doc(db, "platform_settings", "announcements"),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.isActive && data.message) {
              setAnnouncement({ message: data.message, isActive: true });
              setDismissed(false);
            } else {
              setAnnouncement(null);
            }
          } else {
            setAnnouncement(null);
          }
        },
        (err) => console.error("Announcement listener error:", err)
      );

      const unsubOps = onSnapshot(
        doc(db, "platform_settings", "operations"),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.maintenanceMode) {
              setMaintenance({
                active: true,
                message: data.maintenanceMessage || "Promoh is currently undergoing scheduled platform upgrades. We will be back online shortly.",
              });
            } else {
              setMaintenance(null);
            }
          } else {
            setMaintenance(null);
          }
        },
        (err) => console.error("Operations listener error:", err)
      );

      return () => {
        unsubAnnounce();
        unsubOps();
      };
    } catch (e) {
      console.error("Error setting up announcement listeners", e);
    }
  }, [pathname]);

  // Don't show in admin routes
  if (pathname?.startsWith("/admin")) return null;

  // Maintenance banner takes highest priority
  if (maintenance?.active) {
    return (
      <div className="bg-amber-500 text-amber-950 px-4 py-2 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border-b border-amber-600 shadow-xs z-[100]">
        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-950" />
        <span>{maintenance.message}</span>
      </div>
    );
  }

  if (!announcement || !announcement.isActive || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -40 }}
        className="bg-primary-600 text-white text-sm font-medium z-[100]"
      >
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 justify-center">
            <Info className="w-4 h-4 shrink-0 text-primary-100" />
            <span>{announcement.message}</span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 p-1 hover:bg-primary-700 rounded-lg transition-colors text-primary-100 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
