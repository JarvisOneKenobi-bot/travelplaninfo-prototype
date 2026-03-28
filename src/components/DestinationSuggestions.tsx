'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QuizAnswers, DestinationSuggestion } from '@/lib/trip-types';

interface Props {
  answers: QuizAnswers;
  suggestions: DestinationSuggestion[];
  loading: boolean;
  onRegenerate: () => void;
  onOpenChat: () => void;
}

export default function DestinationSuggestions({
  answers,
  suggestions,
  loading,
  onRegenerate,
  onOpenChat,
}: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-gray-500 animate-pulse text-base">
          Atlas is finding destinations for you...
        </p>
      </div>
    );
  }

  const contextLine = [
    answers.budget_tier,
    answers.vibes.length > 0 ? answers.vibes.join(' + ') : null,
    answers.who,
  ]
    .filter(Boolean)
    .join(' · ');

  const handlePlanTrip = async (suggestion: DestinationSuggestion) => {
    const { city, country } = suggestion;
    setCreating(city);

    try {
      const body: Record<string, unknown> = {
        name: `Trip to ${city}`,
        destination: `${city}, ${country}`,
        entry_mode: 'surprise',
        quiz_budget: answers.budget_tier,
        quiz_vibes: answers.vibes,
        quiz_when: answers.when,
        quiz_who: answers.who,
        quiz_group_size: answers.group_size,
        group_share: answers.group_share,
        group_costsplit: answers.group_costsplit,
        group_consensus: answers.group_consensus,
        travelers_adults: answers.group_size,
        budget: answers.budget_tier,
        interests: answers.vibes,
      };

      if (answers.when === 'specific' && answers.when_dates) {
        body.start_date = answers.when_dates.start;
        body.end_date = answers.when_dates.end;
      }

      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const trip = await res.json();
        router.push(`/planner/${trip.id}`);
      }
    } finally {
      setCreating(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <h2 className="text-xl font-semibold text-gray-900 mb-1">
        Atlas found {suggestions.length} destination{suggestions.length !== 1 ? 's' : ''} for you
      </h2>
      {contextLine && (
        <p className="text-sm text-gray-500 mb-6">Based on: {contextLine}</p>
      )}

      {/* Destination cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {suggestions.map((suggestion) => {
          const { city, country, flightPrice, hotelPrice, bestFor, image } = suggestion;
          const isCreating = creating === city;
          const isDisabled = creating !== null;

          return (
            <div
              key={`${city}-${country}`}
              className="border rounded-xl overflow-hidden hover:shadow-lg transition-shadow flex flex-col"
            >
              {/* Image area */}
              <div className="h-40 bg-gray-200 flex items-center justify-center relative overflow-hidden">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image}
                    alt={`${city}, ${country}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl" role="img" aria-label="Globe">
                    🌐
                  </span>
                )}
              </div>

              {/* Card body */}
              <div className="p-4 flex flex-col flex-1 gap-2">
                <div>
                  <h3 className="font-semibold text-gray-900 text-base leading-tight">{city}</h3>
                  <p className="text-sm text-gray-500">{country}</p>
                </div>

                <div className="space-y-0.5 text-sm text-gray-600">
                  {flightPrice !== null && (
                    <p>Flights from ${flightPrice.toLocaleString()}</p>
                  )}
                  {hotelPrice !== null && (
                    <p>Hotels from ${hotelPrice.toLocaleString()}/night</p>
                  )}
                </div>

                {bestFor && (
                  <p className="text-xs text-blue-600 font-medium">{bestFor}</p>
                )}

                <button
                  onClick={() => handlePlanTrip(suggestion)}
                  disabled={isDisabled}
                  className={`mt-auto w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                    isDisabled
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isCreating ? 'Creating...' : 'Plan This Trip →'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom actions */}
      <div className="flex justify-center gap-4">
        <button
          onClick={onRegenerate}
          className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
        >
          Show me different options
        </button>
        <button
          onClick={onOpenChat}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Tell Atlas what you want
        </button>
      </div>
    </div>
  );
}
