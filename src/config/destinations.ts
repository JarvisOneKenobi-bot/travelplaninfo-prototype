import { TrendingDestination } from '@/lib/trip-types';

export const TRENDING_DESTINATIONS: TrendingDestination[] = [
  // 2 domestic
  { city: 'Miami', country: 'FL', code: 'MIA', image: '/images/destinations/miami.jpg', viatorDestId: 'd662', gygLocationId: 'l176', discoverCarsSlug: 'miami', articleSlug: undefined },
  { city: 'Denver', country: 'CO', code: 'DEN', image: '/images/destinations/denver.jpg', viatorDestId: 'd948', gygLocationId: 'l2575', discoverCarsSlug: 'denver', articleSlug: undefined },
  // 2 international popular
  { city: 'Paris', country: 'France', code: 'CDG', image: '/images/destinations/paris.jpg', viatorDestId: 'd479', gygLocationId: 'l16', discoverCarsSlug: 'paris', articleSlug: undefined },
  { city: 'Tokyo', country: 'Japan', code: 'NRT', image: '/images/destinations/tokyo.jpg', viatorDestId: 'd334', gygLocationId: 'l200', discoverCarsSlug: 'tokyo', articleSlug: undefined },
  // 2 seasonal/trending
  { city: 'Cancun', country: 'Mexico', code: 'CUN', image: '/images/destinations/cancun.jpg', viatorDestId: 'd631', gygLocationId: 'l182', discoverCarsSlug: 'cancun', articleSlug: undefined },
  { city: 'Lisbon', country: 'Portugal', code: 'LIS', image: '/images/destinations/lisbon.jpg', viatorDestId: 'd538', gygLocationId: 'l153', discoverCarsSlug: 'lisbon', articleSlug: undefined },
];
