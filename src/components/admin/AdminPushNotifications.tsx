"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { db } from "@/lib/firebase/client";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";

type AudienceType =
  | "All Users"
  | "Customers Only"
  | "Providers Only"
  | "Specific User by Email";

interface Broadcast {
  id: string;
  title: string;
  message: string;
  audience: AudienceType;
  sentAt: Timestamp | null;
  sentCount: number;
}

function formatDate(val: Timestamp | null | undefined): string {
  if (!val) return "—";
  try {
    if (typeof val === "object" && "seconds" in val) {
      return new Date(val.seconds * 1000).toLocaleString();
    }
    return new Date(val as unknown as string).toLocaleString();
  } catch {
    return "—";
  }
}

export default function AdminPushNotifications() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<AudienceType>("All Users");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);

  // Live broadcast log
  useEffect(() => {
    const q = query(
      collection(db, "notification_broadcasts"),
      orderBy("sentAt", "desc"),
      limit(10)
    );
    const unsub = onSnapshot(q, (snap) => {
      setBroadcasts(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Broadcast, "id">) }))
      );
    });
    return () => unsub();
  }, []);

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      showToast("error", "Title and message are required.");
      return;
    }

    setSending(true);
    try {
      let targetUserIds: string[] = [];
      let sentCount = 0;

      if (audience === "All Users") {
        const snap = await getDocs(collection(db, "users"));
        targetUserIds = snap.docs.map((d) => d.id);
      } else if (audience === "Customers Only") {
        const snap = await getDocs(collection(db, "users"));
        targetUserIds = snap.docs
          .filter((d) => (d.data() as { role?: string }).role !== "provider")
          .map((d) => d.id);
      } else if (audience === "Providers Only") {
        const snap = await getDocs(collection(db, "providers"));
        targetUserIds = snap.docs.map((d) => d.id);
      } else if (audience === "Specific User by Email") {
        if (!email.trim()) {
          showToast("error", "Please enter an email address.");
          setSending(false);
          return;
        }
        const q = query(collection(db, "users"), where("email", "==", email.trim()));
        const snap = await getDocs(q);
        if (snap.empty) {
          showToast("error", `No user found with email: ${email.trim()}`);
          setSending(false);
          return;
        }
        targetUserIds = snap.docs.map((d) => d.id);
      }

      // Write individual notifications
      await Promise.all(
        targetUserIds.map((userId) =>
          addDoc(collection(db, "notifications"), {
            userId,
            title: title.trim(),
            message: message.trim(),
            link: link.trim() || null,
            read: false,
            createdAt: serverTimestamp(),
          })
        )
      );

      sentCount = targetUserIds.length;

      // Log the broadcast
      await addDoc(collection(db, "notification_broadcasts"), {
        title: title.trim(),
        message: message.trim(),
        audience,
        sentAt: serverTimestamp(),
        sentCount,
      });

      showToast("success", `Notification sent to ${sentCount} user(s).`);
      setTitle("");
      setMessage("");
      setEmail("");
      setLink("");
    } catch (err) {
      console.error(err);
      showToast("error", "Failed to send notifications. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            toast.type === "success"
              ? "bg-green-100 text-green-800 border border-green-300"
              : "bg-red-100 text-red-800 border border-red-300"
          }`}
        >
          {toast.type === "success" ? "✅ " : "❌ "}
          {toast.text}
        </div>
      )}

      {/* Send Form */}
      <Card>
        <CardHeader>
          <CardTitle>Send Push Notification</CardTitle>
          <CardDescription>
            Broadcast a real-time notification to users on the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSend} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notification Title <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. New Feature Available!"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={sending}
                required
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 resize-none"
                rows={4}
                placeholder="Write your notification message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={sending}
                required
              />
            </div>

            {/* Audience */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Audience
              </label>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
                value={audience}
                onChange={(e) => setAudience(e.target.value as AudienceType)}
                disabled={sending}
              >
                <option value="All Users">All Users</option>
                <option value="Customers Only">Customers Only</option>
                <option value="Providers Only">Providers Only</option>
                <option value="Specific User by Email">Specific User by Email</option>
              </select>
            </div>

            {/* Specific email */}
            {audience === "Specific User by Email" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User Email <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={sending}
                />
              </div>
            )}

            {/* Optional link */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Link <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. /dashboard or /profile"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                disabled={sending}
              />
            </div>

            <Button type="submit" disabled={sending} className="w-full sm:w-auto">
              {sending ? "Sending…" : "Send Notification"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Sent Notifications Log */}
      <Card>
        <CardHeader>
          <CardTitle>Sent Notifications Log</CardTitle>
          <CardDescription>Last 10 broadcasts sent from this panel.</CardDescription>
        </CardHeader>
        <CardContent>
          {broadcasts.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">
              No notifications sent yet.
            </p>
          ) : (
            <div className="space-y-3">
              {broadcasts.map((b) => (
                <div
                  key={b.id}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900 truncate">
                        {b.title}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 font-medium">
                        {b.audience}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{b.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(b.sentAt)}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 text-xs px-2 py-0.5 font-medium whitespace-nowrap">
                      {b.sentCount} sent
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
