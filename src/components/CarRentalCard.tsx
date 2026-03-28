"use client";

interface Props {
  location: string;
  vehicleType?: string;
  pricePerDay?: number;
  insurance?: string;
  url: string;
  onBook?: (url: string) => void;
}

export default function CarRentalCard({
  location,
  vehicleType,
  pricePerDay,
  insurance,
  url,
  onBook,
}: Props) {
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
      <div className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-purple-50 text-purple-700">
        🚗 Car Rental
      </div>

      {/* Body */}
      <div className="p-4">
        <p className="font-semibold text-sm text-gray-900">
          DiscoverCars · {location} Pickup
        </p>
        {vehicleType && (
          <p className="text-xs text-gray-500 mt-1">{vehicleType}</p>
        )}
        {pricePerDay !== undefined && (
          <p className="text-xs text-gray-700 mt-1">From ${pricePerDay}/day</p>
        )}
        {insurance && (
          <p className="text-xs text-green-600 mt-1">{insurance}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3">
          <span className="text-[10px] text-gray-400">
            Powered by DiscoverCars
          </span>
          <button
            onClick={handleBook}
            className="text-sm text-white bg-purple-600 px-4 py-1.5 rounded-lg hover:opacity-90 transition-colors"
          >
            Book on DiscoverCars →
          </button>
        </div>
      </div>
    </div>
  );
}
