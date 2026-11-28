"use client";

import { useState, useEffect, useRef } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { JobGridSkeleton } from "@/components/ui/JobCardSkeleton";
import { Laptop, Briefcase, Clock, DollarSign, Lock, Search, Filter, Sparkles, Radio } from "lucide-react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import { motion, AnimatePresence } from "framer-motion";
import { playNotificationChime } from "@/lib/audio";

interface Job {
  id: string;
  serviceType: string;
  description: string;
  budget?: string;
  deadline?: string;
  contactDetails: string;
  createdAt: any;
}

export default function OnlineJobsPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [revealedContacts, setRevealedContacts] = useState<Set<string>>(new Set());
  const [newJobAlert, setNewJobAlert] = useState<number>(0);
  const isInitialJobsLoad = useRef(true);

  useEffect(() => {
    // Only fetch jobs that are still 'pending'
    const q = query(
      collection(db, "digital_requests"),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Job[];

      if (!isInitialJobsLoad.current) {
        let addedCount = 0;
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            addedCount++;
          }
        });
        if (addedCount > 0) {
          playNotificationChime();
          setNewJobAlert((prev) => prev + addedCount);
        }
      }
      isInitialJobsLoad.current = false;

      setJobs(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleRevealContact = (jobId: string) => {
    if (!user) {
      // Should not happen as button is hidden/disabled, but just in case
      alert("Please log in to view contact details.");
      return;
    }
    setRevealedContacts(prev => new Set(prev).add(jobId));
  };

  const filteredJobs = jobs.filter(job => 
    job.serviceType.toLowerCase().includes(searchTerm.toLowerCase()) || 
    job.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-900 to-indigo-900 py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Online Jobs Board
          </h1>
          <p className="text-xl text-primary-100 max-w-2xl mx-auto">
            Browse requests from customers looking for talented digital professionals. Find your next project today.
          </p>
          <div className="mt-8">
            <Link href="/online-work">
              <Button variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20 backdrop-blur-sm">
                Post a Job Instead
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-12">
        {/* Live Stream Bar */}
        <div className="flex items-center justify-between pb-3 text-xs font-semibold text-secondary-600">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-700 font-bold">Live Stream Active</span>
          </div>
          <span className="bg-primary-50 text-primary-700 px-3 py-1 rounded-full font-bold border border-primary-200">
            {filteredJobs.length} Open Request{filteredJobs.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Search & Filter */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-8 flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative w-full">
            <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search for logos, websites, virtual assistant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
        </div>

        {/* Real-time New Job Notification Banner */}
        <AnimatePresence>
          {newJobAlert > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="mb-6 flex justify-center sticky top-24 z-30"
            >
              <button
                onClick={() => {
                  window.scrollTo({ top: 250, behavior: "smooth" });
                  setNewJobAlert(0);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary-600 to-indigo-600 text-white text-xs font-bold shadow-xl hover:shadow-primary-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
                <span>{newJobAlert} new job{newJobAlert !== 1 ? "s" : ""} posted just now — click to view</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Jobs List */}
        {loading ? (
          <JobGridSkeleton count={4} />
        ) : filteredJobs.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No jobs found</h3>
            <p className="text-gray-500 max-w-md mx-auto mb-6">
              There are currently no open requests matching your search. Check back soon or post a job yourself!
            </p>
            <Link href="/online-work">
              <Button variant="default">Post a Job</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredJobs.map((job) => (
              <div key={job.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row gap-6">
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-sm font-semibold">
                        {job.serviceType}
                      </span>
                      <span className="text-sm text-gray-400 flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {job.createdAt?.toDate ? job.createdAt.toDate().toLocaleDateString() : 'Just now'}
                      </span>
                      {(() => {
                        const isRecent = !job.createdAt || (
                          job.createdAt?.toDate
                            ? (Date.now() - job.createdAt.toDate().getTime()) < 86400000
                            : true
                        );
                        return isRecent ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-200 animate-pulse">
                            <Sparkles className="w-3 h-3 text-amber-600" /> New
                          </span>
                        ) : null;
                      })()}
                    </div>
                    
                    <p className="text-gray-700 mb-6 whitespace-pre-wrap leading-relaxed">
                      {job.description}
                    </p>

                    <div className="flex flex-wrap gap-4 text-sm font-medium text-gray-600 mb-6">
                      {job.budget && (
                        <div className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg">
                          <DollarSign className="w-4 h-4" />
                          Budget: {job.budget}
                        </div>
                      )}
                      {job.deadline && (
                        <div className="flex items-center gap-1.5 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg">
                          <Clock className="w-4 h-4" />
                          Need by: {job.deadline}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="md:w-64 flex flex-col justify-center border-t md:border-t-0 md:border-l border-gray-100 pt-6 md:pt-0 md:pl-6">
                    {user ? (
                      revealedContacts.has(job.id) ? (
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-center animate-fade-in-up">
                          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Customer Contact</p>
                          <a href={`mailto:${job.contactDetails}`} className="text-primary-600 font-medium hover:underline break-all">
                            {job.contactDetails}
                          </a>
                        </div>
                      ) : (
                        <Button 
                          variant="default" 
                          className="w-full h-12"
                          onClick={() => handleRevealContact(job.id)}
                        >
                          Apply / Show Contact
                        </Button>
                      )
                    ) : (
                      <div className="text-center">
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-3">
                          <Lock className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">Contact details are hidden.</p>
                        </div>
                        <Link href="/login" className="block">
                          <Button variant="outline" className="w-full">Log in to Apply</Button>
                        </Link>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
