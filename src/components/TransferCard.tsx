"use client";

interface Props {
  from: string;
  to: string;
  vehicleType?: string;
  price?: number;
  provider: "kiwitaxi" | "airportspickup";
  url: string;
  onBook?: (url: string) => void;
}

export default function TransferCard({
  from,
  to,
  vehicleType,
  price,
  provider,
  url,
  onBook,
}: Props) {
  const providerName = provider === "kiwitaxi" ? "KiwiTaxi" : "AirportsPickup";

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
      <div className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-cyan-50 text-cyan-700">
        🚐 Airport Transfer
      </div>

      {/* Body */}
      <div className="p-4">
        <p className="font-semibold text-sm text-gray-900">
          {providerName} · {from} → {to}
        </p>
        {vehicleType && (
          <p className="text-xs text-gray-500 mt-1">{vehicleType}</p>
        )}
        {price !== undefined && (
          <p className="text-xs text-gray-700 mt-1">From ${price}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3">
          <span className="text-[10px] text-gray-400">
            Powered by {providerName}
          </span>
          <button
            onClick={handleBook}
            className="text-sm text-white bg-cyan-600 px-4 py-1.5 rounded-lg hover:opacity-90 transition-colors"
          >
            Book on {providerName} →
          </button>
        </div>
      </div>
    </div>
  );
}
