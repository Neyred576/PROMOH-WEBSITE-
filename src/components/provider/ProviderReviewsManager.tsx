"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase/client";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
} from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Star,
  MessageSquare,
  Send,
  CheckCircle2,
  CornerDownRight,
  Edit2,
  Clock,
  Sparkles,
  User,
  Filter,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface ReviewDoc {
  id: string;
  providerId: string;
  customerId?: string;
  customerName?: string;
  rating: number;
  comment: string;
  createdAt?: string;
  providerReply?: {
    text: string;
    repliedAt: string;
  };
}

interface ProviderReviewsManagerProps {
  providerId: string;
  providerData: any;
}

export default function ProviderReviewsManager({
  providerId,
  providerData,
}: ProviderReviewsManagerProps) {
  const [reviews, setReviews] = useState<ReviewDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unreplied" | "replied">("all");

  // Replying state
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (!providerId) return;

    const q = query(collection(db, "reviews"), where("providerId", "==", providerId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReviewDoc));
        // Sort descending by date
        docs.sort((a, b) => {
          const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tB - tA;
        });
        setReviews(docs);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading reviews", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [providerId]);

  const handleStartReply = (review: ReviewDoc) => {
    setReplyingId(review.id);
    setReplyText(review.providerReply?.text || "");
  };

  const handleCancelReply = () => {
    setReplyingId(null);
    setReplyText("");
  };

  const handleSaveReply = async (reviewId: string) => {
    if (!replyText.trim()) return;
    setIsSubmitting(true);
    try {
      const review = reviews.find((r) => r.id === reviewId);
      const replyData = {
        text: replyText.trim(),
        repliedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, "reviews", reviewId), {
        providerReply: replyData,
      });

      // Send in-app notification to customer if customerId exists
      if (review?.customerId) {
        await addDoc(collection(db, "notifications"), {
          userId: review.customerId,
          title: "💬 Response from Provider",
          message: `${providerData?.businessName || "Your provider"} replied to your review: "${replyText.trim().slice(0, 80)}..."`,
          link: `/provider/${providerId}`,
          type: "review_reply",
          read: false,
          createdAt: new Date().toISOString(),
        });
      }

      setSuccessMsg("Public reply posted successfully!");
      setTimeout(() => setSuccessMsg(""), 3500);
      setReplyingId(null);
      setReplyText("");
    } catch (err) {
      console.error("Error saving review reply", err);
      alert("Failed to submit reply. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick stats
  const totalReviews = reviews.length;
  const avgRating = totalReviews
    ? (reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / totalReviews).toFixed(1)
    : "0.0";
  const repliedCount = reviews.filter((r) => !!r.providerReply?.text).length;
  const unrepliedCount = totalReviews - repliedCount;

  const filteredReviews = reviews.filter((r) => {
    if (filter === "unreplied") return !r.providerReply?.text;
    if (filter === "replied") return !!r.providerReply?.text;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-secondary-200 bg-white shadow-xs">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
              <Star className="w-6 h-6 fill-amber-400 text-amber-500" />
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <h3 className="text-2xl font-black text-secondary-900">{avgRating}</h3>
                <span className="text-xs text-secondary-500 font-semibold">/ 5.0</span>
              </div>
              <p className="text-xs text-secondary-500">Average Client Rating</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-secondary-200 bg-white shadow-xs">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-secondary-900">{totalReviews}</h3>
              <p className="text-xs text-secondary-500">Total Reviews Received</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-secondary-200 bg-white shadow-xs">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-secondary-900">{repliedCount}</h3>
              <p className="text-xs text-secondary-500">Public Replies Published</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Reviews Management List */}
      <Card className="border-secondary-200/80 shadow-sm overflow-hidden">
        <CardHeader className="bg-secondary-50/40 border-b border-secondary-100 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2 text-secondary-900">
                <MessageSquare className="w-5 h-5 text-primary-600" />
                <span>Customer Reviews & Public Replies</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Replying to reviews boosts client trust and demonstrates reliable customer service
              </CardDescription>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 bg-secondary-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filter === "all"
                    ? "bg-white text-secondary-900 shadow-xs"
                    : "text-secondary-600 hover:text-secondary-900"
                }`}
              >
                All ({totalReviews})
              </button>
              <button
                type="button"
                onClick={() => setFilter("unreplied")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filter === "unreplied"
                    ? "bg-white text-secondary-900 shadow-xs"
                    : "text-secondary-600 hover:text-secondary-900"
                }`}
              >
                Needs Reply ({unrepliedCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter("replied")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filter === "replied"
                    ? "bg-white text-secondary-900 shadow-xs"
                    : "text-secondary-600 hover:text-secondary-900"
                }`}
              >
                Replied ({repliedCount})
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {successMsg && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-24 bg-secondary-100 rounded-xl" />
              <div className="h-24 bg-secondary-100 rounded-xl" />
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-secondary-200 rounded-2xl">
              <Star className="w-10 h-10 text-secondary-300 mx-auto mb-3" />
              <h4 className="font-bold text-secondary-700 text-sm">No reviews found</h4>
              <p className="text-secondary-400 text-xs mt-1">
                {filter === "unreplied"
                  ? "Great job! All customer reviews have received a public reply."
                  : "Reviews submitted by clients after completed jobs will appear here."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReviews.map((review) => {
                const isReplying = replyingId === review.id;
                const hasReply = !!review.providerReply?.text;

                return (
                  <div
                    key={review.id}
                    className="p-5 rounded-2xl border border-secondary-200/90 bg-white hover:border-primary-200 transition-all shadow-xs space-y-3.5"
                  >
                    {/* Header: Customer Info + Rating */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-indigo-500 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                          {review.customerName?.[0]?.toUpperCase() || "C"}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-secondary-900">
                            {review.customerName || "Verified Customer"}
                          </h4>
                          {review.createdAt && (
                            <span className="text-[11px] text-secondary-400 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              {new Date(review.createdAt).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stars */}
                      <div className="flex items-center gap-0.5 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < review.rating
                                ? "text-amber-400 fill-amber-400"
                                : "text-secondary-200"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Customer Comment */}
                    <p className="text-sm text-secondary-700 leading-relaxed pl-1">
                      {review.comment}
                    </p>

                    {/* Provider Reply Box (If already replied and not editing) */}
                    {hasReply && !isReplying && (
                      <div className="ml-4 sm:ml-8 p-3.5 bg-primary-50/50 rounded-xl border-l-4 border-primary-500 border-y border-r border-primary-100 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-primary-900 flex items-center gap-1.5">
                            <CornerDownRight className="w-3.5 h-3.5 text-primary-600" />
                            Response from You ({providerData?.businessName || "Provider"})
                          </span>
                          <div className="flex items-center gap-2">
                            {review.providerReply?.repliedAt && (
                              <span className="text-[10px] text-primary-600 font-medium">
                                {new Date(review.providerReply.repliedAt).toLocaleDateString()}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleStartReply(review)}
                              className="text-[11px] font-semibold text-primary-700 hover:text-primary-900 hover:underline flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3" /> Edit
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-primary-950 leading-relaxed">
                          {review.providerReply?.text}
                        </p>
                      </div>
                    )}

                    {/* Reply Input Form (When replying / editing) */}
                    {isReplying ? (
                      <div className="ml-4 sm:ml-8 p-4 bg-secondary-50 rounded-xl border border-secondary-200 space-y-3">
                        <label className="text-xs font-bold text-secondary-800 flex items-center gap-1.5">
                          <CornerDownRight className="w-3.5 h-3.5 text-primary-600" />
                          Public Reply to {review.customerName || "Customer"}:
                        </label>
                        <textarea
                          rows={3}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Thank the client for their business, address their feedback, or add a note..."
                          className="w-full text-xs p-3 rounded-lg border border-secondary-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={handleCancelReply}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 text-xs gap-1.5"
                            disabled={!replyText.trim() || isSubmitting}
                            onClick={() => handleSaveReply(review.id)}
                          >
                            <Send className="w-3 h-3" />
                            {isSubmitting ? "Posting..." : "Post Public Reply"}
                          </Button>
                        </div>
                      </div>
                    ) : !hasReply ? (
                      <div className="pt-1 flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-semibold gap-1.5 text-primary-700 border-primary-200 hover:bg-primary-50"
                          onClick={() => handleStartReply(review)}
                        >
                          <CornerDownRight className="w-3.5 h-3.5" />
                          Reply to Customer
                        </Button>
                      </div>
                    ) : null}
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
