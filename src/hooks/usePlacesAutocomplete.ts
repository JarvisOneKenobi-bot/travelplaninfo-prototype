import { useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

let mapsOptionsSet = false;

function ensureMapsOptions() {
  if (!mapsOptionsSet) {
    setOptions({
      key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '',
      v: 'weekly',
    });
    mapsOptionsSet = true;
  }
}

export function usePlacesAutocomplete(
  inputRef: React.RefObject<HTMLInputElement | null>,
  options?: {
    types?: string[];
    enabled?: boolean;
    onSelect?: (place: { name: string; placeId: string; iataCode?: string }) => void;
  }
) {
  const [isLoaded, setIsLoaded] = useState(false);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (options?.enabled === false) return;
    if (!inputRef.current) return;
    let active = true;

    ensureMapsOptions();

    importLibrary('places').then((placesLib) => {
      if (!active || !inputRef.current) return;

      const autocomplete = new placesLib.Autocomplete(inputRef.current, {
        types: options?.types || ['(cities)'],
        fields: ['name', 'place_id', 'formatted_address', 'address_components', 'types'],
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place?.name) return;

        // Extract IATA code from airport results if available
        let iataCode: string | undefined;
        if (place.types?.includes('airport')) {
          // Try to extract IATA from the name (e.g., "Miami International Airport (MIA)")
          const match = place.name.match(/\(([A-Z]{3})\)/);
          if (match) iataCode = match[1];
        }

        options?.onSelect?.({
          name: place.name,
          placeId: place.place_id || '',
          iataCode,
        });
      });

      autocompleteRef.current = autocomplete;
      setIsLoaded(true);
    }).catch(() => {
      // Fallback: just use the input as-is
    });

    return () => {
      active = false;
      const ac = autocompleteRef.current;
      if (ac) {
        google.maps.event.clearInstanceListeners(ac);
        autocompleteRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputRef, options?.enabled]);

  return { isLoaded };
}
