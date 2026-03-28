'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  QuizBudgetTier,
  QuizWhen,
  QuizWho,
  QuizAnswers,
  BUDGET_TIERS,
  PRESET_VIBES,
  QUIZ_WHO_OPTIONS,
} from '@/lib/trip-types';

interface Props {
  onComplete: (answers: QuizAnswers) => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function SurpriseMeQuiz({ onComplete }: Props) {
  const t = useTranslations();

  // Step state
  const [step, setStep] = useState(1);

  // Step 1: Budget
  const [budgetTier, setBudgetTier] = useState<QuizBudgetTier | null>(null);

  // Step 2: Vibes
  const [vibes, setVibes] = useState<string[]>([]);
  const [customVibeInput, setCustomVibeInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Step 3: When
  const [when, setWhen] = useState<QuizWhen | null>(null);
  const [whenDates, setWhenDates] = useState({ start: '', end: '' });
  const [whenMonths, setWhenMonths] = useState<string[]>([]);

  // Step 4: Who
  const [who, setWho] = useState<QuizWho | null>(null);
  const [groupSize, setGroupSize] = useState(4);
  const [groupShare, setGroupShare] = useState(true);
  const [groupCostsplit, setGroupCostsplit] = useState(false);
  const [groupConsensus, setGroupConsensus] = useState(false);

  const isGroupTrip = who === 'family' || who === 'friends';

  // Vibe helpers
  const toggleVibe = (vibe: string) => {
    setVibes((prev) => {
      if (prev.includes(vibe)) return prev.filter((v) => v !== vibe);
      if (prev.length >= 5) return prev;
      return [...prev, vibe];
    });
  };

  const addCustomVibe = () => {
    const trimmed = customVibeInput.trim();
    if (trimmed && !vibes.includes(trimmed) && vibes.length < 5) {
      setVibes((prev) => [...prev, trimmed]);
    }
    setCustomVibeInput('');
    setShowCustomInput(false);
  };

  const removeVibe = (vibe: string) => {
    setVibes((prev) => prev.filter((v) => v !== vibe));
  };

  // Month toggle
  const toggleMonth = (month: string) => {
    setWhenMonths((prev) =>
      prev.includes(month) ? prev.filter((m) => m !== month) : [...prev, month]
    );
  };

  const handleSubmit = () => {
    if (!who) return;
    const resolvedGroupSize = isGroupTrip ? groupSize : who === 'couple' ? 2 : 1;
    onComplete({
      budget_tier: budgetTier,
      vibes,
      when,
      when_dates: when === 'specific' ? whenDates : undefined,
      when_months: when === 'flexible' ? whenMonths : undefined,
      who,
      group_size: resolvedGroupSize,
      group_share: isGroupTrip ? groupShare : false,
      group_costsplit: isGroupTrip ? groupCostsplit : false,
      group_consensus: isGroupTrip ? groupConsensus : false,
    });
  };

  // Chip class helpers
  const chipBase = 'px-4 py-2 rounded-full border-2 text-sm font-medium transition-all';
  const chipSelected = 'border-blue-600 bg-blue-50 text-blue-700';
  const chipUnselected = 'border-gray-200 hover:border-gray-300 text-gray-700';

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      {/* Progress dots */}
      <div className="flex justify-end gap-2 mb-6">
        {[1, 2, 3, 4].map((dot) => (
          <span
            key={dot}
            className={`h-2.5 w-2.5 rounded-full transition-all ${
              dot <= step ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Step 1: Budget */}
      {step === 1 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">
            {t('budgetTitle', { defaultValue: "What's your budget per person?" })}
          </h2>
          <p className="text-sm text-gray-500 mb-5">
            {t('budgetSubtitle', { defaultValue: 'This helps us match you with destinations that fit.' })}
          </p>
          <div className="grid grid-cols-2 gap-3 mb-8">
            {BUDGET_TIERS.map((tier) => (
              <button
                key={tier.value}
                onClick={() => setBudgetTier(tier.value)}
                className={`${chipBase} flex flex-col items-start py-4 px-5 rounded-2xl ${
                  budgetTier === tier.value ? chipSelected : chipUnselected
                }`}
              >
                <span className="font-semibold">{tier.label}</span>
                <span className="text-xs mt-0.5 text-gray-500">{tier.range}</span>
              </button>
            ))}
          </div>
          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              {t('skip', { defaultValue: 'Skip' })}
            </button>
            <button
              onClick={() => setStep(2)}
              className="px-5 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all"
            >
              {t('next', { defaultValue: 'Next' })}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Vibes */}
      {step === 2 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">
            {t('vibesTitle', { defaultValue: "What's your vibe?" })}
          </h2>
          <p className="text-sm text-gray-500 mb-5">
            {t('vibesSubtitle', { defaultValue: 'Pick up to 5 that match what you want from this trip.' })}
          </p>
          <div className="flex flex-wrap gap-2 mb-5">
            {PRESET_VIBES.map((vibe) => {
              const isSelected = vibes.includes(vibe);
              const isDisabled = !isSelected && vibes.length >= 5;
              return (
                <button
                  key={vibe}
                  onClick={() => !isDisabled && toggleVibe(vibe)}
                  className={`${chipBase} ${
                    isSelected ? chipSelected : chipUnselected
                  } ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {t(`vibe_${vibe}`, { defaultValue: vibe.charAt(0).toUpperCase() + vibe.slice(1) })}
                </button>
              );
            })}

            {/* Custom vibes already added */}
            {vibes
              .filter((v) => !PRESET_VIBES.includes(v as typeof PRESET_VIBES[number]))
              .map((customVibe) => (
                <span
                  key={customVibe}
                  className={`${chipBase} ${chipSelected} flex items-center gap-1`}
                >
                  {customVibe}
                  <button
                    onClick={() => removeVibe(customVibe)}
                    className="ml-1 text-blue-500 hover:text-blue-700 font-bold leading-none"
                    aria-label={`Remove ${customVibe}`}
                  >
                    ×
                  </button>
                </span>
              ))}

            {/* Add Your Own chip or input */}
            {showCustomInput ? (
              <span className="flex items-center gap-1 px-3 py-1.5 rounded-full border-2 border-dashed border-blue-400 bg-blue-50">
                <input
                  autoFocus
                  type="text"
                  value={customVibeInput}
                  onChange={(e) => setCustomVibeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addCustomVibe();
                    if (e.key === 'Escape') {
                      setShowCustomInput(false);
                      setCustomVibeInput('');
                    }
                  }}
                  placeholder={t('customVibePlaceholder', { defaultValue: 'Type & press Enter' })}
                  className="text-sm bg-transparent outline-none w-32 text-blue-700 placeholder-blue-300"
                />
              </span>
            ) : vibes.length < 5 ? (
              <button
                onClick={() => setShowCustomInput(true)}
                className={`${chipBase} border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500`}
              >
                {t('addYourOwn', { defaultValue: '+ Add Your Own...' })}
              </button>
            ) : null}
          </div>
          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              {t('back', { defaultValue: 'Back' })}
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-5 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all"
            >
              {t('next', { defaultValue: 'Next' })}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: When */}
      {step === 3 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">
            {t('whenTitle', { defaultValue: 'When do you want to go?' })}
          </h2>
          <p className="text-sm text-gray-500 mb-5">
            {t('whenSubtitle', { defaultValue: "We'll tailor pricing and availability to your timing." })}
          </p>
          <div className="flex flex-wrap gap-3 mb-5">
            {(
              [
                { value: 'specific', label: t('whenSpecific', { defaultValue: 'Specific dates' }) },
                { value: 'flexible', label: t('whenFlexible', { defaultValue: 'Flexible' }) },
                { value: 'no_idea', label: t('whenNoIdea', { defaultValue: 'No idea yet' }) },
              ] as { value: QuizWhen; label: string }[]
            ).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setWhen(opt.value)}
                className={`${chipBase} ${when === opt.value ? chipSelected : chipUnselected}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Specific dates inputs */}
          {when === 'specific' && (
            <div className="flex gap-3 mb-5">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">
                  {t('startDate', { defaultValue: 'Start date' })}
                </label>
                <input
                  type="date"
                  value={whenDates.start}
                  onChange={(e) => setWhenDates((d) => ({ ...d, start: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-400 transition-all"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">
                  {t('endDate', { defaultValue: 'End date' })}
                </label>
                <input
                  type="date"
                  value={whenDates.end}
                  onChange={(e) => setWhenDates((d) => ({ ...d, end: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-400 transition-all"
                />
              </div>
            </div>
          )}

          {/* Flexible month chips */}
          {when === 'flexible' && (
            <div className="flex flex-wrap gap-2 mb-5">
              {MONTHS.map((month) => (
                <button
                  key={month}
                  onClick={() => toggleMonth(month)}
                  className={`px-3 py-1.5 rounded-full border-2 text-sm font-medium transition-all ${
                    whenMonths.includes(month) ? chipSelected : chipUnselected
                  }`}
                >
                  {month}
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              {t('back', { defaultValue: 'Back' })}
            </button>
            <button
              onClick={() => setStep(4)}
              className="px-5 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all"
            >
              {t('next', { defaultValue: 'Next' })}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Who */}
      {step === 4 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">
            {t('whoTitle', { defaultValue: "Who's coming?" })}
          </h2>
          <p className="text-sm text-gray-500 mb-5">
            {t('whoSubtitle', { defaultValue: "We'll customize recommendations based on your group." })}
          </p>
          <div className="flex gap-3 flex-wrap mb-5">
            {QUIZ_WHO_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setWho(opt.value)}
                className={`${chipBase} flex flex-col items-center gap-1 px-5 py-3 rounded-2xl ${
                  who === opt.value ? chipSelected : chipUnselected
                }`}
              >
                <span className="text-xl">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>

          {/* Group features panel */}
          {isGroupTrip && (
            <div className="border border-gray-100 rounded-2xl bg-gray-50 p-5 mb-5 space-y-5">
              {/* Group size stepper */}
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-2">
                  {t('groupSizeLabel', { defaultValue: 'Group size' })}
                </p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setGroupSize((s) => Math.max(2, s - 1))}
                    className="h-8 w-8 rounded-full border border-gray-300 text-gray-600 flex items-center justify-center hover:bg-gray-100 transition-all text-lg font-medium"
                    aria-label="Decrease group size"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-gray-900 font-semibold">{groupSize}</span>
                  <button
                    onClick={() => setGroupSize((s) => Math.min(20, s + 1))}
                    className="h-8 w-8 rounded-full border border-gray-300 text-gray-600 flex items-center justify-center hover:bg-gray-100 transition-all text-lg font-medium"
                    aria-label="Increase group size"
                  >
                    +
                  </button>
                  <span className="text-sm text-gray-400">
                    {t('people', { defaultValue: 'people' })}
                  </span>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-4">
                {/* Share itinerary */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupShare}
                    onChange={(e) => setGroupShare(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 accent-blue-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {t('shareItineraryTitle', { defaultValue: 'Share itinerary with group' })}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t('shareItineraryDesc', { defaultValue: 'Everyone gets a link to view and comment on the plan.' })}
                    </p>
                  </div>
                </label>

                {/* Cost splitting */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupCostsplit}
                    onChange={(e) => setGroupCostsplit(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 accent-blue-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {t('costsplitTitle', { defaultValue: 'Enable cost splitting' })}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t('costsplitDesc', { defaultValue: 'Automatically split costs per person across the group.' })}
                    </p>
                  </div>
                </label>

                {/* Atlas consensus */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupConsensus}
                    onChange={(e) => setGroupConsensus(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 accent-blue-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {t('consensusTitle', { defaultValue: 'Atlas consensus voting' })}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t('consensusDesc', { defaultValue: 'Let everyone vote on destinations and activities before locking the plan.' })}
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={() => setStep(3)}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              {t('back', { defaultValue: 'Back' })}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!who}
              className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                who
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {t('findMyTrip', { defaultValue: 'Find My Trip' })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
