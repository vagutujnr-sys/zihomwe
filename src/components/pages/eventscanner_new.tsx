"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Compass, RefreshCw, MapPinOff } from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface Event {
  id: number;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  distance: string;
}

type LocationState = "pending" | "searching" | "ready" | "denied";
type MapState = "loading" | "ready" | "failed";

const HARARE_COORDS: [number, number] = [31.0335, -17.8252];

const EVENT_TEMPLATES = [
  {
    title: "Community Meetup",
    description: "Local community gathering",
    offsetLat: 0.0027,
    offsetLng: 0.0014,
    distance: "1.1 km",
  },
  {
    title: "Youth Training",
    description: "Mentorship and opportunity workshop",
    offsetLat: -0.0022,
    offsetLng: -0.0011,
    distance: "2.3 km",
  },
  {
    title: "Charity Drive",
    description: "Community resources and donations",
    offsetLat: 0.0012,
    offsetLng: -0.0019,
    distance: "3.0 km",
  },
];

export default function EventScanner({ onBack }: { onBack?: () => void }) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const eventMarkersRef = useRef<Array<{ id: number; marker: mapboxgl.Marker; popup: mapboxgl.Popup }>>([]);
  const watchIdRef = useRef<number | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const scanStartedRef = useRef(false);
  const autoCenterRef = useRef(true);
  const mapLoadedRef = useRef(false);

  const [mapState, setMapState] = useState<MapState>("loading");
  const [locationState, setLocationState] = useState<LocationState>("pending");
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [notification, setNotification] = useState("Finding your location...");

  const router = useRouter();
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  const goBack = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/main?tab=home");
  }, [onBack, router]);

  const statusLabel = useMemo(() => {
    if (locationState === "denied") return "Permission Denied";
    if (locationState === "searching") return "Searching";
    if (locationState === "ready") return "Ready";
    return "Starting";
  }, [locationState]);

  const isInteractive = mapState === "ready" && locationState !== "denied";
  const showScanSheet = scanning || events.length > 0;

  const clearEventMarkers = useCallback(() => {
    eventMarkersRef.current.forEach(({ marker, popup }) => {
      popup.remove();
      marker.remove();
    });
    eventMarkersRef.current = [];
  }, []);

  const formatEventPopup = useCallback((event: Event) => {
    return `
      <div class="event-popup-card">
        <div class="popup-title">${event.title}</div>
        <div class="popup-desc">${event.description}</div>
        <div class="popup-distance">${event.distance}</div>
      </div>
    `;
  }, []);

  const createUserMarkerElement = useCallback(() => {
    const wrapper = document.createElement("div");
    wrapper.className = "user-marker-wrapper";
    wrapper.innerHTML = `
      <div class="user-marker-ring"></div>
      <div class="user-marker-core"></div>
      <div class="user-marker-sweep"></div>
    `;
    return wrapper;
  }, []);

  const createEventMarkerElement = useCallback((eventId: number) => {
    const markerElement = document.createElement("button");
    markerElement.type = "button";
    markerElement.className = "event-marker-button event-marker-default";
    markerElement.dataset.eventId = String(eventId);
    markerElement.innerHTML = `<span class="event-marker-core"></span>`;
    return markerElement;
  }, []);

  const updateMarkerHighlight = useCallback((selectedId: number | null) => {
    eventMarkersRef.current.forEach(({ id, marker }) => {
      const element = marker.getElement();
      if (!element) return;
      if (selectedId === id) {
        element.classList.add("event-marker-selected");
        element.classList.remove("event-marker-default");
      } else {
        element.classList.remove("event-marker-selected");
        element.classList.add("event-marker-default");
      }
    });
  }, []);

  const flyToPosition = useCallback((coords: { lat: number; lng: number }) => {
    if (!mapRef.current) return;
    mapRef.current.easeTo({
      center: [coords.lng, coords.lat],
      zoom: 15,
      duration: 1200,
      speed: 0.8,
      curve: 1,
    });
  }, []);

  const ensureUserMarker = useCallback(
    (coords: { lat: number; lng: number }) => {
      if (!mapRef.current) return;
      if (!userMarkerRef.current) {
        const marker = new mapboxgl.Marker({
          element: createUserMarkerElement(),
          anchor: "center",
        })
          .setLngLat([coords.lng, coords.lat])
          .addTo(mapRef.current);
        userMarkerRef.current = marker;
        return;
      }
      userMarkerRef.current.setLngLat([coords.lng, coords.lat]);
    },
    [createUserMarkerElement]
  );

  const buildEvents = useCallback((coords: { lat: number; lng: number }) => {
    return EVENT_TEMPLATES.map((template, index) => ({
      id: index + 1,
      title: template.title,
      description: template.description,
      latitude: coords.lat + template.offsetLat,
      longitude: coords.lng + template.offsetLng,
      distance: template.distance,
    }));
  }, []);

  const openEventPopup = useCallback(
    (event: Event, marker: mapboxgl.Marker) => {
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: [0, -28],
        className: "event-popup-wrapper",
      }).setHTML(formatEventPopup(event));

      marker.setPopup(popup);
      if (mapRef.current) popup.addTo(mapRef.current);
      return popup;
    },
    [formatEventPopup]
  );

  const handleSelectEvent = useCallback(
    (event: Event) => {
      if (!mapRef.current) return;
      const match = eventMarkersRef.current.find((item) => item.id === event.id);
      if (match) {
        match.popup.addTo(mapRef.current);
      }
      setSelectedEventId(event.id);
      flyToPosition({ lat: event.latitude, lng: event.longitude });
      autoCenterRef.current = false;
    },
    [flyToPosition]
  );

  const startScan = useCallback(
    (coords: { lat: number; lng: number }) => {
      if (!mapRef.current) return;
      setScanning(true);
      setEvents([]);
      setSelectedEventId(null);
      clearEventMarkers();

      if (scanTimerRef.current) {
        window.clearTimeout(scanTimerRef.current);
      }

      scanTimerRef.current = window.setTimeout(() => {
        const nearbyEvents = buildEvents(coords);
        setEvents(nearbyEvents);

        nearbyEvents.forEach((event) => {
          const markerEl = createEventMarkerElement(event.id);
          const marker = new mapboxgl.Marker({ element: markerEl, anchor: "bottom" })
            .setLngLat([event.longitude, event.latitude])
            .addTo(mapRef.current!);

          const popup = openEventPopup(event, marker);
          popup.remove();

          markerEl.addEventListener("click", () => {
            setSelectedEventId(event.id);
            if (mapRef.current) {
              mapRef.current.flyTo({ center: [event.longitude, event.latitude], zoom: 15, duration: 1000 });
            }
            if (mapRef.current) popup.addTo(mapRef.current);
          });

          eventMarkersRef.current.push({ id: event.id, marker, popup });
        });

        setScanning(false);
      }, 2400);
    },
    [buildEvents, clearEventMarkers, createEventMarkerElement, openEventPopup]
  );

  const handleLocationSuccess = useCallback(
    (position: GeolocationPosition) => {
      const nextCoords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      setUserCoords(nextCoords);
      setLocationState("ready");
      setNotification("Location connected.");
      ensureUserMarker(nextCoords);
      if (autoCenterRef.current) {
        flyToPosition(nextCoords);
      }
    },
    [ensureUserMarker, flyToPosition]
  );

  const handleLocationError = useCallback((error: GeolocationPositionError) => {
    if (error.code === error.PERMISSION_DENIED) {
      setLocationState("denied");
      setNotification("Location permission is required.");
      return;
    }
    setLocationState("searching");
    setNotification("Unable to read location. Retrying...");
  }, []);

  const startLocationTracking = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationState("denied");
      setNotification("Geolocation is not available in this browser.");
      return;
    }

    setLocationState("searching");
    setNotification("Requesting location permission...");

    navigator.geolocation.getCurrentPosition(handleLocationSuccess, handleLocationError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000,
    });

    const watchId = navigator.geolocation.watchPosition(handleLocationSuccess, handleLocationError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000,
    });
    watchIdRef.current = watchId;
  }, [handleLocationError, handleLocationSuccess]);

  const handleRetryPermission = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setLocationState("searching");
    setNotification("Retrying location request...");
    startLocationTracking();
  }, [startLocationTracking]);

  const handleCurrentLocation = useCallback(() => {
    if (!userCoords || !mapRef.current) return;
    autoCenterRef.current = true;
    flyToPosition(userCoords);
  }, [flyToPosition, userCoords]);

  useEffect(() => {
    if (!mapboxToken || !mapContainer.current || mapRef.current) return;

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: HARARE_COORDS,
      zoom: 13,
    });

    mapRef.current = map;

    map.on("load", () => {
      mapLoadedRef.current = true;
      setMapState("ready");
      map.resize();
      if (userCoords) {
        ensureUserMarker(userCoords);
        if (autoCenterRef.current) {
          flyToPosition(userCoords);
        }
      }
    });

    map.on("error", () => {
      setMapState("failed");
      setNotification("Unable to load the map.");
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (scanTimerRef.current) {
        window.clearTimeout(scanTimerRef.current);
      }
      clearEventMarkers();
      map.remove();
      mapRef.current = null;
    };
  }, [clearEventMarkers, ensureUserMarker, flyToPosition, mapboxToken, userCoords]);

  useEffect(() => {
    if (locationState === "ready" && mapLoadedRef.current && !scanStartedRef.current && userCoords) {
      scanStartedRef.current = true;
      startScan(userCoords);
    }
  }, [locationState, startScan, userCoords]);

  useEffect(() => {
    startLocationTracking();
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (scanTimerRef.current) {
        window.clearTimeout(scanTimerRef.current);
      }
    };
  }, [startLocationTracking]);

  useEffect(() => {
    updateMarkerHighlight(selectedEventId);
  }, [selectedEventId, updateMarkerHighlight]);

  const eventSheetTitle = scanning ? "Scanning nearby events..." : events.length > 0 ? "Nearby events" : "No nearby events found";

  if (!mapboxToken) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-950 text-white">
        <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl">
          <p className="text-sm font-semibold">Mapbox token not configured</p>
          <p className="mt-2 text-sm text-slate-400">Add NEXT_PUBLIC_MAPBOX_TOKEN to .env.local and restart the dev server.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 h-screen w-full overflow-hidden bg-slate-950">
      <div ref={mapContainer} className="w-full h-full" />

      <div className="pointer-events-none absolute inset-0 bg-slate-950/20" />

      <button
        type="button"
        onClick={goBack}
        className="absolute left-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/70 bg-white/90 text-slate-900 shadow-2xl transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-400"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={handleCurrentLocation}
        disabled={!userCoords || !isInteractive}
        className="absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/90 text-slate-900 shadow-2xl transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Compass className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() => {
          if (userCoords) startScan(userCoords);
        }}
        disabled={!isInteractive}
        className="absolute right-4 bottom-24 z-20 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 text-sm font-semibold text-white shadow-2xl shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw className="h-4 w-4" />
        Scan Again
      </button>


      {locationState === "denied" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-[32px] border border-white/20 bg-slate-950/90 p-6 text-white shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <MapPinOff className="h-6 w-6 text-rose-400" />
              <div>
                <p className="text-sm font-semibold">Location permission required</p>
                <p className="mt-1 text-sm text-slate-300">
                  This page needs location access to scan events around you.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleRetryPermission}
                className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                Retry permission
              </button>
              <button
                type="button"
                onClick={() => setNotification("Please allow location access to continue.")}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Learn more
              </button>
            </div>
          </div>
        </div>
      )}

      {mapState === "failed" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-[32px] border border-white/20 bg-slate-950/90 p-6 text-white shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-300">!</span>
              <div>
                <p className="text-sm font-semibold">Map failed to load</p>
                <p className="mt-1 text-sm text-slate-300">
                  Unable to load Mapbox. Check your token and network connection.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              Reload page
            </button>
          </div>
        </div>
      )}

      <div
        className={`absolute inset-x-4 bottom-4 z-20 mx-auto max-w-3xl rounded-3xl border border-slate-200/70 bg-white/95 shadow-xl shadow-slate-900/10 backdrop-blur-xl transition-transform duration-500 ${
          showScanSheet ? "translate-y-0" : "translate-y-10"
        }`}
        style={{ maxHeight: "52vh" }}
      >
        <div className="border-b border-slate-200/70 px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{eventSheetTitle}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {scanning ? "Locking onto nearby gatherings" : "Tap any event for directions"}
              </p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700">
              {scanning ? "Scanning" : `${events.length} found`}
            </span>
          </div>
        </div>

        <div className="max-h-[42vh] overflow-y-auto px-3 pb-4 pt-3">
          {scanning ? (
            <div className="rounded-3xl border border-dashed border-slate-200/80 bg-slate-950/5 p-8 text-center text-sm text-slate-500">
              <div className="mx-auto mb-3 h-14 w-14 animate-pulse rounded-full bg-emerald-500/20" />
              <p>Searching the area for verified events.</p>
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200/80 bg-slate-950/5 p-8 text-center text-sm text-slate-500">
              <p className="text-slate-900">No events found within range.</p>
              <p className="mt-2">Try moving to a different area or tap Scan Again.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                const isSelected = selectedEventId === event.id;
                return (
                  <div
                    key={event.id}
                    className={`rounded-3xl border p-4 transition ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-50/80 shadow-lg shadow-emerald-500/10"
                        : "border-slate-200 bg-white/90 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900">{event.title}</h3>
                        <p className="mt-2 text-sm text-slate-600">{event.description}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{event.distance}</span>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => handleSelectEvent(event)}
                        className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const url = `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}&travelmode=driving`;
                          window.open(url, "_blank");
                        }}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                      >
                        Directions
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .user-marker-wrapper {
          position: relative;
          width: 60px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }

        .user-marker-ring {
          position: absolute;
          width: 60px;
          height: 60px;
          border-radius: 9999px;
          background: rgba(56, 189, 248, 0.12);
          box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.18);
          animation: radar-pulse 2.8s ease-out infinite;
        }

        .user-marker-core {
          position: relative;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 0 0 12px rgba(56, 189, 248, 0.12);
          z-index: 2;
        }

        .user-marker-sweep {
          position: absolute;
          width: 80px;
          height: 80px;
          border-radius: 9999px;
          background: radial-gradient(circle at 50% 20%, rgba(56, 189, 248, 0.24), transparent 50%);
          animation: radar-rotate 4s linear infinite;
          opacity: 0.75;
        }

        .event-marker-button {
          width: 28px;
          height: 28px;
          border: none;
          background: transparent;
          padding: 0;
          cursor: pointer;
          outline: none;
          display: grid;
          place-items: center;
        }

        .event-marker-core {
          width: 100%;
          height: 100%;
          border-radius: 9999px;
          background: linear-gradient(135deg, rgba(16, 185, 129, 1), rgba(34, 197, 94, 0.95));
          box-shadow: 0 12px 26px rgba(34, 197, 94, 0.26);
          transform: translateY(-2px);
          animation: marker-float 3s ease-in-out infinite;
        }

        .event-marker-default .event-marker-core {
          transform: translateY(-2px) scale(1);
        }

        .event-marker-selected .event-marker-core {
          transform: translateY(-3px) scale(1.25);
          box-shadow: 0 18px 32px rgba(34, 197, 94, 0.38);
        }

        .event-popup-wrapper .mapboxgl-popup-content {
          border-radius: 24px;
          background: rgba(15, 23, 42, 0.96);
          color: white;
          padding: 14px 16px;
          box-shadow: 0 18px 46px rgba(15, 23, 42, 0.32);
        }

        .event-popup-card {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .popup-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: #f8fafc;
        }

        .popup-desc {
          font-size: 0.85rem;
          color: #cbd5e1;
        }

        .popup-distance {
          margin-top: 0.35rem;
          font-size: 0.78rem;
          color: #94a3b8;
        }

        @keyframes radar-pulse {
          0% {
            transform: scale(0.8);
            opacity: 0.85;
          }
          100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }

        @keyframes radar-rotate {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes marker-float {
          0%,
          100% {
            transform: translateY(-2px);
          }
          50% {
            transform: translateY(-6px);
          }
        }
      `}</style>
    </div>
  );
}
