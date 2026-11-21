"use client";

import { useEffect, useState } from "react";
import { getDb } from "@/lib/firebase/client";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  updateDoc,
  deleteDoc,
  doc,
  limit,
} from "firebase/firestore";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  Bell,
  CheckCheck,
  Trash2,
  X,
  Calendar,
  MessageSquare,
  Star,
  ShieldCheck,
  ShieldX,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
  booking_new: <Calendar className="w-4 h-4 text-blue-500" />,
  booking_update: <Calendar className="w-4 h-4 text-amber-500" />,
  booking_completed: <CheckCircle className="w-4 h-4 text-green-500" />,
  message_new: <MessageSquare className="w-4 h-4 text-indigo-500" />,
  review_received: <Star className="w-4 h-4 text-yellow-500" />,
  verification_approved: <ShieldCheck className="w-4 h-4 text-green-500" />,
  verification_rejected: <ShieldX className="w-4 h-4 text-red-500" />,
  default: <Bell className="w-4 h-4 text-secondary-400" />,
};

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    const db = getDb();
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(25)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.warn("Notifications listener warning:", err);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Mark all notifications as read (optimistic + parallel writes)
  const markAllRead = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    // Instant optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    try {
      const db = getDb();
      await Promise.allSettled(
        unread.map((n) =>
          updateDoc(doc(db, "notifications", n.id), { read: true }).catch((err) =>
            console.warn("Failed to mark notification read:", n.id, err)
          )
        )
      );
    } catch (err) {
      console.error("markAllRead error:", err);
    }
  };

  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    updateDoc(doc(getDb(), "notifications", id), { read: true }).catch(() => {});
  };

  // Delete single notification (optimistic + separate event)
  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(id);

    // Instant optimistic removal from UI
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    try {
      const db = getDb();
      await deleteDoc(doc(db, "notifications", id));
    } catch (err) {
      console.error("Failed to delete notification:", id, err);
    } finally {
      setDeletingId(null);
    }
  };

  // Clear all notifications
  const clearAllNotifications = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (notifications.length === 0) return;

    const toDelete = [...notifications];
    setNotifications([]);

    try {
      const db = getDb();
      await Promise.allSettled(
        toDelete.map((n) =>
          deleteDoc(doc(db, "notifications", n.id)).catch((err) =>
            console.warn("Failed to clear notification:", n.id, err)
          )
        )
      );
    } catch (err) {
      console.error("clearAllNotifications error:", err);
    }
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        id="notifications-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl hover:bg-secondary-100 text-secondary-600 hover:text-secondary-900 transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
      >
        <Bell className="w-5 h-5" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-secondary-200 z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-secondary-100 bg-gradient-to-r from-primary-50 to-indigo-50">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary-600" />
                  <h3 className="font-bold text-secondary-900 text-sm">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="text-xs bg-primary-600 text-white px-2 py-0.5 rounded-full font-medium">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="text-xs text-primary-600 hover:text-primary-800 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                      title="Mark all notifications as read"
                    >
                      <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAllNotifications}
                      className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1 hover:underline cursor-pointer ml-1"
                      title="Delete all notifications"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1 hover:bg-secondary-100 rounded-lg text-secondary-400 hover:text-secondary-700 cursor-pointer ml-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Notification list */}
              <div className="max-h-[400px] overflow-y-auto divide-y divide-secondary-50">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="w-10 h-10 text-secondary-200 mx-auto mb-3" />
                    <p className="text-sm font-medium text-secondary-500">All caught up!</p>
                    <p className="text-xs text-secondary-400 mt-1">No notifications yet.</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 hover:bg-secondary-50 transition-colors group ${
                        !n.read ? "bg-primary-50/40" : ""
                      }`}
                    >
                      {/* Clickable notification content */}
                      <Link
                        href={n.link || "#"}
                        onClick={() => {
                          markRead(n.id);
                          setIsOpen(false);
                        }}
                        className="flex items-start gap-3 flex-1 min-w-0"
                      >
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            !n.read ? "bg-white shadow-xs" : "bg-secondary-50"
                          }`}
                        >
                          {NOTIFICATION_ICONS[n.type] || NOTIFICATION_ICONS.default}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p
                              className={`text-sm font-medium truncate ${
                                !n.read ? "text-secondary-900 font-semibold" : "text-secondary-600"
                              }`}
                            >
                              {n.title}
                            </p>
                            {!n.read && (
                              <span className="w-2 h-2 bg-primary-500 rounded-full shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-secondary-500 mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-secondary-400 mt-1">
                            {n.createdAt
                              ? new Date(n.createdAt).toLocaleString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </p>
                        </div>
                      </Link>

                      {/* Delete notification button (OUTSIDE <Link> to prevent event cancellation) */}
                      <button
                        type="button"
                        onClick={(e) => deleteNotification(n.id, e)}
                        disabled={deletingId === n.id}
                        className="p-1.5 rounded-lg text-secondary-400 hover:text-red-500 hover:bg-red-50 transition-all shrink-0 cursor-pointer self-center"
                        title="Delete notification"
                      >
                        {deletingId === n.id ? (
                          <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-secondary-100 p-3 bg-secondary-50">
                <Link
                  href="/notifications"
                  onClick={() => setIsOpen(false)}
                  className="block text-center text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors"
                >
                  View All Notifications &rarr;
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
