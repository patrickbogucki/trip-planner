import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { Location, ItineraryItem, RouteSegment } from '../types';
import { Compass, Globe } from 'lucide-react';
import { getCategory } from '../utils/categories';
import { areLocationsEquivalent } from '../utils/location';

const formatPopupContent = (name: string) => {
  let displayName = name;
  if (displayName.length > 30) {
    displayName = displayName.substring(0, 30) + '...';
  }
  return displayName;
};

const getThemeColor = (token: '--accent' | '--accent-hover', fallback: string) => {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value || fallback;
};

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const parseColor = (color: string) => {
  const hex = color.trim();
  if (hex.startsWith('#')) {
    const normalized = hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
    const value = normalized.slice(1);
    if (value.length !== 6) return null;
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
    };
  }

  const rgbMatch = color.match(/rgba?\(([^)]+)\)/);
  if (!rgbMatch) return null;

  const [r, g, b] = rgbMatch[1]
    .split(',')
    .slice(0, 3)
    .map((part) => Number.parseFloat(part.trim()));

  if ([r, g, b].some((channel) => Number.isNaN(channel))) return null;
  return { r, g, b };
};

const toHex = ({ r, g, b }: { r: number; g: number; b: number }) =>
  `#${[r, g, b].map((channel) => clampByte(channel).toString(16).padStart(2, '0')).join('')}`;

const mixColor = (baseColor: string, mixWith: { r: number; g: number; b: number }, ratio: number) => {
  const parsed = parseColor(baseColor);
  if (!parsed) return baseColor;
  const mix = Math.max(0, Math.min(1, ratio));
  return toHex({
    r: parsed.r * (1 - mix) + mixWith.r * mix,
    g: parsed.g * (1 - mix) + mixWith.g * mix,
    b: parsed.b * (1 - mix) + mixWith.b * mix,
  });
};

const saturateRouteColor = (color: string) => mixColor(color, { r: 0, g: 163, b: 255 }, 0.35);

const updateMarkerTooltip = (marker: L.Marker, name: string, isActive: boolean) => {
  const tooltipText = formatPopupContent(name);
  const currentTooltip = marker.getTooltip();

  if (currentTooltip) {
    const isCurrentlyPermanent = currentTooltip.options.permanent;
    if (isCurrentlyPermanent === isActive) {
      if (isActive && !marker.isTooltipOpen()) {
        marker.openTooltip();
      }
      return;
    }
  }

  marker.unbindTooltip();
  marker.bindTooltip(tooltipText, {
    direction: 'top',
    offset: [0, -14],
    opacity: 0.9,
    className: 'map-tooltip',
    permanent: isActive,
  });

  if (isActive) {
    marker.openTooltip();
  }
};

interface MapComponentProps {
  savedLocations: Location[];
  itinerary: ItineraryItem[];
  routes: RouteSegment[];
  activeLocation: Location | null;
  onSelectLocation: (loc: Location | null) => void;
  onRegisterZoom?: (fn: () => void) => void;
  searchResults?: Location[];
  onViewportChange?: (center: [number, number], bbox: [number, number, number, number]) => void;
  mapboxToken?: string;
}

export const MapComponent: React.FC<MapComponentProps> = ({
  savedLocations,
  itinerary,
  routes,
  activeLocation,
  onSelectLocation,
  onRegisterZoom,
  searchResults = [],
  onViewportChange,
  mapboxToken: customMapboxToken,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  
  const activeLocationRef = useRef(activeLocation);
  const onSelectLocationRef = useRef(onSelectLocation);

  useEffect(() => {
    activeLocationRef.current = activeLocation;
  }, [activeLocation]);

  useEffect(() => {
    onSelectLocationRef.current = onSelectLocation;
  }, [onSelectLocation]);

  const [isSatellite, setIsSatellite] = useState(false);
  const streetLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteLayerRef = useRef<L.TileLayer | null>(null);
  
  // Store leaflet object references to perform clean updates
  const markersRef = useRef<{ [id: string]: L.Marker }>({});
  const searchMarkersRef = useRef<{ [id: string]: L.Marker }>({});
  const polylineGroupRef = useRef<L.FeatureGroup | null>(null);
  const previewMarkerRef = useRef<L.Marker | null>(null);
  const isFirstLoadRef = useRef(true);

  const mapboxToken = customMapboxToken !== undefined ? customMapboxToken : (import.meta.env.VITE_MAPBOX_TOKEN || '');

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create the Leaflet map instance
    const mapInstance = L.map(mapContainerRef.current, {
      center: [40.7128, -74.006], // Default NYC center
      zoom: 12,
      zoomControl: false,
      attributionControl: false, // Clean UI, custom watermark is enough
    });

    // Add zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);

    // Create the Leaflet tile layers using Mapbox styles (or OSM/Esri fallback if token is missing)
    const streetLayerUrl = mapboxToken
      ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      
    const satelliteLayerUrl = mapboxToken
      ? `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`
      : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

    const streetLayer = L.tileLayer(streetLayerUrl, {
      maxZoom: mapboxToken ? 20 : 19,
      tileSize: mapboxToken ? 512 : 256,
      zoomOffset: mapboxToken ? -1 : 0,
      attribution: mapboxToken
        ? '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        : '© OpenStreetMap contributors'
    });
    
    const satelliteLayer = L.tileLayer(satelliteLayerUrl, {
      maxZoom: mapboxToken ? 20 : 19,
      tileSize: mapboxToken ? 512 : 256,
      zoomOffset: mapboxToken ? -1 : 0,
      attribution: mapboxToken
        ? '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        : 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });

    streetLayerRef.current = streetLayer;
    satelliteLayerRef.current = satelliteLayer;

    // Add initial street layer
    streetLayer.addTo(mapInstance);

    // Create a feature group for route polylines
    const polylineGroup = L.featureGroup().addTo(mapInstance);
    polylineGroupRef.current = polylineGroup;

    mapRef.current = mapInstance;
    setMap(mapInstance);

    // Report initial viewport
    const initCenter = mapInstance.getCenter();
    const initBounds = mapInstance.getBounds();
    onViewportChange?.(
      [initCenter.lng, initCenter.lat],
      [initBounds.getWest(), initBounds.getSouth(), initBounds.getEast(), initBounds.getNorth()]
    );

    // Listen for move/zoom updates
    mapInstance.on('moveend', () => {
      const center = mapInstance.getCenter();
      const bounds = mapInstance.getBounds();
      onViewportChange?.(
        [center.lng, center.lat],
        [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
      );
    });

    mapInstance.on('click', () => {
      onSelectLocationRef.current(null);
    });

    const timerId = setTimeout(() => {
      try {
        mapInstance.invalidateSize();
      } catch (err) {
        // Map might have been unmounted
      }
    }, 100);

    return () => {
      clearTimeout(timerId);
      mapInstance.remove();
      mapRef.current = null;
      setMap(null);
      // Clear leaflet refs to prevent stale data in React 18 Strict Mode double-mounts
      markersRef.current = {};
      searchMarkersRef.current = {};
      polylineGroupRef.current = null;
      previewMarkerRef.current = null;
    };
  }, [mapboxToken]);

  // Sync tile layers based on street vs satellite view
  useEffect(() => {
    if (!map) return;

    if (isSatellite) {
      streetLayerRef.current?.remove();
      satelliteLayerRef.current?.addTo(map);
    } else {
      satelliteLayerRef.current?.remove();
      streetLayerRef.current?.addTo(map);
    }
  }, [map, isSatellite]);

  // Sync Pinned & Itinerary Markers
  useEffect(() => {
    if (!map) return;

    const currentMarkerIds = new Set<string>();

    // Helper to check if location is in itinerary and get its step index
    const getItineraryIndex = (locId: string) => {
      return itinerary.findIndex((item) => item.locationId === locId);
    };

    // Render Saved & Itinerary Markers
    savedLocations.forEach((loc) => {
      const itinIndex = getItineraryIndex(loc.id);
      const isItinerary = itinIndex !== -1;
      const markerId = loc.id;
      currentMarkerIds.add(markerId);

      const isSearchResult = searchResults.some((s) => s.id === loc.id || areLocationsEquivalent(s, loc));

      const catInfo = getCategory(loc.category);
      // Create a circular category icon marker with an optional sequence number badge or checkmark badge
      let badgeHtml = '';
      if (isItinerary) {
        badgeHtml = `<div class="map-marker-badge">${itinIndex + 1}</div>`;
      } else if (isSearchResult) {
        badgeHtml = `
          <div class="map-marker-badge search-pinned-badge" style="background-color: var(--success, #10b981); color: white; display: flex; align-items: center; justify-content: center;">
            <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="3" fill="none" style="display: block;">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        `;
      }

      const iconHtml = `
        <div class="map-category-marker ${isSearchResult ? 'is-search-pinned' : ''}" style="background-color: ${catInfo.color};">
          <svg class="map-category-svg" viewBox="0 0 24 24">
            ${catInfo.svgContent}
          </svg>
          ${badgeHtml}
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'leaflet-custom-marker',
        html: iconHtml,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
      });

      const isActive = activeLocationRef.current ? (activeLocationRef.current.id === loc.id || areLocationsEquivalent(activeLocationRef.current, loc)) : false;

      if (markersRef.current[markerId]) {
        // Update existing marker position & icon
        const existingMarker = markersRef.current[markerId];
        existingMarker.setLatLng([loc.lat, loc.lng]);
        existingMarker.setIcon(customIcon);
        
        updateMarkerTooltip(existingMarker, loc.name, isActive);

        existingMarker.off('click');
        existingMarker.on('click', (e) => {
          if (e.originalEvent) {
            e.originalEvent.stopPropagation();
          }
          const currentActive = activeLocationRef.current;
          if (currentActive && (currentActive.id === loc.id || areLocationsEquivalent(currentActive, loc))) {
            onSelectLocationRef.current(null);
          } else {
            onSelectLocationRef.current(loc);
          }
        });
      } else {
        // Create new marker
        const marker = L.marker([loc.lat, loc.lng], { icon: customIcon }).addTo(map);

        updateMarkerTooltip(marker, loc.name, isActive);

        marker.on('click', (e) => {
          if (e.originalEvent) {
            e.originalEvent.stopPropagation();
          }
          const currentActive = activeLocationRef.current;
          if (currentActive && (currentActive.id === loc.id || areLocationsEquivalent(currentActive, loc))) {
            onSelectLocationRef.current(null);
          } else {
            onSelectLocationRef.current(loc);
          }
        });

        markersRef.current[markerId] = marker;
      }
    });

    // Remove obsolete markers
    Object.keys(markersRef.current).forEach((id) => {
      if (!currentMarkerIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });
  }, [map, savedLocations, itinerary, searchResults]);

  // Sync Active / Preview Location
  useEffect(() => {
    if (!map) return;

    // Clear old preview marker
    if (previewMarkerRef.current) {
      previewMarkerRef.current.remove();
      previewMarkerRef.current = null;
    }

    // Update tooltips on existing markers to reflect active state
    Object.keys(markersRef.current).forEach((id) => {
      const marker = markersRef.current[id];
      const loc = savedLocations.find((l) => l.id === id);
      if (loc) {
        const isActive = activeLocation ? (activeLocation.id === loc.id || areLocationsEquivalent(activeLocation, loc)) : false;
        updateMarkerTooltip(marker, loc.name, isActive);
      }
    });

    if (activeLocation) {
      // Check if location is already pinned
      const matchedSavedLoc = savedLocations.find((loc) => loc.id === activeLocation.id || areLocationsEquivalent(loc, activeLocation));
      const isAlreadyPinned = !!matchedSavedLoc;

      if (isAlreadyPinned && matchedSavedLoc) {
        // If already pinned, just pan to location
        map.invalidateSize();
        map.panTo([activeLocation.lat, activeLocation.lng], {
          animate: true,
          duration: 0.75,
        });
      } else {
        // If not pinned (temporary search suggestion), create a pulsing preview marker
        const catInfo = getCategory(activeLocation.category || 'other');
        const iconHtml = `
          <div class="map-category-marker active" style="background-color: ${catInfo.color};">
            <svg class="map-category-svg" viewBox="0 0 24 24">
              ${catInfo.svgContent}
            </svg>
          </div>
        `;
        const customIcon = L.divIcon({
          className: 'leaflet-custom-marker-preview',
          html: iconHtml,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -14],
        });

        const previewMarker = L.marker([activeLocation.lat, activeLocation.lng], { icon: customIcon }).addTo(map);

        updateMarkerTooltip(previewMarker, activeLocation.name, true);

        previewMarker.on('click', (e) => {
          if (e.originalEvent) {
            e.originalEvent.stopPropagation();
          }
          onSelectLocationRef.current(null);
        });

        previewMarkerRef.current = previewMarker;

        map.invalidateSize();
        map.panTo([activeLocation.lat, activeLocation.lng], {
          animate: true,
          duration: 0.75,
        });
      }
    }
  }, [map, activeLocation, savedLocations]);

  // Sync Temporary Search Result Markers
  useEffect(() => {
    if (!map) return;

    const currentSearchMarkerIds = new Set<string>();

    searchResults.forEach((loc) => {
      // Avoid duplicate search markers if the location is already saved or currently selected/active
      if (
        savedLocations.some((s) => s.id === loc.id || areLocationsEquivalent(s, loc)) ||
        (activeLocation && (activeLocation.id === loc.id || areLocationsEquivalent(activeLocation, loc)))
      ) {
        return;
      }

      const markerId = `search-${loc.id}`;
      currentSearchMarkerIds.add(markerId);

      const catInfo = getCategory(loc.category || 'other');
      const iconHtml = `
        <div class="map-category-marker search-result-dot" style="background-color: #ffffff; border: 1.5px solid ${catInfo.color}; color: ${catInfo.color}; width: 1.75rem; height: 1.75rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-md);">
          <svg class="map-category-svg" viewBox="0 0 24 24">
            ${catInfo.svgContent}
          </svg>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'leaflet-custom-marker search-dot',
        html: iconHtml,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
      });

      if (searchMarkersRef.current[markerId]) {
        const existingMarker = searchMarkersRef.current[markerId];
        existingMarker.setLatLng([loc.lat, loc.lng]);
        existingMarker.setIcon(customIcon);
        existingMarker.unbindTooltip();
        existingMarker.bindTooltip(formatPopupContent(loc.name), {
          direction: 'top',
          offset: [0, -14],
          opacity: 0.9,
          className: 'map-tooltip',
          permanent: false,
        });

        existingMarker.off('click');
        existingMarker.on('click', (e) => {
          if (e.originalEvent) {
            e.originalEvent.stopPropagation();
          }
          const currentActive = activeLocationRef.current;
          if (currentActive && (currentActive.id === loc.id || areLocationsEquivalent(currentActive, loc))) {
            onSelectLocationRef.current(null);
          } else {
            onSelectLocationRef.current(loc);
          }
        });
      } else {
        const marker = L.marker([loc.lat, loc.lng], { icon: customIcon }).addTo(map);

        marker.bindTooltip(formatPopupContent(loc.name), {
          direction: 'top',
          offset: [0, -14],
          opacity: 0.9,
          className: 'map-tooltip',
          permanent: false,
        });

        marker.on('click', (e) => {
          if (e.originalEvent) {
            e.originalEvent.stopPropagation();
          }
          const currentActive = activeLocationRef.current;
          if (currentActive && (currentActive.id === loc.id || areLocationsEquivalent(currentActive, loc))) {
            onSelectLocationRef.current(null);
          } else {
            onSelectLocationRef.current(loc);
          }
        });

        searchMarkersRef.current[markerId] = marker;
      }
    });

    // Remove obsolete search markers
    Object.keys(searchMarkersRef.current).forEach((id) => {
      if (!currentSearchMarkerIds.has(id)) {
        searchMarkersRef.current[id].remove();
        delete searchMarkersRef.current[id];
      }
    });
  }, [map, searchResults, savedLocations, activeLocation]);

  // Sync Route Polylines
  useEffect(() => {
    const polyGroup = polylineGroupRef.current;
    if (!polyGroup || !map) return;

    // Clear previous routes
    polyGroup.clearLayers();

    // Draw paths for each route segment
    routes.forEach((route) => {
      const isTransit = route.mode === 'transit';
      const accentColor = getThemeColor('--accent', '#418395');
      const accentHoverColor = getThemeColor('--accent-hover', '#356a79');
      const routeColor = saturateRouteColor(isTransit ? accentHoverColor : accentColor);
      const routeOutline = isTransit ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.95)';
      const routeDashArray = isTransit ? '10, 8' : undefined;
      const routeOutlineDashArray = isTransit ? '12, 8' : undefined;
      const routeOutlineLine = L.polyline(route.geometry, {
        color: routeOutline,
        weight: 10,
        opacity: 0.95,
        dashArray: routeOutlineDashArray,
        lineCap: 'round',
        lineJoin: 'round',
      });
      const polyline = L.polyline(route.geometry, {
        color: routeColor,
        weight: 6,
        opacity: 0.98,
        dashArray: routeDashArray,
        lineCap: 'round',
        lineJoin: 'round',
      });

      polyline.on('mouseover', () => {
        routeOutlineLine.setStyle({ weight: 12, opacity: 1.0 });
        polyline.setStyle({ weight: 7, opacity: 1.0 });
      });
      polyline.on('mouseout', () => {
        routeOutlineLine.setStyle({ weight: 10, opacity: 0.95 });
        polyline.setStyle({ weight: 6, opacity: 0.98 });
      });

      polyGroup.addLayer(routeOutlineLine);
      polyGroup.addLayer(polyline);
    });
  }, [map, routes]);

  // Zoom to fit all itinerary stops for the active day
  const handleZoomToTrip = () => {
    if (!map) return;

    map.invalidateSize();
    const bounds = L.latLngBounds([]);
    
    // Calculate bounds based strictly on itinerary items
    itinerary.forEach((item) => {
      const loc = savedLocations.find((l) => l.id === item.locationId);
      if (loc) {
        bounds.extend([loc.lat, loc.lng]);
      }
    });

    // If there are itinerary stops, fit them. Otherwise fallback to all saved locations.
    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 15,
        animate: true,
        duration: 0.8,
      });
    } else if (savedLocations.length > 0) {
      const allBounds = L.latLngBounds([]);
      savedLocations.forEach((loc) => allBounds.extend([loc.lat, loc.lng]));
      if (allBounds.isValid()) {
        map.fitBounds(allBounds, {
          padding: [60, 60],
          maxZoom: 15,
          animate: true,
          duration: 0.8,
        });
      }
    }
  };

  // Auto-zoom to fit active day's stops on initial map load or when the set of itinerary locations changes
  useEffect(() => {
    if (!map) return;

    const timer = setTimeout(() => {
      map.invalidateSize();
      const bounds = L.latLngBounds([]);
      
      itinerary.forEach((item) => {
        const loc = savedLocations.find((l) => l.id === item.locationId);
        if (loc) {
          bounds.extend([loc.lat, loc.lng]);
        }
      });

      const isFirstLoad = isFirstLoadRef.current;
      if (isFirstLoad) {
        isFirstLoadRef.current = false;
      }

      const zoomOptions: L.FitBoundsOptions = {
        padding: [60, 60],
        maxZoom: 15,
        animate: !isFirstLoad,
        duration: isFirstLoad ? 0 : 0.8,
      };

      if (bounds.isValid()) {
        map.fitBounds(bounds, zoomOptions);
      } else if (savedLocations.length > 0) {
        const allBounds = L.latLngBounds([]);
        savedLocations.forEach((loc) => allBounds.extend([loc.lat, loc.lng]));
        if (allBounds.isValid()) {
          map.fitBounds(allBounds, zoomOptions);
        }
      }
    }, 150);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, itinerary.map((item) => item.locationId).join(','), savedLocations.map((l) => l.id).join(',')]);

  // Register the zoom function with the parent whenever map or deps change
  useEffect(() => {
    if (onRegisterZoom) onRegisterZoom(handleZoomToTrip);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, itinerary, savedLocations]);

  const handleGetCurrentLocation = () => {
    if (!map || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        map.setView([latitude, longitude], 13, {
          animate: true,
          duration: 0.8,
        });
      },
      (error) => {
        console.error('Error finding current location:', error);
      }
    );
  };

  return (
    <div className="map-container-wrapper">
      {/* Map Element */}
      <div ref={mapContainerRef} className="leaflet-map" />

      {/* Floating Buttons on Map */}
      <div className="map-floating-controls">
        <button 
          className="map-floating-btn" 
          title={isSatellite ? "Switch to Map View" : "Switch to Satellite View"}
          onClick={() => setIsSatellite(!isSatellite)}
          style={{ color: isSatellite ? 'var(--accent)' : 'var(--text-primary)' }}
        >
          <Globe size={16} />
        </button>
        <button 
          className="map-floating-btn" 
          title="Find My Location"
          onClick={handleGetCurrentLocation}
        >
          <Compass size={16} />
        </button>
      </div>
    </div>
  );
};
