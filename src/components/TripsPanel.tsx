import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check, X, Sparkles, Calendar, ArrowRight, MoreVertical, Copy } from 'lucide-react';
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
    return `${startObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${endObj.getDate()}, ${endObj.getFullYear()}`;
  } else if (sameYear) {
    return `${startObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${endObj.getFullYear()}`;
  } else {
    return `${startObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${endObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
}

/** Formats the last updated time in hours or days. */
function getFormattedUpdatedTime(trip: Trip): string {
  const timestamp = trip.updatedAt || trip.createdAt;
  const diffMs = Date.now() - timestamp;
  const diffMins = Math.max(0, Math.floor(diffMs / 60000));
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Just now';
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  return `${diffDays}d ago`;
}

interface TripsPanelProps {
  trips: Trip[];
  activeTripId: string;
  onSelectTrip: (id: string) => void;
  onCreateTrip: (name: string) => void;
  onRenameTrip: (id: string, newName: string) => void;
  onDeleteTrip: (id: string) => void;
  onDuplicateTrip: (id: string) => void;
  onLoadDemoTrip: () => void;
  onSelectAndNavigateTrip: (id: string) => void;
}

export const TripsPanel: React.FC<TripsPanelProps> = ({
  trips,
  activeTripId,
  onSelectTrip,
  onCreateTrip,
  onRenameTrip,
  onDeleteTrip,
  onDuplicateTrip,
  onLoadDemoTrip,
  onSelectAndNavigateTrip,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [activeMenuTripId, setActiveMenuTripId] = useState<string | null>(null);

  useEffect(() => {
    const closeMenu = () => setActiveMenuTripId(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const handleCreate = () => {
    if (newTripName.trim()) {
      onCreateTrip(newTripName.trim());
      setNewTripName('');
      setIsCreating(false);
    }
  };

  const handleStartRename = (trip: Trip) => {
    setEditingTripId(trip.id);
    setRenameValue(trip.name);
  };

  const handleSaveRename = (id: string) => {
    if (renameValue.trim()) {
      onRenameTrip(id, renameValue.trim());
      setEditingTripId(null);
    }
  };

  const handleDelete = (trip: Trip) => {
    if (window.confirm(`Are you sure you want to delete the trip "${trip.name}"? This cannot be undone.`)) {
      onDeleteTrip(trip.id);
    }
  };

  return (
    <div className="tab-content" style={{ gap: '1rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>My Trips</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
          Manage your travel plans, select active trips, or create new journeys.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {isCreating ? (
          <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <span className="input-label" style={{ fontSize: '0.75rem' }}>Trip Name</span>
            <input
              type="text"
              className="text-input"
              placeholder="e.g. Summer in Tokyo"
              value={newTripName}
              onChange={(e) => setNewTripName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setIsCreating(false);
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setIsCreating(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate}>Create</button>
            </div>
          </div>
        ) : (
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setIsCreating(true)}>
            <Plus size={16} />
            <span>New Trip</span>
          </button>
        )}
      </div>

      <div className="saved-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', flex: 1 }}>
        {trips.map((trip) => {
          const isActive = trip.id === activeTripId;
          const isEditing = trip.id === editingTripId;
          const dateRange = getTripDateRange(trip);

          return (
            <div
              key={trip.id}
              className={`card trip-card ${isActive ? 'active' : ''}`}
              style={{
                borderColor: isActive ? 'var(--accent)' : 'var(--border-color)',
                background: isActive ? 'var(--accent-light)' : 'var(--bg-secondary)',
                cursor: isEditing ? 'default' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                padding: '1rem',
                position: 'relative',
                transition: 'all var(--transition-fast)',
              }}
              onClick={() => {
                if (!isEditing && !isActive) {
                  onSelectTrip(trip.id);
                }
              }}
            >
              {isEditing ? (
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    className="text-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    autoFocus
                    style={{ padding: '0.35rem 0.5rem', fontSize: '0.9rem' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename(trip.id);
                      if (e.key === 'Escape') setEditingTripId(null);
                    }}
                  />
                  <button className="btn btn-primary btn-icon-only" style={{ width: '2rem', height: '2rem' }} onClick={() => handleSaveRename(trip.id)}>
                    <Check size={14} />
                  </button>
                  <button className="btn btn-secondary btn-icon-only" style={{ width: '2rem', height: '2rem' }} onClick={() => setEditingTripId(null)}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0, flex: 1 }}>
                    <h4 style={{
                      fontFamily: "'Josefin Sans', var(--font-sans)",
                      fontSize: '1.1rem',
                      fontWeight: 500,
                      margin: 0,
                      color: isActive ? 'var(--accent-dark)' : 'var(--text-primary)',
                      whiteSpace: 'normal',
                      overflowWrap: 'break-word',
                      wordBreak: 'break-word',
                      lineHeight: 1.3
                    }}>
                      {trip.name}
                    </h4>
                    {dateRange && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        <Calendar size={12} />
                        <span>{dateRange}</span>
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', position: 'relative', minHeight: '1.75rem', marginLeft: '0.5rem', flexShrink: 0 }}>
                    <div className="trip-card-updated-at">
                      {getFormattedUpdatedTime(trip)}
                    </div>
                    <div className="trip-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-secondary btn-icon-only trip-load-btn"
                        title="Load and view itinerary"
                        onClick={() => onSelectAndNavigateTrip(trip.id)}
                      >
                        <ArrowRight size={14} />
                      </button>
                      
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <button
                          className="trip-card-menu-btn"
                          title="More options"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuTripId(activeMenuTripId === trip.id ? null : trip.id);
                          }}
                        >
                          <MoreVertical size={14} />
                        </button>
                        
                        {activeMenuTripId === trip.id && (
                          <div className="trip-card-menu">
                            <button
                              type="button"
                              className="trip-card-menu-item"
                              onClick={() => {
                                handleStartRename(trip);
                                setActiveMenuTripId(null);
                              }}
                            >
                              <Edit2 size={12} />
                              <span>Rename</span>
                            </button>
                            <button
                              type="button"
                              className="trip-card-menu-item"
                              onClick={() => {
                                onDuplicateTrip(trip.id);
                                setActiveMenuTripId(null);
                              }}
                            >
                              <Copy size={12} />
                              <span>Duplicate</span>
                            </button>
                            <button
                              type="button"
                              className="trip-card-menu-item danger"
                              onClick={() => {
                                handleDelete(trip);
                                setActiveMenuTripId(null);
                              }}
                              disabled={trips.length <= 1}
                            >
                              <Trash2 size={12} />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
        <button
          className="btn btn-secondary"
          style={{ width: '100%', justifyContent: 'center', gap: '0.5rem' }}
          onClick={onLoadDemoTrip}
        >
          <Sparkles size={14} style={{ color: 'var(--accent)' }} />
          <span>Load Demo Trip</span>
        </button>
      </div>
    </div>
  );
};
