"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertCircle, RefreshCw, Home, Mail } from "lucide-react";

export default function GlobalError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    // Log unexpected client-side crash
    console.error("Promoh runtime error:", error);
  }, [error]);

  const handleRetry = () => {
    if (reset) reset();
    else if (unstable_retry) unstable_retry();
    else if (typeof window !== "undefined") window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-secondary-200 shadow-xl">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <Image src="/logo.png" alt="Promoh" width={40} height={40} className="w-auto h-9 object-contain" />
          <span className="text-xl font-bold text-secondary-900 tracking-tight">Promoh</span>
        </div>

        {/* Error Icon */}
        <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100">
          <AlertCircle className="w-7 h-7" />
        </div>

        <h1 className="text-xl font-bold text-secondary-900 mb-2">
          Something went wrong
        </h1>
        <p className="text-secondary-600 text-sm mb-6 leading-relaxed">
          An unexpected error occurred while loading this page. Our team has been notified.
        </p>

        {error.digest && (
          <div className="bg-slate-50 rounded-xl p-2.5 text-xs text-secondary-400 font-mono mb-6 border border-slate-200 break-all">
            Reference code: {error.digest}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2.5">
          <button
            onClick={handleRetry}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm transition-all shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <Link
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-secondary-100 hover:bg-secondary-200 text-secondary-800 font-semibold text-sm transition-all"
          >
            <Home className="w-4 h-4" />
            Return to Homepage
          </Link>
        </div>

        {/* Support */}
        <div className="mt-6 pt-4 border-t border-secondary-100 text-xs text-secondary-500 flex items-center justify-center gap-1.5">
          <Mail className="w-3.5 h-3.5 text-secondary-400" />
          <span>Need help? Contact</span>
          <a href="mailto:promoh321@gmail.com" className="text-primary-600 font-medium hover:underline">
            promoh321@gmail.com
          </a>
        </div>
      </div>
    </div>
  );
}
