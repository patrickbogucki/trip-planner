import { 
  Bed, 
  Utensils, 
  Coffee, 
  Sparkles, 
  Camera, 
  ShoppingBag, 
  Trees, 
  Plane, 
  MapPin 
} from 'lucide-react';
import type { LocationCategory } from '../types';

export interface CategoryInfo {
  id: LocationCategory;
  label: string;
  color: string;
  icon: React.ComponentType<any>;
  svgContent: string; // Inner SVG elements for Leaflet L.divIcon
}

export const CATEGORIES: CategoryInfo[] = [
  {
    id: 'stay',
    label: 'Lodging / Stay',
    color: '#3b82f6', // Indigo / Blue
    icon: Bed,
    svgContent: '<path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  {
    id: 'eat',
    label: 'Eat / Restaurant',
    color: '#f97316', // Orange
    icon: Utensils,
    svgContent: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 2v4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M21 15V2a5 5 0 0 0-5 5v8a2 2 0 0 0 2 2h3Z" fill="none" stroke="currentColor" stroke-width="2"/>',
  },
  {
    id: 'coffee',
    label: 'Coffee / Cafe',
    color: '#a16207', // Brown
    icon: Coffee,
    svgContent: '<path d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 2v2M10 2v2M14 2v2" fill="none" stroke="currentColor" stroke-width="2"/>',
  },
  {
    id: 'attraction',
    label: 'Attraction / Activity',
    color: '#8b5cf6', // Violet
    icon: Sparkles,
    svgContent: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  },
  {
    id: 'landmark',
    label: 'Landmark / Sightseeing',
    color: '#ec4899', // Pink
    icon: Camera,
    svgContent: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="13" r="4" fill="none" stroke="currentColor" stroke-width="2"/>',
  },
  {
    id: 'shopping',
    label: 'Shopping',
    color: '#db2777', // Deep pink
    icon: ShoppingBag,
    svgContent: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0" fill="none" stroke="currentColor" stroke-width="2"/>',
  },
  {
    id: 'nature',
    label: 'Nature / Outdoors',
    color: '#15803d', // Green
    icon: Trees,
    svgContent: '<path d="M12 2L3 17h18L12 2z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 17v5" fill="none" stroke="currentColor" stroke-width="2"/>',
  },
  {
    id: 'transport',
    label: 'Transport / Transit',
    color: '#475569', // Slate
    icon: Plane,
    svgContent: '<path d="M21 16V8a2 2 0 0 0-2-2h-5l-4-4H7l2 4H5L3 5H2v5l2 2v4a2 2 0 0 0 2 2h10l3 3h2l-1-3Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  },
  {
    id: 'other',
    label: 'Other',
    color: '#6b7280', // Gray
    icon: MapPin,
    svgContent: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" stroke-width="2"/>',
  },
];

export const getCategory = (id?: LocationCategory): CategoryInfo => {
  return CATEGORIES.find((cat) => cat.id === id) || CATEGORIES[CATEGORIES.length - 1];
};
