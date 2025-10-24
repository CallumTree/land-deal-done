# Local Authority Housing Data Feature

## Overview
The "Send to GDV" feature now uses local authority (LA) housing data to generate more realistic and varied unit mix suggestions, reducing duplicates and improving accuracy.

## How It Works

### 1. LA Detection
When a user draws a polygon and clicks "Send to GDV":
- The system attempts to detect the local authority from the search query or postcode
- Falls back to regional data if specific LA data is unavailable
- Uses national defaults as final fallback

### 2. Data-Driven Mix Calculation
- Base band is determined by density (Family Suburban, Balanced Mixed, Compact Mixed, or Urban Edge)
- LA completion data adjusts the percentages of each dwelling type
- Maximum threshold of 50% for any single type (unless data strongly suggests otherwise)
- Duplicates are consolidated automatically

### 3. User Experience
- Tooltip on "Send to GDV" button explains the smart mix generation
- Info banner shows the source of the suggestion (e.g., "DLUHC completions 2022-24")
- Shows which LA and base band was used
- All suggestions remain fully editable by the user

## Data Structure

### LAHousingData
```typescript
{
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
```

### Stored in Project
```typescript
suggestionMetadata: {
  source: string;
  localAuthority?: string;
  region: string;
  baseBand: string;
  generatedAt: string;
  useStandardMix?: boolean;
}
```

## Sample Local Authorities Included
- **London**: Barnet, Enfield
- **South East**: Sevenoaks, Brighton and Hove
- **North West**: Manchester, Liverpool
- **Yorkshire & Humber**: Leeds
- **East Midlands**: Nottingham

## Future Enhancements
- Expand LA dataset to cover all UK local authorities
- Integrate live API for real-time housing completion data
- Add housing waiting list data for affordable housing mix
- Allow users to toggle between LA-adjusted and standard mixes
- Add "use standard mix instead" option

## Files Modified
- `src/utils/localAuthorityData.ts` - New utility for LA data and calculations
- `src/components/map/SiteMap.tsx` - Updated to use LA data when generating mix
- `src/pages/ProjectWorkspace.tsx` - Stores and passes suggestion metadata
- `src/components/NapkinCalculator.tsx` - Displays suggestion source info
- `src/types/project.ts` - Added suggestionMetadata field
- `src/types/calculator.ts` - Updated for suggestion metadata

## Benefits
✅ More realistic unit mixes based on actual local market data  
✅ Reduces duplicate dwelling types  
✅ Provides transparency about data sources  
✅ Maintains full user control and editability  
✅ Graceful fallback to regional/national defaults
