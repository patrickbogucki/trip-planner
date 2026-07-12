export type LocationCategory = 'stay' | 'eat' | 'coffee' | 'attraction' | 'landmark' | 'shopping' | 'nature' | 'transport' | 'other';

export interface Location {
  id: string;
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  category?: LocationCategory;
}

export type CommuteMode = 'driving' | 'transit' | 'walking' | 'bicycle';

export interface ItineraryItem {
  id: string; // unique ID for itinerary list ordering
  locationId: string; // references Location.id
  durationHours: number;
  durationMinutes: number;
  commuteMode: CommuteMode; // commute mode to the NEXT location in the itinerary
  startTime?: string; // leave time for the first stop (format "HH:MM")
  routePreference?: 'shortest' | 'fastest'; // driving route preference
  note?: string; // optional notes/comments for the stop
  // Fixed arrival time (e.g. a reservation) that upstream commute/duration changes cannot shift; format "HH:MM".
  // The first stop in a day always uses this (defaulting to 09:00) since it has no upstream to compute from.
  lockedArrivalTime?: string;
}

export interface RouteSegment {
  fromId: string;
  toId: string;
  distance: number; // in meters
  duration: number; // in seconds
  geometry: [number, number][]; // lat, lng pairs
  mode: CommuteMode;
}

export interface TripDay {
  id: string;
  dayNumber: number;
  date?: string; // date of the specific day (format "YYYY-MM-DD")
  itinerary: ItineraryItem[];
}

export interface Trip {
  id: string;
  name: string;
  createdAt: number;
  updatedAt?: number;
  savedLocations: Location[];
  itinerary?: ItineraryItem[]; // legacy single-day fallback for migration
  date?: string; // legacy start-date fallback for migration
  days: TripDay[];
  routePreference?: 'shortest' | 'fastest'; // driving route preference
}
