/**
 * Centralized Pricing Utility for Co-Janitors
 * Handles both fixed (MVP) and dynamic pricing calculations
 */

export const FIXED_PRICES = {
  house_cleaning: {
    basic: 24000, // 1-2 rooms
    standard: 35000, // 3-4 rooms
    premium: 50000, // 5+ rooms
    perRoom: 8000,
    kitchen: 2000,
    livingRoom: 1500,
    windowCleaning: 1000,
  },
  deep_cleaning: {
    basic: 40000,
    standard: 60000,
    premium: 85000,
  },
  laundry: {
    per_item: 300,
    ironing_per_item: 500,
    delicates_surcharge: 100,
  },
  fumigation: {
    flat_rate: 10000,
  },
};

/**
 * Dynamic rates (per unit)
 */
export const DYNAMIC_RATES = {
  house_cleaning: {
    per_room: 1500,
    per_toilet: 800,
    kitchen: 2000,
    living_room: 1500,
    window_cleaning: 1000,
  },
  laundry: {
    per_item: 300,
    ironing_per_item: 500,
    delicates_surcharge: 100,
  },
  fumigation: {
    flat_rate: 10000,
  },
};

/**
 * Calculate price estimate based on service type and parameters
 * @param {string} serviceType - Service category (house_cleaning, laundry, fumigation, etc)
 * @param {object} params - Service-specific parameters
 * @param {boolean} useFixed - Use fixed pricing (true) or dynamic (false)
 * @returns {object} { estimate: number, breakdown: string[], description: string }
 */
export function calculatePrice(serviceType, params = {}, useFixed = true) {
  let estimate = 0;
  let breakdown = [];
  let description = "";

  if (useFixed) {
    estimate = calculateFixedPrice(serviceType, params);
    breakdown = getFixedPriceBreakdown(serviceType, params);
    description = "MVP Fixed Pricing";
  } else {
    estimate = calculateDynamicPrice(serviceType, params);
    breakdown = getDynamicPriceBreakdown(serviceType, params);
    description = "Dynamic Pricing";
  }

  return {
    estimate,
    breakdown,
    description,
    useFixed,
  };
}

/**
 * Calculate fixed (MVP) pricing
 */
export function calculateFixedPrice(serviceType, params = {}) {
  const { rooms = 1, toilets = 0, clothesCount = 0, extras = {} } = params;

  switch (serviceType) {
    case "house_cleaning": {
      let price = FIXED_PRICES.house_cleaning.basic;
      if (rooms > 2 && rooms <= 4) {
        price = FIXED_PRICES.house_cleaning.standard;
      } else if (rooms > 4) {
        price = FIXED_PRICES.house_cleaning.premium;
      }

      // Add extras
      if (extras.kitchen) price += FIXED_PRICES.house_cleaning.kitchen;
      if (extras.livingRoom) price += FIXED_PRICES.house_cleaning.livingRoom;
      if (extras.windowCleaning) price += FIXED_PRICES.house_cleaning.windowCleaning;

      return price;
    }

    case "deep_cleaning": {
      let price = FIXED_PRICES.deep_cleaning.basic;
      if (rooms > 2 && rooms <= 4) {
        price = FIXED_PRICES.deep_cleaning.standard;
      } else if (rooms > 4) {
        price = FIXED_PRICES.deep_cleaning.premium;
      }
      return price;
    }

    case "laundry": {
      let price = clothesCount * FIXED_PRICES.laundry.per_item;
      if (extras.ironing) {
        price += clothesCount * FIXED_PRICES.laundry.ironing_per_item;
      }
      if (extras.delicates) {
        price += clothesCount * FIXED_PRICES.laundry.delicates_surcharge;
      }
      return price;
    }

    case "fumigation": {
      return FIXED_PRICES.fumigation.flat_rate;
    }

    default:
      return 0;
  }
}

/**
 * Calculate dynamic pricing based on units
 */
export function calculateDynamicPrice(serviceType, params = {}) {
  const { rooms = 0, toilets = 0, clothesCount = 0, extras = {} } = params;
  let estimate = 0;

  switch (serviceType) {
    case "house_cleaning": {
      estimate += rooms * DYNAMIC_RATES.house_cleaning.per_room;
      estimate += toilets * DYNAMIC_RATES.house_cleaning.per_toilet;
      if (extras.kitchen) estimate += DYNAMIC_RATES.house_cleaning.kitchen;
      if (extras.livingRoom) estimate += DYNAMIC_RATES.house_cleaning.living_room;
      if (extras.windowCleaning) estimate += DYNAMIC_RATES.house_cleaning.window_cleaning;
      break;
    }

    case "laundry": {
      estimate += clothesCount * DYNAMIC_RATES.laundry.per_item;
      if (extras.ironing) {
        estimate += clothesCount * DYNAMIC_RATES.laundry.ironing_per_item;
      }
      if (extras.delicates) {
        estimate += clothesCount * DYNAMIC_RATES.laundry.delicates_surcharge;
      }
      break;
    }

    case "fumigation": {
      estimate += DYNAMIC_RATES.fumigation.flat_rate;
      break;
    }

    default:
      estimate = 0;
  }

  return estimate;
}

/**
 * Get breakdown for fixed pricing
 */
export function getFixedPriceBreakdown(serviceType, params = {}) {
  const { rooms = 1, toilets = 0, clothesCount = 0, extras = {} } = params;
  const breakdown = [];

  switch (serviceType) {
    case "house_cleaning": {
      if (rooms <= 2) {
        breakdown.push(`Basic House Cleaning (1-2 rooms): ₦${FIXED_PRICES.house_cleaning.basic.toLocaleString()}`);
      } else if (rooms <= 4) {
        breakdown.push(`Standard House Cleaning (3-4 rooms): ₦${FIXED_PRICES.house_cleaning.standard.toLocaleString()}`);
      } else {
        breakdown.push(`Premium House Cleaning (5+ rooms): ₦${FIXED_PRICES.house_cleaning.premium.toLocaleString()}`);
      }
      if (extras.kitchen) breakdown.push(`+ Kitchen Cleaning: ₦${FIXED_PRICES.house_cleaning.kitchen.toLocaleString()}`);
      if (extras.livingRoom) breakdown.push(`+ Living Room: ₦${FIXED_PRICES.house_cleaning.livingRoom.toLocaleString()}`);
      if (extras.windowCleaning) breakdown.push(`+ Window Cleaning: ₦${FIXED_PRICES.house_cleaning.windowCleaning.toLocaleString()}`);
      break;
    }

    case "laundry": {
      breakdown.push(`Laundry (${clothesCount} items × ₦${FIXED_PRICES.laundry.per_item}): ₦${(clothesCount * FIXED_PRICES.laundry.per_item).toLocaleString()}`);
      if (extras.ironing) breakdown.push(`+ Ironing: ₦${(clothesCount * FIXED_PRICES.laundry.ironing_per_item).toLocaleString()}`);
      if (extras.delicates) breakdown.push(`+ Delicates Surcharge: ₦${(clothesCount * FIXED_PRICES.laundry.delicates_surcharge).toLocaleString()}`);
      break;
    }

    case "fumigation": {
      breakdown.push(`Fumigation Service: ₦${FIXED_PRICES.fumigation.flat_rate.toLocaleString()}`);
      break;
    }

    default:
      breakdown.push("No breakdown available");
  }

  return breakdown;
}

/**
 * Get breakdown for dynamic pricing
 */
export function getDynamicPriceBreakdown(serviceType, params = {}) {
  const { rooms = 0, toilets = 0, clothesCount = 0, extras = {} } = params;
  const breakdown = [];

  switch (serviceType) {
    case "house_cleaning": {
      if (rooms > 0) breakdown.push(`${rooms} room(s) × ₦${DYNAMIC_RATES.house_cleaning.per_room}: ₦${(rooms * DYNAMIC_RATES.house_cleaning.per_room).toLocaleString()}`);
      if (toilets > 0) breakdown.push(`${toilets} toilet(s) × ₦${DYNAMIC_RATES.house_cleaning.per_toilet}: ₦${(toilets * DYNAMIC_RATES.house_cleaning.per_toilet).toLocaleString()}`);
      if (extras.kitchen) breakdown.push(`+ Kitchen: ₦${DYNAMIC_RATES.house_cleaning.kitchen.toLocaleString()}`);
      if (extras.livingRoom) breakdown.push(`+ Living Room: ₦${DYNAMIC_RATES.house_cleaning.living_room.toLocaleString()}`);
      if (extras.windowCleaning) breakdown.push(`+ Window Cleaning: ₦${DYNAMIC_RATES.house_cleaning.window_cleaning.toLocaleString()}`);
      break;
    }

    case "laundry": {
      if (clothesCount > 0) breakdown.push(`${clothesCount} item(s) × ₦${DYNAMIC_RATES.laundry.per_item}: ₦${(clothesCount * DYNAMIC_RATES.laundry.per_item).toLocaleString()}`);
      if (extras.ironing) breakdown.push(`+ Ironing: ₦${(clothesCount * DYNAMIC_RATES.laundry.ironing_per_item).toLocaleString()}`);
      if (extras.delicates) breakdown.push(`+ Delicates: ₦${(clothesCount * DYNAMIC_RATES.laundry.delicates_surcharge).toLocaleString()}`);
      break;
    }

    case "fumigation": {
      breakdown.push(`Fumigation Service: ₦${DYNAMIC_RATES.fumigation.flat_rate.toLocaleString()}`);
      break;
    }

    default:
      breakdown.push("No breakdown available");
  }

  return breakdown;
}

/**
 * Format price as Nigerian Naira
 */
export function formatPrice(amount) {
  return `₦${Number(amount).toLocaleString()}`;
}

/**
 * Get service label
 */
export function getServiceLabel(serviceType) {
  const labels = {
    house_cleaning: "House Cleaning",
    deep_cleaning: "Deep Cleaning",
    laundry: "Laundry",
    fumigation: "Fumigation",
  };
  return labels[serviceType] || serviceType;
}
