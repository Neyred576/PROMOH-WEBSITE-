"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  CreditCard,
  MessageSquare,
  LifeBuoy,
  ChevronDown,
  ArrowRight,
  Briefcase,
  CheckCircle,
  MapPin,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { getDb } from "@/lib/firebase/client";
import { doc, onSnapshot } from "firebase/firestore";

// ── 1. POPULAR CITIES BAR ──────────────────────────────────────────────────
const DEFAULT_POPULAR_LOCATIONS = [
  "New York",
  "London",
  "Toronto",
  "Sydney",
  "Nairobi",
  "Los Angeles",
  "Dubai",
  "Johannesburg",
  "Miami",
  "Berlin",
];

export function PopularCitiesBar() {
  const [locations, setLocations] = useState<string[]>(DEFAULT_POPULAR_LOCATIONS);

  useEffect(() => {
    const db = getDb();
    const unsub = onSnapshot(doc(db, "platform_settings", "homepage"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.popularLocations) && data.popularLocations.length > 0) {
          setLocations(data.popularLocations);
        } else {
          setLocations(DEFAULT_POPULAR_LOCATIONS);
        }
      }
    });
    return () => unsub();
  }, []);

  if (locations.length === 0) return null;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 mt-6">
      <div className="flex items-center justify-center flex-wrap gap-2 text-xs text-secondary-600">
        <span className="font-semibold text-secondary-700 flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-primary-600" /> Popular Locations:
        </span>
        {locations.map((loc) => (
          <Link
            key={loc}
            href={`/search?location=${encodeURIComponent(loc)}`}
            className="px-3 py-1 rounded-full bg-white/90 hover:bg-primary-50 hover:text-primary-700 border border-secondary-200/80 shadow-2xs transition-all hover:scale-105 font-medium"
          >
            {loc}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── 2. WHY CHOOSE PROMOH (TRUST & SAFETY) ───────────────────────────────────
export function WhyChooseUsSection() {
  const features = [
    {
      icon: <ShieldCheck className="w-7 h-7 text-primary-600" />,
      bg: "bg-primary-50",
      border: "border-primary-100",
      title: "100% Identity Verified Pros",
      desc: "Every service professional undergoes government ID verification, phone check, and profile review before taking bookings.",
    },
    {
      icon: <CreditCard className="w-7 h-7 text-emerald-600" />,
      bg: "bg-emerald-50",
      border: "border-emerald-100",
      title: "Payment Protection Guarantee",
      desc: "Funds are held securely. You only complete and settle payment after the service has been performed to your satisfaction.",
    },
    {
      icon: <MessageSquare className="w-7 h-7 text-indigo-600" />,
      bg: "bg-indigo-50",
      border: "border-indigo-100",
      title: "Live Chat & Instant Quotes",
      desc: "Chat directly with pros, share pictures or work documents, negotiate rates, and schedule times seamlessly in-app.",
    },
    {
      icon: <LifeBuoy className="w-7 h-7 text-amber-600" />,
      bg: "bg-amber-50",
      border: "border-amber-100",
      title: "Mediation & Dedicated Support",
      desc: "Our platform resolution center and admin team are always available to mediate disputes, handle changes, and ensure smooth jobs.",
    },
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-white via-slate-50/60 to-white relative">
      <div className="max-w-7xl mx-auto px-4 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 text-primary-800 text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-primary-600" />
            The Promoh Difference
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-secondary-900 tracking-tight">
            Why Thousands Hire With Promoh
          </h2>
          <p className="mt-3 text-secondary-600 text-base sm:text-lg">
            Say goodbye to risky unverified classifieds. Promoh gives you safety, clarity, and peace of mind from hire to completion.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feat, idx) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className={`p-6 rounded-3xl bg-white border ${feat.border} shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col`}
            >
              <div className={`w-14 h-14 rounded-2xl ${feat.bg} flex items-center justify-center mb-5 shrink-0 shadow-2xs`}>
                {feat.icon}
              </div>
              <h3 className="font-bold text-secondary-900 text-lg mb-2">
                {feat.title}
              </h3>
              <p className="text-secondary-600 text-sm leading-relaxed flex-1">
                {feat.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── 3. BECOME A PROVIDER CTA BANNER ──────────────────────────────────────────
export function BecomeProviderBanner() {
  return (
    <section className="py-16 bg-white relative">
      <div className="max-w-7xl mx-auto px-4">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-secondary-900 via-primary-950 to-indigo-950 text-white shadow-2xl p-8 sm:p-12 lg:p-16">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-10 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 grid lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-bold mb-4 border border-white/20">
                <Briefcase className="w-3.5 h-3.5 text-primary-300" />
                For Tradespeople, Contractors & Professionals
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight mb-4">
                Grow Your Business with Promoh.
              </h2>
              <p className="text-primary-100 text-base sm:text-lg max-w-2xl leading-relaxed mb-6">
                Join thousands of verified local professionals. Set your own hourly or fixed rates, receive direct booking requests, chat with clients in real-time, and get guaranteed payouts.
              </p>

              <div className="grid sm:grid-cols-3 gap-3 mb-8">
                <div className="flex items-center gap-2 text-sm text-primary-100">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Zero Upfront Membership Fees</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-primary-100">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Direct Secure Client Payouts</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-primary-100">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Keep 90% of Every Job</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Link href="/register/provider">
                  <Button size="lg" className="bg-primary-500 hover:bg-primary-600 text-white font-bold h-12 px-6 rounded-2xl shadow-lg shadow-primary-500/20">
                    Apply to Become a Provider <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/provider/login">
                  <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 h-12 px-6 rounded-2xl">
                    Provider Sign In
                  </Button>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-4 hidden lg:flex justify-end">
              <div className="bg-white/10 backdrop-blur-md border border-white/15 p-6 rounded-3xl w-full max-w-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-bold text-lg shadow-md">
                    $
                  </div>
                  <div>
                    <p className="text-xs text-primary-200 uppercase font-bold">Fast Payouts</p>
                    <p className="text-xl font-black text-white">Direct to Bank / Stripe</p>
                  </div>
                </div>
                <p className="text-xs text-primary-100 border-t border-white/10 pt-3 leading-relaxed">
                  "Promoh helped me fill my weekly schedule with plumbing jobs in my local neighborhood. Best platform for trades."
                </p>
                <span className="text-[11px] text-primary-300 font-semibold block">
                  — Verified Local Contractor
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 4. INTERACTIVE FAQ ACCORDION ─────────────────────────────────────────────
interface FaqItem {
  q: string;
  a: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    q: "How does booking a service professional work on Promoh?",
    a: "Browse or search for your required service (e.g. plumbing, electrical, cleaning), compare verified provider profiles, and select your preferred date and time. The provider confirms your request, and you can chat directly to discuss job details before they arrive.",
  },
  {
    q: "When and how do I pay for the service?",
    a: "Payment is safe and hassle-free. You do not pay until the provider has completed the service. Once marked complete, an official itemized invoice is generated in your dashboard where you can securely settle via Stripe or credit card and download a receipt.",
  },
  {
    q: "How are service providers verified?",
    a: "Every provider on Promoh submits their government-issued ID, business contact info, and trade credentials for manual administrator review. Approved providers earn a verified badge, and their customer reviews and trust scores are updated live after every job.",
  },
  {
    q: "What happens if a provider doesn't show up or I am unsatisfied?",
    a: "Promoh includes a Customer Protection Guarantee. Because payment is only finalized after completion, you are never charged for unfulfilled jobs. In the rare event of an issue, you can file a dispute directly in your dashboard or contact our 24/7 support team.",
  },
  {
    q: "Can I reschedule or cancel my booking?",
    a: "Yes! In your Customer Dashboard, any pending or confirmed booking can be rescheduled with a few clicks by selecting a new date and time slot. You can also cancel free of charge before the service begins.",
  },
  {
    q: "How do I apply to become a service provider?",
    a: "Simply click 'Become a Provider' at the top of the page or in the footer. Fill in your business details, the services you provide, your hourly rate, and upload your ID. Our admin team reviews applications within 24 hours.",
  },
];

export function FaqAccordionSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (i: number) => {
    setOpenIndex(openIndex === i ? null : i);
  };

  return (
    <section className="py-20 bg-secondary-50/70 border-t border-secondary-100">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 text-primary-800 text-xs font-bold uppercase tracking-wider mb-3">
            Questions & Answers
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-secondary-900 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="mt-2 text-secondary-600 text-base sm:text-lg">
            Everything you need to know about hiring and working with professionals on Promoh.
          </p>
        </div>

        <div className="space-y-3.5">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={item.q}
                className="bg-white rounded-2xl border border-secondary-200/90 shadow-2xs overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="w-full text-left p-5 sm:p-6 flex items-center justify-between gap-4 font-bold text-secondary-900 hover:text-primary-600 transition-colors"
                >
                  <span className="text-base sm:text-lg">{item.q}</span>
                  <span
                    className={`w-8 h-8 rounded-full bg-secondary-100 flex items-center justify-center shrink-0 transition-transform duration-300 ${
                      isOpen ? "rotate-180 bg-primary-50 text-primary-600" : "text-secondary-500"
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </span>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-6 sm:px-6 sm:pb-6 text-secondary-600 text-sm sm:text-base leading-relaxed border-t border-secondary-100 pt-4">
                        {item.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center p-6 bg-white rounded-2xl border border-secondary-200/80 shadow-2xs">
          <p className="text-sm text-secondary-600">
            Still have questions? Our support team is ready to help 24/7.
          </p>
          <a
            href="mailto:promoh321@gmail.com?subject=Inquiry%20from%20Promoh%20Homepage"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-600 hover:text-primary-700 mt-2"
          >
            Contact Customer Support <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
