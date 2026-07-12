import { Compass, Calendar, MapPin, Settings, Briefcase } from 'lucide-react';

interface MiniSidebarProps {
  activeTab: 'trips' | 'itinerary' | 'pins';
  onTabChange: (tab: 'trips' | 'itinerary' | 'pins') => void;
  onSettingsClick: () => void;
  isSettingsOpen: boolean;
}

export const MiniSidebar: React.FC<MiniSidebarProps> = ({
  activeTab,
  onTabChange,
  onSettingsClick,
  isSettingsOpen,
}) => {
  return (
    <aside className="mini-sidebar">
      {/* Top Group: Brand Logo & Navigation Tabs */}
      <div className="mini-sidebar-group" style={{ gap: '1rem' }}>
        <div className="mini-sidebar-logo" title="Horizon" style={{ marginBottom: '0.75rem' }}>
          <Compass className="brand-icon" />
        </div>

        <button
          className={`mini-sidebar-btn ${activeTab === 'trips' && !isSettingsOpen ? 'active' : ''}`}
          onClick={() => onTabChange('trips')}
          title="Trips"
          aria-label="Trips"
        >
          <Briefcase size={20} />
          <span>Trips</span>
        </button>

        <button
          className={`mini-sidebar-btn ${activeTab === 'itinerary' && !isSettingsOpen ? 'active' : ''}`}
          onClick={() => onTabChange('itinerary')}
          title="Itinerary"
          aria-label="Itinerary"
        >
          <Calendar size={20} />
          <span>Itinerary</span>
        </button>
        <button
          className={`mini-sidebar-btn ${activeTab === 'pins' && !isSettingsOpen ? 'active' : ''}`}
          onClick={() => onTabChange('pins')}
          title="Pinned Locations"
          aria-label="Pinned Locations"
        >
          <MapPin size={20} />
          <span>Pins</span>
        </button>
      </div>

      {/* Settings Icon */}
      <button
        className={`mini-sidebar-btn ${isSettingsOpen ? 'active' : ''}`}
        onClick={onSettingsClick}
        title="Settings"
        aria-label="Settings"
      >
        <Settings size={20} />
        <span>Settings</span>
      </button>
    </aside>
  );
};
