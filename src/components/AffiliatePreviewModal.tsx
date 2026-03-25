'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface AffiliatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendation: {
    title: string;
    description: string;
    cta: string;
    url: string;
    label: string;
    affiliate_program: string;
    category: string;
  } | null;
  onAddToItinerary: () => void;
  addingToItinerary: boolean;
}

export default function AffiliatePreviewModal({
  isOpen,
  onClose,
  recommendation,
  onAddToItinerary,
  addingToItinerary,
}: AffiliatePreviewModalProps) {
  const t = useTranslations('affiliatePreviewModal');

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen || !recommendation) return null;

  // Category icon mapping
  const categoryIcons: Record<string, string> = {
    hotel: '🏨',
    flight: '✈️',
    car_rental: '🚗',
    cruise: '🚢',
  };

  return (
    <>
      {/* Backdrop with blur */}
      <div
        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal card — centered */}
      <div
        className="fixed inset-0 z-[101] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label={recommendation.title}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header bar with partner branding */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {categoryIcons[recommendation.category] || '🌐'}
              </span>
              <div>
                <p className="text-white font-semibold text-sm">
                  {recommendation.affiliate_program}
                </p>
                <p className="text-orange-100 text-xs">
                  {t('poweredBy', { partner: recommendation.affiliate_program })}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-5 space-y-4">
            <h3 className="text-xl font-bold text-gray-900">
              {recommendation.title}
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              {recommendation.description}
            </p>

            {/* Partner trust badge */}
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <span>{t('trustedPartner')}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 space-y-3">
            {/* Primary CTA — opens partner site */}
            <a
              href={recommendation.url}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={() => setTimeout(onClose, 300)}
              className="block w-full text-center bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {t('continueToPartner', { partner: recommendation.affiliate_program })} →
            </a>

            {/* Secondary — add to itinerary */}
            <button
              onClick={onAddToItinerary}
              disabled={addingToItinerary}
              className="block w-full text-center border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-3 rounded-xl transition-colors disabled:opacity-50"
            >
              {addingToItinerary ? t('adding') : t('addToItinerary')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
