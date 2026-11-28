"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useEffect, useState } from "react";
import { Home, Search, Calendar, MessageSquare, User } from "lucide-react";
import { db } from "@/lib/firebase/client";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  // Determine dashboard link based on role
  const dashboardLink = user?.role === "provider"
    ? "/provider/dashboard"
    : "/dashboard";

  // Real-time unread messages count
  useEffect(() => {
    if (!user?.uid) {
      setUnreadCount(0);
      return;
    }

    const q = query(
      collection(db, "chats"),
      where("participantIds", "array-contains", user.uid)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      let count = 0;
      snapshot.docs.forEach((d) => {
        const data = d.data();
        if (
          data.lastMessageSenderId &&
          data.lastMessageSenderId !== user.uid &&
          (!data.readBy || !data.readBy.includes(user.uid))
        ) {
          count++;
        }
      });
      setUnreadCount(count);
    });

    return () => unsub();
  }, [user?.uid]);

  // Don't display in full-screen chat or inside admin portal on mobile to avoid overlapping controls
  if (pathname === "/chat" || pathname?.startsWith("/admin")) return null;

  const navItems = [
    { label: "Home", href: "/", icon: Home, active: pathname === "/" },
    { label: "Search", href: "/search", icon: Search, active: pathname?.startsWith("/search") },
    {
      label: user?.role === "provider" ? "Orders" : "Bookings",
      href: user ? dashboardLink : "/login",
      icon: Calendar,
      active: pathname?.includes("dashboard"),
    },
    {
      label: "Messages",
      href: user ? "/chat" : "/login",
      icon: MessageSquare,
      active: pathname?.startsWith("/chat"),
      badge: unreadCount,
    },
    {
      label: "Account",
      href: user ? "/profile" : "/login",
      icon: User,
      active: pathname === "/profile" || pathname === "/login" || pathname?.startsWith("/provider/dashboard/profile"),
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-secondary-200/80 px-2 py-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]"
    >
      <div className="grid grid-cols-5 items-center">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative ${
                item.active
                  ? "text-primary-600 font-bold"
                  : "text-secondary-500 hover:text-secondary-900 font-medium"
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${item.active ? "stroke-[2.5]" : "stroke-[1.8]"}`} />
                {Boolean(item.badge && item.badge > 0) && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-rose-600 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 shadow-xs animate-pulse">
                    {(item.badge ?? 0) > 9 ? "9+" : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
              {item.active && (
                <span className="w-1 h-1 rounded-full bg-primary-600 mt-0.5" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
