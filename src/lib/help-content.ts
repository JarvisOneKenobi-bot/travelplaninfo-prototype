export interface HelpSection {
  heading: string;
  text: string;
}

export interface HelpPageContent {
  title: string;
  intro: string;
  sections: HelpSection[];
}

export const HELP_CONTENT: Record<string, HelpPageContent> = {
  "home": {
    title: "Welcome to TravelPlanInfo",
    intro: "Your AI-powered travel planning companion.",
    sections: [
      { heading: "How to get started", text: "Create an account to unlock personalized trip planning, deal alerts, and Atlas — your AI travel concierge." },
      { heading: "Hot Deals", text: "Curated travel deals matched to your preferences and budget. Update your profile to get better matches." },
    ]
  },
  "planner-new": {
    title: "Plan a New Trip",
    intro: "Tell us where, when, and how you want to travel. No account needed — you can plan as a guest and save later.",
    sections: [
      { heading: "Where are you going?", text: "Enter your destination, or click 'Surprise Me' to let Atlas suggest destinations based on your interests and budget. In Surprise Me mode, pick a vibe (Tropical, Mountains, Beach, etc.) and optionally type a region hint. At least 2 interests are required so Atlas knows what to recommend." },
      { heading: "When are you traveling?", text: "Set your travel dates, or check 'I'm flexible' to let Atlas find the cheapest dates. When flexible, choose a travel window (next month, 2-3 months, etc.) and trip length (weekend, week, 2+ weeks). Or click 'Let Atlas find the cheapest dates' to let Atlas pick the absolute best deal regardless of timing." },
      { heading: "What's your budget?", text: "Choose Budget, Mid-range, or Luxury. These labels map to your custom dollar thresholds set in Preferences. You can customize what each tier means to you." },
      { heading: "What interests you?", text: "Pick activities you enjoy — Atlas uses these to suggest daily itinerary activities. New: Romance and Family Travel are now available as presets. Click 'Add your own' to type custom interests (comma-separated or press Enter for each). Custom interests are saved to your profile if you're registered." },
      { heading: "Atlas Recommends", text: "Selecting 'Atlas Recommends' (formerly 'Let Atlas decide') doesn't replace your interests — it tells Atlas to also suggest activities outside your picks if they're a great fit for your destination." },
      { heading: "Guest planning", text: "You can plan a full trip without signing in. Your trip is saved temporarily (7 days). Atlas will suggest creating a free account after you've built up your itinerary so you can keep it forever." },
    ]
  },
  "planner-itinerary": {
    title: "Your Trip Itinerary",
    intro: "Build your day-by-day travel plan with Atlas, your AI travel concierge.",
    sections: [
      { heading: "Auto-search", text: "When you first create a trip, Atlas automatically searches for flights, hotels, and activities. Results appear in a modal where you can compare, select, and add items to your itinerary in bulk." },
      { heading: "Adding items", text: "Click '+ Add Item' on any day to add flights, hotels, activities, dining, restaurants, or transportation. You can also use Atlas to search and add items via the chat." },
      { heading: "Trip Results Modal", text: "The results modal has tabs for Flights, Hotels, Activities, Restaurants, and a Summary. Each tab lets you sort, select items with checkboxes, and pick which day to assign them to. Click 'Add All to Itinerary' to batch-add your selections." },
      { heading: "Day assignment", text: "Every item in the results modal has a 'Day' dropdown — flights, hotels, activities, and restaurants can all be assigned to specific days before adding to the itinerary." },
      { heading: "Activities & Interests", text: "When you select 'Activity', you'll see your interests as sub-categories. Atlas uses these to suggest relevant activities. If you haven't set interests yet, you'll be prompted to choose some." },
      { heading: "Editing items", text: "Click on any item to edit its title, description, or budget tier. Changes save instantly." },
      { heading: "Estimated prices", text: "When live pricing isn't available, Atlas shows estimated prices marked with '(estimated)'. These are ballpark figures to help you plan — actual prices may vary." },
      { heading: "Atlas chat", text: "Ask Atlas anything — search for more options, get recommendations, or ask about your destination. Atlas knows what's already in your itinerary and suggests complementary activities." },
      { heading: "Recommended Bookings", text: "The right sidebar shows affiliate booking links matched to your destination. Click 'Find Hotels' or 'Search Flights' to compare prices, or '+ Add to Itinerary' to add directly to your plan." },
      { heading: "Days", text: "Click the day header to collapse/expand. Click '+ Add Day' to extend your trip. Days are auto-calculated from your travel dates." },
    ]
  },
  "preferences": {
    title: "Your Travel Preferences",
    intro: "Customize how Atlas and TPI work for you.",
    sections: [
      { heading: "Home Airport", text: "Your default departure airport (IATA code like MIA, JFK, LAX). Atlas uses this to search flights from your location." },
      { heading: "Budget Tiers", text: "The three tiers (Budget, Mid-range, Luxury) are labels. You define what dollar amount each means to you. Default: Budget < $100/day, Mid $100-250/day, Luxury $250+/day." },
      { heading: "Interests", text: "Pick from preset options or add your own custom interests. 'Let Atlas decide' works alongside your picks — it tells Atlas to also suggest things outside your selections." },
      { heading: "Deal Alerts", text: "When enabled, you'll receive notifications when prices drop below your threshold on routes and destinations you've searched." },
      { heading: "Assistant Style", text: "Choose how Atlas communicates: concise (quick answers), detailed (thorough explanations), or friendly (casual tone)." },
    ]
  },
  "article": {
    title: "Travel Guide",
    intro: "Expert travel content with booking links.",
    sections: [
      { heading: "Booking links", text: "Orange 'Book Now' or 'Search' buttons are affiliate links to trusted travel partners (Hotels.com, Vrbo, CruiseDirect, Aviasales). You pay the same price — we earn a small commission that supports TPI." },
      { heading: "Deal Alerts sidebar", text: "Enter your email in the hero section to get weekly price drop alerts on flights, hotels, and cruises." },
    ]
  },
  "guides": {
    title: "Travel Guides",
    intro: "Browse our collection of destination guides and travel tips.",
    sections: [
      { heading: "Finding articles", text: "Articles are organized by destination and topic. Each guide includes practical tips, current prices, and booking links." },
    ]
  },
  "hot-deals": {
    title: "Hot Deals",
    intro: "Curated travel deals matched to your profile.",
    sections: [
      { heading: "How deals work", text: "We scan flights, hotels, and vacation packages across our affiliate partners to find the best prices. Deals are filtered by your home airport, budget tier, and interests." },
      { heading: "Personalized results", text: "Update your preferences (home airport, budget, interests) to get deals that match your travel style. The more Atlas knows about you, the better the deals." },
      { heading: "Deal alerts", text: "Enable Deal Alerts in your preferences to get notified when prices drop below your threshold on routes you've searched." },
      { heading: "Booking", text: "Click any deal to compare prices on our partner sites. You pay the same price — we earn a small commission that supports TPI." },
    ]
  },
};
