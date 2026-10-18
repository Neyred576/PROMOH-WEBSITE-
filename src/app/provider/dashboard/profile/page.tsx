"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { db } from "@/lib/firebase/client";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Upload, X, Plus, Clock, DollarSign, Trash2,
  GripVertical, ExternalLink, ImageIcon, Edit2, Check,
  Briefcase, Star, Info, ChevronRight, Sparkles
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import BeforeAfterSlider, { BeforeAfterProject } from "@/components/ui/BeforeAfterSlider";

const IMGBB_KEY = "3a8672d6f05b114ce3c0c6e81c8bd9fe";

const BANNER_PRESETS = [
  { name: "Modern Violet", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1400&q=80" },
  { name: "Emerald Pro", url: "https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&w=1400&q=80" },
  { name: "Dark Slate Mesh", url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1400&q=80" },
  { name: "Warm Sunset", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80" },
];

interface ServiceCard {
  id: string;
  title: string;
  description: string;
  duration: string;
  price: string;
  priceType: "fixed" | "hourly" | "from";
}

async function uploadToImgBB(file: File): Promise<string> {
  const form = new FormData();
  form.append("image", file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!data.success) throw new Error("ImgBB upload failed");
  return data.data.url as string;
}

export default function ProviderProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [activeSection, setActiveSection] = useState<"basic" | "services" | "portfolio" | "transformations">("basic");

  const photoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const portfolioInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const [formData, setFormData] = useState({
    businessName: "",
    description: "",
    servicesOffered: "",
    location: "",
    phone: "",
    hourlyRate: "",
    photoURL: "",
    bannerURL: "",
    currency: "USD",
  });

  const [portfolioURLs, setPortfolioURLs] = useState<string[]>([]);
  const [serviceCards, setServiceCards] = useState<ServiceCard[]>([]);

  // State for Before & After Transformations
  const [beforeAfterProjects, setBeforeAfterProjects] = useState<BeforeAfterProject[]>([]);
  const [showTransformationForm, setShowTransformationForm] = useState(false);
  const [newTransformation, setNewTransformation] = useState<Omit<BeforeAfterProject, "id">>({
    title: "",
    category: "",
    description: "",
    beforeURL: "",
    afterURL: "",
  });
  const [uploadingBeforePhoto, setUploadingBeforePhoto] = useState(false);
  const [uploadingAfterPhoto, setUploadingAfterPhoto] = useState(false);
  const beforePhotoInputRef = useRef<HTMLInputElement>(null);
  const afterPhotoInputRef = useRef<HTMLInputElement>(null);

  // State for editing a service card
  const [editingService, setEditingService] = useState<ServiceCard | null>(null);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [newService, setNewService] = useState<Omit<ServiceCard, "id">>({
    title: "",
    description: "",
    duration: "",
    price: "",
    priceType: "fixed",
  });

  const showMsg = (text: string, ok = true) => {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 4000);
  };

  useEffect(() => {
    async function loadProfile() {
      if (!user?.uid) return;
      try {
        const snap = await getDoc(doc(db, "providers", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setFormData({
            businessName: data.businessName || "",
            description: data.description || "",
            servicesOffered: data.servicesOffered || "",
            location: data.location || "",
            phone: data.phone || "",
            hourlyRate: data.hourlyRate || "",
            photoURL: data.photoURL || "",
            bannerURL: data.bannerURL || "",
            currency: data.currency || "USD",
          });
          setPortfolioURLs(data.portfolioURLs || []);
          setServiceCards(data.serviceCards || []);
          setBeforeAfterProjects(data.beforeAfterProjects || []);
        }
      } catch (e) {
        console.error("Error loading profile", e);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "providers", user.uid), {
        ...formData,
        portfolioURLs,
        serviceCards,
        beforeAfterProjects,
        updatedAt: new Date().toISOString(),
      });
      showMsg("Profile saved successfully!");
    } catch {
      showMsg("Failed to save profile. Please try again.", false);
    } finally {
      setSaving(false);
    }
  };

  // ── Profile photo upload ──
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadToImgBB(file);
      setFormData(prev => ({ ...prev, photoURL: url }));
      if (user?.uid) await updateDoc(doc(db, "providers", user.uid), { photoURL: url });
      showMsg("Photo uploaded!");
    } catch {
      showMsg("Photo upload failed.", false);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ── Cover Banner handlers ──
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBanner(true);
    try {
      const url = await uploadToImgBB(file);
      setFormData(prev => ({ ...prev, bannerURL: url }));
      if (user?.uid) await updateDoc(doc(db, "providers", user.uid), { bannerURL: url });
      showMsg("Banner cover uploaded!");
    } catch {
      showMsg("Banner upload failed.", false);
    } finally {
      setUploadingBanner(false);
    }
  };

  const setBannerPreset = async (url: string) => {
    setFormData(prev => ({ ...prev, bannerURL: url }));
    if (user?.uid) await updateDoc(doc(db, "providers", user.uid), { bannerURL: url });
    showMsg("Banner preset applied!");
  };

  const removeBanner = async () => {
    setFormData(prev => ({ ...prev, bannerURL: "" }));
    if (user?.uid) await updateDoc(doc(db, "providers", user.uid), { bannerURL: "" });
    showMsg("Banner removed (defaults to sleek gradient).");
  };

  // ── Transformation Handlers ──
  const handleUploadBeforeImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBeforePhoto(true);
    try {
      const url = await uploadToImgBB(file);
      setNewTransformation(prev => ({ ...prev, beforeURL: url }));
      showMsg("Before photo uploaded!");
    } catch {
      showMsg("Upload failed.", false);
    } finally {
      setUploadingBeforePhoto(false);
    }
  };

  const handleUploadAfterImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAfterPhoto(true);
    try {
      const url = await uploadToImgBB(file);
      setNewTransformation(prev => ({ ...prev, afterURL: url }));
      showMsg("After photo uploaded!");
    } catch {
      showMsg("Upload failed.", false);
    } finally {
      setUploadingAfterPhoto(false);
    }
  };

  const handleSaveTransformation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTransformation.beforeURL || !newTransformation.afterURL) {
      showMsg("Please upload both Before and After photos.", false);
      return;
    }
    const project: BeforeAfterProject = {
      id: Date.now().toString(),
      title: newTransformation.title || "Transformation Project",
      category: newTransformation.category || formData.servicesOffered.split(",")[0]?.trim() || "Service Work",
      description: newTransformation.description || "",
      beforeURL: newTransformation.beforeURL,
      afterURL: newTransformation.afterURL,
    };
    const updated = [...beforeAfterProjects, project];
    setBeforeAfterProjects(updated);
    if (user?.uid) await updateDoc(doc(db, "providers", user.uid), { beforeAfterProjects: updated });
    setShowTransformationForm(false);
    setNewTransformation({ title: "", category: "", description: "", beforeURL: "", afterURL: "" });
    showMsg("Transformation project saved!");
  };

  const removeTransformation = async (id: string) => {
    const updated = beforeAfterProjects.filter(p => p.id !== id);
    setBeforeAfterProjects(updated);
    if (user?.uid) await updateDoc(doc(db, "providers", user.uid), { beforeAfterProjects: updated });
    showMsg("Transformation removed.");
  };

  // ── Portfolio upload ──
  const handlePortfolioFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (portfolioURLs.length + arr.length > 10) {
      showMsg("Maximum 10 portfolio photos allowed.", false);
      return;
    }
    setUploadingPortfolio(true);
    try {
      const urls = await Promise.all(arr.map(f => uploadToImgBB(f)));
      const updated = [...portfolioURLs, ...urls];
      setPortfolioURLs(updated);
      if (user?.uid) await updateDoc(doc(db, "providers", user.uid), { portfolioURLs: updated });
      showMsg(`${urls.length} photo${urls.length > 1 ? "s" : ""} uploaded!`);
    } catch {
      showMsg("Some photos failed to upload.", false);
    } finally {
      setUploadingPortfolio(false);
    }
  }, [portfolioURLs, user?.uid]);

  const handlePortfolioInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handlePortfolioFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) handlePortfolioFiles(e.dataTransfer.files);
  };

  const removePortfolioPhoto = async (index: number) => {
    const updated = portfolioURLs.filter((_, i) => i !== index);
    setPortfolioURLs(updated);
    if (user?.uid) await updateDoc(doc(db, "providers", user.uid), { portfolioURLs: updated });
  };

  // ── Service cards ──
  const addOrUpdateService = async () => {
    if (!newService.title.trim()) return;
    let updated: ServiceCard[];
    if (editingService) {
      updated = serviceCards.map(s =>
        s.id === editingService.id ? { ...editingService, ...newService } : s
      );
    } else {
      const card: ServiceCard = { id: Date.now().toString(), ...newService };
      updated = [...serviceCards, card];
    }
    setServiceCards(updated);
    if (user?.uid) await updateDoc(doc(db, "providers", user.uid), { serviceCards: updated });
    setShowServiceForm(false);
    setEditingService(null);
    setNewService({ title: "", description: "", duration: "", price: "", priceType: "fixed" });
    showMsg(editingService ? "Service updated!" : "Service added!");
  };

  const removeService = async (id: string) => {
    const updated = serviceCards.filter(s => s.id !== id);
    setServiceCards(updated);
    if (user?.uid) await updateDoc(doc(db, "providers", user.uid), { serviceCards: updated });
  };

  const startEditService = (s: ServiceCard) => {
    setEditingService(s);
    setNewService({ title: s.title, description: s.description, duration: s.duration, price: s.price, priceType: s.priceType });
    setShowServiceForm(true);
  };

  const priceTypeLabel = (t: ServiceCard["priceType"]) =>
    t === "fixed" ? "Fixed Price" : t === "hourly" ? "Per Hour" : "Starting From";

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-secondary-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  const sections = [
    { id: "basic", label: "Basic Info & Cover Banner", icon: <Info className="w-4 h-4" /> },
    { id: "services", label: "Services & Pricing", icon: <Briefcase className="w-4 h-4" /> },
    { id: "portfolio", label: "Portfolio Photos", icon: <ImageIcon className="w-4 h-4" /> },
    { id: "transformations", label: "Before & After", icon: <Sparkles className="w-4 h-4" /> },
  ] as const;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Business Profile</h1>
          <p className="text-secondary-600 mt-1">Manage your public profile, cover banner, services, and portfolio.</p>
        </div>
        <Link
          href={`/provider/${user?.uid}`}
          target="_blank"
          className="flex items-center gap-2 text-sm text-primary-600 font-medium hover:underline"
        >
          View Public Page <ExternalLink className="w-4 h-4" />
        </Link>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 mb-8 bg-secondary-100 p-1 rounded-xl w-fit flex-wrap">
        {sections.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSection === s.id
                ? "bg-white text-secondary-900 shadow-sm font-semibold"
                : "text-secondary-600 hover:text-secondary-900"
            }`}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* ── BASIC INFO ── */}
        {activeSection === "basic" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Cover Banner Card */}
            <Card>
              <CardHeader>
                <CardTitle>Profile Cover Banner</CardTitle>
                <CardDescription>
                  A wide banner displayed across the top of your public storefront page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Banner Preview with Avatar Overlay */}
                <div className="relative h-44 rounded-2xl overflow-hidden border border-secondary-200 bg-secondary-100 shadow-xs">
                  {formData.bannerURL ? (
                    <Image src={formData.bannerURL} alt="Cover Banner" fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-primary-600 via-primary-500 to-indigo-600 flex items-center justify-center">
                      <span className="text-white/80 text-xs font-semibold uppercase tracking-wider">Default Modern Gradient</span>
                    </div>
                  )}
                  {/* Subtle dark gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  
                  {/* Mini Avatar preview on banner */}
                  <div className="absolute bottom-3 left-4 flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl border-2 border-white shadow-md overflow-hidden bg-white relative">
                      {formData.photoURL ? (
                        <Image src={formData.photoURL} alt="Avatar" fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold">
                          {(formData.businessName || "P")[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="text-white drop-shadow">
                      <p className="font-bold text-sm leading-tight">{formData.businessName || "Your Business Name"}</p>
                      <p className="text-[11px] text-white/80">{formData.location || "Location"}</p>
                    </div>
                  </div>
                </div>

                {/* Upload and presets */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      ref={bannerInputRef}
                      onChange={handleBannerUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => bannerInputRef.current?.click()}
                      isLoading={uploadingBanner}
                      className="text-xs h-9"
                    >
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                      {formData.bannerURL ? "Change Custom Banner" : "Upload Custom Banner"}
                    </Button>
                    {formData.bannerURL && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeBanner}
                        className="text-xs h-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      >
                        Remove Banner
                      </Button>
                    )}
                  </div>

                  {/* Preset Pills */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-secondary-400 font-medium mr-1">Presets:</span>
                    {BANNER_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => setBannerPreset(preset.url)}
                        className="px-2.5 py-1 rounded-lg border border-secondary-200 bg-secondary-50 text-secondary-700 hover:bg-primary-50 hover:text-primary-700 hover:border-primary-200 transition-colors text-[11px] font-semibold"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Profile Photo</CardTitle>
                <CardDescription>This appears as your avatar across the platform.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-secondary-100 border-2 border-secondary-200 shrink-0">
                    {formData.photoURL ? (
                      <Image src={formData.photoURL} alt="Profile" fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-secondary-400">
                        <Camera className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div>
                    <input type="file" accept="image/*" ref={photoInputRef} onChange={handlePhotoUpload} className="hidden" />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => photoInputRef.current?.click()}
                      isLoading={uploadingPhoto}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      {formData.photoURL ? "Change Photo" : "Upload Photo"}
                    </Button>
                    <p className="text-xs text-secondary-500 mt-2">JPG, PNG or WebP. Max 5MB.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Business Information</CardTitle>
                <CardDescription>Your public identity on Promoh.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Business / Provider Name</label>
                  <Input
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleChange}
                    placeholder="e.g. John's Plumbing Services"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">About / Bio</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={4}
                    className="flex w-full rounded-xl border border-secondary-300 bg-transparent px-4 py-3 text-sm shadow-sm placeholder:text-secondary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:border-primary-500 focus-visible:ring-primary-500/20 resize-none"
                    placeholder="Tell customers about your experience, qualifications, and why they should choose you..."
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Service Location / City</label>
                    <Input name="location" value={formData.location} onChange={handleChange} placeholder="e.g. Nairobi, Kenya" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Contact Phone</label>
                    <Input name="phone" value={formData.phone} onChange={handleChange} placeholder="+254 700 000 000" />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Base Hourly Rate ({formData.currency})</label>
                    <Input name="hourlyRate" type="number" value={formData.hourlyRate} onChange={handleChange} placeholder="50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Services (comma separated)</label>
                    <Input name="servicesOffered" value={formData.servicesOffered} onChange={handleChange} placeholder="e.g. Pipe repair, Installation" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── SERVICES & PRICING ── */}
        {activeSection === "services" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Service Cards</CardTitle>
                    <CardDescription>Add individual services with their own title, description, and price.</CardDescription>
                  </div>
                  {serviceCards.length < 10 && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => { setEditingService(null); setNewService({ title: "", description: "", duration: "", price: "", priceType: "fixed" }); setShowServiceForm(true); }}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add Service
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add/Edit Service Form */}
                <AnimatePresence>
                  {showServiceForm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 bg-primary-50 border border-primary-200 rounded-xl space-y-4 mb-4">
                        <h3 className="font-semibold text-primary-900">
                          {editingService ? "Edit Service" : "New Service"}
                        </h3>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Service Title *</label>
                            <Input
                              value={newService.title}
                              onChange={e => setNewService(p => ({ ...p, title: e.target.value }))}
                              placeholder="e.g. Full House Deep Clean"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Duration</label>
                            <Input
                              value={newService.duration}
                              onChange={e => setNewService(p => ({ ...p, duration: e.target.value }))}
                              placeholder="e.g. 2-3 hours"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Description</label>
                          <textarea
                            value={newService.description}
                            onChange={e => setNewService(p => ({ ...p, description: e.target.value }))}
                            rows={2}
                            className="flex w-full rounded-xl border border-secondary-300 bg-white px-4 py-2.5 text-sm shadow-sm placeholder:text-secondary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:border-primary-500 focus-visible:ring-primary-500/20 resize-none"
                            placeholder="What does this service include?"
                          />
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Price ({formData.currency || "USD"})</label>
                            <Input
                              type="number"
                              value={newService.price}
                              onChange={e => setNewService(p => ({ ...p, price: e.target.value }))}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Price Type</label>
                            <select
                              value={newService.priceType}
                              onChange={e => setNewService(p => ({ ...p, priceType: e.target.value as ServiceCard["priceType"] }))}
                              className="flex w-full rounded-xl border border-secondary-300 bg-white px-4 py-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:border-primary-500 focus-visible:ring-primary-500/20"
                            >
                              <option value="fixed">Fixed Price</option>
                              <option value="hourly">Per Hour</option>
                              <option value="from">Starting From</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button type="button" variant="ghost" size="sm" onClick={() => { setShowServiceForm(false); setEditingService(null); }}>
                            Cancel
                          </Button>
                          <Button type="button" size="sm" onClick={addOrUpdateService} disabled={!newService.title.trim()}>
                            <Check className="w-4 h-4 mr-1" />
                            {editingService ? "Update" : "Add Service"}
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Service Cards List */}
                {serviceCards.length === 0 && !showServiceForm ? (
                  <div className="text-center py-12 border-2 border-dashed border-secondary-200 rounded-xl">
                    <Briefcase className="w-10 h-10 text-secondary-300 mx-auto mb-3" />
                    <p className="text-secondary-600 font-medium">No services added yet</p>
                    <p className="text-secondary-400 text-sm mt-1">Add individual service cards with specific pricing</p>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4"
                      onClick={() => setShowServiceForm(true)}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add Your First Service
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {serviceCards.map((svc) => (
                      <motion.div
                        key={svc.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-start gap-3 p-4 bg-white border border-secondary-200 rounded-xl hover:border-primary-300 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-secondary-900 truncate">{svc.title}</h4>
                            {svc.price && (
                              <span className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full text-xs font-bold border border-primary-100">
                                {formData.currency} {svc.price} {svc.priceType !== "fixed" && `/ ${svc.priceType === "hourly" ? "hr" : "starting"}`}
                              </span>
                            )}
                            {svc.duration && (
                              <span className="flex items-center gap-1 text-xs text-secondary-500">
                                <Clock className="w-3 h-3" /> {svc.duration}
                              </span>
                            )}
                          </div>
                          {svc.description && (
                            <p className="text-sm text-secondary-500 mt-1 line-clamp-2">{svc.description}</p>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            type="button"
                            onClick={() => startEditService(svc)}
                            className="p-1.5 text-secondary-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeService(svc.id)}
                            className="p-1.5 text-secondary-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
                {serviceCards.length > 0 && (
                  <p className="text-xs text-secondary-400 text-right">{serviceCards.length}/10 services</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── PORTFOLIO ── */}
        {activeSection === "portfolio" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>Work Portfolio</CardTitle>
                    <CardDescription>Upload photos of your past work. These appear on your public profile page.</CardDescription>
                  </div>
                  <span className="text-sm font-semibold text-secondary-500 mt-1">{portfolioURLs.length}/10</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Drop zone */}
                {portfolioURLs.length < 10 && (
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => portfolioInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                      dragOver
                        ? "border-primary-500 bg-primary-50"
                        : "border-secondary-300 bg-secondary-50 hover:border-primary-400 hover:bg-primary-50/50"
                    }`}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      ref={portfolioInputRef}
                      onChange={handlePortfolioInput}
                      className="hidden"
                    />
                    {uploadingPortfolio ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-primary-600 font-medium">Uploading photos...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 pointer-events-none">
                        <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center">
                          <Upload className="w-7 h-7 text-primary-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-secondary-800">Drop photos here or click to browse</p>
                          <p className="text-sm text-secondary-500 mt-1">
                            Upload up to {10 - portfolioURLs.length} more photo{10 - portfolioURLs.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <p className="text-xs text-secondary-400">JPG, PNG or WebP • Max 5MB each</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Portfolio grid */}
                {portfolioURLs.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {portfolioURLs.map((url, i) => (
                      <motion.div
                        key={url}
                        layout
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative aspect-square rounded-xl overflow-hidden bg-secondary-100 border border-secondary-200 group"
                      >
                        <Image src={url} alt={`Portfolio ${i + 1}`} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => removePortfolioPhoto(i)}
                            className="w-9 h-9 bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600 scale-90 hover:scale-100 transition-transform"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          #{i + 1}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {portfolioURLs.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-sm text-secondary-500">No portfolio photos yet. Upload your best work to attract customers!</p>
                  </div>
                )}

                {portfolioURLs.length >= 10 && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <Star className="w-4 h-4 shrink-0" />
                    Maximum 10 photos reached. Delete a photo to add a new one.
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── BEFORE & AFTER TRANSFORMATIONS ── */}
        {activeSection === "transformations" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary-600" />
                    Before & After Transformations
                  </CardTitle>
                  <CardDescription>
                    Visual proof of your work quality. Prospective clients can slide between before and after photos.
                  </CardDescription>
                </div>
                {!showTransformationForm && (
                  <Button
                    type="button"
                    onClick={() => setShowTransformationForm(true)}
                    size="sm"
                    className="gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Add Transformation
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Add New Transformation Form */}
                <AnimatePresence>
                  {showTransformationForm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-5 border-2 border-primary-200 bg-primary-50/20 rounded-2xl space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm text-secondary-900">
                          New Before & After Project
                        </h4>
                        <button
                          type="button"
                          onClick={() => setShowTransformationForm(false)}
                          className="text-secondary-400 hover:text-secondary-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-secondary-700">
                            Project Title *
                          </label>
                          <Input
                            placeholder="e.g. Kitchen Cabinets & Countertop Restoration"
                            value={newTransformation.title}
                            onChange={(e) =>
                              setNewTransformation((prev) => ({ ...prev, title: e.target.value }))
                            }
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-secondary-700">
                            Service Category
                          </label>
                          <Input
                            placeholder="e.g. Deep Cleaning, Carpentry, Painting"
                            value={newTransformation.category}
                            onChange={(e) =>
                              setNewTransformation((prev) => ({ ...prev, category: e.target.value }))
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-secondary-700">
                          Short Description (Optional)
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Explain the problem and what you did to achieve the final result..."
                          value={newTransformation.description}
                          onChange={(e) =>
                            setNewTransformation((prev) => ({ ...prev, description: e.target.value }))
                          }
                          className="w-full text-xs p-3 rounded-xl border border-secondary-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
                        />
                      </div>

                      {/* Photo Uploaders (Side-by-Side) */}
                      <div className="grid sm:grid-cols-2 gap-4 pt-1">
                        {/* Before Photo */}
                        <div className="border border-secondary-200 rounded-xl p-4 bg-white text-center space-y-2">
                          <span className="text-xs font-extrabold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                            Step 1: Before Photo *
                          </span>
                          {newTransformation.beforeURL ? (
                            <div className="relative aspect-video rounded-lg overflow-hidden border border-secondary-200 mt-2">
                              <Image
                                src={newTransformation.beforeURL}
                                alt="Before Preview"
                                fill
                                className="object-cover"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setNewTransformation((prev) => ({ ...prev, beforeURL: "" }))
                                }
                                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center shadow"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="pt-2">
                              <input
                                type="file"
                                accept="image/*"
                                ref={beforePhotoInputRef}
                                onChange={handleUploadBeforeImage}
                                className="hidden"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => beforePhotoInputRef.current?.click()}
                                isLoading={uploadingBeforePhoto}
                                className="w-full text-xs"
                              >
                                <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload "Before" Photo
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* After Photo */}
                        <div className="border border-secondary-200 rounded-xl p-4 bg-white text-center space-y-2">
                          <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            Step 2: After Photo *
                          </span>
                          {newTransformation.afterURL ? (
                            <div className="relative aspect-video rounded-lg overflow-hidden border border-secondary-200 mt-2">
                              <Image
                                src={newTransformation.afterURL}
                                alt="After Preview"
                                fill
                                className="object-cover"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setNewTransformation((prev) => ({ ...prev, afterURL: "" }))
                                }
                                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center shadow"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="pt-2">
                              <input
                                type="file"
                                accept="image/*"
                                ref={afterPhotoInputRef}
                                onChange={handleUploadAfterImage}
                                className="hidden"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => afterPhotoInputRef.current?.click()}
                                isLoading={uploadingAfterPhoto}
                                className="w-full text-xs"
                              >
                                <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload "After" Photo
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-primary-200">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowTransformationForm(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleSaveTransformation}
                          disabled={!newTransformation.beforeURL || !newTransformation.afterURL}
                        >
                          Save Transformation
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* List of Existing Transformations */}
                {beforeAfterProjects.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-6">
                    {beforeAfterProjects.map((project) => (
                      <div key={project.id} className="relative group">
                        <BeforeAfterSlider
                          beforeURL={project.beforeURL}
                          afterURL={project.afterURL}
                          title={project.title}
                          category={project.category}
                          description={project.description}
                        />
                        <button
                          type="button"
                          onClick={() => removeTransformation(project.id)}
                          title="Delete transformation"
                          className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-red-600/90 hover:bg-red-600 text-white flex items-center justify-center shadow-md transition-all hover:scale-110"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-secondary-200 rounded-2xl">
                    <Sparkles className="w-10 h-10 text-secondary-300 mx-auto mb-3" />
                    <h4 className="font-bold text-secondary-800 text-sm">
                      No Before & After projects yet
                    </h4>
                    <p className="text-secondary-400 text-xs mt-1 max-w-sm mx-auto">
                      Add side-by-side transformations of your cleaning, renovations, detailing, or repair jobs to dramatically boost your client bookings.
                    </p>
                    {!showTransformationForm && (
                      <Button
                        type="button"
                        onClick={() => setShowTransformationForm(true)}
                        size="sm"
                        className="mt-4 gap-1.5"
                      >
                        <Plus className="w-4 h-4" /> Add Your First Transformation
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Toast message */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={`p-4 rounded-xl border text-sm font-medium ${
                message.ok
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-red-50 text-red-600 border-red-200"
              }`}
            >
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Save button */}
        <div className="flex justify-between items-center pt-2">
          <p className="text-sm text-secondary-500">
            Changes are saved to your live public profile immediately.
          </p>
          <Button type="submit" isLoading={saving} className="min-w-32">
            <Check className="w-4 h-4 mr-2" />
            Save Profile
          </Button>
        </div>
      </form>
    </div>
  );
}
