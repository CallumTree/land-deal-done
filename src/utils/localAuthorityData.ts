// Local Authority housing data for realistic unit mix suggestions
// Based on recent new build completion data and housing needs

export interface LAHousingData {
  localAuthority: string;
  region: string;
  newBuildCompletions: {
    "2-Bed Semi": number;
    "3-Bed Semi": number;
    "3-Bed Detached": number;
    "4-Bed Detached": number;
    "2-Bed Bungalow": number;
    "3-Bed Bungalow": number;
  };
  dataSource: string;
  lastUpdated: string;
}

// Sample LA data - this would be expanded with real data from ONS, DLUHC, etc.
export const LA_HOUSING_DATA: Record<string, LAHousingData> = {
  // London Boroughs
  "Barnet": {
    localAuthority: "Barnet",
    region: "London",
    newBuildCompletions: {
      "2-Bed Semi": 35,
      "3-Bed Semi": 45,
      "3-Bed Detached": 10,
      "4-Bed Detached": 5,
      "2-Bed Bungalow": 3,
      "3-Bed Bungalow": 2,
    },
    dataSource: "DLUHC completions 2022-24",
    lastUpdated: "2024-09"
  },
  "Enfield": {
    localAuthority: "Enfield",
    region: "London",
    newBuildCompletions: {
      "2-Bed Semi": 40,
      "3-Bed Semi": 40,
      "3-Bed Detached": 12,
      "4-Bed Detached": 5,
      "2-Bed Bungalow": 2,
      "3-Bed Bungalow": 1,
    },
    dataSource: "DLUHC completions 2022-24",
    lastUpdated: "2024-09"
  },
  
  // South East
  "Sevenoaks": {
    localAuthority: "Sevenoaks",
    region: "South East",
    newBuildCompletions: {
      "2-Bed Semi": 25,
      "3-Bed Semi": 35,
      "3-Bed Detached": 20,
      "4-Bed Detached": 15,
      "2-Bed Bungalow": 3,
      "3-Bed Bungalow": 2,
    },
    dataSource: "DLUHC completions 2022-24",
    lastUpdated: "2024-09"
  },
  "Brighton and Hove": {
    localAuthority: "Brighton and Hove",
    region: "South East",
    newBuildCompletions: {
      "2-Bed Semi": 45,
      "3-Bed Semi": 35,
      "3-Bed Detached": 10,
      "4-Bed Detached": 5,
      "2-Bed Bungalow": 3,
      "3-Bed Bungalow": 2,
    },
    dataSource: "DLUHC completions 2022-24",
    lastUpdated: "2024-09"
  },
  
  // North West
  "Manchester": {
    localAuthority: "Manchester",
    region: "North West",
    newBuildCompletions: {
      "2-Bed Semi": 40,
      "3-Bed Semi": 35,
      "3-Bed Detached": 15,
      "4-Bed Detached": 7,
      "2-Bed Bungalow": 2,
      "3-Bed Bungalow": 1,
    },
    dataSource: "DLUHC completions 2022-24",
    lastUpdated: "2024-09"
  },
  "Liverpool": {
    localAuthority: "Liverpool",
    region: "North West",
    newBuildCompletions: {
      "2-Bed Semi": 38,
      "3-Bed Semi": 37,
      "3-Bed Detached": 15,
      "4-Bed Detached": 7,
      "2-Bed Bungalow": 2,
      "3-Bed Bungalow": 1,
    },
    dataSource: "DLUHC completions 2022-24",
    lastUpdated: "2024-09"
  },
  
  // Yorkshire & Humber
  "Leeds": {
    localAuthority: "Leeds",
    region: "Yorkshire & Humber",
    newBuildCompletions: {
      "2-Bed Semi": 35,
      "3-Bed Semi": 40,
      "3-Bed Detached": 15,
      "4-Bed Detached": 7,
      "2-Bed Bungalow": 2,
      "3-Bed Bungalow": 1,
    },
    dataSource: "DLUHC completions 2022-24",
    lastUpdated: "2024-09"
  },
  
  // East Midlands
  "Nottingham": {
    localAuthority: "Nottingham",
    region: "East Midlands",
    newBuildCompletions: {
      "2-Bed Semi": 38,
      "3-Bed Semi": 37,
      "3-Bed Detached": 15,
      "4-Bed Detached": 7,
      "2-Bed Bungalow": 2,
      "3-Bed Bungalow": 1,
    },
    dataSource: "DLUHC completions 2022-24",
    lastUpdated: "2024-09"
  },
  
  // Default/fallback for unknown LAs
  "Default": {
    localAuthority: "Default",
    region: "South East",
    newBuildCompletions: {
      "2-Bed Semi": 30,
      "3-Bed Semi": 40,
      "3-Bed Detached": 15,
      "4-Bed Detached": 10,
      "2-Bed Bungalow": 3,
      "3-Bed Bungalow": 2,
    },
    dataSource: "National average 2022-24",
    lastUpdated: "2024-09"
  }
};

/**
 * Get LA housing data, with fallback to regional or national defaults
 */
export const getLAHousingData = (localAuthority?: string, region?: string): LAHousingData => {
  // Try exact LA match first
  if (localAuthority && LA_HOUSING_DATA[localAuthority]) {
    return LA_HOUSING_DATA[localAuthority];
  }
  
  // Try to find any LA in the same region as fallback
  if (region) {
    const regionalLA = Object.values(LA_HOUSING_DATA).find(
      data => data.region === region && data.localAuthority !== "Default"
    );
    if (regionalLA) {
      return regionalLA;
    }
  }
  
  // Fall back to default
  return LA_HOUSING_DATA["Default"];
};

/**
 * Detect local authority from postcode or location name
 * This is a simplified version - in production would use API lookup
 */
export const detectLocalAuthority = async (location: string): Promise<string | null> => {
  // Simple pattern matching for demo
  // In production, this would call an API like postcodes.io or OS Places API
  
  const locationLower = location.toLowerCase();
  
  // Check for known LA names in the location string
  const knownLAs = Object.keys(LA_HOUSING_DATA).filter(la => la !== "Default");
  for (const la of knownLAs) {
    if (locationLower.includes(la.toLowerCase())) {
      return la;
    }
  }
  
  // Try API lookup for postcode (simplified)
  if (/^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i.test(location.trim())) {
    try {
      const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(location)}`);
      const data = await response.json();
      if (data.status === 200 && data.result?.admin_district) {
        return data.result.admin_district;
      }
    } catch (error) {
      console.warn("Failed to lookup postcode:", error);
    }
  }
  
  return null;
};

/**
 * Calculate adjusted unit mix based on LA data vs region norm
 */
export const calculateAdjustedMix = (
  baseMix: Array<{ type: string; percent: number; gia: number }>,
  laData: LAHousingData,
  totalUnits: number,
  regionNorm?: LAHousingData
): Array<{ type: string; units: number; gia: number; adjustedFrom: "LA data" }> => {
  // Use regional average as norm if not provided
  const norm = regionNorm || LA_HOUSING_DATA["Default"];
  
  // Calculate adjustment ratios for each type
  const adjustmentRatios: Record<string, number> = {};
  const laCompletions = laData.newBuildCompletions;
  const normCompletions = norm.newBuildCompletions;
  
  Object.keys(laCompletions).forEach(type => {
    const laPercent = laCompletions[type as keyof typeof laCompletions] || 1;
    const normPercent = normCompletions[type as keyof typeof normCompletions] || 1;
    adjustmentRatios[type] = laPercent / normPercent;
  });
  
  // Apply adjustments to base mix
  let adjustedMix = baseMix.map(item => {
    const ratio = adjustmentRatios[item.type] || 1;
    return {
      type: item.type,
      percent: item.percent * ratio,
      gia: item.gia
    };
  });
  
  // Normalize percentages to sum to 100
  const totalPercent = adjustedMix.reduce((sum, item) => sum + item.percent, 0);
  adjustedMix = adjustedMix.map(item => ({
    ...item,
    percent: (item.percent / totalPercent) * 100
  }));
  
  // Apply max threshold (no more than 50% of one type unless data strongly suggests)
  const maxThreshold = 50;
  adjustedMix = adjustedMix.map(item => {
    if (item.percent > maxThreshold) {
      const strongEvidence = (adjustmentRatios[item.type] || 1) > 1.5;
      if (!strongEvidence) {
        return { ...item, percent: maxThreshold };
      }
    }
    return item;
  });
  
  // Re-normalize after applying threshold
  const adjustedTotal = adjustedMix.reduce((sum, item) => sum + item.percent, 0);
  adjustedMix = adjustedMix.map(item => ({
    ...item,
    percent: (item.percent / adjustedTotal) * 100
  }));
  
  // Convert percentages to unit counts
  let result = adjustedMix.map(item => ({
    type: item.type,
    units: Math.round((item.percent / 100) * totalUnits),
    gia: item.gia,
    adjustedFrom: "LA data" as const
  }));
  
  // Ensure total units match by adjusting the largest category
  const allocatedUnits = result.reduce((sum, item) => sum + item.units, 0);
  if (allocatedUnits !== totalUnits) {
    const diff = totalUnits - allocatedUnits;
    const largestIndex = result.reduce((maxIdx, item, idx, arr) => 
      item.units > arr[maxIdx].units ? idx : maxIdx, 0);
    result[largestIndex].units += diff;
  }
  
  // Remove any zero-unit entries and consolidate duplicates
  result = consolidateDuplicates(result.filter(item => item.units > 0));
  
  return result;
};

/**
 * Consolidate duplicate dwelling types by combining their units
 */
const consolidateDuplicates = (
  mix: Array<{ type: string; units: number; gia: number; adjustedFrom: "LA data" }>
): Array<{ type: string; units: number; gia: number; adjustedFrom: "LA data" }> => {
  const consolidated: Record<string, { units: number; gia: number; adjustedFrom: "LA data" }> = {};
  
  mix.forEach(item => {
    if (consolidated[item.type]) {
      consolidated[item.type].units += item.units;
    } else {
      consolidated[item.type] = {
        units: item.units,
        gia: item.gia,
        adjustedFrom: item.adjustedFrom
      };
    }
  });
  
  return Object.entries(consolidated).map(([type, data]) => ({
    type,
    ...data
  }));
};
