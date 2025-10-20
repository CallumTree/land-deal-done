export interface RegionPreset {
  region: string;
  localAuthorities?: string[];
  salesPerSqm: {
    "2-Bed Semi": number;
    "3-Bed Semi": number;
    "3-Bed Detached": number;
    "4-Bed Detached": number;
    "2-Bed Bungalow": number;
    "3-Bed Bungalow": number;
    "Apartment (1-bed)": number;
    "Apartment (2-bed)": number;
  };
  buildPerSqm: {
    low: number;
    medium: number;
    high: number;
  };
  fees: {
    professionalFeesPercent: number;
    marketingSalesPercent: number;
    contingencyPercent: number;
  };
  typicalRanges: {
    planning: string;
    utilities: string;
    ecology: string;
  };
}

export const REGION_PRESETS: Record<string, RegionPreset> = {
  "London": {
    region: "London",
    salesPerSqm: {
      "2-Bed Semi": 6500,
      "3-Bed Semi": 6200,
      "3-Bed Detached": 6800,
      "4-Bed Detached": 7200,
      "2-Bed Bungalow": 5800,
      "3-Bed Bungalow": 6200,
      "Apartment (1-bed)": 7500,
      "Apartment (2-bed)": 7200,
    },
    buildPerSqm: {
      low: 1950,
      medium: 2300,
      high: 2800,
    },
    fees: {
      professionalFeesPercent: 12,
      marketingSalesPercent: 2.5,
      contingencyPercent: 7,
    },
    typicalRanges: {
      planning: "£15k–£35k (BC + Planning)",
      utilities: "£8k–£15k per connection",
      ecology: "Phase 1: £3k–£6k, Phase 2: £8k–£20k",
    },
  },
  "South East": {
    region: "South East",
    salesPerSqm: {
      "2-Bed Semi": 4200,
      "3-Bed Semi": 4000,
      "3-Bed Detached": 4400,
      "4-Bed Detached": 4800,
      "2-Bed Bungalow": 3800,
      "3-Bed Bungalow": 4100,
      "Apartment (1-bed)": 4500,
      "Apartment (2-bed)": 4300,
    },
    buildPerSqm: {
      low: 1700,
      medium: 2000,
      high: 2400,
    },
    fees: {
      professionalFeesPercent: 11,
      marketingSalesPercent: 2,
      contingencyPercent: 6,
    },
    typicalRanges: {
      planning: "£12k–£28k (BC + Planning)",
      utilities: "£6k–£12k per connection",
      ecology: "Phase 1: £2.5k–£5k, Phase 2: £7k–£18k",
    },
  },
  "South West": {
    region: "South West",
    salesPerSqm: {
      "2-Bed Semi": 3500,
      "3-Bed Semi": 3400,
      "3-Bed Detached": 3700,
      "4-Bed Detached": 4100,
      "2-Bed Bungalow": 3300,
      "3-Bed Bungalow": 3600,
      "Apartment (1-bed)": 3800,
      "Apartment (2-bed)": 3600,
    },
    buildPerSqm: {
      low: 1650,
      medium: 1900,
      high: 2300,
    },
    fees: {
      professionalFeesPercent: 10,
      marketingSalesPercent: 1.8,
      contingencyPercent: 5.5,
    },
    typicalRanges: {
      planning: "£10k–£22k (BC + Planning)",
      utilities: "£5k–£10k per connection",
      ecology: "Phase 1: £2k–£4.5k, Phase 2: £6k–£15k",
    },
  },
  "East": {
    region: "East",
    salesPerSqm: {
      "2-Bed Semi": 3800,
      "3-Bed Semi": 3600,
      "3-Bed Detached": 4000,
      "4-Bed Detached": 4400,
      "2-Bed Bungalow": 3500,
      "3-Bed Bungalow": 3800,
      "Apartment (1-bed)": 4000,
      "Apartment (2-bed)": 3800,
    },
    buildPerSqm: {
      low: 1650,
      medium: 1950,
      high: 2350,
    },
    fees: {
      professionalFeesPercent: 10.5,
      marketingSalesPercent: 1.9,
      contingencyPercent: 6,
    },
    typicalRanges: {
      planning: "£11k–£24k (BC + Planning)",
      utilities: "£5.5k–£11k per connection",
      ecology: "Phase 1: £2.2k–£5k, Phase 2: £6.5k–£16k",
    },
  },
  "East Midlands": {
    region: "East Midlands",
    salesPerSqm: {
      "2-Bed Semi": 2800,
      "3-Bed Semi": 2700,
      "3-Bed Detached": 3000,
      "4-Bed Detached": 3400,
      "2-Bed Bungalow": 2600,
      "3-Bed Bungalow": 2900,
      "Apartment (1-bed)": 3000,
      "Apartment (2-bed)": 2900,
    },
    buildPerSqm: {
      low: 1550,
      medium: 1800,
      high: 2200,
    },
    fees: {
      professionalFeesPercent: 10,
      marketingSalesPercent: 1.7,
      contingencyPercent: 5.5,
    },
    typicalRanges: {
      planning: "£9k–£20k (BC + Planning)",
      utilities: "£4.5k–£9k per connection",
      ecology: "Phase 1: £2k–£4k, Phase 2: £5.5k–£14k",
    },
  },
  "West Midlands": {
    region: "West Midlands",
    salesPerSqm: {
      "2-Bed Semi": 2900,
      "3-Bed Semi": 2800,
      "3-Bed Detached": 3100,
      "4-Bed Detached": 3500,
      "2-Bed Bungalow": 2700,
      "3-Bed Bungalow": 3000,
      "Apartment (1-bed)": 3100,
      "Apartment (2-bed)": 3000,
    },
    buildPerSqm: {
      low: 1600,
      medium: 1850,
      high: 2250,
    },
    fees: {
      professionalFeesPercent: 10,
      marketingSalesPercent: 1.75,
      contingencyPercent: 5.5,
    },
    typicalRanges: {
      planning: "£9.5k–£21k (BC + Planning)",
      utilities: "£5k–£9.5k per connection",
      ecology: "Phase 1: £2k–£4.2k, Phase 2: £6k–£14.5k",
    },
  },
  "North West": {
    region: "North West",
    salesPerSqm: {
      "2-Bed Semi": 2600,
      "3-Bed Semi": 2500,
      "3-Bed Detached": 2800,
      "4-Bed Detached": 3200,
      "2-Bed Bungalow": 2400,
      "3-Bed Bungalow": 2700,
      "Apartment (1-bed)": 2800,
      "Apartment (2-bed)": 2700,
    },
    buildPerSqm: {
      low: 1550,
      medium: 1800,
      high: 2200,
    },
    fees: {
      professionalFeesPercent: 10,
      marketingSalesPercent: 1.7,
      contingencyPercent: 5.5,
    },
    typicalRanges: {
      planning: "£8.5k–£19k (BC + Planning)",
      utilities: "£4.5k–£9k per connection",
      ecology: "Phase 1: £1.8k–£4k, Phase 2: £5.5k–£13k",
    },
  },
  "North East": {
    region: "North East",
    salesPerSqm: {
      "2-Bed Semi": 2200,
      "3-Bed Semi": 2100,
      "3-Bed Detached": 2400,
      "4-Bed Detached": 2800,
      "2-Bed Bungalow": 2000,
      "3-Bed Bungalow": 2300,
      "Apartment (1-bed)": 2400,
      "Apartment (2-bed)": 2300,
    },
    buildPerSqm: {
      low: 1500,
      medium: 1750,
      high: 2150,
    },
    fees: {
      professionalFeesPercent: 9.5,
      marketingSalesPercent: 1.6,
      contingencyPercent: 5,
    },
    typicalRanges: {
      planning: "£8k–£17k (BC + Planning)",
      utilities: "£4k–£8k per connection",
      ecology: "Phase 1: £1.5k–£3.5k, Phase 2: £5k–£12k",
    },
  },
  "Yorkshire & Humber": {
    region: "Yorkshire & Humber",
    salesPerSqm: {
      "2-Bed Semi": 2500,
      "3-Bed Semi": 2400,
      "3-Bed Detached": 2700,
      "4-Bed Detached": 3100,
      "2-Bed Bungalow": 2300,
      "3-Bed Bungalow": 2600,
      "Apartment (1-bed)": 2700,
      "Apartment (2-bed)": 2600,
    },
    buildPerSqm: {
      low: 1550,
      medium: 1800,
      high: 2200,
    },
    fees: {
      professionalFeesPercent: 10,
      marketingSalesPercent: 1.7,
      contingencyPercent: 5.5,
    },
    typicalRanges: {
      planning: "£8.5k–£18k (BC + Planning)",
      utilities: "£4.5k–£8.5k per connection",
      ecology: "Phase 1: £1.8k–£4k, Phase 2: £5.5k–£13k",
    },
  },
  "Wales": {
    region: "Wales",
    salesPerSqm: {
      "2-Bed Semi": 2400,
      "3-Bed Semi": 2300,
      "3-Bed Detached": 2600,
      "4-Bed Detached": 3000,
      "2-Bed Bungalow": 2200,
      "3-Bed Bungalow": 2500,
      "Apartment (1-bed)": 2600,
      "Apartment (2-bed)": 2500,
    },
    buildPerSqm: {
      low: 1550,
      medium: 1800,
      high: 2200,
    },
    fees: {
      professionalFeesPercent: 10,
      marketingSalesPercent: 1.7,
      contingencyPercent: 5.5,
    },
    typicalRanges: {
      planning: "£8k–£18k (BC + Planning)",
      utilities: "£4.5k–£9k per connection",
      ecology: "Phase 1: £1.8k–£4k, Phase 2: £5.5k–£13k",
    },
  },
  "Scotland": {
    region: "Scotland",
    salesPerSqm: {
      "2-Bed Semi": 2700,
      "3-Bed Semi": 2600,
      "3-Bed Detached": 2900,
      "4-Bed Detached": 3300,
      "2-Bed Bungalow": 2500,
      "3-Bed Bungalow": 2800,
      "Apartment (1-bed)": 2900,
      "Apartment (2-bed)": 2800,
    },
    buildPerSqm: {
      low: 1600,
      medium: 1850,
      high: 2250,
    },
    fees: {
      professionalFeesPercent: 10.5,
      marketingSalesPercent: 1.8,
      contingencyPercent: 6,
    },
    typicalRanges: {
      planning: "£9k–£20k (BC + Planning)",
      utilities: "£5k–£10k per connection",
      ecology: "Phase 1: £2k–£4.5k, Phase 2: £6k–£15k",
    },
  },
};

export const UK_REGIONS = Object.keys(REGION_PRESETS);
