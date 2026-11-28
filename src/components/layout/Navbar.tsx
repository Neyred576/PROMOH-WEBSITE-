"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { useState, useEffect } from "react";
import { Menu, X, MessageSquare } from "lucide-react";
import Notifications from "./Notifications";
import { db } from "@/lib/firebase/client";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export default function Navbar() {
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) {
      setUnreadChatCount(0);
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
      setUnreadChatCount(count);
    });
    return () => unsub();
  }, [user?.uid]);

  const handleSignOut = async () => {
    document.cookie = "admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    await signOut();
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  return (
    <nav className="border-b border-white/40 bg-white/75 backdrop-blur-2xl sticky top-0 z-50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-r from-primary-50/50 via-transparent to-indigo-50/50 pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between relative z-10">
        <Link href="/" className="flex items-center gap-2 group">
          <Image src="/logo.png" alt="Promoh Logo" width={40} height={40} className="w-auto h-10 object-contain group-hover:scale-105 transition-transform duration-300" />
          <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-indigo-600 tracking-tight hidden sm:block">Promoh</span>
        </Link>
        <div className="hidden md:flex items-center gap-6 font-semibold text-sm text-secondary-600">
          <Link href="/search" className="hover:text-primary-600 hover:-translate-y-0.5 transition-all">Find Professionals</Link>
          <Link href="/online-jobs" className="hover:text-primary-600 hover:-translate-y-0.5 transition-all">Online Jobs</Link>
          <Link href="/register/provider" className="hover:text-primary-600 hover:-translate-y-0.5 transition-all">Become a Provider</Link>
          {user && user.role !== "admin" ? (
            <>
              <Link href="/chat">
                <Button variant="ghost" size="sm" className="px-2 relative">
                  <MessageSquare className="w-5 h-5 text-secondary-600" />
                  {unreadChatCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-xs border-2 border-white animate-pulse">
                      {unreadChatCount > 9 ? "9+" : unreadChatCount}
                    </span>
                  )}
                </Button>
              </Link>
              <Notifications />
              <Link href="/payments">
                <Button variant="ghost" size="sm" title="Payment History">Payments</Button>
              </Link>
              <Link href={user.role === "provider" ? "/provider/dashboard" : "/dashboard"}>
                <Button variant="ghost">Dashboard</Button>
              </Link>
              <Button variant="outline" onClick={handleSignOut}>Log Out</Button>
            </>
          ) : (
            <>
              <Link href="/login"><Button variant="ghost">Log In</Button></Link>
              <Link href="/register"><Button>Sign Up</Button></Link>
            </>
          )}
        </div>
        <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>
      {mobileOpen && (
        <div className="md:hidden bg-white border-t px-4 py-4 space-y-3">
          <Link href="/search" className="block py-2 hover:text-primary-600" onClick={() => setMobileOpen(false)}>Find Professionals</Link>
          <Link href="/online-jobs" className="block py-2 hover:text-primary-600" onClick={() => setMobileOpen(false)}>Online Jobs</Link>
          <Link href="/provider/register" className="block py-2 hover:text-primary-600" onClick={() => setMobileOpen(false)}>Become a Provider</Link>
          {user && user.role !== "admin" ? (
            <>
              <Link href="/chat" className="flex items-center justify-between py-2 text-secondary-700 font-semibold" onClick={() => setMobileOpen(false)}>
                <span className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary-600" /> Messages</span>
                {unreadChatCount > 0 && (
                  <span className="bg-rose-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                    {unreadChatCount} new
                  </span>
                )}
              </Link>
              <Link href="/payments" className="block py-2 text-secondary-700 font-semibold hover:text-primary-600" onClick={() => setMobileOpen(false)}>
                💳 Payment History & Receipts
              </Link>
              <Link href={user.role === "provider" ? "/provider/dashboard" : "/dashboard"} className="block py-2 text-secondary-700 font-semibold hover:text-primary-600" onClick={() => setMobileOpen(false)}>
                📊 Dashboard
              </Link>
              <Button variant="outline" className="w-full" onClick={handleSignOut}>Log Out</Button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setMobileOpen(false)}><Button variant="ghost" className="w-full">Log In</Button></Link>
              <Link href="/register" onClick={() => setMobileOpen(false)}><Button className="w-full">Sign Up</Button></Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
