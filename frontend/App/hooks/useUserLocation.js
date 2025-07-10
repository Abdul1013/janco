import * as Location from "expo-location";
import { useEffect, useState } from "react";

export default function useUserLocation() {
  // const [location, setLocation] = useState(null);
  const [address, setAddress] = useState(null);
    const [coords, setCoords] = useState({ lat: null, lng: null });
  const [errorMsg, setErrorMsg] = useState(null);

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
      .join(", ");
  };

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permission denied");
        return;
      }

      let location = await Location.getCurrentPositionAsync({});

       setCoords({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
      let [geoAddress] = await Location.reverseGeocodeAsync(location.coords);

      if (geoAddress) {
        const fullAddress = formatAddress(geoAddress);
        setAddress(fullAddress);
      }
    })();
  }, []);

  return { address, coords, errorMsg };
}
