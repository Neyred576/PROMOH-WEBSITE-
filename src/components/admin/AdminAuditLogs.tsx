"use client";

import React, { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  Clock,
  User,
  Briefcase,
  AlertTriangle,
  FileText,
  DollarSign,
  Download,
} from "lucide-react";
import { AdminAuditLog, AdminActionType } from "@/lib/adminLogger";

function parseLogTime(val: any): string {
  if (!val) return "Just now";
  if (typeof val === "object" && "seconds" in val) {
    return new Date(val.seconds * 1000).toLocaleString();
  }
  return new Date(val).toLocaleString();
}

function getActionBadge(action: AdminActionType) {
  switch (action) {
    case "PROVIDER_APPROVED":
      return { bg: "bg-green-100 text-green-800 border-green-200", label: "Approved Provider" };
    case "PROVIDER_REJECTED":
      return { bg: "bg-red-100 text-red-800 border-red-200", label: "Rejected Provider" };
    case "USER_BANNED":
      return { bg: "bg-rose-100 text-rose-800 border-rose-200", label: "Banned User" };
    case "USER_UNBANNED":
      return { bg: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "Unbanned User" };
    case "USER_DELETED":
      return { bg: "bg-neutral-100 text-neutral-800 border-neutral-200", label: "Deleted Account" };
    case "DISPUTE_REFUNDED":
      return { bg: "bg-purple-100 text-purple-800 border-purple-200", label: "Dispute Refunded" };
    case "DISPUTE_RELEASED":
      return { bg: "bg-blue-100 text-blue-800 border-blue-200", label: "Dispute Released" };
    case "NOTIFICATION_BROADCAST":
      return { bg: "bg-sky-100 text-sky-800 border-sky-200", label: "Broadcast Push" };
    case "REVIEW_DELETED":
      return { bg: "bg-amber-100 text-amber-800 border-amber-200", label: "Deleted Review" };
    case "SETTINGS_UPDATED":
      return { bg: "bg-indigo-100 text-indigo-800 border-indigo-200", label: "Settings Changed" };
    default:
      return { bg: "bg-secondary-100 text-secondary-800 border-secondary-200", label: action.replace("_", " ") };
  }
}

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const q = query(
      collection(db, "admin_audit_logs"),
      orderBy("timestamp", "desc"),
      limit(100)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as AdminAuditLog)
        );
        setLogs(list);
        setLoading(false);
      },
      (err) => {
        console.error("Audit logs error:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (filter !== "all" && log.action !== filter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      log.details?.toLowerCase().includes(q) ||
      log.targetName?.toLowerCase().includes(q) ||
      log.targetId?.toLowerCase().includes(q) ||
      log.action?.toLowerCase().includes(q)
    );
  });

  const exportAuditCSV = () => {
    const headers = ["Timestamp", "Action", "Admin", "Target Type", "Target ID", "Target Name", "Details"];
    const rows = filteredLogs.map((l) => [
      `"${parseLogTime(l.timestamp)}"`,
      `"${l.action}"`,
      `"${l.adminEmail || "Admin"}"`,
      `"${l.targetType || ""}"`,
      `"${l.targetId || ""}"`,
      `"${l.targetName || ""}"`,
      `"${(l.details || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `promoh_audit_logs_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-secondary-200 bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-secondary-500">
                Total Audit Events
              </p>
              <h3 className="text-2xl font-black text-secondary-900 mt-1">{logs.length}</h3>
              <p className="text-[11px] text-secondary-500 mt-0.5">Logged administrative actions</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-primary-700">
              <FileText className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/40">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-green-800">
                Integrity & Compliance
              </p>
              <h3 className="text-2xl font-black text-green-950 mt-1">100% Tracked</h3>
              <p className="text-[11px] text-green-700 mt-0.5">Immutable audit trail</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-green-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-secondary-200 bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-secondary-500">
                Export Reports
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={exportAuditCSV}
                className="mt-2 text-xs font-semibold gap-1.5 h-8"
              >
                <Download className="w-3.5 h-3.5" /> Download CSV
              </Button>
            </div>
            <div className="w-10 h-10 rounded-xl bg-secondary-100 flex items-center justify-center text-secondary-600">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Logs Table */}
      <Card className="border-secondary-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-secondary-50/50 border-b border-secondary-100 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-primary-600" />
                Administrative Action Audit Ledger
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time security trail recording every user ban, approval, payout, dispute, and configuration change.
              </CardDescription>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-secondary-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by target, details..."
                  className="w-full h-9 pl-9 pr-3 rounded-xl border border-secondary-200 text-xs bg-white text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>

              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-9 px-3 text-xs font-semibold rounded-xl border border-secondary-200 bg-white text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="all">All Actions</option>
                <option value="PROVIDER_APPROVED">Approvals</option>
                <option value="PROVIDER_REJECTED">Rejections</option>
                <option value="USER_BANNED">Bans</option>
                <option value="USER_UNBANNED">Unbans</option>
                <option value="DISPUTE_REFUNDED">Refunds</option>
                <option value="DISPUTE_RELEASED">Releases</option>
                <option value="NOTIFICATION_BROADCAST">Broadcasts</option>
                <option value="REVIEW_DELETED">Reviews Moderated</option>
                <option value="SETTINGS_UPDATED">Settings Updated</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-xs text-secondary-400">Loading audit trail...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-xs text-secondary-400">
              No audit logs found matching criteria.
            </div>
          ) : (
            <div className="divide-y divide-secondary-100 max-h-[600px] overflow-y-auto">
              {filteredLogs.map((log) => {
                const badge = getActionBadge(log.action);
                return (
                  <div
                    key={log.id}
                    className="p-4 hover:bg-secondary-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${badge.bg}`}
                        >
                          {badge.label}
                        </span>
                        {log.targetName && (
                          <span className="font-bold text-secondary-900 truncate">
                            Target: {log.targetName}
                          </span>
                        )}
                        {log.targetId && (
                          <span className="text-[10px] font-mono text-secondary-400">
                            ({log.targetId.slice(0, 10)})
                          </span>
                        )}
                      </div>
                      <p className="text-secondary-700 text-xs leading-relaxed">{log.details}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] text-secondary-500 font-medium block">
                        {parseLogTime(log.timestamp)}
                      </span>
                      <span className="text-[10px] text-secondary-400 font-mono">
                        {log.adminEmail || "superadmin@promoh.com"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
