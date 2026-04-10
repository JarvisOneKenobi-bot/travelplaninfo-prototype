"use client";

interface Props {
  title: string;
  image?: string;
  rating?: number;
  reviewCount?: number;
  duration?: string;
  pricePerPerson?: number;
  provider: "viator" | "getyourguide";
  url: string;
  onBook?: (url: string) => void;
}

export default function ActivityCard({
  title,
  image,
  rating,
  reviewCount,
  duration,
  pricePerPerson,
  provider,
  url,
  onBook,
}: Props) {
  const providerName = provider === "viator" ? "Viator" : "GetYourGuide";

  function handleBook() {
    if (onBook) {
      onBook(url);
    } else {
      window.dispatchEvent(
        new CustomEvent("open-affiliate-modal", { detail: { url } })
      );
    }
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      {/* Category header */}
      <div className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-teal-50 text-teal-700">
        🎭 Activity
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex flex-row gap-3">
          {image && (
            <img
              src={image}
              alt={title}
              className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
            />
          )}
          <div className="flex flex-col gap-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900 truncate">{title}</p>
            {(rating !== undefined || duration) && (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                {rating !== undefined && (
                  <>
                    <span>⭐</span>
                    <span>{rating.toFixed(1)}</span>
                    {reviewCount !== undefined && (
                      <span>({reviewCount.toLocaleString()})</span>
                    )}
                  </>
                )}
                {duration && rating !== undefined && <span>·</span>}
                {duration && <span>{duration}</span>}
              </p>
            )}
            {pricePerPerson !== undefined && (
              <p className="text-xs text-gray-700">
                From ${pricePerPerson} per person
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-3">
          <span className="text-[10px] text-gray-400">
            Powered by {providerName}
          </span>
          <button
            onClick={handleBook}
            className="text-sm text-white bg-teal-600 px-4 py-1.5 rounded-lg hover:opacity-90 transition-colors"
          >
            Book on {providerName} →
          </button>
        </div>
      </div>
    </div>
  );
}
