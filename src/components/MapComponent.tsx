import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { Location, ItineraryItem, RouteSegment } from '../types';
import { Compass, Globe } from 'lucide-react';
import { getCategory } from '../utils/categories';
import { areLocationsEquivalent } from '../utils/location';

interface MapComponentProps {
  savedLocations: Location[];
  itinerary: ItineraryItem[];
  routes: RouteSegment[];
  activeLocation: Location | null;
  onSelectLocation: (loc: Location | null) => void;
  onAddLocation: (loc: Location) => void;
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
  onAddLocation,
  onRegisterZoom,
  searchResults = [],
  onViewportChange,
  mapboxToken: customMapboxToken,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  
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

    setTimeout(() => {
      mapInstance.invalidateSize();
    }, 100);

    return () => {
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
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18],
      });

      const tooltipText = isSearchResult ? `${loc.name} (✓ Pinned)` : loc.name;

      const popupContentHtml = `
        <div style="font-family: 'Outfit', sans-serif; padding: 4px;">
          <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600;">${loc.name}</h4>
          <p style="margin: 0; font-size: 11px; color: #64748b; max-width: 200px; line-height: 1.3;">${loc.displayName}</p>
          <div style="margin-top: 8px; font-size: 11px; font-weight: 700; display: flex; flex-direction: column; gap: 2px;">
            ${isItinerary ? `<span style="color: #6366f1;">Stop #${itinIndex + 1} in Itinerary</span>` : '<span style="color: #6366f1;">Saved Location</span>'}
            ${isSearchResult ? '<span style="color: var(--success, #10b981); display: inline-flex; align-items: center; gap: 4px;"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="3" fill="none" style="display: inline-block;"><polyline points="20 6 9 17 4 12"></polyline></svg>Pinned Search Result</span>' : ''}
          </div>
        </div>
      `;

      if (markersRef.current[markerId]) {
        // Update existing marker position & icon
        const existingMarker = markersRef.current[markerId];
        existingMarker.setLatLng([loc.lat, loc.lng]);
        existingMarker.setIcon(customIcon);
        
        // Re-bind popup & tooltip
        existingMarker.unbindPopup();
        existingMarker.unbindTooltip();
        existingMarker.bindPopup(popupContentHtml);
        existingMarker.bindTooltip(tooltipText, {
          direction: 'top',
          offset: [0, -18],
          opacity: 0.9,
          className: 'map-tooltip',
        });
      } else {
        // Create new marker
        const marker = L.marker([loc.lat, loc.lng], { icon: customIcon }).addTo(map);
        marker.bindPopup(popupContentHtml);
        marker.bindTooltip(tooltipText, {
          direction: 'top',
          offset: [0, -18],
          opacity: 0.9,
          className: 'map-tooltip',
        });

        marker.on('click', () => {
          onSelectLocation(loc);
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

    if (activeLocation) {
      // Check if location is already pinned
      const matchedSavedLoc = savedLocations.find((loc) => loc.id === activeLocation.id || areLocationsEquivalent(loc, activeLocation));
      const isAlreadyPinned = !!matchedSavedLoc;

      if (isAlreadyPinned && matchedSavedLoc) {
        // If already pinned, use the existing marker
        const existingMarker = markersRef.current[matchedSavedLoc.id];
        map.invalidateSize();
        if (existingMarker) {
          // Pan to location
          map.panTo([activeLocation.lat, activeLocation.lng], {
            animate: true,
            duration: 0.75,
          });
          // Open the popup on the existing marker
          existingMarker.openPopup();
        } else {
          // Fallback if marker not in ref yet
          map.panTo([activeLocation.lat, activeLocation.lng], {
            animate: true,
            duration: 0.75,
          });
        }
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
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -18],
        });

        const previewMarker = L.marker([activeLocation.lat, activeLocation.lng], { icon: customIcon }).addTo(map);

        const popupContent = document.createElement('div');
        popupContent.style.fontFamily = "'Outfit', sans-serif";
        popupContent.style.padding = '4px';

        const title = document.createElement('h4');
        title.style.margin = '0 0 4px 0';
        title.style.fontSize = '14px';
        title.style.fontWeight = '600';
        title.innerText = activeLocation.name;
        popupContent.appendChild(title);

        const address = document.createElement('p');
        address.style.margin = '0';
        address.style.fontSize = '11px';
        address.style.color = '#64748b';
        address.style.maxWidth = '200px';
        address.style.lineHeight = '1.3';
        address.innerText = activeLocation.displayName;
        popupContent.appendChild(address);

        const btn = document.createElement('button');
        btn.style.marginTop = '8px';
        btn.style.backgroundColor = '#6366f1';
        btn.style.color = '#ffffff';
        btn.style.border = 'none';
        btn.style.padding = '4px 8px';
        btn.style.fontSize = '11px';
        btn.style.fontWeight = '600';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.innerText = 'Pin Location';
        btn.onclick = () => {
          onAddLocation(activeLocation);
          onSelectLocation(null);
        };
        popupContent.appendChild(btn);

        previewMarker.bindPopup(popupContent);
        previewMarker.bindTooltip(activeLocation.name, {
          direction: 'top',
          offset: [0, -18],
          opacity: 0.9,
          className: 'map-tooltip',
        });
        previewMarkerRef.current = previewMarker;

        map.invalidateSize();
        map.panTo([activeLocation.lat, activeLocation.lng], {
          animate: true,
          duration: 0.75,
        });

        previewMarker.openPopup();
      }
    }
  }, [map, activeLocation, savedLocations]);

  // Sync Temporary Search Result Markers
  useEffect(() => {
    if (!map) return;

    const currentSearchMarkerIds = new Set<string>();

    searchResults.forEach((loc) => {
      // Avoid duplicate search markers if the location is already saved
      if (savedLocations.some((s) => s.id === loc.id || areLocationsEquivalent(s, loc))) {
        return;
      }

      const markerId = `search-${loc.id}`;
      currentSearchMarkerIds.add(markerId);

      const iconHtml = `
        <div class="map-category-marker search-result-pin" style="background-color: #8b5cf6; border: 2px solid white; box-shadow: 0 2px 6px rgba(139, 92, 246, 0.4);">
          <svg class="map-category-svg" viewBox="0 0 24 24" style="fill: white;">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'leaflet-custom-marker search-pin',
        html: iconHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16],
      });

      if (searchMarkersRef.current[markerId]) {
        const existingMarker = searchMarkersRef.current[markerId];
        existingMarker.setLatLng([loc.lat, loc.lng]);
        existingMarker.setIcon(customIcon);
        existingMarker.unbindTooltip();
        existingMarker.bindTooltip(loc.name, {
          direction: 'top',
          offset: [0, -16],
          opacity: 0.9,
          className: 'map-tooltip',
        });
      } else {
        const marker = L.marker([loc.lat, loc.lng], { icon: customIcon }).addTo(map);

        const popupContent = document.createElement('div');
        popupContent.style.fontFamily = "'Outfit', sans-serif";
        popupContent.style.padding = '4px';

        const title = document.createElement('h4');
        title.style.margin = '0 0 4px 0';
        title.style.fontSize = '13px';
        title.style.fontWeight = '600';
        title.innerText = loc.name;
        popupContent.appendChild(title);

        const address = document.createElement('p');
        address.style.margin = '0';
        address.style.fontSize = '10px';
        address.style.color = '#64748b';
        address.style.maxWidth = '180px';
        address.style.lineHeight = '1.3';
        address.innerText = loc.displayName;
        popupContent.appendChild(address);

        const btn = document.createElement('button');
        btn.style.marginTop = '8px';
        btn.style.backgroundColor = '#8b5cf6';
        btn.style.color = '#ffffff';
        btn.style.border = 'none';
        btn.style.padding = '4px 8px';
        btn.style.fontSize = '10px';
        btn.style.fontWeight = '600';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.innerText = '+ Pin Location';
        btn.onclick = (e) => {
          e.stopPropagation();
          onAddLocation(loc);
          marker.closePopup();
        };
        popupContent.appendChild(btn);

        marker.bindPopup(popupContent);
        marker.bindTooltip(loc.name, {
          direction: 'top',
          offset: [0, -16],
          opacity: 0.9,
          className: 'map-tooltip',
        });

        marker.on('click', () => {
          onSelectLocation(loc);
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
  }, [map, searchResults, savedLocations]);

  // Sync Route Polylines
  useEffect(() => {
    const polyGroup = polylineGroupRef.current;
    if (!polyGroup || !map) return;

    // Clear previous routes
    polyGroup.clearLayers();

    // Draw paths for each route segment
    routes.forEach((route) => {
      const isTransit = route.mode === 'transit';
      const polyline = L.polyline(route.geometry, {
        color: isTransit ? '#8b5cf6' : '#6366f1',
        weight: 4,
        opacity: 0.85,
        dashArray: isTransit ? '6, 8' : undefined,
      });

      // Simple hover effects on route lines
      polyline.on('mouseover', () => {
        polyline.setStyle({ weight: 6, opacity: 1.0 });
      });
      polyline.on('mouseout', () => {
        polyline.setStyle({ weight: 4, opacity: 0.85 });
      });

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
