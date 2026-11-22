"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase/client";
import { doc, onSnapshot, collection, query, where, updateDoc, arrayUnion, arrayRemove, increment } from "firebase/firestore";
import { useAuth } from "@/lib/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
  ShieldCheck, MapPin, Star, Phone, MessageSquare,
  CalendarCheck, ArrowLeft, Clock, Award, Heart, Flag,
  ImageIcon, ChevronLeft, ChevronRight, X, DollarSign,
  Check, Briefcase, ExternalLink, ZoomIn, Sparkles,
  CornerDownRight, Eye, Share2
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import ReportModal from "@/components/ui/ReportModal";
import BeforeAfterSlider, { BeforeAfterProject } from "@/components/ui/BeforeAfterSlider";
import { ProviderBadgesStrip } from "@/components/provider/ProviderBadges";

interface ServiceCard {
  id: string;
  title: string;
  description: string;
  duration: string;
  price: string;
  priceType: "fixed" | "hourly" | "from";
}

interface ProviderData {
  businessName: string;
  firstName: string;
  lastName: string;
  description: string;
  servicesOffered: string;
  location: string;
  hourlyRate: string;
  phone: string;
  email: string;
  photoURL?: string;
  bannerURL?: string;
  portfolioURLs?: string[];
  serviceCards?: ServiceCard[];
  beforeAfterProjects?: BeforeAfterProject[];
  rating?: number;
  reviewCount?: number;
  isVerified?: boolean;
  status: string;
  trustScore?: number;
  currency?: string;
  viewCount?: number;
}

interface Review {
  id: string;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string;
  providerReply?: {
    text: string;
    repliedAt: string;
  };
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({
  images,
  startIndex,
  onClose,
}: {
  images: string[];
  startIndex: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(startIndex);

  const prev = () => setCurrent(i => (i === 0 ? images.length - 1 : i - 1));
  const next = () => setCurrent(i => (i === images.length - 1 ? 0 : i + 1));

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        className="absolute top-5 right-5 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors z-10"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </button>

      {/* Counter */}
      <div className="absolute top-5 left-5 text-white/70 text-sm font-medium z-10">
        {current + 1} / {images.length}
      </div>

      {/* Prev */}
      {images.length > 1 && (
        <button
          className="absolute left-4 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors z-10"
          onClick={e => { e.stopPropagation(); prev(); }}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Image */}
      <motion.div
        key={current}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="relative max-w-4xl max-h-[80vh] w-full h-full mx-16"
        onClick={e => e.stopPropagation()}
      >
        <Image
          src={images[current]}
          alt={`Portfolio ${current + 1}`}
          fill
          className="object-contain"
        />
      </motion.div>

      {/* Next */}
      {images.length > 1 && (
        <button
          className="absolute right-4 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors z-10"
          onClick={e => { e.stopPropagation(); next(); }}
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Thumbnails strip */}
      {images.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {images.map((url, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); setCurrent(i); }}
              className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                i === current ? "border-white scale-110" : "border-white/30 opacity-60 hover:opacity-100"
              }`}
            >
              <Image src={url} alt={`thumb ${i}`} fill className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── Service Card component ────────────────────────────────────────────────────
function ServiceCardDisplay({
  svc,
  providerId,
  currency,
}: {
  svc: ServiceCard;
  providerId: string;
  currency: string;
}) {
  const priceLabel =
    svc.priceType === "hourly"
      ? `/hr`
      : svc.priceType === "from"
      ? " starting"
      : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col p-5 bg-white border border-secondary-200 rounded-2xl hover:border-primary-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center shrink-0">
          <Briefcase className="w-5 h-5 text-primary-600" />
        </div>
        {svc.price && (
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-primary-700">
              {currency} {svc.price}
              <span className="text-sm font-medium text-secondary-500">{priceLabel}</span>
            </p>
          </div>
        )}
      </div>

      <h3 className="font-semibold text-secondary-900 text-base mb-1">{svc.title}</h3>
      {svc.description && (
        <p className="text-sm text-secondary-500 mb-3 flex-1 line-clamp-3">{svc.description}</p>
      )}

      <div className="flex items-center justify-between mt-auto pt-3 border-t border-secondary-100">
        {svc.duration ? (
          <span className="flex items-center gap-1.5 text-xs text-secondary-500 font-medium">
            <Clock className="w-3.5 h-3.5" /> {svc.duration}
          </span>
        ) : (
          <span />
        )}
        <Link
          href={`/booking/new?provider=${providerId}&service=${encodeURIComponent(svc.title)}&price=${svc.price}`}
        >
          <Button size="sm" className="text-xs h-8 px-3">
            <CalendarCheck className="w-3.5 h-3.5 mr-1" /> Book
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function ProviderProfilePage() {
  const params = useParams();
  const router = useRouter();
  const providerId = params.id as string;
  const { user } = useAuth();

  const [provider, setProvider] = useState<ProviderData | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const [savedProviders, setSavedProviders] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: provider?.businessName || "Promoh Service Provider",
          text: `Check out ${provider?.businessName || "this service professional"} on Promoh!`,
          url,
        });
        return;
      } catch (e) {
        // fallback to clipboard
      }
    }
    navigator.clipboard.writeText(url);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2500);
  };

  useEffect(() => {
    if (!providerId) return;

    // Increment profile view count on visit
    updateDoc(doc(db, "providers", providerId), {
      viewCount: increment(1),
    }).catch(() => {});

    const unsubProvider = onSnapshot(doc(db, "providers", providerId), (docSnap) => {
      if (docSnap.exists()) {
        setProvider(docSnap.data() as ProviderData);
      } else {
        setProvider(null);
      }
      setLoading(false);
    });

    const unsubReviews = onSnapshot(
      query(collection(db, "reviews"), where("providerId", "==", providerId)),
      (snap) => {
        setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() } as Review)));
      }
    );

    return () => {
      unsubProvider();
      unsubReviews();
    };
  }, [providerId]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubUser = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        setSavedProviders(snap.data().savedProviders || []);
      }
    });
    return () => unsubUser();
  }, [user?.uid]);

  const toggleSave = async () => {
    if (!user?.uid) { router.push("/login"); return; }
    if (saving) return;
    setSaving(true);
    try {
      const isSaved = savedProviders.includes(providerId);
      await updateDoc(doc(db, "users", user.uid), {
        savedProviders: isSaved ? arrayRemove(providerId) : arrayUnion(providerId),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-secondary-50">
        <Navbar />
        <div className="max-w-5xl mx-auto px-4 py-12 space-y-6">
          <div className="h-56 bg-secondary-200 rounded-2xl animate-pulse" />
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="h-32 bg-secondary-100 rounded-2xl animate-pulse" />
              <div className="h-48 bg-secondary-100 rounded-2xl animate-pulse" />
            </div>
            <div className="h-64 bg-secondary-100 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // Allow admin preview (admin_session cookie) so they can inspect pending providers
  const isAdminPreview =
    typeof document !== "undefined" &&
    document.cookie.includes("admin_session=authenticated");

  if (!provider || (provider.status !== "Approved" && !isAdminPreview)) {
    return (
      <div className="min-h-screen bg-secondary-50">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-bold text-secondary-700">
            {provider ? "Provider Pending Verification" : "Provider not found"}
          </h1>
          <p className="text-secondary-500 mt-2">
            {provider
              ? `This provider's application is currently under review (Status: ${provider.status}).`
              : "This profile may not exist or is pending verification."}
          </p>
          <Link href="/search">
            <Button className="mt-6">Browse Professionals</Button>
          </Link>
        </div>
      </div>
    );
  }

  const displayName = provider.businessName || `${provider.firstName} ${provider.lastName}`;
  const services = provider.servicesOffered?.split(",").map(s => s.trim()).filter(Boolean) || [];
  const trustScore = provider.trustScore || Math.min(95, 70 + (provider.reviewCount || 0) * 2);
  const isSaved = savedProviders.includes(providerId);
  const portfolio = provider.portfolioURLs || [];
  const serviceCards = provider.serviceCards || [];
  const currency = provider.currency || "USD";

  const avgRating = reviews.length > 0
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
    : provider.rating;

  return (
    <div className="min-h-screen bg-secondary-50">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-secondary-500 hover:text-secondary-900 transition-colors mb-6 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* ── LEFT COLUMN ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Hero Card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="overflow-hidden bg-white shadow-sm">
                {/* Banner */}
                <div className="h-52 relative overflow-hidden">
                  {provider.bannerURL ? (
                    <Image src={provider.bannerURL} alt="Banner" fill className="object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-400 via-primary-500 to-indigo-600" />
                  )}
                  <div className="absolute inset-0 bg-black/10" />
                  {/* Action buttons */}
                  <div className="absolute top-4 right-4 flex gap-2 z-10">
                    <button
                      onClick={handleShare}
                      title={copiedShare ? "Link copied!" : "Share Profile"}
                      className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow hover:scale-110 transition-transform text-secondary-600 hover:text-primary-600 relative"
                    >
                      {copiedShare ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
                      {copiedShare && (
                        <span className="absolute -bottom-8 right-0 bg-secondary-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-md whitespace-nowrap animate-fade-in-up">
                          Copied!
                        </span>
                      )}
                    </button>
                    <button
                      onClick={toggleSave}
                      disabled={saving}
                      className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow hover:scale-110 transition-transform"
                    >
                      <Heart className={`w-5 h-5 transition-colors ${isSaved ? "fill-rose-500 stroke-rose-500" : "stroke-secondary-600"}`} />
                    </button>
                    {user?.uid && user.uid !== providerId && (
                      <button
                        onClick={() => setShowReport(true)}
                        className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow hover:scale-110 transition-transform text-secondary-600 hover:text-red-500"
                      >
                        <Flag className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                <CardContent className="p-4 sm:p-6 relative">
                  {/* Avatar */}
                  <div className="relative -mt-16 mb-3 sm:mb-0 sm:mt-0 sm:absolute sm:-top-14 sm:left-6 w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-4 border-white shadow-xl overflow-hidden bg-white mx-auto sm:mx-0 shrink-0">
                    {provider.photoURL ? (
                      <Image src={provider.photoURL} alt={displayName} fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary-400 to-indigo-500 flex items-center justify-center">
                        <span className="text-3xl sm:text-4xl font-bold text-white">{displayName[0]?.toUpperCase()}</span>
                      </div>
                    )}
                  </div>

                  <div className="sm:ml-36 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-2.5 sm:gap-3 flex-wrap">
                      <h1 className="text-xl sm:text-2xl font-bold text-secondary-900">{displayName}</h1>
                      {provider.isVerified && (
                        <span className="flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 bg-primary-50 text-primary-700 rounded-full text-xs sm:text-sm font-semibold border border-primary-200">
                          <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Verified
                        </span>
                      )}
                    </div>
                    <p className="text-secondary-600 mt-1 text-sm sm:text-base">{services[0] || "Professional Services"}</p>
                    <div className="flex items-center justify-center sm:justify-start gap-3 sm:gap-4 mt-3 flex-wrap text-xs sm:text-sm">
                      {provider.location && (
                        <span className="flex items-center gap-1 text-sm text-secondary-500">
                          <MapPin className="w-4 h-4" /> {provider.location}
                        </span>
                      )}
                      {avgRating && (
                        <span className="flex items-center gap-1 text-sm font-semibold">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          {avgRating.toFixed(1)} ({reviews.length} review{reviews.length !== 1 ? "s" : ""})
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-sm text-green-600 font-semibold">
                        <Award className="w-4 h-4" /> Trust Score: {trustScore}/100
                      </span>
                      {provider.viewCount !== undefined && (
                        <span className="flex items-center gap-1 text-sm text-secondary-500 font-medium">
                          <Eye className="w-4 h-4 text-secondary-400" /> {provider.viewCount} view{provider.viewCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>

                    {/* Recognitions & Badges */}
                    <div className="mt-3.5 pt-3 border-t border-secondary-100">
                      <ProviderBadgesStrip providerData={provider} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* About */}
            {provider.description && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="bg-white shadow-sm">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-bold mb-3 text-secondary-900">About</h2>
                    <p className="text-secondary-600 leading-relaxed whitespace-pre-wrap">{provider.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Service Cards */}
            {serviceCards.length > 0 ? (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }}>
                <Card className="bg-white shadow-sm">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-secondary-900">
                      <Briefcase className="w-5 h-5 text-primary-500" /> Services & Pricing
                    </h2>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {serviceCards.map(svc => (
                        <ServiceCardDisplay
                          key={svc.id}
                          svc={svc}
                          providerId={providerId}
                          currency={currency}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : services.length > 0 ? (
              /* Fallback: show plain service tags if no cards */
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }}>
                <Card className="bg-white shadow-sm">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-bold mb-4 text-secondary-900">Services Offered</h2>
                    <div className="flex flex-wrap gap-2">
                      {services.map(svc => (
                        <span key={svc} className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium border border-primary-100">
                          {svc}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : null}

            {/* Portfolio Gallery */}
            {portfolio.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }}>
                <Card className="bg-white shadow-sm">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-secondary-900">
                      <ImageIcon className="w-5 h-5 text-primary-500" /> Work Portfolio
                      <span className="text-sm font-normal text-secondary-400 ml-1">({portfolio.length} photo{portfolio.length !== 1 ? "s" : ""})</span>
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {portfolio.map((url, i) => (
                        <motion.button
                          key={i}
                          onClick={() => setLightboxIndex(i)}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.05 }}
                          className="relative aspect-square rounded-xl overflow-hidden bg-secondary-100 border border-secondary-200 group cursor-zoom-in"
                        >
                          <Image
                            src={url}
                            alt={`Portfolio ${i + 1}`}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                            <ZoomIn className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                          </div>
                        </motion.button>
                      ))}
                    </div>
                    <p className="text-xs text-secondary-400 mt-3 text-center">Click any photo to view full size</p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Before & After Transformations */}
            {provider.beforeAfterProjects && provider.beforeAfterProjects.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                <Card className="bg-white shadow-sm overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div>
                        <h2 className="text-lg font-bold flex items-center gap-2 text-secondary-900">
                          <Sparkles className="w-5 h-5 text-primary-500" />
                          Before & After Transformations
                        </h2>
                        <p className="text-xs text-secondary-500 mt-0.5">
                          Drag the slider across the images to inspect the verified transformation quality
                        </p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-200">
                        {provider.beforeAfterProjects.length} Transformation{provider.beforeAfterProjects.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="grid md:grid-cols-2 gap-5">
                      {provider.beforeAfterProjects.map((project) => (
                        <BeforeAfterSlider
                          key={project.id}
                          beforeURL={project.beforeURL}
                          afterURL={project.afterURL}
                          title={project.title}
                          category={project.category}
                          description={project.description}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Reviews */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="bg-white shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-secondary-900">
                      Customer Reviews{" "}
                      {reviews.length > 0 && (
                        <span className="text-secondary-500 font-normal">({reviews.length})</span>
                      )}
                    </h2>
                    {avgRating && reviews.length > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 rounded-xl border border-yellow-200">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="font-bold text-yellow-700">{avgRating.toFixed(1)}</span>
                        <span className="text-yellow-600 text-sm">/ 5</span>
                      </div>
                    )}
                  </div>

                  {reviews.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-secondary-200 rounded-xl">
                      <Star className="w-10 h-10 text-secondary-300 mx-auto mb-3" />
                      <p className="text-secondary-600 font-medium">No reviews yet</p>
                      <p className="text-secondary-400 text-sm mt-1">Be the first to book and leave a review!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {reviews.map(review => (
                        <div key={review.id} className="p-4 bg-secondary-50 rounded-xl border border-secondary-100 space-y-2">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-gradient-to-br from-primary-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                {review.customerName?.[0]?.toUpperCase() || "?"}
                              </div>
                              <span className="font-semibold text-secondary-900">{review.customerName}</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-4 h-4 ${i < review.rating ? "text-yellow-500 fill-yellow-500" : "text-secondary-200"}`}
                                />
                              ))}
                            </div>
                          </div>
                          <p className="text-secondary-600 text-sm leading-relaxed">{review.comment}</p>
                          {review.createdAt && (
                            <p className="text-xs text-secondary-400">
                              {new Date(review.createdAt).toLocaleDateString("en-US", {
                                year: "numeric", month: "long", day: "numeric"
                              })}
                            </p>
                          )}

                          {/* Provider Public Reply */}
                          {review.providerReply?.text && (
                            <div className="mt-3 ml-2 sm:ml-4 p-3.5 bg-white rounded-xl border-l-4 border-primary-500 border-y border-r border-secondary-200 shadow-xs space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-primary-900 flex items-center gap-1.5">
                                  <CornerDownRight className="w-3.5 h-3.5 text-primary-600" />
                                  Response from {displayName}
                                </span>
                                {review.providerReply.repliedAt && (
                                  <span className="text-[10px] text-secondary-400 font-medium">
                                    {new Date(review.providerReply.repliedAt).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric"
                                    })}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-secondary-700 leading-relaxed pl-5">
                                {review.providerReply.text}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div className="space-y-4">
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <Card className="sticky top-28 bg-white border-primary-100 shadow-xl shadow-primary-500/5">
                <CardContent className="p-6 space-y-4">
                  {/* Price display */}
                  {provider.hourlyRate && (
                    <div className="text-center py-4 bg-gradient-to-br from-primary-50 to-indigo-50 rounded-xl border border-primary-100">
                      <p className="text-secondary-500 text-xs font-medium uppercase tracking-wide mb-1">Starting from</p>
                      <p className="text-3xl font-bold text-primary-700">
                        {currency} {provider.hourlyRate}
                        <span className="text-base font-medium text-secondary-500">/hr</span>
                      </p>
                    </div>
                  )}

                  {/* Primary CTA */}
                  <Link href={`/booking/new?provider=${providerId}`} className="block">
                    <Button id="book-service-btn" className="w-full" size="lg">
                      <CalendarCheck className="w-5 h-5 mr-2" /> Book Service
                    </Button>
                  </Link>

                  {/* Message */}
                  {user?.uid !== providerId && (
                    <Link href={`/chat?provider=${providerId}`} className="block">
                      <Button id="chat-provider-btn" variant="outline" className="w-full h-11">
                        <MessageSquare className="w-4 h-4 mr-2" /> Message Provider
                      </Button>
                    </Link>
                  )}

                  {/* Phone */}
                  {provider.phone && (
                    <a href={`tel:${provider.phone}`} className="block">
                      <Button id="contact-provider-btn" variant="secondary" className="w-full h-11">
                        <Phone className="w-4 h-4 mr-2" /> {provider.phone}
                      </Button>
                    </a>
                  )}

                  {/* Trust info */}
                  <div className="pt-4 border-t border-secondary-200 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-secondary-600">
                      <Clock className="w-4 h-4 text-secondary-400 shrink-0" />
                      Typically responds within 1 hour
                    </div>
                    {provider.isVerified && (
                      <div className="flex items-center gap-2 text-sm text-primary-700 font-medium">
                        <ShieldCheck className="w-4 h-4 shrink-0" />
                        Identity Verified by Promoh
                      </div>
                    )}
                    {reviews.length >= 5 && (
                      <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                        <Check className="w-4 h-4 shrink-0" />
                        {reviews.length}+ Satisfied Customers
                      </div>
                    )}
                  </div>

                  {/* Quick service count */}
                  {serviceCards.length > 0 && (
                    <div className="pt-3 border-t border-secondary-100 text-center">
                      <p className="text-xs text-secondary-500">
                        <span className="font-semibold text-secondary-800">{serviceCards.length}</span> service{serviceCards.length !== 1 ? "s" : ""} available
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <Lightbox
            images={portfolio}
            startIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {showReport && (
          <ReportModal
            targetId={providerId}
            targetName={displayName}
            targetType="provider"
            onClose={() => setShowReport(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
