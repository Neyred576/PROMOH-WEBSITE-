"use client";

import React, { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
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
import { Input } from "@/components/ui/Input";
import { Tag, Trash2, ToggleLeft, ToggleRight, Plus, Ticket } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PromoCode {
  id: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  applicableTo: "all" | "customers" | "new_users";
  isActive: boolean;
  createdAt: unknown;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

function statusLabel(code: PromoCode): { label: string; className: string } {
  if (isExpired(code.expiresAt)) {
    return { label: "Expired", className: "bg-orange-100 text-orange-700" };
  }
  if (!code.isActive) {
    return { label: "Disabled", className: "bg-secondary-100 text-secondary-500" };
  }
  return { label: "Active", className: "bg-green-100 text-green-700" };
}

function discountLabel(code: PromoCode): string {
  if (code.discountType === "percentage") return `${code.discountValue}% OFF`;
  return `$${code.discountValue} OFF`;
}

function usageLabel(code: PromoCode): string {
  if (code.maxUses === 0) return `${code.usedCount} / ∞ used`;
  return `${code.usedCount} / ${code.maxUses} used`;
}

function usagePct(code: PromoCode): number {
  if (code.maxUses === 0) return 0;
  return Math.min(100, Math.round((code.usedCount / code.maxUses) * 100));
}

function applicableLabel(val: string): string {
  if (val === "customers") return "Customers Only";
  if (val === "new_users") return "New Users Only";
  return "All Users";
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validateForm(form: {
  code: string;
  discountType: string;
  discountValue: string;
  maxUses: string;
  expiresAt: string;
  applicableTo: string;
}): string | null {
  const codeRegex = /^[A-Z0-9-]{3,20}$/;
  if (!codeRegex.test(form.code)) {
    return "Code must be 3–20 characters: uppercase letters, numbers, and hyphens only.";
  }
  const val = parseFloat(form.discountValue);
  if (isNaN(val) || val <= 0) {
    return "Discount value must be greater than 0.";
  }
  if (form.discountType === "percentage" && (val < 1 || val > 100)) {
    return "Percentage discount must be between 1 and 100.";
  }
  const maxUses = parseInt(form.maxUses, 10);
  if (isNaN(maxUses) || maxUses < 0) {
    return "Max uses must be 0 (unlimited) or a positive number.";
  }
  return null;
}

// ─── Default form state ───────────────────────────────────────────────────────

const defaultForm = {
  code: "",
  discountType: "percentage",
  discountValue: "",
  maxUses: "0",
  expiresAt: "",
  applicableTo: "all",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminPromoCodes() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Live listener
  useEffect(() => {
    const q = query(collection(db, "promo_codes"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setCodes(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<PromoCode, "id">),
        }))
      );
    });
    return () => unsub();
  }, []);

  // ── Create ────────────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const err = validateForm(form);
    if (err) {
      setFormError(err);
      return;
    }
    setCreating(true);
    try {
      await addDoc(collection(db, "promo_codes"), {
        code: form.code,
        discountType: form.discountType,
        discountValue: parseFloat(form.discountValue),
        maxUses: parseInt(form.maxUses, 10),
        usedCount: 0,
        expiresAt: form.expiresAt || null,
        applicableTo: form.applicableTo,
        isActive: true,
        createdAt: serverTimestamp(),
      });
      setForm(defaultForm);
    } catch (err) {
      console.error("Error creating promo code:", err);
      setFormError("Failed to create promo code. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  // ── Toggle active ─────────────────────────────────────────────────────────

  async function handleToggle(code: PromoCode) {
    setTogglingId(code.id);
    try {
      await updateDoc(doc(db, "promo_codes", code.id), {
        isActive: !code.isActive,
      });
    } catch (err) {
      console.error("Error toggling promo code:", err);
    } finally {
      setTogglingId(null);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(code: PromoCode) {
    if (
      !window.confirm(
        `Delete promo code "${code.code}"? This cannot be undone.`
      )
    )
      return;
    setDeletingId(code.id);
    try {
      await deleteDoc(doc(db, "promo_codes", code.id));
    } catch (err) {
      console.error("Error deleting promo code:", err);
    } finally {
      setDeletingId(null);
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  const activeCodes = codes.filter((c) => c.isActive && !isExpired(c.expiresAt));
  const expiredCodes = codes.filter((c) => isExpired(c.expiresAt));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-xl">
                <Ticket className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-secondary-900">{activeCodes.length}</p>
                <p className="text-sm text-secondary-500">Active Codes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-xl">
                <Ticket className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-secondary-900">{expiredCodes.length}</p>
                <p className="text-sm text-secondary-500">Expired Codes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-xl">
                <Tag className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-secondary-900">{codes.length}</p>
                <p className="text-sm text-secondary-500">Total Codes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary-600" />
            Create Promo Code
          </CardTitle>
          <CardDescription>
            Add a new discount code for customers. Codes are case-insensitive on input but stored uppercase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Code */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-secondary-700">
                  Promo Code <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="e.g. LAUNCH20"
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      code: e.target.value.toUpperCase().replace(/\s/g, ""),
                    }))
                  }
                  maxLength={20}
                  required
                />
                <p className="text-xs text-secondary-400">Letters, numbers, hyphens. 3–20 chars.</p>
              </div>

              {/* Discount Type */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-secondary-700">
                  Discount Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.discountType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, discountType: e.target.value }))
                  }
                  className="flex h-12 w-full rounded-xl border border-secondary-300 bg-transparent px-4 py-2 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:border-primary-500 focus-visible:ring-primary-500/20 hover:border-secondary-400"
                >
                  <option value="percentage">Percentage %</option>
                  <option value="fixed">Fixed Amount $</option>
                </select>
              </div>

              {/* Discount Value */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-secondary-700">
                  Discount Value <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  placeholder={form.discountType === "percentage" ? "e.g. 20" : "e.g. 10"}
                  value={form.discountValue}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, discountValue: e.target.value }))
                  }
                  min={1}
                  max={form.discountType === "percentage" ? 100 : undefined}
                  step="0.01"
                  required
                />
                <p className="text-xs text-secondary-400">
                  {form.discountType === "percentage" ? "1–100%" : "Dollar amount off"}
                </p>
              </div>

              {/* Max Uses */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-secondary-700">Max Uses</label>
                <Input
                  type="number"
                  placeholder="0 = unlimited"
                  value={form.maxUses}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, maxUses: e.target.value }))
                  }
                  min={0}
                />
                <p className="text-xs text-secondary-400">Set to 0 for unlimited uses.</p>
              </div>

              {/* Expires At */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-secondary-700">Expires At (optional)</label>
                <Input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, expiresAt: e.target.value }))
                  }
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>

              {/* Applicable To */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-secondary-700">Applicable To</label>
                <select
                  value={form.applicableTo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, applicableTo: e.target.value }))
                  }
                  className="flex h-12 w-full rounded-xl border border-secondary-300 bg-transparent px-4 py-2 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:border-primary-500 focus-visible:ring-primary-500/20 hover:border-secondary-400"
                >
                  <option value="all">All Users</option>
                  <option value="customers">Customers Only</option>
                  <option value="new_users">New Users Only</option>
                </select>
              </div>
            </div>

            {formError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" isLoading={creating} className="gap-2">
                <Plus className="w-4 h-4" />
                Create Promo Code
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Code List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-primary-600" />
            All Promo Codes
            <span className="ml-2 text-sm font-normal text-secondary-500">({codes.length})</span>
          </CardTitle>
          <CardDescription>Manage existing discount codes.</CardDescription>
        </CardHeader>
        <CardContent>
          {codes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Ticket className="w-12 h-12 text-secondary-300 mb-3" />
              <p className="text-secondary-500 font-medium">No promo codes yet</p>
              <p className="text-secondary-400 text-sm">Create your first discount code above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {codes.map((code) => {
                const status = statusLabel(code);
                const pct = usagePct(code);
                return (
                  <div
                    key={code.id}
                    className="rounded-xl border border-secondary-200 p-4 hover:border-secondary-300 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* Left: Code + discount */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {/* Code badge */}
                          <span className="font-mono font-bold text-base bg-primary-50 text-primary-700 border border-primary-200 rounded-lg px-3 py-0.5">
                            {code.code}
                          </span>
                          {/* Discount badge */}
                          <span className="text-sm font-semibold bg-secondary-100 text-secondary-700 rounded-full px-3 py-0.5">
                            {discountLabel(code)}
                          </span>
                          {/* Status badge */}
                          <span
                            className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-secondary-500 mt-1">
                          <span>🎯 {applicableLabel(code.applicableTo)}</span>
                          {code.expiresAt && (
                            <span>
                              📅 Expires{" "}
                              {new Date(code.expiresAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          )}
                        </div>

                        {/* Usage + progress bar */}
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-secondary-500">{usageLabel(code)}</span>
                            {code.maxUses > 0 && (
                              <span className="text-xs text-secondary-400">{pct}%</span>
                            )}
                          </div>
                          {code.maxUses > 0 && (
                            <div className="h-1.5 w-full bg-secondary-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  pct >= 90
                                    ? "bg-red-500"
                                    : pct >= 60
                                    ? "bg-orange-400"
                                    : "bg-primary-500"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Toggle active */}
                        <Button
                          variant="outline"
                          size="sm"
                          isLoading={togglingId === code.id}
                          onClick={() => handleToggle(code)}
                          className="gap-1.5 text-xs"
                          title={code.isActive ? "Disable code" : "Enable code"}
                        >
                          {code.isActive ? (
                            <>
                              <ToggleRight className="w-4 h-4 text-green-600" />
                              Active
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-4 h-4 text-secondary-400" />
                              Inactive
                            </>
                          )}
                        </Button>

                        {/* Delete */}
                        <Button
                          variant="danger"
                          size="sm"
                          isLoading={deletingId === code.id}
                          onClick={() => handleDelete(code)}
                          className="gap-1.5 text-xs"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </Button>
                      </div>
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
