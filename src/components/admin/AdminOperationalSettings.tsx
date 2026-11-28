"use client";

import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
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
  Settings,
  Percent,
  AlertTriangle,
  DollarSign,
  ShieldAlert,
  Save,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  Mail,
  Phone,
  Trash2,
} from "lucide-react";
import { logAdminAction } from "@/lib/adminLogger";

interface AdminOperationalSettingsProps {
  onTriggerPurgeUsers?: () => void;
}

export default function AdminOperationalSettings({ onTriggerPurgeUsers }: AdminOperationalSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState({
    commissionRate: 10,
    maintenanceMode: false,
    maintenanceMessage: "Promoh is currently undergoing brief scheduled maintenance. New bookings will resume shortly.",
    defaultCurrency: "USD",
    minBookingAmount: 15,
    autoApproveProviders: false,
    supportEmail: "promoh321@gmail.com",
    supportPhone: "+1 (800) 555-0199",
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const snap = await getDoc(doc(db, "platform_settings", "operations"));
        if (snap.exists()) {
          const data = snap.data();
          setForm((prev) => ({
            ...prev,
            ...data,
          }));
        }
      } catch (err) {
        console.error("Failed to load operations settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(
        doc(db, "platform_settings", "operations"),
        {
          ...form,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      await logAdminAction(
        "SETTINGS_UPDATED",
        `Updated operational parameters: Commission=${form.commissionRate}%, Maintenance=${form.maintenanceMode ? "ON" : "OFF"}, MinBooking=$${form.minBookingAmount}`,
        { type: "settings" }
      );

      setMsg("✅ Operational settings saved and active live across platform!");
      setTimeout(() => setMsg(""), 4000);
    } catch (err) {
      console.error("Save error:", err);
      setMsg("Error saving settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-xs text-secondary-400 text-center">Loading platform operations...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {msg && (
        <div className="p-3 bg-primary-50 border border-primary-200 text-primary-800 text-xs font-semibold rounded-xl">
          {msg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Marketplace Commission & Economics */}
        <Card className="border-secondary-200 shadow-sm">
          <CardHeader className="bg-secondary-50/50 border-b border-secondary-100">
            <CardTitle className="text-base flex items-center gap-2">
              <Percent className="w-5 h-5 text-primary-600" />
              Platform Economics & Revenue Share
            </CardTitle>
            <CardDescription className="text-xs">
              Configure marketplace monetization fee retained by Promoh on completed customer bookings.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-secondary-800">
                  Platform Commission Fee (%)
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="50"
                    value={form.commissionRate}
                    onChange={(e) => setForm({ ...form, commissionRate: Number(e.target.value) })}
                    className="pr-8 text-sm"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-secondary-400">%</span>
                </div>
                <p className="text-[11px] text-secondary-500">
                  e.g., 10% means provider keeps 90% and Promoh receives 10% on each job.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-secondary-800">
                  Minimum Job Booking Amount ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-secondary-400">$</span>
                  <Input
                    type="number"
                    min="5"
                    value={form.minBookingAmount}
                    onChange={(e) => setForm({ ...form, minBookingAmount: Number(e.target.value) })}
                    className="pl-7 text-sm"
                  />
                </div>
                <p className="text-[11px] text-secondary-500">
                  Prevents orders below platform processing fees.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Maintenance Mode & Safety Controls */}
        <Card className="border-secondary-200 shadow-sm">
          <CardHeader className="bg-secondary-50/50 border-b border-secondary-100">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              System Maintenance & Platform Guardrails
            </CardTitle>
            <CardDescription className="text-xs">
              Emergency site-wide maintenance toggles and provider verification rules.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            {/* Maintenance Mode Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-secondary-200 bg-secondary-50/50">
              <div>
                <h4 className="font-bold text-sm text-secondary-900">Platform Maintenance Mode</h4>
                <p className="text-xs text-secondary-500 mt-0.5">
                  Displays an emergency banner at the top of the homepage and temporarily pauses new booking checkouts.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, maintenanceMode: !form.maintenanceMode })}
                className="text-secondary-700 hover:text-primary-600 transition-colors"
              >
                {form.maintenanceMode ? (
                  <ToggleRight className="w-9 h-9 text-amber-500" />
                ) : (
                  <ToggleLeft className="w-9 h-9 text-secondary-300" />
                )}
              </button>
            </div>

            {form.maintenanceMode && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-amber-900">
                  Custom Maintenance Banner Message
                </label>
                <textarea
                  value={form.maintenanceMessage}
                  onChange={(e) => setForm({ ...form, maintenanceMessage: e.target.value })}
                  rows={2}
                  className="w-full text-xs p-3 rounded-xl border border-amber-300 bg-amber-50/50 text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            )}

            {/* Provider Auto-Approval Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-secondary-200 bg-secondary-50/50">
              <div>
                <h4 className="font-bold text-sm text-secondary-900">Provider Verification Requirement</h4>
                <p className="text-xs text-secondary-500 mt-0.5">
                  When enabled, all new providers must be reviewed and manually approved by admin before appearing in search.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, autoApproveProviders: !form.autoApproveProviders })}
                className="text-secondary-700 hover:text-primary-600 transition-colors"
              >
                {!form.autoApproveProviders ? (
                  <ToggleRight className="w-9 h-9 text-green-600" />
                ) : (
                  <ToggleLeft className="w-9 h-9 text-secondary-300" />
                )}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Global Support Contact Channels */}
        <Card className="border-secondary-200 shadow-sm">
          <CardHeader className="bg-secondary-50/50 border-b border-secondary-100">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary-600" />
              Official Support Contact Endpoints
            </CardTitle>
            <CardDescription className="text-xs">
              Displayed on customer email confirmations, provider payouts, and help cards.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-secondary-800">Support Email Address</label>
                <Input
                  type="email"
                  value={form.supportEmail}
                  onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-secondary-800">Support Phone Number</label>
                <Input
                  type="text"
                  value={form.supportPhone}
                  onChange={(e) => setForm({ ...form, supportPhone: e.target.value })}
                  className="text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Bar */}
        <div className="flex justify-end pt-2">
          <Button type="submit" isLoading={saving} className="font-bold text-xs h-10 px-6 gap-2">
            <Save className="w-4 h-4" /> Save Operational Rules
          </Button>
        </div>
      </form>

      {/* Danger Zone: Purge All Users & Profiles */}
      {onTriggerPurgeUsers && (
        <Card className="border-rose-300 shadow-sm bg-rose-50/40 overflow-hidden">
          <CardHeader className="bg-rose-100/50 border-b border-rose-200">
            <CardTitle className="text-base flex items-center gap-2 text-rose-950 font-bold">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              Danger Zone: Purge Platform Directory
            </CardTitle>
            <CardDescription className="text-xs text-rose-700">
              Permanently delete all registered provider and customer records, bookings, and associated data. Requires admin master password.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-secondary-900">Delete Every Provider & Customer</p>
              <p className="text-[11px] text-secondary-500 mt-1 max-w-lg leading-relaxed">
                This will trigger a full database wipe of all customer accounts, provider portfolios, bookings, and chats while preserving the administrator account.
              </p>
            </div>
            <Button
              type="button"
              variant="danger"
              onClick={onTriggerPurgeUsers}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shrink-0 gap-1.5 cursor-pointer shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete All Providers & Customers
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
