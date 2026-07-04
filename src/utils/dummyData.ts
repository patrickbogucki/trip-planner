import type { Trip, Location, CommuteMode } from '../types';

/**
 * Generates a complete, beautiful dummy trip to NYC with realistic coordinates,
 * daily schedules, saved locations, and commuting segments.
 */
export function generateDemoTrip(): Trip {
  const tripId = `trip-demo-${Date.now()}`;
  
  // Define locations for our NYC weekend getaway
  // We use unique IDs based on the tripId to avoid collision if loaded multiple times
  const locations: Location[] = [
    {
      id: `${tripId}-loc-stay-standard`,
      name: 'The Standard, High Line',
      displayName: '848 Washington St, New York, NY 10014',
      lat: 40.7409,
      lng: -74.0080,
      category: 'stay'
    },
    {
      id: `${tripId}-loc-coffee-bluebottle`,
      name: 'Blue Bottle Coffee',
      displayName: '450 W 15th St, New York, NY 10011',
      lat: 40.7410,
      lng: -74.0048,
      category: 'coffee'
    },
    {
      id: `${tripId}-loc-eat-chelsea`,
      name: 'Chelsea Market',
      displayName: '75 9th Ave, New York, NY 10011',
      lat: 40.7420,
      lng: -74.0062,
      category: 'eat'
    },
    {
      id: `${tripId}-loc-attraction-highline`,
      name: 'The High Line Park',
      displayName: 'New York, NY 10011',
      lat: 40.7480,
      lng: -74.0048,
      category: 'attraction'
    },
    {
      id: `${tripId}-loc-landmark-moma`,
      name: 'Museum of Modern Art (MoMA)',
      displayName: '11 W 53rd St, New York, NY 10019',
      lat: 40.7614,
      lng: -73.9776,
      category: 'landmark'
    },
    {
      id: `${tripId}-loc-landmark-esb`,
      name: 'Empire State Building',
      displayName: '20 W 34th St, New York, NY 10001',
      lat: 40.7484,
      lng: -73.9857,
      category: 'landmark'
    },
    {
      id: `${tripId}-loc-nature-centralpark`,
      name: 'Central Park (Sheep Meadow)',
      displayName: 'New York, NY 10024',
      lat: 40.7794,
      lng: -73.9722,
      category: 'nature'
    },
    {
      id: `${tripId}-loc-shopping-soho`,
      name: 'SoHo Shopping District',
      displayName: 'Broadway & Prince St, New York, NY 10012',
      lat: 40.7246,
      lng: -73.9990,
      category: 'shopping'
    },
    {
      id: `${tripId}-loc-eat-katz`,
      name: "Katz's Delicatessen",
      displayName: '205 E Houston St, New York, NY 10002',
      lat: 40.7222,
      lng: -73.9874,
      category: 'eat'
    }
  ];

  // Helper to generate a random or unique ID
  const makeId = () => Math.random().toString(36).substring(2, 9);

  const days = [
    {
      id: `${tripId}-day-1`,
      dayNumber: 1,
      date: new Date().toISOString().split('T')[0], // Today
      itinerary: [
        {
          id: `itin-${makeId()}`,
          locationId: `${tripId}-loc-coffee-bluebottle`,
          durationHours: 0,
          durationMinutes: 45,
          commuteMode: 'walking' as CommuteMode,
          lockedArrivalTime: '09:00',
          note: 'Grab a New Orleans Iced Coffee.'
        },
        {
          id: `itin-${makeId()}`,
          locationId: `${tripId}-loc-eat-chelsea`,
          durationHours: 1,
          durationMinutes: 30,
          commuteMode: 'walking' as CommuteMode,
          note: 'Meet Sarah at the main entrance by 10:15 AM.'
        },
        {
          id: `itin-${makeId()}`,
          locationId: `${tripId}-loc-attraction-highline`,
          durationHours: 2,
          durationMinutes: 0,
          commuteMode: 'transit' as CommuteMode,
          note: 'Walk towards Hudson Yards. Photo stop at the Vessel.'
        },
        {
          id: `itin-${makeId()}`,
          locationId: `${tripId}-loc-landmark-esb`,
          durationHours: 1,
          durationMinutes: 30,
          commuteMode: 'walking' as CommuteMode,
          note: 'Reservation Confirmation: #ESB-998231-X. Go to 86th Floor.'
        }
      ]
    },
    {
      id: `${tripId}-day-2`,
      dayNumber: 2,
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
      itinerary: [
        {
          id: `itin-${makeId()}`,
          locationId: `${tripId}-loc-stay-standard`,
          durationHours: 1,
          durationMinutes: 0,
          commuteMode: 'transit' as CommuteMode,
          lockedArrivalTime: '10:00',
          note: 'Late check-out request confirmed for 12:00 PM.'
        },
        {
          id: `itin-${makeId()}`,
          locationId: `${tripId}-loc-landmark-moma`,
          durationHours: 2,
          durationMinutes: 30,
          commuteMode: 'walking' as CommuteMode,
          note: 'Tickets purchased. Remember to see the Starry Night on the 5th floor.'
        },
        {
          id: `itin-${makeId()}`,
          locationId: `${tripId}-loc-nature-centralpark`,
          durationHours: 2,
          durationMinutes: 0,
          commuteMode: 'transit' as CommuteMode,
          note: 'Rent bicycles if the weather is nice.'
        },
        {
          id: `itin-${makeId()}`,
          locationId: `${tripId}-loc-eat-katz`,
          durationHours: 1,
          durationMinutes: 15,
          commuteMode: 'walking' as CommuteMode,
          note: 'Bring cash! Order the Pastrami on Rye.'
        }
      ]
    },
    {
      id: `${tripId}-day-3`,
      dayNumber: 3,
      date: new Date(Date.now() + 172800000).toISOString().split('T')[0], // Day after tomorrow
      itinerary: [
        {
          id: `itin-${makeId()}`,
          locationId: `${tripId}-loc-shopping-soho`,
          durationHours: 3,
          durationMinutes: 0,
          commuteMode: 'walking' as CommuteMode,
          lockedArrivalTime: '11:00',
          note: 'Check out the design stores on Greene St.'
        },
        {
          id: `itin-${makeId()}`,
          locationId: `${tripId}-loc-eat-chelsea`,
          durationHours: 1,
          durationMinutes: 30,
          commuteMode: 'driving' as CommuteMode
        }
      ]
    }
  ];

  return {
    id: tripId,
    name: 'NYC Weekend Getaway (Demo)',
    createdAt: Date.now(),
    savedLocations: locations,
    days,
    routePreference: 'fastest'
  };
}
