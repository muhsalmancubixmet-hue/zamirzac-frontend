import { useEffect, useRef, useState } from "react";
import type * as LeafletType from "leaflet";
import { Navigation, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Place } from "@/data/hr";
import { getDrivingRoute, getMultiStopRoute } from "@/lib/osrm";

interface LeafletRouteMapProps {
  from: Place;
  to?: Place | undefined;
  via?: Place[];
  live?: boolean;
  className?: string;
  routeCoordinates?: [number, number][] | undefined; // optional pre-computed coordinates
  onRouteCalculated?: (distanceKm: number, durationMinutes: number) => void;
}

export function LeafletRouteMap({
  from,
  to,
  via = [],
  live = false,
  className,
  routeCoordinates,
  onRouteCalculated,
}: LeafletRouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletType.Map | null>(null);
  const layerGroupRef = useRef<LeafletType.LayerGroup | null>(null);
  const [leaflet, setLeaflet] = useState<typeof LeafletType | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ km: number; mins: number } | null>(null);

  // Load Leaflet and CSS dynamically on client-side only (prevents SSR "window is not defined")
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    Promise.all([
      import("leaflet"),
      import("leaflet/dist/leaflet.css"),
    ]).then(([leafletMod]) => {
      if (!cancelled) {
        setLeaflet(leafletMod.default || leafletMod);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Initialize Leaflet Map once Leaflet is loaded and DOM container is mounted
  useEffect(() => {
    if (!leaflet || !mapContainerRef.current || mapInstanceRef.current) return;

    // Center on Kerala coordinates [10.2, 76.3]
    const map = leaflet.map(mapContainerRef.current, {
      center: [from.lat ?? 10.0, from.lng ?? 76.3],
      zoom: 9,
      zoomControl: true,
      attributionControl: false,
    });

    leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    const layerGroup = leaflet.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    layerGroupRef.current = layerGroup;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    };
  }, [leaflet]);

  // Update Markers, Route Polyline, and OSRM calculations when destinations change
  useEffect(() => {
    const L = leaflet;
    const map = mapInstanceRef.current;
    const layers = layerGroupRef.current;
    if (!L || !map || !layers) return;

    layers.clearLayers();

    // Start Pin DivIcon
    const startIcon = L.divIcon({
      className: "custom-leaflet-marker",
      html: `<div style="background-color: #10b981; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); font-family: sans-serif;">A</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const startMarker = L.marker([from.lat, from.lng], { icon: startIcon })
      .bindPopup(`<b>Start</b>: ${from.name}`)
      .addTo(layers);

    const boundsPoints: [number, number][] = [[from.lat, from.lng]];

    // Via Pins
    via.forEach((v, idx) => {
      const viaIcon = L.divIcon({
        className: "custom-leaflet-marker",
        html: `<div style="background-color: #f59e0b; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); font-family: sans-serif;">${idx + 1}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      L.marker([v.lat, v.lng], { icon: viaIcon })
        .bindPopup(`<b>Stop ${idx + 1}</b>: ${v.name}`)
        .addTo(layers);
      boundsPoints.push([v.lat, v.lng]);
    });

    if (to) {
      // End Pin DivIcon
      const endIcon = L.divIcon({
        className: "custom-leaflet-marker",
        html: `<div style="background-color: #ef4444; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); font-family: sans-serif;">B</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      L.marker([to.lat, to.lng], { icon: endIcon })
        .bindPopup(`<b>Destination</b>: ${to.name}`)
        .addTo(layers);
      boundsPoints.push([to.lat, to.lng]);

      // If pre-computed route coordinates are passed, use them directly
      if (routeCoordinates && routeCoordinates.length > 0) {
        const polyline = L.polyline(routeCoordinates, {
          color: live ? "#0ea5e9" : "#2563eb",
          weight: 4,
          opacity: 0.85,
          dashArray: live ? "4, 8" : undefined,
          lineJoin: "round",
        }).addTo(layers);
        map.fitBounds(polyline.getBounds(), { padding: [35, 35] });
      } else {
        // Fetch real road route from OSRM across all waypoints
        setLoadingRoute(true);
        const allWaypoints = [
          { lat: from.lat, lng: from.lng },
          ...via.map((v) => ({ lat: v.lat, lng: v.lng })),
          { lat: to.lat, lng: to.lng },
        ];

        getMultiStopRoute(allWaypoints)
          .then((result) => {
            setRouteInfo({ km: result.distanceKm, mins: result.durationMinutes });
            if (onRouteCalculated) {
              onRouteCalculated(result.distanceKm, result.durationMinutes);
            }

            const polyline = L.polyline(result.coordinates, {
              color: live ? "#0ea5e9" : "#2563eb",
              weight: 4,
              opacity: 0.85,
              dashArray: live ? "4, 8" : undefined,
              lineJoin: "round",
            }).addTo(layers);

            map.fitBounds(polyline.getBounds(), { padding: [35, 35] });
          })
          .catch((err) => {
            console.error("Leaflet routing error:", err);
            // Fallback straight line through all waypoints
            const fallbackPoints: [number, number][] = allWaypoints.map((p) => [p.lat, p.lng]);
            const fallbackLine = L.polyline(fallbackPoints, {
              color: "#2563eb",
              weight: 3,
              dashArray: "4, 6",
            }).addTo(layers);
            map.fitBounds(fallbackLine.getBounds(), { padding: [35, 35] });
          })
          .finally(() => {
            setLoadingRoute(false);
          });
      }
    } else {
      map.setView([from.lat, from.lng], 12);
    }
  }, [leaflet, from, to, via, live, routeCoordinates]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-card shadow-sm min-h-[220px]",
        className
      )}
    >
      <div ref={mapContainerRef} className="h-full w-full min-h-[220px]" />

      {!leaflet && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/40 backdrop-blur-[2px] z-[500]">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" /> Initializing interactive map...
          </div>
        </div>
      )}

      {/* Floating Status & OSRM Info Pill */}
      {leaflet && (
        <div className="absolute top-2.5 left-2.5 z-[1000] flex flex-wrap items-center gap-2 rounded-md bg-card/95 px-3 py-1.5 text-xs shadow-md backdrop-blur-sm border border-border">
          {loadingRoute ? (
            <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
              <Loader2 className="size-3.5 animate-spin text-primary" /> Calculating real road route via OSRM...
            </span>
          ) : routeInfo ? (
            <span className="flex items-center gap-2 font-medium">
              <span className="inline-flex items-center gap-1 text-primary">
                <Navigation className="size-3.5" /> {routeInfo.km} km
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">~{routeInfo.mins} mins driving</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{from.name}</span>
          )}
        </div>
      )}

      {/* Legend Badge */}
      {leaflet && (
        <div className="absolute bottom-2.5 left-2.5 z-[1000] flex items-center gap-3 rounded-md bg-card/95 px-2.5 py-1 text-[11px] font-medium shadow-md border border-border backdrop-blur-sm">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-emerald-500" /> Start
          </span>
          {via.length > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-amber-500" /> Stop
            </span>
          ) : null}
          {to ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-rose-500" /> Destination
            </span>
          ) : null}
          {live ? (
            <span className="inline-flex items-center gap-1 text-sky-600 font-semibold animate-pulse">
              ● Live
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
