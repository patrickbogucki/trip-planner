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
  MoreVertical,
  Check,
  GripVertical,
  Sparkles,
  FileText,
  Lock,
  Unlock
} from 'lucide-react';
import type { Location, ItineraryItem, RouteSegment, CommuteMode, TripDay } from '../types';
import { getCategory, CATEGORIES } from '../utils/categories';
import { computeItineraryTimes, formatMinutesToClockTime, minutesToTimeInputValue, haversineDistanceMeters } from '../utils/schedule';

interface ItineraryPanelProps {
  itinerary: ItineraryItem[];
  savedLocations: Location[];
  routes: RouteSegment[];
  isLoadingRoutes: boolean;
  onUpdateDuration: (id: string, hours: number, minutes: number) => void;
  onUpdateCommuteMode: (id: string, mode: CommuteMode) => void;
  routePreference?: 'shortest' | 'fastest';
  onUpdateRoutePreference: (preference: 'shortest' | 'fastest') => void;
  onReorderItinerary: (index: number, direction: 'up' | 'down') => void;
  onRemoveFromItinerary: (locationId: string) => void;
  onSelectLocation: (loc: Location) => void;
  onUpdateLockedArrivalTime: (id: string, lockedArrivalTime: string | null) => void;
  tripDate?: string;
  onUpdateTripDate: (date: string) => void;
  days: TripDay[];
  activeDayIndex: number;
  onSelectDayIndex: (index: number) => void;
  onAddDay: () => void;
  onRemoveDay: (index: number) => void;
  onZoomToTrip: () => void;
  canZoom: boolean;
  onAddToItinerary?: (locationId: string) => void;
  onInsertAtItinerary?: (locationId: string, index: number) => void;
  onSetItinerary?: (newItinerary: ItineraryItem[]) => void;
  onLoadDemoTrip?: () => void;
  onUpdateNote: (id: string, note: string) => void;
  noteLinesMax?: number;
  distanceUnit?: 'km' | 'mi';
}

export const ItineraryPanel: React.FC<ItineraryPanelProps> = ({
  itinerary,
  savedLocations,
  routes,
  isLoadingRoutes,
  onUpdateDuration,
  onUpdateCommuteMode,
  routePreference,
  onUpdateRoutePreference,
  onReorderItinerary,
  onSetItinerary,
  onRemoveFromItinerary,
  onSelectLocation,
  onUpdateLockedArrivalTime,
  tripDate,
  onUpdateTripDate,
  days,
  activeDayIndex,
  onSelectDayIndex,
  onAddDay,
  onRemoveDay,
  onZoomToTrip,
  canZoom,
  onAddToItinerary,
  onInsertAtItinerary,
  onLoadDemoTrip,
  onUpdateNote,
  noteLinesMax = 3,
  distanceUnit = 'km',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRoutePreferenceOpen, setIsRoutePreferenceOpen] = useState(false);
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [tempItinerary, setTempItinerary] = useState<ItineraryItem[] | null>(null);

  const routePreferenceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (draggedIndex === null) {
      setTempItinerary(null);
    }
  }, [itinerary, draggedIndex]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [activeNoteInputId, setActiveNoteInputId] = useState<string | null>(null);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [showSpendField, setShowSpendField] = useState<Record<string, boolean>>({});
  const [isAddingDestination, setIsAddingDestination] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [insertingAtIndex, setInsertingAtIndex] = useState<number | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState(() => {
    if (tripDate) {
      const [y, m, d] = tripDate.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Synchronize showSpendField state for items with existing durations
  useEffect(() => {
    setShowSpendField((prev) => {
      let updated = { ...prev };
      let changed = false;
      itinerary.forEach((item) => {
        const hasDuration = item.durationHours > 0 || item.durationMinutes > 0;
        if (hasDuration && prev[item.id] === undefined) {
          updated[item.id] = true;
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
  }, [itinerary]);

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

  // Close route preference dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (routePreferenceRef.current && !routePreferenceRef.current.contains(event.target as Node)) {
        setIsRoutePreferenceOpen(false);
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

  // Helper to get selected range boundaries
  const getSelectedRange = () => {
    if (!tripDate) return null;
    const [y, m, d] = tripDate.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + days.length - 1);
    end.setHours(0, 0, 0, 0);
    return { start, end };
  };

  const formatTripDateRange = () => {
    const range = getSelectedRange();
    if (!range) return 'Set trip date';

    const startObj = range.start;
    const endObj = range.end;
    const sameYear = startObj.getFullYear() === endObj.getFullYear();
    const sameMonth = sameYear && startObj.getMonth() === endObj.getMonth();

    let rangeStr = '';
    if (days.length <= 1) {
      rangeStr = startObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } else if (sameMonth) {
      rangeStr = `${startObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${endObj.getDate()}, ${endObj.getFullYear()}`;
    } else if (sameYear) {
      rangeStr = `${startObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${endObj.getFullYear()}`;
    } else {
      rangeStr = `${startObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${endObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }

    const daysCount = days.length;
    const daysStr = `(${daysCount} day${daysCount > 1 ? 's' : ''})`;
    return `${rangeStr} ${daysStr}`;
  };

  // Helper to get hovered range boundaries
  const getHoveredRange = () => {
    if (!hoveredDate) return null;
    const [y, m, d] = hoveredDate.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + days.length - 1);
    end.setHours(0, 0, 0, 0);
    return { start, end };
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
    if (distanceUnit === 'mi') {
      const miles = meters * 0.000621371;
      if (miles < 0.1) {
        return `${Math.round(meters * 3.28084)} ft`;
      }
      return `${miles.toFixed(1)} mi`;
    }
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
          const dist = haversineDistanceMeters(fromLoc.lat, fromLoc.lng, toLoc.lat, toLoc.lng);
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

  // Chronological schedule for every stop, computed by the single shared scheduling utility so
  // rendering here and the reorder-continuity logic in App.tsx can never disagree with each other.
  const rawTimes = computeItineraryTimes(itinerary, routes, savedLocations);
  const computedTimes: { [id: string]: { arrive: string; leave: string; arriveMinutes: number; isLocked: boolean; conflictMinutes: number; bufferMinutes: number } } = {};
  Object.entries(rawTimes).forEach(([id, t]) => {
    computedTimes[id] = {
      arrive: formatMinutesToClockTime(t.arriveMinutes),
      leave: formatMinutesToClockTime(t.leaveMinutes),
      arriveMinutes: t.arriveMinutes,
      isLocked: t.isLocked,
      conflictMinutes: t.conflictMinutes,
      bufferMinutes: t.bufferMinutes,
    };
  });

  const stats = calculateTotalStats();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Scrollable content area */}
      <div className="tab-content" style={{ paddingBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      
      {/* Custom Date Picker — always for start of trip (Day 1) */}
      <div className="trip-date-container">
        <span className="trip-date-label">Trip Date</span>
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
              {formatTripDateRange()}
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
                  cellDate.setHours(0, 0, 0, 0);
                  const cellDateStr = `${cellDate.getFullYear()}-${(cellDate.getMonth() + 1).toString().padStart(2, '0')}-${cellDate.getDate().toString().padStart(2, '0')}`;
                  const isSelected = tripDate === cellDateStr;

                  // Selected range calculations
                  const selectedRange = getSelectedRange();
                  const isInSelectedRange = selectedRange && cellDate >= selectedRange.start && cellDate <= selectedRange.end;
                  const isSelectedStart = isSelected && days.length > 1;
                  const isSelectedEnd = selectedRange && cellDate.getTime() === selectedRange.end.getTime() && days.length > 1;

                  // Hovered range calculations
                  const hoveredRange = getHoveredRange();
                  const isInHoverRange = hoveredRange && cellDate >= hoveredRange.start && cellDate <= hoveredRange.end;
                  const isHoverStart = hoveredRange && cellDate.getTime() === hoveredRange.start.getTime();
                  const isHoverEnd = hoveredRange && cellDate.getTime() === hoveredRange.end.getTime();

                  const classNames = [
                    'calendar-day',
                    !cell.isCurrentMonth ? 'empty' : '',
                    isSelected ? 'selected' : '',
                    // Selected range classes
                    isInSelectedRange && !isSelectedStart && !isSelectedEnd ? 'in-selected-range' : '',
                    isSelectedStart ? 'selected-range-start' : '',
                    isSelectedEnd ? 'selected-range-end' : '',
                    // Hover range classes
                    isInHoverRange && !isHoverStart && !isHoverEnd ? 'in-hover-range' : '',
                    isHoverStart ? 'hover-range-start' : '',
                    isHoverEnd ? 'hover-range-end' : '',
                  ].filter(Boolean).join(' ');
                  
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={classNames}
                      onClick={() => handleSelectDay(cell.day, cell.monthOffset)}
                      onMouseEnter={() => setHoveredDate(cellDateStr)}
                      onMouseLeave={() => setHoveredDate(null)}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>

              {/* Range Info Footer */}
              <div className="calendar-info-footer" style={{
                marginTop: '0.65rem',
                paddingTop: '0.55rem',
                borderTop: '1px solid var(--border-color)',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                textAlign: 'center',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem',
              }}>
                {(() => {
                  const range = getHoveredRange() || getSelectedRange();
                  if (!range) return <span>Select a start date</span>;
                  const opt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
                  const startStr = range.start.toLocaleDateString('en-US', opt);
                  const endStr = range.end.toLocaleDateString('en-US', opt);
                  return (
                    <span>
                      {getHoveredRange() ? 'Preview: ' : 'Active: '}
                      <strong style={{ color: 'var(--accent)' }}>{startStr}</strong>
                      {days.length > 1 && (
                        <>
                          {' to '}
                          <strong style={{ color: 'var(--accent)' }}>{endStr}</strong>
                        </>
                      )}
                      {` (${days.length} day${days.length > 1 ? 's' : ''})`}
                    </span>
                  );
                })()}
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
      {savedLocations.length === 0 && itinerary.length === 0 ? (
        <div className="empty-state" style={{ margin: '2rem 0', padding: '1.5rem', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
          <Calendar className="empty-state-icon" style={{ color: 'var(--primary)' }} />
          <h3>Welcome to Trip Planner!</h3>
          <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            Start from a clean slate by searching for locations in the <strong>Search & Pins</strong> tab, or load a pre-configured demo trip to explore features.
          </p>
          {onLoadDemoTrip && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onLoadDemoTrip}
            >
              <Sparkles size={16} />
              <span>Load NYC Demo Trip</span>
            </button>
          )}
        </div>
      ) : itinerary.length === 0 ? (
        <div className="empty-state" style={{ margin: '2rem 0' }}>
          <Calendar className="empty-state-icon" />
          <h3>Itinerary is empty for Day {activeDayIndex + 1}</h3>
          <p>Go to the <strong>Search & Pins</strong> tab and check the boxes next to your pinned locations to add them to this day's schedule.</p>
        </div>
      ) : (
        <>
          {/* Compact toggle + Zoom button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', alignItems: 'center' }}>
            <div className="route-preference-custom-wrapper" ref={routePreferenceRef}>
              <button
                type="button"
                className={`compact-toggle-btn ${isRoutePreferenceOpen ? 'active' : ''}`}
                onClick={() => setIsRoutePreferenceOpen((prev) => !prev)}
                title="Driving route preference for all routes on the trip"
              >
                <span>{routePreference === 'shortest' ? 'Shortest Route' : 'Fastest Route'}</span>
                <ChevronDown size={14} className={`trip-caret-icon ${isRoutePreferenceOpen ? 'open' : ''}`} />
              </button>

              {isRoutePreferenceOpen && (
                <ul className="route-preference-menu" role="listbox">
                  <li
                    role="option"
                    aria-selected={routePreference === 'fastest'}
                    className={`route-preference-item ${routePreference === 'fastest' ? 'selected' : ''}`}
                    onClick={() => {
                      onUpdateRoutePreference('fastest');
                      setIsRoutePreferenceOpen(false);
                    }}
                  >
                    <span>Fastest Route</span>
                    {routePreference === 'fastest' && <Check size={14} className="route-preference-checkmark" />}
                  </li>
                  <li
                    role="option"
                    aria-selected={routePreference === 'shortest'}
                    className={`route-preference-item ${routePreference === 'shortest' ? 'selected' : ''}`}
                    onClick={() => {
                      onUpdateRoutePreference('shortest');
                      setIsRoutePreferenceOpen(false);
                    }}
                  >
                    <span>Shortest Route</span>
                    {routePreference === 'shortest' && <Check size={14} className="route-preference-checkmark" />}
                  </li>
                </ul>
              )}
            </div>
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

          <div className={`itinerary-list ${draggedIndex !== null ? 'drag-active' : ''}`}>
            {(tempItinerary || itinerary).map((item, index) => {
              const displayList = tempItinerary || itinerary;
              const loc = getLocation(item.locationId);
              if (!loc) return null;

              const isFirst = index === 0;
              const isLast = index === displayList.length - 1;
              const nextItem = !isLast ? displayList[index + 1] : null;
              const routeSegment = nextItem ? getRouteSegment(item, nextItem) : null;
              
              const catInfo = getCategory(loc.category);
              const Icon = catInfo.icon;
              const isSpendActive = (item.durationHours > 0 || item.durationMinutes > 0) || !!showSpendField[item.id];

              return (
                <div 
                  key={item.id} 
                  className={`itinerary-item-wrapper ${isCompact ? 'compact' : ''} ${draggedIndex === index ? 'dragging' : ''}`}
                  draggable={isCompact}
                  onDragStart={(e) => {
                    if (!isCompact) return;
                    setDraggedIndex(index);
                    setTempItinerary([...itinerary]);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', index.toString());
                  }}
                  onDragEnter={() => {
                    if (!isCompact || draggedIndex === null || draggedIndex === index || !tempItinerary) return;
                    const updated = [...tempItinerary];
                    const [draggedItem] = updated.splice(draggedIndex, 1);
                    updated.splice(index, 0, draggedItem);
                    setDraggedIndex(index);
                    setTempItinerary(updated);
                  }}
                  onDragOver={(e) => {
                    if (isCompact && draggedIndex !== null) {
                      e.preventDefault();
                    }
                  }}
                  onDragEnd={() => {
                    if (!isCompact) return;
                    if (tempItinerary !== null && onSetItinerary) {
                      const orderChanged = tempItinerary.some((itm, idx) => itm.id !== itinerary[idx]?.id);
                      if (orderChanged) {
                        onSetItinerary(tempItinerary);
                      }
                    }
                    setDraggedIndex(null);
                    setTempItinerary(null);
                  }}
                >
                  {/* Itinerary Destination Card */}
                  <div 
                    className={`card itinerary-card ${isCompact ? 'itinerary-card-compact' : ''}`}
                    onClick={() => onSelectLocation(loc)}
                    style={{ cursor: 'pointer', borderLeftColor: catInfo.color }}
                  >
                    <div className="itinerary-card-header">
                      <div className="itinerary-card-left-column" style={{ display: 'flex', flexDirection: isCompact ? 'row' : 'column', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                        {isCompact && (
                          <div className="drag-handle" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', opacity: 0.5, cursor: 'grab' }}>
                            <GripVertical size={14} />
                          </div>
                        )}
                        <div className="itinerary-card-num" style={{ background: `${catInfo.color}20`, color: catInfo.color }}>{index + 1}</div>
                    
                    {!isCompact && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }} onClick={(e) => e.stopPropagation()}>
                        {!isFirst && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-icon-only"
                            style={{ width: '1.25rem', height: '1.25rem', padding: 0 }}
                            onClick={() => onReorderItinerary(index, 'up')}
                            title="Move Up"
                          >
                            <ArrowUp size={11} />
                          </button>
                        )}
                        {!isLast && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-icon-only"
                            style={{ width: '1.25rem', height: '1.25rem', padding: 0 }}
                            onClick={() => onReorderItinerary(index, 'down')}
                            title="Move Down"
                          >
                            <ArrowDown size={11} />
                          </button>
                        )}
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
                                value={item.lockedArrivalTime || '09:00'}
                                onChange={(e) => onUpdateLockedArrivalTime(item.id, e.target.value)}
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
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }} onClick={(e) => e.stopPropagation()}>
                              <span style={{ fontWeight: 600, color: 'var(--success)' }}>Arrive:</span>
                              {item.lockedArrivalTime ? (
                                <input
                                  type="time"
                                  value={item.lockedArrivalTime}
                                  onChange={(e) => onUpdateLockedArrivalTime(item.id, e.target.value)}
                                  style={{
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-sm)',
                                    background: 'var(--bg-primary)',
                                    color: 'var(--text-primary)',
                                    fontFamily: 'var(--font-sans)',
                                    fontSize: '0.8rem',
                                    fontWeight: '700',
                                    padding: '0.1rem 0.25rem',
                                    outline: 'none',
                                    cursor: 'pointer',
                                  }}
                                />
                              ) : (
                                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{computedTimes[item.id]?.arrive}</span>
                              )}
                              <button
                                type="button"
                                className="btn btn-secondary btn-icon-only"
                                style={{ width: '1.15rem', height: '1.15rem', padding: 0, opacity: item.lockedArrivalTime ? 1 : 0.5 }}
                                onClick={() =>
                                  onUpdateLockedArrivalTime(
                                    item.id,
                                    item.lockedArrivalTime ? null : minutesToTimeInputValue(computedTimes[item.id]?.arriveMinutes ?? 0)
                                  )
                                }
                                title={item.lockedArrivalTime ? 'Unlock arrival time' : 'Lock arrival time (e.g. a reservation)'}
                              >
                                {item.lockedArrivalTime ? <Lock size={11} /> : <Unlock size={11} />}
                              </button>
                            </div>

                            {(computedTimes[item.id]?.conflictMinutes ?? 0) > 0 && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <AlertTriangle size={12} />
                                <span>Running {computedTimes[item.id].conflictMinutes}m late for this arrival time</span>
                              </div>
                            )}

                            {(computedTimes[item.id]?.bufferMinutes ?? 0) > 0 && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <Check size={12} />
                                <span>{computedTimes[item.id].bufferMinutes}m to spare before this arrival time</span>
                              </div>
                            )}

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

                            {(isFirst ? isSpendActive : (isLast ? isSpendActive : true)) && (
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.1rem' }}>
                                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>Leave:</span>
                                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{computedTimes[item.id]?.leave}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Note textarea/button inside expanded view */}
                        {!(item.note || activeNoteInputId === item.id) ? (
                          <button
                            type="button"
                            className="add-note-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveNoteInputId(item.id);
                            }}
                            title="Add note"
                          >
                            <FileText size={12} />
                            <span>Add Note</span>
                          </button>
                        ) : (
                          <div className="itinerary-card-note-section" onClick={(e) => e.stopPropagation()}>
                            <textarea
                              ref={(el) => {
                                if (el) {
                                  el.style.height = 'auto';
                                  el.style.height = el.scrollHeight + 'px';
                                }
                              }}
                              className="itinerary-card-note-input"
                              style={{ maxHeight: `${0.8 * 1.4 * noteLinesMax + 0.7}rem` }}
                              value={item.note || ''}
                              onChange={(e) => {
                                onUpdateNote(item.id, e.target.value);
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                              }}
                              onBlur={() => {
                                setActiveNoteInputId(null);
                                if (!item.note || item.note.trim() === '') {
                                  onUpdateNote(item.id, '');
                                }
                              }}
                              autoFocus={activeNoteInputId === item.id}
                              placeholder="Add booking confirmation, reservation details, or notes..."
                              rows={1}
                            />
                          </div>
                        )}
                      </>
                    )}

                    {isCompact && (
                      <>
                        <div className="itinerary-compact-meta">
                          {!isFirst && computedTimes[item.id]?.arrive && (
                            <span className="compact-time-badge" style={{ color: 'var(--success)', background: 'color-mix(in srgb, var(--success) 12%, transparent)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                              {item.lockedArrivalTime && <Lock size={10} />}
                              Arrive: {computedTimes[item.id].arrive}
                            </span>
                          )}
                          {(computedTimes[item.id]?.conflictMinutes ?? 0) > 0 && (
                            <span className="compact-time-badge" style={{ color: 'var(--warning)', background: 'color-mix(in srgb, var(--warning) 15%, transparent)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                              <AlertTriangle size={10} />
                              {computedTimes[item.id].conflictMinutes}m late
                            </span>
                          )}
                          {(computedTimes[item.id]?.bufferMinutes ?? 0) > 0 && (
                            <span className="compact-time-badge" style={{ color: 'var(--success)', background: 'color-mix(in srgb, var(--success) 12%, transparent)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                              <Check size={10} />
                              {computedTimes[item.id].bufferMinutes}m to spare
                            </span>
                          )}
                          {(item.durationHours > 0 || item.durationMinutes > 0) && (
                            <span className="compact-duration-badge">
                              <Clock size={11} />
                              {item.durationHours > 0 ? `${item.durationHours}h` : ''}{item.durationMinutes > 0 ? `${item.durationMinutes}m` : ''}
                            </span>
                          )}
                          {computedTimes[item.id]?.leave && (!isLast || isSpendActive) && (
                            <span className="compact-time-badge" style={{ color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)' }}>
                              Leave: {computedTimes[item.id].leave}
                            </span>
                          )}
                        </div>
                        {item.note && expandedNoteId !== item.id && (
                          <div 
                            className="compact-note-badge-line"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedNoteId(item.id);
                            }}
                          >
                            <span className="compact-duration-badge compact-note-badge full-width-note-badge" title="Click to view note">
                              <FileText size={11} style={{ flexShrink: 0 }} />
                              <span className="compact-note-full-text">{item.note}</span>
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {isCompact && expandedNoteId === item.id && item.note && (
                      <div 
                        className="compact-note-full-view" 
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="compact-note-header">
                          <span>Note</span>
                          <button 
                            type="button" 
                            className="compact-note-close" 
                            onClick={() => setExpandedNoteId(null)}
                            title="Close note"
                          >
                            <X size={10} />
                          </button>
                        </div>
                        <div className="compact-note-body">
                          {item.note}
                        </div>
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
                <div key={`conn-wrap-${item.id}`} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="itinerary-connection" onClick={(e) => e.stopPropagation()}>
                    {/* Left Column: Plus Insert Button centered under number badge */}
                    <div style={{ width: '1.5rem', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                      <button
                        type="button"
                        style={{
                          width: '1.35rem',
                          height: '1.35rem',
                          padding: 0,
                          borderRadius: '50%',
                          border: '1px solid var(--border-color)',
                          background: insertingAtIndex === index + 1 ? 'var(--accent)' : 'var(--bg-secondary)',
                          color: insertingAtIndex === index + 1 ? 'white' : 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)',
                        }}
                        onClick={() => {
                          setInsertingAtIndex(insertingAtIndex === index + 1 ? null : index + 1);
                        }}
                        title="Insert destination here"
                        onMouseEnter={(e) => {
                          if (insertingAtIndex !== index + 1) {
                            e.currentTarget.style.borderColor = 'var(--accent)';
                            e.currentTarget.style.color = 'var(--accent)';
                            e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 8%, var(--bg-primary))';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (insertingAtIndex !== index + 1) {
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                            e.currentTarget.style.background = 'var(--bg-secondary)';
                          }
                        }}
                      >
                        {insertingAtIndex === index + 1 ? <X size={10} /> : <Plus size={10} />}
                      </button>
                    </div>

                    {/* Right Column: Details */}
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

                  {/* Add Destination Dropdown Inline Card */}
                  {insertingAtIndex === index + 1 && (
                    <div style={{ padding: '0.25rem 0.75rem 0.75rem' }}>
                      <div className="card" style={{
                        padding: '0.75rem',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-secondary)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.65rem',
                        animation: 'trip-slide-down-fade 0.15s ease-out',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>Insert Destination</span>
                          <button
                            type="button"
                            className="btn btn-secondary btn-icon-only"
                            style={{ width: '1.5rem', height: '1.5rem', padding: 0 }}
                            onClick={() => setInsertingAtIndex(null)}
                          >
                            <X size={12} />
                          </button>
                        </div>

                        {/* Category Pill Filters */}
                        <div style={{ 
                          display: 'flex', 
                          gap: '0.3rem', 
                          overflowX: 'auto', 
                          paddingBottom: '0.2rem',
                          WebkitOverflowScrolling: 'touch' 
                        }}>
                          <button
                            type="button"
                            style={{
                              padding: '0.2rem 0.5rem',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              borderRadius: '100px',
                              border: '1px solid var(--border-color)',
                              background: selectedCategoryFilter === 'all' ? 'var(--accent)' : 'var(--bg-primary)',
                              color: selectedCategoryFilter === 'all' ? 'white' : 'var(--text-secondary)',
                              whiteSpace: 'nowrap',
                              cursor: 'pointer',
                            }}
                            onClick={() => setSelectedCategoryFilter('all')}
                          >
                            All
                          </button>
                          {CATEGORIES.map((cat) => {
                            const CatIcon = cat.icon;
                            const isActive = selectedCategoryFilter === cat.id;
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                style={{
                                  padding: '0.2rem 0.5rem',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  borderRadius: '100px',
                                  border: `1px solid ${isActive ? cat.color : 'var(--border-color)'}`,
                                  background: isActive ? cat.color : 'var(--bg-primary)',
                                  color: isActive ? 'white' : 'var(--text-secondary)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  whiteSpace: 'nowrap',
                                  cursor: 'pointer',
                                }}
                                onClick={() => setSelectedCategoryFilter(cat.id)}
                              >
                                <CatIcon size={10} />
                                <span>{cat.label.split(' / ')[0]}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Pinned Locations List */}
                        {(() => {
                          const eligibleLocations = savedLocations.filter((loc) => {
                            if (selectedCategoryFilter !== 'all' && loc.category !== selectedCategoryFilter) return false;
                            return true;
                          });

                          if (eligibleLocations.length === 0) {
                            return (
                              <div style={{ 
                                padding: '1rem', 
                                textAlign: 'center', 
                                fontSize: '0.75rem', 
                                color: 'var(--text-muted)',
                                border: '1px dashed var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                background: 'var(--bg-primary)',
                              }}>
                                {savedLocations.length === 0 
                                  ? 'No pinned locations. Save places on Search tab first.'
                                  : 'No pinned places in this category.'
                                }
                              </div>
                            );
                          }

                          return (
                            <div style={{ 
                              maxHeight: '160px', 
                              overflowY: 'auto', 
                              display: 'flex', 
                              flexDirection: 'column', 
                              gap: '0.35rem' 
                            }}>
                              {eligibleLocations.map((loc) => {
                                const cat = getCategory(loc.category);
                                const CatIcon = cat.icon;
                                const matchCount = itinerary.filter((item) => item.locationId === loc.id).length;
                                const alreadyInItinerary = matchCount > 0;

                                return (
                                  <button
                                    key={loc.id}
                                    type="button"
                                    className={`add-dest-item ${alreadyInItinerary ? 'added' : ''}`}
                                    onClick={() => {
                                      onInsertAtItinerary?.(loc.id, index + 1);
                                      setInsertingAtIndex(null);
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden' }}>
                                      <CatIcon size={12} style={{ color: cat.color, flexShrink: 0 }} />
                                      <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{loc.name}</span>
                                    </div>
                                    
                                    <span className="default-text">
                                      {alreadyInItinerary ? (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', color: 'var(--success)', fontWeight: 700 }}>
                                          <Check size={11} />
                                          <span>Added ({matchCount}x)</span>
                                        </span>
                                      ) : (
                                        <span style={{ color: 'var(--accent)', fontWeight: 700 }}>+ Add</span>
                                      )}
                                    </span>
                                    
                                    <span className="hover-text" style={{ fontWeight: 700 }}>
                                      + Insert
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
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

      {/* "Add Destination" Button / Inline Widget */}
      <div style={{ margin: '0.25rem 0.5rem 0.5rem' }}>
        {!isAddingDestination ? (
          <button
            type="button"
            className="btn-add-destination"
            onClick={() => {
              setIsAddingDestination(true);
              setSelectedCategoryFilter('all');
            }}
          >
            <Plus size={15} />
            <span>Add Destination</span>
          </button>
        ) : (
          <div className="card" style={{
            padding: '0.75rem',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            animation: 'trip-slide-down-fade 0.15s ease-out',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>Choose Destination</span>
              <button
                type="button"
                className="btn btn-secondary btn-icon-only"
                style={{ width: '1.5rem', height: '1.5rem', padding: 0 }}
                onClick={() => setIsAddingDestination(false)}
              >
                <X size={12} />
              </button>
            </div>

            {/* Category Pill Filters */}
            <div style={{ 
              display: 'flex', 
              gap: '0.3rem', 
              overflowX: 'auto', 
              paddingBottom: '0.2rem',
              WebkitOverflowScrolling: 'touch' 
            }}>
              <button
                type="button"
                style={{
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  borderRadius: '100px',
                  border: '1px solid var(--border-color)',
                  background: selectedCategoryFilter === 'all' ? 'var(--accent)' : 'var(--bg-primary)',
                  color: selectedCategoryFilter === 'all' ? 'white' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedCategoryFilter('all')}
              >
                All
              </button>
              {CATEGORIES.map((cat) => {
                const CatIcon = cat.icon;
                const isActive = selectedCategoryFilter === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    style={{
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      borderRadius: '100px',
                      border: `1px solid ${isActive ? cat.color : 'var(--border-color)'}`,
                      background: isActive ? cat.color : 'var(--bg-primary)',
                      color: isActive ? 'white' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedCategoryFilter(cat.id)}
                  >
                    <CatIcon size={10} />
                    <span>{cat.label.split(' / ')[0]}</span>
                  </button>
                );
              })}
            </div>

            {/* Pinned Locations List */}
            {(() => {
              // Filter locations
              const eligibleLocations = savedLocations.filter((loc) => {
                // Matches selected category filter
                if (selectedCategoryFilter !== 'all' && loc.category !== selectedCategoryFilter) return false;
                return true;
              });

              if (eligibleLocations.length === 0) {
                return (
                  <div style={{ 
                    padding: '1rem', 
                    textAlign: 'center', 
                    fontSize: '0.75rem', 
                    color: 'var(--text-muted)',
                    border: '1px dashed var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-primary)',
                  }}>
                    {savedLocations.length === 0 
                      ? 'No pinned locations. Save places on Search tab first.'
                      : 'No pinned places in this category.'
                    }
                  </div>
                );
              }

              return (
                <div style={{ 
                  maxHeight: '160px', 
                  overflowY: 'auto', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '0.35rem' 
                }}>
                  {eligibleLocations.map((loc) => {
                    const cat = getCategory(loc.category);
                    const CatIcon = cat.icon;
                    const matchCount = itinerary.filter((item) => item.locationId === loc.id).length;
                    const alreadyInItinerary = matchCount > 0;

                    return (
                      <button
                        key={loc.id}
                        type="button"
                        className={`add-dest-item ${alreadyInItinerary ? 'added' : ''}`}
                        onClick={() => {
                          onAddToItinerary?.(loc.id);
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden' }}>
                          <CatIcon size={12} style={{ color: cat.color, flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{loc.name}</span>
                        </div>
                        
                        <span className="default-text">
                          {alreadyInItinerary ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', color: 'var(--success)', fontWeight: 700 }}>
                              <Check size={11} />
                              <span>Added ({matchCount}x)</span>
                            </span>
                          ) : (
                            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>+ Add</span>
                          )}
                        </span>
                        
                        <span className="hover-text" style={{ fontWeight: 700 }}>
                          + Add Stop
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </div>

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
