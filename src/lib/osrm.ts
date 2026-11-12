/**
 * Open Source Routing Machine (OSRM) driving route and road distance calculator.
 * Used for real-world road network driving routes and mileage calculations across Kerala.
 */

export interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  coordinates: [number, number][]; // [lat, lng] for Leaflet
  source: "osrm" | "fallback";
}

/**
 * Calculates straight line haversine distance in km between two lat/lng points.
 */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Fetches real driving route from OSRM public service with multiple waypoints.
 * Supports Point A -> Stop 1 -> Stop 2 -> Destination.
 */
export async function getMultiStopRoute(
  points: { lat: number; lng: number }[]
): Promise<RouteResult> {
  if (points.length < 2) {
    return {
      distanceKm: 0,
      durationMinutes: 0,
      coordinates: points.map((p) => [p.lat, p.lng]),
      source: "fallback",
    };
  }

  // Format: {lng1},{lat1};{lng2},{lat2};{lng3},{lat3}...
  const coordParam = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coordParam}?overview=full&geometries=geojson`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.code === "Ok" && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distKm = Math.round((route.distance / 1000) * 10) / 10;
        const durMin = Math.round(route.duration / 60);
        // GeoJSON coordinates are [longitude, latitude], convert to [latitude, longitude] for Leaflet
        const coords: [number, number][] = route.geometry.coordinates.map(
          (c: [number, number]) => [c[1], c[0]]
        );
        return {
          distanceKm: distKm,
          durationMinutes: durMin,
          coordinates: coords,
          source: "osrm",
        };
      }
    }
  } catch (err) {
    console.warn("OSRM multi-stop routing failed or timed out, using fallback:", err);
  }

  // Graceful fallback: sum of road-adjusted haversine across legs
  let totalKm = 0;
  const straightCoords: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    totalKm += haversineKm(p1.lat, p1.lng, p2.lat, p2.lng) * 1.25;
    straightCoords.push([p1.lat, p1.lng]);
  }
  straightCoords.push([points[points.length - 1]!.lat, points[points.length - 1]!.lng]);
  const roadEst = Math.round(totalKm * 10) / 10;

  return {
    distanceKm: roadEst,
    durationMinutes: Math.round(roadEst * 1.8), // ~35 km/h average city driving in Kerala
    coordinates: straightCoords,
    source: "fallback",
  };
}

/**
 * Fetches real driving route from OSRM public service between two points.
 */
export async function getDrivingRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<RouteResult> {
  return getMultiStopRoute([
    { lat: startLat, lng: startLng },
    { lat: endLat, lng: endLng },
  ]);
}

export interface GeocodePlace {
  name: string;
  fullName: string;
  lat: number;
  lng: number;
  type?: string;
}

/**
 * Searches places, schools, colleges, landmarks across Kerala using OpenStreetMap Nominatim API.
 */
export async function searchPlaces(query: string): Promise<GeocodePlace[]> {
  const clean = query.trim();
  if (!clean || clean.length < 2) return [];

  // Append Kerala if not specified for local relevance
  const qStr = clean.toLowerCase().includes("kerala") ? clean : `${clean}, Kerala`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(qStr)}&countrycodes=in&limit=6&addressdetails=1`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "Accept-Language": "en" },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map((item: any) => ({
          name: item.name || item.display_name.split(",")[0],
          fullName: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          type: item.type || item.class || "landmark",
        }));
      }
    }
  } catch (err) {
    console.warn("Place search failed:", err);
  }
  return [];
}

