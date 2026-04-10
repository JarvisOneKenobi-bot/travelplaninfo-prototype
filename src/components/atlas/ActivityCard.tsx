"use client";

interface ActivityData {
  name: string;
  price: string;
  tier: string;
  interest: string;
  duration?: string;
}

const TIER_COLORS: Record<string, string> = {
  budget: "bg-green-100 text-green-700",
  mid: "bg-blue-100 text-blue-700",
  luxury: "bg-purple-100 text-purple-700",
};

export default function ActivityCard({ activity }: { activity: ActivityData }) {
  const tierClass = TIER_COLORS[activity.tier] || "bg-gray-100 text-gray-600";

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-900 truncate">{activity.name}</p>
          <div className="flex items-center gap-2 mt-1">
            {activity.duration && (
              <span className="text-xs text-gray-500">{activity.duration}</span>
            )}
            <span className="text-xs bg-orange-50 text-orange-600 rounded px-1.5 py-0.5 capitalize">
              {activity.interest}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-sm text-gray-900">
            {activity.price}
          </p>
          <span className={["text-xs rounded px-1.5 py-0.5 font-medium capitalize", tierClass].join(" ")}>
            {activity.tier}
          </span>
        </div>
      </div>
    </div>
  );
}
