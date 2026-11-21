"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { db, storage } from "@/lib/firebase/client";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  serverTimestamp,
  getDoc,
  limit,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/lib/contexts/AuthContext";
import Navbar from "@/components/layout/Navbar";
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  MessageSquare,
  Search,
  Check,
  CheckCheck,
  Circle,
  ArrowLeft,
  X,
  Download,
  ShieldCheck,
  Shield,
  FileText,
  AlertCircle,
  ChevronDown,
  Moon,
  Sun,
  Activity,
} from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { playNotificationChime } from "@/lib/audio";
import { uploadImageWithFallback } from "@/lib/imageUtils";

// Special sentinel ID for the Admin Support thread
const ADMIN_SUPPORT_CHAT_ID = "__admin_support__";

type StatusMode = "online" | "dnd" | "offline";

interface Message {
  id: string;
  senderId: string;
  text?: string;
  fileUrl?: string;
  fileType?: "image" | "file";
  fileName?: string;
  readBy: string[];
  createdAt: any;
  sender?: "admin" | "user";
  sentAt?: any;
}

interface Conversation {
  id: string;
  participantIds: string[];
  lastMessage?: string;
  lastMessageAt?: any;
  unreadCount?: number;
  isAdminSupport?: boolean;
  otherUser?: {
    id: string;
    name: string;
    photo?: string;
    role?: string;
    isVerified?: boolean;
    isOnline?: boolean;
    lastSeen?: string;
    statusMode?: StatusMode;
  };
}

function getChatId(uid1: string, uid2: string) {
  return [uid1, uid2].sort().join("_");
}

function toMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts?.toMillis === "function") return ts.toMillis();
  if (typeof ts?.toDate === "function") return ts.toDate().getTime();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === "string" || typeof ts === "number") {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  if (typeof ts === "object" && "seconds" in ts) {
    return ts.seconds * 1000;
  }
  return 0;
}

function formatTime(ts: any): string {
  const ms = toMs(ts);
  if (!ms) return "";
  const now = Date.now();
  const diff = now - ms;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  const date = new Date(ms);
  if (diff < 86400000) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getPresenceInfo(userObj?: {
  isOnline?: boolean;
  lastSeen?: any;
  statusMode?: StatusMode;
}) {
  if (!userObj) {
    return { isOnline: false, status: "offline", label: "Offline", color: "bg-secondary-300" };
  }

  if (userObj.statusMode === "offline") {
    return { isOnline: false, status: "offline", label: "Offline", color: "bg-secondary-400" };
  }

  if (userObj.statusMode === "dnd") {
    return {
      isOnline: true,
      status: "dnd",
      label: "Do Not Disturb",
      color: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse",
    };
  }

  const ms = toMs(userObj.lastSeen);
  const isRecent = ms > 0 && Date.now() - ms < 3 * 60 * 1000; // active in last 3 mins
  const isOnline = Boolean(userObj.statusMode === "online" || userObj.isOnline || isRecent);

  if (isOnline) {
    return {
      isOnline: true,
      status: "online",
      label: "Online now",
      color: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse",
    };
  }

  if (ms > 0) {
    const mins = Math.floor((Date.now() - ms) / 60000);
    if (mins < 60) {
      return { isOnline: false, status: "offline", label: `Last seen ${mins}m ago`, color: "bg-secondary-300" };
    }
    const hours = Math.floor(mins / 60);
    if (hours < 24) {
      return { isOnline: false, status: "offline", label: `Last seen ${hours}h ago`, color: "bg-secondary-300" };
    }
  }

  return { isOnline: false, status: "offline", label: "Offline", color: "bg-secondary-300" };
}

function ChatPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetProviderId = searchParams.get("provider");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [adminSupportThread, setAdminSupportThread] = useState<Conversation | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeOtherUser, setActiveOtherUser] = useState<Conversation["otherUser"] | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [showConvList, setShowConvList] = useState(true);

  // User live status switcher (Online / DND / Offline)
  const [myStatus, setMyStatus] = useState<StatusMode>("online");
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  // Timer tick every 10s to re-evaluate presence freshness live
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  // Load user's saved status mode on mount
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.statusMode) {
          setMyStatus(d.statusMode as StatusMode);
        }
      }
    });
    return () => unsub();
  }, [user?.uid]);

  // Real-time Chat Heartbeat while on this page
  useEffect(() => {
    if (!user?.uid) return;

    const sendHeartbeat = () => {
      if (myStatus !== "offline") {
        const now = new Date().toISOString();
        updateDoc(doc(db, "users", user.uid), {
          isOnline: true,
          lastSeen: now,
          statusMode: myStatus,
        }).catch(() => {});

        if (user.role === "provider") {
          updateDoc(doc(db, "providers", user.uid), {
            isOnline: true,
            lastSeen: now,
            statusMode: myStatus,
          }).catch(() => {});
        }
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 25000); // Send heartbeat every 25s
    return () => clearInterval(interval);
  }, [user?.uid, user?.role, myStatus]);

  // Set & Broadcast live status mode (Online, DND, Offline)
  const setStatusAndBroadcast = async (mode: StatusMode) => {
    setMyStatus(mode);
    setShowStatusMenu(false);
    if (!user?.uid) return;

    const isOnline = mode === "online" || mode === "dnd";
    const now = new Date().toISOString();

    await updateDoc(doc(db, "users", user.uid), {
      statusMode: mode,
      isOnline,
      lastSeen: now,
    }).catch(() => {});

    if (user.role === "provider") {
      await updateDoc(doc(db, "providers", user.uid), {
        statusMode: mode,
        isOnline,
        lastSeen: now,
      }).catch(() => {});
    }
  };

  // Auto-start chat with a provider from ?provider=ID
  useEffect(() => {
    if (targetProviderId && user?.uid) {
      const chatId = getChatId(user.uid, targetProviderId);
      openChat(chatId, targetProviderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetProviderId, user?.uid]);

  // 1. Listen to Admin Direct Support Thread for this user
  useEffect(() => {
    if (!user?.uid) return;

    const unsubAdmin = onSnapshot(
      doc(db, "adminChats", user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setAdminSupportThread({
            id: ADMIN_SUPPORT_CHAT_ID,
            participantIds: [user.uid, "admin"],
            lastMessage: data.lastMessage || "Support channel open",
            lastMessageAt: data.lastMessageAt || null,
            unreadCount: data.unreadByUser ? 1 : 0,
            isAdminSupport: true,
            otherUser: {
              id: "admin",
              name: "Promoh Support (Official)",
              role: "Admin & Verification Center",
              isVerified: true,
              isOnline: true,
              statusMode: "online",
            },
          });
        }
      },
      (err) => {
        console.warn("Admin chat listener warning:", err);
      }
    );

    return () => unsubAdmin();
  }, [user?.uid]);

  // 2. Load regular user-to-user conversations
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, "chats"),
      where("participantIds", "array-contains", user.uid),
      limit(50)
    );

    const unsub = onSnapshot(
      q,
      async (snap) => {
        const convs: Conversation[] = [];
        for (const docSnap of snap.docs) {
          const data = docSnap.data() as any;
          const otherId = data.participantIds?.find((id: string) => id !== user.uid);
          if (!otherId) continue;

          // Fetch other user info
          let otherUser: Conversation["otherUser"] = {
            id: otherId,
            name: "Member",
            role: "customer",
            isOnline: false,
          };

          try {
            const [providerSnap, userSnap] = await Promise.all([
              getDoc(doc(db, "providers", otherId)).catch(() => null),
              getDoc(doc(db, "users", otherId)).catch(() => null),
            ]);

            const pd = providerSnap?.exists() ? providerSnap.data() : null;
            const ud = userSnap?.exists() ? userSnap.data() : null;

            const name =
              pd?.businessName?.trim() ||
              `${pd?.firstName || ""} ${pd?.lastName || ""}`.trim() ||
              `${ud?.firstName || ""} ${ud?.lastName || ""}`.trim() ||
              ud?.displayName?.trim() ||
              ud?.name?.trim() ||
              ud?.email?.split("@")[0] ||
              pd?.email?.split("@")[0] ||
              "Member";

            const photo = pd?.photoURL || ud?.photoURL;
            const role = pd ? "provider" : ud?.role || "customer";
            const isVerified = Boolean(pd?.isVerified || ud?.isVerified);
            const isOnline = Boolean(pd?.isOnline || ud?.isOnline);
            const lastSeen = pd?.lastSeen || ud?.lastSeen;
            const statusMode = (pd?.statusMode || ud?.statusMode || (isOnline ? "online" : "offline")) as StatusMode;

            otherUser = {
              id: otherId,
              name,
              photo,
              role,
              isVerified,
              isOnline,
              lastSeen,
              statusMode,
            };
          } catch (e) {
            console.warn("Could not load user metadata for chat:", otherId, e);
          }

          convs.push({ id: docSnap.id, ...data, otherUser });
        }

        // Sort descending by last message time in JS
        convs.sort((a, b) => toMs(b.lastMessageAt) - toMs(a.lastMessageAt));
        setConversations(convs);
      },
      (err) => {
        console.error("Failed to load conversations:", err);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  // Combine admin support thread with regular conversations
  const allConversations = [
    ...(adminSupportThread ? [adminSupportThread] : []),
    ...conversations,
  ];

  const openChat = async (
    chatId: string,
    otherIdHint?: string,
    existingOtherUser?: Conversation["otherUser"]
  ) => {
    setActiveChatId(chatId);
    setShowConvList(false);

    if (chatId === ADMIN_SUPPORT_CHAT_ID) {
      setActiveOtherUser({
        id: "admin",
        name: "Promoh Support (Official)",
        role: "Admin & Verification Center",
        isVerified: true,
        isOnline: true,
        statusMode: "online",
      });

      if (user?.uid) {
        updateDoc(doc(db, "adminChats", user.uid), { unreadByUser: false }).catch(() => {});
      }
      return;
    }

    // Determine actual other user ID
    const parts = chatId.split("_");
    const otherId = otherIdHint || parts.find((id) => id !== user?.uid) || "";

    // Set immediate info from existing otherUser if available
    if (existingOtherUser && existingOtherUser.name && existingOtherUser.name !== "Member") {
      setActiveOtherUser(existingOtherUser);
    } else {
      setActiveOtherUser({
        id: otherId,
        name: existingOtherUser?.name || "Member",
        role: existingOtherUser?.role || "user",
        photo: existingOtherUser?.photo,
      });
    }

    if (!otherId) return;

    // Fetch live details from both provider and user docs
    try {
      const [providerSnap, userSnap] = await Promise.all([
        getDoc(doc(db, "providers", otherId)).catch(() => null),
        getDoc(doc(db, "users", otherId)).catch(() => null),
      ]);

      const pd = providerSnap?.exists() ? providerSnap.data() : null;
      const ud = userSnap?.exists() ? userSnap.data() : null;

      const name =
        pd?.businessName?.trim() ||
        `${pd?.firstName || ""} ${pd?.lastName || ""}`.trim() ||
        `${ud?.firstName || ""} ${ud?.lastName || ""}`.trim() ||
        ud?.displayName?.trim() ||
        ud?.name?.trim() ||
        ud?.email?.split("@")[0] ||
        pd?.email?.split("@")[0] ||
        "Member";

      const photo = pd?.photoURL || ud?.photoURL;
      const role = pd ? "provider" : ud?.role || "customer";
      const isVerified = Boolean(pd?.isVerified || ud?.isVerified);
      const isOnline = Boolean(pd?.isOnline || ud?.isOnline);
      const lastSeen = pd?.lastSeen || ud?.lastSeen;
      const statusMode = (pd?.statusMode || ud?.statusMode || (isOnline ? "online" : "offline")) as StatusMode;

      setActiveOtherUser({
        id: otherId,
        name,
        photo,
        role,
        isVerified,
        isOnline,
        lastSeen,
        statusMode,
      });
    } catch (e) {
      console.warn("Could not load user profile:", e);
    }

    // Ensure chat document exists in Firestore
    if (user?.uid && otherId) {
      const chatRef = doc(db, "chats", chatId);
      const chatSnap = await getDoc(chatRef).catch(() => null);
      if (!chatSnap?.exists()) {
        await setDoc(chatRef, {
          participantIds: [user.uid, otherId].sort(),
          createdAt: serverTimestamp(),
          lastMessageAt: serverTimestamp(),
          lastMessage: "",
        }).catch((err) => console.warn("Could not create chat doc:", err));
      }
    }
  };

  // Listen to messages & live presence in active chat
  useEffect(() => {
    if (!activeChatId || !user?.uid) return;

    // Case A: Admin Support Chat
    if (activeChatId === ADMIN_SUPPORT_CHAT_ID) {
      const q = query(
        collection(db, "adminChats", user.uid, "messages"),
        orderBy("sentAt", "asc")
      );

      const unsub = onSnapshot(
        q,
        (snap) => {
          const msgs: Message[] = snap.docs.map((d) => {
            const data = d.data({ serverTimestamps: "estimate" });
            return {
              id: d.id,
              senderId: data.sender === "admin" ? "admin" : user.uid,
              text: data.text || "",
              fileUrl: data.fileUrl,
              fileType: data.fileType,
              fileName: data.fileName,
              sender: data.sender,
              readBy: data.read ? [user.uid, "admin"] : [data.sender === "admin" ? "admin" : user.uid],
              createdAt: data.sentAt || new Date().toISOString(),
            } as Message;
          });

          if (msgs.length > 0) {
            const last = msgs[msgs.length - 1];
            if (last.sender === "admin") {
              playNotificationChime();
            }
          }

          setMessages(msgs);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
        },
        (err) => {
          console.error("Admin chat messages error:", err);
        }
      );

      return () => unsub();
    }

    // Case B: Regular user-to-user chat
    const q = query(
      collection(db, "chats", activeChatId, "messages"),
      orderBy("createdAt", "asc"),
      limit(100)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const msgs: Message[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message));

        if (msgs.length > 0) {
          const last = msgs[msgs.length - 1];
          if (last.senderId !== user.uid && (!last.readBy || !last.readBy.includes(user.uid))) {
            playNotificationChime();
          }
        }

        setMessages(msgs);

        // Mark unread messages as read
        msgs.forEach((msg) => {
          if (!msg.readBy?.includes(user.uid)) {
            updateDoc(doc(db, "chats", activeChatId, "messages", msg.id), {
              readBy: [...(msg.readBy || []), user.uid],
            }).catch(() => {});
          }
        });

        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
      },
      (err) => {
        console.error("Chat messages query error:", err);
      }
    );

    // Typing indicator
    const typingUnsub = onSnapshot(doc(db, "chats", activeChatId), (snap) => {
      if (snap.exists()) {
        const typingUsers: Record<string, boolean> = snap.data().typing || {};
        const otherId = activeOtherUser?.id;
        if (otherId) setOtherTyping(!!typingUsers[otherId]);
      }
    });

    // Real-time presence of other user: listen to BOTH users and providers docs live
    let unsubUser = () => {};
    let unsubProvider = () => {};

    if (activeOtherUser?.id && activeOtherUser.id !== "admin") {
      unsubUser = onSnapshot(doc(db, "users", activeOtherUser.id), (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setActiveOtherUser((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              isOnline: d.isOnline ?? prev.isOnline,
              lastSeen: d.lastSeen ?? prev.lastSeen,
              statusMode: (d.statusMode ?? prev.statusMode) as StatusMode,
            };
          });
        }
      });

      unsubProvider = onSnapshot(doc(db, "providers", activeOtherUser.id), (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setActiveOtherUser((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              isOnline: d.isOnline ?? prev.isOnline,
              lastSeen: d.lastSeen ?? prev.lastSeen,
              statusMode: (d.statusMode ?? prev.statusMode) as StatusMode,
            };
          });
        }
      });
    }

    return () => {
      unsub();
      typingUnsub();
      unsubUser();
      unsubProvider();
    };
  }, [activeChatId, user?.uid, activeOtherUser?.id]);

  const handleTyping = (val: string) => {
    setText(val);
    if (!activeChatId || !user?.uid || activeChatId === ADMIN_SUPPORT_CHAT_ID) return;
    if (!typing) {
      setTyping(true);
      updateDoc(doc(db, "chats", activeChatId), { [`typing.${user.uid}`]: true }).catch(() => {});
    }
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }
    typingTimeout.current = setTimeout(() => {
      setTyping(false);
      updateDoc(doc(db, "chats", activeChatId), { [`typing.${user.uid}`]: false }).catch(() => {});
    }, 2000);
  };

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    if (!activeChatId || !user?.uid) return;

    const msgText = text.trim();
    setText("");
    setSending(true);

    try {
      // 1. Admin Support channel
      if (activeChatId === ADMIN_SUPPORT_CHAT_ID) {
        await addDoc(collection(db, "adminChats", user.uid, "messages"), {
          text: msgText,
          sender: "user",
          sentAt: serverTimestamp(),
          read: false,
        });

        await setDoc(
          doc(db, "adminChats", user.uid),
          {
            userId: user.uid,
            userName: user.displayName || user.email?.split("@")[0] || "User",
            userEmail: user.email || "",
            lastMessage: msgText,
            lastMessageAt: serverTimestamp(),
            unreadByAdmin: true,
            unreadByUser: false,
          },
          { merge: true }
        );
        return;
      }

      // 2. Regular user-to-user chat
      await updateDoc(doc(db, "chats", activeChatId), { [`typing.${user.uid}`]: false }).catch(() => {});
      setTyping(false);

      await addDoc(collection(db, "chats", activeChatId, "messages"), {
        senderId: user.uid,
        text: msgText,
        readBy: [user.uid],
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "chats", activeChatId), {
        lastMessage: msgText,
        lastMessageAt: serverTimestamp(),
      });

      if (activeOtherUser?.id) {
        await addDoc(collection(db, "notifications"), {
          userId: activeOtherUser.id,
          title: "💬 New Message",
          message: `${user.displayName || "Someone"}: ${msgText.slice(0, 60)}${msgText.length > 60 ? "..." : ""}`,
          link: "/chat",
          type: "message_new",
          read: false,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  // Upload Pictures and Documents
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!activeChatId || !user?.uid) {
      alert("Please select a conversation before sharing a picture or document.");
      return;
    }

    setUploadingFile(true);
    const isImage = file.type.startsWith("image/");
    setUploadProgressText(isImage ? "Processing picture..." : "Uploading document...");

    try {
      let fileUrl = "";

      // Step A: Attempt Firebase Storage upload
      try {
        const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const storageRef = ref(storage, `chat/${activeChatId}/${Date.now()}_${cleanName}`);
        await uploadBytes(storageRef, file);
        fileUrl = await getDownloadURL(storageRef);
      } catch (storageErr: any) {
        console.warn("Firebase Storage direct upload not available, using resilient fallback:", storageErr?.message);
      }

      // Step B: Guaranteed Fallbacks
      if (!fileUrl) {
        if (isImage) {
          // Image fallback: Client-side canvas compression + ImgBB / compressed Data URL
          setUploadProgressText("Optimizing image preview...");
          const result = await uploadImageWithFallback(file, {
            maxWidth: 1000,
            maxHeight: 1000,
            quality: 0.8,
          });
          fileUrl = result.url;
        } else {
          // Document fallback (PDF, docx, txt, etc.)
          if (file.size > 800 * 1024) {
            alert(
              "Document is larger than 800KB. For large files, please ensure Firebase Storage is enabled in the Firebase console."
            );
            setUploadingFile(false);
            setUploadProgressText("");
            return;
          }

          setUploadProgressText("Reading document...");
          fileUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Unable to read document file"));
            reader.readAsDataURL(file);
          });
        }
      }

      if (!fileUrl) {
        throw new Error("Could not generate file link. Please try again.");
      }

      const fileType = isImage ? "image" : "file";
      const fileName = file.name;
      const previewText = isImage ? "📷 Photo" : `📎 Document: ${file.name}`;

      // Save to active chat
      if (activeChatId === ADMIN_SUPPORT_CHAT_ID) {
        await addDoc(collection(db, "adminChats", user.uid, "messages"), {
          text: previewText,
          fileUrl,
          fileType,
          fileName,
          sender: "user",
          sentAt: serverTimestamp(),
          read: false,
        });

        await setDoc(
          doc(db, "adminChats", user.uid),
          {
            userId: user.uid,
            userName: user.displayName || user.email?.split("@")[0] || "User",
            userEmail: user.email || "",
            lastMessage: previewText,
            lastMessageAt: serverTimestamp(),
            unreadByAdmin: true,
            unreadByUser: false,
          },
          { merge: true }
        );
      } else {
        await addDoc(collection(db, "chats", activeChatId, "messages"), {
          senderId: user.uid,
          text: previewText,
          fileUrl,
          fileType,
          fileName,
          readBy: [user.uid],
          createdAt: serverTimestamp(),
        });

        await updateDoc(doc(db, "chats", activeChatId), {
          lastMessage: previewText,
          lastMessageAt: serverTimestamp(),
        });

        if (activeOtherUser?.id) {
          await addDoc(collection(db, "notifications"), {
            userId: activeOtherUser.id,
            title: isImage ? "📷 Photo Received" : "📎 Document Received",
            message: `${user.displayName || "Someone"} sent you a ${isImage ? "photo" : "document: " + file.name}`,
            link: "/chat",
            type: "message_new",
            read: false,
            createdAt: new Date().toISOString(),
          });
        }
      }
    } catch (err: any) {
      console.error("File upload failed:", err);
      alert(`File send error: ${err?.message || "Please check file and try again."}`);
    } finally {
      setUploadingFile(false);
      setUploadProgressText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const otherPresence = getPresenceInfo(activeOtherUser || undefined);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-secondary-50">
      <Navbar />

      <div className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto px-0 md:px-4 py-0 md:py-4">
        <div
          className="flex flex-1 bg-white rounded-none md:rounded-2xl border border-secondary-200 overflow-hidden shadow-xs"
          style={{ height: "calc(100vh - 100px)" }}
        >
          {/* Conversation List Sidebar */}
          <div
            className={`${
              showConvList ? "flex" : "hidden md:flex"
            } w-full md:w-80 border-r border-secondary-100 flex-col bg-white shrink-0`}
          >
            {/* Sidebar Top: Header + My Status Selector */}
            <div className="p-4 border-b border-secondary-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg text-secondary-900">Messages</h2>
                <p className="text-xs text-secondary-500 mt-0.5">
                  {allConversations.length} conversation{allConversations.length === 1 ? "" : "s"}
                </p>
              </div>

              {/* Status Switcher Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-white border border-secondary-200 shadow-2xs hover:bg-secondary-50 transition-all text-secondary-800"
                  title="Change your online status"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      myStatus === "online"
                        ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                        : myStatus === "dnd"
                        ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                        : "bg-secondary-400"
                    }`}
                  />
                  <span className="capitalize">{myStatus === "dnd" ? "DND" : myStatus}</span>
                  <ChevronDown className="w-3 h-3 text-secondary-400" />
                </button>

                {showStatusMenu && (
                  <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-2xl shadow-xl border border-secondary-100 p-1.5 z-50">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary-400">
                      My Availability
                    </div>
                    <button
                      type="button"
                      onClick={() => setStatusAndBroadcast("online")}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors text-left ${
                        myStatus === "online"
                          ? "bg-emerald-50 text-emerald-800 font-bold"
                          : "hover:bg-secondary-50 text-secondary-700"
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                      <div>
                        <p>Online</p>
                        <span className="text-[10px] text-secondary-400 font-normal">Active & visible</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStatusAndBroadcast("dnd")}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors text-left ${
                        myStatus === "dnd"
                          ? "bg-amber-50 text-amber-800 font-bold"
                          : "hover:bg-secondary-50 text-secondary-700"
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
                      <div>
                        <p>Do Not Disturb</p>
                        <span className="text-[10px] text-secondary-400 font-normal">Busy mode</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStatusAndBroadcast("offline")}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors text-left ${
                        myStatus === "offline"
                          ? "bg-secondary-100 text-secondary-900 font-bold"
                          : "hover:bg-secondary-50 text-secondary-700"
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-secondary-400 shrink-0" />
                      <div>
                        <p>Appear Offline</p>
                        <span className="text-[10px] text-secondary-400 font-normal">Hide status</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {allConversations.length === 0 ? (
                <div className="p-8 text-center text-secondary-400">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-secondary-200" />
                  <p className="font-medium text-sm">No conversations yet</p>
                  <p className="text-xs mt-1">Book a service or contact a provider to start chatting</p>
                </div>
              ) : (
                allConversations.map((conv) => {
                  const isActive = activeChatId === conv.id;
                  const isOfficialSupport = conv.isAdminSupport;
                  const convPresence = getPresenceInfo(conv.otherUser);

                  return (
                    <button
                      key={conv.id}
                      onClick={() => openChat(conv.id, conv.otherUser?.id, conv.otherUser)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-secondary-50 transition-colors text-left relative ${
                        isActive
                          ? "bg-primary-50/80"
                          : isOfficialSupport
                          ? "bg-amber-50/40 hover:bg-amber-50/80"
                          : "hover:bg-secondary-50"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div
                          className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-base overflow-hidden ${
                            isOfficialSupport
                              ? "bg-gradient-to-tr from-amber-600 to-primary-600 text-white shadow-xs"
                              : "bg-gradient-to-br from-primary-500 to-indigo-500 text-white"
                          }`}
                        >
                          {isOfficialSupport ? (
                            <ShieldCheck className="w-6 h-6 text-white" />
                          ) : conv.otherUser?.photo ? (
                            <Image
                              src={conv.otherUser.photo}
                              alt={conv.otherUser.name || "User"}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            (conv.otherUser?.name || "M")[0].toUpperCase()
                          )}
                        </div>

                        {/* Presence Dot Badge */}
                        <span
                          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${convPresence.color}`}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p
                              className={`font-semibold text-sm truncate ${
                                isActive ? "text-primary-800" : "text-secondary-900"
                              }`}
                            >
                              {conv.otherUser?.name || "Member"}
                            </p>
                            {isOfficialSupport && (
                              <span className="text-[9px] font-bold bg-amber-500 text-white px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0">
                                Support
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-secondary-400 shrink-0 ml-1">
                            {formatTime(conv.lastMessageAt)}
                          </span>
                        </div>
                        <p className="text-xs text-secondary-500 truncate">{conv.lastMessage || "No messages yet"}</p>
                      </div>

                      {conv.unreadCount && conv.unreadCount > 0 ? (
                        <span className="w-2.5 h-2.5 bg-primary-600 rounded-full shrink-0" />
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Chat Window */}
          <div className={`${!showConvList ? "flex" : "hidden md:flex"} flex-1 flex-col bg-secondary-50/20`}>
            {!activeChatId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-secondary-400 p-8">
                <MessageSquare className="w-16 h-16 text-secondary-200 mb-3" />
                <h3 className="text-base font-bold text-secondary-700">Select a conversation</h3>
                <p className="text-xs mt-1 text-secondary-500">
                  Choose a chat from the left or message a professional to start messaging.
                </p>
              </div>
            ) : (
              <>
                {/* Chat Top Header */}
                <div className="px-4 py-3 border-b border-secondary-100 flex items-center gap-3 bg-white shadow-2xs">
                  <button
                    onClick={() => setShowConvList(true)}
                    className="md:hidden p-1.5 hover:bg-secondary-100 rounded-lg text-secondary-600"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <div className="relative shrink-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white overflow-hidden ${
                        activeChatId === ADMIN_SUPPORT_CHAT_ID
                          ? "bg-gradient-to-tr from-amber-600 to-primary-600 shadow-xs"
                          : "bg-gradient-to-br from-primary-500 to-indigo-500"
                      }`}
                    >
                      {activeChatId === ADMIN_SUPPORT_CHAT_ID ? (
                        <ShieldCheck className="w-5 h-5 text-white" />
                      ) : activeOtherUser?.photo ? (
                        <Image
                          src={activeOtherUser.photo}
                          alt={activeOtherUser.name || ""}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        (activeOtherUser?.name || "M")[0].toUpperCase()
                      )}
                    </div>
                    {/* Real-time Status Dot Badge */}
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${otherPresence.color}`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-secondary-900 text-sm truncate">
                        {activeOtherUser?.name || "Member"}
                      </p>
                      {activeOtherUser?.isVerified && (
                        <ShieldCheck className="w-4 h-4 text-primary-500 shrink-0" />
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`w-2 h-2 rounded-full ${otherPresence.color}`} />
                      <p className="text-xs font-semibold text-secondary-700">
                        {otherPresence.label}
                      </p>
                      <span className="text-secondary-300">•</span>
                      <p className="text-xs text-secondary-400 capitalize">{activeOtherUser?.role || "Member"}</p>
                    </div>
                  </div>

                  {/* My Status Badge Pill in Header */}
                  <div className="hidden sm:flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowStatusMenu(!showStatusMenu)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-secondary-200 bg-secondary-50 hover:bg-secondary-100 text-secondary-700 transition-colors"
                      title="Set your live presence"
                    >
                      <span className="text-[10px] text-secondary-400">You:</span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          myStatus === "online"
                            ? "bg-emerald-500"
                            : myStatus === "dnd"
                            ? "bg-amber-500"
                            : "bg-secondary-400"
                        }`}
                      />
                      <span className="capitalize">{myStatus === "dnd" ? "DND" : myStatus}</span>
                    </button>
                  </div>

                  {activeOtherUser?.id && activeOtherUser.id !== "admin" && (
                    <a
                      href={`/provider/${activeOtherUser.id}`}
                      target="_blank"
                      className="text-xs font-semibold text-primary-600 hover:underline hidden md:block"
                    >
                      View Profile &rarr;
                    </a>
                  )}
                </div>

                {/* Messages Feed */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3" id="messages-container">
                  <AnimatePresence initial={false}>
                    {messages.map((msg) => {
                      const isMe =
                        msg.sender === "user" ||
                        msg.senderId === user.uid ||
                        (activeChatId === ADMIN_SUPPORT_CHAT_ID && msg.sender !== "admin");

                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[75%] sm:max-w-[65%] ${
                              isMe ? "items-end" : "items-start"
                            } flex flex-col gap-1`}
                          >
                            {/* PICTURE MESSAGE */}
                            {msg.fileType === "image" && msg.fileUrl ? (
                              <div
                                className={`rounded-2xl overflow-hidden border border-secondary-200/60 bg-white p-1.5 shadow-xs ${
                                  isMe ? "rounded-br-xs" : "rounded-bl-xs"
                                }`}
                              >
                                <a
                                  href={msg.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download={msg.fileName || "photo"}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={msg.fileUrl}
                                    alt={msg.fileName || "Shared photo"}
                                    className="max-w-[280px] max-h-[260px] object-cover rounded-xl hover:opacity-95 transition-opacity"
                                  />
                                </a>
                                <div className="mt-1 px-1 flex items-center justify-between">
                                  <span className="text-[10px] text-secondary-400 truncate max-w-[160px]">
                                    {msg.fileName || "Photo"}
                                  </span>
                                  <a
                                    href={msg.fileUrl}
                                    download={msg.fileName || "photo"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-primary-600 font-semibold hover:underline flex items-center gap-1"
                                  >
                                    <Download className="w-3 h-3" /> Save
                                  </a>
                                </div>
                              </div>
                            ) : msg.fileType === "file" && msg.fileUrl ? (
                              /* DOCUMENT MESSAGE */
                              <a
                                href={msg.fileUrl}
                                download={msg.fileName || "document"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-medium transition-all shadow-xs ${
                                  isMe
                                    ? "bg-primary-600 text-white rounded-br-xs hover:bg-primary-700"
                                    : "bg-white text-secondary-900 border border-secondary-200 rounded-bl-xs hover:bg-secondary-50"
                                }`}
                              >
                                <div
                                  className={`p-2 rounded-xl ${
                                    isMe ? "bg-white/20 text-white" : "bg-primary-50 text-primary-600"
                                  }`}
                                >
                                  <FileText className="w-5 h-5 shrink-0" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold truncate max-w-[180px]">
                                    {msg.fileName || "Document"}
                                  </p>
                                  <span className="text-[10px] opacity-75">Click to view / download</span>
                                </div>
                                <Download className="w-4 h-4 shrink-0 opacity-80" />
                              </a>
                            ) : (
                              /* TEXT MESSAGE */
                              <div
                                className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                                  isMe
                                    ? "bg-primary-600 text-white rounded-br-xs"
                                    : "bg-white text-secondary-800 border border-secondary-200/80 rounded-bl-xs"
                                }`}
                              >
                                {msg.text}
                              </div>
                            )}

                            {/* Status & Timestamp */}
                            <div className={`flex items-center gap-1 px-1 ${isMe ? "justify-end" : "justify-start"}`}>
                              <span className="text-[10px] text-secondary-400">
                                {formatTime(msg.createdAt || msg.sentAt)}
                              </span>
                              {isMe && <CheckCheck className="w-3 h-3 text-primary-500" />}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {/* Typing Indicator */}
                  {otherTyping && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-secondary-200 rounded-2xl rounded-bl-xs px-3.5 py-2 flex items-center gap-1 shadow-2xs">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="w-1.5 h-1.5 bg-secondary-400 rounded-full"
                            animate={{ y: [0, -4, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Upload Status Banner */}
                {uploadingFile && (
                  <div className="px-4 py-2 bg-primary-50 border-t border-primary-100 flex items-center gap-2 text-xs text-primary-700">
                    <div className="w-3.5 h-3.5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                    <span className="font-medium">{uploadProgressText || "Sending file..."}</span>
                  </div>
                )}

                {/* Bottom Input Box */}
                <form
                  onSubmit={sendMessage}
                  className="p-3 border-t border-secondary-200/80 flex items-end gap-2 bg-white"
                >
                  {/* Hidden File Picker */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.csv"
                    onChange={handleFileUpload}
                  />

                  {/* Paperclip Button for Pictures & Documents */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeChatId) {
                        alert("Please select a conversation first.");
                        return;
                      }
                      fileInputRef.current?.click();
                    }}
                    disabled={uploadingFile}
                    className="p-2.5 rounded-xl hover:bg-secondary-100 text-secondary-500 hover:text-secondary-800 transition-colors shrink-0 disabled:opacity-50"
                    title="Send a Picture or Document"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  {/* Message Input */}
                  <textarea
                    id="chat-message-input"
                    value={text}
                    onChange={(e) => handleTyping(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder={`Type a message to ${activeOtherUser?.name || "recipient"}...`}
                    rows={1}
                    className="flex-1 resize-none bg-secondary-50 border border-secondary-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 min-h-[42px] max-h-32 text-secondary-900"
                  />

                  {/* Send Button */}
                  <button
                    id="send-message-btn"
                    type="submit"
                    disabled={!text.trim() || sending}
                    className="p-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-xs"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ChatPage />
    </Suspense>
  );
}
