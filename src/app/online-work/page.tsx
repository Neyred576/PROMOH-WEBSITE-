"use client";

import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Laptop, Briefcase, ChevronRight, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function OnlineWorkPage() {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    serviceType: "",
    otherServiceType: "",
    description: "",
    budget: "",
    deadline: "",
    contactDetails: user?.email || "",
  });

  const [error, setError] = useState<string | null>(null);

  const serviceOptions = [
    "Logo Design",
    "Instagram/Social Media Posts",
    "Website Development",
    "Flyer/Brochure Design",
    "Copywriting",
    "Virtual Assistant",
    "Video Editing",
    "Other"
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!formData.serviceType) {
        throw new Error("Please select a service type.");
      }
      if (!formData.description) {
        throw new Error("Please provide a description of the work.");
      }
      if (!formData.contactDetails) {
        throw new Error("Please provide your contact details.");
      }

      const finalServiceType = formData.serviceType === "Other" 
        ? formData.otherServiceType || "Other" 
        : formData.serviceType;

      await addDoc(collection(db, "digital_requests"), {
        userId: user?.uid || null,
        serviceType: finalServiceType,
        description: formData.description,
        budget: formData.budget,
        deadline: formData.deadline,
        contactDetails: formData.contactDetails,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-100">
          <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Job Posted Successfully!</h2>
          <p className="text-gray-600 mb-8">
            Your request is now live on the Online Jobs board. Providers will review your requirements and reach out to you directly.
          </p>
          <div className="space-y-3">
            <Link href="/online-jobs" className="block">
              <Button variant="primary" className="w-full">View Job Board</Button>
            </Link>
            <Link href="/" className="block">
              <Button variant="outline" className="w-full">Return Home</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-primary-100 rounded-full mb-4">
            <Laptop className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl mb-4">
            Need Online Work Done?
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Tell us what you need. Post your task to our public job board and let talented digital professionals come to you.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
          <div className="bg-primary-50 px-6 py-4 border-b border-primary-100 flex items-center gap-3">
            <Briefcase className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-primary-900">Digital Service Request</h2>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="serviceType" className="block text-sm font-medium text-gray-700 mb-1">
                  What kind of service do you need? <span className="text-red-500">*</span>
                </label>
                <select
                  id="serviceType"
                  name="serviceType"
                  value={formData.serviceType}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-white"
                  required
                >
                  <option value="" disabled>Select a service...</option>
                  {serviceOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              {formData.serviceType === "Other" && (
                <div>
                  <Input
                    label="Please specify the service"
                    name="otherServiceType"
                    value={formData.otherServiceType}
                    onChange={handleChange}
                    required
                  />
                </div>
              )}

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description of the work <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Please describe exactly what you need in detail..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Budget (Optional)"
                  name="budget"
                  value={formData.budget}
                  onChange={handleChange}
                  placeholder="e.g. $50 - $100"
                />
                <Input
                  label="Deadline (Optional)"
                  name="deadline"
                  value={formData.deadline}
                  onChange={handleChange}
                  placeholder="e.g. Within 3 days"
                />
              </div>

              <div>
                <Input
                  label="Contact Email or Phone *"
                  name="contactDetails"
                  value={formData.contactDetails}
                  onChange={handleChange}
                  placeholder="How should we reach you?"
                  required
                />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full flex items-center justify-center gap-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Posting Job..." : "Post Job to Public Board"}
                {!isSubmitting && <ChevronRight className="w-5 h-5" />}
              </Button>
              <p className="text-xs text-center text-gray-500 mt-4">
                By submitting this request, your job will be posted publicly. Logged-in providers will be able to view your contact details to reach out.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
