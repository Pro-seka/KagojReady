/** Bangladesh bounding box, a little generous. A location outside it is treated as not shared rather than stored. */
export const BD_BOX = { minLat: 20.5, maxLat: 26.8, minLng: 88.0, maxLng: 92.8 };
export const inBangladesh = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && lat >= BD_BOX.minLat && lat <= BD_BOX.maxLat && lng >= BD_BOX.minLng && lng <= BD_BOX.maxLng;
/** Three decimals is about 110 m: enough to find a pothole's street, not enough to find someone's front door. */
export const roundCoord = (v: number) => Math.round(v * 1000) / 1000;
export function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000, rad = (d: number) => (d * Math.PI) / 180, dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
