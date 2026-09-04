import { Button } from "@/components/ui/Button";
import { ShieldCheck, ArrowRight, Mail, Laptop } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import { HeroInteractive, ExploreCategoriesGrid, FeaturedProvidersSection } from "@/components/home/HomeClientWidgets";
import { HowItWorks } from "@/components/home/HowItWorks";

export const metadata = {
  title: "Promoh | Find Trusted Professionals Anywhere",
  description: "Find. Compare. Chat. Book. Done. The world's most trusted marketplace for hiring local service experts.",
};

export default function Home() {
  return (
    <main className="flex-1">
      {/* Navigation */}
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-24 pb-32 overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary-200/30 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-indigo-200/30 blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 relative z-10 text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-md text-primary-700 text-sm font-semibold mb-6 border border-primary-100 shadow-sm animate-fade-in-up">
            <ShieldCheck className="w-4 h-4 text-primary-600" />
            <span>100% Verified Professionals Worldwide</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-secondary-900 max-w-4xl leading-tight animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            Find Trusted Professionals{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-indigo-600">Anywhere.</span>
          </h1>

          <p className="mt-6 text-xl text-secondary-600 max-w-2xl animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            Find. Compare. Chat. Book. Done. The world's most trusted marketplace for hiring local service experts.
          </p>

          {/* Client-side search and pills */}
          <HeroInteractive />
        </div>
      </section>

      {/* Online Work Banner */}
      <section className="py-12 bg-white relative border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="bg-gradient-to-r from-primary-900 to-indigo-900 rounded-3xl overflow-hidden shadow-xl">
            <div className="px-6 py-10 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex-1 text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold mb-4 border border-white/20">
                  <span className="flex h-2 w-2 rounded-full bg-green-400"></span>
                  New Public Job Board
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Need Online Work Done?
                </h2>
                <p className="text-primary-100 text-lg max-w-xl">
                  Logos, websites, social media, and more. Post your job to our public board and let talented digital professionals come to you.
                </p>
              </div>
              <div className="flex-shrink-0 w-full md:w-auto">
                <Link href="/online-work" className="block">
                  <Button variant="primary" size="lg" className="w-full bg-white text-primary-900 hover:bg-gray-50 flex items-center justify-center gap-2">
                    <Laptop className="w-5 h-5" />
                    Post a Digital Job
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Service Categories */}
      <section className="py-20 bg-white relative">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-secondary-900">Explore Categories</h2>
              <p className="text-secondary-600 mt-2">Click any category to browse verified professionals.</p>
            </div>
            <Link href="/search">
              <Button variant="outline" className="hidden sm:flex items-center gap-2 rounded-full hover:bg-secondary-50">
                View All <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
          
          <ExploreCategoriesGrid />
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gradient-to-br from-secondary-50 to-blue-50/30 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold tracking-tight text-secondary-900">How Promoh Works</h2>
            <p className="text-secondary-600 mt-3 text-lg">Your easiest path to hiring trusted professionals.</p>
          </div>
          <HowItWorks />
        </div>
      </section>

      {/* Featured Providers */}
      <section className="py-24 bg-white relative">
        <div className="absolute right-0 top-0 w-1/3 h-full bg-gradient-to-l from-primary-50/50 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-secondary-900">Featured Professionals</h2>
              <p className="text-secondary-600 mt-2">Hand-picked verified experts ready to help you today.</p>
            </div>
            <Link href="/search">
              <Button variant="outline" className="hidden sm:flex items-center gap-2 rounded-full hover:bg-secondary-50">
                View All <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          <FeaturedProvidersSection />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-secondary-200 text-secondary-600 py-16 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-4 gap-12 relative z-10">
          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Image src="/logo.png" alt="Promoh Logo" width={40} height={40} className="w-auto h-8 object-contain" />
              <span className="text-2xl font-bold text-secondary-900 tracking-tight">Promoh</span>
            </div>
            <p className="mb-6 text-sm leading-relaxed text-secondary-500">Find. Compare. Chat. Book. Done. The world's trusted marketplace for service professionals.</p>
            <a href="mailto:support@promoh.com" id="contact-support-btn"
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold hover:from-primary-700 hover:to-primary-800 transition-all shadow-md text-sm w-full justify-center group">
              <Mail className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
              Contact Support
            </a>
          </div>
          <div>
            <h4 className="text-secondary-900 font-bold mb-4">Customers</h4>
            <ul className="space-y-3 text-sm font-medium">
              <li><Link href="/search" className="hover:text-primary-600 transition-colors">Find a Professional</Link></li>
              <li><Link href="/login" className="hover:text-primary-600 transition-colors">Log In</Link></li>
              <li><Link href="/register" className="hover:text-primary-600 transition-colors">Sign Up</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-secondary-900 font-bold mb-4">Providers</h4>
            <ul className="space-y-3 text-sm font-medium">
              <li><Link href="/provider/register" className="hover:text-primary-600 transition-colors">Join as a Provider</Link></li>
              <li><Link href="/provider/login" className="hover:text-primary-600 transition-colors">Provider Login</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-secondary-900 font-bold mb-4">Legal</h4>
            <ul className="space-y-3 text-sm font-medium">
              <li><Link href="/terms" className="hover:text-primary-600 transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-primary-600 transition-colors">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-12 pt-8 border-t border-secondary-100 text-center text-sm text-secondary-400 font-medium">
          <p>© {new Date().getFullYear()} Promoh. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
