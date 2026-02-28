import Header from "@/components/Header";

export default function Planner() {
  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-widest text-teal-800 font-medium mb-4">
            Trip Planner
          </p>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Plan your perfect trip
          </h1>
          <p className="text-lg text-gray-600">
            Answer a few questions and we&apos;ll help you build an itinerary that fits your budget and interests.
          </p>
        </div>

        {/* Planner Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <form className="space-y-8">
            {/* Step 1: Destination */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                <h2 className="text-xl font-bold text-gray-900">Where are you going?</h2>
              </div>
              <input
                type="text"
                placeholder="e.g., Miami, Florida"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Step 2: Dates */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                <h2 className="text-xl font-bold text-gray-900">When are you traveling?</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Check-in</label>
                  <input
                    type="date"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Check-out</label>
                  <input
                    type="date"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Travelers */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                <h2 className="text-xl font-bold text-gray-900">Who&apos;s traveling?</h2>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Adults</label>
                  <select className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent">
                    <option>1</option>
                    <option>2</option>
                    <option>3</option>
                    <option>4</option>
                    <option>5+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Children</label>
                  <select className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent">
                    <option>0</option>
                    <option>1</option>
                    <option>2</option>
                    <option>3+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rooms</label>
                  <select className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent">
                    <option>1</option>
                    <option>2</option>
                    <option>3</option>
                    <option>4+</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Step 4: Budget */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">4</span>
                <h2 className="text-xl font-bold text-gray-900">What&apos;s your budget?</h2>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <label className="cursor-pointer">
                  <input type="radio" name="budget" className="peer sr-only" />
                  <div className="px-4 py-3 rounded-lg border-2 border-gray-200 peer-checked:border-teal-600 peer-checked:bg-teal-50 text-center hover:border-gray-300 transition-colors">
                    <p className="font-medium text-gray-900">💰</p>
                    <p className="text-sm text-gray-600">Budget</p>
                    <p className="text-xs text-gray-400">Under $100/day</p>
                  </div>
                </label>
                <label className="cursor-pointer">
                  <input type="radio" name="budget" className="peer sr-only" />
                  <div className="px-4 py-3 rounded-lg border-2 border-gray-200 peer-checked:border-teal-600 peer-checked:bg-teal-50 text-center hover:border-gray-300 transition-colors">
                    <p className="font-medium text-gray-900">💵</p>
                    <p className="text-sm text-gray-600">Mid-range</p>
                    <p className="text-xs text-gray-400">$100-250/day</p>
                  </div>
                </label>
                <label className="cursor-pointer">
                  <input type="radio" name="budget" className="peer sr-only" />
                  <div className="px-4 py-3 rounded-lg border-2 border-gray-200 peer-checked:border-teal-600 peer-checked:bg-teal-50 text-center hover:border-gray-300 transition-colors">
                    <p className="font-medium text-gray-900">💎</p>
                    <p className="text-sm text-gray-600">Luxury</p>
                    <p className="text-xs text-gray-400">$250+/day</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Step 5: Interests */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">5</span>
                <h2 className="text-xl font-bold text-gray-900">What interests you?</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {["🏖️ Beaches", "🏛️ Museums", "🍜 Food & Dining", "life", "🚶 H🎭 Nightiking", "🛍️ Shopping", "🎢 Theme Parks", "🌅 Nature", "📸 Photography"].map((interest) => (
                  <label key={interest} className="cursor-pointer">
                    <input type="checkbox" className="peer sr-only" />
                    <div className="px-4 py-2.5 rounded-lg border-2 border-gray-200 peer-checked:border-teal-600 peer-checked:bg-teal-50 text-center hover:border-gray-300 transition-colors text-sm">
                      {interest}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="pt-4 border-t border-gray-200">
              <button
                type="button"
                className="w-full bg-teal-700 text-white py-4 rounded-lg font-medium hover:bg-teal-800 transition-colors"
              >
                Generate My Itinerary
              </button>
              <p className="text-center text-xs text-gray-500 mt-3">
                We&apos;ll search for the best flights, hotels, and activities based on your preferences.
              </p>
            </div>
          </form>
        </div>

        {/* Features */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-6">
            <div className="text-3xl mb-3">🔍</div>
            <h3 className="font-bold text-gray-900 mb-2">Smart Search</h3>
            <p className="text-sm text-gray-600">We compare prices across 100+ booking sites</p>
          </div>
          <div className="text-center p-6">
            <div className="text-3xl mb-3">📋</div>
            <h3 className="font-bold text-gray-900 mb-2">Personalized Itinerary</h3>
            <p className="text-sm text-gray-600">Get a custom day-by-day plan</p>
          </div>
          <div className="text-center p-6">
            <div className="text-3xl mb-3">💰</div>
            <h3 className="font-bold text-gray-900 mb-2">Price Alerts</h3>
            <p className="text-sm text-gray-600">Get notified when prices drop</p>
          </div>
        </div>
      </main>
    </div>
  );
}
