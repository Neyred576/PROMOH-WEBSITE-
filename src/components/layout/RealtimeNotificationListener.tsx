"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { db } from "@/lib/firebase/client";
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy, limit } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { playNotificationChime } from "@/lib/audio";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Calendar, MessageSquare, Star, CheckCircle,
  AlertCircle, ShieldCheck, X, ArrowRight
} from "lucide-react";

interface ToastNotification {
  id: string;
  title: string;
  message: string;
  link?: string;
  type?: string;
  createdAt?: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  booking_new: <Calendar className="w-5 h-5 text-blue-600" />,
  booking_update: <Calendar className="w-5 h-5 text-amber-600" />,
  booking_completed: <CheckCircle className="w-5 h-5 text-emerald-600" />,
  message_new: <MessageSquare className="w-5 h-5 text-indigo-600" />,
  review_received: <Star className="w-5 h-5 text-yellow-500 fill-yellow-400" />,
  verification_approved: <ShieldCheck className="w-5 h-5 text-emerald-600" />,
  default: <Bell className="w-5 h-5 text-primary-600" />,
};

export default function RealtimeNotificationListener() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeToasts, setActiveToasts] = useState<ToastNotification[]>([]);
  const initialLoadRef = useRef(true);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const bookingStatusesRef = useRef<Record<string, string>>({});
  const initialBookingsLoadRef = useRef(true);

  // Real-time listener for Customer Booking Status Updates (Accepted, In Progress, Completed, Rejected)
  useEffect(() => {
    if (!user?.uid || user?.role === "provider" || user?.role === "admin") return;

    const bq = query(
      collection(db, "bookings"),
      where("customerId", "==", user.uid)
    );

    const unsubBookings = onSnapshot(bq, (snapshot) => {
      if (initialBookingsLoadRef.current) {
        snapshot.docs.forEach((d) => {
          bookingStatusesRef.current[d.id] = d.data().status;
        });
        initialBookingsLoadRef.current = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        const id = change.doc.id;
        const data = change.doc.data();
        const prevStatus = bookingStatusesRef.current[id];
        const newStatus = data.status;
        bookingStatusesRef.current[id] = newStatus;

        if (prevStatus && prevStatus !== newStatus) {
          let title = "Booking Status Updated";
          let message = `Your booking for ${data.service || "service"} has been updated to: ${newStatus.replace("_", " ")}.`;
          let type = "booking_update";
          let link = "/dashboard";

          if (newStatus === "accepted") {
            title = "🎉 Booking Accepted!";
            message = `${data.providerName || "Your provider"} accepted your booking request for ${data.service || "service"}!`;
          } else if (newStatus === "in_progress") {
            title = "🚀 Service Started";
            message = `${data.providerName || "Your provider"} has started working on your service.`;
          } else if (newStatus === "completed") {
            title = "⭐ Service Completed";
            message = `${data.providerName || "Your provider"} marked ${data.service || "your service"} as completed. Receipt ready!`;
            link = data.paymentStatus === "paid" ? "/dashboard" : `/payment/${id}`;
            type = "booking_completed";
          } else if (newStatus === "rejected") {
            title = "Booking Declined";
            message = `${data.providerName || "Your provider"} was unable to accept your booking request.`;
          }

          playNotificationChime();
          const toastId = `booking_${id}_${Date.now()}`;
          const toastItem: ToastNotification = {
            id: toastId,
            title,
            message,
            link,
            type,
            createdAt: new Date().toISOString(),
          };

          setActiveToasts((prev) => [toastItem, ...prev.slice(0, 2)]);
          setTimeout(() => {
            setActiveToasts((curr) => curr.filter((t) => t.id !== toastId));
          }, 8500);
        }
      });
    });

    return () => unsubBookings();
  }, [user?.uid, user?.role]);

  useEffect(() => {
    if (!user?.uid) return;

    // Listen for recent unread notifications for the active user
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      where("read", "==", false),
      limit(10)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      // On the initial snapshot, record all existing IDs so we do not spam toasts for past notifications
      if (initialLoadRef.current) {
        snapshot.docs.forEach((d) => seenIdsRef.current.add(d.id));
        initialLoadRef.current = false;
        return;
      }

      // Check for newly added documents
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const docId = change.doc.id;
          if (!seenIdsRef.current.has(docId)) {
            seenIdsRef.current.add(docId);
            const data = change.doc.data();

            const toastItem: ToastNotification = {
              id: docId,
              title: data.title || "New Notification",
              message: data.message || "",
              link: data.link || "/dashboard",
              type: data.type || "default",
              createdAt: data.createdAt,
            };

            // Play audio chime
            playNotificationChime();

            // Push to active toasts
            setActiveToasts((prev) => [toastItem, ...prev.slice(0, 2)]);

            // Auto dismiss after 6 seconds
            setTimeout(() => {
              setActiveToasts((current) => current.filter((t) => t.id !== docId));
            }, 6500);
          }
        }
      });
    });

    return () => unsub();
  }, [user?.uid]);

  const handleToastClick = async (toast: ToastNotification) => {
    // Mark as read in Firestore
    try {
      await updateDoc(doc(db, "notifications", toast.id), { read: true });
    } catch {}

    // Dismiss toast
    setActiveToasts((current) => current.filter((t) => t.id !== toast.id));

    // Navigate to destination link
    if (toast.link) {
      router.push(toast.link);
    }
  };

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveToasts((current) => current.filter((t) => t.id !== id));
  };

  if (activeToasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 sm:right-6 z-[9999] flex flex-col gap-3 pointer-events-none max-w-sm w-full">
      <AnimatePresence>
        {activeToasts.map((toast) => {
          const icon = TYPE_ICONS[toast.type || "default"] || TYPE_ICONS.default;

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={() => handleToastClick(toast)}
              className="pointer-events-auto cursor-pointer bg-white/95 backdrop-blur-md border border-secondary-200/80 shadow-2xl rounded-2xl p-4 hover:border-primary-400 hover:shadow-primary-500/10 transition-all group relative overflow-hidden"
            >
              {/* Top Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 to-indigo-600" />

              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-primary-50 border border-primary-100 shrink-0 group-hover:scale-105 transition-transform">
                  {icon}
                </div>

                <div className="flex-1 min-w-0 pr-6">
                  <h4 className="text-sm font-bold text-secondary-900 truncate group-hover:text-primary-600 transition-colors">
                    {toast.title}
                  </h4>
                  <p className="text-xs text-secondary-600 mt-1 line-clamp-2 leading-relaxed">
                    {toast.message}
                  </p>
                  <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-primary-600">
                    <span>View details</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleDismiss(toast.id, e)}
                  className="absolute top-3 right-3 text-secondary-400 hover:text-secondary-700 p-1 rounded-lg hover:bg-secondary-100 transition-colors"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
