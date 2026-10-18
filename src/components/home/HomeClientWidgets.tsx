"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { Search, MapPin, ShieldCheck, Star, ArrowRight, AlertTriangle, Zap, Wrench, SprayCan, GraduationCap, Camera, Car, Hammer, Paintbrush, Package, Scissors, Monitor, Home as HomeIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getDb } from "@/lib/firebase/client";
import { collection, query, where, limit, doc, onSnapshot } from "firebase/firestore";

interface FeaturedProvider {
  id: string;
  businessName: string;
  firstName: string;
  lastName: string;
  servicesOffered: string;
  location: string;
  hourlyRate: string;
  photoURL?: string;
  rating?: number;
  reviewCount?: number;
  isVerified?: boolean;
}

const defaultCategoryMap: Record<string, { icon: React.ReactNode, color: string, bg: string }> = {
  "Electricians": { icon: <Zap className="w-8 h-8" />, color: "text-yellow-500", bg: "bg-yellow-50" },
  "Plumbers": { icon: <Wrench className="w-8 h-8" />, color: "text-blue-500", bg: "bg-blue-50" },
  "Cleaners": { icon: <SprayCan className="w-8 h-8" />, color: "text-green-500", bg: "bg-green-50" },
  "Tutors": { icon: <GraduationCap className="w-8 h-8" />, color: "text-purple-500", bg: "bg-purple-50" },
  "Photographers": { icon: <Camera className="w-8 h-8" />, color: "text-pink-500", bg: "bg-pink-50" },
  "Mechanics": { icon: <Car className="w-8 h-8" />, color: "text-red-500", bg: "bg-red-50" },
  "Carpenters": { icon: <Hammer className="w-8 h-8" />, color: "text-amber-700", bg: "bg-amber-50" },
  "Painters": { icon: <Paintbrush className="w-8 h-8" />, color: "text-teal-500", bg: "bg-teal-50" },
  "Movers": { icon: <Package className="w-8 h-8" />, color: "text-orange-500", bg: "bg-orange-50" },
  "Beauty Pros": { icon: <Scissors className="w-8 h-8" />, color: "text-rose-500", bg: "bg-rose-50" },
  "IT Specialists": { icon: <Monitor className="w-8 h-8" />, color: "text-indigo-500", bg: "bg-indigo-50" },
  "Home Repair": { icon: <HomeIcon className="w-8 h-8" />, color: "text-secondary-600", bg: "bg-secondary-100" },
};

const getCategoryStyles = (name: string) => {
  return defaultCategoryMap[name] || { icon: <Search className="w-8 h-8" />, color: "text-primary-500", bg: "bg-primary-50" };
};

export function HeroInteractive() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [popularCategories, setPopularCategories] = useState<string[]>([]);
  const [activeEmergencyServices, setActiveEmergencyServices] = useState<{name: string, slug: string}[]>([]);

  const handleSearch = useCallback(() => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (locationQuery.trim()) params.set("location", locationQuery.trim());
    router.push(`/search?${params.toString()}`);
  }, [searchQuery, locationQuery, router]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  useEffect(() => {
    const db = getDb();
    const unsubSettings = onSnapshot(doc(db, "platform_settings", "homepage"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.popularCategories) setPopularCategories(data.popularCategories);
        if (data.emergencyServices) setActiveEmergencyServices(data.emergencyServices);
      }
    });
    return () => unsubSettings();
  }, []);

  return (
    <div className="w-full flex flex-col items-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
        className="mt-10 w-full max-w-3xl bg-white/70 backdrop-blur-xl p-2 md:p-3 rounded-full shadow-2xl shadow-primary-900/10 flex flex-col md:flex-row gap-2 border border-white/50"
      >
        <div className="flex-1 relative flex items-center">
          <Search className="absolute left-4 w-5 h-5 text-secondary-400 pointer-events-none" />
          <Input
            id="search-service"
            placeholder="What service do you need?"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 pl-12 h-14 text-base rounded-full"
          />
        </div>
        <div className="hidden md:block w-px h-10 bg-secondary-200 my-auto" />
        <div className="flex-1 relative flex items-center">
          <MapPin className="absolute left-4 w-5 h-5 text-secondary-400 pointer-events-none" />
          <Input
            id="search-location"
            placeholder="Location (city, country)"
            value={locationQuery}
            onChange={(e) => setLocationQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 pl-12 h-14 text-base rounded-full"
          />
        </div>
        <Button id="search-btn" size="lg" className="h-14 px-8 md:w-auto w-full rounded-full shadow-lg shadow-primary-500/25 transition-transform hover:scale-105 active:scale-95" onClick={handleSearch}>
          <Search className="w-4 h-4 mr-2" /> Search
        </Button>
      </motion.div>

      {/* Quick category pills */}
      {popularCategories.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-8 flex flex-wrap justify-center gap-3 text-sm"
        >
          <span className="text-secondary-500 font-medium my-auto mr-1">Popular:</span>
          {popularCategories.map((cat) => (
            <Link key={cat} href={`/search?q=${cat}`}
              className="px-4 py-2 rounded-full border border-secondary-200 bg-white/50 backdrop-blur-sm hover:border-primary-500 hover:bg-white hover:text-primary-600 hover:shadow-md hover:-translate-y-0.5 transition-all">
              {cat}
            </Link>
          ))}
        </motion.div>
      )}

      {/* Emergency Services Banner */}
      {activeEmergencyServices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.7 }}
          className="mt-6 flex flex-wrap justify-center gap-3"
        >
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-50/80 backdrop-blur-md border border-red-200 text-red-700 text-sm font-medium shadow-sm">
            <AlertTriangle className="w-4 h-4 animate-pulse" />
            Emergency Services Available 24/7:
          </div>
          {activeEmergencyServices.map((svc) => (
            <Link key={svc.name} href={`/search?q=${svc.slug}&emergency=true`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-600 text-white text-sm font-medium hover:bg-red-700 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <Zap className="w-4 h-4" /> {svc.name}
            </Link>
          ))}
        </motion.div>
      )}
    </div>
  );
}

export function ExploreCategoriesGrid() {
  const [activeExploreCategories, setActiveExploreCategories] = useState<{name: string, slug: string}[]>([]);

  useEffect(() => {
    const db = getDb();
    const unsubSettings = onSnapshot(doc(db, "platform_settings", "homepage"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.exploreCategories) {
          setActiveExploreCategories(data.exploreCategories);
        } else {
          setActiveExploreCategories(Object.keys(defaultCategoryMap).map(name => ({ name, slug: name })));
        }
      } else {
        setActiveExploreCategories(Object.keys(defaultCategoryMap).map(name => ({ name, slug: name })));
      }
    });
    return () => unsubSettings();
  }, []);

  if (activeExploreCategories.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {activeExploreCategories.map((cat, i) => {
        const styles = getCategoryStyles(cat.name);
        return (
        <motion.div
          key={cat.name}
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ delay: i * 0.04 }}
        >
          <Link href={`/search?q=${cat.slug}`}>
            <Card className="hover:border-primary-400 hover:shadow-xl hover:-translate-y-1 cursor-pointer transition-all duration-300 group overflow-hidden h-full bg-white/80 backdrop-blur-sm border-secondary-100">
              <CardContent className="p-5 flex flex-col items-center text-center gap-3">
                <div className={`w-14 h-14 rounded-2xl ${styles.bg} ${styles.color} flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-sm`}>
                  {styles.icon}
                </div>
                <span className="font-semibold text-sm text-secondary-800">{cat.name}</span>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      )})}
    </div>
  );
}

export function FeaturedProvidersSection() {
  const [featuredProviders, setFeaturedProviders] = useState<FeaturedProvider[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);

  useEffect(() => {
    const db = getDb();
    const q = query(
      collection(db, "providers"),
      where("status", "==", "Approved"),
      where("isFeatured", "==", true),
      limit(6)
    );
    
    const unsubFeatured = onSnapshot(q, (snapshot) => {
      const providers: FeaturedProvider[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as Omit<FeaturedProvider, "id">
      }));
      setFeaturedProviders(providers);
      setLoadingFeatured(false);
    }, (error) => {
      console.error("Featured providers sync error:", error);
      setFeaturedProviders([]);
      setLoadingFeatured(false);
    });
    
    return () => unsubFeatured();
  }, []);

  if (loadingFeatured) {
    return (
      <div className="grid md:grid-cols-3 gap-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-secondary-100 h-[380px] bg-white overflow-hidden shadow-sm relative">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent z-10" />
            <div className="h-44 bg-secondary-100 animate-pulse" />
            <div className="p-6">
              <div className="h-6 bg-secondary-200 rounded-md w-2/3 mb-4 animate-pulse" />
              <div className="h-4 bg-secondary-100 rounded-md w-full mb-2 animate-pulse" />
              <div className="h-4 bg-secondary-100 rounded-md w-4/5 mb-6 animate-pulse" />
              <div className="flex justify-between items-center pt-4 border-t border-secondary-50">
                <div className="h-4 bg-secondary-100 rounded-md w-1/3 animate-pulse" />
                <div className="h-6 bg-secondary-200 rounded-md w-1/4 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (featuredProviders.length === 0) {
    return (
      <div className="text-center py-20 border-2 border-dashed border-secondary-200 rounded-2xl bg-white/50 backdrop-blur-sm">
        <ShieldCheck className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-secondary-500">No featured providers yet</h3>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-3 gap-8">
      {featuredProviders.map((provider, i) => (
        <motion.div
          key={provider.id}
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ delay: i * 0.1 }}
        >
          <Link href={`/provider/${provider.id}`}>
            <Card className="overflow-hidden group cursor-pointer hover:shadow-[0_20px_50px_rgba(37,99,235,0.15)] hover:-translate-y-2 transition-all duration-500 border-secondary-100 hover:border-primary-200 bg-white/90 backdrop-blur-md relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500/0 via-transparent to-primary-500/0 group-hover:from-primary-500/5 group-hover:to-indigo-500/5 transition-colors duration-500 pointer-events-none z-0" />
              <div className="h-44 bg-gradient-to-br from-primary-100 to-indigo-100 relative flex items-center justify-center overflow-hidden z-10">
                <div className="absolute inset-0 bg-primary-600/10 group-hover:bg-transparent transition-colors z-10" />
                {provider.photoURL ? (
                  <Image src={provider.photoURL} alt={provider.businessName} fill className="object-cover group-hover:scale-110 transition-transform duration-700" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-white/80 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500">
                    <span className="text-4xl font-bold text-primary-600">
                      {(provider.businessName || provider.firstName || "?")[0].toUpperCase()}
                    </span>
                  </div>
                )}
                {provider.rating && (
                  <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center gap-1 text-sm font-bold shadow-lg z-20">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    {provider.rating.toFixed(1)}
                  </div>
                )}
                {provider.isVerified && (
                  <div className="absolute top-4 left-4 bg-gradient-to-r from-primary-600 to-indigo-600 text-white px-2.5 py-1 rounded-full flex items-center gap-1 text-xs font-bold shadow-lg z-20">
                    <ShieldCheck className="w-3.5 h-3.5" /> Verified
                  </div>
                )}
              </div>
              <CardContent className="p-6 relative">
                <div className="absolute -top-6 right-6 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg group-hover:bg-primary-50 transition-colors z-20">
                  <ArrowRight className="w-5 h-5 text-primary-600 group-hover:translate-x-1 transition-transform" />
                </div>
                <h3 className="font-bold text-xl text-secondary-900 group-hover:text-primary-600 transition-colors tracking-tight pr-10">
                  {provider.businessName || `${provider.firstName} ${provider.lastName}`}
                </h3>
                <p className="text-sm text-secondary-500 mt-1 line-clamp-1">{provider.servicesOffered}</p>
                <div className="flex items-center justify-between text-sm text-secondary-500 mt-4 pt-4 border-t border-secondary-100">
                  <div className="flex items-center gap-1.5 font-medium"><MapPin className="w-4 h-4 text-secondary-400" />{provider.location || "Location N/A"}</div>
                  {provider.hourlyRate && <div className="font-bold text-lg text-primary-700">${provider.hourlyRate}<span className="text-xs text-secondary-400 font-normal">/hr</span></div>}
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
