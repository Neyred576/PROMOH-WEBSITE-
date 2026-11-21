"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { COUNTRIES, CountryItem } from "@/lib/currencies";
import { ChevronDown, Search, X } from "lucide-react";

/** Converts a 2-letter ISO country code into a native flag emoji */
export function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "🌐";
  try {
    const codePoints = countryCode
      .toUpperCase()
      .split("")
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return "🌐";
  }
}

interface PhoneInputProps {
  country: string;
  phoneNumber: string;
  onCountryChange: (countryCode: string, dialCode: string) => void;
  onPhoneChange: (phoneNumber: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
}

export default function PhoneInput({
  country = "US",
  phoneNumber = "",
  onCountryChange,
  onPhoneChange,
  required = false,
  placeholder = "555 0199",
  className = "",
  id,
  name,
  disabled = false,
}: PhoneInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Active country item
  const selectedCountry = useMemo(() => {
    return COUNTRIES.find((c) => c.code.toUpperCase() === country.toUpperCase()) || COUNTRIES[0];
  }, [country]);

  // Filtered countries based on search
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return COUNTRIES;
    const q = searchQuery.toLowerCase().trim();
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.dialCode.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Auto-focus search input when opened
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Handle phone number input with automatic dial code extraction if pasted
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;

    // Check if user typed or pasted an international number starting with +
    if (val.startsWith("+")) {
      for (const c of COUNTRIES) {
        if (val.startsWith(c.dialCode)) {
          onCountryChange(c.code, c.dialCode);
          val = val.slice(c.dialCode.length).trim();
          break;
        }
      }
    }

    onPhoneChange(val);
  };

  const handleSelectCountry = (c: CountryItem) => {
    onCountryChange(c.code, c.dialCode);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div className={`relative flex rounded-xl border border-secondary-300 bg-white transition-all focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20 ${className}`}>
      {/* Country Selector Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-2 border-r border-secondary-200 bg-secondary-50/70 hover:bg-secondary-100 rounded-l-xl text-xs font-semibold text-secondary-800 shrink-0 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        title={`${selectedCountry.name} (${selectedCountry.dialCode})`}
      >
        <span className="text-base leading-none select-none">
          {getFlagEmoji(selectedCountry.code)}
        </span>
        <span className="font-mono text-secondary-900">{selectedCountry.dialCode}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-secondary-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Actual Phone Number Input */}
      <input
        type="tel"
        id={id}
        name={name}
        required={required}
        disabled={disabled}
        value={phoneNumber}
        onChange={handleInputChange}
        placeholder={placeholder}
        className="flex-1 min-w-0 px-3 py-2 text-sm text-secondary-900 bg-transparent focus:outline-none placeholder:text-secondary-400"
      />

      {/* Searchable Modal / Dropdown of All 240+ Countries */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 mt-1.5 w-72 sm:w-80 max-h-72 bg-white rounded-xl shadow-2xl border border-secondary-200 z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Search Header */}
          <div className="p-2.5 border-b border-secondary-100 bg-secondary-50 flex items-center gap-2">
            <Search className="w-4 h-4 text-secondary-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search country or code (e.g. Kenya, +254)..."
              className="flex-1 text-xs bg-transparent focus:outline-none text-secondary-900 placeholder:text-secondary-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-secondary-400 hover:text-secondary-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Country List */}
          <div className="overflow-y-auto flex-1 divide-y divide-secondary-50 text-xs">
            {filteredCountries.length === 0 ? (
              <div className="p-4 text-center text-secondary-400 text-xs">
                No matching countries found.
              </div>
            ) : (
              filteredCountries.map((c) => {
                const isSelected = c.code === selectedCountry.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleSelectCountry(c)}
                    className={`w-full px-3 py-2 flex items-center justify-between text-left transition-colors ${
                      isSelected
                        ? "bg-primary-50 text-primary-900 font-bold"
                        : "hover:bg-secondary-50 text-secondary-800"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="text-base select-none shrink-0">{getFlagEmoji(c.code)}</span>
                      <span className="truncate">{c.name}</span>
                    </div>
                    <span className="font-mono text-secondary-500 font-semibold shrink-0">
                      {c.dialCode}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
