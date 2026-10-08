// Nominatim's reverse/search geocoding (see location-picker-modal.tsx) is
// called without `addressdetails=1`, so only the flat `display_name` string
// (e.g. "Tee Street, The Grove, Sheikh Zayed, Aj Jiza, 12556, Egypt") is ever
// stored in listings.location_text — there's no structured
// neighbourhood/city field to read instead. This heuristically extracts an
// "Area - City" pair from that string for compact card display, without
// touching the stored value itself (the full string is still what's saved
// and what the listing detail screen shows).
const STREET_KEYWORDS =
  /\b(street|st|road|rd|avenue|ave|boulevard|blvd|highway|hwy|lane|ln|drive|dr|square|sq|way|alley)\b/i;

export function getShortLocation(locationText: string | null | undefined): string {
  if (!locationText) return '';

  const parts = locationText
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];

  // display_name ends with the country when Nominatim can resolve one.
  const withoutCountry = parts.slice(0, -1);

  const meaningfulParts = withoutCountry.filter((part) => {
    if (/^\d+$/.test(part)) return false; // postal code / bare house number
    if (STREET_KEYWORDS.test(part)) return false; // street-level component
    return true;
  });

  const candidates = meaningfulParts.length > 0 ? meaningfulParts : withoutCountry;

  if (candidates.length >= 2) return `${candidates[0]} - ${candidates[1]}`;
  if (candidates.length === 1) return candidates[0];
  return locationText;
}
