import { useState, useEffect, useRef } from 'react';
import { PinnedPanel } from './components/PinnedPanel';
import { FloatingSearch } from './components/FloatingSearch';
import { ItineraryPanel } from './components/ItineraryPanel';
import { MapComponent } from './components/MapComponent';
import { TripSelector } from './components/TripSelector';
import { MiniSidebar } from './components/MiniSidebar';
import { SettingsPanel } from './components/SettingsPanel';
import type { Location, ItineraryItem, RouteSegment, CommuteMode, Trip, LocationCategory, TripDay } from './types';
import { areLocationsEquivalent } from './utils/location';
import { generateDemoTrip } from './utils/dummyData';
import { preserveArrivalOnPromotion } from './utils/schedule';

// Mapbox Profile Mapping
const PROFILE_MAP: Record<string, string> = {
  driving: 'driving',
  walking: 'walking',
  bicycle: 'cycling',
};

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError';

const parseLocalStorageJson = <T,>(key: string): T | null => {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`Invalid JSON in localStorage key "${key}"`, error);
    return null;
  }
};

// Migrates itinerary items saved before `lockedArrivalTime` replaced the old, first-stop-only
// `startTime` field: carries the legacy value forward as `lockedArrivalTime` on the first stop
// (where it's still meaningful) and drops the stale field everywhere else.
const migrateLegacyStartTime = (trip: Trip): Trip => ({
  ...trip,
  days: trip.days.map((day) => ({
    ...day,
    itinerary: day.itinerary.map((item, idx) => {
      const legacyStartTime = (item as ItineraryItem & { startTime?: string }).startTime;
      if (legacyStartTime === undefined) return item;
      const { startTime: _startTime, ...rest } = item as ItineraryItem & { startTime?: string };
      return idx === 0 && !rest.lockedArrivalTime ? { ...rest, lockedArrivalTime: legacyStartTime } : rest;
    }),
  })),
});

function App() {
  const [activeTab, setActiveTab] = useState<'pins' | 'itinerary'>('itinerary');
  
  // Settings & Preferences States
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(() => {
    return (localStorage.getItem('horizon_theme') as 'system' | 'light' | 'dark') || 'system';
  });
  const [distanceUnit, setDistanceUnit] = useState<'km' | 'mi'>(() => {
    return (localStorage.getItem('horizon_distance_unit') as 'km' | 'mi') || 'km';
  });
  const [defaultCommuteMode, setDefaultCommuteMode] = useState<CommuteMode>(() => {
    return (localStorage.getItem('horizon_default_commute_mode') as CommuteMode) || 'driving';
  });
  const [userMapboxToken, setUserMapboxToken] = useState<string>(() => {
    return localStorage.getItem('horizon_mapbox_token') || '';
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [activeLocation, setActiveLocation] = useState<Location | null>(null);
  const [routes, setRoutes] = useState<RouteSegment[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [activeDayIndex, setActiveDayIndex] = useState<number>(() => {
    const saved = localStorage.getItem('horizon_active_day_index');
    return saved ? parseInt(saved, 10) || 0 : 0;
  });
  const [viewportCenter, setViewportCenter] = useState<[number, number]>([-74.006, 40.7128]);
  const [viewportBbox, setViewportBbox] = useState<[number, number, number, number] | null>(null);
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const zoomToTripRef = useRef<(() => void) | null>(null);
  const routeRequestSeqRef = useRef(0);

  // Trips and Active Trip state with migration logic
  const [trips, setTrips] = useState<Trip[]>(() => {
    const parsed = parseLocalStorageJson<Trip[]>('horizon_trips');
    if (parsed) {
      return parsed.map((trip) => {
        if (!trip.days || trip.days.length === 0) {
          return migrateLegacyStartTime({
            ...trip,
            days: [
              {
                id: `day-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                dayNumber: 1,
                date: trip.date,
                itinerary: trip.itinerary || [],
              },
            ],
          });
        }
        return migrateLegacyStartTime(trip);
      });
    }

    // 1. Data Migration: check for legacy single-trip keys
    const legacySaved = parseLocalStorageJson<Location[]>('horizon_saved_locations');
    const legacyItin = parseLocalStorageJson<ItineraryItem[]>('horizon_itinerary');

    if (legacySaved || legacyItin) {
      const savedLocations = legacySaved || [];
      const itinerary = legacyItin || [];

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
        routePreference: 'fastest',
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
      routePreference: 'fastest',
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
    try {
      localStorage.setItem('horizon_trips', JSON.stringify(trips));
      setStorageError(null);
    } catch (error) {
      console.error('Failed to persist trips to localStorage', error);
      setStorageError('Unable to save trip changes locally. Free up browser storage and refresh.');
    }
  }, [trips]);

  useEffect(() => {
    try {
      localStorage.setItem('horizon_active_trip_id', activeTripId);
    } catch (error) {
      console.error('Failed to persist active trip ID to localStorage', error);
      setStorageError('Unable to save active trip selection locally. Free up browser storage and refresh.');
    }
  }, [activeTripId]);

  useEffect(() => {
    try {
      localStorage.setItem('horizon_active_day_index', activeDayIndex.toString());
    } catch (error) {
      console.error('Failed to persist active day index to localStorage', error);
    }
  }, [activeDayIndex]);

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

  // Sync settings states to localStorage
  useEffect(() => {
    localStorage.setItem('horizon_theme', theme);
    const root = document.documentElement;
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      root.removeAttribute('data-theme');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('horizon_distance_unit', distanceUnit);
  }, [distanceUnit]);

  useEffect(() => {
    localStorage.setItem('horizon_default_commute_mode', defaultCommuteMode);
  }, [defaultCommuteMode]);

  useEffect(() => {
    localStorage.setItem('horizon_mapbox_token', userMapboxToken);
  }, [userMapboxToken]);

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

  const tripRoutePreference = activeTrip?.routePreference;

  // Fetch routing paths from OSRM public API
  useEffect(() => {
    if (itinerary.length < 2) {
      setRoutes([]);
      return;
    }

    const requestSeq = ++routeRequestSeqRef.current;
    const abortController = new AbortController();

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

        const mapboxToken = userMapboxToken || import.meta.env.VITE_MAPBOX_TOKEN || '';
        const profile = PROFILE_MAP[item.commuteMode] || 'driving';
        const alternativesParam = item.commuteMode === 'driving' ? '&alternatives=true' : '';
        const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${fromLoc.lng},${fromLoc.lat};${toLoc.lng},${toLoc.lat}?overview=full&geometries=geojson${alternativesParam}&access_token=${mapboxToken}`;

        try {
          if (!mapboxToken) throw new Error('Mapbox token is missing');
          const res = await fetch(url, { signal: abortController.signal });
          if (!res.ok) throw new Error('Mapbox Directions routing request failed');
          
          const data = await res.json();
          if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
            throw new Error('No route found');
          }

          let route = data.routes[0];
          if (item.commuteMode === 'driving' && data.routes.length > 1) {
            const preference = tripRoutePreference || 'fastest';
            if (preference === 'shortest') {
              route = data.routes.reduce(
                (min: any, r: any) => (r.distance < min.distance ? r : min),
                data.routes[0]
              );
            } else {
              route = data.routes.reduce(
                (min: any, r: any) => (r.duration < min.duration ? r : min),
                data.routes[0]
              );
            }
          }

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
          if (isAbortError(error)) {
            return null;
          }
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

      if (requestSeq !== routeRequestSeqRef.current) return;
      setRoutes(newRoutes);
    };

    fetchRoutes().finally(() => {
      if (requestSeq === routeRequestSeqRef.current) {
        setIsLoadingRoutes(false);
      }
    });

    return () => {
      abortController.abort();
    };
  }, [itinerary, savedLocations, userMapboxToken, tripRoutePreference]);

  // Operations: Saved Pinned Locations
  const handleAddLocation = (loc: Location) => {
    updateActiveTrip((trip) => {
      if (trip.savedLocations.some((savedLoc) => areLocationsEquivalent(savedLoc, loc))) return trip;
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

  const handleAddToItinerary = (locationId: string, dayIndex: number) => {
    updateActiveTrip((trip) => {
      const day = trip.days[dayIndex];
      if (!day) return trip;
      const newItem: ItineraryItem = {
        id: `itin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        locationId: locationId,
        durationHours: 1, // Default spend: 1hr
        durationMinutes: 0,
        commuteMode: defaultCommuteMode,
      };
      const updatedDays = trip.days.map((d, idx) =>
        idx === dayIndex ? { ...d, itinerary: [...d.itinerary, newItem] } : d
      );
      return {
        ...trip,
        days: updatedDays,
      };
    });
  };

  const handleInsertAtItinerary = (locationId: string, insertIndex: number, dayIndex: number) => {
    updateActiveTrip((trip) => {
      const day = trip.days[dayIndex];
      if (!day) return trip;
      const newItem: ItineraryItem = {
        id: `itin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        locationId: locationId,
        durationHours: 1, // Default spend: 1hr
        durationMinutes: 0,
        commuteMode: defaultCommuteMode,
      };
      const updatedItinerary = [...day.itinerary];
      updatedItinerary.splice(insertIndex, 0, newItem);

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

  const handleUpdateTripRoutePreference = (preference: 'shortest' | 'fastest') => {
    updateActiveTrip((trip) => ({
      ...trip,
      routePreference: preference,
    }));
  };

  const handleUpdateLockedArrivalTime = (itemId: string, lockedArrivalTime: string | null) => {
    updateActiveTrip((trip) => {
      const targetDayIdx = activeDayIndex < trip.days.length ? activeDayIndex : 0;
      const day = trip.days[targetDayIdx];
      const updatedItinerary = day.itinerary.map((item) =>
        item.id === itemId ? { ...item, lockedArrivalTime: lockedArrivalTime || undefined } : item
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

      const promotedItinerary = preserveArrivalOnPromotion(day.itinerary, newItinerary, routes, trip.savedLocations);
      const updatedDays = trip.days.map((d, idx) =>
        idx === targetDayIdx ? { ...d, itinerary: promotedItinerary } : d
      );
      return {
        ...trip,
        days: updatedDays,
      };
    });
  };

  const handleSetItinerary = (newItinerary: ItineraryItem[]) => {
    updateActiveTrip((trip) => {
      const targetDayIdx = activeDayIndex < trip.days.length ? activeDayIndex : 0;
      const day = trip.days[targetDayIdx];
      const promotedItinerary = preserveArrivalOnPromotion(day.itinerary, newItinerary, routes, trip.savedLocations);
      const updatedDays = trip.days.map((d, idx) =>
        idx === targetDayIdx ? { ...d, itinerary: promotedItinerary } : d
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
      const promotedItinerary = preserveArrivalOnPromotion(day.itinerary, updatedItinerary, routes, trip.savedLocations);
      const updatedDays = trip.days.map((d, idx) =>
        idx === targetDayIdx ? { ...d, itinerary: promotedItinerary } : d
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
    const confirmMsg = `Are you sure you want to remove Day ${targetDay.dayNumber}? Only this day's schedule will be removed.`;
    
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

          return {
            ...t,
            days: updatedDays,
          };
        }
        return t;
      })
    );

    setActiveDayIndex((prev) => {
      const newDaysLength = targetTrip.days.length - 1;
      if (prev === dayIndex) {
        return Math.min(dayIndex, newDaysLength - 1);
      }
      if (prev > dayIndex) {
        return prev - 1;
      }
      return prev < newDaysLength ? prev : Math.max(0, newDaysLength - 1);
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

  const handleLoadDemoTrip = () => {
    const demoTrip = generateDemoTrip();
    setTrips((prev) => [...prev, demoTrip]);
    setActiveTripId(demoTrip.id);
    setActiveDayIndex(0);
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

  const handleImportTrip = (importedTrip: Trip) => {
    setTrips((prev) => {
      if (prev.some((t) => t.id === importedTrip.id)) {
        return prev.map((t) => (t.id === importedTrip.id ? importedTrip : t));
      }
      return [...prev, importedTrip];
    });
    setActiveTripId(importedTrip.id);
    setActiveDayIndex(0);
    setIsSettingsOpen(false);
  };

  const handleResetApp = () => {
    if (window.confirm("Are you sure you want to reset all trip planning data? This will restore the demo state.")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="app-container">
      {/* Left Mini Navigation Sidebar */}
      <MiniSidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setIsSettingsOpen(false);
        }}
        onSettingsClick={() => setIsSettingsOpen(!isSettingsOpen)}
        isSettingsOpen={isSettingsOpen}
      />

      {/* Settings Drawer overlay */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        distanceUnit={distanceUnit}
        onDistanceUnitChange={setDistanceUnit}
        defaultCommuteMode={defaultCommuteMode}
        onDefaultCommuteModeChange={setDefaultCommuteMode}
        mapboxToken={userMapboxToken}
        onMapboxTokenChange={setUserMapboxToken}
        activeTrip={activeTrip}
        onImportTrip={handleImportTrip}
        onResetApp={handleResetApp}
      />

      {/* Side Control Panel */}
      <aside className="sidebar" style={{ paddingTop: '1.25rem' }}>
        {storageError && (
          <div
            className="card"
            style={{
              margin: '0 1rem 0.5rem',
              borderLeft: '4px solid var(--danger)',
              background: 'var(--bg-secondary)',
              fontSize: '0.8rem',
            }}
          >
            {storageError}
          </div>
        )}

        {/* Trip Selector Widget */}
        <TripSelector
          trips={trips}
          activeTripId={activeTripId}
          onSelectTrip={handleSelectTrip}
          onCreateTrip={handleCreateTrip}
          onRenameTrip={handleRenameTrip}
          onDeleteTrip={handleDeleteTrip}
          onLoadDemoTrip={handleLoadDemoTrip}
        />

        {/* Panels Content */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', marginTop: '0.5rem' }}>
          {activeTab === 'pins' ? (
            <PinnedPanel
              savedLocations={savedLocations}
              days={activeTrip?.days || []}
              activeLocation={activeLocation}
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
              routePreference={activeTrip?.routePreference || 'fastest'}
              onUpdateRoutePreference={handleUpdateTripRoutePreference}
              onReorderItinerary={handleReorderItinerary}
              onSetItinerary={handleSetItinerary}
              onRemoveFromItinerary={handleRemoveFromItinerary}
              onSelectLocation={setActiveLocation}
              onUpdateLockedArrivalTime={handleUpdateLockedArrivalTime}
              tripDate={activeTrip?.days?.[0]?.date || ''}
              onUpdateTripDate={handleUpdateStartDate}
              days={activeTrip?.days || []}
              activeDayIndex={activeDayIndex}
              onSelectDayIndex={setActiveDayIndex}
              onAddDay={handleAddDay}
              onRemoveDay={handleRemoveDay}
              onZoomToTrip={() => zoomToTripRef.current?.()}
              canZoom={savedLocations.length > 0}
              onAddToItinerary={(locId) => handleAddToItinerary(locId, activeDayIndex)}
              onInsertAtItinerary={(locId, idx) => handleInsertAtItinerary(locId, idx, activeDayIndex)}
              onLoadDemoTrip={handleLoadDemoTrip}
              distanceUnit={distanceUnit}
            />
          )}
        </div>
      </aside>

      {/* Main Map View */}
      <main style={{ flex: 1, height: '100%', position: 'relative' }}>
        <MapComponent
          savedLocations={savedLocations}
          itinerary={itinerary}
          routes={routes}
          activeLocation={activeLocation}
          onSelectLocation={setActiveLocation}
          onRegisterZoom={(fn) => { zoomToTripRef.current = fn; }}
          searchResults={searchResults}
          onViewportChange={(center, bbox) => {
            setViewportCenter(center);
            setViewportBbox(bbox);
          }}
          mapboxToken={userMapboxToken || undefined}
        />
        <FloatingSearch
          savedLocations={savedLocations}
          activeLocation={activeLocation}
          onAddLocation={handleAddLocation}
          onRemoveLocation={handleRemoveLocation}
          onSelectLocation={setActiveLocation}
          viewportCenter={viewportCenter}
          viewportBbox={viewportBbox}
          searchResults={searchResults}
          onSetSearchResults={setSearchResults}
          mapboxToken={userMapboxToken || undefined}
        />
      </main>
    </div>
  );
}

export default App;
