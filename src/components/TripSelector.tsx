import React, { useState, useEffect, useRef } from 'react';
import { Briefcase, Plus, Edit2, Trash2, Check, X, ChevronDown, MoreVertical, Sparkles } from 'lucide-react';
import type { Trip } from '../types';

/** Formats the date range of a trip for display. Returns null if no dates set. */
function getTripDateRange(trip: Trip): string | null {
  const days = trip.days;
  if (!days || days.length === 0) return null;

  const startDate = days[0]?.date;
  if (!startDate) return null;

  const parseDate = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const startObj = parseDate(startDate);

  if (days.length === 1) {
    return startObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const lastDate = days[days.length - 1]?.date;
  if (!lastDate) {
    return startObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const endObj = parseDate(lastDate);
  const sameYear = startObj.getFullYear() === endObj.getFullYear();
  const sameMonth = sameYear && startObj.getMonth() === endObj.getMonth();

  if (sameMonth) {
    // e.g. "Jun 5–7, 2025"
    return `${startObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${endObj.getDate()}, ${endObj.getFullYear()}`;
  } else if (sameYear) {
    // e.g. "Jun 28 – Jul 2, 2025"
    return `${startObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${endObj.getFullYear()}`;
  } else {
    // different years
    return `${startObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${endObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
}

interface TripSelectorProps {
  trips: Trip[];
  activeTripId: string;
  onSelectTrip: (id: string) => void;
  onCreateTrip: (name: string) => void;
  onRenameTrip: (id: string, newName: string) => void;
  onDeleteTrip: (id: string) => void;
  onLoadDemoTrip: () => void;
}

export const TripSelector: React.FC<TripSelectorProps> = ({
  trips,
  activeTripId,
  onSelectTrip,
  onCreateTrip,
  onRenameTrip,
  onDeleteTrip,
  onLoadDemoTrip,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeTrip = trips.find((t) => t.id === activeTripId);

  const handleStartRename = () => {
    if (!activeTrip) return;
    setRenameValue(activeTrip.name);
    setIsRenaming(true);
  };

  const handleSaveRename = () => {
    if (renameValue.trim() && activeTrip) {
      onRenameTrip(activeTrip.id, renameValue.trim());
      setIsRenaming(false);
    }
  };

  const handleCreate = () => {
    if (newTripName.trim()) {
      onCreateTrip(newTripName.trim());
      setNewTripName('');
      setIsCreating(false);
    }
  };

  const handleDelete = () => {
    if (!activeTrip) return;
    if (window.confirm(`Are you sure you want to delete the trip "${activeTrip.name}"? This cannot be undone.`)) {
      onDeleteTrip(activeTrip.id);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Update highlighted index when menu opens or active trip changes
  useEffect(() => {
    if (!isOpen) {
      setHighlightedIndex(-1);
    } else {
      const idx = trips.findIndex((t) => t.id === activeTripId);
      setHighlightedIndex(idx !== -1 ? idx : 0);
    }
  }, [isOpen, activeTripId, trips]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isCreating || isRenaming) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % trips.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + trips.length) % trips.length);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < trips.length) {
          onSelectTrip(trips[highlightedIndex].id);
          setIsOpen(false);
        }
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className="trip-selector-container">
      {isCreating ? (
        // Create Trip View
        <div className="trip-action-form">
          <input
            type="text"
            className="text-input"
            placeholder="Trip name (e.g. Summer in Tokyo)"
            value={newTripName}
            onChange={(e) => setNewTripName(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') setIsCreating(false);
            }}
          />
          <div className="trip-form-buttons">
            <button className="btn btn-primary btn-icon-only" onClick={handleCreate} title="Create Trip">
              <Check size={14} />
            </button>
            <button className="btn btn-secondary btn-icon-only" onClick={() => setIsCreating(false)} title="Cancel">
              <X size={14} />
            </button>
          </div>
        </div>
      ) : isRenaming ? (
        // Rename Trip View
        <div className="trip-action-form">
          <input
            type="text"
            className="text-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                if (e.key === 'Enter') handleSaveRename();
                if (e.key === 'Escape') setIsRenaming(false);
              }
            }}
          />
          <div className="trip-form-buttons">
            <button className="btn btn-primary btn-icon-only" onClick={handleSaveRename} title="Save Name">
              <Check size={14} />
            </button>
            <button className="btn btn-secondary btn-icon-only" onClick={() => setIsRenaming(false)} title="Cancel">
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        // Selector Display View
        <div className="trip-selector-row">
          <div className="trip-dropdown-custom-wrapper" ref={dropdownRef}>
            <button
              type="button"
              className="trip-dropdown-trigger"
              onClick={() => setIsOpen((prev) => !prev)}
              onKeyDown={handleKeyDown}
              aria-haspopup="listbox"
              aria-expanded={isOpen}
              aria-label={`Select trip, current selection: ${activeTrip?.name || 'none'}`}
            >
              <Briefcase size={16} className="trip-icon" />
              <span className="trip-dropdown-current-name">
                <span className="trip-name-text">{activeTrip ? activeTrip.name : 'Select a trip'}</span>
                {activeTrip && getTripDateRange(activeTrip) && (
                  <span className="trip-date-range-text">{getTripDateRange(activeTrip)}</span>
                )}
              </span>
              <ChevronDown size={14} className={`trip-caret-icon ${isOpen ? 'open' : ''}`} />
            </button>

            {isOpen && (
              <ul className="trip-dropdown-menu" role="listbox">
                {trips.map((trip, idx) => {
                  const dateRange = getTripDateRange(trip);
                  return (
                    <li
                      key={trip.id}
                      role="option"
                      aria-selected={trip.id === activeTripId}
                      className={`trip-dropdown-item ${trip.id === activeTripId ? 'selected' : ''} ${
                        idx === highlightedIndex ? 'highlighted' : ''
                      }`}
                      onClick={() => {
                        onSelectTrip(trip.id);
                        setIsOpen(false);
                      }}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                    >
                      <span className="trip-item-name">
                        <span className="trip-item-name-text">{trip.name}</span>
                        {dateRange && <span className="trip-item-date-range">{dateRange}</span>}
                      </span>
                      {trip.id === activeTripId && <Check size={14} className="trip-checkmark" />}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="trip-options-menu-container" ref={menuRef}>
            <button
              type="button"
              className="btn btn-secondary btn-icon-only trip-menu-trigger-btn"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              title="Trip options"
            >
              <MoreVertical size={16} />
            </button>

            {isMenuOpen && (
              <ul className="trip-actions-dropdown-menu">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(true);
                      setIsMenuOpen(false);
                    }}
                  >
                    <Plus size={14} />
                    <span>New Trip</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      onLoadDemoTrip();
                      setIsMenuOpen(false);
                    }}
                  >
                    <Sparkles size={14} style={{ color: 'var(--accent)' }} />
                    <span>Load Demo Trip</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      handleStartRename();
                      setIsMenuOpen(false);
                    }}
                  >
                    <Edit2 size={14} />
                    <span>Rename</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="danger-action"
                    onClick={() => {
                      handleDelete();
                      setIsMenuOpen(false);
                    }}
                    disabled={trips.length <= 1}
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
