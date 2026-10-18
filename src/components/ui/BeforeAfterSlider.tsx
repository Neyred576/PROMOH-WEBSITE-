"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import { Sparkles, MoveHorizontal } from "lucide-react";

export interface BeforeAfterProject {
  id: string;
  title: string;
  category?: string;
  beforeURL: string;
  afterURL: string;
  description?: string;
}

interface BeforeAfterSliderProps {
  beforeURL: string;
  afterURL: string;
  title?: string;
  description?: string;
  category?: string;
  className?: string;
}

export default function BeforeAfterSlider({
  beforeURL,
  afterURL,
  title,
  description,
  category,
  className = "",
}: BeforeAfterSliderProps) {
  const [sliderPos, setSliderPos] = useState(50); // percentage 0 - 100
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    let pos = (x / rect.width) * 100;
    if (pos < 0) pos = 0;
    if (pos > 100) pos = 100;
    setSliderPos(pos);
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    handleMove(e.touches[0].clientX);
  }, [isDragging, handleMove]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  }, [isDragging, handleMove]);

  const handleStopDragging = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleStopDragging);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleStopDragging);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleStopDragging);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleStopDragging);
    };
  }, [isDragging, handleMouseMove, handleTouchMove, handleStopDragging]);

  return (
    <div className={`overflow-hidden rounded-2xl border border-secondary-200 bg-white shadow-sm ${className}`}>
      {/* Title Header */}
      {(title || category) && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-secondary-100 bg-secondary-50/50">
          <div>
            {category && (
              <span className="text-[11px] font-bold text-primary-600 uppercase tracking-wider">
                {category}
              </span>
            )}
            {title && (
              <h4 className="font-bold text-secondary-900 text-sm">{title}</h4>
            )}
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-secondary-500 bg-white px-2.5 py-1 rounded-full border border-secondary-200">
            <Sparkles className="w-3.5 h-3.5 text-primary-500" /> Drag slider to compare
          </span>
        </div>
      )}

      {/* Comparison Viewport */}
      <div
        ref={containerRef}
        onMouseDown={(e) => {
          setIsDragging(true);
          handleMove(e.clientX);
        }}
        onTouchStart={(e) => {
          setIsDragging(true);
          handleMove(e.touches[0].clientX);
        }}
        className="relative aspect-[16/10] sm:aspect-[16/9] w-full select-none cursor-ew-resize bg-secondary-100 overflow-hidden"
      >
        {/* AFTER Image (Full background) */}
        <div className="absolute inset-0">
          <Image
            src={afterURL}
            alt="After"
            fill
            className="object-cover pointer-events-none"
            priority={false}
          />
          {/* Label AFTER */}
          <span className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md text-white text-xs font-bold uppercase tracking-wider pointer-events-none shadow">
            After
          </span>
        </div>

        {/* BEFORE Image (Clipped by slider position) */}
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{ width: `${sliderPos}%` }}
        >
          <div className="relative w-full h-full" style={{ width: containerRef.current?.clientWidth || "100%" }}>
            <Image
              src={beforeURL}
              alt="Before"
              fill
              className="object-cover"
              priority={false}
            />
          </div>
          {/* Label BEFORE */}
          <span className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md text-white text-xs font-bold uppercase tracking-wider pointer-events-none shadow">
            Before
          </span>
        </div>

        {/* Divider Bar & Handle */}
        <div
          className="absolute top-0 bottom-0 z-20 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] pointer-events-none"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-white text-secondary-800 shadow-xl border-2 border-primary-500 flex items-center justify-center transition-transform hover:scale-110 active:scale-95">
            <MoveHorizontal className="w-4 h-4 text-primary-600" />
          </div>
        </div>
      </div>

      {/* Description Footer */}
      {description && (
        <div className="p-4 bg-white border-t border-secondary-100">
          <p className="text-xs text-secondary-600 leading-relaxed">{description}</p>
        </div>
      )}
    </div>
  );
}
