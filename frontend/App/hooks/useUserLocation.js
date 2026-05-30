/**
 * useUserLocation — GPS location hook with Nigeria-aware defaults.
 *
 * Expo simulators default to San Francisco. This hook detects
 * obviously wrong coordinates (outside Nigeria/West Africa) and
 * falls back to a sensible Nigerian default (Ibadan) for development.
 *
 * Priority:
 *   1. Saved profile location (if available)
 *   2. Device GPS (if within Nigeria bounding box)
 *   3. Nigeria default fallback (Lead City University, Ibadan)
 *
 * @module hooks/useUserLocation
 */

import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

// Nigeria bounding box (generous — covers all of West Africa)
const NIGERIA_BOUNDS = {
  latMin: 4.0,
  latMax: 14.0,
  lngMin: 2.5,
  lngMax: 15.0,
};

// Fallback: Lead City University, Ibadan
const FALLBACK_COORDS = { lat: 7.3776, lng: 3.9470 };
const FALLBACK_ADDRESS = 'Lead City University, Ibadan, Oyo State, Nigeria';

function isInNigeria(lat, lng) {
  return (
    lat >= NIGERIA_BOUNDS.latMin &&
    lat <= NIGERIA_BOUNDS.latMax &&
    lng >= NIGERIA_BOUNDS.lngMin &&
    lng <= NIGERIA_BOUNDS.lngMax
  );
}

export default function useUserLocation(savedProfile = null) {
  const [address, setAddress] = useState(null);
  const [coords, setCoords] = useState({ lat: null, lng: null });
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(true);

  const formatAddress = (geo) => {
    return [
      geo.name,
      geo.street,
      geo.district,
      geo.subregion,
      geo.city,
      geo.region,
      geo.country,
    ]
      .filter(Boolean)
      .join(', ');
  };

  useEffect(() => {
    // If the user has a saved profile location, use it first
    if (savedProfile?.lat && savedProfile?.lng) {
      setCoords({ lat: savedProfile.lat, lng: savedProfile.lng });
      setAddress(savedProfile.address || null);
      setLoading(false);
      // Still try GPS in background to get fresh coords
    }

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Location permission denied');
          // Use fallback if no saved profile location
          if (!savedProfile?.lat) {
            setCoords(FALLBACK_COORDS);
            setAddress(FALLBACK_ADDRESS);
          }
          setLoading(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const { latitude, longitude } = location.coords;

        // Check if GPS coords are actually in Nigeria
        // Expo simulator returns San Francisco — detect and reject
        if (!isInNigeria(latitude, longitude)) {
          console.warn(
            `GPS returned non-Nigeria coords (${latitude.toFixed(4)}, ${longitude.toFixed(4)}). ` +
            'Using Nigeria fallback — likely running in simulator.'
          );
          if (!savedProfile?.lat) {
            setCoords(FALLBACK_COORDS);
            setAddress(FALLBACK_ADDRESS);
          }
          setLoading(false);
          return;
        }

        // Valid Nigeria GPS — use it
        setCoords({ lat: latitude, lng: longitude });

        try {
          const [geoAddress] = await Location.reverseGeocodeAsync({
            latitude,
            longitude,
          });
          if (geoAddress) {
            setAddress(formatAddress(geoAddress));
          }
        } catch {
          // Reverse geocoding failed — coords are still valid
        }
      } catch (err) {
        setErrorMsg(err.message || 'Failed to get location');
        if (!savedProfile?.lat) {
          setCoords(FALLBACK_COORDS);
          setAddress(FALLBACK_ADDRESS);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [savedProfile?.lat, savedProfile?.lng]);

  return { address, coords, errorMsg, loading };
}
