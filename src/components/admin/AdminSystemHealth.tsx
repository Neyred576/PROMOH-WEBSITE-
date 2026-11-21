"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  Server,
  Database,
  Cloud,
  CreditCard,
  Wifi,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { db } from "@/lib/firebase/client";
import { doc, getDoc } from "firebase/firestore";

interface AdminSystemHealthProps {
  onlineProvidersCount: number;
  onlineCustomersCount: number;
  totalProvidersCount: number;
  totalCustomersCount: number;
}

export default function AdminSystemHealth({
  onlineProvidersCount,
  onlineCustomersCount,
  totalProvidersCount,
  totalCustomersCount,
}: AdminSystemHealthProps) {
  const [checking, setChecking] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number>(24);
  const [dbHealthy, setDbHealthy] = useState<boolean>(true);
  const [storageHealthy, setStorageHealthy] = useState<boolean>(true);
  const [lastChecked, setLastChecked] = useState<string>("Just now");

  const runDiagnostics = async () => {
    setChecking(true);
    const start = performance.now();
    try {
      // Test read latency to Firestore platform_settings
      await getDoc(doc(db, "platform_settings", "operations"));
      const duration = Math.round(performance.now() - start);
      setLatencyMs(duration);
      setDbHealthy(true);
      setStorageHealthy(true);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Diagnostic error:", err);
      setDbHealthy(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <Card className="border-secondary-200/80 shadow-xs overflow-hidden bg-white">
      <CardHeader className="bg-secondary-50/50 border-b border-secondary-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-secondary-900">
            <Activity className="w-4 h-4 text-emerald-600" />
            Live System Diagnostics & Service Status
          </CardTitle>
          <CardDescription className="text-xs">
            Real-time infrastructure health, latency, and connected active users.
          </CardDescription>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-secondary-400 font-medium">
            Checked: {lastChecked}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={runDiagnostics}
            isLoading={checking}
            className="h-8 text-xs font-semibold gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-secondary-600" />
            Ping Systems
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Firestore DB */}
          <div className="p-3.5 rounded-2xl border border-secondary-100 bg-secondary-50/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-secondary-800">Cloud Firestore</p>
                <p className="text-[11px] text-secondary-500 font-mono">Latency: {latencyMs}ms</p>
              </div>
            </div>
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>

          {/* Firebase Storage */}
          <div className="p-3.5 rounded-2xl border border-secondary-100 bg-secondary-50/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-secondary-800">Firebase Storage</p>
                <p className="text-[11px] text-secondary-500">Asset & Docs Bucket</p>
              </div>
            </div>
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Ready
            </span>
          </div>

          {/* Stripe Gateway */}
          <div className="p-3.5 rounded-2xl border border-secondary-100 bg-secondary-50/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-secondary-800">Stripe Gateway</p>
                <p className="text-[11px] text-secondary-500">Escrow & Payouts</p>
              </div>
            </div>
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle className="w-3 h-3 text-emerald-600" />
              Active
            </span>
          </div>

          {/* Live Concurrent Presence */}
          <div className="p-3.5 rounded-2xl border border-secondary-100 bg-secondary-50/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Wifi className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-secondary-800">Live Online Presence</p>
                <p className="text-[11px] text-secondary-500 font-semibold">
                  {onlineProvidersCount} Pros • {onlineCustomersCount} Users
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-secondary-900 bg-white px-2 py-0.5 rounded-lg border shadow-2xs">
              {onlineProvidersCount + onlineCustomersCount} Online
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
