import React, { useState, useEffect, useRef } from 'react';
import { Search, Trash2, MapPin, Plus, AlertCircle, Calendar, ChevronDown } from 'lucide-react';
import type { Location, LocationCategory, TripDay } from '../types';
import { CATEGORIES, getCategory } from '../utils/categories';
import { areLocationsEquivalent } from '../utils/location';

interface SearchPanelProps {
  savedLocations: Location[];
  days: TripDay[];
  activeLocation: Location | null;
  onAddLocation: (loc: Location) => void;
  onRemoveLocation: (id: string) => void;
  onToggleLocationDay: (locationId: string, dayIndex: number) => void;
  onSelectLocation: (loc: Location | null) => void;
  onUpdateLocationCategory: (id: string, category: LocationCategory) => void;
}

interface SavedLocationItemProps {
  loc: Location;
  days: TripDay[];
  activeLocation: Location | null;
  onSelectLocation: (loc: Location | null) => void;
  onUpdateLocationCategory: (id: string, category: LocationCategory) => void;
  onToggleLocationDay: (locationId: string, dayIndex: number) => void;
  onRemoveLocation: (id: string) => void;
}

const SavedLocationItem: React.FC<SavedLocationItemProps> = ({
  loc,
  days,
  activeLocation,
  onSelectLocation,
  onUpdateLocationCategory,
  onToggleLocationDay,
  onRemoveLocation,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isActive = activeLocation?.id === loc.id;
  const catInfo = getCategory(loc.category);
  const Icon = catInfo.icon;

  const assignedCount = days.filter((d) =>
    d.itinerary.some((item) => item.locationId === loc.id)
  ).length;

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isDropdownOpen]);

  return (
    <div
      className="card saved-item"
      style={{
        borderColor: isActive ? 'var(--accent)' : 'var(--border-color)',
        background: isActive ? 'var(--accent-light)' : 'var(--bg-secondary)',
        borderLeft: `4px solid ${catInfo.color}`,
        cursor: 'pointer',
      }}
      onClick={() => onSelectLocation(loc)}
    >
      <div className="saved-item-info" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <div
          style={{
            color: catInfo.color,
            background: `${catInfo.color}15`,
            padding: '0.35rem',
            borderRadius: '0.375rem',
            marginTop: '0.1rem',
            flexShrink: 0,
          }}
        >
          <Icon size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="saved-item-title">{loc.name}</div>

          {/* Category Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }} onClick={(e) => e.stopPropagation()}>
            <select
              value={loc.category || 'other'}
              onChange={(e) => onUpdateLocationCategory(loc.id, e.target.value as LocationCategory)}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                padding: 0,
                margin: 0,
                fontWeight: 500,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="saved-item-actions" onClick={(e) => e.stopPropagation()}>
        {/* Days Selector Dropdown */}
        <div className="saved-item-days-dropdown-container" ref={dropdownRef}>
          <button
            type="button"
            className={`saved-days-trigger-btn ${assignedCount > 0 ? 'assigned' : ''}`}
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            title="Manage day schedule assignments"
          >
            <Calendar size={13} />
            <span>{assignedCount > 0 ? `Days (${assignedCount})` : 'Assign'}</span>
            <ChevronDown size={12} className={`trigger-chevron ${isDropdownOpen ? 'open' : ''}`} />
          </button>

          {isDropdownOpen && (
            <div className="saved-item-days-dropdown-menu">
              <div className="dropdown-header">Schedule days</div>
              <div className="dropdown-list-scroll">
                {days.map((day, idx) => {
                  const isInDay = day.itinerary.some((item) => item.locationId === loc.id);
                  return (
                    <label key={day.id} className="dropdown-checkbox-row">
                      <input
                        type="checkbox"
                        checked={isInDay}
                        onChange={() => onToggleLocationDay(loc.id, idx)}
                      />
                      <span className="dropdown-checkbox-checkmark"></span>
                      <span className="dropdown-day-label">Day {day.dayNumber}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <button
          className="btn btn-danger btn-icon-only"
          style={{ width: '1.85rem', height: '1.85rem' }}
          title="Unpin location"
          onClick={() => onRemoveLocation(loc.id)}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

export const SearchPanel: React.FC<SearchPanelProps> = ({
  savedLocations,
  days,
  activeLocation,
  onAddLocation,
  onRemoveLocation,
  onToggleLocationDay,
  onSelectLocation,
  onUpdateLocationCategory,
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewCategory, setPreviewCategory] = useState<LocationCategory>('other');
  
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestRequestIdRef = useRef(0);
  const suggestAbortRef = useRef<AbortController | null>(null);
  const detailsRequestIdRef = useRef(0);
  const detailsAbortRef = useRef<AbortController | null>(null);
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error && err.message) return err.message;
    return fallback;
  };

  // Generate a random session token for Mapbox Search Box v6 billing optimization
  const [sessionToken] = useState(() => {
    return 'sess-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  });

  // Sync preview category with selected active location
  useEffect(() => {
    if (activeLocation) {
      setPreviewCategory(activeLocation.category || 'other');
    }
  }, [activeLocation]);

  // Debounced search query
  useEffect(() => {
    suggestAbortRef.current?.abort();
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length < 3) {
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (!mapboxToken) {
      setError('Mapbox Access Token (VITE_MAPBOX_TOKEN) is not configured.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const requestId = ++suggestRequestIdRef.current;
    searchTimeoutRef.current = setTimeout(async () => {
      const abortController = new AbortController();
      suggestAbortRef.current = abortController;
      try {
        const response = await fetch(
          `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(query)}&access_token=${mapboxToken}&session_token=${sessionToken}&limit=5`,
          { signal: abortController.signal }
        );

        if (!response.ok) {
          throw new Error('Search failed. Please try again.');
        }

        const data = await response.json();
        if (requestId !== suggestRequestIdRef.current) return;
        setSuggestions(data.suggestions || []);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (requestId !== suggestRequestIdRef.current) return;
        setError(getErrorMessage(err, 'Error fetching search results'));
      } finally {
        if (requestId === suggestRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    }, 600); // 600ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      suggestAbortRef.current?.abort();
    };
  }, [query, mapboxToken, sessionToken]);

  const handleSelectSuggestion = async (item: any) => {
    detailsAbortRef.current?.abort();
    const requestId = ++detailsRequestIdRef.current;
    const abortController = new AbortController();
    detailsAbortRef.current = abortController;
    setIsLoading(true);
    setError(null);

    try {
      const searchQuery = item.full_address 
        ? item.full_address 
        : `${item.name}${item.place_formatted ? `, ${item.place_formatted}` : ''}`;

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${mapboxToken}&limit=1`,
        { signal: abortController.signal }
      );

      if (!response.ok) {
        throw new Error('Failed to retrieve location details.');
      }

      const data = await response.json();
      const feature = data.features && data.features[0];
      if (!feature || !feature.center) {
        throw new Error('Could not find coordinates for this address.');
      }

      const [lng, lat] = feature.center;
      const newLoc: Location = {
        id: `loc-${item.mapbox_id || Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: item.name || feature.text || 'Custom Location',
        displayName: item.full_address || feature.place_name || '',
        lat,
        lng,
      };

      if (requestId !== detailsRequestIdRef.current) return;
      onSelectLocation(newLoc);
      setQuery('');
      setSuggestions([]);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (requestId !== detailsRequestIdRef.current) return;
      setError(getErrorMessage(err, 'Error retrieving location details.'));
    } finally {
      if (requestId === detailsRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  const isLocationSaved = (lat: number, lng: number) => {
    const candidateLocation: Location = {
      id: 'candidate-location',
      name: '',
      displayName: '',
      lat,
      lng,
    };
    return savedLocations.some((loc) => areLocationsEquivalent(loc, candidateLocation));
  };

  return (
    <div className="tab-content">
      {!mapboxToken && (
        <div className="card" style={{ borderLeft: '4px solid var(--danger)', marginBottom: '1rem', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <AlertCircle className="text-danger" size={18} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <div>
              <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Mapbox Token Missing
              </h4>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Please create a <code>.env</code> file in the project root and add your Mapbox access token as <code>VITE_MAPBOX_TOKEN</code> to enable location searching.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search Input Box */}
      <div className="input-group">
        <label className="input-label" htmlFor="search-input">Search Destinations</label>
        <div className="search-results-container">
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              id="search-input"
              type="text"
              className="text-input"
              placeholder={mapboxToken ? "e.g. Eiffel Tower, Paris..." : "Configure Mapbox token to search..."}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={!mapboxToken}
              style={{ paddingLeft: '2.5rem' }}
            />
            <Search 
              size={18} 
              className="text-muted" 
              style={{ position: 'absolute', left: '1rem', pointerEvents: 'none' }} 
            />
            {isLoading && (
              <div 
                className="spinner" 
                style={{ position: 'absolute', right: '1rem' }} 
              />
            )}
          </div>

          {/* Suggestions Dropdown */}
          {suggestions.length > 0 && (
            <ul className="suggestions-list">
              {suggestions.map((item) => (
                <li
                  key={item.mapbox_id}
                  className="suggestion-item"
                  onClick={() => handleSelectSuggestion(item)}
                  style={{ display: 'flex', alignItems: 'flex-start', padding: '0.6rem 0.75rem', gap: '0.5rem', cursor: 'pointer' }}
                >
                  <MapPin size={14} style={{ marginTop: '0.15rem', flexShrink: 0, color: 'var(--text-secondary)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, textAlign: 'left' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </span>
                    {item.full_address && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.full_address}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {query.trim().length >= 3 && suggestions.length === 0 && !isLoading && (
            <div style={{ padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No exact matches found</div>
              Try searching for a street or city (e.g. "Spring Green Boulevard, Katy") or click directly on the map to drop a pin at the location!
            </div>
          )}
        </div>
        {error && (
          <div style={{ color: 'var(--danger)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Active Preview Location (when clicked but not pinned yet) */}
      {activeLocation && !isLocationSaved(activeLocation.lat, activeLocation.lng) && (
        <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>Selected Location</span>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{activeLocation.name}</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{activeLocation.displayName}</p>
            
            {/* Category Select Dropdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', margin: '0.25rem 0' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Category</span>
              <select
                className="text-input"
                style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                value={previewCategory}
                onChange={(e) => setPreviewCategory(e.target.value as LocationCategory)}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1, padding: '0.5rem' }}
                onClick={() => {
                  onAddLocation({ ...activeLocation, category: previewCategory });
                  onSelectLocation(null);
                }}
              >
                <Plus size={16} /> Pin to Saved Locations
              </button>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.5rem' }}
                onClick={() => onSelectLocation(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {savedLocations.length === 0 ? (
        <div className="empty-state">
          <MapPin className="empty-state-icon" />
          <h3>No pinned locations</h3>
          <p>Search for destinations using the search box above to pin them onto your trip board.</p>
        </div>
      ) : (
        <div className="saved-list">
          {savedLocations.map((loc) => (
            <SavedLocationItem
              key={loc.id}
              loc={loc}
              days={days}
              activeLocation={activeLocation}
              onSelectLocation={onSelectLocation}
              onUpdateLocationCategory={onUpdateLocationCategory}
              onToggleLocationDay={onToggleLocationDay}
              onRemoveLocation={onRemoveLocation}
            />
          ))}
        </div>
      )}
    </div>
  );
};
