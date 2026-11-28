import Link from "next/link";
import Image from "next/image";
import { Search, Home, ArrowRight, ShieldCheck, Briefcase } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50/30 flex flex-col items-center justify-center px-4 py-16 text-center">
      {/* Brand Header */}
      <div className="mb-8 flex flex-col items-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-4 group">
          <Image
            src="/logo.png"
            alt="Promoh Logo"
            width={48}
            height={48}
            className="w-auto h-12 object-contain group-hover:scale-105 transition-transform"
          />
          <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-indigo-600">
            Promoh
          </span>
        </Link>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold border border-primary-100">
          <ShieldCheck className="w-3.5 h-3.5 text-primary-600" />
          <span>Verified Marketplace</span>
        </div>
      </div>

      {/* 404 Visual Indicator */}
      <div className="relative mb-6">
        <h1 className="text-8xl sm:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary-600/30 via-indigo-600/30 to-purple-600/30 select-none">
          404
        </h1>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl sm:text-2xl font-bold text-secondary-900 bg-white/80 backdrop-blur-sm px-4 py-1.5 rounded-2xl border border-secondary-100 shadow-sm">
            Page Not Found
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="max-w-md text-secondary-600 text-sm sm:text-base mb-8 leading-relaxed">
        The link you followed may be broken, or the page may have been moved or removed. Let&apos;s get you back on track.
      </p>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md justify-center">
        <Link
          href="/search"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all"
        >
          <Search className="w-4 h-4" />
          Find Professionals
        </Link>
        <Link
          href="/"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-secondary-50 text-secondary-700 font-semibold text-sm border border-secondary-200 shadow-xs transition-all"
        >
          <Home className="w-4 h-4" />
          Return Home
        </Link>
      </div>

      {/* Quick Links */}
      <div className="mt-12 pt-8 border-t border-secondary-200/60 max-w-md w-full">
        <p className="text-xs font-semibold text-secondary-400 uppercase tracking-wider mb-4">
          Looking for something specific?
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-secondary-600">
          <Link href="/online-jobs" className="hover:text-primary-600 flex items-center gap-1">
            <Briefcase className="w-3.5 h-3.5" /> Online Jobs <ArrowRight className="w-3 h-3" />
          </Link>
          <Link href="/register/provider" className="hover:text-primary-600 flex items-center gap-1">
            Become a Provider <ArrowRight className="w-3 h-3" />
          </Link>
          <Link href="/login" className="hover:text-primary-600">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
