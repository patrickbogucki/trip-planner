import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Plus, AlertCircle, X } from 'lucide-react';
import type { Location, LocationCategory } from '../types';
import { CATEGORIES, getCategory } from '../utils/categories';
import { areLocationsEquivalent } from '../utils/location';

interface FloatingSearchProps {
  savedLocations: Location[];
  activeLocation: Location | null;
  onAddLocation: (loc: Location) => void;
  onRemoveLocation: (id: string) => void;
  onSelectLocation: (loc: Location | null) => void;
  viewportCenter: [number, number];
  viewportBbox: [number, number, number, number] | null;
  searchResults: Location[];
  onSetSearchResults: (results: Location[]) => void;
  mapboxToken?: string;
}

export const FloatingSearch: React.FC<FloatingSearchProps> = ({
  savedLocations,
  activeLocation,
  onAddLocation,
  onRemoveLocation,
  onSelectLocation,
  viewportCenter,
  viewportBbox,
  searchResults,
  onSetSearchResults,
  mapboxToken: customMapboxToken,
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewCategory, setPreviewCategory] = useState<LocationCategory>('other');
  
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchContainerRef = useRef<HTMLFormElement>(null);
  const suggestRequestIdRef = useRef(0);
  const suggestAbortRef = useRef<AbortController | null>(null);
  const detailsRequestIdRef = useRef(0);
  const detailsAbortRef = useRef<AbortController | null>(null);
  const mapboxToken = customMapboxToken !== undefined ? customMapboxToken : (import.meta.env.VITE_MAPBOX_TOKEN || '');

  const viewportCenterRef = useRef(viewportCenter);
  const viewportBboxRef = useRef(viewportBbox);

  useEffect(() => {
    viewportCenterRef.current = viewportCenter;
    viewportBboxRef.current = viewportBbox;
  }, [viewportCenter, viewportBbox]);

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

  // Click outside to close search suggestions dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSuggestions([]);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

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
      setError('Mapbox Access Token is not configured.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const requestId = ++suggestRequestIdRef.current;
    searchTimeoutRef.current = setTimeout(async () => {
      const abortController = new AbortController();
      suggestAbortRef.current = abortController;
      try {
        const [lng, lat] = viewportCenterRef.current;
        let url = `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(query)}&access_token=${mapboxToken}&session_token=${sessionToken}&limit=5&proximity=${lng},${lat}`;
        
        if (viewportBboxRef.current) {
          url += `&bbox=${viewportBboxRef.current.join(',')}`;
        }

        const response = await fetch(url, { signal: abortController.signal });

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

  const executeSearchQuery = async (searchQuery: string) => {
    suggestAbortRef.current?.abort();
    detailsAbortRef.current?.abort();

    setIsLoading(true);
    setError(null);
    setSuggestions([]);
    onSelectLocation(null);

    const [lng, lat] = viewportCenter;
    let url = `https://api.mapbox.com/search/searchbox/v1/forward?q=${encodeURIComponent(searchQuery)}&access_token=${mapboxToken}&limit=10&proximity=${lng},${lat}`;
    
    if (viewportBbox) {
      url += `&bbox=${viewportBbox.join(',')}`;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Search request failed. Please check connection and token.');
      }
      const data = await response.json();
      const features = data.features || [];
      
      const results: Location[] = features.map((f: any) => {
        const coords = f.geometry?.coordinates || f.center;
        if (!coords || coords.length < 2) return null;
        const [rlng, rlat] = coords;

        let cat: LocationCategory = 'other';
        const maki = f.properties?.maki;
        const categoryText = f.properties?.category || (f.properties?.poi_category ? f.properties.poi_category.join(' ') : '');
        
        if (maki === 'restaurant' || maki === 'fast-food' || maki === 'bar' || categoryText.includes('restaurant') || categoryText.includes('food')) {
          cat = 'eat';
        } else if (maki === 'cafe' || categoryText.includes('cafe') || categoryText.includes('coffee')) {
          cat = 'coffee';
        } else if (maki === 'museum' || maki === 'gallery' || maki === 'theatre' || maki === 'art-gallery' || categoryText.includes('museum') || categoryText.includes('theatre')) {
          cat = 'attraction';
        } else if (maki === 'monument' || categoryText.includes('monument') || categoryText.includes('landmark')) {
          cat = 'landmark';
        } else if (maki === 'park' || maki === 'garden' || maki === 'beach' || maki === 'forest' || categoryText.includes('park') || categoryText.includes('beach')) {
          cat = 'nature';
        } else if (maki === 'mall' || maki === 'shop' || maki === 'clothing-store' || maki === 'supermarket' || categoryText.includes('shop') || categoryText.includes('mall')) {
          cat = 'shopping';
        } else if (maki === 'hotel' || maki === 'motel' || maki === 'hostel' || maki === 'guest-house' || categoryText.includes('lodging') || categoryText.includes('hotel') || categoryText.includes('stay')) {
          cat = 'stay';
        } else if (maki === 'airport' || maki === 'airfield' || maki === 'train' || maki === 'bus' || maki === 'ferry' || categoryText.includes('airport') || categoryText.includes('station')) {
          cat = 'transport';
        }
        
        return {
          id: `search-${f.properties?.mapbox_id || f.id || Math.random().toString(36).substr(2, 9)}`,
          name: f.properties?.name || f.text || 'Search Result',
          displayName: f.properties?.full_address || f.properties?.place_formatted || f.place_name || '',
          lat: rlat,
          lng: rlng,
          category: cat,
        };
      }).filter(Boolean) as Location[];

      onSetSearchResults(results);
      if (results.length === 0) {
        setError('No matching places found in this area.');
      }
    } catch (err) {
      console.error(err);
      setError('Error fetching search results. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (query.trim().length < 2) return;
    onSelectLocation(null);
    await executeSearchQuery(query);
  };

  const handleSelectSuggestion = async (item: any) => {
    // Check if the suggestion is a general category or search query
    const isGeneralSearch = 
      item.feature_type === 'category' || 
      item.suggestion_type === 'category' || 
      item.suggestion_type === 'query' ||
      !item.place_formatted;

    if (isGeneralSearch) {
      setQuery(item.name);
      await executeSearchQuery(item.name);
      return;
    }

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
    <div className="floating-search-container">
      {/* Mapbox Token Missing Warning */}
      {!mapboxToken && (
        <div className="card floating-search-card" style={{ borderLeft: '4px solid var(--danger)', background: 'var(--bg-glass)', backdropFilter: 'blur(var(--glass-blur))' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <AlertCircle className="text-danger" size={18} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <div>
              <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Mapbox Token Missing
              </h4>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Create a <code>.env</code> file in the project root and add <code>VITE_MAPBOX_TOKEN</code> to search locations.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search Input Box Card */}
      <form onSubmit={handleExecuteSearch} className="floating-search-card search-input-card" ref={searchContainerRef}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            id="search-input"
            type="text"
            className="text-input"
            placeholder={mapboxToken ? "Search (e.g. coffee, sights)..." : "Configure Mapbox token to search..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={!mapboxToken}
            style={{ paddingLeft: '2.5rem', paddingRight: '4.5rem', height: '2.5rem', borderRadius: 'var(--radius-md)' }}
          />
          <Search 
            size={18} 
            className="text-muted" 
            style={{ position: 'absolute', left: '1rem', pointerEvents: 'none' }} 
          />
          <div style={{ position: 'absolute', right: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {isLoading && (
              <div 
                className="spinner" 
                style={{ marginRight: '0.25rem' }} 
              />
            )}
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: '1.85rem' }}
              disabled={!mapboxToken || query.trim().length < 2}
            >
              Go
            </button>
          </div>
        </div>

        {/* Suggestions Dropdown */}
        {suggestions.length > 0 && (
          <ul className="suggestions-list" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', marginTop: '0.25rem', overflow: 'hidden' }}>
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
        {query.trim().length >= 3 && suggestions.length === 0 && !isLoading && searchResults.length === 0 && (
          <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No exact matches found</div>
            Try searching for a street or city or click directly on the map to drop a pin.
          </div>
        )}
        {error && (
          <div style={{ color: 'var(--danger)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem', padding: '0 0.5rem' }}>
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}
      </form>

      {/* Search Results List Card */}
      {searchResults.length > 0 && (
        <div className="card floating-search-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Search Results ({searchResults.length})
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-icon-only"
              style={{ width: '1.5rem', height: '1.5rem', padding: 0 }}
              onClick={() => onSetSearchResults([])}
              title="Clear results"
            >
              <X size={12} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingRight: '0.1rem' }}>
            {searchResults.map((loc) => {
              const catInfo = getCategory(loc.category || 'other');
              const Icon = catInfo.icon;
              const isActive = activeLocation && (activeLocation.id === loc.id || areLocationsEquivalent(activeLocation, loc));
              
              return (
                <div
                  key={loc.id}
                  className="search-result-item"
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: '0.4rem 0.5rem',
                    gap: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    borderColor: isActive ? 'var(--accent)' : 'var(--border-color)',
                    background: isActive ? 'var(--accent-light)' : 'var(--bg-secondary)',
                    borderLeft: `3px solid ${catInfo.color}`,
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                  onClick={() => onSelectLocation(loc)}
                >
                  <div style={{ color: catInfo.color, background: `${catInfo.color}15`, padding: '0.25rem', borderRadius: '0.25rem', flexShrink: 0 }}>
                    <Icon size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {loc.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {loc.displayName}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active / Pinned Selected Location Card */}
      {activeLocation && (() => {
        const isSaved = isLocationSaved(activeLocation.lat, activeLocation.lng);
        const matchedSavedLoc = savedLocations.find(
          (s) => s.id === activeLocation.id || areLocationsEquivalent(s, activeLocation)
        );
        const borderCol = isSaved && matchedSavedLoc ? getCategory(matchedSavedLoc.category).color : 'var(--accent)';
        
        return (
          <div className="card floating-search-card" style={{ borderLeft: `4px solid ${borderCol}` }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: isSaved ? 'var(--success)' : 'var(--accent)', textTransform: 'uppercase' }}>
                  {isSaved ? 'Pinned Location' : 'Selected Location'}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-icon-only"
                  style={{ width: '1.5rem', height: '1.5rem', padding: 0 }}
                  onClick={() => onSelectLocation(null)}
                  title="Close details"
                >
                  <X size={12} />
                </button>
              </div>
              <h3 style={{ fontSize: '0.95rem', color: 'var(--text-primary)', margin: 0 }}>{activeLocation.name}</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{activeLocation.displayName}</p>
              
              {isSaved && matchedSavedLoc ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Category: <strong style={{ color: 'var(--text-primary)' }}>{getCategory(matchedSavedLoc.category).label}</strong>
                  </div>
                  <button 
                    className="btn btn-danger" 
                    style={{ padding: '0.4rem', fontSize: '0.8rem', height: '2rem', width: '100%' }}
                    onClick={() => {
                      onRemoveLocation(matchedSavedLoc.id);
                    }}
                  >
                    Unpin Location
                  </button>
                </div>
              ) : (
                <>
                  {/* Category Select Dropdown */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', margin: '0.25rem 0' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Category</span>
                    <select
                      className="text-input"
                      style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', height: '2rem' }}
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
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem', height: '2rem' }}
                      onClick={() => {
                        onAddLocation({ ...activeLocation, category: previewCategory });
                      }}
                    >
                      <Plus size={14} style={{ marginRight: '0.25rem', display: 'inline-block', verticalAlign: 'middle' }} /> Pin Location
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
