"use client";

import Link from "next/link";
import { ShieldOff, Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

export default function BannedPage() {
  return (
    <div className="min-h-screen bg-secondary-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center p-6 sm:p-8 border-red-200 shadow-xl bg-white">
        <CardContent className="pt-4 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-6">
            <ShieldOff className="w-8 h-8" />
          </div>

          <h1 className="text-2xl font-bold text-secondary-900 mb-2">Account Suspended</h1>
          
          <p className="text-secondary-600 text-sm leading-relaxed mb-6">
            Your account has been suspended for violating our Terms of Service or community guidelines. If you believe this action was taken in error, please contact our support team.
          </p>

          <div className="w-full space-y-3">
            <a
              href="mailto:promoh321@gmail.com?subject=Account%20Suspension%20Appeal"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-colors shadow-sm"
            >
              <Mail className="w-4 h-4" />
              Contact Support (promoh321@gmail.com)
            </a>

            <Link href="/" className="w-full block">
              <Button variant="outline" className="w-full text-secondary-600">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Homepage
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
