'use client';

import { useState, useEffect, useCallback } from 'react';
import TripForm from './TripForm';
import SurpriseMeQuiz from './SurpriseMeQuiz';
import DestinationSuggestions from './DestinationSuggestions';
import TrendingDestinations from './TrendingDestinations';
import { QuizAnswers, DestinationSuggestion } from '@/lib/trip-types';

interface Props {
  onCancel?: () => void;
}

export default function EntryTabs({ onCancel }: Props) {
  const [activeTab, setActiveTab] = useState<'direct' | 'surprise'>('direct');
  const [surprisePhase, setSurprisePhase] = useState<'quiz' | 'suggestions'>('quiz');
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswers | null>(null);
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const resetSurprise = useCallback(() => {
    setSurprisePhase('quiz');
    setQuizAnswers(null);
    setSuggestions([]);
  }, []);

  const fetchSuggestions = useCallback((answers: QuizAnswers) => {
    setLoadingSuggestions(true);
    setTimeout(() => {
      setSuggestions([
        {
          city: 'Lisbon',
          country: 'Portugal',
          flightPrice: 450,
          hotelPrice: 85,
          bestFor: `Best for ${answers.vibes[0] || 'travel'}`,
          image: '',
        },
        {
          city: 'Cartagena',
          country: 'Colombia',
          flightPrice: 380,
          hotelPrice: 65,
          bestFor: `Best for ${answers.vibes[1] || 'adventure'}`,
          image: '',
        },
        {
          city: 'Bali',
          country: 'Indonesia',
          flightPrice: 650,
          hotelPrice: 45,
          bestFor: 'Best value',
          image: '',
        },
      ]);
      setLoadingSuggestions(false);
    }, 2000);
  }, []);

  const handleQuizComplete = useCallback(
    (answers: QuizAnswers) => {
      setQuizAnswers(answers);
      setSurprisePhase('suggestions');
      fetchSuggestions(answers);
    },
    [fetchSuggestions]
  );

  const handleRegenerate = useCallback(() => {
    if (quizAnswers) {
      fetchSuggestions(quizAnswers);
    }
  }, [quizAnswers, fetchSuggestions]);

  const handleOpenChat = useCallback(() => {
    window.dispatchEvent(new CustomEvent('open-atlas-chat'));
  }, []);

  useEffect(() => {
    function handlePrefill() {
      setActiveTab('direct');
      resetSurprise();
    }

    window.addEventListener('prefill-destination', handlePrefill);
    return () => {
      window.removeEventListener('prefill-destination', handlePrefill);
    };
  }, [resetSurprise]);

  const tabBase = 'flex-1 py-3 px-4 font-semibold text-sm transition-all';
  const tabActive =
    'bg-white border-2 border-b-0 border-blue-600 text-blue-700 rounded-t-xl';
  const tabInactive =
    'bg-gray-100 border-2 border-transparent text-gray-500 hover:text-gray-700 rounded-t-xl';

  return (
    <div>
      {/* Tab header row */}
      <div className="flex gap-1 relative">
        <button
          onClick={() => setActiveTab('direct')}
          className={`${tabBase} ${activeTab === 'direct' ? tabActive : tabInactive}`}
        >
          ✈ I Know When &amp; Where I&apos;m Going
        </button>
        <button
          onClick={() => setActiveTab('surprise')}
          className={`${tabBase} ${activeTab === 'surprise' ? tabActive : tabInactive}`}
        >
          ✨ Surprise Me
        </button>

        {/* Optional close button */}
        {onCancel && (
          <button
            onClick={onCancel}
            aria-label="Close"
            className="absolute right-0 top-0 -translate-y-full p-1 text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
          >
            ×
          </button>
        )}
      </div>

      {/* Tab content area */}
      <div className="bg-white border-2 border-blue-600 rounded-b-xl rounded-tr-xl p-6">
        {activeTab === 'direct' && <TripForm />}

        {activeTab === 'surprise' && surprisePhase === 'quiz' && (
          <SurpriseMeQuiz onComplete={handleQuizComplete} />
        )}

        {activeTab === 'surprise' && surprisePhase === 'suggestions' && quizAnswers && (
          <DestinationSuggestions
            answers={quizAnswers}
            suggestions={suggestions}
            loading={loadingSuggestions}
            onRegenerate={handleRegenerate}
            onOpenChat={handleOpenChat}
          />
        )}
      </div>

      {/* Trending destinations below tabs */}
      <TrendingDestinations />
    </div>
  );
}
