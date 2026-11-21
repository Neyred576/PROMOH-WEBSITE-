"use client";

import React, { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  doc,
  deleteDoc,
  getDocs,
  query,
  where,
  updateDoc,
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
  Star,
  Trash2,
  Search,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  ShieldAlert,
} from "lucide-react";
import { logAdminAction } from "@/lib/adminLogger";

interface ReviewItem {
  id: string;
  providerId: string;
  providerName?: string;
  customerId: string;
  customerName: string;
  rating: number;
  comment: string;
  createdAt?: string;
}

export default function AdminReviewModeration() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState<number | "all">("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const showMsg = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(""), 3500);
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "reviews"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReviewItem));
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setReviews(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleDeleteReview = async (review: ReviewItem) => {
    if (!confirm(`Delete review from "${review.customerName}"? This will recalculate the provider's rating.`)) return;

    setDeletingId(review.id);
    try {
      // 1. Delete review doc
      await deleteDoc(doc(db, "reviews", review.id));

      // 2. Fetch remaining reviews for this provider to recalculate rating
      if (review.providerId) {
        const q = query(collection(db, "reviews"), where("providerId", "==", review.providerId));
        const remSnap = await getDocs(q);
        const remReviews = remSnap.docs.map((d) => d.data());

        let newRating = 5.0;
        const newCount = remReviews.length;
        if (newCount > 0) {
          const sum = remReviews.reduce((acc, r: any) => acc + (Number(r.rating) || 0), 0);
          newRating = Math.round((sum / newCount) * 10) / 10;
        }

        await updateDoc(doc(db, "providers", review.providerId), {
          rating: newRating,
          reviewCount: newCount,
        }).catch(() => {});
      }

      // 3. Log audit event
      await logAdminAction(
        "REVIEW_DELETED",
        `Deleted ${review.rating}-star review by "${review.customerName}": "${review.comment?.slice(0, 50)}..."`,
        { id: review.id, name: review.customerName, type: "review" }
      );

      showMsg("✅ Review deleted and provider rating updated!");
    } catch (err) {
      console.error("Failed to delete review:", err);
      showMsg("Error deleting review.");
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = reviews.filter((r) => {
    if (ratingFilter !== "all" && r.rating !== ratingFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.customerName?.toLowerCase().includes(q) ||
      r.comment?.toLowerCase().includes(q) ||
      r.providerId?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {msg && (
        <div className="p-3 bg-primary-50 border border-primary-200 text-primary-800 text-xs font-semibold rounded-xl">
          {msg}
        </div>
      )}

      {/* Header and Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-secondary-200 bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-secondary-500">
                Total Reviews
              </p>
              <h3 className="text-2xl font-black text-secondary-900 mt-1">{reviews.length}</h3>
              <p className="text-[11px] text-secondary-500 mt-0.5">Published marketplace reviews</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Star className="w-5 h-5 fill-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-200 bg-rose-50/40">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-rose-800">
                Low Rating Alerts (1-2 Stars)
              </p>
              <h3 className="text-2xl font-black text-rose-950 mt-1">
                {reviews.filter((r) => r.rating <= 2).length}
              </h3>
              <p className="text-[11px] text-rose-700 mt-0.5">May indicate service issues</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/40">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-green-800">
                5-Star Praise
              </p>
              <h3 className="text-2xl font-black text-green-950 mt-1">
                {reviews.filter((r) => r.rating === 5).length}
              </h3>
              <p className="text-[11px] text-green-700 mt-0.5">Top-tier satisfied customers</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Review Moderation Table */}
      <Card className="border-secondary-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-secondary-50/50 border-b border-secondary-100 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-primary-600" />
                Customer Reviews Moderation Center
              </CardTitle>
              <CardDescription className="text-xs">
                Inspect customer ratings, moderate abusive or defamatory feedback, and protect platform reputation.
              </CardDescription>
            </div>

            {/* Filter toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-secondary-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search reviewer, comment text..."
                  className="w-full h-9 pl-9 pr-3 rounded-xl border border-secondary-200 text-xs bg-white text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>

              <select
                value={ratingFilter}
                onChange={(e) =>
                  setRatingFilter(e.target.value === "all" ? "all" : Number(e.target.value))
                }
                className="h-9 px-3 text-xs font-semibold rounded-xl border border-secondary-200 bg-white text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="all">All Stars</option>
                <option value="1">1 Star only</option>
                <option value="2">2 Stars only</option>
                <option value="3">3 Stars only</option>
                <option value="4">4 Stars only</option>
                <option value="5">5 Stars only</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-xs text-secondary-400">Loading reviews...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-xs text-secondary-400">
              No customer reviews found matching filter.
            </div>
          ) : (
            <div className="divide-y divide-secondary-100 max-h-[650px] overflow-y-auto">
              {filtered.map((rev) => (
                <div
                  key={rev.id}
                  className="p-4 hover:bg-secondary-50/50 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4 text-xs"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-secondary-900 text-sm">
                        {rev.customerName || "Customer"}
                      </span>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= rev.rating ? "text-amber-500 fill-amber-500" : "text-secondary-200"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] font-bold text-amber-700">
                        {rev.rating}.0 / 5
                      </span>
                      {rev.createdAt && (
                        <span className="text-[10px] text-secondary-400">
                          &bull; {new Date(rev.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <p className="text-secondary-700 bg-secondary-50/70 p-2.5 rounded-xl border border-secondary-100 text-xs italic">
                      "{rev.comment || "No written comment provided."}"
                    </p>

                    <div className="text-[11px] text-secondary-400 font-mono">
                      Provider ID: {rev.providerId || "N/A"}
                    </div>
                  </div>

                  <div className="shrink-0 flex sm:flex-col items-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      isLoading={deletingId === rev.id}
                      onClick={() => handleDeleteReview(rev)}
                      className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8 gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove Review
                    </Button>
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
