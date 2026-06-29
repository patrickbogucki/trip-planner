import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  Car, 
  Train, 
  Bike, 
  Footprints, 
  Clock, 
  Navigation,
  Calendar,
  AlertTriangle,
  ChevronDown,
  Plus,
  X,
  AlignJustify,
  LayoutList,
  Maximize2,
  MoreVertical
} from 'lucide-react';
import type { Location, ItineraryItem, RouteSegment, CommuteMode, TripDay } from '../types';
import { getCategory } from '../utils/categories';

interface ItineraryPanelProps {
  itinerary: ItineraryItem[];
  savedLocations: Location[];
  routes: RouteSegment[];
  isLoadingRoutes: boolean;
  onUpdateDuration: (id: string, hours: number, minutes: number) => void;
  onUpdateCommuteMode: (id: string, mode: CommuteMode) => void;
  onReorderItinerary: (index: number, direction: 'up' | 'down') => void;
  onRemoveFromItinerary: (locationId: string) => void;
  onSelectLocation: (loc: Location) => void;
  onUpdateStartTime: (id: string, startTime: string) => void;
  tripDate?: string;
  onUpdateTripDate: (date: string) => void;
  days: TripDay[];
  activeDayIndex: number;
  onSelectDayIndex: (index: number) => void;
  onAddDay: () => void;
  onRemoveDay: (index: number) => void;
  onZoomToTrip: () => void;
  canZoom: boolean;
}

export const ItineraryPanel: React.FC<ItineraryPanelProps> = ({
  itinerary,
  savedLocations,
  routes,
  isLoadingRoutes,
  onUpdateDuration,
  onUpdateCommuteMode,
  onReorderItinerary,
  onRemoveFromItinerary,
  onSelectLocation,
  onUpdateStartTime,
  tripDate,
  onUpdateTripDate,
  days,
  activeDayIndex,
  onSelectDayIndex,
  onAddDay,
  onRemoveDay,
  onZoomToTrip,
  canZoom,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [showSpendField, setShowSpendField] = useState<Record<string, boolean>>({});
  const [viewDate, setViewDate] = useState(() => {
    if (tripDate) {
      const [y, m, d] = tripDate.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close card action menus on click outside
  useEffect(() => {
    const handleDocumentClick = () => {
      setActiveMenuId(null);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, []);

  // Update view date when tripDate changes externally
  useEffect(() => {
    if (tripDate) {
      const [y, m, d] = tripDate.split('-').map(Number);
      setViewDate(new Date(y, m - 1, d));
    }
  }, [tripDate]);

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const getCalendarDays = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthTotalDays = new Date(year, month, 0).getDate();
    
    const days: { day: number; isCurrentMonth: boolean; monthOffset: number }[] = [];
    
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        day: prevMonthTotalDays - i,
        isCurrentMonth: false,
        monthOffset: -1,
      });
    }
    
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        monthOffset: 0,
      });
    }
    
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        monthOffset: 1,
      });
    }
    
    return days;
  };

  const formatDisplayDate = (dateStr?: string) => {
    if (!dateStr) return 'Set start date';
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Short label for day tabs: "Sun, Jun 5"
  const formatTabDate = (dateStr?: string): string | null => {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const handleSelectDay = (day: number, monthOffset: number) => {
    const targetDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + monthOffset, day);
    const y = targetDate.getFullYear();
    const m = (targetDate.getMonth() + 1).toString().padStart(2, '0');
    const d = targetDate.getDate().toString().padStart(2, '0');
    onUpdateTripDate(`${y}-${m}-${d}`);
    setIsOpen(false);
  };
  
  // Helper to find location details for an itinerary item
  const getLocation = (locId: string) => {
    return savedLocations.find((loc) => loc.id === locId);
  };

  const renderCompactCommuteIcon = (mode: CommuteMode) => {
    switch (mode) {
      case 'driving': return <Car size={14} />;
      case 'transit': return <Train size={14} />;
      case 'bicycle': return <Bike size={14} />;
      case 'walking': return <Footprints size={14} />;
      default: return null;
    }
  };

  // Helper to find the route segment between two itinerary items
  const getRouteSegment = (fromItem: ItineraryItem, toItem: ItineraryItem) => {
    return routes.find(
      (r) => r.fromId === fromItem.locationId && r.toId === toItem.locationId
    );
  };

  // Formatting helpers
  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hrs} h ${remainingMins} m` : `${hrs} h`;
  };

  // Calculations for total statistics
  const calculateTotalStats = () => {
    let totalStayMinutes = 0;
    let totalTravelSeconds = 0;
    let totalDistanceMeters = 0;

    // Sum stay durations (skipping the first location, which acts as the start departure point)
    itinerary.slice(1).forEach((item) => {
      totalStayMinutes += item.durationHours * 60 + item.durationMinutes;
    });

    // Sum travel durations and distances from route segments
    for (let i = 0; i < itinerary.length - 1; i++) {
      const fromItem = itinerary[i];
      const toItem = itinerary[i + 1];
      const route = getRouteSegment(fromItem, toItem);
      
      if (route) {
        totalTravelSeconds += route.duration;
        totalDistanceMeters += route.distance;
      } else {
        // Fallback estimate if routing hasn't loaded or failed (straight-line distance estimate)
        const fromLoc = getLocation(fromItem.locationId);
        const toLoc = getLocation(toItem.locationId);
        if (fromLoc && toLoc) {
          const dist = calculateHaversineDistance(fromLoc.lat, fromLoc.lng, toLoc.lat, toLoc.lng);
          totalDistanceMeters += dist;
          
          // Estimate travel duration based on commute mode
          const speedMap: Record<CommuteMode, number> = {
            driving: 13.8, // 50 km/h in m/s
            transit: 8.3,   // 30 km/h in m/s
            walking: 1.4,   // 5 km/h in m/s
            bicycle: 4.2,   // 15 km/h in m/s
          };
          const speed = speedMap[fromItem.commuteMode] || 10;
          totalTravelSeconds += dist / speed;
        }
      }
    }

    const totalTravelMinutes = Math.round(totalTravelSeconds / 60);
    const totalMinutes = totalStayMinutes + totalTravelMinutes;

    const formatStatsDuration = (totalMins: number) => {
      const hrs = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      if (hrs === 0) return `${mins}m`;
      return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
    };

    return {
      stay: formatStatsDuration(totalStayMinutes),
      travel: formatStatsDuration(totalTravelMinutes),
      trip: formatStatsDuration(totalMinutes),
      distance: formatDistance(totalDistanceMeters),
    };
  };

  // Haversine distance helper for estimations
  const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
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

  // Helper to parse time string "HH:MM" into minutes since midnight
  const timeToMinutes = (timeStr: string): number => {
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  // Helper to format minutes since midnight into "HH:MM AM/PM"
  const formatMinutesToTime = (totalMinutes: number): string => {
    const normalized = (totalMinutes % (24 * 60) + 24 * 60) % (24 * 60);
    const hours = Math.floor(normalized / 60);
    const minutes = normalized % 60;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
  };

  // Pre-calculate chronological times for itinerary stops
  const computedTimes: { [id: string]: { arrive: string; leave: string } } = {};
  if (itinerary.length > 0) {
    const firstItem = itinerary[0];
    const firstStartMinutes = timeToMinutes(firstItem.startTime || '09:00');
    const firstStayMinutes = firstItem.durationHours * 60 + firstItem.durationMinutes;
    let currentMinutes = firstStartMinutes + firstStayMinutes;
    
    computedTimes[firstItem.id] = {
      arrive: formatMinutesToTime(firstStartMinutes),
      leave: formatMinutesToTime(currentMinutes),
    };
    
    for (let i = 0; i < itinerary.length - 1; i++) {
      const item = itinerary[i];
      const nextItem = itinerary[i + 1];
      const route = getRouteSegment(item, nextItem);
      
      let commuteMinutes = 0;
      if (route) {
        commuteMinutes = Math.round(route.duration / 60);
      } else {
        const fromLoc = getLocation(item.locationId);
        const toLoc = getLocation(nextItem.locationId);
        if (fromLoc && toLoc) {
          const dist = calculateHaversineDistance(fromLoc.lat, fromLoc.lng, toLoc.lat, toLoc.lng);
          const speedMap: Record<CommuteMode, number> = {
            driving: 13.8,
            transit: 8.3,
            walking: 1.4,
            bicycle: 4.2,
          };
          const speed = speedMap[item.commuteMode] || 10;
          commuteMinutes = Math.round((dist / speed) / 60);
        }
      }
      
      const arrivalMinutes = currentMinutes + commuteMinutes;
      const stayMinutes = nextItem.durationHours * 60 + nextItem.durationMinutes;
      currentMinutes = arrivalMinutes + stayMinutes;
      
      computedTimes[nextItem.id] = {
        arrive: formatMinutesToTime(arrivalMinutes),
        leave: formatMinutesToTime(currentMinutes),
      };
    }
  }

  const stats = calculateTotalStats();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Scrollable content area */}
      <div className="tab-content" style={{ paddingBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      
      {/* Custom Date Picker — always for start of trip (Day 1) */}
      <div className="trip-date-container">
        <span className="trip-date-label">Trip Start Date</span>
        <div className="trip-date-custom-wrapper" ref={dropdownRef}>
          <button
            type="button"
            className="trip-date-trigger"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
          >
            <Calendar size={16} className="trip-date-icon" />
            <span className="trip-date-current-val">
              {formatDisplayDate(tripDate)}
            </span>
            <ChevronDown size={14} className={`trip-caret-icon ${isOpen ? 'open' : ''}`} />
          </button>

          {isOpen && (
            <div className="trip-date-dropdown-menu">
              <div className="calendar-header">
                <button type="button" className="calendar-nav-btn" onClick={handlePrevMonth}>
                  &lt;
                </button>
                <span>
                  {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button type="button" className="calendar-nav-btn" onClick={handleNextMonth}>
                  &gt;
                </button>
              </div>
              
              <div className="calendar-grid">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((wd) => (
                  <div key={wd} className="calendar-weekday">
                    {wd}
                  </div>
                ))}
                
                {getCalendarDays().map((cell, idx) => {
                  const cellDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + cell.monthOffset, cell.day);
                  const cellDateStr = `${cellDate.getFullYear()}-${(cellDate.getMonth() + 1).toString().padStart(2, '0')}-${cellDate.getDate().toString().padStart(2, '0')}`;
                  const isSelected = tripDate === cellDateStr;
                  
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`calendar-day ${!cell.isCurrentMonth ? 'empty' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectDay(cell.day, cell.monthOffset)}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Day Selector Navigation */}
      <div className="day-selector-container">
        <div className="day-tabs-scroll">
          {days.map((day, idx) => {
            const tabDate = formatTabDate(day.date);
            return (
              <div 
                key={day.id} 
                className={`day-tab-btn ${idx === activeDayIndex ? 'active' : ''}`}
                onClick={() => onSelectDayIndex(idx)}
              >
                <div className="day-tab-label">
                  <span className="day-tab-num">Day {day.dayNumber}</span>
                  {tabDate && <span className="day-tab-date">{tabDate}</span>}
                </div>
                {days.length > 1 && (
                  <button
                    type="button"
                    className="day-remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveDay(idx);
                    }}
                    title={`Remove Day ${day.dayNumber}`}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            className="day-add-btn"
            onClick={onAddDay}
            title="Add a day to this trip"
          >
            <Plus size={14} />
            <span>Day</span>
          </button>
        </div>
      </div>

      {/* Itinerary Stop cards / Empty state check */}
      {itinerary.length === 0 ? (
        <div className="empty-state" style={{ margin: '2rem 0' }}>
          <Calendar className="empty-state-icon" />
          <h3>Itinerary is empty for Day {activeDayIndex + 1}</h3>
          <p>Go to the <strong>Search & Pins</strong> tab and check the boxes next to your pinned locations to add them to this day's schedule.</p>
        </div>
      ) : (
        <>
          {/* Compact toggle + Zoom button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
            <button
              type="button"
              className="compact-toggle-btn"
              onClick={onZoomToTrip}
              disabled={!canZoom}
              title="Zoom to fit all stops"
              style={{ opacity: canZoom ? 1 : 0.45 }}
            >
              <Maximize2 size={14} />
              <span>Fit Map</span>
            </button>
            <button
              type="button"
              className={`compact-toggle-btn ${isCompact ? 'active' : ''}`}
              onClick={() => setIsCompact((p) => !p)}
              title={isCompact ? 'Expand view' : 'Compact view'}
            >
              {isCompact ? <LayoutList size={14} /> : <AlignJustify size={14} />}
              <span>{isCompact ? 'Expand' : 'Compact'}</span>
            </button>
          </div>

          <div className="itinerary-list">
            {itinerary.map((item, index) => {
          const loc = getLocation(item.locationId);
          if (!loc) return null;

          const isFirst = index === 0;
          const isLast = index === itinerary.length - 1;
          const nextItem = !isLast ? itinerary[index + 1] : null;
          const routeSegment = nextItem ? getRouteSegment(item, nextItem) : null;
          
          const catInfo = getCategory(loc.category);
          const Icon = catInfo.icon;
          const isSpendActive = (item.durationHours > 0 || item.durationMinutes > 0) || !!showSpendField[item.id];

          return (
            <div key={item.id} className={`itinerary-item-wrapper ${isCompact ? 'compact' : ''}`}>
              {/* Itinerary Destination Card */}
              <div 
                className={`card itinerary-card ${isCompact ? 'itinerary-card-compact' : ''}`}
                onClick={() => onSelectLocation(loc)}
                style={{ cursor: 'pointer', borderLeftColor: catInfo.color }}
              >
                <div className="itinerary-card-header">
                  <div className="itinerary-card-left-column" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                    <div className="itinerary-card-num" style={{ background: `${catInfo.color}20`, color: catInfo.color }}>{index + 1}</div>
                    
                    {!isCompact && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-icon-only"
                          style={{ width: '1.25rem', height: '1.25rem', padding: 0 }}
                          disabled={isFirst}
                          onClick={() => onReorderItinerary(index, 'up')}
                          title="Move Up"
                        >
                          <ArrowUp size={11} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-icon-only"
                          style={{ width: '1.25rem', height: '1.25rem', padding: 0 }}
                          disabled={isLast}
                          onClick={() => onReorderItinerary(index, 'down')}
                          title="Move Down"
                        >
                          <ArrowDown size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="itinerary-card-details">
                    <div className="itinerary-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <Icon size={14} style={{ color: catInfo.color, flexShrink: 0 }} />
                      <span>{loc.name}</span>
                    </div>

                    {!isCompact && (
                      <>
                        <div className="saved-item-address">{loc.displayName}</div>
                        
                        {/* Time Spent / Leave Picker */}
                        {isFirst ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.25rem' }}>
                            <div className="itinerary-duration-picker" onClick={(e) => e.stopPropagation()}>
                              <Clock size={14} className="text-muted" />
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                {isSpendActive ? 'Start at:' : 'Leave at:'}
                              </span>
                              <input
                                type="time"
                                value={item.startTime || '09:00'}
                                onChange={(e) => onUpdateStartTime(item.id, e.target.value)}
                                style={{
                                  border: '1px solid var(--border-color)',
                                  borderRadius: 'var(--radius-sm)',
                                  background: 'var(--bg-primary)',
                                  color: 'var(--text-primary)',
                                  fontFamily: 'var(--font-sans)',
                                  fontSize: '0.8rem',
                                  fontWeight: '600',
                                  padding: '0.1rem 0.25rem',
                                  outline: 'none',
                                  cursor: 'pointer',
                                }}
                              />
                            </div>
                            
                            {isSpendActive && (
                              <>
                                <div className="itinerary-duration-picker" onClick={(e) => e.stopPropagation()}>
                                  <Clock size={14} className="text-muted" />
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Spend:</span>
                                  
                                  <div className="duration-input-wrapper">
                                    <input
                                      type="number"
                                      min="0"
                                      max="99"
                                      value={item.durationHours}
                                      onChange={(e) => {
                                        const val = Math.max(0, parseInt(e.target.value) || 0);
                                        onUpdateDuration(item.id, val, item.durationMinutes);
                                      }}
                                    />
                                    <span>h</span>
                                  </div>
                                  
                                  <div className="duration-input-wrapper">
                                    <input
                                      type="number"
                                      min="0"
                                      max="59"
                                      value={item.durationMinutes}
                                      onChange={(e) => {
                                        const val = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                                        onUpdateDuration(item.id, item.durationHours, val);
                                      }}
                                    />
                                    <span>m</span>
                                  </div>
                                </div>

                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.1rem' }}>
                                  <span style={{ fontWeight: 600, color: 'var(--accent)' }}>Leave:</span>
                                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{computedTimes[item.id]?.leave}</span>
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.25rem' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span style={{ fontWeight: 600, color: 'var(--success)' }}>Arrive:</span>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{computedTimes[item.id]?.arrive}</span>
                            </div>
                            
                            {isSpendActive && (
                              <div className="itinerary-duration-picker" onClick={(e) => e.stopPropagation()}>
                                <Clock size={14} className="text-muted" />
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Spend:</span>
                                
                                <div className="duration-input-wrapper">
                                  <input
                                    type="number"
                                    min="0"
                                    max="99"
                                    value={item.durationHours}
                                    onChange={(e) => {
                                      const val = Math.max(0, parseInt(e.target.value) || 0);
                                      onUpdateDuration(item.id, val, item.durationMinutes);
                                    }}
                                  />
                                  <span>h</span>
                                </div>
                                
                                <div className="duration-input-wrapper">
                                  <input
                                    type="number"
                                    min="0"
                                    max="59"
                                    value={item.durationMinutes}
                                    onChange={(e) => {
                                      const val = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                                      onUpdateDuration(item.id, item.durationHours, val);
                                    }}
                                  />
                                  <span>m</span>
                                </div>
                              </div>
                            )}

                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.1rem' }}>
                              <span style={{ fontWeight: 600, color: 'var(--accent)' }}>Leave:</span>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{computedTimes[item.id]?.leave}</span>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {isCompact && (
                      <div className="itinerary-compact-meta">
                        {!isFirst && computedTimes[item.id]?.arrive && (
                          <span className="compact-time-badge" style={{ color: 'var(--success)', background: 'color-mix(in srgb, var(--success) 12%, transparent)' }}>
                            Arrive: {computedTimes[item.id].arrive}
                          </span>
                        )}
                        {(item.durationHours > 0 || item.durationMinutes > 0) && (
                          <span className="compact-duration-badge">
                            <Clock size={11} />
                            {item.durationHours > 0 ? `${item.durationHours}h` : ''}{item.durationMinutes > 0 ? `${item.durationMinutes}m` : ''}
                          </span>
                        )}
                        {computedTimes[item.id]?.leave && (
                          <span className="compact-time-badge" style={{ color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)' }}>
                            Leave: {computedTimes[item.id].leave}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right side options menu — hidden in compact */}
                  {!isCompact && (
                    <div className="itinerary-card-controls" onClick={(e) => e.stopPropagation()} style={{ alignSelf: 'flex-start' }}>
                      <div className="card-menu-container">
                        <button
                          type="button"
                          className="btn btn-secondary btn-icon-only"
                          style={{ width: '1.75rem', height: '1.75rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === item.id ? null : item.id);
                          }}
                          title="More options"
                        >
                          <MoreVertical size={13} />
                        </button>
                        
                        {activeMenuId === item.id && (
                          <ul className="card-menu-dropdown">
                            <li>
                              {isSpendActive ? (
                                <button
                                  type="button"
                                  className="card-menu-item-btn"
                                  onClick={() => {
                                    onUpdateDuration(item.id, 0, 0);
                                    setShowSpendField(prev => ({ ...prev, [item.id]: false }));
                                    setActiveMenuId(null);
                                  }}
                                >
                                  <Clock size={12} />
                                  <span>Remove Spend Time</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="card-menu-item-btn"
                                  onClick={() => {
                                    onUpdateDuration(item.id, 0, 0);
                                    setShowSpendField(prev => ({ ...prev, [item.id]: true }));
                                    setActiveMenuId(null);
                                  }}
                                >
                                  <Clock size={12} />
                                  <span>Add Spend Time</span>
                                </button>
                              )}
                            </li>
                            <li>
                              <button
                                type="button"
                                className="card-menu-item-btn danger-action"
                                onClick={() => {
                                  onRemoveFromItinerary(item.locationId);
                                  setActiveMenuId(null);
                                }}
                              >
                                <Trash2 size={12} />
                                <span>Remove Stop</span>
                              </button>
                            </li>
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Commute path connecting to NEXT destination — hidden in compact */}
              {nextItem && !isCompact && (
                <div className="itinerary-connection" onClick={(e) => e.stopPropagation()}>
                  <div className="connection-details">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {/* Commute Mode Selector */}
                      <div className="transit-type-selector">
                        <button
                          className={`transit-icon-btn ${item.commuteMode === 'driving' ? 'active' : ''}`}
                          title="Drive"
                          onClick={() => onUpdateCommuteMode(item.id, 'driving')}
                        >
                          <Car size={14} />
                        </button>
                        <button
                          className={`transit-icon-btn ${item.commuteMode === 'transit' ? 'active' : ''}`}
                          title="Transit (Est.)"
                          onClick={() => onUpdateCommuteMode(item.id, 'transit')}
                        >
                          <Train size={14} />
                        </button>
                        <button
                          className={`transit-icon-btn ${item.commuteMode === 'bicycle' ? 'active' : ''}`}
                          title="Bicycle"
                          onClick={() => onUpdateCommuteMode(item.id, 'bicycle')}
                        >
                          <Bike size={14} />
                        </button>
                        <button
                          className={`transit-icon-btn ${item.commuteMode === 'walking' ? 'active' : ''}`}
                          title="Walk"
                          onClick={() => onUpdateCommuteMode(item.id, 'walking')}
                        >
                          <Footprints size={14} />
                        </button>
                      </div>

                      {/* Path Details */}
                      {isLoadingRoutes ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Calculating...</span>
                      ) : routeSegment ? (
                        <div className="connection-stats">
                          <Navigation size={12} />
                          <span>{formatDistance(routeSegment.distance)}</span>
                          <span>•</span>
                          <span>{formatDuration(routeSegment.duration)}</span>
                        </div>
                      ) : item.commuteMode === 'transit' ? (
                        // Transit info notice
                        <div className="connection-stats" style={{ color: 'var(--text-secondary)' }}>
                          <Train size={12} />
                          <span>Transit estimated</span>
                        </div>
                      ) : (
                        <div className="connection-stats" style={{ color: 'var(--warning)' }}>
                          <AlertTriangle size={12} />
                          <span style={{ fontSize: '0.75rem' }}>No route found</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Commute path connecting to NEXT destination — simplified in compact */}
              {nextItem && isCompact && (
                <div className="itinerary-connection-compact" onClick={(e) => e.stopPropagation()}>
                  <div className="itinerary-connection-compact-line" />
                  <span className="itinerary-connection-compact-text">
                    {renderCompactCommuteIcon(item.commuteMode)}
                    {isLoadingRoutes ? (
                      '...'
                    ) : routeSegment ? (
                      formatDuration(routeSegment.duration)
                    ) : item.commuteMode === 'transit' ? (
                      'Transit'
                    ) : (
                      'No route'
                    )}
                  </span>
                </div>
              )}
            </div>
          );
        })}
          </div>
        </>
      )}

      </div>



      {/* Trip Summary — anchored to bottom of flex column, pushes list up when expanded */}
      {itinerary.length > 0 && (
        <div className="trip-summary-anchor">
          <div className="trip-summary-card" style={{ padding: '0.75rem 1rem', borderRadius: 0 }}>
            <div 
              className="trip-summary-header"
              onClick={() => setIsStatsExpanded((prev) => !prev)}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={16} style={{ color: 'white' }} />
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'white' }}>Trip Summary</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {!isStatsExpanded && (
                  <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 600 }}>
                    {itinerary.length} stops • {stats.trip}
                  </span>
                )}
                <ChevronDown size={14} className={`trip-caret-icon ${isStatsExpanded ? 'open' : ''}`} style={{ color: 'white' }} />
              </div>
            </div>

            {isStatsExpanded && (
              <div style={{ marginTop: '0.75rem', animation: 'trip-slide-down-fade 0.2s ease-out' }}>
                <div className="trip-summary-stats">
                  <div className="trip-stat-block">
                    <span className="trip-stat-label">Total Stops</span>
                    <span className="trip-stat-val">{itinerary.length}</span>
                  </div>
                  <div className="trip-stat-block">
                    <span className="trip-stat-label">Travel Distance</span>
                    <span className="trip-stat-val">{stats.distance}</span>
                  </div>
                  <div className="trip-stat-block">
                    <span className="trip-stat-label">Time spent at stops</span>
                    <span className="trip-stat-val">{stats.stay}</span>
                  </div>
                  <div className="trip-stat-block">
                    <span className="trip-stat-label">Total travel time</span>
                    <span className="trip-stat-val">{stats.travel}</span>
                  </div>
                </div>
                
                <div 
                  style={{ 
                    borderTop: '1px solid rgba(255, 255, 255, 0.2)', 
                    paddingTop: '0.65rem', 
                    marginTop: '0.65rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.85)' }}>ESTIMATED TRIP TIME:</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white' }}>{stats.trip}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
