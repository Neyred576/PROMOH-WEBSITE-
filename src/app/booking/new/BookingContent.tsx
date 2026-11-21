"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { db } from "@/lib/firebase/client";
import { collection, addDoc, doc, getDoc, query, where, getDocs, updateDoc, increment } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  CheckCircle, CalendarCheck, ArrowLeft, Clock, MapPin,
  ShieldCheck, Star, User, FileText, DollarSign, AlertCircle,
  Tag, Sparkles, X, Check
} from "lucide-react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Image from "next/image";
import { motion } from "framer-motion";

interface ProviderServiceItem {
  id?: string;
  title: string;
  price?: number;
  duration?: string;
  description?: string;
  pricingType?: "fixed" | "hourly";
}

interface ProviderData {
  businessName: string;
  firstName: string;
  lastName: string;
  servicesOffered: string;
  services?: ProviderServiceItem[];
  hourlyRate: string;
  location: string;
  photoURL?: string;
  rating?: number;
  isVerified?: boolean;
  description?: string;
  availability?: {
    isAcceptingBookings?: boolean;
    workingDays?: string[];
    startHour?: string;
    endHour?: string;
  };
}

const TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"
];

const STATUS_STEPS = [
  { key: "pending", label: "Pending", desc: "Awaiting provider confirmation" },
  { key: "accepted", label: "Accepted", desc: "Provider confirmed your booking" },
  { key: "in_progress", label: "In Progress", desc: "Service is being performed" },
  { key: "completed", label: "Completed", desc: "Service completed successfully" },
];

export default function NewBookingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const providerId = searchParams.get("provider") || "";
  const initialService = searchParams.get("service") || "";
  const { user } = useAuth();

  const [provider, setProvider] = useState<ProviderData | null>(null);
  const [loadingProvider, setLoadingProvider] = useState(true);

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [selectedService, setSelectedService] = useState(initialService);
  const [notes, setNotes] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [error, setError] = useState("");
  const [dateWarning, setDateWarning] = useState("");

  // Promo code state
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<any | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoMessage, setPromoMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    const serviceFromParam = searchParams.get("service");
    if (serviceFromParam) {
      setSelectedService(serviceFromParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!providerId) { setLoadingProvider(false); return; }
    getDoc(doc(db, "providers", providerId)).then(snap => {
      if (snap.exists()) {
        const data = snap.data() as ProviderData;
        setProvider(data);
        if (!selectedService) {
          if (data.services && data.services.length > 0) {
            setSelectedService(data.services[0].title);
          } else if (data.servicesOffered) {
            setSelectedService(data.servicesOffered.split(",")[0].trim());
          }
        }
      }
      setLoadingProvider(false);
    });
  }, [providerId]);

  const structuredServices = (provider?.services || []).map(s => s.title);
  const commaServices = provider?.servicesOffered?.split(",").map(s => s.trim()).filter(Boolean) || [];
  const services = Array.from(new Set([...structuredServices, ...commaServices]));

  const matchedService = provider?.services?.find(
    s => s.title.toLowerCase() === selectedService.toLowerCase()
  );

  const today = new Date().toISOString().split("T")[0];
  const basePriceNum = matchedService?.price ?? (provider?.hourlyRate ? parseFloat(provider.hourlyRate) : 0);

  let discountAmount = 0;
  if (appliedPromo && basePriceNum > 0) {
    if (appliedPromo.discountType === "percentage") {
      discountAmount = Math.round(((basePriceNum * appliedPromo.discountValue) / 100) * 100) / 100;
    } else {
      discountAmount = Math.min(basePriceNum, appliedPromo.discountValue);
    }
  }
  const finalPriceNum = Math.max(0, basePriceNum - discountAmount);

  const estimatedCost = matchedService
    ? `$${matchedService.price}${matchedService.pricingType === "hourly" ? "/hr" : " (fixed)"}`
    : provider?.hourlyRate
    ? `$${provider.hourlyRate}/hr`
    : "TBD";

  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim()) return;
    setPromoLoading(true);
    setPromoMessage(null);
    try {
      const codeUpper = promoCodeInput.trim().toUpperCase();
      const q = query(collection(db, "promocodes"), where("code", "==", codeUpper));
      const snap = await getDocs(q);
      if (snap.empty) {
        setPromoMessage({ text: "Promo code not found. Please check and try again.", ok: false });
        setPromoLoading(false);
        return;
      }
      const promoData = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
      if (promoData.isActive === false) {
        setPromoMessage({ text: "This promo code is currently disabled.", ok: false });
        setPromoLoading(false);
        return;
      }
      if (promoData.expiresAt && new Date(promoData.expiresAt).getTime() < Date.now()) {
        setPromoMessage({ text: "This promo code has expired.", ok: false });
        setPromoLoading(false);
        return;
      }
      if (promoData.maxUses > 0 && promoData.usedCount >= promoData.maxUses) {
        setPromoMessage({ text: "This promo code has reached its maximum usage limit.", ok: false });
        setPromoLoading(false);
        return;
      }
      setAppliedPromo(promoData);
      setPromoMessage({
        text: `Code ${promoData.code} applied! ${promoData.discountType === "percentage" ? `${promoData.discountValue}% OFF` : `$${promoData.discountValue} OFF`}`,
        ok: true,
      });
    } catch (err: any) {
      setPromoMessage({ text: "Failed to validate promo code.", ok: false });
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCodeInput("");
    setPromoMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setError("Please log in to book a service."); return; }
    if (!date) { setError("Please select a date."); return; }
    if (!time) { setError("Please select a time slot."); return; }
    setLoading(true);
    setError("");
    try {
      const bookingRef = await addDoc(collection(db, "bookings"), {
        customerId: user.uid,
        customerName: user.displayName || user.email,
        customerEmail: user.email,
        providerId,
        providerName: provider?.businessName || `${provider?.firstName} ${provider?.lastName}`,
        service: selectedService || provider?.servicesOffered || "General Service",
        servicePrice: matchedService?.price || null,
        pricingType: matchedService?.pricingType || "hourly",
        date,
        time,
        notes,
        address,
        status: "pending",
        estimatedRate: matchedService ? String(matchedService.price) : (provider?.hourlyRate || "0"),
        promoCode: appliedPromo ? appliedPromo.code : null,
        promoDiscountType: appliedPromo ? appliedPromo.discountType : null,
        promoDiscountValue: appliedPromo ? appliedPromo.discountValue : null,
        discountAmount: appliedPromo ? discountAmount : 0,
        finalEstimatedRate: appliedPromo && basePriceNum > 0 ? String(finalPriceNum) : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Increment promo usage counter if applied
      if (appliedPromo?.id) {
        try {
          await updateDoc(doc(db, "promocodes", appliedPromo.id), {
            usedCount: increment(1)
          });
        } catch (e) {
          console.error("Could not increment promo count:", e);
        }
      }

      // Notify provider
      await addDoc(collection(db, "notifications"), {
        userId: providerId,
        title: "📅 New Booking Request",
        message: `${user.displayName || "A customer"} has requested a booking for ${selectedService || "service"} on ${date} at ${time}.`,
        link: "/provider/dashboard",
        type: "booking_new",
        read: false,
        createdAt: new Date().toISOString(),
      });

      setBookingId(bookingRef.id);
      setSuccess(true);
    } catch (err: any) {
      setError("Failed to submit booking. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-secondary-50">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring" }}>
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-green-50">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-secondary-900 mb-2">Booking Submitted!</h1>
            <p className="text-secondary-600 mb-4">
              Your request has been sent to <strong>{provider?.businessName || "the provider"}</strong>.
              You'll receive a notification once they respond.
            </p>

            {/* Status pipeline */}
            <div className="my-8 space-y-3 text-left">
              {STATUS_STEPS.map((step, i) => (
                <div key={step.key} className={`flex items-center gap-3 p-3 rounded-xl border ${i === 0 ? "bg-amber-50 border-amber-200" : "bg-white border-secondary-100"}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-amber-400 text-white" : "bg-secondary-100 text-secondary-400"}`}>
                    {i === 0 ? "✓" : i + 1}
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${i === 0 ? "text-amber-800" : "text-secondary-400"}`}>{step.label}</p>
                    <p className={`text-xs ${i === 0 ? "text-amber-600" : "text-secondary-300"}`}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-center">
              <Link href="/dashboard"><Button variant="outline">My Dashboard</Button></Link>
              <Link href={`/chat?provider=${providerId}`}><Button>Chat with Provider</Button></Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-10">
        <Link href={`/provider/${providerId}`}
          className="flex items-center gap-2 text-secondary-500 hover:text-secondary-900 transition-colors mb-6 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to Provider Profile
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Booking Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <CalendarCheck className="w-5 h-5 text-primary-600" /> Book a Service
                </CardTitle>
                <CardDescription>Fill in your preferred date, time, and any details for the provider.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-200 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />{error}
                    </div>
                  )}
                  {provider?.availability?.isAcceptingBookings === false && (
                    <div className="p-3 bg-amber-50 text-amber-800 text-sm rounded-xl border border-amber-200 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>This professional is currently not accepting new bookings.</span>
                    </div>
                  )}
                  {!user && (
                    <div className="p-4 bg-amber-50 text-amber-700 text-sm rounded-xl border border-amber-200">
                      You must be logged in to book. <Link href="/login" className="font-semibold underline">Log in here</Link>.
                    </div>
                  )}

                  {/* Service Selection */}
                  {services.length > 0 && (
                    <div>
                      <label className="text-sm font-semibold block mb-2 text-secondary-700">
                        <FileText className="w-4 h-4 inline mr-1.5 text-primary-500" />Selected Service
                      </label>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {services.map(svc => {
                          const svcItem = provider?.services?.find(s => s.title.toLowerCase() === svc.toLowerCase());
                          const isSelected = selectedService.toLowerCase() === svc.toLowerCase();
                          return (
                            <button
                              key={svc}
                              type="button"
                              onClick={() => setSelectedService(svc)}
                              className={`p-3 rounded-xl text-sm font-medium border text-left transition-all flex items-center justify-between gap-2 ${
                                isSelected
                                  ? "bg-primary-50 border-primary-500 text-primary-800 ring-2 ring-primary-500/20 shadow-sm"
                                  : "border-secondary-200 hover:border-primary-300 text-secondary-700 bg-white"
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="font-semibold truncate">{svc}</p>
                                {svcItem?.duration && (
                                  <p className="text-xs text-secondary-400">⏱ {svcItem.duration}</p>
                                )}
                              </div>
                              {svcItem?.price ? (
                                <span className={`text-xs px-2.5 py-1 rounded-full font-bold shrink-0 ${
                                  isSelected ? "bg-primary-600 text-white" : "bg-primary-50 text-primary-700"
                                }`}>
                                  ${svcItem.price}{svcItem.pricingType === "hourly" ? "/hr" : ""}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Date */}
                  <div>
                    <label className="text-sm font-semibold block mb-2 text-secondary-700">
                      <CalendarCheck className="w-4 h-4 inline mr-1.5 text-primary-500" />Preferred Date
                    </label>
                    <Input
                      id="booking-date"
                      type="date"
                      value={date}
                      onChange={e => {
                        const newDate = e.target.value;
                        setDate(newDate);
                        if (newDate) {
                          const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                          const dayName = days[new Date(newDate + "T12:00:00").getDay()];
                          if (
                            provider?.availability?.workingDays &&
                            provider.availability.workingDays.length > 0 &&
                            !provider.availability.workingDays.includes(dayName)
                          ) {
                            setDateWarning(`Note: ${provider.businessName || "This provider"} normally doesn't work on ${dayName}s (Working days: ${provider.availability.workingDays.join(", ")}).`);
                          } else {
                            setDateWarning("");
                          }
                        } else {
                          setDateWarning("");
                        }
                      }}
                      required
                      min={today}
                      className="bg-white"
                    />
                    {dateWarning && (
                      <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-2 flex items-start gap-1.5">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                        <span>{dateWarning}</span>
                      </p>
                    )}
                  </div>

                  {/* Time Slots */}
                  <div>
                    <label className="text-sm font-semibold block mb-2 text-secondary-700">
                      <Clock className="w-4 h-4 inline mr-1.5 text-primary-500" />Preferred Time
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {TIME_SLOTS.map(slot => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setTime(slot)}
                          className={`py-2 px-3 rounded-xl text-sm font-medium border transition-all ${time === slot ? "bg-primary-600 border-primary-600 text-white" : "border-secondary-200 hover:border-primary-400 text-secondary-700 bg-white"}`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <label className="text-sm font-semibold block mb-2 text-secondary-700">
                      <MapPin className="w-4 h-4 inline mr-1.5 text-primary-500" />Service Address (optional)
                    </label>
                    <Input
                      id="booking-address"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder="Enter the address where service is needed..."
                      className="bg-white"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-sm font-semibold block mb-2 text-secondary-700">
                      <FileText className="w-4 h-4 inline mr-1.5 text-primary-500" />Notes for Provider (optional)
                    </label>
                    <textarea
                      id="booking-notes"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Describe the job, any special requirements, or questions..."
                      rows={4}
                      className="flex w-full rounded-xl border border-secondary-300 bg-white px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:border-primary-500 focus-visible:ring-primary-500/20 placeholder:text-secondary-400 resize-none"
                    />
                    <p className="text-xs text-secondary-400 mt-1">{notes.length}/500 characters</p>
                  </div>

                  {/* Promo Code Input */}
                  <div className="p-4 bg-secondary-50 border border-secondary-200 rounded-2xl">
                    <label className="text-sm font-semibold flex items-center gap-1.5 text-secondary-800 mb-2">
                      <Tag className="w-4 h-4 text-primary-600" /> Have a Promo Code?
                    </label>
                    {appliedPromo ? (
                      <div className="flex items-center justify-between bg-white border border-emerald-200 rounded-xl p-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                          <div>
                            <span className="font-mono font-bold text-sm text-emerald-800">
                              {appliedPromo.code}
                            </span>
                            <span className="text-xs text-secondary-500 ml-2">
                              ({appliedPromo.discountType === "percentage" ? `${appliedPromo.discountValue}% off` : `$${appliedPromo.discountValue} off`})
                            </span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleRemovePromo}
                          className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        >
                          <X className="w-3.5 h-3.5 mr-1" /> Remove
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Enter promo code (e.g. WELCOME10)"
                            value={promoCodeInput}
                            onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                            className="bg-white uppercase font-mono tracking-wider text-sm"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleApplyPromo}
                            isLoading={promoLoading}
                            disabled={!promoCodeInput.trim()}
                            className="shrink-0"
                          >
                            Apply
                          </Button>
                        </div>
                        {promoMessage && (
                          <p
                            className={`text-xs mt-2 font-medium flex items-center gap-1 ${
                              promoMessage.ok ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {promoMessage.ok ? <Sparkles className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                            {promoMessage.text}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <Button id="confirm-booking-btn" type="submit" className="w-full" size="lg" isLoading={loading} disabled={!user || !date || !time}>
                    <CalendarCheck className="w-5 h-5 mr-2" />
                    {!date || !time ? "Select Date & Time to Continue" : "Confirm Booking Request"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Provider Summary Sidebar */}
          <div>
            <Card className="sticky top-28">
              <CardContent className="p-6 space-y-4">
                {loadingProvider ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-20 bg-secondary-100 rounded-xl" />
                    <div className="h-4 bg-secondary-100 rounded" />
                    <div className="h-4 bg-secondary-100 rounded w-2/3" />
                  </div>
                ) : provider ? (
                  <>
                    {/* Provider mini card */}
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-gradient-to-br from-primary-400 to-indigo-400 flex items-center justify-center shrink-0">
                        {provider.photoURL ? (
                          <Image src={provider.photoURL} alt={provider.businessName} width={56} height={56} className="object-cover" />
                        ) : (
                          <span className="text-xl font-bold text-white">
                            {(provider.businessName || provider.firstName || "?")[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-secondary-900 text-sm">
                          {provider.businessName || `${provider.firstName} ${provider.lastName}`}
                        </p>
                        {provider.isVerified && (
                          <span className="flex items-center gap-1 text-xs text-primary-600 font-medium">
                            <ShieldCheck className="w-3 h-3" /> Verified
                          </span>
                        )}
                        {provider.rating && (
                          <span className="flex items-center gap-1 text-xs text-secondary-500">
                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            {provider.rating.toFixed(1)} rating
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-secondary-100 pt-4 space-y-3 text-sm">
                      <div className="flex justify-between items-baseline">
                        <span className="text-secondary-500 flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5" /> Rate
                        </span>
                        <span className={`font-bold ${appliedPromo && discountAmount > 0 ? "line-through text-secondary-400 text-xs" : "text-primary-700"}`}>
                          {estimatedCost}
                        </span>
                      </div>
                      {appliedPromo && discountAmount > 0 && (
                        <div className="flex justify-between items-center text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-1.5 rounded-lg border border-emerald-200">
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> {appliedPromo.code}
                          </span>
                          <span>-${discountAmount.toFixed(2)}</span>
                        </div>
                      )}
                      {appliedPromo && discountAmount > 0 && (
                        <div className="flex justify-between items-baseline pt-2 border-t border-dashed border-secondary-200">
                          <span className="font-bold text-secondary-900 text-xs uppercase tracking-wider">Est. Total</span>
                          <span className="text-lg font-black text-emerald-700">
                            ${finalPriceNum.toFixed(2)}{matchedService?.pricingType === "hourly" ? "/hr" : ""}
                          </span>
                        </div>
                      )}
                      {date && (
                        <div className="flex justify-between">
                          <span className="text-secondary-500 flex items-center gap-1">
                            <CalendarCheck className="w-3.5 h-3.5" /> Date
                          </span>
                          <span className="font-medium">{new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                        </div>
                      )}
                      {time && (
                        <div className="flex justify-between">
                          <span className="text-secondary-500 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> Time
                          </span>
                          <span className="font-medium">{time}</span>
                        </div>
                      )}
                      {selectedService && (
                        <div className="flex justify-between">
                          <span className="text-secondary-500 flex items-center gap-1">
                            <User className="w-3.5 h-3.5" /> Service
                          </span>
                          <span className="font-medium text-right max-w-[120px] truncate">{selectedService}</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
                      💡 The provider will confirm your request. Payment is collected after the service is completed.
                    </div>
                  </>
                ) : (
                  <p className="text-secondary-500 text-sm text-center py-4">Provider not found.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
