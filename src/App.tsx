import { useState, useEffect, useRef } from 'react';
import { Compass, Calendar } from 'lucide-react';
import { SearchPanel } from './components/SearchPanel';
import { ItineraryPanel } from './components/ItineraryPanel';
import { MapComponent } from './components/MapComponent';
import { TripSelector } from './components/TripSelector';
import type { Location, ItineraryItem, RouteSegment, CommuteMode, Trip, LocationCategory, TripDay } from './types';

// Mapbox Profile Mapping
const PROFILE_MAP: Record<string, string> = {
  driving: 'driving',
  walking: 'walking',
  bicycle: 'cycling',
};

function App() {
  const [activeTab, setActiveTab] = useState<'search' | 'itinerary'>('itinerary');
  const [activeLocation, setActiveLocation] = useState<Location | null>(null);
  const [routes, setRoutes] = useState<RouteSegment[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [activeDayIndex, setActiveDayIndex] = useState<number>(0);
  const zoomToTripRef = useRef<(() => void) | null>(null);

  // Trips and Active Trip state with migration logic
  const [trips, setTrips] = useState<Trip[]>(() => {
    const localTrips = localStorage.getItem('horizon_trips');
    if (localTrips) {
      const parsed: Trip[] = JSON.parse(localTrips);
      return parsed.map((trip) => {
        if (!trip.days || trip.days.length === 0) {
          return {
            ...trip,
            days: [
              {
                id: `day-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                dayNumber: 1,
                date: trip.date,
                itinerary: trip.itinerary || [],
              },
            ],
          };
        }
        return trip;
      });
    }

    // 1. Data Migration: check for legacy single-trip keys
    const legacySaved = localStorage.getItem('horizon_saved_locations');
    const legacyItin = localStorage.getItem('horizon_itinerary');

    if (legacySaved || legacyItin) {
      const savedLocations = legacySaved ? JSON.parse(legacySaved) : [];
      const itinerary = legacyItin ? JSON.parse(legacyItin) : [];

      const migratedTrip: Trip = {
        id: `trip-migrated-${Date.now()}`,
        name: 'My Saved Trip',
        createdAt: Date.now(),
        savedLocations,
        days: [
          {
            id: `day-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            dayNumber: 1,
            date: undefined,
            itinerary,
          },
        ],
      };

      // Clean up legacy keys
      localStorage.removeItem('horizon_saved_locations');
      localStorage.removeItem('horizon_itinerary');

      return [migratedTrip];
    }

    // 2. Default Initial State: create initial default trip
    const defaultTrip: Trip = {
      id: `trip-default-${Date.now()}`,
      name: 'My First Trip',
      createdAt: Date.now(),
      savedLocations: [],
      days: [
        {
          id: `day-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          dayNumber: 1,
          date: undefined,
          itinerary: [],
        },
      ],
    };
    return [defaultTrip];
  });

  const [activeTripId, setActiveTripId] = useState<string>(() => {
    const localActive = localStorage.getItem('horizon_active_trip_id');
    if (localActive) {
      return localActive;
    }
    // Default to the first trip
    return trips.length > 0 ? trips[0].id : '';
  });

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('horizon_trips', JSON.stringify(trips));
  }, [trips]);

  useEffect(() => {
    localStorage.setItem('horizon_active_trip_id', activeTripId);
  }, [activeTripId]);

  // Ensure activeTripId points to a valid trip (safeguard)
  useEffect(() => {
    if (trips.length > 0 && !trips.some((t) => t.id === activeTripId)) {
      setActiveTripId(trips[0].id);
    }
  }, [trips, activeTripId]);

  // Reset activeDayIndex when activeTripId changes
  useEffect(() => {
    setActiveDayIndex(0);
  }, [activeTripId]);

  // Active Trip references
  const activeTrip = trips.find((t) => t.id === activeTripId) || trips[0];
  const savedLocations = activeTrip ? activeTrip.savedLocations : [];
  const activeDay = activeTrip?.days?.[activeDayIndex] || activeTrip?.days?.[0];
  const itinerary = activeDay ? activeDay.itinerary : [];

  // Helper function to update the active trip safely
  const updateActiveTrip = (updater: (trip: Trip) => Trip) => {
    setTrips((prev) =>
      prev.map((t) => (t.id === activeTripId ? updater(t) : t))
    );
  };

  // Distance computation (Haversine formula)
  const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000; // meters
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
  };

  // Fetch routing paths from OSRM public API
  useEffect(() => {
    if (itinerary.length < 2) {
      setRoutes([]);
      return;
    }

    const fetchRoutes = async () => {
      setIsLoadingRoutes(true);
      const newRoutes: RouteSegment[] = [];

      const routePromises = itinerary.slice(0, -1).map(async (item, i) => {
        const nextItem = itinerary[i + 1];
        const fromLoc = savedLocations.find((loc) => loc.id === item.locationId);
        const toLoc = savedLocations.find((loc) => loc.id === nextItem.locationId);

        if (!fromLoc || !toLoc) return null;

        // Transit fallback estimation
        if (item.commuteMode === 'transit') {
          const dist = getHaversineDistance(fromLoc.lat, fromLoc.lng, toLoc.lat, toLoc.lng);
          const duration = dist / 8.3; // avg speed ~30 km/h (8.3 m/s)
          
          return {
            fromId: fromLoc.id,
            toId: toLoc.id,
            distance: dist,
            duration,
            geometry: [
              [fromLoc.lat, fromLoc.lng],
              [toLoc.lat, toLoc.lng],
            ] as [number, number][],
            mode: 'transit' as CommuteMode,
          };
        }

        const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
        const profile = PROFILE_MAP[item.commuteMode] || 'driving';
        const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${fromLoc.lng},${fromLoc.lat};${toLoc.lng},${toLoc.lat}?overview=full&geometries=geojson&access_token=${mapboxToken}`;

        try {
          if (!mapboxToken) throw new Error('Mapbox token is missing');
          const res = await fetch(url);
          if (!res.ok) throw new Error('Mapbox Directions routing request failed');
          
          const data = await res.json();
          if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
            throw new Error('No route found');
          }

          const route = data.routes[0];
          const geometry = route.geometry.coordinates.map((coord: [number, number]) => [
            coord[1],
            coord[0],
          ]) as [number, number][];

          return {
            fromId: fromLoc.id,
            toId: toLoc.id,
            distance: route.distance,
            duration: route.duration,
            geometry,
            mode: item.commuteMode,
          };
        } catch (error) {
          console.warn(`Routing error between ${fromLoc.name} and ${toLoc.name}:`, error);
          const dist = getHaversineDistance(fromLoc.lat, fromLoc.lng, toLoc.lat, toLoc.lng);
          const speed = item.commuteMode === 'walking' ? 1.4 : item.commuteMode === 'bicycle' ? 4.2 : 12.0; // m/s
          return {
            fromId: fromLoc.id,
            toId: toLoc.id,
            distance: dist,
            duration: dist / speed,
            geometry: [
              [fromLoc.lat, fromLoc.lng],
              [toLoc.lat, toLoc.lng],
            ] as [number, number][],
            mode: item.commuteMode,
          };
        }
      });

      const results = await Promise.all(routePromises);
      results.forEach((res) => {
        if (res) newRoutes.push(res);
      });

      setRoutes(newRoutes);
      setIsLoadingRoutes(false);
    };

    fetchRoutes();
  }, [itinerary, savedLocations]);

  // Operations: Saved Pinned Locations
  const handleAddLocation = (loc: Location) => {
    updateActiveTrip((trip) => {
      if (trip.savedLocations.some((l) => l.lat === loc.lat && l.lng === loc.lng)) return trip;
      return {
        ...trip,
        savedLocations: [...trip.savedLocations, loc],
      };
    });
  };

  const handleRemoveLocation = (id: string) => {
    updateActiveTrip((trip) => {
      const updatedLocations = trip.savedLocations.filter((loc) => loc.id !== id);
      const updatedDays = trip.days.map((day) => ({
        ...day,
        itinerary: day.itinerary.filter((item) => item.locationId !== id),
      }));
      return {
        ...trip,
        savedLocations: updatedLocations,
        days: updatedDays,
      };
    });
  };

  const handleUpdateLocationCategory = (locId: string, category: LocationCategory) => {
    updateActiveTrip((trip) => {
      const updatedLocations = trip.savedLocations.map((loc) =>
        loc.id === locId ? { ...loc, category } : loc
      );
      return {
        ...trip,
        savedLocations: updatedLocations,
      };
    });
  };

  // Operations: Itinerary List
  const handleToggleLocationDay = (locationId: string, dayIndex: number) => {
    updateActiveTrip((trip) => {
      const day = trip.days[dayIndex];
      if (!day) return trip;
      const isInItinerary = day.itinerary.some((item) => item.locationId === locationId);
      let updatedItinerary = [...day.itinerary];

      if (isInItinerary) {
        updatedItinerary = updatedItinerary.filter((item) => item.locationId !== locationId);
      } else {
        const newItem: ItineraryItem = {
          id: `itin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          locationId: locationId,
          durationHours: 1, // Default spend: 1hr
          durationMinutes: 0,
          commuteMode: 'driving',
        };
        updatedItinerary.push(newItem);
      }

      const updatedDays = trip.days.map((d, idx) =>
        idx === dayIndex ? { ...d, itinerary: updatedItinerary } : d
      );

      return {
        ...trip,
        days: updatedDays,
      };
    });
  };

  const handleUpdateDuration = (itemId: string, hours: number, minutes: number) => {
    updateActiveTrip((trip) => {
      const targetDayIdx = activeDayIndex < trip.days.length ? activeDayIndex : 0;
      const day = trip.days[targetDayIdx];
      const updatedItinerary = day.itinerary.map((item) =>
        item.id === itemId
          ? { ...item, durationHours: hours, durationMinutes: minutes }
          : item
      );
      const updatedDays = trip.days.map((d, idx) =>
        idx === targetDayIdx ? { ...d, itinerary: updatedItinerary } : d
      );
      return {
        ...trip,
        days: updatedDays,
      };
    });
  };

  const handleUpdateCommuteMode = (itemId: string, mode: CommuteMode) => {
    updateActiveTrip((trip) => {
      const targetDayIdx = activeDayIndex < trip.days.length ? activeDayIndex : 0;
      const day = trip.days[targetDayIdx];
      const updatedItinerary = day.itinerary.map((item) =>
        item.id === itemId ? { ...item, commuteMode: mode } : item
      );
      const updatedDays = trip.days.map((d, idx) =>
        idx === targetDayIdx ? { ...d, itinerary: updatedItinerary } : d
      );
      return {
        ...trip,
        days: updatedDays,
      };
    });
  };

  const handleUpdateStartTime = (itemId: string, startTime: string) => {
    updateActiveTrip((trip) => {
      const targetDayIdx = activeDayIndex < trip.days.length ? activeDayIndex : 0;
      const day = trip.days[targetDayIdx];
      const updatedItinerary = day.itinerary.map((item) =>
        item.id === itemId ? { ...item, startTime } : item
      );
      const updatedDays = trip.days.map((d, idx) =>
        idx === targetDayIdx ? { ...d, itinerary: updatedItinerary } : d
      );
      return {
        ...trip,
        days: updatedDays,
      };
    });
  };

  const handleUpdateStartDate = (date: string) => {
    updateActiveTrip((trip) => {
      // Parse start date and cascade each subsequent day
      const [year, month, day] = date.split('-').map(Number);
      const startDateObj = new Date(year, month - 1, day);

      const updatedDays = trip.days.map((d, idx) => {
        const dayDate = new Date(startDateObj);
        dayDate.setDate(startDateObj.getDate() + idx);
        const dateStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
        return { ...d, date: dateStr };
      });

      return {
        ...trip,
        days: updatedDays,
      };
    });
  };

  const handleReorderItinerary = (index: number, direction: 'up' | 'down') => {
    updateActiveTrip((trip) => {
      const targetDayIdx = activeDayIndex < trip.days.length ? activeDayIndex : 0;
      const day = trip.days[targetDayIdx];
      if (direction === 'up' && index === 0) return trip;
      if (direction === 'down' && index === day.itinerary.length - 1) return trip;

      const newItinerary = [...day.itinerary];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      
      const temp = newItinerary[index];
      newItinerary[index] = newItinerary[targetIndex];
      newItinerary[targetIndex] = temp;
      
      const updatedDays = trip.days.map((d, idx) =>
        idx === targetDayIdx ? { ...d, itinerary: newItinerary } : d
      );
      return {
        ...trip,
        days: updatedDays,
      };
    });
  };

  const handleRemoveFromItinerary = (locationId: string) => {
    updateActiveTrip((trip) => {
      const targetDayIdx = activeDayIndex < trip.days.length ? activeDayIndex : 0;
      const day = trip.days[targetDayIdx];
      const updatedItinerary = day.itinerary.filter((item) => item.locationId !== locationId);
      const updatedDays = trip.days.map((d, idx) =>
        idx === targetDayIdx ? { ...d, itinerary: updatedItinerary } : d
      );
      return {
        ...trip,
        days: updatedDays,
      };
    });
  };

  // Operations: Days Management
  const handleAddDay = () => {
    let newDayIndex = 0;
    setTrips((prev) =>
      prev.map((t) => {
        if (t.id === activeTripId) {
          const nextDayNum = t.days.length + 1;

          // Compute next date from last existing day's date
          let nextDateStr: string | undefined;
          const lastDay = t.days[t.days.length - 1];
          if (lastDay?.date) {
            const [y, m, d] = lastDay.date.split('-').map(Number);
            const next = new Date(y, m - 1, d);
            next.setDate(next.getDate() + 1);
            nextDateStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
          }

          const newDay: TripDay = {
            id: `day-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            dayNumber: nextDayNum,
            date: nextDateStr,
            itinerary: [],
          };
          newDayIndex = t.days.length;
          return {
            ...t,
            days: [...t.days, newDay],
          };
        }
        return t;
      })
    );
    setActiveDayIndex(newDayIndex);
  };

  const handleRemoveDay = (dayIndex: number) => {
    const targetTrip = trips.find((t) => t.id === activeTripId);
    if (!targetTrip || targetTrip.days.length <= 1) return;

    const targetDay = targetTrip.days[dayIndex];
    const confirmMsg = `Are you sure you want to remove Day ${targetDay.dayNumber}? Any locations pinned exclusively for this day will be unpinned.`;
    
    if (!window.confirm(confirmMsg)) return;

    setTrips((prev) =>
      prev.map((t) => {
        if (t.id === activeTripId) {
          const renumbered = t.days.filter((_, idx) => idx !== dayIndex)
            .map((d, newIdx) => ({ ...d, dayNumber: newIdx + 1 }));

          // Recascade dates from the new Day 1's date
          const startDate = renumbered[0]?.date;
          const updatedDays = renumbered.map((d, newIdx) => {
            if (!startDate) return d;
            const [y, m, day] = startDate.split('-').map(Number);
            const dateObj = new Date(y, m - 1, day);
            dateObj.setDate(dateObj.getDate() + newIdx);
            const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
            return { ...d, date: dateStr };
          });

          const locationsInDeletedDay = targetDay.itinerary.map((item) => item.locationId);
          const locationsInRemainingDays = new Set<string>();
          updatedDays.forEach((d) => {
            d.itinerary.forEach((item) => locationsInRemainingDays.add(item.locationId));
          });

          const toUnpin = locationsInDeletedDay.filter((locId) => !locationsInRemainingDays.has(locId));

          const updatedSavedLocations = t.savedLocations.filter(
            (loc) => !toUnpin.includes(loc.id)
          );

          return {
            ...t,
            savedLocations: updatedSavedLocations,
            days: updatedDays,
          };
        }
        return t;
      })
    );

    setActiveDayIndex((prev) => {
      const newDaysLength = targetTrip.days.length - 1;
      if (prev >= newDaysLength) {
        return Math.max(0, newDaysLength - 1);
      }
      return prev;
    });
  };

  // Operations: Multiple Trip Management
  const handleSelectTrip = (id: string) => {
    setActiveTripId(id);
    setActiveLocation(null);
  };

  const handleCreateTrip = (name: string) => {
    const newTrip: Trip = {
      id: `trip-${Date.now()}`,
      name,
      createdAt: Date.now(),
      savedLocations: [],
      days: [
        {
          id: `day-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          dayNumber: 1,
          date: undefined,
          itinerary: [],
        },
      ],
    };
    setTrips((prev) => [...prev, newTrip]);
    setActiveTripId(newTrip.id);
    setActiveLocation(null);
  };

  const handleRenameTrip = (id: string, newName: string) => {
    setTrips((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name: newName } : t))
    );
  };

  const handleDeleteTrip = (id: string) => {
    if (trips.length <= 1) return; // Prevent deleting the last remaining trip

    const index = trips.findIndex((t) => t.id === id);
    const newTrips = trips.filter((t) => t.id !== id);
    setTrips(newTrips);

    if (activeTripId === id) {
      // Find another trip to set active
      const fallbackIndex = index === 0 ? 0 : index - 1;
      setActiveTripId(newTrips[fallbackIndex].id);
    }
    setActiveLocation(null);
  };

  return (
    <div className="app-container">
      {/* Side Control Panel */}
      <aside className="sidebar">
        <div className="sidebar-header" style={{ paddingBottom: '0.75rem', borderBottom: 'none' }}>
          <div className="brand">
            <Compass className="brand-icon" />
            <h1>Horizon</h1>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>v1.1</span>
        </div>

        {/* Trip Selector Widget */}
        <TripSelector
          trips={trips}
          activeTripId={activeTripId}
          onSelectTrip={handleSelectTrip}
          onCreateTrip={handleCreateTrip}
          onRenameTrip={handleRenameTrip}
          onDeleteTrip={handleDeleteTrip}
        />

        {/* Tab Selection */}
        <div className="sidebar-tabs" style={{ marginTop: '0.5rem' }}>
          <button
            className={`tab-btn ${activeTab === 'itinerary' ? 'active' : ''}`}
            onClick={() => setActiveTab('itinerary')}
          >
            <Calendar size={16} />
            Itinerary
          </button>
          <button
            className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            <Compass size={16} />
            Search & Pins
          </button>
        </div>

        {/* Panels Content */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'search' ? (
            <SearchPanel
              savedLocations={savedLocations}
              days={activeTrip?.days || []}
              activeLocation={activeLocation}
              onAddLocation={handleAddLocation}
              onRemoveLocation={handleRemoveLocation}
              onToggleLocationDay={handleToggleLocationDay}
              onSelectLocation={setActiveLocation}
              onUpdateLocationCategory={handleUpdateLocationCategory}
            />
          ) : (
            <ItineraryPanel
              itinerary={itinerary}
              savedLocations={savedLocations}
              routes={routes}
              isLoadingRoutes={isLoadingRoutes}
              onUpdateDuration={handleUpdateDuration}
              onUpdateCommuteMode={handleUpdateCommuteMode}
              onReorderItinerary={handleReorderItinerary}
              onRemoveFromItinerary={handleRemoveFromItinerary}
              onSelectLocation={setActiveLocation}
              onUpdateStartTime={handleUpdateStartTime}
              tripDate={activeTrip?.days?.[0]?.date || ''}
              onUpdateTripDate={handleUpdateStartDate}
              days={activeTrip?.days || []}
              activeDayIndex={activeDayIndex}
              onSelectDayIndex={setActiveDayIndex}
              onAddDay={handleAddDay}
              onRemoveDay={handleRemoveDay}
              onZoomToTrip={() => zoomToTripRef.current?.()}
              canZoom={savedLocations.length > 0}
            />
          )}
        </div>
      </aside>

      {/* Main Map View */}
      <main style={{ flex: 1, height: '100%' }}>
        <MapComponent
          savedLocations={savedLocations}
          itinerary={itinerary}
          routes={routes}
          activeLocation={activeLocation}
          onSelectLocation={setActiveLocation}
          onAddLocation={handleAddLocation}
          onRegisterZoom={(fn) => { zoomToTripRef.current = fn; }}
        />
      </main>
    </div>
  );
}

export default App;
