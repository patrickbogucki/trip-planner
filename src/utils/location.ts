import type { Location } from '../types';

const LOCATION_DUPLICATE_EPSILON = 0.0001;

export const areLocationsEquivalent = (a: Location, b: Location) =>
  Math.abs(a.lat - b.lat) < LOCATION_DUPLICATE_EPSILON &&
  Math.abs(a.lng - b.lng) < LOCATION_DUPLICATE_EPSILON;
