"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

type ConstituencyPoint = { id: string; name: string; latitude: number | null; longitude: number | null; districtCount: number; wardCount: number; cellCount: number };

export default function AdminConstituencyMap({ constituencies }: { constituencies: ConstituencyPoint[] }) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!mapElement.current || !mapboxgl.accessToken) return;
    const points = constituencies.filter((item) => item.latitude !== null && item.longitude !== null);
    const map = new mapboxgl.Map({ container: mapElement.current, style: "mapbox://styles/mapbox/light-v11", center: [29.5, -19], zoom: 5.3 });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.on("load", () => {
      const bounds = new mapboxgl.LngLatBounds();
      points.forEach((point) => {
        const element = document.createElement("button");
        element.className = "admin-map-marker";
        element.type = "button";
        element.setAttribute("aria-label", point.name);
        const popup = new mapboxgl.Popup({ offset: 18, closeButton: false }).setHTML(`<strong>${point.name}</strong><br><span>${point.districtCount} districts · ${point.wardCount} wards · ${point.cellCount} cells</span>`);
        const marker = new mapboxgl.Marker({ element }).setLngLat([point.longitude as number, point.latitude as number]).setPopup(popup).addTo(map);
        markersRef.current.push(marker);
        bounds.extend([point.longitude as number, point.latitude as number]);
      });
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, maxZoom: 7 });
    });
    return () => { markersRef.current.forEach((marker) => marker.remove()); markersRef.current = []; map.remove(); mapRef.current = null; };
  }, [constituencies]);

  const locatedCount = constituencies.filter((item) => item.latitude !== null && item.longitude !== null).length;
  if (!mapboxgl.accessToken) return <div className="admin-map-empty">Add a Mapbox token to display the constituency map.</div>;
  if (!locatedCount) return <div className="admin-map-empty">No constituency coordinates have been entered yet.</div>;
  return <div className="admin-map-frame"><div ref={mapElement} className="admin-map" /><span className="admin-map-count">{locatedCount} mapped constituenc{locatedCount === 1 ? "y" : "ies"}</span></div>;
}
