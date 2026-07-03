import React, { useState, useEffect, useRef } from 'react';
import { Trash2, MapPin, Calendar, ChevronDown } from 'lucide-react';
import type { Location, LocationCategory, TripDay } from '../types';
import { CATEGORIES, getCategory } from '../utils/categories';

interface PinnedPanelProps {
  savedLocations: Location[];
  days: TripDay[];
  activeLocation: Location | null;
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

export const PinnedPanel: React.FC<PinnedPanelProps> = ({
  savedLocations,
  days,
  activeLocation,
  onRemoveLocation,
  onToggleLocationDay,
  onSelectLocation,
  onUpdateLocationCategory,
}) => {
  return (
    <div className="tab-content" style={{ gap: '1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Pinned Locations</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
          Manage your saved destinations and schedule them into days. Use the floating search bar on the map to find and pin new places.
        </p>
      </div>

      {savedLocations.length === 0 ? (
        <div className="empty-state" style={{ marginTop: '2rem' }}>
          <MapPin className="empty-state-icon" />
          <h3>No pinned locations yet</h3>
          <p>Search for destinations using the search box on the map to pin them onto your trip board.</p>
        </div>
      ) : (
        <div className="saved-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
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
