// const { data: janitors } = await supabase
//   .from('profiles')
//   .select('*')
//   .eq('is_janitor', true)
//   .lt('lat', userLat + 0.1)   // crude proximity filter
//   .gt('lat', userLat - 0.1)
//   .lt('lng', userLng + 0.1)
//   .gt('lng', userLng - 0.1);

utils/geoUtils.js

// export function getDistanceInKm(lat1, lng1, lat2, lng2) {
//   const toRad = (value) => (value * Math.PI) / 180;

//   const R = 6371; // Earth's radius in KM
//   const dLat = toRad(lat2 - lat1);
//   const dLon = toRad(lng2 - lng1);

//   const a =
//     Math.sin(dLat / 2) ** 2 +
//     Math.cos(toRad(lat1)) *
//       Math.cos(toRad(lat2)) *
//       Math.sin(dLon / 2) ** 2;

//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

//   return R * c; // distance in KM
// }

hooks/useNearbyJanitors.js


// import { useEffect, useState } from 'react';
// import { supabase } from '../lib/supabase';
// import { getDistanceInKm } from '../utils/geoUtils';

// export function useNearbyJanitors(userLat, userLng, maxDistanceKm = 10) {
//   const [nearbyJanitors, setNearbyJanitors] = useState([]);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     if (!userLat || !userLng) return;

//     const fetchJanitors = async () => {
//       const { data: janitors, error } = await supabase
//         .from('profiles')
//         .select('*')
//         .eq('is_janitor', true)
//         .not('lat', 'is', null)
//         .not('lng', 'is', null);

//       if (error) {
//         console.error(error);
//         return;
//       }

//       const filtered = janitors.filter((janitor) => {
//         const distance = getDistanceInKm(
//           userLat,
//           userLng,
//           janitor.lat,
//           janitor.lng
//         );
//         return distance <= maxDistanceKm;
//       });

//       setNearbyJanitors(filtered);
//       setLoading(false);
//     };

//     fetchJanitors();
//   }, [userLat, userLng]);

//   return { nearbyJanitors, loading };
// }

Screen

// const { coords } = useUserLocation();
// const { nearbyJanitors, loading } = useNearbyJanitors(coords.lat, coords.lng);

// if (loading) return <Text>Finding janitors near you...</Text>;

// return (
//   <FlatList
//     data={nearbyJanitors}
//     keyExtractor={(item) => item.id}
//     renderItem={({ item }) => (
//       <Text>{item.user_name} - {item.address}</Text>
//     )}
//   />
// );

// On Janitor App (Background or Foreground):


// import * as Location from 'expo-location';
// import { supabase } from '../lib/supabase';

// async function updateMyLocation(userId) {
//   const loc = await Location.getCurrentPositionAsync({});
//   const { latitude, longitude } = loc.coords;

//   await supabase
//     .from('profiles')
//     .update({ lat: latitude, lng: longitude })
//     .eq('id', userId);
// }


//user views janitor 
// useEffect(() => {
//   const janitorListener = supabase
//     .channel('janitor-locations')
//     .on(
//       'postgres_changes',
//       { event: 'UPDATE', schema: 'public', table: 'profiles' },
//       (payload) => {
//         if (payload.new.is_janitor) {
//           // Recalculate distance or refresh list
//           console.log('Janitor moved:', payload.new);
//         }
//       }
//     )
//     .subscribe();

//   return () => {
//     supabase.removeChannel(janitorListener);
//   };
// }, []);

const handleSubmit = () => {
  const payload = {
    category,
    date,
    time,
    notes,
    // Include form data from selected category
    ...(category === "house_cleaning" && {
      rooms,
      toilets,
      extras,
    }),
    ...(category === "laundry" && {
      clothesCount,
      clothTypes,
      extraServices,
    }),
  };

  // Send to backend
  axios.post(`${API_URL}/book-service`, payload, {
    headers: { Authorization: `Bearer ${userToken}` },
  })
  .then((res) => navigation.navigate("EstimateScreen", { estimate: res.data }))
  .catch((err) => console.log("Booking failed:", err));
};
