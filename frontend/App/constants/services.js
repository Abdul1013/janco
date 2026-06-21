/**
 * Service type definitions — single source of truth.
 *
 * Used by HomeScreen (category grid) and BookingScreen (category selector).
 * Icons reference MaterialIcons / MaterialCommunityIcons names.
 *
 * @module constants/services
 */

export const SERVICE_TYPES = [
  {
    id: 'house_cleaning',
    label: 'House Cleaning',
    shortLabel: 'House',
    icon: 'cleaning-services',         // MaterialIcons
    iconFamily: 'MaterialIcons',
    description: 'Regular home cleaning',
    available: true,
  },
  {
    id: 'deep_cleaning',
    label: 'Deep Cleaning',
    shortLabel: 'Deep',
    icon: 'cleaning-services',
    iconFamily: 'MaterialIcons',
    description: 'Intensive deep clean',
    available: true,
  },
  {
    id: 'laundry',
    label: 'Laundry',
    shortLabel: 'Laundry',
    icon: 'dry-cleaning',              // MaterialIcons
    iconFamily: 'MaterialIcons',
    description: 'Wash, iron, fold',
    available: true,
  },
  {
    id: 'fumigation',
    label: 'Fumigation',
    shortLabel: 'Fumigate',
    icon: 'spray-bottle',              // MaterialCommunityIcons
    iconFamily: 'MaterialCommunityIcons',
    description: 'Pest control & fumigation',
    available: false,                   // coming soon
  },
  {
    id: 'post_construction',
    label: 'Post-Construction',
    shortLabel: 'Post-Build',
    icon: 'construction',
    iconFamily: 'MaterialIcons',
    description: 'After-build cleanup',
    available: false,
  },
];

/**
 * Look up a service by its id.
 * @param {string} id
 * @returns {Object|undefined}
 */
export const getServiceById = (id) => SERVICE_TYPES.find((s) => s.id === id);

/**
 * Get only the services currently available for booking.
 * @returns {Object[]}
 */
export const getAvailableServices = () => SERVICE_TYPES.filter((s) => s.available);
