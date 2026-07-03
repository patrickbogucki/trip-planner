import type { ItineraryItem, Location, RouteSegment, CommuteMode } from '../types';

export interface ComputedStopTime {
  arriveMinutes: number; // minutes since midnight (may exceed 1440 for multi-day overflow)
  leaveMinutes: number;
  isLocked: boolean;
  conflictMinutes: number; // minutes the natural (unlocked) arrival would run past a locked time
  bufferMinutes: number; // minutes of slack before a locked time, if the natural arrival is earlier
}

const SPEED_MAP: Record<CommuteMode, number> = {
  driving: 13.8, // 50 km/h in m/s
  transit: 8.3, // 30 km/h in m/s
  walking: 1.4, // 5 km/h in m/s
  bicycle: 4.2, // 15 km/h in m/s
};

export const haversineDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Earth radius in meters
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

// Parse a "HH:MM" time string into minutes since midnight
export const timeToMinutes = (timeStr: string): number => {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Format minutes since midnight into a "HH:MM" value suitable for an <input type="time">
export const minutesToTimeInputValue = (totalMinutes: number): string => {
  const normalized = (totalMinutes % (24 * 60) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60).toString().padStart(2, '0');
  const minutes = (normalized % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

// Format minutes since midnight into a "H:MM AM/PM" display string
export const formatMinutesToClockTime = (totalMinutes: number): string => {
  const normalized = (totalMinutes % (24 * 60) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${ampm}`;
};

const estimateCommuteMinutes = (
  item: ItineraryItem,
  nextItem: ItineraryItem,
  routes: RouteSegment[],
  savedLocations: Location[]
): number => {
  const route = routes.find((r) => r.fromId === item.locationId && r.toId === nextItem.locationId);
  if (route) {
    return Math.round(route.duration / 60);
  }
  const fromLoc = savedLocations.find((loc) => loc.id === item.locationId);
  const toLoc = savedLocations.find((loc) => loc.id === nextItem.locationId);
  if (!fromLoc || !toLoc) return 0;
  const dist = haversineDistanceMeters(fromLoc.lat, fromLoc.lng, toLoc.lat, toLoc.lng);
  const speed = SPEED_MAP[item.commuteMode] || 10;
  return Math.round(dist / speed / 60);
};

// The single source of truth for the itinerary's chronological schedule. A stop with
// `lockedArrivalTime` set (e.g. a restaurant reservation) always arrives at that exact time —
// upstream commute/duration changes cannot shift it. The first stop has no upstream, so its
// arrival is always its `lockedArrivalTime` (defaulting to 09:00 if never set). If the natural
// arrival (previous leave + commute) would be later than a locked time, that gap is returned as
// `conflictMinutes` instead of silently overriding the lock.
export const computeItineraryTimes = (
  itinerary: ItineraryItem[],
  routes: RouteSegment[],
  savedLocations: Location[]
): Record<string, ComputedStopTime> => {
  const result: Record<string, ComputedStopTime> = {};
  if (itinerary.length === 0) return result;

  const firstItem = itinerary[0];
  const firstArrivalMinutes = timeToMinutes(firstItem.lockedArrivalTime || '09:00');
  let currentLeaveMinutes = firstArrivalMinutes + firstItem.durationHours * 60 + firstItem.durationMinutes;

  result[firstItem.id] = {
    arriveMinutes: firstArrivalMinutes,
    leaveMinutes: currentLeaveMinutes,
    isLocked: !!firstItem.lockedArrivalTime,
    conflictMinutes: 0,
    bufferMinutes: 0,
  };

  for (let i = 0; i < itinerary.length - 1; i++) {
    const item = itinerary[i];
    const nextItem = itinerary[i + 1];
    const commuteMinutes = estimateCommuteMinutes(item, nextItem, routes, savedLocations);

    const naturalArrivalMinutes = currentLeaveMinutes + commuteMinutes;
    const isLocked = !!nextItem.lockedArrivalTime;
    const arrivalMinutes = isLocked ? timeToMinutes(nextItem.lockedArrivalTime!) : naturalArrivalMinutes;
    const conflictMinutes = isLocked ? Math.max(0, naturalArrivalMinutes - arrivalMinutes) : 0;
    const bufferMinutes = isLocked ? Math.max(0, arrivalMinutes - naturalArrivalMinutes) : 0;
    currentLeaveMinutes = arrivalMinutes + nextItem.durationHours * 60 + nextItem.durationMinutes;

    result[nextItem.id] = {
      arriveMinutes: arrivalMinutes,
      leaveMinutes: currentLeaveMinutes,
      isLocked,
      conflictMinutes,
      bufferMinutes,
    };
  }

  return result;
};

// When reordering promotes a stop to the first position, its arrival can no longer be computed
// (there's no upstream stop). If it doesn't already have an explicit lock, freeze its previous
// arrival time as its new `lockedArrivalTime` so "Start at" continues seamlessly from where
// "Arrive" left off, instead of jumping to the 09:00 default.
export const preserveArrivalOnPromotion = (
  oldItinerary: ItineraryItem[],
  newItinerary: ItineraryItem[],
  routes: RouteSegment[],
  savedLocations: Location[]
): ItineraryItem[] => {
  if (newItinerary.length === 0) return newItinerary;
  const newFirst = newItinerary[0];
  const oldFirst = oldItinerary[0];
  if (!oldFirst || newFirst.id === oldFirst.id || newFirst.lockedArrivalTime) {
    return newItinerary;
  }

  const oldTimes = computeItineraryTimes(oldItinerary, routes, savedLocations);
  const previousArrival = oldTimes[newFirst.id]?.arriveMinutes;
  if (previousArrival === undefined) return newItinerary;

  return newItinerary.map((item, idx) =>
    idx === 0 ? { ...item, lockedArrivalTime: minutesToTimeInputValue(previousArrival) } : item
  );
};
