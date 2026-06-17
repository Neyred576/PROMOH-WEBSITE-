"use client";

import { motion } from "framer-motion";
import { Search, MessageSquare, CheckCircle } from "lucide-react";

const steps = [
  { title: "Search & Compare", desc: "Find verified professionals near you and compare their profiles, prices, and reviews.", icon: <Search className="w-8 h-8 text-primary-600" /> },
  { title: "Chat & Book", desc: "Discuss your project details in real-time and book a time that works for you.", icon: <MessageSquare className="w-8 h-8 text-primary-600" /> },
  { title: "Get it Done", desc: "Your selected professional arrives and completes the job to your satisfaction.", icon: <CheckCircle className="w-8 h-8 text-primary-600" /> }
];

export function HowItWorks() {
  return (
    <div className="grid md:grid-cols-3 gap-10 relative">
      <div className="hidden md:block absolute top-14 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-primary-200 via-primary-400 to-primary-200 opacity-50" />
      {steps.map((step, i) => (
        <motion.div
          key={step.title}
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.6, delay: i * 0.2 }}
          className="relative text-center flex flex-col items-center group"
        >
          <div className="w-28 h-28 mx-auto bg-white/80 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-xl border border-white/50 relative z-10 mb-6 group-hover:-translate-y-2 transition-transform duration-300">
            {step.icon}
            <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center font-bold text-sm shadow-lg">
              {i + 1}
            </div>
          </div>
          <h3 className="text-xl font-bold mb-3 text-secondary-900">{step.title}</h3>
          <p className="text-secondary-600 leading-relaxed max-w-xs">{step.desc}</p>
        </motion.div>
      ))}
    </div>
  );
}
