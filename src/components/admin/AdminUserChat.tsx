"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db, storage } from "@/lib/firebase/client";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { uploadImageWithFallback } from "@/lib/imageUtils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Send,
  MessageSquare,
  Search,
  User,
  Briefcase,
  CheckCircle,
  Plus,
  X,
  Clock,
  ShieldCheck,
  Paperclip,
  Download,
  FileText,
} from "lucide-react";

interface AdminUserChatProps {
  allCustomers: any[];
  allProviders: any[];
}

interface ChatThread {
  id: string; // userId
  userName: string;
  userEmail: string;
  userRole?: string;
  lastMessage?: string;
  lastMessageAt?: any;
  unreadByAdmin?: boolean;
}

interface ChatMessage {
  id: string;
  text: string;
  fileUrl?: string;
  fileType?: "image" | "file";
  fileName?: string;
  sender: "admin" | "user";
  sentAt: any;
}

function parseTime(val: any): string {
  if (!val) return "Now";
  if (typeof val === "object" && "seconds" in val) {
    return new Date(val.seconds * 1000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return new Date(val).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminUserChat({
  allCustomers,
  allProviders,
}: AdminUserChatProps) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeUser, setActiveUser] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [searchUserQuery, setSearchUserQuery] = useState("");
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Listen to adminChats collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "adminChats"), (snap) => {
      const list = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as ChatThread)
      );
      setThreads(list);
    });
    return () => unsub();
  }, []);

  // 2. Listen to active thread messages
  useEffect(() => {
    if (!activeUser?.id) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, "adminChats", activeUser.id, "messages"),
      orderBy("sentAt", "asc")
    );

    const unsub = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      const list = snap.docs
        .map((d) => {
          const data = d.data({ serverTimestamps: "estimate" });
          return { id: d.id, ...data } as ChatMessage;
        })
        // filter out temp optimistic duplicates by id prefix
        .filter((m) => !m.id.startsWith("temp_"));
      setMessages((prev) => {
        // keep any optimistic messages that haven't been replaced yet
        const optimistic = prev.filter((m) => m.id.startsWith("temp_"));
        return [...list, ...optimistic];
      });
      setTimeout(
        () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        100
      );
    });

    return () => unsub();
  }, [activeUser?.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeUser?.id) return;

    const text = inputMessage.trim();
    setInputMessage("");
    setSending(true);

    // Optimistic update — show message immediately while Firestore writes
    const tempId = `temp_${Date.now()}`;
    const tempMsg: ChatMessage = {
      id: tempId,
      text,
      sender: "admin",
      sentAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);
    setTimeout(
      () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      50
    );

    try {
      // 1. Add message to subcollection
      await addDoc(
        collection(db, "adminChats", activeUser.id, "messages"),
        {
          text,
          sender: "admin",
          sentAt: serverTimestamp(),
          read: false,
        }
      );
      // Remove optimistic message — onSnapshot will add the real one
      setMessages((prev) => prev.filter((m) => m.id !== tempId));

      // 2. Update thread doc
      await setDoc(
        doc(db, "adminChats", activeUser.id),
        {
          userId: activeUser.id,
          userName: activeUser.userName,
          userEmail: activeUser.userEmail,
          userRole: activeUser.userRole || "customer",
          lastMessage: text,
          lastMessageAt: serverTimestamp(),
          unreadByUser: true,
          unreadByAdmin: false,
        },
        { merge: true }
      );

      // 3. Send realtime notification to target user
      await addDoc(collection(db, "notifications"), {
        userId: activeUser.id,
        title: "Official Promoh Support Message",
        message: text.slice(0, 100),
        link: activeUser.userRole === "provider" ? "/provider/dashboard" : "/dashboard",
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Failed to send support message", e);
    } finally {
      setSending(false);
    }
  };

  const handleAdminFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeUser?.id) return;
    setUploadingFile(true);

    try {
      const isImage = file.type.startsWith("image/");
      let fileUrl = "";

      // 1. Try Firebase Storage
      try {
        const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const storageRef = ref(storage, `adminChats/${activeUser.id}/${Date.now()}_${cleanName}`);
        await uploadBytes(storageRef, file);
        fileUrl = await getDownloadURL(storageRef);
      } catch (storageErr) {
        console.warn("Storage upload fallback for admin chat:", storageErr);
      }

      // 2. Fallbacks
      if (!fileUrl) {
        if (isImage) {
          const res = await uploadImageWithFallback(file, { maxWidth: 1000, maxHeight: 1000, quality: 0.8 });
          fileUrl = res.url;
        } else {
          if (file.size > 800 * 1024) {
            alert("File is larger than 800KB. For larger files, please enable Firebase Storage.");
            return;
          }
          fileUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Unable to read file"));
            reader.readAsDataURL(file);
          });
        }
      }

      const previewText = isImage ? "📷 Photo" : `📎 Document: ${file.name}`;

      await addDoc(collection(db, "adminChats", activeUser.id, "messages"), {
        text: previewText,
        fileUrl,
        fileType: isImage ? "image" : "file",
        fileName: file.name,
        sender: "admin",
        sentAt: serverTimestamp(),
        read: false,
      });

      await setDoc(
        doc(db, "adminChats", activeUser.id),
        {
          userId: activeUser.id,
          userName: activeUser.userName,
          userEmail: activeUser.userEmail,
          userRole: activeUser.userRole || "customer",
          lastMessage: previewText,
          lastMessageAt: serverTimestamp(),
          unreadByUser: true,
          unreadByAdmin: false,
        },
        { merge: true }
      );

      await addDoc(collection(db, "notifications"), {
        userId: activeUser.id,
        title: isImage ? "📷 Support Photo Received" : "📎 Support Document Received",
        message: `Promoh Support sent you a ${isImage ? "photo" : "document: " + file.name}`,
        link: "/chat",
        type: "message_new",
        read: false,
        createdAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error("Admin file upload error:", err);
      alert(`Upload error: ${err?.message || "Failed to send file"}`);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const startChatWithUser = (u: any, role: "customer" | "provider") => {
    const thread: ChatThread = {
      id: u.id,
      userName: u.businessName || `${u.firstName || ""} ${u.lastName || ""}`.trim() || "User",
      userEmail: u.email || "",
      userRole: role,
    };
    setActiveUser(thread);
    setShowNewChatModal(false);
    setSearchUserQuery("");
  };

  // Search filtered candidates for new chat
  const searchResults = [
    ...allCustomers.map((c) => ({ ...c, _role: "customer" })),
    ...allProviders.map((p) => ({ ...p, _role: "provider" })),
  ].filter((u) => {
    if (!searchUserQuery.trim()) return false;
    const q = searchUserQuery.toLowerCase();
    const name = u.businessName || `${u.firstName || ""} ${u.lastName || ""}`;
    return (
      name.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.id?.toLowerCase().includes(q)
    );
  });

  return (
    <Card className="border-secondary-200 shadow-sm overflow-hidden">
      <CardHeader className="bg-secondary-50/50 border-b border-secondary-100 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary-600" />
              Direct Support & Mediation Messenger
            </CardTitle>
            <CardDescription className="text-xs">
              Live direct communications with any customer or provider on the platform.
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => setShowNewChatModal(true)}
            className="text-xs gap-1.5 h-8 font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> Start New Chat
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-3 min-h-[550px] divide-y md:divide-y-0 md:divide-x divide-secondary-200">
          {/* Threads List Sidebar */}
          <div className="p-3 bg-secondary-50/40 space-y-2 max-h-[580px] overflow-y-auto">
            <span className="text-[10px] font-bold uppercase tracking-wider text-secondary-400 px-2 block">
              Active Conversations ({threads.length})
            </span>

            {threads.length === 0 ? (
              <div className="text-center py-12 text-xs text-secondary-400 px-4">
                No active support chats. Click "Start New Chat" to reach any user.
              </div>
            ) : (
              threads.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveUser(t)}
                  className={`w-full text-left p-3 rounded-xl transition-all border ${
                    activeUser?.id === t.id
                      ? "bg-white border-primary-200 shadow-xs ring-1 ring-primary-500/10"
                      : "bg-white/60 border-secondary-200/80 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-secondary-900 truncate">
                      {t.userName}
                    </span>
                    <span className="text-[10px] font-semibold text-secondary-400">
                      {parseTime(t.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[11px] text-secondary-500 truncate max-w-[180px]">
                      {t.lastMessage || "No messages yet"}
                    </p>
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full ${
                        t.userRole === "provider"
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {t.userRole || "user"}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Chat Window Panel */}
          <div className="md:col-span-2 flex flex-col h-[580px] bg-white">
            {activeUser ? (
              <>
                {/* Chat Top Banner */}
                <div className="p-3.5 border-b border-secondary-100 flex items-center justify-between bg-secondary-50/60">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">
                      {activeUser.userName[0]?.toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-secondary-900 leading-tight">
                        {activeUser.userName}
                      </h4>
                      <p className="text-[10px] text-secondary-500">
                        {activeUser.userEmail} &bull;{" "}
                        <span className="capitalize font-medium">
                          {activeUser.userRole}
                        </span>
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Channel Open
                  </span>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3">
                  {messages.length === 0 ? (
                    <div className="text-center py-16 text-xs text-secondary-400">
                      No messages in this channel yet. Type below to message this user.
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isAdmin = m.sender === "admin";
                      return (
                        <div
                          key={m.id}
                          className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl p-3 text-xs shadow-2xs space-y-1.5 ${
                              isAdmin
                                ? "bg-primary-600 text-white rounded-br-xs"
                                : "bg-secondary-100 text-secondary-900 rounded-bl-xs"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3 text-[10px] opacity-80 pb-0.5 border-b border-white/10">
                              <span className="font-bold">
                                {isAdmin ? "Promoh Support (You)" : activeUser.userName}
                              </span>
                              <span>{parseTime(m.sentAt)}</span>
                            </div>

                            {/* Render Picture */}
                            {m.fileType === "image" && m.fileUrl ? (
                              <div className="rounded-xl overflow-hidden bg-white/10 p-1">
                                <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" download={m.fileName || "photo"}>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={m.fileUrl}
                                    alt={m.fileName || "Photo"}
                                    className="max-w-[240px] max-h-[220px] object-cover rounded-lg"
                                  />
                                </a>
                                <div className="mt-1 flex justify-between items-center text-[10px]">
                                  <span className="truncate max-w-[140px] opacity-80">{m.fileName || "Photo"}</span>
                                  <a
                                    href={m.fileUrl}
                                    download={m.fileName || "photo"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline font-semibold flex items-center gap-0.5 ml-2"
                                  >
                                    <Download className="w-3 h-3" /> Save
                                  </a>
                                </div>
                              </div>
                            ) : m.fileType === "file" && m.fileUrl ? (
                              /* Render Document */
                              <a
                                href={m.fileUrl}
                                download={m.fileName || "document"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium transition-all ${
                                  isAdmin ? "bg-white/20 text-white hover:bg-white/30" : "bg-white text-secondary-900 border border-secondary-200"
                                }`}
                              >
                                <FileText className="w-4 h-4 shrink-0" />
                                <span className="flex-1 truncate max-w-[150px]">{m.fileName || "Document"}</span>
                                <Download className="w-3.5 h-3.5 shrink-0 opacity-80" />
                              </a>
                            ) : null}

                            {m.text && !m.fileUrl && (
                              <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Form */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-3 border-t border-secondary-100 flex items-center gap-2 bg-secondary-50/40"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.csv"
                    onChange={handleAdminFileUpload}
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    className="p-2 rounded-xl text-secondary-500 hover:text-secondary-800 hover:bg-secondary-200/60 transition-colors shrink-0 disabled:opacity-50"
                    title="Send Picture or Document"
                  >
                    {uploadingFile ? (
                      <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Paperclip className="w-4 h-4" />
                    )}
                  </button>

                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder={`Message ${activeUser.userName} directly...`}
                    className="flex-1 h-10 px-3.5 rounded-xl border border-secondary-200 text-xs bg-white text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!inputMessage.trim()}
                    isLoading={sending}
                    className="h-10 px-4 text-xs font-semibold gap-1.5 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" /> Send
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-secondary-400 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-secondary-100 flex items-center justify-center text-secondary-500">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-secondary-800">
                    No Conversation Selected
                  </h4>
                  <p className="text-xs text-secondary-500 mt-1 max-w-xs">
                    Choose a conversation from the left sidebar or click "Start New Chat" to reach any user.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-secondary-200">
            <div className="flex items-center justify-between pb-2 border-b border-secondary-100">
              <h3 className="font-bold text-sm text-secondary-900">
                Start Chat with Customer or Provider
              </h3>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="text-secondary-400 hover:text-secondary-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-secondary-400 absolute left-3 top-3" />
              <input
                type="text"
                autoFocus
                value={searchUserQuery}
                onChange={(e) => setSearchUserQuery(e.target.value)}
                placeholder="Type name, business, or email..."
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-secondary-200 text-xs bg-white text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1 divide-y divide-secondary-100">
              {searchResults.length === 0 ? (
                <div className="text-center py-6 text-xs text-secondary-400">
                  {searchUserQuery
                    ? "No matching users found."
                    : "Type above to search through customers and providers."}
                </div>
              ) : (
                searchResults.slice(0, 10).map((u) => {
                  const name =
                    u.businessName ||
                    `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
                    "User";
                  return (
                    <button
                      key={u.id}
                      onClick={() => startChatWithUser(u, u._role)}
                      className="w-full text-left p-2.5 hover:bg-secondary-50 rounded-xl transition-colors flex items-center justify-between"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-xs text-secondary-900 truncate">
                          {name}
                        </p>
                        <p className="text-[10px] text-secondary-400 truncate">
                          {u.email}
                        </p>
                      </div>
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                          u._role === "provider"
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {u._role}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
