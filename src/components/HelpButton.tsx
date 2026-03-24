"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { HELP_CONTENT } from "@/lib/help-content";

interface HelpButtonProps {
  pageId: string;
}

export default function HelpButton({ pageId }: HelpButtonProps) {
  const t = useTranslations("help");
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const content = HELP_CONTENT[pageId];

  // Pulse animation on first visit (per page)
  useEffect(() => {
    const key = `help-seen-${pageId}`;
    if (!localStorage.getItem(key)) {
      setPulse(true);
      const timer = setTimeout(() => {
        setPulse(false);
        localStorage.setItem(key, "1");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [pageId]);

  // Stop pulse when user opens the panel
  const handleOpen = useCallback(() => {
    setOpen(true);
    setPulse(false);
    const key = `help-seen-${pageId}`;
    localStorage.setItem(key, "1");
  }, [pageId]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  if (!content) return null;

  return (
    <>
      {/* Floating help button */}
      <button
        ref={buttonRef}
        onClick={() => (open ? setOpen(false) : handleOpen())}
        aria-label="Help"
        className={`fixed bottom-6 left-6 z-40 w-12 h-12 rounded-full bg-orange-500 text-white shadow-lg
          flex items-center justify-center text-xl font-bold
          hover:bg-orange-600 transition-colors cursor-pointer
          ${pulse ? "animate-help-pulse" : ""}`}
      >
        ?
      </button>

      {/* Backdrop (mobile-friendly dismiss target) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Slide-out panel */}
      <div
        ref={panelRef}
        className={`fixed top-0 left-0 z-50 h-full w-80 bg-white shadow-2xl
          transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">{content.title}</h2>
          <button
            onClick={() => setOpen(false)}
            aria-label={t("closePanel")}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Panel body */}
        <div className="overflow-y-auto h-[calc(100%-57px)] px-5 py-4">
          <p className="text-sm text-gray-600 mb-5">{content.intro}</p>

          <div className="space-y-4">
            {content.sections.map((section, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-bold text-gray-900 mb-1">{section.heading}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{section.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </>
  );
}
