"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, ShieldCheck, ChevronDown, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { db } from "@/lib/firebase/client";
import {
  collection, query, orderBy, onSnapshot,
  addDoc, serverTimestamp, doc, setDoc
} from "firebase/firestore";
import { usePathname } from "next/navigation";
import { playNotificationChime } from "@/lib/audio";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface SupportMsg {
  id: string;
  sender: "user" | "admin";
  text: string;
  createdAt?: any;
}

export default function LiveSupportWidget() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<SupportMsg[]>([]);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  // Hide widget inside dedicated chat, admin dashboard, or if user is administrator
  if (pathname === "/chat" || pathname?.startsWith("/admin") || user?.role === "admin" || user?.email === "admin@promoh.com") {
    return null;
  }

  // Real-time snapshot listener on user's direct admin support thread
  useEffect(() => {
    if (!user?.uid) return;

    const msgsQ = query(
      collection(db, "adminChats", user.uid, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(msgsQ, (snapshot) => {
      const list: SupportMsg[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as SupportMsg);
      });

      if (!isInitialLoad.current) {
        // If new message from admin arrived while widget is closed, sound chime and show unread badge
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added" && change.doc.data().sender === "admin") {
            playNotificationChime();
            if (!open) setUnreadCount((c) => c + 1);
          }
        });
      }
      isInitialLoad.current = false;
      setMessages(list);
    });

    return () => unsub();
  }, [user?.uid, open]);

  // Auto scroll to bottom
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setUnreadCount(0);
    }
  }, [open, messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user?.uid || user.email === "admin@promoh.com") return;

    const content = text.trim();
    setText("");
    setSending(true);

    try {
      // 1. Add message to subcollection
      await addDoc(collection(db, "adminChats", user.uid, "messages"), {
        sender: "user",
        text: content,
        senderId: user.uid,
        senderName: user.displayName || user.email || "Customer",
        createdAt: serverTimestamp(),
      });

      // 2. Update parent admin chat thread for admin dashboard
      await setDoc(
        doc(db, "adminChats", user.uid),
        {
          userId: user.uid,
          userName: user.displayName || user.email || "Customer",
          userEmail: user.email || "",
          lastMessage: content,
          lastMessageAt: serverTimestamp(),
          unreadByAdmin: true,
          unreadByUser: false,
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Support message send error:", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40">
        <button
          onClick={() => setOpen(!open)}
          className="relative inline-flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-semibold text-sm shadow-[0_8px_25px_rgba(37,99,235,0.35)] hover:scale-105 active:scale-95 transition-all duration-300 group"
          aria-label="Open Promoh Live Support"
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5 transition-transform group-hover:rotate-6" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-white animate-pulse" />
          </div>
          <span className="hidden sm:inline">Ask Support</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm border-2 border-white animate-bounce">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Floating Chat Modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed bottom-36 sm:bottom-20 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 max-w-sm h-[480px] bg-white rounded-3xl border border-secondary-200/90 shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-600 to-indigo-600 p-4 text-white flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30">
                  <ShieldCheck className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight flex items-center gap-1.5">
                    Promoh Support
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  </h3>
                  <p className="text-[11px] text-white/80">Online & ready to assist</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                title="Close chat"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
              {/* Intro Welcome Bubble */}
              <div className="flex gap-2.5 items-start">
                <div className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  P
                </div>
                <div className="bg-white rounded-2xl rounded-tl-sm p-3 text-xs text-secondary-800 shadow-2xs border border-secondary-100 max-w-[85%] leading-relaxed">
                  👋 Hello! Welcome to Promoh. How can we assist you with bookings, provider verification, or questions today?
                </div>
              </div>

              {!user && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-center my-3 text-xs text-amber-800 space-y-2">
                  <p className="font-semibold">Sign in to start a real-time support ticket</p>
                  <p className="text-[11px] text-amber-700">
                    Signing in allows our support team to respond directly to your account.
                  </p>
                  <Link href="/login" className="inline-block mt-1">
                    <button className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors">
                      Log In to Chat
                    </button>
                  </Link>
                </div>
              )}

              {/* Message Feed */}
              {messages.map((msg) => {
                const isMe = msg.sender === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2 items-end ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    {!isMe && (
                      <div className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                        P
                      </div>
                    )}
                    <div
                      className={`rounded-2xl px-3.5 py-2 text-xs max-w-[80%] leading-relaxed shadow-2xs ${
                        isMe
                          ? "bg-primary-600 text-white rounded-br-xs"
                          : "bg-white text-secondary-900 border border-secondary-100 rounded-bl-xs"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            {user ? (
              <form onSubmit={handleSend} className="p-3 bg-white border-t border-secondary-200/80 flex items-center gap-2">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 py-2 px-3.5 text-xs rounded-xl bg-secondary-50 border border-secondary-200 focus:outline-none focus:border-primary-500 focus:bg-white transition-all text-secondary-900"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={!text.trim() || sending}
                  className="w-8 h-8 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white flex items-center justify-center shadow-xs transition-colors shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <div className="p-3 bg-secondary-50 border-t border-secondary-200 text-center text-[11px] text-secondary-500">
                Support is available 24/7 for all verified members
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
